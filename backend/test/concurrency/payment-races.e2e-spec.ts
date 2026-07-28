import { randomUUID } from 'node:crypto';
import { PaymentSessionStatus, TransactionStatus } from '../../src/generated/prisma/client.js';
import { E2eHarness } from '../support/e2e-harness.js';

const describeDatabase = process.env.TEST_DATABASE_URL ? describe : describe.skip;

describeDatabase('payment concurrency', () => {
  const harness = new E2eHarness();

  beforeAll(async () => harness.start());
  afterAll(async () => harness.stop());
  beforeEach(async () => harness.reset());

  it('allows one SUCCESS for ten different keys racing on one session', async () => {
    const admin = await harness.createAdmin();
    const user = await harness.registerUser();
    const merchant = await harness.provisionMerchant(admin.accessToken);
    await harness.deposit(admin.accessToken, user.user.id, 500).expect(201);
    const session = await harness.createSession(merchant.accessToken, 50);

    const responses = await Promise.all(
      Array.from({ length: 10 }, () =>
        harness
          .http()
          .post('/api/payments/nfc')
          .set('Authorization', `Bearer ${merchant.accessToken}`)
          .set('Idempotency-Key', randomUUID())
          .send({
            paymentSessionId: session.id,
            userId: user.user.id,
            tagUid: user.nfcTagUid,
          }),
      ),
    );

    expect(responses.filter(({ status }) => status === 201)).toHaveLength(1);
    expect(responses.filter(({ status }) => status === 409)).toHaveLength(9);
    await expectInvariants(harness, session.id, user.user.id, merchant.walletId, '450.00', '50.00');
  });

  it('replays one transaction for ten same-key requests', async () => {
    const admin = await harness.createAdmin();
    const user = await harness.registerUser();
    const merchant = await harness.provisionMerchant(admin.accessToken);
    await harness.deposit(admin.accessToken, user.user.id, 500).expect(201);
    const session = await harness.createSession(merchant.accessToken, 50);
    const key = randomUUID();

    const responses = await Promise.all(
      Array.from({ length: 10 }, () =>
        harness
          .http()
          .post('/api/payments/nfc')
          .set('Authorization', `Bearer ${merchant.accessToken}`)
          .set('Idempotency-Key', key)
          .send({
            paymentSessionId: session.id,
            userId: user.user.id,
            tagUid: user.nfcTagUid,
          }),
      ),
    );

    expect(responses.every(({ status }) => status === 201)).toBe(true);
    expect(
      new Set(responses.map(({ body }) => (body as { transactionId: string }).transactionId)).size,
    ).toBe(1);
    await expectInvariants(harness, session.id, user.user.id, merchant.walletId, '450.00', '50.00');
  });

  it('never makes a wallet negative when two sessions compete for one payment', async () => {
    const admin = await harness.createAdmin();
    const user = await harness.registerUser();
    const merchant = await harness.provisionMerchant(admin.accessToken);
    await harness.deposit(admin.accessToken, user.user.id, 50).expect(201);
    const first = await harness.createSession(merchant.accessToken, 50);
    const second = await harness.createSession(merchant.accessToken, 50);

    const responses = await Promise.all(
      [first, second].map((session) =>
        harness
          .http()
          .post('/api/payments/qr')
          .set('Authorization', `Bearer ${user.accessToken}`)
          .set('Idempotency-Key', randomUUID())
          .send({ paymentSessionId: session.id }),
      ),
    );

    expect(responses.filter(({ status }) => status === 201)).toHaveLength(1);
    expect(responses.filter(({ status }) => status === 422)).toHaveLength(1);
    const payer = await harness.prisma.wallet.findUniqueOrThrow({
      where: { userId: user.user.id },
    });
    expect(payer.balance.toFixed(2)).toBe('0.00');
    expect(payer.balance.greaterThanOrEqualTo(0)).toBe(true);
    expect(
      await harness.prisma.transaction.count({ where: { status: TransactionStatus.SUCCESS } }),
    ).toBe(1);
  });

  it('allows only one winner when NFC and QR race on the same session', async () => {
    const admin = await harness.createAdmin();
    const user = await harness.registerUser();
    const merchant = await harness.provisionMerchant(admin.accessToken);
    await harness.deposit(admin.accessToken, user.user.id, 100).expect(201);
    const session = await harness.createSession(merchant.accessToken, 50);

    const [nfc, qr] = await Promise.all([
      harness
        .http()
        .post('/api/payments/nfc')
        .set('Authorization', `Bearer ${merchant.accessToken}`)
        .set('Idempotency-Key', randomUUID())
        .send({
          paymentSessionId: session.id,
          userId: user.user.id,
          tagUid: user.nfcTagUid,
        }),
      harness
        .http()
        .post('/api/payments/qr')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .set('Idempotency-Key', randomUUID())
        .send({ paymentSessionId: session.id }),
    ]);

    expect([nfc.status, qr.status].sort()).toEqual([201, 409]);
    await expectInvariants(harness, session.id, user.user.id, merchant.walletId, '50.00', '50.00');
  });

  it('rejects a same-scope key racing with a different payer payload', async () => {
    const admin = await harness.createAdmin();
    const firstUser = await harness.registerUser();
    const secondUser = await harness.registerUser();
    const merchant = await harness.provisionMerchant(admin.accessToken);
    await harness.deposit(admin.accessToken, firstUser.user.id, 100).expect(201);
    await harness.deposit(admin.accessToken, secondUser.user.id, 100).expect(201);
    const session = await harness.createSession(merchant.accessToken, 50);
    const key = randomUUID();

    const responses = await Promise.all(
      [firstUser, secondUser].map((payer) =>
        harness
          .http()
          .post('/api/payments/nfc')
          .set('Authorization', `Bearer ${merchant.accessToken}`)
          .set('Idempotency-Key', key)
          .send({
            paymentSessionId: session.id,
            userId: payer.user.id,
            tagUid: payer.nfcTagUid,
          }),
      ),
    );

    expect(responses.filter(({ status }) => status === 201)).toHaveLength(1);
    expect(responses.filter(({ status }) => status === 409)).toHaveLength(1);
    expect(responses.find(({ status }) => status === 409)?.body.code as string).toBe(
      'IDEMPOTENCY_KEY_REUSED',
    );
    expect(
      await harness.prisma.transaction.count({
        where: { paymentSessionId: session.id, status: TransactionStatus.SUCCESS },
      }),
    ).toBe(1);
  });

  it('serializes two affordable sessions from the same wallet without losing money', async () => {
    const admin = await harness.createAdmin();
    const user = await harness.registerUser();
    const merchant = await harness.provisionMerchant(admin.accessToken);
    await harness.deposit(admin.accessToken, user.user.id, 100).expect(201);
    const first = await harness.createSession(merchant.accessToken, 50);
    const second = await harness.createSession(merchant.accessToken, 50);

    const responses = await Promise.all(
      [first, second].map((session) =>
        harness
          .http()
          .post('/api/payments/qr')
          .set('Authorization', `Bearer ${user.accessToken}`)
          .set('Idempotency-Key', randomUUID())
          .send({ paymentSessionId: session.id }),
      ),
    );

    expect(responses.every(({ status }) => status === 201)).toBe(true);
    expect(
      (
        await harness.prisma.wallet.findUniqueOrThrow({ where: { userId: user.user.id } })
      ).balance.toFixed(2),
    ).toBe('0.00');
    expect(
      (
        await harness.prisma.wallet.findUniqueOrThrow({ where: { id: merchant.walletId } })
      ).balance.toFixed(2),
    ).toBe('100.00');
    expect(
      await harness.prisma.transaction.count({ where: { status: TransactionStatus.SUCCESS } }),
    ).toBe(2);
  });
});

async function expectInvariants(
  harness: E2eHarness,
  sessionId: string,
  payerUserId: string,
  merchantWalletId: string,
  payerBalance: string,
  merchantBalance: string,
) {
  const session = await harness.prisma.paymentSession.findUniqueOrThrow({
    where: { id: sessionId },
  });
  const payer = await harness.prisma.wallet.findUniqueOrThrow({
    where: { userId: payerUserId },
  });
  const merchant = await harness.prisma.wallet.findUniqueOrThrow({
    where: { id: merchantWalletId },
  });
  expect(session.status).toBe(PaymentSessionStatus.PAID);
  expect(payer.balance.toFixed(2)).toBe(payerBalance);
  expect(merchant.balance.toFixed(2)).toBe(merchantBalance);
  expect(payer.balance.greaterThanOrEqualTo(0)).toBe(true);
  expect(
    await harness.prisma.transaction.count({
      where: { paymentSessionId: sessionId, status: TransactionStatus.SUCCESS },
    }),
  ).toBe(1);
}
