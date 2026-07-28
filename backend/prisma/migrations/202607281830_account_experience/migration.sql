CREATE TYPE "wallet_app"."NfcCardStatus" AS ENUM ('ACTIVE', 'REVOKED');
CREATE TYPE "wallet_app"."WalletTopUpProvider" AS ENUM ('MOCK');
CREATE TYPE "wallet_app"."WalletTopUpStatus" AS ENUM ('COMPLETED');

CREATE TABLE "wallet_app"."nfc_cards" (
  "id" UUID PRIMARY KEY,
  "user_id" UUID NOT NULL,
  "tag_uid_hash" CHAR(64) NOT NULL,
  "label" VARCHAR(80) NOT NULL DEFAULT 'HepAntalya Card',
  "status" "wallet_app"."NfcCardStatus" NOT NULL DEFAULT 'ACTIVE',
  "bound_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "nfc_cards_uid_hash_format"
    CHECK ("tag_uid_hash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "nfc_cards_user_fkey" FOREIGN KEY ("user_id")
    REFERENCES "wallet_app"."users"("id") ON DELETE RESTRICT
);

CREATE UNIQUE INDEX "nfc_cards_user_id_key"
  ON "wallet_app"."nfc_cards"("user_id");
CREATE UNIQUE INDEX "nfc_cards_tag_uid_hash_key"
  ON "wallet_app"."nfc_cards"("tag_uid_hash");
CREATE INDEX "nfc_cards_status_idx"
  ON "wallet_app"."nfc_cards"("status");

CREATE TABLE "wallet_app"."wallet_top_ups" (
  "id" UUID PRIMARY KEY,
  "user_id" UUID NOT NULL,
  "wallet_id" UUID NOT NULL,
  "amount" NUMERIC(18,2) NOT NULL,
  "currency" "wallet_app"."Currency" NOT NULL DEFAULT 'TRY',
  "provider" "wallet_app"."WalletTopUpProvider" NOT NULL DEFAULT 'MOCK',
  "status" "wallet_app"."WalletTopUpStatus" NOT NULL DEFAULT 'COMPLETED',
  "card_last4" CHAR(4) NOT NULL,
  "cardholder_name" VARCHAR(100) NOT NULL,
  "idempotency_key" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "wallet_top_ups_amount_range"
    CHECK ("amount" >= 0.01 AND "amount" <= 999999.99),
  CONSTRAINT "wallet_top_ups_card_last4_format"
    CHECK ("card_last4" ~ '^[0-9]{4}$'),
  CONSTRAINT "wallet_top_ups_user_fkey" FOREIGN KEY ("user_id")
    REFERENCES "wallet_app"."users"("id") ON DELETE RESTRICT,
  CONSTRAINT "wallet_top_ups_wallet_fkey" FOREIGN KEY ("wallet_id")
    REFERENCES "wallet_app"."wallets"("id") ON DELETE RESTRICT
);

CREATE UNIQUE INDEX "wallet_top_ups_user_idempotency_key"
  ON "wallet_app"."wallet_top_ups"("user_id", "idempotency_key");
CREATE INDEX "wallet_top_ups_wallet_created_idx"
  ON "wallet_app"."wallet_top_ups"("wallet_id", "created_at");
