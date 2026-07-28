# Requirements Matrix

| Requirement               | Implementation                                     | Evidence                |
| ------------------------- | -------------------------------------------------- | ----------------------- |
| USER wallet               | Atomic register transaction                        | Integration test        |
| Merchant wallet           | Atomic BUSINESS registration or ADMIN provision    | Integration test        |
| Decimal money             | NUMERIC(18,2) + Prisma Decimal                     | Unit/integration        |
| No negative wallet        | Check constraint + conditional debit               | Concurrency             |
| Session single use        | Lock + unique SUCCESS index                        | Concurrency             |
| NFC and QR                | Shared PaymentExecutionService                     | Integration             |
| Idempotency               | Actor-scoped key/hash/result                       | Integration/concurrency |
| NFC card UUID             | Diagnostics + strict NDEF parser                   | Unit/manual device      |
| No direct mobile DB write | REST-only API boundary                             | Architecture review     |
| Security/operations       | JWT, validation, Helmet, CORS, rate limit, logging | Tests/CI                |
