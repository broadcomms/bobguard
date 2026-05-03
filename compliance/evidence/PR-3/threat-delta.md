# Threat Model Delta — PR-3

## Executive Summary

The introduction of [`src/routes/diagnosis.routes.ts`](../../../src/routes/diagnosis.routes.ts) creates **5 new attack vectors** that expose Protected Health Information (PHI) to unauthorized access, interception, and tampering. All vectors are rated **CRITICAL** severity due to direct PHI exposure.

---

## New Attack Vectors

### 1. Unauthorized PHI Access (CRITICAL)

**Threat:** Unauthenticated actors can read, create, and delete diagnosis records containing PHI.

**Attack Path:**
1. Attacker sends HTTP request to `/list`, `/`, or `/:id` endpoints
2. No authentication middleware validates the request
3. Direct ORM access to `prisma.diagnosis` returns PHI
4. Attacker exfiltrates patient diagnosis data, ICD-10 codes, and clinical notes

**Affected Controls:** §164.312(a)(1) — Access Control

**Likelihood:** High (publicly exposed API endpoints)  
**Impact:** Critical (full PHI database exposure)

**Mitigation:** Wrap all route handlers with `requireAuth` middleware from [`src/middleware/auth.middleware.ts`](../../../src/middleware/auth.middleware.ts). Implement role-based access control (RBAC) to verify `diagnosis:read`, `diagnosis:write`, and `diagnosis:delete` permissions.

---

### 2. PHI Stored in Plaintext (CRITICAL)

**Threat:** Database compromise exposes PHI in plaintext.

**Attack Path:**
1. Attacker gains read access to PostgreSQL database (SQL injection, credential theft, backup exposure)
2. PHI fields (`diagnosis`, `icd10Code`, `notes`) are stored unencrypted
3. Attacker reads all diagnosis records in plaintext

**Affected Controls:** §164.312(a)(2)(iv) — Encryption and Decryption

**Likelihood:** Medium (requires database access)  
**Impact:** Critical (full PHI exposure)

**Mitigation:** Wrap all PHI fields with `encryptAtRest()` from [`src/lib/phi-crypto.ts`](../../../src/lib/phi-crypto.ts) before writing to the database. Implement key rotation and hardware security module (HSM) key storage.

---

### 3. Single-Factor Authentication Bypass (CRITICAL)

**Threat:** Stolen JWT tokens grant full PHI access without second factor.

**Attack Path:**
1. Attacker steals JWT token (XSS, session hijacking, token leakage in logs)
2. Attacker replays token in `Authorization: Bearer` header
3. No MFA gate validates second factor
4. Attacker gains full access to diagnosis creation and PHI writes

**Affected Controls:** §164.312(d) — Person or Entity Authentication

**Likelihood:** High (JWT tokens are bearer tokens with no binding)  
**Impact:** Critical (full PHI write access)

**Mitigation:** Gate all PHI-bearing endpoints behind multi-factor authentication (TOTP, WebAuthn). Verify the user has completed a second authentication factor within the last session window before granting access.

---

### 4. PHI Transmitted Over Unencrypted Channel (CRITICAL)

**Threat:** Man-in-the-middle (MITM) attacker intercepts PHI in transit.

**Attack Path:**
1. Diagnosis route handler at line 58 transmits PHI to `http://insurance-partner.example/api/verify`
2. Attacker performs MITM attack on unencrypted HTTP connection
3. Attacker intercepts `diagnosisId` and `mrn` (Medical Record Number) in plaintext
4. Attacker exfiltrates PHI or tampers with insurance verification response

**Affected Controls:** §164.312(e)(1) — Transmission Security

**Likelihood:** High (plain HTTP is trivially intercepted)  
**Impact:** Critical (PHI interception and tampering)

**Mitigation:** Replace `http://` with `https://` and pin the partner certificate. Implement mutual TLS (mTLS) for partner API authentication. Never transmit PHI over unencrypted channels.

---

### 5. PHI Deletion Without Retention (HIGH)

**Threat:** Premature deletion of PHI violates retention requirements and audit trail integrity.

**Attack Path:**
1. Attacker (or authorized user) calls `DELETE /:id` endpoint
2. Route handler performs hard delete via `prisma.diagnosis.delete()`
3. PHI record is permanently removed from database
4. No audit trail or retention policy enforced
5. Covered entity violates HIPAA retention requirements (6 years from creation or last use)

**Affected Controls:** §164.312(c)(1) — Integrity

**Likelihood:** Medium (requires authenticated access)  
**Impact:** High (regulatory violation, loss of audit trail)

**Mitigation:** Replace hard delete with soft-delete column (`deletedAt`). Implement retention policy that archives records for the required period (6 years) before permanent deletion. Maintain audit log of all deletion events.

---

## Risk Summary

| Threat | Likelihood | Impact | Risk Score |
|--------|-----------|--------|------------|
| Unauthorized PHI Access | High | Critical | **CRITICAL** |
| PHI Stored in Plaintext | Medium | Critical | **CRITICAL** |
| Single-Factor Auth Bypass | High | Critical | **CRITICAL** |
| PHI Transmitted Over HTTP | High | Critical | **CRITICAL** |
| PHI Deletion Without Retention | Medium | High | **HIGH** |

**Overall Risk Rating:** CRITICAL

**Recommendation:** DO NOT MERGE until all CRITICAL threats are mitigated.