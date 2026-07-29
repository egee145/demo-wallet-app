import { setTimeout as delay } from 'node:timers/promises';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import {
  AttemptStatus,
  IdempotencyActorType,
  PaymentMethod,
  PaymentSessionStatus,
  Prisma,
  TransactionStatus,
} from '../../generated/prisma/client.js';
import { PrismaService } from '../../database/prisma.service.js';
import { DomainException } from '../../common/errors/domain.exception.js';
import { canonicalHash } from '../../common/utils/canonical-hash.js';
import { serializeMoney } from '../../common/money/money.js';
import { hashTagUid } from '../../common/utils/nfc-card.js';
import {
  IdempotencyService,
  type PreparedIdempotency,
} from '../idempotency/idempotency.service.js';
import { PaymentGateway } from '../gateway/payment.gateway.js';
import { NotificationService } from '../../notification/notification.service.js';

type Command = {
  method: PaymentMethod;
  paymentSessionId: string;
  payerUserId: string;
  actorId: string;
  actorType: IdempotencyActorType;
  endpoint: string;
  idempotencyKey: string;
  nfcTagUidHash?: string;
};

type SessionRow = {
  id: string;
  merchant_id: string;
  merchant_user_id: string;
  merchant_wallet_id: string;
  merchant_active: boolean;
  amount: string | Prisma.Decimal;
  currency: string;
  status: PaymentSessionStatus;
  expires_at: Date;
};

type Outcome =
  | {
      kind: 'success';
      body: Record<string, unknown>;
      transactionId: string;
      replayed: boolean;
      notificationId?: string;
    }
  | {
      kind: 'failure';
      status: number;
      code: string;
      message: string;
      body: Record<string, unknown>;
    };

@Injectable()
export class PaymentExecutionService {
  private readonly logger = new Logger(PaymentExecutionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly idempotency: IdempotencyService,
    private readonly gateway: PaymentGateway,
    private readonly notifications: NotificationService,
  ) {}

  executeNfc(
    merchantUserId: string,
    sessionId: string,
    payerUserId: string,
    tagUid: string,
    key: string,
  ) {
    return this.execute({
      method: PaymentMethod.NFC,
      paymentSessionId: sessionId,
      payerUserId,
      actorId: merchantUserId,
      actorType: IdempotencyActorType.MERCHANT,
      endpoint: '/api/payments/nfc',
      idempotencyKey: key,
      nfcTagUidHash: hashTagUid(tagUid),
    });
  }

  executeQr(userId: string, sessionId: string, key: string) {
    return this.execute({
      method: PaymentMethod.QR,
      paymentSessionId: sessionId,
      payerUserId: userId,
      actorId: userId,
      actorType: IdempotencyActorType.USER,
      endpoint: '/api/payments/qr',
      idempotencyKey: key,
    });
  }

  private async execute(command: Command) {
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const outcome = await this.runTransaction(command);
        if (outcome.kind === 'failure') {
          if (outcome.code === 'PAYMENT_SESSION_EXPIRED') {
            this.gateway.emitStatus(command.paymentSessionId, 'expired');
          }
          throw new DomainException(outcome.code, outcome.message, outcome.status);
        }
        if (!outcome.replayed) {
          this.gateway.emitStatus(command.paymentSessionId, 'paid', outcome.transactionId);
        }
        if (outcome.notificationId) {
          void this.notifications.deliver(outcome.notificationId);
        }
        return outcome.body;
      } catch (error) {
        if (error instanceof DomainException || !this.isRetryable(error)) {
          throw error;
        }
        lastError = error;
        if (attempt < 2) {
          const wait = attempt === 0 ? 25 + Math.random() * 50 : 75 + Math.random() * 125;
          this.logger.warn(
            `Retrying payment transaction after retryable database conflict; attempt=${attempt + 1}`,
          );
          await delay(wait);
        }
      }
    }

    this.logger.error('Payment database retry exhausted', lastError);
    throw new DomainException(
      'DATABASE_RETRY_EXHAUSTED',
      'Ödeme işlemi geçici database çakışması nedeniyle tamamlanamadı.',
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }

  private runTransaction(command: Command): Promise<Outcome> {
    const requestHash = canonicalHash({
      endpoint: command.endpoint,
      actorId: command.actorId,
      method: command.method,
      paymentSessionId: command.paymentSessionId,
      payerUserId: command.payerUserId,
      nfcTagUidHash: command.nfcTagUidHash,
    });

    return this.prisma.$transaction(
      async (tx) => {
        const prepared = await this.idempotency.prepare(tx, {
          actorId: command.actorId,
          actorType: command.actorType,
          endpoint: command.endpoint,
          key: command.idempotencyKey,
          requestHash,
        });
        if (prepared.replay) {
          if (prepared.replay.status >= 400) {
            const replayCode = prepared.replay.body.code;
            const replayMessage = prepared.replay.body.message;
            return {
              kind: 'failure',
              status: prepared.replay.status,
              code: typeof replayCode === 'string' ? replayCode : 'PAYMENT_FAILED',
              message: typeof replayMessage === 'string' ? replayMessage : 'Ödeme başarısız.',
              body: prepared.replay.body,
            };
          }
          return {
            kind: 'success',
            body: prepared.replay.body,
            transactionId: String(
              prepared.replay.transactionId ?? prepared.replay.body.transactionId,
            ),
            replayed: true,
          };
        }

        const sessionRows = await tx.$queryRaw<SessionRow[]>(Prisma.sql`
          SELECT ps."id", ps."merchant_id", ps."amount", ps."currency",
                 ps."status", ps."expires_at",
                 m."user_id" AS "merchant_user_id",
                 m."wallet_id" AS "merchant_wallet_id",
                 m."is_active" AS "merchant_active"
          FROM "wallet_app"."payment_sessions" ps
          JOIN "wallet_app"."merchants" m ON m."id" = ps."merchant_id"
          WHERE ps."id" = ${command.paymentSessionId}::uuid
          FOR UPDATE OF ps
        `);
        const session = sessionRows[0];
        if (!session) {
          return this.failure(
            tx,
            prepared,
            command,
            404,
            'PAYMENT_SESSION_NOT_FOUND',
            'Ödeme oturumu bulunamadı.',
          );
        }
        if (!session.merchant_active) {
          return this.failure(
            tx,
            prepared,
            command,
            403,
            'MERCHANT_INACTIVE',
            'Merchant hesabı pasif.',
            session.id,
          );
        }
        if (command.method === PaymentMethod.NFC && session.merchant_user_id !== command.actorId) {
          return this.failure(
            tx,
            prepared,
            command,
            403,
            'PAYMENT_SESSION_FORBIDDEN',
            'Ödeme oturumu bu merchant hesabına ait değil.',
            session.id,
          );
        }
        if (
          session.status === PaymentSessionStatus.EXPIRED ||
          (session.status === PaymentSessionStatus.WAITING && session.expires_at <= new Date())
        ) {
          await tx.paymentSession.updateMany({
            where: { id: session.id, status: PaymentSessionStatus.WAITING },
            data: { status: PaymentSessionStatus.EXPIRED },
          });
          return this.failure(
            tx,
            prepared,
            command,
            410,
            'PAYMENT_SESSION_EXPIRED',
            'Ödeme oturumunun süresi dolmuş.',
            session.id,
          );
        }
        if (session.status === PaymentSessionStatus.PAID) {
          return this.failure(
            tx,
            prepared,
            command,
            409,
            'PAYMENT_SESSION_ALREADY_PAID',
            'Ödeme oturumu daha önce kullanılmış.',
            session.id,
          );
        }
        if (session.status === PaymentSessionStatus.CANCELLED) {
          return this.failure(
            tx,
            prepared,
            command,
            409,
            'PAYMENT_SESSION_CANCELLED',
            'Ödeme oturumu iptal edilmiş.',
            session.id,
          );
        }

        const payer = await tx.user.findUnique({
          where: { id: command.payerUserId },
          include: { wallet: true },
        });
        if (!payer) {
          return this.failure(
            tx,
            prepared,
            command,
            404,
            'USER_NOT_FOUND',
            'Kullanıcı bulunamadı.',
            session.id,
          );
        }
        if (!payer.isActive) {
          return this.failure(
            tx,
            prepared,
            command,
            403,
            'USER_INACTIVE',
            'Kullanıcı hesabı pasif.',
            session.id,
            payer.id,
          );
        }
        if (!payer.wallet) {
          return this.failure(
            tx,
            prepared,
            command,
            404,
            'WALLET_NOT_FOUND',
            'Kullanıcı cüzdanı bulunamadı.',
            session.id,
            payer.id,
          );
        }

        if (command.method === PaymentMethod.NFC) {
          const nfcTagUidHash = command.nfcTagUidHash;
          if (!nfcTagUidHash) {
            throw new Error('NFC payment command is missing the registered tag UID hash');
          }
          const registeredCards = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
            SELECT "id"
            FROM "wallet_app"."nfc_cards"
            WHERE "user_id" = ${payer.id}::uuid
              AND "tag_uid_hash" = ${nfcTagUidHash}
              AND "status" = 'ACTIVE'
            FOR SHARE
          `);
          if (!registeredCards[0]) {
            return this.failure(
              tx,
              prepared,
              command,
              422,
              'NFC_CARD_NOT_REGISTERED',
              'NFC kart bu kullanıcı hesabına tanımlı değil.',
              session.id,
              payer.id,
            );
          }
        }

        const walletIds = [payer.wallet.id, session.merchant_wallet_id].sort();
        const walletSql = walletIds.map((id) => Prisma.sql`${id}::uuid`);
        const wallets = await tx.$queryRaw<
          Array<{ id: string; balance: string | Prisma.Decimal; currency: string }>
        >(Prisma.sql`
          SELECT "id", "balance", "currency"
          FROM "wallet_app"."wallets"
          WHERE "id" IN (${Prisma.join(walletSql)})
          ORDER BY "id"
          FOR UPDATE
        `);
        if (
          session.currency !== 'TRY' ||
          wallets.length !== 2 ||
          wallets.some((wallet) => wallet.currency !== 'TRY')
        ) {
          return this.failure(
            tx,
            prepared,
            command,
            409,
            'CURRENCY_MISMATCH',
            'Cüzdan para birimi ödeme ile uyumlu değil.',
            session.id,
            payer.id,
          );
        }

        const amount = new Prisma.Decimal(String(session.amount));
        const merchantWallet = wallets.find((wallet) => wallet.id === session.merchant_wallet_id);
        if (
          !merchantWallet ||
          new Prisma.Decimal(String(merchantWallet.balance))
            .plus(amount)
            .greaterThan('999999999999.99')
        ) {
          return this.failure(
            tx,
            prepared,
            command,
            422,
            'WALLET_BALANCE_LIMIT',
            'Merchant cüzdan üst bakiye sınırı aşılır.',
            session.id,
            payer.id,
          );
        }

        const debit = await tx.$queryRaw<Array<{ balance: string | Prisma.Decimal }>>(Prisma.sql`
          UPDATE "wallet_app"."wallets"
          SET "balance" = "balance" - ${amount.toFixed(2)}::numeric,
              "updated_at" = CURRENT_TIMESTAMP
          WHERE "id" = ${payer.wallet.id}::uuid
            AND "balance" >= ${amount.toFixed(2)}::numeric
          RETURNING "balance"
        `);
        if (!debit[0]) {
          return this.failure(
            tx,
            prepared,
            command,
            422,
            'INSUFFICIENT_BALANCE',
            'Cüzdan bakiyesi yetersiz.',
            session.id,
            payer.id,
          );
        }

        const credited = await tx.$executeRaw(Prisma.sql`
          UPDATE "wallet_app"."wallets"
          SET "balance" = "balance" + ${amount.toFixed(2)}::numeric,
              "updated_at" = CURRENT_TIMESTAMP
          WHERE "id" = ${session.merchant_wallet_id}::uuid
            AND "balance" + ${amount.toFixed(2)}::numeric <= 999999999999.99
        `);
        if (credited !== 1) {
          throw new Error('Merchant wallet credit failed during locked transaction');
        }

        const transaction = await tx.transaction.create({
          data: {
            paymentSessionId: session.id,
            fromWalletId: payer.wallet.id,
            toWalletId: session.merchant_wallet_id,
            amount,
            paymentMethod: command.method,
            status: TransactionStatus.SUCCESS,
          },
        });
        const sessionUpdate = await tx.paymentSession.updateMany({
          where: { id: session.id, status: PaymentSessionStatus.WAITING },
          data: { status: PaymentSessionStatus.PAID },
        });
        if (sessionUpdate.count !== 1) {
          throw new Error('Payment session state changed during locked transaction');
        }
        await tx.paymentAttempt.create({
          data: {
            paymentSessionId: session.id,
            method: command.method,
            actorId: command.actorId,
            actorType: command.actorType,
            payerUserId: command.payerUserId,
            status: AttemptStatus.SUCCESS,
            transactionId: transaction.id,
          },
        });
        const body = {
          success: true,
          paymentSessionId: session.id,
          transactionId: transaction.id,
          amount: serializeMoney(amount),
          currency: 'TRY',
        };
        await this.idempotency.complete(tx, prepared.recordId, 200, body, transaction.id);
        const notification =
          command.method === PaymentMethod.NFC
            ? await this.notifications.createNfcPayment(tx, payer.id, transaction.id, amount)
            : undefined;
        return {
          kind: 'success',
          body,
          transactionId: transaction.id,
          replayed: false,
          notificationId: notification?.id,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5000,
        timeout: 10000,
      },
    );
  }

  private async failure(
    tx: Prisma.TransactionClient,
    prepared: PreparedIdempotency,
    command: Command,
    status: number,
    code: string,
    message: string,
    paymentSessionId?: string,
    verifiedPayerUserId?: string,
  ): Promise<Outcome> {
    await tx.paymentAttempt.create({
      data: {
        paymentSessionId: paymentSessionId ?? null,
        method: command.method,
        actorId: command.actorId,
        actorType: command.actorType,
        payerUserId: verifiedPayerUserId ?? null,
        status: AttemptStatus.FAILED,
        failureCode: code,
        failureMessage: message,
      },
    });
    const body = { success: false, code, message };
    await this.idempotency.complete(tx, prepared.recordId, status, body);
    return { kind: 'failure', status, code, message, body };
  }

  private isRetryable(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }
    const record = error as {
      code?: unknown;
      cause?: { code?: unknown; originalCode?: unknown };
      meta?: {
        code?: unknown;
        originalCode?: unknown;
        driverAdapterError?: {
          cause?: { code?: unknown; originalCode?: unknown };
        };
      };
    };
    const codes = [
      record.code,
      record.cause?.code,
      record.cause?.originalCode,
      record.meta?.code,
      record.meta?.originalCode,
      record.meta?.driverAdapterError?.cause?.code,
      record.meta?.driverAdapterError?.cause?.originalCode,
    ]
      .filter((code): code is string | number => code !== undefined && code !== null)
      .map(String);

    return codes.some((code) => ['P2034', '40001', '40P01'].includes(code));
  }
}
