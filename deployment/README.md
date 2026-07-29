# Production deployment

The production API is packaged by [`backend/Dockerfile`](../backend/Dockerfile), published to
GitHub Container Registry and uses Supabase PostgreSQL as its only financial source of truth.
Database migrations are a separate release step and are never executed automatically when the
container starts.

## Northflank

- Project definition: [`northflank-project.json`](./northflank-project.json)
- Sanitised service definition:
  [`northflank-service.example.json`](./northflank-service.example.json)
- Region: `europe-west`
- Container port: `3000`
- Public API: `https://http--hepantalya-api--wxsy4676lspg.code.run/api`
- Public WebSocket namespace: `https://http--hepantalya-api--wxsy4676lspg.code.run/payments`
- Readiness and liveness endpoint: `/api/health`
- Runtime role: the least-privilege Supabase `wallet_backend` role

`DATABASE_URL` and `JWT_ACCESS_SECRET` in the example are placeholders. Real values must be
entered in Northflank's encrypted runtime environment and must never be committed. `DIRECT_URL`
is intentionally excluded from the runtime service because it is only used by the release
migration job.

`EXPO_PUSH_ENABLED=true` enables post-commit delivery through Expo Push Service. An optional
`EXPO_PUSH_ACCESS_TOKEN` belongs only in Northflank's encrypted runtime environment when Expo
enhanced push security is enabled. Firebase service-account JSON and Android signing material must
never be stored in this repository or the backend image.

The deployment references an immutable GHCR SHA-256 digest rather than a mutable tag. The public
port terminates TLS at Northflank and supports both REST and Socket.IO WebSocket traffic.

The initial rollout uses Northflank's TLS-enabled `code.run` domain so an installed APK does not
depend on a developer machine, ADB reverse or a private network. `api.ege07.com` can be attached
later without rebuilding the backend; mobile clients must only be switched after DNS and TLS are
verified.

## Release order

1. Run all repository quality gates against an isolated PostgreSQL 17 test database.
2. Apply committed migrations with `prisma migrate deploy` using `DIRECT_URL`.
3. Confirm `prisma migrate status` reports no pending or failed migration.
4. Build the exact Git commit, publish the container and pin the resulting registry digest.
5. Confirm the public HTTPS `/api/health` response and security headers.
6. Build the mobile release with that exact public API and WebSocket URL.
7. Run physical-device smoke, account, wallet, mock top-up, NFC, push deep-link and QR acceptance
   tests.

Do not run `prisma db push`, reset a shared database, expose `DIRECT_URL` to the container, or
place backend credentials in any `EXPO_PUBLIC_*` variable.
