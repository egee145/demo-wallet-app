import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getStorageToken, ThrottlerStorageService } from '@nestjs/throttler';
import { hash } from 'argon2';
import request from 'supertest';
import { PrismaService } from '../../src/database/prisma.service.js';
import { Role } from '../../src/generated/prisma/client.js';

type AuthResponse = {
  user: { id: string; role: Role };
  accessToken: string;
  refreshToken: string;
};

type UserFixture = AuthResponse & {
  nfcTagUid: string;
};

type MerchantFixture = {
  merchantId: string;
  userId: string;
  walletId: string;
  accessToken: string;
};

export class E2eHarness {
  app!: INestApplication;
  prisma!: PrismaService;
  throttlerStorage!: ThrottlerStorageService;

  async start(): Promise<void> {
    this.assertDedicatedTestDatabase();
    const { AppModule } = await import('../../src/app.module.js');
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    this.app = module.createNestApplication();
    this.app.setGlobalPrefix('api');
    this.app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: false },
      }),
    );
    await this.app.init();
    this.prisma = this.app.get(PrismaService);
    this.throttlerStorage = this.app.get<ThrottlerStorageService>(getStorageToken());
  }

  async stop(): Promise<void> {
    await this.app?.close();
  }

  async reset(): Promise<void> {
    this.throttlerStorage.onApplicationShutdown();
    this.throttlerStorage.storage.clear();
    await this.prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        "wallet_app"."wallet_top_ups",
        "wallet_app"."nfc_cards",
        "wallet_app"."wallet_adjustments",
        "wallet_app"."refresh_sessions",
        "wallet_app"."idempotency_records",
        "wallet_app"."payment_attempts",
        "wallet_app"."transactions",
        "wallet_app"."payment_sessions",
        "wallet_app"."merchants",
        "wallet_app"."wallets",
        "wallet_app"."users"
      RESTART IDENTITY CASCADE
    `);
  }

  http() {
    return request(this.app.getHttpServer());
  }

  async createAdmin(): Promise<AuthResponse> {
    const email = `admin-${randomUUID()}@example.test`;
    await this.prisma.user.create({
      data: {
        name: 'Test Admin',
        email,
        passwordHash: await hash('AdminPassword!123'),
        role: Role.ADMIN,
      },
    });
    const response = await this.http()
      .post('/api/auth/login')
      .send({ email, password: 'AdminPassword!123' })
      .expect(200);
    return response.body as AuthResponse;
  }

  async registerUser(): Promise<UserFixture> {
    const suffix = randomUUID();
    const phoneSuffix = this.uuidToDigits(suffix).slice(0, 9);
    const response = await this.http()
      .post('/api/auth/register')
      .send({
        name: 'Test User',
        email: `user-${suffix}@example.test`,
        phone: `+905${phoneSuffix}`,
        password: 'UserPassword!123',
      })
      .expect(201);
    const auth = response.body as AuthResponse;
    const nfcTagUid = suffix.replaceAll('-', '').slice(0, 14);
    await this.http()
      .post('/api/wallet/card')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ tagUid: nfcTagUid, label: 'Automated Test Card' })
      .expect(201);
    return { ...auth, nfcTagUid };
  }

  async provisionMerchant(adminToken: string): Promise<MerchantFixture> {
    const suffix = randomUUID();
    const phoneSuffix = this.uuidToDigits(suffix).slice(0, 9);
    const email = `merchant-${suffix}@example.test`;
    const response = await this.http()
      .post('/api/admin/merchants')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Merchant User',
        merchantName: 'Test Merchant',
        email,
        phone: `+906${phoneSuffix}`,
        password: 'MerchantPassword!123',
      })
      .expect(201);
    const login = await this.http()
      .post('/api/auth/login')
      .send({ email, password: 'MerchantPassword!123' })
      .expect(200);
    const body = response.body as {
      user: { id: string };
      merchant: { id: string; walletId: string };
    };
    return {
      merchantId: body.merchant.id,
      userId: body.user.id,
      walletId: body.merchant.walletId,
      accessToken: (login.body as AuthResponse).accessToken,
    };
  }

  deposit(adminToken: string, userId: string, amount: number, key = randomUUID()) {
    return this.http()
      .post('/api/wallet/deposit')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Idempotency-Key', key)
      .send({ userId, amount, reason: 'Automated test funding' });
  }

  async createSession(merchantToken: string, amount: number) {
    const response = await this.http()
      .post('/api/payments/session')
      .set('Authorization', `Bearer ${merchantToken}`)
      .set('Idempotency-Key', randomUUID())
      .send({ amount })
      .expect(201);
    return response.body as {
      id: string;
      amount: number;
      qrPayload: string;
      expiresAt: string;
    };
  }

  private assertDedicatedTestDatabase(): void {
    const raw = process.env.TEST_DATABASE_URL;
    if (!raw) {
      throw new Error('TEST_DATABASE_URL is required for database tests');
    }
    const database = new URL(raw).pathname.toLowerCase();
    if (!database.includes('test')) {
      throw new Error('Database tests require a database name containing "test"');
    }
    process.env.DATABASE_URL = raw;
    process.env.DIRECT_URL = raw;
  }

  private uuidToDigits(value: string): string {
    return value
      .replaceAll('-', '')
      .split('')
      .map((character) => (Number.parseInt(character, 16) % 10).toString())
      .join('');
  }
}
