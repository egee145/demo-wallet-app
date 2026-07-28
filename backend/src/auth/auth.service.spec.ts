import { createHash } from 'node:crypto';
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import { jest } from '@jest/globals';
import { Role } from '../generated/prisma/client.js';
import type { PrismaService } from '../database/prisma.service.js';
import { DomainException } from '../common/errors/domain.exception.js';
import { AuthService } from './auth.service.js';

const activeUser = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Test User',
  email: 'user@example.com',
  phone: null,
  passwordHash: 'unused',
  role: Role.USER,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const familyId = '22222222-2222-4222-8222-222222222222';
const refreshToken = 'refresh-token';
const tokenHash = createHash('sha256').update(refreshToken).digest('hex');

function createService(options: {
  existing?: Record<string, unknown> | null;
  transactionUpdateCount?: number;
}) {
  const familyUpdateMany = jest
    .fn<() => Promise<{ count: number }>>()
    .mockResolvedValue({ count: 1 });
  const transactionUpdateMany = jest
    .fn<() => Promise<{ count: number }>>()
    .mockResolvedValue({ count: options.transactionUpdateCount ?? 1 });
  const transactionCreate = jest.fn<() => Promise<Record<string, never>>>().mockResolvedValue({});
  const transactionUpdate = jest.fn<() => Promise<Record<string, never>>>().mockResolvedValue({});
  const prisma = {
    refreshSession: {
      findUnique: jest
        .fn<() => Promise<Record<string, unknown> | null | undefined>>()
        .mockResolvedValue(options.existing),
      updateMany: familyUpdateMany,
      create: jest.fn(),
    },
    $transaction: jest.fn((callback: (tx: unknown) => unknown) =>
      callback({
        refreshSession: {
          updateMany: transactionUpdateMany,
          create: transactionCreate,
          update: transactionUpdate,
        },
      }),
    ),
  } as unknown as PrismaService;
  const jwt = {
    signAsync: jest.fn<() => Promise<string>>().mockResolvedValue('access-token'),
  } as unknown as JwtService;
  const config = {
    get: jest.fn((_key: string, fallback: unknown) => fallback),
  } as unknown as ConfigService;

  return {
    service: new AuthService(prisma, jwt, config),
    familyUpdateMany,
    transactionUpdateMany,
    transactionCreate,
    transactionUpdate,
  };
}

describe('AuthService refresh rotation', () => {
  it('rejects an unknown refresh token', async () => {
    const { service } = createService({ existing: null });

    await expect(service.refresh(refreshToken)).rejects.toMatchObject<Partial<DomainException>>({
      code: 'AUTH_INVALID_REFRESH_TOKEN',
    });
  });

  it('revokes the token family when a revoked token is reused', async () => {
    const { service, familyUpdateMany } = createService({
      existing: {
        id: '33333333-3333-4333-8333-333333333333',
        userId: activeUser.id,
        familyId,
        tokenHash,
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: new Date(),
        replacedById: null,
        createdAt: new Date(),
        user: activeUser,
      },
    });

    await expect(service.refresh(refreshToken)).rejects.toMatchObject<Partial<DomainException>>({
      code: 'AUTH_REFRESH_TOKEN_REUSED',
    });
    expect(familyUpdateMany).toHaveBeenCalledWith({
      where: { familyId, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('revokes the whole family when concurrent rotation loses the conditional update', async () => {
    const { service, familyUpdateMany, transactionCreate } = createService({
      transactionUpdateCount: 0,
      existing: {
        id: '33333333-3333-4333-8333-333333333333',
        userId: activeUser.id,
        familyId,
        tokenHash,
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: null,
        replacedById: null,
        createdAt: new Date(),
        user: activeUser,
      },
    });

    await expect(service.refresh(refreshToken)).rejects.toMatchObject<Partial<DomainException>>({
      code: 'AUTH_REFRESH_TOKEN_REUSED',
    });
    expect(transactionCreate).not.toHaveBeenCalled();
    expect(familyUpdateMany).toHaveBeenCalledWith({
      where: { familyId, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('rotates a valid refresh token and returns a new token pair', async () => {
    const { service, transactionCreate, transactionUpdate, familyUpdateMany } = createService({
      existing: {
        id: '33333333-3333-4333-8333-333333333333',
        userId: activeUser.id,
        familyId,
        tokenHash,
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: null,
        replacedById: null,
        createdAt: new Date(),
        user: activeUser,
      },
    });

    const result = await service.refresh(refreshToken);

    expect(result.accessToken).toBe('access-token');
    expect(result.refreshToken).not.toBe(refreshToken);
    expect(result.user).toMatchObject({ id: activeUser.id, role: Role.USER });
    expect(transactionCreate).toHaveBeenCalledTimes(1);
    expect(transactionUpdate).toHaveBeenCalledTimes(1);
    expect(familyUpdateMany).not.toHaveBeenCalled();
  });
});
