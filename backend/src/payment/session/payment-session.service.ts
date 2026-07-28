import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IdempotencyActorType,
  PaymentSessionStatus,
  Prisma,
  Role,
} from '../../generated/prisma/client.js';
import { PrismaService } from '../../database/prisma.service.js';
import { DomainException } from '../../common/errors/domain.exception.js';
import { canonicalMoney, parseMoney, serializeMoney } from '../../common/money/money.js';
import { canonicalHash } from '../../common/utils/canonical-hash.js';
import type { JwtUser } from '../../auth/types/jwt-user.js';
import { PaymentGateway } from '../gateway/payment.gateway.js';
import { IdempotencyService } from '../idempotency/idempotency.service.js';

type CancelOutcome = { id: string; status: PaymentSessionStatus } | { error: DomainException };

@Injectable()
export class PaymentSessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly idempotency: IdempotencyService,
    private readonly gateway: PaymentGateway,
  ) {}

  async create(merchantUserId: string, key: string, amountValue: number) {
    const amount = parseMoney(
      amountValue,
      new Prisma.Decimal(this.config.get<string>('PAYMENT_MAX_AMOUNT', '999999.99')),
    );
    const requestHash = canonicalHash({
      endpoint: '/api/payments/session',
      actorId: merchantUserId,
      amount: canonicalMoney(amount),
      currency: 'TRY',
    });

    const result = await this.prisma.$transaction(
      async (tx) => {
        const prepared = await this.idempotency.prepare(tx, {
          actorId: merchantUserId,
          actorType: IdempotencyActorType.MERCHANT,
          endpoint: '/api/payments/session',
          key,
          requestHash,
        });
        if (prepared.replay) {
          return { body: prepared.replay.body, replayed: true };
        }

        const merchant = await tx.merchant.findUnique({ where: { userId: merchantUserId } });
        if (!merchant) {
          throw new DomainException('MERCHANT_NOT_FOUND', 'Merchant bulunamadı.', 404);
        }
        if (!merchant.isActive) {
          throw new DomainException(
            'MERCHANT_INACTIVE',
            'Merchant hesabı pasif.',
            HttpStatus.FORBIDDEN,
          );
        }

        const ttl = this.config.get<number>('SESSION_TTL_SECONDS', 120);
        const session = await tx.paymentSession.create({
          data: {
            merchantId: merchant.id,
            amount,
            expiresAt: new Date(Date.now() + ttl * 1000),
          },
        });
        const body = {
          id: session.id,
          merchantId: session.merchantId,
          amount: serializeMoney(session.amount),
          currency: session.currency,
          status: session.status,
          expiresAt: session.expiresAt.toISOString(),
          qrPayload: session.id,
        };
        await this.idempotency.complete(tx, prepared.recordId, 201, body);
        return { body, replayed: false };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    if (!result.replayed) {
      const sessionId = result.body.id;
      if (typeof sessionId === 'string') {
        this.gateway.emitStatus(sessionId, 'waiting');
      }
    }
    return result.body;
  }

  async detail(actor: JwtUser, sessionId: string) {
    let session = await this.prisma.paymentSession.findUnique({
      where: { id: sessionId },
      include: {
        merchant: { select: { id: true, userId: true, name: true } },
        transactions: {
          where: { status: 'SUCCESS' },
          select: { id: true },
          take: 1,
        },
      },
    });
    if (!session) {
      throw new DomainException('PAYMENT_SESSION_NOT_FOUND', 'Ödeme oturumu bulunamadı.', 404);
    }

    if (session.status === PaymentSessionStatus.WAITING && session.expiresAt <= new Date()) {
      const expired = await this.prisma.paymentSession.updateMany({
        where: {
          id: session.id,
          status: PaymentSessionStatus.WAITING,
          expiresAt: { lte: new Date() },
        },
        data: { status: PaymentSessionStatus.EXPIRED },
      });
      if (expired.count === 1) {
        this.gateway.emitStatus(session.id, 'expired');
      }
      session = { ...session, status: PaymentSessionStatus.EXPIRED };
    }

    if (actor.role === Role.MERCHANT && session.merchant.userId !== actor.id) {
      throw new DomainException(
        'PAYMENT_SESSION_FORBIDDEN',
        'Ödeme oturumu bu merchant hesabına ait değil.',
        HttpStatus.FORBIDDEN,
      );
    }

    return {
      id: session.id,
      merchant: { id: session.merchant.id, name: session.merchant.name },
      amount: serializeMoney(session.amount),
      currency: session.currency,
      status: session.status,
      expiresAt: session.expiresAt.toISOString(),
      transactionId: session.transactions[0]?.id ?? null,
    };
  }

  async cancel(merchantUserId: string, sessionId: string) {
    const outcome: CancelOutcome = await this.prisma.$transaction(
      async (tx) => {
        const rows = await tx.$queryRaw<
          Array<{
            id: string;
            status: PaymentSessionStatus;
            expires_at: Date;
            user_id: string;
          }>
        >(Prisma.sql`
          SELECT ps."id", ps."status", ps."expires_at", m."user_id"
          FROM "wallet_app"."payment_sessions" ps
          JOIN "wallet_app"."merchants" m ON m."id" = ps."merchant_id"
          WHERE ps."id" = ${sessionId}::uuid
          FOR UPDATE OF ps
        `);
        const session = rows[0];
        if (!session) {
          throw new DomainException('PAYMENT_SESSION_NOT_FOUND', 'Ödeme oturumu bulunamadı.', 404);
        }
        if (session.user_id !== merchantUserId) {
          throw new DomainException(
            'PAYMENT_SESSION_FORBIDDEN',
            'Ödeme oturumu bu merchant hesabına ait değil.',
            403,
          );
        }
        if (
          session.status === PaymentSessionStatus.EXPIRED ||
          (session.status === PaymentSessionStatus.WAITING && session.expires_at <= new Date())
        ) {
          await tx.paymentSession.updateMany({
            where: { id: sessionId, status: PaymentSessionStatus.WAITING },
            data: { status: PaymentSessionStatus.EXPIRED },
          });
          return {
            error: new DomainException(
              'PAYMENT_SESSION_EXPIRED',
              'Ödeme oturumunun süresi dolmuş.',
              HttpStatus.GONE,
            ),
          };
        }
        if (session.status === PaymentSessionStatus.PAID) {
          throw new DomainException(
            'PAYMENT_SESSION_ALREADY_PAID',
            'Ödeme oturumu daha önce ödenmiş.',
            HttpStatus.CONFLICT,
          );
        }
        if (session.status === PaymentSessionStatus.CANCELLED) {
          return { id: session.id, status: PaymentSessionStatus.CANCELLED };
        }
        await tx.paymentSession.update({
          where: { id: sessionId },
          data: { status: PaymentSessionStatus.CANCELLED },
        });
        return { id: session.id, status: PaymentSessionStatus.CANCELLED };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    if ('error' in outcome) {
      this.gateway.emitStatus(sessionId, 'expired');
      throw outcome.error;
    }
    this.gateway.emitStatus(sessionId, 'cancelled');
    return outcome;
  }
}
