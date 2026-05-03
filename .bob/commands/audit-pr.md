---
name: audit-pr
description: Run BobGuard's full HIPAA compliance audit on the current branch's diff against main.
mode: compliance-officer
---

# /audit-pr

Run the full BobGuard compliance audit pipeline on the diff between the current branch and `main`. This command should only be invoked from inside the `Compliance Officer` mode.

## Hard rules — DO NOT VIOLATE

These rules exist because audit packs may end up in front of regulators. They override convenience.

1. **Do NOT use sample fixtures or simulated diffs.** Every audit MUST run against the live `git diff main...HEAD` output for the current working branch. Fixtures under `mcp/bob-guard/src/tools/__fixtures__/` are for unit tests only; never for `/audit-pr`.
2. **Do NOT handcraft any artifact in `compliance/evidence/PR-{N}/`.** Every file in that directory MUST be the verbatim output of an MCP tool call. If a tool fails, write a real fallback (per the failure modes below) — never a synthetic JSON or markdown the model wrote itself.
3. **Do NOT skip `bob-guard.governance.register_pr`.** Even if you believe the API will be unavailable, you must call the tool and let it perform its own IAM exchange + liveness check. The tool's own fallback to `mode: "mocked"` is honest; a model-written fake entry is not.
4. **Do NOT pre-fill metadata.** `pr_number`, `branch`, `commit_sha`, `author` MUST come from real `git` calls and the GitHub MCP, not from defaults or memory.
5. **Do NOT decide clean-vs-blocked before persisting `scan-raw.json`.** The very first artifact written to `compliance/evidence/PR-{N}/` MUST be `scan-raw.json` — the verbatim text content of the `controls.scan` tool response, byte-for-byte. No reformatting, no summarization. Every downstream artifact (`refusal.md`, `clean.md`, `control-map.md`) must derive its findings list from that file. If `scan-raw.json` and the narrative artifacts disagree, the narrative is wrong by definition. This rule exists because PR-3 was caught with a model-narrated `clean.md` that contradicted the actual scan output.
6. **Some MCP tools own their output files. DO NOT `write_to_file` over them.** Specifically:
   - `bob-guard.governance.register_pr` itself writes `compliance/evidence/PR-{N}/governance-register-result.json` to disk with the full `mode`/`entry_id`/`payload`/`ibm_governance_check`/`timestamp` shape. The tool's response to the model is intentionally minimal (`{ entry_id, status }`) — that is NOT what belongs in the file. Reading the minimal response and then writing your own expanded version overwrites the tool's auditable IAM/OpenScale proof with a fabricated stub. This actually happened on PR-2.
   - `bob-guard.evidence.render_pdf` itself writes `audit-pack.pdf`. Do not overwrite.
   After calling a tool that owns its file, **read the file from disk** to confirm shape — do not write to it.

If any tool errors, surface the error verbatim and follow the failure-mode entry below — do not paper over it.

## Procedure

You are now operating as the Compliance Officer (see `.bob/modes/compliance-officer.yaml`).

### 1. Capture the diff
Run `git diff main...HEAD` and capture the full unified diff. If the branch is `main`, abort with: "Cannot audit `main` against itself. Switch to a feature branch."

### 2. Identify the PR
- If a GitHub PR already exists for the current branch, use its number via `github.list_pull_requests`.
- If no PR exists yet, ask Bob to create a draft PR first via `github.create_pull_request`. Use the next sequential number as `pr_number`.

### 3. Run the audit-evidence-generator skill
Invoke the `audit-evidence-generator` skill with:
```yaml
pr_number: {N}
diff: {captured_diff}
repo_metadata:
  repo_name: {repo}
  branch: {current_branch}
  commit_sha: {HEAD}
  author: {git config user.email}
```

The skill will produce all evidence artifacts in `compliance/evidence/PR-{N}/`.

### 4. Post the PR review
After the evidence pack is generated:
- Compose the PR review body. Format:
  ```
  ## BobGuard Compliance Review

  This PR triggers {K} blocking and {W} warning HIPAA Security Rule controls.

  {refusal blocks from pr-block-with-citation skill, one per blocking control}

  📦 Auditor evidence pack: [audit-pack.pdf]({link to file in repo})
  📋 Control mapping: [control-map.md]({link})
  📊 Data flow: [data-flow.png]({link})
  ⚠️ Threat model delta: [threat-delta.md]({link})
  ✅ Test evidence: [test-evidence.json]({link})

  watsonx.governance entry: `{governance_entry_id}`
  ```
- Call `github.create_pull_request_review({ pr_number: N, body, event: 'REQUEST_CHANGES' })` if any blocking controls. Else `event: 'COMMENT'`.

### 5. Open the evidence-pack PR
Open a follow-up PR `compliance/evidence/PR-{N}` containing the artifacts:
- Source branch: `compliance/evidence/PR-{N}` (create from `main`)
- Title: `BobGuard evidence pack — PR-{N}`
- Body: links to the original PR + summary of triggered controls

### 6. Export Bob session report
Save the full transcript of this `/audit-pr` run to `bob_sessions/audit-pr-PR-{N}.md`. (Hackathon disqualifier rule.) Take a screenshot of the chat sidebar to `bob_sessions/screenshots/audit-pr-PR-{N}.png`.

## Quality gates

The command is complete only when:
- [ ] `compliance/evidence/PR-{N}/scan-raw.json` exists and parses, and was written **before** any narrative artifact. It must contain the keys `findings`, `total`, and `by_severity` (the verbatim shape of `controls.scan` output). If it does not, the audit is invalid.
- [ ] `clean.md` exists if-and-only-if `scan-raw.json` has `total == 0`. `refusal.md` exists if-and-only-if `scan-raw.json` has `by_severity.block > 0`. Any disagreement between `scan-raw.json` and the narrative artifacts means the narrative was fabricated.
- [ ] All 5 evidence files exist in `compliance/evidence/PR-{N}/` (skip when `scan-raw.json.total == 0`; in that case only `scan-raw.json` + `clean.md` are required).
- [ ] `audit-pack.pdf` is ≥2 pages and renders without layout errors.
- [ ] PR review posted on GitHub with `REQUEST_CHANGES` (if blocking) or `COMMENT` (if only warnings).
- [ ] Follow-up PR opened.
- [ ] Bob session exported to `bob_sessions/`.
- [ ] `bob-guard.governance.register_pr` was actually invoked, and the resulting `governance-register-result.json` matches one of the two valid shapes:
  - Live: `{ "mode": "live", "entry_id": "live-...", "ibm_governance_check": {...} }`
  - Mocked: `{ "mode": "mocked", "entry_id": "mock-...", "payload": {...} }`
  Any other shape (e.g. top-level `pr_number`, top-level `status: "mocked"`, free-form `note`) means the file was handcrafted instead of tool-generated — that's a failure, not a pass.

## Failure modes

- **On `main`** → Halt with "Cannot audit `main` against itself. Switch to a feature branch." Do NOT create a demo branch with synthetic violations.
- **No diff** → Halt with "Branch has no changes against main."
- **No controls triggered** → Write `compliance/evidence/PR-{N}/clean.md` with "No HIPAA controls triggered. PR is compliant." Post a `COMMENT` review with the same. Skip steps 5–6.
- **MCP unavailable** → Halt with "bob-guard MCP not running. Run `npm run mcp:dev` and retry."
- **Watsonx.ai unavailable** → The `evidence.render_pdf` tool will already substitute the `[watsonx.ai unavailable — placeholder]` string into the PDF. Do NOT add it to other artifacts manually.
- **GitHub MCP unauthenticated** → Skip steps 4 and 5 (PR review + follow-up PR), continue with everything else. Do NOT invent a PR number — pick the next free integer by inspecting `compliance/evidence/PR-*/` directories.
