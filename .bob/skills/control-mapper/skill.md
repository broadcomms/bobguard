---
name: control-mapper
description: >
  Scan a code diff for HIPAA Security Rule violations and produce a control-mapping markdown
  table. Activate when a diff has been produced and needs auditor-grade control mapping.
inputs:
  - diff: Unified diff text (from `git diff main...HEAD`)
  - lang: Optional language hint, default "ts"
outputs:
  - markdown table at compliance/evidence/PR-{n}/control-map.md
  - JSON list of triggered controls (for downstream skills)
---

# control-mapper

## Procedure

1. Call `bob-guard.controls.scan({ diff, lang })`. The MCP returns:
   ```ts
   [{ control_id, control_name, family, file, line, snippet, severity, code_pattern_comment }]
   ```
2. For each result, also call `bob-guard.controls.lookup(control_id)` to get the full control object including the existing-rule status (Required vs. Addressable) and `bobguard.nprm_2024_status`.
3. Render a markdown table with columns:
   `Control ID` · `Control Name` · `Family` · `File:Line` · `Severity` · `Existing Rule Status` · `2024 NPRM Status`
4. Sort: `severity: block` rows first (⌐ before ⚠), then by `control_id` ascending.
5. Write the table to `compliance/evidence/PR-{n}/control-map.md` with a one-paragraph header.

## Output template

```markdown
# Control Mapping — PR-{n}

This pull request triggers {N} HIPAA Security Rule controls ({K} blocking, {W} warnings).

| Control | Name | Family | File:Line | Severity | Existing Rule | 2024 NPRM |
|---|---|---|---|---|---|---|
| §164.312(a)(2)(iv) | Encryption and Decryption | Technical | src/patient.routes.ts:47 | ❌ block | Addressable | Would become required |
| §164.312(b) | Audit Controls | Technical | src/patient.routes.ts:62 | ❌ block | Required | Required (clarified) |
| §164.312(a)(2)(iii) | Automatic Logoff | Technical | src/auth/session.ts:12 | ⚠ warn | Addressable | Would become required |

Source: AuditGuardX HIPAA Catalog v1.0 (98 controls), extended for BobGuard with code patterns and refusal templates. NPRM status from compliance/controls/hipaa-2024-nprm-overlay.json (HHS OCR, RIN 0945-AA22, Jan. 6, 2025).
```

## Notes

- Use `❌` for block, `⚠` for warn. (No emoji variation selectors.)
- "Existing Rule" column reads from `hipaa.json` control_name parenthetical: "(Required)" → "Required", "(Addressable)" → "Addressable", neither → "Required" (standard-level).
- "2024 NPRM" column reads `bobguard.nprm_2024_status` and humanizes:
  - `would_become_required` → "Would become required"
  - `would_explicitly_require_MFA` → "Would explicitly require MFA"
  - `remains_required` → "Required (unchanged)"
  - `remains_required_with_clarification` → "Required (clarified)"
- Output is committed to the repo. It is read by the `audit-evidence-generator` and the auditor PDF template.
