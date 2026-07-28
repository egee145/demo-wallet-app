import { randomUUID } from 'node:crypto';
import { PaymentSessionStatus, TransactionStatus } from '../../src/generated/prisma/client.js';
import { E2eHarness } from '../support/e2e-harness.js';

const describeDatabase = process.env.TEST_DATABASE_URL ? describe : describe.skip;

describeDatabase('wallet and payment integration', () => {
  const harness = new E2eHarness();

  beforeAll(async () => harness.start());
  afterAll(async () => harness.stop());
  beforeEach(async () => harness.reset());

  it('creates USER and wallet atomically, then replays an audited ADMIN deposit', async () => {
    const admin = await harness.createAdmin();
    const user = await harness.registerUser();
    const wallet = await harness.prisma.wallet.findUnique({ where: { userId: user.user.id } });

    expect(wallet?.balance.toFixed(2)).toBe('0.00');
    const key = randomUUID();
    const first = await harness.deposit(admin.accessToken, user.user.id, 50.25, key).expect(201);
    const replay = await harness.deposit(admin.accessToken, user.user.id, 50.25, key).expect(201);

    expect(replay.body).toEqual(first.body);
    expect(
      (
        await harness.prisma.wallet.findUniqueOrThrow({ where: { userId: user.user.id } })
      ).balance.toFixed(2),
    ).toBe('50.25');
    expect(await harness.prisma.walletAdjustment.count()).toBe(1);
  });

  it('provisions a dedicated MERCHANT wallet and completes QR payment atomically', async () => {
    const admin = await harness.createAdmin();
    const user = await harness.registerUser();
    const merchant = await harness.provisionMerchant(admin.accessToken);
    await harness.deposit(admin.accessToken, user.user.id, 100).expect(201);
    const session = await harness.createSession(merchant.accessToken, 50.25);

    expect(session.qrPayload).toBe(session.id);
    const payment = await harness
      .http()
      .post('/api/payments/qr')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .set('Idempotency-Key', randomUUID())
      .send({ paymentSessionId: session.id })
      .expect(201);

    const payerWallet = await harness.prisma.wallet.findUniqueOrThrow({
      where: { userId: user.user.id },
    });
    const merchantWallet = await harness.prisma.wallet.findUniqueOrThrow({
      where: { id: merchant.walletId },
    });
    const persistedSession = await harness.prisma.paymentSession.findUniqueOrThrow({
      where: { id: session.id },
    });

    expect(payment.body.success).toBe(true);
    expect(payerWallet.balance.toFixed(2)).toBe('49.75');
    expect(merchantWallet.balance.toFixed(2)).toBe('50.25');
    expect(persistedSession.status).toBe(PaymentSessionStatus.PAID);
    expect(
      await harness.prisma.transaction.count({
        where: { paymentSessionId: session.id, status: TransactionStatus.SUCCESS },
      }),
    ).toBe(1);
  });

  it('records a failed NFC attempt without changing either wallet', async () => {
    const admin = await harness.createAdmin();
    const user = await harness.registerUser();
    const merchant = await harness.provisionMerchant(admin.accessToken);
    const session = await harness.createSession(merchant.accessToken, 0.01);

    await harness
      .http()
      .post('/api/payments/nfc')
      .set('Authorization', `Bearer ${merchant.accessToken}`)
      .set('Idempotency-Key', randomUUID())
      .send({ paymentSessionId: session.id, userId: user.user.id, tagUid: user.nfcTagUid })
      .expect(422);

    expect(
      (
        await harness.prisma.wallet.findUniqueOrThrow({ where: { userId: user.user.id } })
      ).balance.toFixed(2),
    ).toBe('0.00');
    expect(
      (
        await harness.prisma.wallet.findUniqueOrThrow({ where: { id: merchant.walletId } })
      ).balance.toFixed(2),
    ).toBe('0.00');
    expect(
      (await harness.prisma.paymentSession.findUniqueOrThrow({ where: { id: session.id } })).status,
    ).toBe(PaymentSessionStatus.WAITING);
    expect(
      await harness.prisma.paymentAttempt.count({ where: { failureCode: 'INSUFFICIENT_BALANCE' } }),
    ).toBe(1);
    expect(await harness.prisma.transaction.count()).toBe(0);
  });

  it('rotates refresh tokens and revokes the family when an old token is reused', async () => {
    const user = await harness.registerUser();
    const rotation = await harness
      .http()
      .post('/api/auth/refresh')
      .send({ refreshToken: user.refreshToken })
      .expect(200);

    await harness
      .http()
      .post('/api/auth/refresh')
      .send({ refreshToken: user.refreshToken })
      .expect(401)
      .expect(({ body }) => {
        expect(body.code).toBe('AUTH_REFRESH_TOKEN_REUSED');
      });
    await harness
      .http()
      .post('/api/auth/refresh')
      .send({ refreshToken: rotation.body.refreshToken as string })
      .expect(401);
  });

  it('rejects client-selected roles and enforces merchant-only card user lookup', async () => {
    const user = await harness.registerUser();

    await harness
      .http()
      .post('/api/auth/register')
      .send({
        name: 'Escalation Attempt',
        email: `escalation-${randomUUID()}@example.test`,
        phone: `+907${randomUUID().replaceAll('-', '').slice(0, 9)}`,
        password: 'UserPassword!123',
        role: 'ADMIN',
      })
      .expect(400);
    await harness
      .http()
      .get(`/api/users/${user.user.id}`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(403);

    const admin = await harness.createAdmin();
    const merchant = await harness.provisionMerchant(admin.accessToken);
    await harness.deposit(admin.accessToken, user.user.id, 50).expect(201);
    await harness
      .http()
      .get(`/api/users/${user.user.id}`)
      .set('Authorization', `Bearer ${merchant.accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ id: user.user.id, walletBalance: 50 });
      });
  });

  it('keeps session cancellation idempotent and rejects payment afterwards', async () => {
    const admin = await harness.createAdmin();
    const user = await harness.registerUser();
    const merchant = await harness.provisionMerchant(admin.accessToken);
    await harness.deposit(admin.accessToken, user.user.id, 50).expect(201);
    const session = await harness.createSession(merchant.accessToken, 50);

    await harness
      .http()
      .post(`/api/payments/session/${session.id}/cancel`)
      .set('Authorization', `Bearer ${merchant.accessToken}`)
      .expect(201);
    await harness
      .http()
      .post(`/api/payments/session/${session.id}/cancel`)
      .set('Authorization', `Bearer ${merchant.accessToken}`)
      .expect(201);
    await harness
      .http()
      .post('/api/payments/qr')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .set('Idempotency-Key', randomUUID())
      .send({ paymentSessionId: session.id })
      .expect(409)
      .expect(({ body }) => {
        expect(body.code).toBe('PAYMENT_SESSION_CANCELLED');
      });

    expect(
      (await harness.prisma.paymentSession.findUniqueOrThrow({ where: { id: session.id } })).status,
    ).toBe(PaymentSessionStatus.CANCELLED);
    expect(await harness.prisma.transaction.count()).toBe(0);
  });

  it('marks an expired WAITING session lazily and refuses it with 410', async () => {
    const admin = await harness.createAdmin();
    const user = await harness.registerUser();
    const merchant = await harness.provisionMerchant(admin.accessToken);
    const now = Date.now();
    const session = await harness.prisma.paymentSession.create({
      data: {
        merchantId: merchant.merchantId,
        amount: 50,
        createdAt: new Date(now - 120_000),
        expiresAt: new Date(now - 60_000),
      },
    });

    await harness
      .http()
      .post('/api/payments/qr')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .set('Idempotency-Key', randomUUID())
      .send({ paymentSessionId: session.id })
      .expect(410)
      .expect(({ body }) => {
        expect(body.code).toBe('PAYMENT_SESSION_EXPIRED');
      });
    expect(
      (await harness.prisma.paymentSession.findUniqueOrThrow({ where: { id: session.id } })).status,
    ).toBe(PaymentSessionStatus.EXPIRED);
  });

  it('rejects an idempotency key reused with another deposit payload', async () => {
    const admin = await harness.createAdmin();
    const user = await harness.registerUser();
    const key = randomUUID();

    await harness.deposit(admin.accessToken, user.user.id, 50, key).expect(201);
    await harness
      .deposit(admin.accessToken, user.user.id, 50.25, key)
      .expect(409)
      .expect(({ body }) => {
        expect(body.code).toBe('IDEMPOTENCY_KEY_REUSED');
      });

    expect(
      (
        await harness.prisma.wallet.findUniqueOrThrow({ where: { userId: user.user.id } })
      ).balance.toFixed(2),
    ).toBe('50.00');
    expect(await harness.prisma.walletAdjustment.count()).toBe(1);
  });

  it('registers a BUSINESS account with its own merchant wallet and enforces login type', async () => {
    const suffix = randomUUID();
    const email = `public-merchant-${suffix}@example.test`;
    const registration = await harness
      .http()
      .post('/api/auth/register')
      .send({
        accountType: 'BUSINESS',
        name: 'Business Owner',
        businessName: 'Antalya Test İşletmesi',
        email,
        phone: `+904${suffix.replaceAll('-', '').slice(0, 9).replace(/[a-f]/g, '7')}`,
        password: 'MerchantPassword!123',
      })
      .expect(201);

    expect(registration.body.user.role).toBe('MERCHANT');
    const merchant = await harness.prisma.merchant.findUniqueOrThrow({
      where: { userId: registration.body.user.id as string },
      include: { wallet: true },
    });
    expect(merchant.name).toBe('Antalya Test İşletmesi');
    expect(merchant.wallet.ownerType).toBe('MERCHANT');
    expect(merchant.wallet.balance.toFixed(2)).toBe('0.00');

    await harness
      .http()
      .post('/api/auth/login')
      .send({ accountType: 'PERSONAL', email, password: 'MerchantPassword!123' })
      .expect(403)
      .expect(({ body }) => {
        expect(body.code).toBe('AUTH_ACCOUNT_TYPE_MISMATCH');
      });
  });

  it('completes and replays a mock card top-up without storing sensitive card data', async () => {
    const user = await harness.registerUser();
    const key = randomUUID();
    const payload = {
      cardholderName: 'Ege XXX',
      cardNumber: '1111 1111 1111 1111',
      expiry: '01/11',
      cvv: '111',
      amount: 25.25,
    };

    const first = await harness
      .http()
      .post('/api/wallet/top-up/mock')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .set('Idempotency-Key', key)
      .send(payload)
      .expect(201);
    const replay = await harness
      .http()
      .post('/api/wallet/top-up/mock')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .set('Idempotency-Key', key)
      .send(payload)
      .expect(201);

    expect(replay.body).toEqual(first.body);
    expect(first.body).toMatchObject({
      amount: 25.25,
      balance: 25.25,
      maskedCard: '•••• 1111',
      provider: 'MOCK',
      status: 'COMPLETED',
    });
    expect(
      (
        await harness.prisma.wallet.findUniqueOrThrow({ where: { userId: user.user.id } })
      ).balance.toFixed(2),
    ).toBe('25.25');
    const persisted = await harness.prisma.walletTopUp.findMany({
      where: { userId: user.user.id },
    });
    expect(persisted).toHaveLength(1);
    expect(persisted[0]).toMatchObject({
      cardLast4: '1111',
      cardholderName: 'Ege XXX',
    });
    expect(JSON.stringify(persisted[0])).not.toContain(payload.cardNumber);
    expect(persisted[0]).not.toHaveProperty('cardNumber');
    expect(persisted[0]).not.toHaveProperty('cvv');

    await harness
      .http()
      .post('/api/wallet/top-up/mock')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .set('Idempotency-Key', randomUUID())
      .send({ ...payload, amount: -1 })
      .expect(400);
    await harness
      .http()
      .post('/api/wallet/top-up/mock')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .set('Idempotency-Key', randomUUID())
      .send({ ...payload, amount: 'on lira' })
      .expect(400);
  });

  it('prevents one physical NFC tag from being claimed by another user', async () => {
    const first = await harness.registerUser();
    const second = await harness.registerUser();

    await harness
      .http()
      .post('/api/wallet/card')
      .set('Authorization', `Bearer ${second.accessToken}`)
      .send({ tagUid: first.nfcTagUid, label: 'Stolen card attempt' })
      .expect(409)
      .expect(({ body }) => {
        expect(body.code).toBe('NFC_CARD_ALREADY_BOUND');
      });
    expect(
      await harness.prisma.nfcCard.count({
        where: { userId: first.user.id, tagUidHash: { not: '' } },
      }),
    ).toBe(1);
  });

  it('prevents updates and deletes of committed ledger transactions', async () => {
    const admin = await harness.createAdmin();
    const user = await harness.registerUser();
    const merchant = await harness.provisionMerchant(admin.accessToken);
    await harness.deposit(admin.accessToken, user.user.id, 50).expect(201);
    const session = await harness.createSession(merchant.accessToken, 50);
    const payment = await harness
      .http()
      .post('/api/payments/qr')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .set('Idempotency-Key', randomUUID())
      .send({ paymentSessionId: session.id })
      .expect(201);
    const transactionId = payment.body.transactionId as string;

    await expect(
      harness.prisma.$executeRaw`
        UPDATE "wallet_app"."transactions"
        SET "amount" = 1
        WHERE "id" = ${transactionId}::uuid
      `,
    ).rejects.toThrow(/transactions are immutable/i);
    await expect(
      harness.prisma.$executeRaw`
        DELETE FROM "wallet_app"."transactions"
        WHERE "id" = ${transactionId}::uuid
      `,
    ).rejects.toThrow(/transactions are immutable/i);
  });
});
