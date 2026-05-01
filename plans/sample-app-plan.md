# Sample Telehealth API — Deliberate Non-Compliance for BobGuard Demo

Minimal TypeScript Express + Prisma API with **intentional HIPAA violations** that BobGuard's Compliance Officer mode will catch in Phase 3.

## Stack
TypeScript (strict) • Express 4.x • Prisma + Postgres 15 • JWT (single-factor) • Faker (synthetic data only)

## Deliberate HIPAA Violations (BobGuard will catch)
1. **Unencrypted PHI at rest** — `dob`/`mrn`/`ssn` as plain `String` in Prisma schema (§164.312(a)(2)(iv))
2. **Missing audit logs** — `GET /patients/:id` without `audit.log()` call (§164.312(b))
3. **Plain HTTP webhook** — `POST /messages/inbound` accepts HTTP (§164.312(e)(1))
4. **Single-factor JWT** — no MFA gate in auth flow (§164.312(d))

## Infrastructure
- `docker-compose.yml` — Postgres 15
- `.env.example` — `DATABASE_URL`, `JWT_SECRET`, `PORT`
- `src/lib/env.ts` — typed env validation (zod)
- `src/lib/phi-crypto.ts` — `encryptAtRest()`, `decryptAtRest()` (production-quality, **deliberately unused**)
- `src/lib/audit.ts` — `log({ actor, action, resource, outcome })` (production-quality, **deliberately unused**)

## Prisma Schema (src/prisma/schema.prisma)
```prisma
model User {
  id       String @id @default(cuid())
  email    String @unique
  password String
}

model Patient {
  id              String @id @default(cuid())
  name            String
  dob             String  // ❌ unencrypted PHI
  mrn             String  // ❌ unencrypted PHI
  ssn             String  // ❌ unencrypted PHI
  encryptedFields Json?   // metadata for "right answer" fix
}
```

## Endpoints (src/routes/)
- `POST /auth/login` — JWT (no MFA)
- `POST /patients`, `GET /patients/:id`, `GET /patients` — no audit logs
- `POST /encounters` — (patientId, providerId, notes)
- `POST /messages/inbound` — plain HTTP webhook

## Implementation Phases (P2.2 Playbook)

### Phase 2a: Scaffold + Schema + Docker
- Init TS project, `docker-compose.yml`, `.env.example`, `src/lib/env.ts`
- Prisma schema with unencrypted PHI fields
- `prisma migrate dev`
- **Checkpoint:** `npm run build && npm test` pass, export Bob session

### Phase 2b: Auth + Routes
- JWT middleware (single-factor only)
- Four route files (auth, patient, encounter, message) with deliberate violations
- **Checkpoint:** `npm run build && npm test` pass, export Bob session

### Phase 2c: Seed + Smoke Tests
- `prisma/seed.ts` with Faker synthetic data
- `src/__smoke__/api.smoke.test.ts` — hits each endpoint, confirms violations are reachable
- **Checkpoint:** `npm run build && npm test` pass, export Bob session

### Phase 3: BobGuard Audit (separate task, Compliance Officer mode)
- Run `/audit-pr`, verify all 4 violations caught with control citations
- Generate evidence pack PDF