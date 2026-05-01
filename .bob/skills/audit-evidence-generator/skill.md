---
name: audit-evidence-generator
description: >
  Orchestrate the full BobGuard evidence pipeline for a single PR: scan the diff, map controls,
  trace the ePHI data flow, write the threat-model delta, capture test evidence, render the
  auditor PDF, and register the PR with watsonx.governance. Activate when the Compliance
  Officer mode has identified a diff that needs an evidence pack.
inputs:
  - pr_number: integer
  - diff: unified diff text
  - repo_metadata: { repo_name, branch, commit_sha, author }
outputs:
  - compliance/evidence/PR-{n}/control-map.md
  - compliance/evidence/PR-{n}/data-flow.mmd  (and rendered .png)
  - compliance/evidence/PR-{n}/threat-delta.md
  - compliance/evidence/PR-{n}/test-evidence.json
  - compliance/evidence/PR-{n}/audit-pack.pdf
  - watsonx.governance entry id
---

# audit-evidence-generator

## Pipeline (run in order, halt if any step fails)

### Step 1 — Control mapping
Activate the `control-mapper` skill with `{ diff, lang }`. Capture the returned JSON list as `triggered_controls`.

### Step 2 — Data flow
Activate the `data-flow-tracer` skill with `{ diff, files_touched }`. It writes `data-flow.mmd` and renders `data-flow.png`.

### Step 3 — Threat model delta
Generate `threat-delta.md` describing:
- New attack surface introduced by this PR (one paragraph)
- Existing safeguards relevant (bullet list, reference control_ids)
- Residual risk after the proposed fixes are applied (one paragraph)

Use watsonx.ai (`bob-guard.governance.register_pr` env vars) for the prose. Cap each paragraph at 4 sentences. Auditor tone — never reference "AI" or "Bob."

### Step 4 — Test evidence
Run the relevant safeguard tests (`npm test -- --grep="phi|audit|tls"`) and capture results to `test-evidence.json`:
```json
{
  "phi_encryption_roundtrip": { "status": "pass", "duration_ms": 14 },
  "audit_log_emission": { "status": "pass", "duration_ms": 8 },
  "tls_enforcement": { "status": "pass", "duration_ms": 22 }
}
```
If a test is missing, write `"status": "missing"` and surface that in the threat-delta as residual risk.

### Step 5 — NPRM forward-compat check
Activate the `nprm-forward-compat-check` skill with `triggered_controls`. Capture the narrative blocks for inclusion in the PDF.

### Step 6 — Render the auditor PDF
Call `bob-guard.evidence.render_pdf({ pr_number, repo_metadata, triggered_controls, control_map_md, threat_delta_md, test_evidence_json, nprm_narrative })`. The MCP renders `audit-pack.pdf` via Puppeteer.

### Step 7 — Register with watsonx.governance
Call `bob-guard.governance.register_pr({ pr_number, controls: triggered_controls, status: 'reviewed', evidence_path: 'compliance/evidence/PR-{n}/audit-pack.pdf' })`. Capture the entry ID; include it in the PDF sign-off block.

### Step 8 — Open follow-up PR
Use `github.create_pull_request` to open `compliance/evidence/PR-{n}` containing the artifacts. PR title: "BobGuard evidence pack — PR-{n}". PR body links to the audit-pack.pdf and lists triggered controls.

## Failure handling

- If `bob-guard.controls.scan` returns empty, halt. PR is clean — output `compliance/evidence/PR-{n}/clean.md` with a one-line "no controls triggered."
- If watsonx.governance API call fails, fall back to a local file at `compliance/evidence/PR-{n}/governance-mock.json` and note the fallback in the PDF (per `.bob/rules.md` honesty discipline). Do not pretend the live call succeeded.
- If PDF rendering fails, commit the source markdown artifacts and note the rendering failure. The judges can see the substance even without the PDF.

## Quality gates before declaring done

- [ ] All 5 evidence files exist in `compliance/evidence/PR-{n}/`.
- [ ] PDF renders to ≥2 pages.
- [ ] Threat-delta and exec summary do not mention "Bob" or "AI."
- [ ] Forward-compat callout appears on cover page if any NPRM-affected controls triggered.
- [ ] Bob session export saved to `bob_sessions/`.
