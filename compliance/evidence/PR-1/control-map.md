# HIPAA Control Mapping - PR #1

| Control ID | Control Name | Family | Status | Severity | File | Line | Finding |
|------------|--------------|--------|--------|----------|------|------|---------|
| §164.312(a)(2)(iv) | Encryption and Decryption | Technical Safeguards | Addressable → Required (NPRM) | block | src/prisma/schema.prisma | 26 | Unencrypted PHI field `dob` |
| §164.312(a)(2)(iv) | Encryption and Decryption | Technical Safeguards | Addressable → Required (NPRM) | block | src/prisma/schema.prisma | 27 | Unencrypted PHI field `mrn` |
| §164.312(a)(2)(iv) | Encryption and Decryption | Technical Safeguards | Addressable → Required (NPRM) | block | src/prisma/schema.prisma | 28 | Unencrypted PHI field `ssn` |
| §164.312(a)(2)(iv) | Encryption and Decryption | Technical Safeguards | Addressable → Required (NPRM) | block | src/prisma/schema.prisma | 40 | Unencrypted PHI field `notes` |
| §164.312(b) | Audit Controls | Technical Safeguards | Required | block | src/routes/patient.routes.ts | 31 | Missing audit log (POST /patients) |
| §164.312(b) | Audit Controls | Technical Safeguards | Required | block | src/routes/patient.routes.ts | 74 | Missing audit log (GET /patients/:id) |
| §164.312(b) | Audit Controls | Technical Safeguards | Required | block | src/routes/patient.routes.ts | 103 | Missing audit log (GET /patients) |
| §164.312(b) | Audit Controls | Technical Safeguards | Required | block | src/routes/patient.routes.ts | 142 | Missing audit log (PUT /patients/:id) |
| §164.312(b) | Audit Controls | Technical Safeguards | Required | block | src/routes/patient.routes.ts | 190 | Missing audit log (DELETE /patients/:id) |
| §164.312(d) | Person or Entity Authentication | Technical Safeguards | Required + MFA (NPRM) | block | src/middleware/auth.middleware.ts | 43 | Single-factor JWT auth, no MFA |
| §164.312(e)(1) | Transmission Security | Technical Safeguards | Required | block | src/routes/message.routes.ts | 31 | No TLS enforcement on webhook |
| §164.312(c)(1) | Integrity | Technical Safeguards | Required | warn | src/routes/patient.routes.ts | 204 | Hard delete of patient records |

## Summary

- **Total Findings**: 12
- **Blocking Violations**: 11
- **Warnings**: 1
- **Unique Controls**: 5
- **NPRM-Affected Controls**: 2 (§164.312(a)(2)(iv), §164.312(d))

## Control Families

- **Technical Safeguards**: 5 controls (100%)

## Remediation Status

- [ ] §164.312(a)(2)(iv) - Encrypt PHI fields (4 findings)
- [ ] §164.312(b) - Add audit logging (5 findings)
- [ ] §164.312(d) - Implement MFA (1 finding)
- [ ] §164.312(e)(1) - Enforce TLS (1 finding)
- [ ] §164.312(c)(1) - Consider soft-delete (1 warning)