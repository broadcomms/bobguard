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

### Step 0 — Persist raw scan output (MANDATORY, before any other artifact)
Call `bob-guard.controls.scan({ diff, lang })` directly. Take the **verbatim text content** of the tool response (the JSON body inside `content[0].text`) and write it byte-for-byte to `compliance/evidence/PR-{n}/scan-raw.json`. Do not reformat. Do not summarize. Do not pretty-print into a different shape. The file MUST contain top-level `findings`, `total`, and `by_severity`.

This artifact is the auditable source of truth. Every later step — including the clean-vs-blocked branch — must read from this file rather than re-deciding from memory. If you skip this step, you cannot produce a valid audit pack; halt and surface the error.

After writing it, decide:
- `total == 0` → continue to Step 1 only to confirm the empty-finding case, then fall through to the **No controls triggered** failure-mode entry (write `clean.md` and stop).
- `total > 0` → continue.

### Step 1 — Control mapping
Activate the `control-mapper` skill with `{ diff, lang }`. Capture the returned JSON list as `triggered_controls`. Cross-check that the `control_id` set matches the one in `scan-raw.json`. If they diverge, halt — `controls.scan` is the authority.

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
**CRITICAL**: You MUST read the Mermaid diagram source and pass it to the PDF renderer.

1. Use `read_file` to load `compliance/evidence/PR-{n}/data-flow.mmd` (written in Step 2) into a variable `data_flow_mmd`.
2. If the file does not exist, fall back to reading `compliance/controls/data-flow-fixture.mmd`.
3. Call `bob-guard.evidence.render_pdf` with ALL parameters including `data_flow_mmd`:
   ```json
   {
     "pr_number": N,
     "repo_metadata": {...},
     "triggered_controls": [...],
     "control_map_md": "...",
     "threat_delta_md": "...",
     "test_evidence_json": {...},
     "nprm_narrative": "...",
     "data_flow_mmd": "<CONTENTS OF THE .mmd FILE>"
   }
   ```
4. The MCP renders `audit-pack.pdf` via Puppeteer and inlines the Mermaid diagram via `mmdc`.
5. Inspect the returned `diagram_used` field — if it is `'placeholder'`, surface the fact in the threat-delta as residual risk; do not pretend the diagram rendered.

**DO NOT** call `evidence.render_pdf` without the `data_flow_mmd` parameter. The diagram will not render if you omit it.

### Step 7 — Register with watsonx.governance
Call `bob-guard.governance.register_pr({ pr_number, controls: triggered_controls, status: 'reviewed', evidence_path: 'compliance/evidence/PR-{n}/audit-pack.pdf' })`. Capture the entry ID; include it in the PDF sign-off block.

**The tool itself writes `compliance/evidence/PR-{n}/governance-register-result.json` to disk** with the full shape (`mode`, `entry_id`, `payload`, `ibm_governance_check`, `timestamp`). Its response to you is intentionally minimal (`{ entry_id, status }`) — that minimal JSON is NOT the file content. **Do NOT call `write_to_file` on `governance-register-result.json`.** Doing so overwrites the tool's real IAM/OpenScale liveness proof with a fabricated stub (this happened on PR-2; see audit-pr.md Hard Rule #6).

Verify the tool's write by reading the file from disk and confirming `ibm_governance_check.iam_authenticated` and `ibm_governance_check.http_status` are present (live mode), or that `mode == "mocked"` (fallback mode).

### Step 8 — Open follow-up PR
Use `github.create_pull_request` to open `compliance/evidence/PR-{n}` containing the artifacts. PR title: "BobGuard evidence pack — PR-{n}". PR body links to the audit-pack.pdf and lists triggered controls.

## Failure handling

- If `scan-raw.json` cannot be written (MCP unavailable, disk error), halt. Do not proceed with any narrative artifact. Surface the underlying tool error verbatim.
- If `scan-raw.json` parses with `total == 0`, halt at the clean-path: write `compliance/evidence/PR-{n}/clean.md` with a one-line "No HIPAA Security Rule controls triggered. PR is compliant." and the matching `pr_number`, `branch`, `commit_sha`, `author` from real `git` output. Do NOT invent any further artifacts.
- If watsonx.governance API call fails, fall back to a local file at `compliance/evidence/PR-{n}/governance-mock.json` and note the fallback in the PDF (per `.bob/rules.md` honesty discipline). Do not pretend the live call succeeded.
- If PDF rendering fails, commit the source markdown artifacts and note the rendering failure. The judges can see the substance even without the PDF.

## Quality gates before declaring done

- [ ] `scan-raw.json` exists and parses with top-level `findings` / `total` / `by_severity`. Was written **before** any narrative file (check via `ls -t`).
- [ ] If `clean.md` exists, `scan-raw.json.total == 0`. If `refusal.md` exists, `scan-raw.json.by_severity.block > 0`. Disagreement = fabrication = audit invalid.
- [ ] All 5 evidence files exist in `compliance/evidence/PR-{n}/` (only `scan-raw.json` + `clean.md` are required when total == 0).
- [ ] PDF renders to ≥2 pages.
- [ ] Threat-delta and exec summary do not mention "Bob" or "AI."
- [ ] Forward-compat callout appears on cover page if any NPRM-affected controls triggered.
- [ ] Bob session export saved to `bob_sessions/`.
