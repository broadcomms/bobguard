---
name: nprm-forward-compat-check
description: >
  Augment a list of triggered HIPAA controls with forward-compatibility narratives drawn from
  the 2024 HIPAA Security Rule NPRM (HHS OCR, RIN 0945-AA22). Activate after control-mapper
  has produced triggered_controls and before the auditor PDF is rendered.
inputs:
  - triggered_controls: list returned by control-mapper
outputs:
  - markdown narrative block (for inclusion in the auditor PDF and PR comment)
---

# nprm-forward-compat-check

## What this skill does

The 2024 HIPAA Security Rule NPRM proposes substantive changes to the existing rule (e.g., removal of the addressable/required distinction, explicit MFA requirement, encryption becoming required). This skill produces a narrative explaining how a triggered control is positioned under the proposed rule — so the auditor PDF can show forward-compatibility without overstating what the law currently requires.

## Procedure

1. Call `bob-guard.nprm.forward_compat_check({ triggered_controls })`. The MCP cross-references each control against `compliance/controls/hipaa-2024-nprm-overlay.json` and returns:
   ```ts
   [{
     control_id,
     existing_status: "addressable" | "required",
     nprm_proposal: string,
     bobguard_action: string,
     nprm_reference_section: string
   }]
   ```
2. For each entry, format a narrative paragraph using the template below.
3. Concatenate paragraphs separated by `---` and return as a single markdown block.

## Narrative template (per affected control)

```markdown
**§{control_id} — Forward-compatibility note**

Under the existing HIPAA Security Rule, this control is **{existing_status}**. The 2024 HIPAA Security Rule NPRM (HHS OCR, RIN 0945-AA22, *Federal Register*, Jan. 6, 2025) proposes that {nprm_proposal}.

BobGuard's enforcement of this control already reflects the stricter standard: {bobguard_action}.

A regulated entity adopting BobGuard today is positioned for compliance with the proposed rule's 180-day window after any final-rule effective date.

*Reference: {nprm_reference_section}.*
```

## Important framing rules (from `.bob/rules.md` Section 2)

- Always say "the 2024 NPRM proposes" / "would require." Never assert "HIPAA requires" what is only proposed.
- Always include the full citation: `HHS OCR, RIN 0945-AA22, Federal Register, Jan. 6, 2025`.
- Always end with the "180-day window" line — judges with regulatory awareness recognize the standard compliance period under 45 CFR 160.105.

## Skip cases

- If `triggered_controls` contains nothing that maps to the NPRM overlay, output:
  ```markdown
  *No 2024 NPRM forward-compatibility notes apply to this PR.*
  ```
- Do not invent NPRM references for controls not in the overlay. If in doubt, skip.

## Example output (for a PR triggering §164.312(a)(2)(iv) and §164.312(d))

```markdown
**§164.312(a)(2)(iv) — Forward-compatibility note**

Under the existing HIPAA Security Rule, this control is **addressable**. The 2024 HIPAA Security Rule NPRM (HHS OCR, RIN 0945-AA22, *Federal Register*, Jan. 6, 2025) proposes that encryption of ePHI become **required**, with limited exceptions, eliminating the existing per-entity reasonableness analysis.

BobGuard's enforcement of this control already reflects the stricter standard: encryption-at-rest is treated as `severity: block` regardless of the existing addressable status.

A regulated entity adopting BobGuard today is positioned for compliance with the proposed rule's 180-day window after any final-rule effective date.

*Reference: Preamble, II.B.; §164.312(a)(2)(iv).*

---

**§164.312(d) — Forward-compatibility note**

Under the existing HIPAA Security Rule, this control is **required** at the standard level (Person or Entity Authentication). The 2024 HIPAA Security Rule NPRM proposes to add an **explicit Multi-Factor Authentication requirement** with a new defined term.

BobGuard's enforcement of this control already reflects the stricter standard: single-factor authentication on ePHI-bearing systems is treated as `severity: block`.

A regulated entity adopting BobGuard today is positioned for compliance with the proposed rule's 180-day window after any final-rule effective date.

*Reference: Preamble, II.B.10–11 (Definitions).*
```
