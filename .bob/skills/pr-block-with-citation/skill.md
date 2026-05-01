---
name: pr-block-with-citation
description: >
  Produce the deterministic PR refusal message when a code change violates a HIPAA Security Rule
  control. Output uses the exact template from .bob/rules.md Section 1. Activate when a
  control violation has been identified and a refusal needs to be written.
inputs:
  - control_id: HIPAA section number, e.g. "164.312(a)(2)(iv)"
  - finding: One-sentence factual description of what triggered the control
  - file: Path of the offending file
  - line: Line number (or range)
  - fix_description: One-sentence description of the proposed fix
  - nprm_2024_status: Optional. From the control's bobguard.nprm_2024_status field
---

# pr-block-with-citation

This skill is the **variance reduction layer**. The refusal language MUST be byte-identical across runs. Do not paraphrase. Do not soften. Do not embellish.

## Output template (use exactly)

```
❌ HIPAA §{control_id} — {finding}. Trust is built by saying no.

Proposed fix: {fix_description}.
```

If the input includes `nprm_2024_status` and its value is one of `would_become_required`, `would_explicitly_require_MFA`, `would_clarify_*`, append a blank line and:

```
Forward-compat: under the 2024 HIPAA Security Rule NPRM (HHS OCR, RIN 0945-AA22, Jan. 6, 2025), this control is proposed to move from addressable to required. BobGuard already enforces the stricter standard.
```

If the control's existing status (from `hipaa.json`) is `Required`, do NOT append the NPRM note unless its NPRM change is one of the listed values.

## Severity-to-emoji mapping

- `severity: block` → `❌`
- `severity: warn` → `⚠️`

## Forbidden language

- "This looks like it might be a violation"
- "You may want to consider"
- "I'm not sure but"
- Any apology or hedge before the citation

## Allowed embellishments

None. The phrase **"Trust is built by saying no"** is part of the template — it is the demo-line tie-in to Marcus Biel's keynote (Session 04). Do not vary it.

## Examples

### Example 1 — block, addressable→required (NPRM appended)

```
❌ HIPAA §164.312(a)(2)(iv) — patient.dob is ePHI stored unencrypted at rest in src/patient.routes.ts:47. Trust is built by saying no.

Proposed fix: wrap with `encryptAtRest()` from lib/phi-crypto.ts.

Forward-compat: under the 2024 HIPAA Security Rule NPRM (HHS OCR, RIN 0945-AA22, Jan. 6, 2025), this control is proposed to move from addressable to required. BobGuard already enforces the stricter standard.
```

### Example 2 — block, Required (no NPRM note)

```
❌ HIPAA §164.312(b) — PHI route GET /patients/:id at src/patient.routes.ts:62 does not emit an audit event. Trust is built by saying no.

Proposed fix: invoke `audit.log({ actor, action: 'patient.read', resource: id, outcome: 'success' })` before returning.
```

### Example 3 — warn

```
⚠️ HIPAA §164.312(a)(2)(iii) — session at src/auth/session.ts:12 lacks an inactivity-based logoff.

Proposed fix: set `maxAge` ≤ 15 minutes for ePHI-handling sessions.
```
