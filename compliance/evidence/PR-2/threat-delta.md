# Threat Model Delta — PR-2

**Branch:** feat/add-diagnosis-field  
**Change Summary:** Added new `Diagnosis` model to Prisma schema with unencrypted PHI fields

---

## New Attack Surfaces

### 1. Database Breach — Unencrypted Diagnosis Data

**Threat:** An attacker who gains read access to the PostgreSQL database can directly read diagnosis information, ICD-10 codes, and clinical notes in plaintext.

**Affected Assets:**
- `Diagnosis.diagnosis` (String) — Medical diagnosis text
- `Diagnosis.icd10Code` (String) — ICD-10 diagnostic codes
- `Diagnosis.notes` (String?) — Clinical notes

**STRIDE Classification:** Information Disclosure (I)

**Likelihood:** Medium (database breaches are common attack vectors)

**Impact:** Critical (direct exposure of ePHI)

**HIPAA Control Violated:** §164.312(a)(2)(iv) — Encryption and Decryption

**Mitigation Required:** Encrypt all three fields using `encryptAtRest()` from [`lib/phi-crypto.ts`](src/lib/phi-crypto.ts) before merge.

---

### 2. Backup Exposure

**Threat:** Database backups, snapshots, or replicas will contain unencrypted diagnosis data. If backup media is lost, stolen, or improperly disposed of, ePHI is exposed.

**Affected Assets:**
- PostgreSQL backups (pg_dump, WAL archives)
- Cloud provider snapshots (RDS, managed PostgreSQL)
- Disaster recovery replicas

**STRIDE Classification:** Information Disclosure (I)

**Likelihood:** Medium (backup media is often less secured than production systems)

**Impact:** Critical (ePHI exposure persists indefinitely in backups)

**HIPAA Control Violated:** §164.312(a)(2)(iv) — Encryption and Decryption

**Mitigation Required:** Encrypt fields at application layer before data reaches database.

---

### 3. Insider Threat — DBA Access

**Threat:** Database administrators with direct SQL access can query diagnosis data in plaintext, bypassing application-layer audit logging.

**Affected Assets:**
- All `Diagnosis` table rows
- Historical data in audit tables (if diagnosis data is logged)

**STRIDE Classification:** Information Disclosure (I), Repudiation (R)

**Likelihood:** Low (requires malicious or negligent insider)

**Impact:** High (ePHI exposure + audit trail bypass)

**HIPAA Control Violated:** §164.312(a)(2)(iv) — Encryption and Decryption

**Mitigation Required:** Application-layer encryption ensures DBAs cannot read ePHI even with direct database access.

---

## Threat Model Changes Summary

| Threat | Before PR | After PR | Delta |
|--------|-----------|----------|-------|
| Database breach exposes ePHI | Patient/Encounter fields encrypted | Diagnosis fields unencrypted | ⚠️ **Increased Risk** |
| Backup media exposure | Encrypted ePHI in backups | Plaintext diagnosis data in backups | ⚠️ **Increased Risk** |
| Insider DBA access | Cannot read encrypted fields | Can read diagnosis plaintext | ⚠️ **Increased Risk** |

---

## Residual Risk Assessment

**Current State:** This PR introduces **3 new critical-severity threats** that violate HIPAA §164.312(a)(2)(iv).

**Required Remediation:** All `Diagnosis` model fields containing ePHI must be encrypted at rest before merge.

**Post-Remediation Risk:** After encryption is applied, residual risk returns to baseline (same as existing Patient/Encounter models).