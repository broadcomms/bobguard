---
name: audit-pr
description: Run BobGuard's full HIPAA compliance audit on the current branch's diff against main.
mode: compliance-officer
---

# /audit-pr

Run the full BobGuard compliance audit pipeline on the diff between the current branch and `main`. This command should only be invoked from inside the `Compliance Officer` mode.

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
- [ ] All 5 evidence files exist in `compliance/evidence/PR-{N}/`.
- [ ] `audit-pack.pdf` is ≥2 pages and renders without layout errors.
- [ ] PR review posted on GitHub with `REQUEST_CHANGES` (if blocking) or `COMMENT` (if only warnings).
- [ ] Follow-up PR opened.
- [ ] Bob session exported to `bob_sessions/`.
- [ ] watsonx.governance entry registered (or local mock if API unavailable, with fallback documented in the PDF).

## Failure modes

- **No diff** → "Branch has no changes against main." Halt.
- **No controls triggered** → Write `compliance/evidence/PR-{N}/clean.md` with "No HIPAA controls triggered. PR is compliant." Post a `COMMENT` review with the same. Skip steps 5–6.
- **MCP unavailable** → Halt with "bob-guard MCP not running. Run `npm run mcp:dev` and retry."
- **Watsonx.ai unavailable** → Generate evidence with placeholder prose marked `[watsonx.ai unavailable — placeholder]`. Continue.
