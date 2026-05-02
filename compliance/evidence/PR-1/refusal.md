# HIPAA Compliance Audit - PR #1 Refusal

**Status**: ❌ BLOCKED  
**Date**: 2026-05-02  
**Auditor**: BobGuard Compliance Officer  
**Commit Range**: 129bb2f..439ece9

---

## Executive Summary

This pull request introduces **11 blocking violations** and **1 warning** across 5 HIPAA Security Rule controls. The changes MUST be rejected until all blocking violations are remediated.

**Blocking Controls Violated:**
- §164.312(a)(2)(iv) - Encryption and Decryption (4 findings)
- §164.312(b) - Audit Controls (5 findings)
- §164.312(d) - Person or Entity Authentication (1 finding)
- §164.312(e)(1) - Transmission Security (1 finding)

**Warning:**
- §164.312(c)(1) - Integrity (1 finding)

---

## Blocking Violations

### 1. §164.312(a)(2)(iv) - Encryption and Decryption (Addressable)

**Finding 1**: Unencrypted PHI field `dob` at [`src/prisma/schema.prisma:26`](src/prisma/schema.prisma:26)

❌ HIPAA §164.312(a)(2)(iv) — `dob` is ePHI stored unencrypted at rest in src/prisma/schema.prisma:26. Trust is built by saying no.

**Proposed fix**: Wrap with `encryptAtRest()` from `lib/phi-crypto.ts`.

**Forward-compat**: Under the 2024 HIPAA Security Rule NPRM (HHS OCR, RIN 0945-AA22, Jan. 6, 2025), this control is proposed to move from addressable to required. BobGuard already enforces the stricter standard.

---

**Finding 2**: Unencrypted PHI field `mrn` at [`src/prisma/schema.prisma:27`](src/prisma/schema.prisma:27)

❌ HIPAA §164.312(a)(2)(iv) — `mrn` is ePHI stored unencrypted at rest in src/prisma/schema.prisma:27. Trust is built by saying no.

**Proposed fix**: Wrap with `encryptAtRest()` from `lib/phi-crypto.ts`.

**Forward-compat**: Under the 2024 HIPAA Security Rule NPRM (HHS OCR, RIN 0945-AA22, Jan. 6, 2025), this control is proposed to move from addressable to required. BobGuard already enforces the stricter standard.

---

**Finding 3**: Unencrypted PHI field `ssn` at [`src/prisma/schema.prisma:28`](src/prisma/schema.prisma:28)

❌ HIPAA §164.312(a)(2)(iv) — `ssn` is ePHI stored unencrypted at rest in src/prisma/schema.prisma:28. Trust is built by saying no.

**Proposed fix**: Wrap with `encryptAtRest()` from `lib/phi-crypto.ts`.

**Forward-compat**: Under the 2024 HIPAA Security Rule NPRM (HHS OCR, RIN 0945-AA22, Jan. 6, 2025), this control is proposed to move from addressable to required. BobGuard already enforces the stricter standard.

---

**Finding 4**: Unencrypted PHI field `notes` at [`src/prisma/schema.prisma:40`](src/prisma/schema.prisma:40)

❌ HIPAA §164.312(a)(2)(iv) — `notes` is ePHI stored unencrypted at rest in src/prisma/schema.prisma:40. Trust is built by saying no.

**Proposed fix**: Wrap with `encryptAtRest()` from `lib/phi-crypto.ts`.

**Forward-compat**: Under the 2024 HIPAA Security Rule NPRM (HHS OCR, RIN 0945-AA22, Jan. 6, 2025), this control is proposed to move from addressable to required. BobGuard already enforces the stricter standard.

---

### 2. §164.312(b) - Audit Controls

**Finding 5**: Missing audit log at [`src/routes/patient.routes.ts:31`](src/routes/patient.routes.ts:31)

❌ HIPAA §164.312(b) — PHI route at src/routes/patient.routes.ts:31 does not emit an audit event. Trust is built by saying no.

**Proposed fix**: Invoke `audit.log({ actor, action, resource, outcome })` before returning.

---

**Finding 6**: Missing audit log at [`src/routes/patient.routes.ts:74`](src/routes/patient.routes.ts:74)

❌ HIPAA §164.312(b) — PHI route at src/routes/patient.routes.ts:74 does not emit an audit event. Trust is built by saying no.

**Proposed fix**: Invoke `audit.log({ actor, action, resource, outcome })` before returning.

---

**Finding 7**: Missing audit log at [`src/routes/patient.routes.ts:103`](src/routes/patient.routes.ts:103)

❌ HIPAA §164.312(b) — PHI route at src/routes/patient.routes.ts:103 does not emit an audit event. Trust is built by saying no.

**Proposed fix**: Invoke `audit.log({ actor, action, resource, outcome })` before returning.

---

**Finding 8**: Missing audit log at [`src/routes/patient.routes.ts:142`](src/routes/patient.routes.ts:142)

❌ HIPAA §164.312(b) — PHI route at src/routes/patient.routes.ts:142 does not emit an audit event. Trust is built by saying no.

**Proposed fix**: Invoke `audit.log({ actor, action, resource, outcome })` before returning.

---

**Finding 9**: Missing audit log at [`src/routes/patient.routes.ts:190`](src/routes/patient.routes.ts:190)

❌ HIPAA §164.312(b) — PHI route at src/routes/patient.routes.ts:190 does not emit an audit event. Trust is built by saying no.

**Proposed fix**: Invoke `audit.log({ actor, action, resource, outcome })` before returning.

---

### 3. §164.312(d) - Person or Entity Authentication

**Finding 10**: Single-factor authentication at [`src/middleware/auth.middleware.ts:43`](src/middleware/auth.middleware.ts:43)

❌ HIPAA §164.312(d) — Authentication at src/middleware/auth.middleware.ts:43 is single-factor for an ePHI-bearing system. Trust is built by saying no.

**Proposed fix**: Gate with TOTP/WebAuthn MFA.

**Forward-compat**: The 2024 NPRM proposes explicit MFA requirement; BobGuard enforces it now.

---

### 4. §164.312(e)(1) - Transmission Security

**Finding 11**: No TLS enforcement at [`src/routes/message.routes.ts:31`](src/routes/message.routes.ts:31)

❌ HIPAA §164.312(e)(1) — ePHI transmitted over plain HTTP at src/routes/message.routes.ts:31. Trust is built by saying no.

**Proposed fix**: Enforce HTTPS/TLS 1.2+ on this transport.

---

## Warnings

### 5. §164.312(c)(1) - Integrity

**Finding 12**: Hard delete at [`src/routes/patient.routes.ts:204`](src/routes/patient.routes.ts:204)

⚠️ HIPAA §164.312(c)(1) — Hard-delete on src/routes/patient.routes.ts:204 risks ePHI integrity.

**Proposed fix**: Switch to soft-delete with tombstone + integrity hash.

---

## Remediation Requirements

Before this PR can be approved:

1. **Encrypt all PHI fields** (dob, mrn, ssn, notes) using [`phi-crypto.encryptAtRest()`](src/lib/phi-crypto.ts)
2. **Add audit logging** to all 5 patient routes using [`audit.log()`](src/lib/audit.ts)
3. **Implement MFA** in [`auth.middleware.ts`](src/middleware/auth.middleware.ts) after JWT verification
4. **Enforce TLS** in [`message.routes.ts`](src/routes/message.routes.ts) webhook endpoint
5. **Consider soft-delete** pattern for patient records (warning, not blocking)

---

## NPRM Forward-Compatibility Notes

Two controls in this PR are affected by the 2024 HIPAA Security Rule NPRM:

### §164.312(a)(2)(iv) - Encryption and Decryption
- **Current status**: Addressable
- **NPRM proposal**: Would become required (removal of addressable/required distinction)
- **BobGuard action**: Already enforces as required

### §164.312(d) - Person or Entity Authentication
- **Current status**: Required
- **NPRM proposal**: Would add explicit MFA requirement and defined term
- **BobGuard action**: Already flags single-factor auth as blocking violation

---

## Audit Trail

- **Scan tool**: bob-guard.controls.scan v1.0.0
- **Control catalog**: compliance/controls/hipaa-technical-extended.json
- **NPRM overlay**: compliance/controls/hipaa-2024-nprm-overlay.json
- **Evidence pack**: compliance/evidence/PR-1/audit-pack.pdf

---

**This PR is BLOCKED pending remediation of all 11 blocking violations.**