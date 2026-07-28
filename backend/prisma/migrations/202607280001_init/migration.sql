CREATE SCHEMA IF NOT EXISTS "wallet_app";

CREATE TYPE "wallet_app"."Role" AS ENUM ('USER', 'MERCHANT', 'ADMIN');
CREATE TYPE "wallet_app"."WalletOwnerType" AS ENUM ('USER', 'MERCHANT');
CREATE TYPE "wallet_app"."Currency" AS ENUM ('TRY');
CREATE TYPE "wallet_app"."PaymentSessionStatus" AS ENUM ('WAITING', 'PAID', 'EXPIRED', 'CANCELLED');
CREATE TYPE "wallet_app"."PaymentMethod" AS ENUM ('NFC', 'QR');
CREATE TYPE "wallet_app"."TransactionStatus" AS ENUM ('SUCCESS', 'FAILED');
CREATE TYPE "wallet_app"."AttemptStatus" AS ENUM ('SUCCESS', 'FAILED');
CREATE TYPE "wallet_app"."IdempotencyActorType" AS ENUM ('USER', 'MERCHANT', 'ADMIN');
CREATE TYPE "wallet_app"."IdempotencyStatus" AS ENUM ('PROCESSING', 'COMPLETED');
CREATE TYPE "wallet_app"."AdjustmentType" AS ENUM ('DEPOSIT');

CREATE TABLE "wallet_app"."users" (
  "id" UUID PRIMARY KEY,
  "name" VARCHAR(100) NOT NULL,
  "email" VARCHAR(254) NOT NULL,
  "phone" VARCHAR(20),
  "password_hash" VARCHAR(255) NOT NULL,
  "role" "wallet_app"."Role" NOT NULL DEFAULT 'USER',
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL
);

CREATE TABLE "wallet_app"."wallets" (
  "id" UUID PRIMARY KEY,
  "owner_type" "wallet_app"."WalletOwnerType" NOT NULL,
  "user_id" UUID,
  "balance" NUMERIC(18,2) NOT NULL DEFAULT 0,
  "currency" "wallet_app"."Currency" NOT NULL DEFAULT 'TRY',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "wallets_id_owner_type_key" UNIQUE ("id", "owner_type"),
  CONSTRAINT "wallets_balance_nonnegative" CHECK ("balance" >= 0),
  CONSTRAINT "wallets_balance_max" CHECK ("balance" <= 999999999999.99),
  CONSTRAINT "wallets_owner_shape" CHECK (
    ("owner_type" = 'USER' AND "user_id" IS NOT NULL) OR
    ("owner_type" = 'MERCHANT' AND "user_id" IS NULL)
  ),
  CONSTRAINT "wallets_user_id_fkey" FOREIGN KEY ("user_id")
    REFERENCES "wallet_app"."users"("id") ON DELETE RESTRICT
);

CREATE TABLE "wallet_app"."merchants" (
  "id" UUID PRIMARY KEY,
  "user_id" UUID NOT NULL,
  "name" VARCHAR(150) NOT NULL,
  "wallet_id" UUID NOT NULL,
  "wallet_owner_type" "wallet_app"."WalletOwnerType" NOT NULL DEFAULT 'MERCHANT',
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "merchants_wallet_type" CHECK ("wallet_owner_type" = 'MERCHANT'),
  CONSTRAINT "merchants_user_id_fkey" FOREIGN KEY ("user_id")
    REFERENCES "wallet_app"."users"("id") ON DELETE RESTRICT,
  CONSTRAINT "merchants_wallet_fkey" FOREIGN KEY ("wallet_id", "wallet_owner_type")
    REFERENCES "wallet_app"."wallets"("id", "owner_type") ON DELETE RESTRICT
);

CREATE TABLE "wallet_app"."payment_sessions" (
  "id" UUID PRIMARY KEY,
  "merchant_id" UUID NOT NULL,
  "amount" NUMERIC(18,2) NOT NULL,
  "currency" "wallet_app"."Currency" NOT NULL DEFAULT 'TRY',
  "status" "wallet_app"."PaymentSessionStatus" NOT NULL DEFAULT 'WAITING',
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "payment_sessions_amount_range" CHECK ("amount" >= 0.01 AND "amount" <= 999999.99),
  CONSTRAINT "payment_sessions_expiry" CHECK ("expires_at" > "created_at"),
  CONSTRAINT "payment_sessions_merchant_id_fkey" FOREIGN KEY ("merchant_id")
    REFERENCES "wallet_app"."merchants"("id") ON DELETE RESTRICT
);

CREATE TABLE "wallet_app"."transactions" (
  "id" UUID PRIMARY KEY,
  "payment_session_id" UUID NOT NULL,
  "from_wallet_id" UUID NOT NULL,
  "to_wallet_id" UUID NOT NULL,
  "amount" NUMERIC(18,2) NOT NULL,
  "currency" "wallet_app"."Currency" NOT NULL DEFAULT 'TRY',
  "payment_method" "wallet_app"."PaymentMethod" NOT NULL,
  "status" "wallet_app"."TransactionStatus" NOT NULL DEFAULT 'SUCCESS',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "transactions_amount_positive" CHECK ("amount" > 0),
  CONSTRAINT "transactions_wallets_different" CHECK ("from_wallet_id" <> "to_wallet_id"),
  CONSTRAINT "transactions_session_fkey" FOREIGN KEY ("payment_session_id")
    REFERENCES "wallet_app"."payment_sessions"("id") ON DELETE RESTRICT,
  CONSTRAINT "transactions_from_wallet_fkey" FOREIGN KEY ("from_wallet_id")
    REFERENCES "wallet_app"."wallets"("id") ON DELETE RESTRICT,
  CONSTRAINT "transactions_to_wallet_fkey" FOREIGN KEY ("to_wallet_id")
    REFERENCES "wallet_app"."wallets"("id") ON DELETE RESTRICT
);

CREATE TABLE "wallet_app"."payment_attempts" (
  "id" UUID PRIMARY KEY,
  "payment_session_id" UUID,
  "method" "wallet_app"."PaymentMethod" NOT NULL,
  "actor_id" UUID NOT NULL,
  "actor_type" "wallet_app"."IdempotencyActorType" NOT NULL,
  "payer_user_id" UUID,
  "status" "wallet_app"."AttemptStatus" NOT NULL,
  "failure_code" VARCHAR(100),
  "failure_message" VARCHAR(500),
  "transaction_id" UUID,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_attempts_outcome_shape" CHECK (
    ("status" = 'SUCCESS' AND "transaction_id" IS NOT NULL AND "failure_code" IS NULL) OR
    ("status" = 'FAILED' AND "transaction_id" IS NULL AND "failure_code" IS NOT NULL)
  ),
  CONSTRAINT "payment_attempts_session_fkey" FOREIGN KEY ("payment_session_id")
    REFERENCES "wallet_app"."payment_sessions"("id") ON DELETE RESTRICT,
  CONSTRAINT "payment_attempts_payer_user_fkey" FOREIGN KEY ("payer_user_id")
    REFERENCES "wallet_app"."users"("id") ON DELETE RESTRICT,
  CONSTRAINT "payment_attempts_transaction_fkey" FOREIGN KEY ("transaction_id")
    REFERENCES "wallet_app"."transactions"("id") ON DELETE RESTRICT
);

CREATE TABLE "wallet_app"."idempotency_records" (
  "id" UUID PRIMARY KEY,
  "actor_id" UUID NOT NULL,
  "actor_type" "wallet_app"."IdempotencyActorType" NOT NULL,
  "endpoint" VARCHAR(120) NOT NULL,
  "idempotency_key" UUID NOT NULL,
  "request_hash" CHAR(64) NOT NULL,
  "status" "wallet_app"."IdempotencyStatus" NOT NULL DEFAULT 'PROCESSING',
  "response_status" INTEGER,
  "response_body" JSONB,
  "transaction_id" UUID,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "idempotency_transaction_fkey" FOREIGN KEY ("transaction_id")
    REFERENCES "wallet_app"."transactions"("id") ON DELETE RESTRICT
);

CREATE TABLE "wallet_app"."refresh_sessions" (
  "id" UUID PRIMARY KEY,
  "user_id" UUID NOT NULL,
  "family_id" UUID NOT NULL,
  "token_hash" CHAR(64) NOT NULL,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "revoked_at" TIMESTAMPTZ(3),
  "replaced_by_id" UUID,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "refresh_sessions_user_fkey" FOREIGN KEY ("user_id")
    REFERENCES "wallet_app"."users"("id") ON DELETE RESTRICT,
  CONSTRAINT "refresh_sessions_replacement_fkey" FOREIGN KEY ("replaced_by_id")
    REFERENCES "wallet_app"."refresh_sessions"("id") ON DELETE RESTRICT
);

CREATE TABLE "wallet_app"."wallet_adjustments" (
  "id" UUID PRIMARY KEY,
  "wallet_id" UUID NOT NULL,
  "amount" NUMERIC(18,2) NOT NULL,
  "type" "wallet_app"."AdjustmentType" NOT NULL DEFAULT 'DEPOSIT',
  "reason" VARCHAR(250) NOT NULL,
  "admin_user_id" UUID NOT NULL,
  "idempotency_key" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "wallet_adjustments_amount" CHECK ("amount" >= 0.01 AND "amount" <= 999999.99),
  CONSTRAINT "wallet_adjustments_wallet_fkey" FOREIGN KEY ("wallet_id")
    REFERENCES "wallet_app"."wallets"("id") ON DELETE RESTRICT,
  CONSTRAINT "wallet_adjustments_admin_fkey" FOREIGN KEY ("admin_user_id")
    REFERENCES "wallet_app"."users"("id") ON DELETE RESTRICT
);

CREATE UNIQUE INDEX "users_email_key" ON "wallet_app"."users"("email");
CREATE UNIQUE INDEX "users_email_normalized_key" ON "wallet_app"."users"(LOWER("email"));
CREATE UNIQUE INDEX "users_phone_key" ON "wallet_app"."users"("phone");
CREATE INDEX "users_role_active_idx" ON "wallet_app"."users"("role", "is_active");
CREATE UNIQUE INDEX "wallets_user_id_key" ON "wallet_app"."wallets"("user_id");
CREATE UNIQUE INDEX "merchants_user_id_key" ON "wallet_app"."merchants"("user_id");
CREATE UNIQUE INDEX "merchants_wallet_id_key" ON "wallet_app"."merchants"("wallet_id");
CREATE UNIQUE INDEX "merchants_wallet_id_owner_type_key"
  ON "wallet_app"."merchants"("wallet_id", "wallet_owner_type");
CREATE INDEX "merchants_active_idx" ON "wallet_app"."merchants"("is_active");
CREATE INDEX "payment_sessions_merchant_status_created_idx"
  ON "wallet_app"."payment_sessions"("merchant_id", "status", "created_at");
CREATE INDEX "payment_sessions_status_expires_idx"
  ON "wallet_app"."payment_sessions"("status", "expires_at");
CREATE UNIQUE INDEX "transactions_single_success_per_session"
  ON "wallet_app"."transactions"("payment_session_id") WHERE "status" = 'SUCCESS';
CREATE INDEX "transactions_from_created_idx"
  ON "wallet_app"."transactions"("from_wallet_id", "created_at", "id");
CREATE INDEX "transactions_to_created_idx"
  ON "wallet_app"."transactions"("to_wallet_id", "created_at", "id");
CREATE INDEX "payment_attempts_session_created_idx"
  ON "wallet_app"."payment_attempts"("payment_session_id", "created_at");
CREATE INDEX "payment_attempts_failure_created_idx"
  ON "wallet_app"."payment_attempts"("failure_code", "created_at");
CREATE UNIQUE INDEX "idempotency_scope_key"
  ON "wallet_app"."idempotency_records"("actor_type", "actor_id", "endpoint", "idempotency_key");
CREATE INDEX "idempotency_expires_idx" ON "wallet_app"."idempotency_records"("expires_at");
CREATE UNIQUE INDEX "refresh_sessions_token_hash_key"
  ON "wallet_app"."refresh_sessions"("token_hash");
CREATE INDEX "refresh_sessions_user_family_idx"
  ON "wallet_app"."refresh_sessions"("user_id", "family_id");
CREATE INDEX "refresh_sessions_expires_idx" ON "wallet_app"."refresh_sessions"("expires_at");
CREATE UNIQUE INDEX "wallet_adjustments_admin_key"
  ON "wallet_app"."wallet_adjustments"("admin_user_id", "idempotency_key");
CREATE INDEX "wallet_adjustments_wallet_created_idx"
  ON "wallet_app"."wallet_adjustments"("wallet_id", "created_at");

CREATE OR REPLACE FUNCTION "wallet_app"."prevent_transaction_mutation"()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'transactions are immutable' USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER "transactions_immutable_update"
BEFORE UPDATE OR DELETE ON "wallet_app"."transactions"
FOR EACH ROW EXECUTE FUNCTION "wallet_app"."prevent_transaction_mutation"();

CREATE OR REPLACE FUNCTION "wallet_app"."prevent_payment_session_terms_mutation"()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."merchant_id" IS DISTINCT FROM OLD."merchant_id"
     OR NEW."amount" IS DISTINCT FROM OLD."amount"
     OR NEW."currency" IS DISTINCT FROM OLD."currency"
     OR NEW."expires_at" IS DISTINCT FROM OLD."expires_at" THEN
    RAISE EXCEPTION 'payment session terms are immutable' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "payment_sessions_terms_immutable"
BEFORE UPDATE ON "wallet_app"."payment_sessions"
FOR EACH ROW EXECUTE FUNCTION "wallet_app"."prevent_payment_session_terms_mutation"();

CREATE OR REPLACE FUNCTION "wallet_app"."validate_merchant_user_role"()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "wallet_app"."users"
    WHERE "id" = NEW."user_id" AND "role" = 'MERCHANT'
  ) THEN
    RAISE EXCEPTION 'merchant user must have MERCHANT role' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER "merchants_user_role"
AFTER INSERT OR UPDATE ON "wallet_app"."merchants"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "wallet_app"."validate_merchant_user_role"();
