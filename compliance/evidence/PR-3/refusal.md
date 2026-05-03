# BobGuard Compliance Review — PR-3

**Branch:** `feat/add-diagnosis-routes`  
**Commit:** `64912840dcd1b0dc843a9b9a550e794ff00f6bda`  
**Author:** patrick@broadcomms.net  
**Date:** 2026-05-03T04:00:00Z

---

## Summary

This PR triggers **7 blocking** and **1 warning** HIPAA Security Rule violations. The changes MUST NOT be merged until all blocking controls are remediated.

---

## Blocking Violations

### ❌ HIPAA §164.312(a)(1) — Access Control (Required)

**File:** [`src/routes/diagnosis.routes.ts:28`](../../../src/routes/diagnosis.routes.ts#L28)

Direct ORM access to PHI without RBAC check. The route handler at line 28 exposes `prisma.diagnosis.findMany()` without any authentication or authorization middleware. This violates the required Access Control standard.

**Proposed fix:** Wrap all route handlers with `requireAuth` middleware from [`src/middleware/auth.middleware.ts`](../../../src/middleware/auth.middleware.ts). Verify the authenticated user has the `diagnosis:read` permission before executing the query.

**Forward-compat:** Under the 2024 HIPAA Security Rule NPRM (HHS OCR, RIN 0945-AA22, Jan. 6, 2025, Preamble II.F.), this control is proposed to add an explicit implementation specification for network segmentation to limit lateral movement. BobGuard already enforces the stricter standard by requiring RBAC checks on all PHI access paths.

---

### ❌ HIPAA §164.312(a)(1) — Access Control (Required)

**File:** [`src/routes/diagnosis.routes.ts:35`](../../../src/routes/diagnosis.routes.ts#L35)

Direct ORM access to PHI without RBAC check. The route handler at line 35 exposes `prisma.diagnosis.create()` without any authentication or authorization middleware. This violates the required Access Control standard.

**Proposed fix:** Wrap all route handlers with `requireAuth` middleware from [`src/middleware/auth.middleware.ts`](../../../src/middleware/auth.middleware.ts). Verify the authenticated user has the `diagnosis:write` permission before executing the query.

**Forward-compat:** Under the 2024 HIPAA Security Rule NPRM (HHS OCR, RIN 0945-AA22, Jan. 6, 2025, Preamble II.F.), this control is proposed to add an explicit implementation specification for network segmentation to limit lateral movement. BobGuard already enforces the stricter standard by requiring RBAC checks on all PHI access paths.

---

### ❌ HIPAA §164.312(a)(1) — Access Control (Required)

**File:** [`src/routes/diagnosis.routes.ts:51`](../../../src/routes/diagnosis.routes.ts#L51)

Direct ORM access to PHI without RBAC check. The route handler at line 51 exposes `prisma.diagnosis.delete()` without any authentication or authorization middleware. This violates the required Access Control standard.

**Proposed fix:** Wrap all route handlers with `requireAuth` middleware from [`src/middleware/auth.middleware.ts`](../../../src/middleware/auth.middleware.ts). Verify the authenticated user has the `diagnosis:delete` permission before executing the query.

**Forward-compat:** Under the 2024 HIPAA Security Rule NPRM (HHS OCR, RIN 0945-AA22, Jan. 6, 2025, Preamble II.F.), this control is proposed to add an explicit implementation specification for network segmentation to limit lateral movement. BobGuard already enforces the stricter standard by requiring RBAC checks on all PHI access paths.

---

### ❌ HIPAA §164.312(a)(2)(iv) — Encryption and Decryption (Addressable)

**File:** [`src/routes/diagnosis.routes.ts:38`](../../../src/routes/diagnosis.routes.ts#L38)

ORM write of PHI without encryption helper. The route handler at line 38 writes PHI fields (`diagnosis`, `icd10Code`, `notes`) directly to the database without using the `encryptAtRest()` helper from [`src/lib/phi-crypto.ts`](../../../src/lib/phi-crypto.ts). This violates the addressable Encryption and Decryption implementation specification.

**Proposed fix:** Wrap all PHI fields with `encryptAtRest()` before passing to `prisma.diagnosis.create()`. Example:

```typescript
const created = await prisma.diagnosis.create({
  data: {
    patientId: req.body.patientId,
    diagnosis: encryptAtRest(req.body.diagnosis),
    icd10Code: encryptAtRest(req.body.icd10Code),
    notes: encryptAtRest(req.body.notes),
  },
});
```

**Forward-compat:** Under the 2024 HIPAA Security Rule NPRM (HHS OCR, RIN 0945-AA22, Jan. 6, 2025, Preamble II.B.), the NPRM proposes to remove the distinction between addressable and required implementation specifications. Most existing addressable specifications would become required. BobGuard already enforces the stricter standard by treating this control as required.

---

### ❌ HIPAA §164.312(d) — Person or Entity Authentication (Required)

**File:** [`src/routes/diagnosis.routes.ts:37`](../../../src/routes/diagnosis.routes.ts#L37)

JWT verification without MFA gate. The route handler at line 37 verifies a JWT token but does not enforce multi-factor authentication. This violates the required Person or Entity Authentication standard.

**Proposed fix:** Gate the verified JWT behind an MFA factor (TOTP / WebAuthn). Verify the user has completed a second authentication factor within the last session window before granting access to PHI.

**Forward-compat:** Under the 2024 HIPAA Security Rule NPRM (HHS OCR, RIN 0945-AA22, Jan. 6, 2025, Preamble II.B.10–11), the NPRM proposes to add an explicit MFA requirement and a defined term for 'Multi-factor Authentication.' BobGuard already enforces the stricter standard by flagging single-factor authentication on ePHI-bearing systems with `severity: block`.

---

### ❌ HIPAA §164.312(e)(1) — Transmission Security (Required)

**File:** [`src/routes/diagnosis.routes.ts:58`](../../../src/routes/diagnosis.routes.ts#L58)

Plain HTTP fetch outbound. The route handler at line 58 transmits PHI over plain HTTP to `http://insurance-partner.example/api/verify`. This violates the required Transmission Security standard.

**Proposed fix:** Replace `http://` with `https://` and pin the partner certificate. Never transmit PHI over unencrypted channels.

```typescript
const response = await fetch('https://insurance-partner.example/api/verify', {
  method: 'POST',
  body: JSON.stringify({ diagnosisId: req.params.id, mrn: req.body.mrn }),
});
```

---

### ❌ HIPAA §164.312(e)(1) — Transmission Security (Required)

**File:** [`src/routes/diagnosis.routes.ts:58`](../../../src/routes/diagnosis.routes.ts#L58)

Outbound URL — verify HTTPS and not bare HTTP. The route handler at line 58 transmits PHI over plain HTTP to `http://insurance-partner.example/api/verify`. This violates the required Transmission Security standard.

**Proposed fix:** Replace `http://` with `https://` and pin the partner certificate. Never transmit PHI over unencrypted channels.

```typescript
const response = await fetch('https://insurance-partner.example/api/verify', {
  method: 'POST',
  body: JSON.stringify({ diagnosisId: req.params.id, mrn: req.body.mrn }),
});
```

---

## Warning Violations

### ⚠️ HIPAA §164.312(c)(1) — Integrity (Required)

**File:** [`src/routes/diagnosis.routes.ts:52`](../../../src/routes/diagnosis.routes.ts#L52)

Hard delete of records — review for ePHI. The route handler at line 52 performs a hard delete of a diagnosis record. If this record contains ePHI, it violates the required Integrity standard's retention requirements.

**Proposed fix:** Replace hard delete with a soft-delete column (`deletedAt`) and implement a retention policy that archives records for the required period before permanent deletion.

---

## Trust is built by saying no.

This PR MUST NOT be merged until all blocking violations are remediated. The evidence pack is available at [`compliance/evidence/PR-3/audit-pack.pdf`](./audit-pack.pdf).