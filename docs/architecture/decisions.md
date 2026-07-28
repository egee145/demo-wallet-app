# Architecture Decisions

## ADR-001 — Modular monolith

NestJS uygulaması auth, users, wallet, merchant, payment, transaction, database ve health
modüllerinden oluşan modüler monolith olacaktır. Mikroservis/CQRS/event sourcing v1
kapsamında değildir.

## ADR-002 — Money

Para PostgreSQL `NUMERIC(18,2)` ve Prisma Decimal ile saklanır. Para birimi TRY'dir.
Wallet bakiyesi database constraint ile negatif olamaz.

## ADR-003 — Payment consistency

NFC ve QR ortak Payment Session ve PaymentExecutionService kullanır. Transfer Serializable
transaction, session/wallet lock, koşullu debit, unique constraint ve idempotency ile
korunur.

## ADR-004 — Supabase boundary

Supabase yalnız PostgreSQL sağlayıcısıdır. JWT NestJS tarafından yönetilir. Mobil uygulama
finans tablolarına doğrudan erişmez.

## ADR-005 — NFC risk gate

Kart formatı önceden varsayılmaz. Expo Development Build ile fiziksel Android cihazda
diagnostics spike yapılır. Emulator gerçek NFC kabulü değildir ve karta açık izin olmadan
yazılmaz.
