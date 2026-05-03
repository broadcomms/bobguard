# Control Mapping — PR-3

| Control ID | Control Name | Family | File | Line | Severity | Existing Status | NPRM Status |
|------------|--------------|--------|------|------|----------|-----------------|-------------|
| §164.312(a)(1) | Access Control | Technical Safeguards | src/routes/diagnosis.routes.ts | 28 | block | required | required + network segmentation spec |
| §164.312(a)(1) | Access Control | Technical Safeguards | src/routes/diagnosis.routes.ts | 35 | block | required | required + network segmentation spec |
| §164.312(a)(1) | Access Control | Technical Safeguards | src/routes/diagnosis.routes.ts | 51 | block | required | required + network segmentation spec |
| §164.312(a)(2)(iv) | Encryption and Decryption | Technical Safeguards | src/routes/diagnosis.routes.ts | 38 | block | addressable | required (NPRM removes addressable distinction) |
| §164.312(d) | Person or Entity Authentication | Technical Safeguards | src/routes/diagnosis.routes.ts | 37 | block | required | required + explicit MFA requirement |
| §164.312(e)(1) | Transmission Security | Technical Safeguards | src/routes/diagnosis.routes.ts | 58 | block | required | required |
| §164.312(e)(1) | Transmission Security | Technical Safeguards | src/routes/diagnosis.routes.ts | 58 | block | required | required |
| §164.312(c)(1) | Integrity | Technical Safeguards | src/routes/diagnosis.routes.ts | 52 | warn | required | required |

**Total findings:** 8 (7 blocking, 1 warning)

**NPRM forward-compatibility notes:**

- **§164.312(a)(1):** The 2024 NPRM proposes an explicit implementation specification for network segmentation to limit lateral movement. BobGuard already enforces RBAC checks on all PHI access paths.

- **§164.312(a)(2)(iv):** The 2024 NPRM proposes to remove the distinction between addressable and required implementation specifications. Most existing addressable specifications would become required. BobGuard already treats this control as required.

- **§164.312(d):** The 2024 NPRM proposes to add an explicit MFA requirement and a defined term for 'Multi-factor Authentication.' BobGuard already flags single-factor authentication on ePHI-bearing systems with `severity: block`.