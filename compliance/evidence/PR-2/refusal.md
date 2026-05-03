# HIPAA Compliance Review — PR-2 BLOCKED

**Branch:** feat/add-diagnosis-field  
**Commit:** c845bdf32481bda3dd5a594e9c59da5437d1fc20  
**Author:** patrick@broadcomms.net  
**Scan Date:** 2026-05-03T03:07:30Z

---

## Blocking Violations

This PR triggers **4 blocking** HIPAA Security Rule violations. All must be resolved before merge.

### 1. §164.312(a)(2)(iv) — Unencrypted PHI at Rest (Line 53)

❌ HIPAA §164.312(a)(2)(iv) — `diagnosis` is ePHI stored unencrypted at rest in [`src/prisma/schema.prisma:53`](src/prisma/schema.prisma:53). Trust is built by saying no.

**Proposed fix:** Wrap field with `encryptAtRest()` from [`lib/phi-crypto.ts`](src/lib/phi-crypto.ts).

**Forward-compat:** Under the 2024 HIPAA Security Rule NPRM (HHS OCR, RIN 0945-AA22, Jan. 6, 2025), this control is proposed to move from addressable to required. BobGuard already enforces the stricter standard.

---

### 2. §164.312(a)(2)(iv) — Unencrypted PHI at Rest (Line 55)

❌ HIPAA §164.312(a)(2)(iv) — `diagnosis` is ePHI stored unencrypted at rest in [`src/prisma/schema.prisma:55`](src/prisma/schema.prisma:55). Trust is built by saying no.

**Proposed fix:** Wrap field with `encryptAtRest()` from [`lib/phi-crypto.ts`](src/lib/phi-crypto.ts).

**Forward-compat:** Under the 2024 HIPAA Security Rule NPRM (HHS OCR, RIN 0945-AA22, Jan. 6, 2025), this control is proposed to move from addressable to required. BobGuard already enforces the stricter standard.

---

### 3. §164.312(a)(2)(iv) — Unencrypted PHI at Rest (Line 56)

❌ HIPAA §164.312(a)(2)(iv) — `icd10Code` is ePHI stored unencrypted at rest in [`src/prisma/schema.prisma:56`](src/prisma/schema.prisma:56). Trust is built by saying no.

**Proposed fix:** Wrap field with `encryptAtRest()` from [`lib/phi-crypto.ts`](src/lib/phi-crypto.ts).

**Forward-compat:** Under the 2024 HIPAA Security Rule NPRM (HHS OCR, RIN 0945-AA22, Jan. 6, 2025), this control is proposed to move from addressable to required. BobGuard already enforces the stricter standard.

---

### 4. §164.312(a)(2)(iv) — Unencrypted PHI at Rest (Line 57)

❌ HIPAA §164.312(a)(2)(iv) — `notes` is ePHI stored unencrypted at rest in [`src/prisma/schema.prisma:57`](src/prisma/schema.prisma:57). Trust is built by saying no.

**Proposed fix:** Wrap field with `encryptAtRest()` from [`lib/phi-crypto.ts`](src/lib/phi-crypto.ts).

**Forward-compat:** Under the 2024 HIPAA Security Rule NPRM (HHS OCR, RIN 0945-AA22, Jan. 6, 2025), this control is proposed to move from addressable to required. BobGuard already enforces the stricter standard.

---

## Resolution Required

All 4 violations must be addressed before this PR can be approved. See the audit evidence pack for detailed control mappings, threat analysis, and test evidence.