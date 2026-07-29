import { HttpStatus, Injectable } from '@nestjs/common';
import {
  Prisma,
  IdempotencyActorType,
  NfcCardStatus,
  WalletTopUpProvider,
  WalletTopUpStatus,
} from '../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';
import { DomainException } from '../common/errors/domain.exception.js';
import { canonicalMoney, parseMoney, serializeMoney } from '../common/money/money.js';
import { canonicalHash } from '../common/utils/canonical-hash.js';
import { hashTagUid } from '../common/utils/nfc-card.js';
import { IdempotencyService } from '../payment/idempotency/idempotency.service.js';
import { TransactionService } from '../transaction/transaction.service.js';
import { NotificationService } from '../notification/notification.service.js';
import type { BindCardDto } from './dto/bind-card.dto.js';
import type { DepositDto } from './dto/deposit.dto.js';
import type { InspectCardDto } from './dto/inspect-card.dto.js';
import type { MockTopUpDto } from './dto/mock-top-up.dto.js';

@Injectable()
export class WalletService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly idempotency: IdempotencyService,
    private readonly transactions: TransactionService,
    private readonly notifications: NotificationService,
  ) {}

  async me(userId: string) {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      throw new DomainException('WALLET_NOT_FOUND', 'Cüzdan bulunamadı.', 404);
    }
    return {
      id: wallet.id,
      balance: serializeMoney(wallet.balance),
      currency: wallet.currency,
    };
  }

  async history(userId: string, cursor?: string, limit?: number) {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      throw new DomainException('WALLET_NOT_FOUND', 'Cüzdan bulunamadı.', 404);
    }
    return this.transactions.historyForWallet(wallet.id, cursor, limit);
  }

  async card(userId: string) {
    const card = await this.prisma.nfcCard.findUnique({ where: { userId } });
    return {
      bound: Boolean(card?.status === NfcCardStatus.ACTIVE),
      card: card
        ? {
            id: card.id,
            label: card.label,
            status: card.status,
            boundAt: card.boundAt.toISOString(),
          }
        : null,
    };
  }

  async inspectCard(userId: string, dto: InspectCardDto) {
    const card = await this.prisma.nfcCard.findUnique({
      where: { tagUidHash: hashTagUid(dto.tagUid) },
      select: { userId: true },
    });
    return {
      state: !card
        ? ('UNCLAIMED' as const)
        : card.userId === userId
          ? ('OWNED_BY_CURRENT_USER' as const)
          : ('OWNED_BY_ANOTHER_USER' as const),
      transferRequired: Boolean(card && card.userId !== userId),
    };
  }

  async bindCard(userId: string, dto: BindCardDto) {
    const tagUidHash = hashTagUid(dto.tagUid);
    const label = dto.label.trim();
    try {
      const result = await this.prisma.$transaction(
        async (tx) => {
          const claimedRows = await tx.$queryRaw<Array<{ id: string; userId: string }>>(Prisma.sql`
            SELECT "id", "user_id" AS "userId"
            FROM "wallet_app"."nfc_cards"
            WHERE "tag_uid_hash" = ${tagUidHash}
            FOR UPDATE
          `);
          const claimed = claimedRows[0];
          if (claimed && claimed.userId !== userId) {
            if (!dto.transferConfirmed) {
              throw new DomainException(
                'NFC_CARD_TRANSFER_CONFIRMATION_REQUIRED',
                'Bu NFC kart başka bir kullanıcıya tanımlı. Devir için açık onay gereklidir.',
                HttpStatus.CONFLICT,
              );
            }

            const notification = await this.notifications.createCardTransfer(tx, claimed.userId);
            await tx.nfcCard.deleteMany({ where: { userId } });
            const card = await tx.nfcCard.update({
              where: { id: claimed.id },
              data: {
                userId,
                label,
                status: NfcCardStatus.ACTIVE,
                boundAt: new Date(),
              },
            });
            return { card, notificationId: notification.id };
          }
          const card = await tx.nfcCard.upsert({
            where: { userId },
            create: {
              userId,
              tagUidHash,
              label,
              status: NfcCardStatus.ACTIVE,
            },
            update: {
              tagUidHash,
              label,
              status: NfcCardStatus.ACTIVE,
              boundAt: new Date(),
            },
          });
          return { card, notificationId: undefined };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      if (result.notificationId) {
        void this.notifications.deliver(result.notificationId);
      }
      return {
        bound: true,
        card: {
          id: result.card.id,
          label: result.card.label,
          status: result.card.status,
          boundAt: result.card.boundAt.toISOString(),
        },
      };
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new DomainException(
          'NFC_CARD_BINDING_CONFLICT',
          'NFC kart sahipliği eşzamanlı olarak değişti. Kartı yeniden okutun.',
          HttpStatus.CONFLICT,
        );
      }
      throw error;
    }
  }

  async mockTopUp(userId: string, key: string, dto: MockTopUpDto) {
    const amount = parseMoney(dto.amount);
    const cardNumber = dto.cardNumber.replace(/[ -]/g, '');
    const cardLast4 = cardNumber.slice(-4);
    const cardholderName = dto.cardholderName.trim().replace(/\s+/g, ' ');
    const hash = canonicalHash({
      endpoint: '/api/wallet/top-up/mock',
      actorId: userId,
      amount: canonicalMoney(amount),
      cardholderName: cardholderName.toLocaleUpperCase('tr-TR'),
      cardNumber,
      expiry: dto.expiry,
      cvv: dto.cvv,
    });

    return this.prisma.$transaction(
      async (tx) => {
        const prepared = await this.idempotency.prepare(tx, {
          actorId: userId,
          actorType: IdempotencyActorType.USER,
          endpoint: '/api/wallet/top-up/mock',
          key,
          requestHash: hash,
        });
        if (prepared.replay) {
          return prepared.replay.body;
        }

        const wallets = await tx.$queryRaw<Array<{ id: string; balance: Prisma.Decimal }>>(
          Prisma.sql`
            SELECT "id", "balance"
            FROM "wallet_app"."wallets"
            WHERE "user_id" = ${userId}::uuid
              AND "owner_type" = 'USER'
            FOR UPDATE
          `,
        );
        const wallet = wallets[0];
        if (!wallet) {
          throw new DomainException('WALLET_NOT_FOUND', 'Cüzdan bulunamadı.', 404);
        }

        const updated = await tx.$queryRaw<Array<{ balance: Prisma.Decimal }>>(Prisma.sql`
          UPDATE "wallet_app"."wallets"
          SET "balance" = "balance" + ${amount.toFixed(2)}::numeric,
              "updated_at" = CURRENT_TIMESTAMP
          WHERE "id" = ${wallet.id}::uuid
            AND "balance" + ${amount.toFixed(2)}::numeric <= 999999999999.99
          RETURNING "balance"
        `);
        if (!updated[0]) {
          throw new DomainException(
            'WALLET_BALANCE_LIMIT',
            'Cüzdan üst bakiye sınırı aşılır.',
            HttpStatus.UNPROCESSABLE_ENTITY,
          );
        }

        const topUp = await tx.walletTopUp.create({
          data: {
            userId,
            walletId: wallet.id,
            amount,
            provider: WalletTopUpProvider.MOCK,
            status: WalletTopUpStatus.COMPLETED,
            cardLast4,
            cardholderName,
            idempotencyKey: key,
          },
        });
        const body = {
          topUpId: topUp.id,
          amount: serializeMoney(amount),
          balance: serializeMoney(updated[0].balance),
          currency: 'TRY',
          maskedCard: `•••• ${cardLast4}`,
          provider: topUp.provider,
          status: topUp.status,
          createdAt: topUp.createdAt.toISOString(),
        };
        await this.idempotency.complete(tx, prepared.recordId, 201, body);
        return body;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5000,
        timeout: 10000,
      },
    );
  }

  async topUps(userId: string) {
    const rows = await this.prisma.walletTopUp.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 20,
    });
    return {
      items: rows.map((row) => ({
        id: row.id,
        amount: serializeMoney(row.amount),
        currency: row.currency,
        maskedCard: `•••• ${row.cardLast4}`,
        provider: row.provider,
        status: row.status,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }

  async deposit(adminUserId: string, key: string, dto: DepositDto) {
    const amount = parseMoney(dto.amount);
    const hash = canonicalHash({
      endpoint: '/api/wallet/deposit',
      actorId: adminUserId,
      userId: dto.userId,
      amount: canonicalMoney(amount),
      reason: dto.reason.trim(),
    });

    return this.prisma.$transaction(
      async (tx) => {
        const prepared = await this.idempotency.prepare(tx, {
          actorId: adminUserId,
          actorType: IdempotencyActorType.ADMIN,
          endpoint: '/api/wallet/deposit',
          key,
          requestHash: hash,
        });
        if (prepared.replay) {
          return prepared.replay.body;
        }

        const wallets = await tx.$queryRaw<Array<{ id: string; balance: Prisma.Decimal }>>(
          Prisma.sql`
            SELECT "id", "balance"
            FROM "wallet_app"."wallets"
            WHERE "user_id" = ${dto.userId}::uuid
            FOR UPDATE
          `,
        );
        const wallet = wallets[0];
        if (!wallet) {
          throw new DomainException('WALLET_NOT_FOUND', 'Cüzdan bulunamadı.', 404);
        }

        const updated = await tx.$queryRaw<Array<{ balance: Prisma.Decimal }>>(Prisma.sql`
          UPDATE "wallet_app"."wallets"
          SET "balance" = "balance" + ${amount.toFixed(2)}::numeric,
              "updated_at" = CURRENT_TIMESTAMP
          WHERE "id" = ${wallet.id}::uuid
            AND "balance" + ${amount.toFixed(2)}::numeric <= 999999999999.99
          RETURNING "balance"
        `);
        if (!updated[0]) {
          throw new DomainException(
            'WALLET_BALANCE_LIMIT',
            'Cüzdan üst bakiye sınırı aşılır.',
            HttpStatus.UNPROCESSABLE_ENTITY,
          );
        }

        const adjustment = await tx.walletAdjustment.create({
          data: {
            walletId: wallet.id,
            amount,
            reason: dto.reason.trim(),
            adminUserId,
            idempotencyKey: key,
          },
        });
        const body = {
          adjustmentId: adjustment.id,
          walletId: wallet.id,
          balance: serializeMoney(updated[0].balance),
          currency: 'TRY',
        };
        await this.idempotency.complete(tx, prepared.recordId, 201, body);
        return body;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}
