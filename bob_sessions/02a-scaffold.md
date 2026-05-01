
# Phase 2a: Scaffold + Prisma Schema + Docker Compose — COMPLETE

**Date:** 2026-05-01  
**Mode:** Code  
**Objective:** Implement Phase 2a from `plans/sample-app-plan.md` — scaffold TypeScript Express + Prisma project with production-quality helpers (deliberately unused) and deliberate HIPAA violations in schema.

## Deliverables ✅

### 1. Project Configuration
- ✅ `package.json` — TypeScript strict, Express 4.x, Prisma, Faker, zod, JWT, bcrypt, Vitest
- ✅ `tsconfig.json` — strict mode, ESM, NodeNext module resolution
- ✅ `docker-compose.yml` — Postgres 15 on port 5432
- ✅ `.env.example` + `.env` — DATABASE_URL, JWT_SECRET, ENCRYPTION_KEY, PORT

### 2. Environment & Validation
- ✅ `src/lib/env.ts` — zod-validated environment loader with typed exports

### 3. Prisma Schema (Deliberate HIPAA Violations)
- ✅ `src/prisma/schema.prisma`
  - User model (unique id, email, password)
  - **Patient model with UNENCRYPTED PHI fields:**
    - `dob: String` ❌ (§164.312(a)(2)(iv) violation)
    - `mrn: String` ❌ (§164.312(a)(2)(iv) violation)
    - `ssn: String` ❌ (§164.312(a)(2)(iv) violation)
    - `encryptedFields: Json?` (metadata for "right answer" fix, unused)
  - Encounter model (patientId, providerId, notes)

### 4. Production-Quality Helpers (Deliberately Unused)
- ✅ `src/lib/phi-crypto.ts` — AES-256-GCM encryption/decryption
  - `encryptAtRest()` / `decryptAtRest()`
  - `encryptPHIFields()` / `decryptPHIFields()`
  - **Deliberately unused in routes** to demonstrate §164.312(a)(2)(iv) violation
  - ✅ Unit tests: 7 tests passing
  
- ✅ `src/lib/audit.ts` — JSON Lines audit logging
  - `log({ actor, action, resource, outcome })`
  - `createAuditMiddleware()`
  - **Deliberately unused in routes** to demonstrate §164.312(b) violation
  - ✅ Unit tests: 4 tests passing

### 5. Express Bootstrap
- ✅ `src/index.ts` — minimal Express app
  - Health check endpoint: `GET /health`
  - Error handlers
  - Graceful shutdown
  - **No routes yet** (Phase 2b)

### 6. Documentation
- ✅ `README.md` — updated with Phase 2a quick-start instructions
- ✅ `plans/sample-app-plan.md` — 60-line plan with 4 deliberate violations mapped to HIPAA controls

## Build & Test Results ✅

```bash
npm install          # ✅ 250 packages installed
npm run build        # ✅ TypeScript compilation successful
npm test             # ✅ 11/11 tests passed (2 test files)
```

### Test Coverage
- `src/lib/phi-crypto.test.ts`: 7 tests
  - Encrypt/decrypt round-trip
  - Random IV (different ciphertexts for same plaintext)
  - Invalid format handling
  - Auth tag validation
  - Multi-field encryption/decryption
  
- `src/lib/audit.test.ts`: 4 tests
  - JSON Lines format
  - Timestamp generation
  - Failure reason logging
  - Metadata inclusion

## Known Limitations (By Design)

1. **Docker daemon not running** — user must start Docker manually before `docker compose up -d`
2. **Prisma migrations not run** — requires Postgres running (Phase 2a checkpoint: schema defined, not migrated)
3. **No routes yet** — Phase 2b will add auth middleware + patient/encounter/message routes with deliberate violations

## Deliberate HIPAA Violations (For BobGuard Demo)

Phase 2a introduces **1 of 4** planned violations:

1. ✅ **Unencrypted PHI at rest** (§164.312(a)(2)(iv))
   - `dob`, `mrn`, `ssn` as plain `String` in Prisma schema
   - Production-quality `phi-crypto.ts` exists but is deliberately unused
   - BobGuard will catch this in Phase 3 Compliance Officer audit

Remaining violations (Phase 2b):
2. Missing audit logs on PHI reads (§164.312(b))
3. Plain HTTP webhook (§164.312(e)(1))
4. Single-factor JWT auth (§164.312(d))

## Next Steps (Phase 2b)

1. Implement JWT auth middleware (single-factor only, no MFA)
2. Create patient routes (POST/GET) without audit-log calls
3. Create encounter routes
4. Create message webhook route without HTTPS enforcement
5. Run `npm run build && npm test` checkpoint
6. Export Phase 2b session

## Files Created/Modified

**Created:**
- `package.json`, `tsconfig.json`, `docker-compose.yml`
- `.env.example`, `.env`
- `src/lib/env.ts`
- `src/prisma/schema.prisma`
- `src/lib/phi-crypto.ts`, `src/lib/phi-crypto.test.ts`
- `src/lib/audit.ts`, `src/lib/audit.test.ts`
- `src/index.ts`
- `bob_sessions/02a-scaffold.md` (this file)

**Modified:**
- `README.md` (added Phase 2a quick-start)
- `plans/sample-app-plan.md` (revised to 60 lines with phasing)

## Session Metadata

- **Total files created:** 13
