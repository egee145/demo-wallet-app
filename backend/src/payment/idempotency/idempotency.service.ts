import { randomUUID } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { IdempotencyActorType, IdempotencyStatus, Prisma } from '../../generated/prisma/client.js';
import { DomainException } from '../../common/errors/domain.exception.js';

type TransactionClient = Prisma.TransactionClient;

type RawIdempotencyRow = {
  id: string;
  request_hash: string;
  status: IdempotencyStatus;
  response_status: number | null;
  response_body: unknown;
  transaction_id: string | null;
};

export type IdempotencyScope = {
  actorId: string;
  actorType: IdempotencyActorType;
  endpoint: string;
  key: string;
  requestHash: string;
};

export type IdempotencyReplay = {
  status: number;
  body: Record<string, unknown>;
  transactionId: string | null;
};

export type PreparedIdempotency = {
  recordId: string;
  replay?: IdempotencyReplay;
};

@Injectable()
export class IdempotencyService {
  async prepare(tx: TransactionClient, scope: IdempotencyScope): Promise<PreparedIdempotency> {
    const id = randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const inserted = await tx.$queryRaw<RawIdempotencyRow[]>(Prisma.sql`
      INSERT INTO "wallet_app"."idempotency_records"
        ("id", "actor_id", "actor_type", "endpoint", "idempotency_key",
         "request_hash", "status", "created_at", "expires_at")
      VALUES
        (${id}::uuid, ${scope.actorId}::uuid,
         ${scope.actorType}::"wallet_app"."IdempotencyActorType",
         ${scope.endpoint}, ${scope.key}::uuid, ${scope.requestHash},
         'PROCESSING', CURRENT_TIMESTAMP, ${expiresAt})
      ON CONFLICT ("actor_type", "actor_id", "endpoint", "idempotency_key")
      DO NOTHING
      RETURNING "id", "request_hash", "status", "response_status",
                "response_body", "transaction_id"
    `);

    if (inserted[0]) {
      return { recordId: inserted[0].id };
    }

    const existing = await tx.$queryRaw<RawIdempotencyRow[]>(Prisma.sql`
      SELECT "id", "request_hash", "status", "response_status",
             "response_body", "transaction_id"
      FROM "wallet_app"."idempotency_records"
      WHERE "actor_type" = ${scope.actorType}::"wallet_app"."IdempotencyActorType"
        AND "actor_id" = ${scope.actorId}::uuid
        AND "endpoint" = ${scope.endpoint}
        AND "idempotency_key" = ${scope.key}::uuid
      FOR UPDATE
    `);
    const row = existing[0];

    if (!row) {
      throw new DomainException(
        'PAYMENT_CONCURRENCY_CONFLICT',
        'Idempotency kaydı eşzamanlı olarak değişti.',
        HttpStatus.CONFLICT,
      );
    }

    if (row.request_hash !== scope.requestHash) {
      throw new DomainException(
        'IDEMPOTENCY_KEY_REUSED',
        'Aynı idempotency key farklı bir payload ile kullanılamaz.',
        HttpStatus.CONFLICT,
      );
    }

    if (
      row.status === IdempotencyStatus.COMPLETED &&
      row.response_status !== null &&
      row.response_body !== null
    ) {
      return {
        recordId: row.id,
        replay: {
          status: row.response_status,
          body: row.response_body as Record<string, unknown>,
          transactionId: row.transaction_id,
        },
      };
    }

    throw new DomainException(
      'PAYMENT_CONCURRENCY_CONFLICT',
      'Aynı istek halen işleniyor.',
      HttpStatus.CONFLICT,
    );
  }

  async complete(
    tx: TransactionClient,
    recordId: string,
    responseStatus: number,
    responseBody: Record<string, unknown>,
    transactionId?: string,
  ): Promise<void> {
    await tx.idempotencyRecord.update({
      where: { id: recordId },
      data: {
        status: IdempotencyStatus.COMPLETED,
        responseStatus,
        responseBody: responseBody as Prisma.InputJsonValue,
        transactionId: transactionId ?? null,
      },
    });
  }
}
