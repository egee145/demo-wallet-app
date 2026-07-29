CREATE TYPE "wallet_app"."NotificationType" AS ENUM (
  'NFC_CARD_TRANSFERRED',
  'NFC_PAYMENT_COMPLETED'
);

CREATE TYPE "wallet_app"."PushPlatform" AS ENUM ('ANDROID', 'IOS');

CREATE TABLE "wallet_app"."push_devices" (
  "id" UUID PRIMARY KEY,
  "user_id" UUID NOT NULL,
  "expo_push_token" VARCHAR(255) NOT NULL,
  "platform" "wallet_app"."PushPlatform" NOT NULL,
  "language" VARCHAR(2) NOT NULL DEFAULT 'tr',
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "last_seen_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "push_devices_language_check" CHECK ("language" IN ('tr', 'en')),
  CONSTRAINT "push_devices_user_fkey" FOREIGN KEY ("user_id")
    REFERENCES "wallet_app"."users"("id") ON DELETE RESTRICT
);

CREATE UNIQUE INDEX "push_devices_expo_push_token_key"
  ON "wallet_app"."push_devices"("expo_push_token");
CREATE INDEX "push_devices_user_active_idx"
  ON "wallet_app"."push_devices"("user_id", "is_active");

CREATE TABLE "wallet_app"."user_notifications" (
  "id" UUID PRIMARY KEY,
  "user_id" UUID NOT NULL,
  "type" "wallet_app"."NotificationType" NOT NULL,
  "data" JSONB NOT NULL,
  "transaction_id" UUID,
  "read_at" TIMESTAMPTZ(3),
  "push_sent_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_notifications_user_fkey" FOREIGN KEY ("user_id")
    REFERENCES "wallet_app"."users"("id") ON DELETE RESTRICT,
  CONSTRAINT "user_notifications_transaction_fkey" FOREIGN KEY ("transaction_id")
    REFERENCES "wallet_app"."transactions"("id") ON DELETE RESTRICT
);

CREATE UNIQUE INDEX "user_notifications_transaction_id_key"
  ON "wallet_app"."user_notifications"("transaction_id");
CREATE INDEX "user_notifications_user_unread_created_idx"
  ON "wallet_app"."user_notifications"("user_id", "read_at", "created_at");
