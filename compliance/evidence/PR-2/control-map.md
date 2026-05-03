# HIPAA Control Mapping — PR-2

**Branch:** feat/add-diagnosis-field  
**Files Changed:** src/prisma/schema.prisma

---

## Triggered Controls

| Control ID | Control Name | Family | Severity | File | Line | Existing Status | NPRM Status |
|------------|--------------|--------|----------|------|------|-----------------|-------------|
| §164.312(a)(2)(iv) | Encryption and Decryption | Technical Safeguards | block | src/prisma/schema.prisma | 53 | addressable | would become required |
| §164.312(a)(2)(iv) | Encryption and Decryption | Technical Safeguards | block | src/prisma/schema.prisma | 55 | addressable | would become required |
| §164.312(a)(2)(iv) | Encryption and Decryption | Technical Safeguards | block | src/prisma/schema.prisma | 56 | addressable | would become required |
| §164.312(a)(2)(iv) | Encryption and Decryption | Technical Safeguards | block | src/prisma/schema.prisma | 57 | addressable | would become required |

---

## Control Details

### §164.312(a)(2)(iv) — Encryption and Decryption (Addressable)

**Description:** Implement a mechanism to encrypt and decrypt electronic protected health information.

**Triggered By:**
- Unencrypted PHI primitive type at rest: `diagnosis` (String)
- Unencrypted PHI primitive type at rest: `icd10Code` (String)
- Unencrypted PHI primitive type at rest: `notes` (String?)

**Required Evidence:**
- Control mapping (this document)
- Encryption key rotation evidence
- Data flow diagram
- Test evidence

**Auditor Questions:**
1. How is ePHI encrypted at rest?
2. What is the key management mechanism (KMS, HSM, app-managed)?
3. How is encryption key rotation evidenced?

**NPRM Forward-Compatibility:**
Under the 2024 HIPAA Security Rule NPRM (HHS OCR, RIN 0945-AA22, Jan. 6, 2025), this control is proposed to move from addressable to required. BobGuard already enforces the stricter standard.

---

## Summary

- **Total Controls Triggered:** 4
- **Blocking:** 4
- **Warnings:** 0
- **Unique Controls:** 1 (§164.312(a)(2)(iv))