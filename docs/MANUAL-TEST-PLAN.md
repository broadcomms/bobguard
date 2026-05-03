# BobGuard — Manual Test Plan

**Project:** BobGuard — HIPAA Compliance Enforcement for IBM Bob
**Submission:** IBM Bob Dev Day Hackathon, May 2026
**Repository:** https://github.com/broadcomms/bobguard
**Document version:** 1.0
**Estimated test time:** 5 minutes (Express) · 15 minutes (Standard) · 45 minutes (Full)

---

## How to use this document

This test plan gives you three paths depending on how much time you have. Pick one. Each path is self-contained — you do not need to complete an earlier path to attempt a later one.

| Path | Time | What you verify |
|---|---|---|
| **Express** | 5 min | Open the canonical demo asset; read the writeups; spot-check the repo structure. No setup. |
| **Standard** | 15 min | Clone the repo, install dependencies, run the test suites, open the demo PDF locally. |
| **Full** | 45 min | All Standard steps, plus Bob IDE configuration, Compliance Officer mode verification, and an end-to-end `/audit-pr` run that generates a fresh evidence pack. |

Each test case has a unique ID (TC-XXX), prerequisites, steps, expected result, and a pass/fail checkbox. Tests within a category are independent unless explicitly noted.

---

## Express path (5 minutes)

**Goal:** decide if BobGuard's demo asset and core narrative hold up before you commit to a deeper review.

| ID | Test | Steps | Expected | Pass |
|---|---|---|---|---|
| TC-001 | Open the canonical demo PDF | Click `compliance/evidence/PR-1/audit-pack.pdf` in the repo. | A 12-page auditor-grade PDF opens. Cover shows BobGuard logo, "STATUS: BLOCKED" badge, "Forward-Compatible with 2024 HIPAA Security Rule NPRM" callout. | ☐ |
| TC-002 | Read the problem/solution writeup | Open `docs/PROBLEM-SOLUTION.md`. | 5 paragraphs, ≤500 words, ends with "BobGuard turns idea into impact faster." | ☐ |
| TC-003 | Read the Bob/watsonx usage statement | Open `docs/BOB-USAGE.md`. | 4 sections covering IBM Bob IDE, watsonx.ai, watsonx.governance, IBM Cloud. Names every Bob feature, skill, MCP tool with file paths. | ☐ |
| TC-004 | Verify hackathon deliverables checklist | Open `README.md`, scroll to "Hackathon deliverables status." | All 8 technical deliverables marked complete. Video and writeups marked complete or in progress. | ☐ |
| TC-005 | Spot-check repo structure | Click into `.bob/`, `mcp/bob-guard/`, `compliance/`, `bob_sessions/`. | Each folder is populated. `bob_sessions/` has at least 9 phase exports. | ☐ |

**If all 5 Express tests pass:** the submission has structural and narrative integrity. You may stop here, or continue to Standard.

---

## Prerequisites (Standard and Full paths only)

You must have these installed before running the Standard or Full path:

- **Node.js** ≥ 20.x (`node --version`)
- **npm** ≥ 10.x (`npm --version`)
- **Docker Desktop** (running) (`docker --version`)
- **Git** (`git --version`)
- **A PDF viewer** (Preview on macOS, Adobe Reader, or browser)

**For the Full path, additionally:**

- **IBM Bob IDE** ≥ 1.0.2 (download from https://bob.ibm.com)
- **An IBM Bob account** (free hackathon-tier acceptable)
- **(Optional) IBM Cloud account** with `watsonx.ai` project + API key, for live granite-3-8b-instruct prose generation. Without these, watsonx.ai output renders as `[watsonx.ai unavailable — placeholder]` — the pipeline still completes successfully.

---

## Standard path (15 minutes)

**Goal:** verify the codebase actually builds, all tests pass, and the demo PDF renders locally.

### TC-100 — Environment setup

| ID | Test | Steps | Expected | Pass |
|---|---|---|---|---|
| TC-101 | Clone the repository | `git clone https://github.com/broadcomms/bobguard.git && cd bobguard` | Clone completes without errors. `git log --oneline` shows multiple commits with `feat(p2*)`, `feat(p3*)`, `feat(p5*)` prefixes. | ☐ |
| TC-102 | Install root dependencies | `npm install` | Installs successfully. `node_modules/` populated. No high-severity vulnerabilities reported. | ☐ |
| TC-103 | Configure environment | `cp .env.example .env` (the defaults are sufficient for testing without watsonx). | `.env` file created at repo root. | ☐ |
| TC-104 | Start Postgres | `docker compose up -d` | Container `bobguard-postgres` starts on port 5432. `docker ps` shows it running. | ☐ |
| TC-105 | Apply Prisma migrations | `npm run prisma:migrate` (when prompted for migration name, enter any name like `init` if needed) | "Database is now in sync with your schema." Prisma Client regenerated. | ☐ |
| TC-106 | Seed the database | `npm run prisma:seed` | 1 demo user, 5 patients, 15 encounters created. No errors. | ☐ |

### TC-200 — Sample telehealth app verification

| ID | Test | Steps | Expected | Pass |
|---|---|---|---|---|
| TC-201 | Build the sample API | `npm run build` | TypeScript compiles to `dist/` with zero errors. | ☐ |
| TC-202 | Run sample app test suite | `npm test` | All 78 tests pass (65 unit + 13 smoke). Exit code 0. | ☐ |
| TC-203 | Verify deliberate violations exist | Open `src/prisma/schema.prisma`. | `Patient` model has `dob`, `mrn`, `ssn` declared as plain `String` (deliberate §164.312(a)(2)(iv) violation). | ☐ |
| TC-204 | Verify routes have no audit calls | Open `src/routes/patient.routes.ts`. | No `import` of `audit` and no `audit.log()` calls (deliberate §164.312(b) violation). | ☐ |
| TC-205 | Verify webhook accepts plain HTTP | Open `src/routes/message.routes.ts`. | No TLS or HTTPS enforcement (deliberate §164.312(e)(1) violation). | ☐ |
| TC-206 | Verify auth is single-factor | Open `src/middleware/auth.middleware.ts`. | JWT verification only; no MFA gate (deliberate §164.312(d) violation). | ☐ |

### TC-300 — bob-guard MCP server verification

| ID | Test | Steps | Expected | Pass |
|---|---|---|---|---|
| TC-301 | Install MCP dependencies | `cd mcp/bob-guard && npm install` | Installs successfully, including `@modelcontextprotocol/sdk`, `puppeteer`, `marked`, `isomorphic-dompurify`. | ☐ |
| TC-302 | Build the MCP server | `npm run mcp:build` | Compiles to `dist/server.js`. No TypeScript errors. | ☐ |
| TC-303 | Run MCP test suite | `npm test` | All MCP tests pass (controls, NPRM, governance, evidence — 36+ total). Exit code 0. | ☐ |
| TC-304 | Inspect controls catalog count | `cat ../../compliance/controls/hipaa.json | grep -c control_id` | Returns at least 98 (the AuditGuardX HIPAA catalog). | ☐ |
| TC-305 | Inspect 2024 NPRM overlay | Open `../../compliance/controls/hipaa-2024-nprm-overlay.json`. | At least 8 proposed_changes entries citing HHS OCR RIN 0945-AA22. | ☐ |

### TC-400 — Demo asset verification

| ID | Test | Steps | Expected | Pass |
|---|---|---|---|---|
| TC-401 | Open the canonical demo PDF locally | Open `compliance/evidence/PR-1/audit-pack.pdf` in any PDF viewer. | 12-page PDF renders cleanly. | ☐ |
| TC-402 | Cover page integrity | Inspect page 1. | BobGuard logo + "HIPAA Security Rule Compliance Audit" heading + repo metadata + "STATUS: BLOCKED" red pill + Forward-Compatible-NPRM callout. | ☐ |
| TC-403 | Executive Summary structure | Inspect page 2. | Sub-headings: "Audit Scope", "Findings Summary" (bulleted), "Recommendation" (bulleted). No raw markdown characters (no `---` or `**`). | ☐ |
| TC-404 | Control mapping table | Inspect page 3. | Auditor-style table with at least 5 rows, columns: Control ID · Control Name · Family · Location · Severity · Existing Rule · NPRM Status. Severity values "BLOCK" in red, "WARN" in amber. | ☐ |
| TC-405 | Data flow diagram renders | Inspect page 4. | Mermaid diagram showing External Systems → API Layer → Compliance Layer → Data Layer with §164 control labels on each component. | ☐ |
| TC-406 | Threat Model Delta structure | Inspect page 5. | Sub-headings: "New Attack Surface", "Critical and High Risks" (bulleted with severity color coding), "Recommended Mitigations", "Aggregate Risk Level". | ☐ |
| TC-407 | NPRM Forward-Compatibility section | Find the "NPRM Forward-Compatibility Analysis" section. | At least 2 styled callout cards for §164.312(a)(2)(iv) and §164.312(d). Each shows Existing Status / NPRM Proposal / BobGuard Action. Cites HHS OCR, RIN 0945-AA22, January 6, 2025. | ☐ |
| TC-408 | Audit Sign-off page | Inspect the final page. | "Auditor: BobGuard Compliance Officer", date, Digital Audit Trail callout citing 45 CFR §164.308, §164.310, §164.312 and the 2024 NPRM. | ☐ |
| TC-409 | All evidence files present | List `compliance/evidence/PR-1/`. | At least: `audit-pack.pdf`, `control-map.md`, `threat-delta.md`, `test-evidence.json`, `refusal.md`, `governance-register-result.json`, `data-flow.mmd`. | ☐ |
| TC-410 | Refusal text format check | Open `compliance/evidence/PR-1/refusal.md`. | Each blocking violation uses the exact format: `❌ HIPAA §{control_id} — {finding}. Trust is built by saying no.` followed by `Proposed fix:` and (where applicable) a `Forward-compat:` note citing the 2024 NPRM. | ☐ |

### TC-500 — Documentation completeness

| ID | Test | Steps | Expected | Pass |
|---|---|---|---|---|
| TC-501 | bob_sessions/ has all phase exports | List `bob_sessions/`. | At least 9 phase reports (01-init, 02a, 02b, 02c, 03a, 03b, 03c, 04, 05b). | ☐ |
| TC-502 | bob_sessions/ has screenshots | List `bob_sessions/screenshots/`. | At least 3 canonical demo screenshots present. | ☐ |
| TC-503 | HHS reference PDFs present | List `compliance/references/hhs/`. | At least 12 PDFs from HHS OCR / CMS, including the 2024 NPRM (`2024-30983.pdf`). | ☐ |
| TC-504 | LICENSE is MIT | Open `LICENSE`. | MIT License text. | ☐ |
| TC-505 | No secrets committed | `git ls-files | xargs grep -l 'WATSONX_AI_KEY=ey' 2>/dev/null` (or equivalent secret-scanner) | No matches. `.env` is in `.gitignore` and not tracked. | ☐ |

**If all Standard tests pass:** the codebase is reproducible and the demo asset is genuine. You may stop here, or continue to Full.

---

## Full path (45 minutes)

**Goal:** experience BobGuard end-to-end inside Bob IDE — the way a real developer would use it.

### TC-600 — Bob IDE configuration

| ID | Test | Steps | Expected | Pass |
|---|---|---|---|---|
| TC-601 | Open the repo in Bob IDE | Launch IBM Bob IDE, open the `bobguard` folder. | Repo loads without errors. File tree shows `.bob/`, `src/`, `mcp/bob-guard/`, `compliance/`, `bob_sessions/`. | ☐ |
| TC-602 | Verify AGENTS.md auto-loads | In a fresh chat, type: `Summarize what we're building per @AGENTS.md`. | Bob produces a summary mentioning: BobGuard, $84K stat, 30-day → 2-day cycle, "Trust is built by saying no", 2024 HIPAA NPRM, Compliance Officer mode, AuditGuardX 98-control catalog. | ☐ |
| TC-603 | Verify Compliance Officer mode is registered | Open Bob Settings → Modes. | A custom mode named "Compliance Officer" is listed (Project Mode). | ☐ |
| TC-604 | Verify bob-guard MCP is registered | Open Bob Settings → MCP. | Two MCP servers shown: `github` and `bob-guard`. The `bob-guard` server may show red until the build runs (next step). | ☐ |
| TC-605 | Build the MCP and verify green dot | If not already built, run `cd mcp/bob-guard && npm run mcp:build`. Refresh the MCP panel in Bob. | `bob-guard` MCP shows a **green dot** indicating successful connection. Click into it: 5 tools listed (`controls.lookup`, `controls.scan`, `nprm.forward_compat_check`, `governance.register_pr`, `evidence.render_pdf`). | ☐ |
| TC-606 | Verify /audit-pr slash command | In a Bob chat, type `/`. | `/audit-pr` appears in the slash menu with description "Run BobGuard's full HIPAA compliance audit on the current branch's diff against main." | ☐ |

### TC-700 — Live MCP tool invocation

These tests exercise the MCP tools through Bob's reasoning loop. Switch Bob to **Compliance Officer mode** before running them.

| ID | Test | Steps | Expected | Pass |
|---|---|---|---|---|
| TC-701 | Look up a HIPAA control | Prompt: `Call bob-guard.controls.lookup with control_id "164.312(a)(2)(iv)" and show me the full result.` | Bob requests permission, then returns a JSON object including `control_id`, `control_name: "Encryption and Decryption (Addressable)"`, `bobguard.code_patterns` (3 regex patterns), `bobguard.refusal_template` (containing "Trust is built by saying no"), `bobguard.nprm_2024_status: "would_become_required"`. | ☐ |
| TC-702 | Run a forward-compat check | Prompt: `Call bob-guard.nprm.forward_compat_check with triggered_controls=[{control_id:"164.312(a)(2)(iv)"},{control_id:"164.312(d)"}]` | Bob returns two narrative blocks. Each uses "proposes" language ("the 2024 NPRM proposes…"), never "HIPAA requires…". §164.312(a)(2)(iv) maps to "addressable → required". §164.312(d) maps to "explicit MFA requirement". | ☐ |
| TC-703 | Scan a real diff | Prompt: `git diff against the previous commit on src/middleware/auth.middleware.ts. Pass that diff to bob-guard.controls.scan.` | Bob captures the diff and returns at least one finding for §164.312(d) Person or Entity Authentication. The finding includes `file`, `line`, `severity: "block"`. | ☐ |
| TC-704 | Refusal language is verbatim | Compare Bob's refusal output in TC-703 against the template in `.bob/rules.md` Section 1. | Format matches exactly: `❌ HIPAA §164.312(d) — {finding}. Trust is built by saying no.` followed by `Proposed fix:` and (because §164.312(d) is NPRM-affected) a `Forward-compat:` note. | ☐ |

### TC-800 — End-to-end /audit-pr against real code

This is the headline test. It generates a fresh evidence pack on top of the canonical PR-1 example.

| ID | Test | Steps | Expected | Pass |
|---|---|---|---|---|
| TC-801 | Create a feature branch with a violation | `git checkout -b test/manual-audit && echo 'export const ssn: string = "123";' >> src/lib/test-leak.ts && git add . && git commit -m "test: deliberate violation"` | Branch created, commit recorded. | ☐ |
| TC-802 | Run /audit-pr | In Compliance Officer mode in Bob: `/audit-pr` | Bob runs the full pipeline: scans the diff, looks up controls, calls NPRM check, generates evidence files, renders the PDF, registers with watsonx.governance (live or mocked). | ☐ |
| TC-803 | Evidence pack generated | List `compliance/evidence/PR-{N}/` (where N is a new directory). | All 5 evidence files present: `audit-pack.pdf`, `control-map.md`, `threat-delta.md`, `test-evidence.json`, `governance-register-result.json`. | ☐ |
| TC-804 | New PDF matches PR-1 quality | Open the new `audit-pack.pdf`. | Same structural quality as the PR-1 canonical PDF: cover with BobGuard logo, structured Executive Summary with sub-headings, control mapping table, NPRM section, sign-off. | ☐ |
| TC-805 | Bob session export | List `bob_sessions/`. | A new session report is added covering the `/audit-pr` run you just executed. | ☐ |
| TC-806 | Clean up | `git checkout main && git branch -D test/manual-audit && rm -rf compliance/evidence/PR-{N}/` | Test artifacts removed. Repository state restored. | ☐ |

### TC-900 — Hackathon judging-criteria alignment

Map the verified results to the four hackathon judging axes.

| ID | Test | Steps | Expected | Pass |
|---|---|---|---|---|
| TC-901 | Completeness & feasibility (5 pts) | Reference: TC-101 through TC-805. | All technical deliverables build, run, and pass tests. The full plan → code → review → PR loop is demonstrated. | ☐ |
| TC-902 | Effectiveness & efficiency (5 pts) | Reference: TC-401, TC-410, TC-803. | The system catches 5+ HIPAA violations on real code. Headline numbers ($84K, 30 days → 2 days) align with IBM keynote stats. Pattern is regulation-agnostic. | ☐ |
| TC-903 | Design & usability (5 pts) | Reference: TC-401 through TC-408. | The auditor PDF is structurally and visually professional — the kind of artifact a CISO would forward to a board. Color-coded severity, structured headings, citation-grade NPRM analysis. | ☐ |
| TC-904 | Creativity & innovation (5 pts) | Reference: TC-002, TC-003, TC-407, TC-702. | First submission to weaponize Bob's pushback as a governance layer. NPRM forward-compatibility is unique. The bob-guard MCP was built inside Bob — recursive narrative. watsonx.governance integration is unusual. | ☐ |

---

## Sign-off

| Field | Value |
|---|---|
| Tester name | _________________________ |
| Date tested | _________________________ |
| Path completed (Express / Standard / Full) | _________________________ |
| Total test cases passed | _____ / _____ |
| Overall verdict (Pass / Fail / Partial) | _________________________ |
| Comments | |

---

## Appendix A — Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `prisma migrate dev` reports "schema not found" | Schema is at `src/prisma/schema.prisma` (non-default location) | Already configured in `package.json#prisma.schema` — re-run `npm install` if missing |
| Docker container `bobguard-postgres` won't start | Port 5432 already bound | Stop other Postgres instances or change port in `docker-compose.yml` |
| `bob-guard` MCP shows red in Bob | Server binary not built | Run `cd mcp/bob-guard && npm run mcp:build` then refresh the MCP panel |
| `bob-guard` MCP shows red after build | stderr labeled "Error" — these are info logs, not failures | Open the MCP panel; if "Tools this MCP is using" lists the 5 tools, the server is healthy |
| Compliance Officer mode missing from Bob | Mode YAML schema differs across Bob versions | Re-add via Settings → Modes → "+" using values from `.bob/custom_modes.yaml` |
| `/audit-pr` slash command missing | `.bob/commands/audit-pr.md` not loaded | Restart Bob IDE |
| watsonx.ai sections show "[unavailable — placeholder]" | `WATSONX_AI_KEY` not set in `.env` or MCP server started before keys were saved | Add keys to `.env`, restart MCP via the refresh icon in Bob's MCP panel |
| Mermaid diagram missing on page 4 | `data_flow_mmd` not passed to `evidence.render_pdf` | Re-run with the populated parameter (the `/audit-pr` slash command does this automatically) |
| PDF generation fails | Puppeteer cannot launch Chromium | Install Chromium: `npx puppeteer browsers install chrome` |

## Appendix B — File map quick reference

| Path | Contents |
|---|---|
| `compliance/evidence/PR-1/audit-pack.pdf` | The canonical demo asset. **The single artifact a judge should open first.** |
| `docs/PROBLEM-SOLUTION.md` | 500-word submission writeup |
| `docs/BOB-USAGE.md` | Bob/watsonx usage statement |
| `docs/MANUAL-TEST-PLAN.md` | This file |
| `docs/MANUAL-TEST-PLAN.docx` | This file as a Word document |
| `.bob/AGENTS.md` | Persistent project context Bob loads on every conversation |
| `.bob/rules.md` | Refusal language template (Section 1 is the deterministic format) |
| `.bob/custom_modes.yaml` | Compliance Officer custom mode (Bob 1.0.2 native schema) |
| `.bob/skills/` | Five skills: pr-block-with-citation, control-mapper, audit-evidence-generator, data-flow-tracer, nprm-forward-compat-check |
| `.bob/commands/audit-pr.md` | The `/audit-pr` slash command |
| `compliance/controls/hipaa.json` | AuditGuardX 98-control HIPAA catalog (baseline) |
| `compliance/controls/hipaa-technical-extended.json` | BobGuard schema-extended Technical Safeguards |
| `compliance/controls/hipaa-2024-nprm-overlay.json` | 2024 HIPAA Security Rule NPRM forward-compat overlay |
| `mcp/bob-guard/src/server.ts` | MCP server bootstrap; registers all 5 tools |
| `mcp/bob-guard/src/tools/` | Tool implementations: controls, nprm, governance, evidence |
| `mcp/bob-guard/templates/audit-pack.html` + `.css` | Auditor PDF template |
| `bob_sessions/` | Exported Bob task session reports — required by hackathon rules |

## Appendix C — Production hardening (from the README)

BobGuard's own `/audit-pr` against itself flagged 7 issues. One (XSS in markdown rendering) was fixed in commit `00aea24`. The remaining 6 are documented in the README under "Production hardening notes" as honest follow-ups for production deployment. None affect the demo or the working pipeline.

---

*End of test plan.*
