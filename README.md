# BobGuard

> **Idea to impact, with proof.**
> A Bob-native compliance enforcement layer for HIPAA-regulated software. Watches every PR, refuses unsafe changes with cited HIPAA Security Rule control numbers, proposes fixes, and emits an auditor-ready evidence pack to the repo.

**IBM Bob Dev Day Hackathon submission** — theme: *Turn idea into impact faster*. Submission deadline May 3, 2026 10:00 AM ET.

---

## What it does (90 seconds)

1. Developer opens a PR.
2. Bob in **Compliance Officer** mode runs `/audit-pr` on the diff.
3. Bob refuses changes that violate HIPAA Security Rule controls — with section-numbered citations and proposed fixes. *"Trust is built by saying no."*
4. For controls touched by the **2024 HIPAA Security Rule NPRM** (HHS OCR, RIN 0945-AA22, Jan. 6, 2025), Bob appends a forward-compatibility note — BobGuard already enforces the proposed stricter standard.
5. Bob auto-generates an evidence pack to `compliance/evidence/PR-{n}/`: control mapping, ePHI data flow, threat-model delta, test evidence, and an **auditor-grade PDF**.
6. Bob registers the PR with **watsonx.governance** for a continuous audit register.

**Result:** the IBM keynote's 30-day → 2-day compliance cycle, with $84K saved per release, becomes a Bob-native default — not a quarterly scramble.

---

## Architecture

![Architecture](docs/ARCHITECTURE.png)

| Layer | Tech | Location |
|---|---|---|
| Sample telehealth API | TypeScript + Express + Prisma + Postgres | `src/` |
| Custom MCP server | Node 20 + MCP SDK | `mcp/bob-guard/` |
| HIPAA controls | AuditGuardX 98-control catalog + BobGuard extensions + 2024 NPRM overlay | `compliance/controls/` |
| HHS reference library | Public-domain HHS HIPAA documents | `compliance/references/hhs/` |
| Auditor PDF pipeline | Puppeteer + Mermaid + watsonx.ai (granite) | `mcp/bob-guard/templates/` |
| Compliance Officer mode | Bob custom mode + 5 skills | `.bob/` |

## How IBM Bob and watsonx are used

- **IBM Bob IDE** is the entire SDLC partner. We use Plan mode for design, Code mode for phased implementation, **the Compliance Officer custom mode** for PR-time auditing, and the Ask mode for explanation. Bob's Findings rules surface violations live as code is written. Bob's `/init` seeded `AGENTS.md`. Five custom skills enforce deterministic refusal language. The `bob-guard` custom MCP was authored entirely inside Bob — *Bob building Bob's own tool.*
- **watsonx.ai** generates the executive-summary prose and threat-delta narrative in each evidence pack.
- **watsonx.governance** receives a register entry per PR — controls triggered, fixes applied, evidence-pack reference.

See [`docs/BOB-USAGE.md`](docs/BOB-USAGE.md) for the full statement (forthcoming in P8).

---

## Quick start

```bash
# 1. Clone and install dependencies
git clone https://github.com/broadcomms/bobguard.git
cd bobguard
npm install

# 2. Set up environment
cp .env.example .env
# Edit .env: set DATABASE_URL, JWT_SECRET (min 32 chars), ENCRYPTION_KEY (64 hex chars)
# Optional: add WATSONX_AI_KEY, WATSONX_AI_PROJECT_ID, WATSONX_AI_MODEL for live prose generation

# 2.1 Confirm watsonx env vars are set
grep -E "^WATSONX_AI_KEY|^WATSONX_AI_PROJECT_ID|^WATSONX_AI_MODEL" .env
# Expect:
#   WATSONX_AI_KEY=...
#   WATSONX_AI_PROJECT_ID=...
#   WATSONX_AI_MODEL=ibm/granite-3-8b-instruct


# 3. Start Postgres
docker compose up -d

# 4. Run Prisma migrations and seed
npm run prisma:migrate
npm run prisma:seed

# 5. Build and test
npm run build
npm test

# 6. Start dev server
npm run dev
# Visit http://localhost:3000/health

# 7. Build and test the BobGuard MCP server
cd mcp/bob-guard
npm install
npm run mcp:build
npm test
cd ../..

# 8. Pre-warm the audit-pack so opening it is instant
open compliance/evidence/PR-1/audit-pack.pdf

# 8. Configure Bob IDE
# Add mcp/bob-guard to Bob Settings → MCP
# Restart Bob to load the Compliance Officer mode
# Use /audit-pr in Compliance Officer mode to scan diffs


# 9. Swith to Compliance Officer mode (In Bob Chat)
# Mode: Compliance Officer
# MCP Panel: bob-guard shows green
# MCP Panel tools: show all 5 tools
# Bob Findings Panel cleared

# 10. Open Prisma Exhibit
# In Bob Editor src/prisma/schema.prisma (the file with the deliberate dob/mrn/ssn violations) — this is "exhibit A" diff

# 11. Open Bob chat panel
# Select: "Compliance Officer"
# Type the command: "/audit-pr"
# Click "Open"

```

## Demo asset

**[Open compliance/evidence/PR-1/audit-pack.pdf](compliance/evidence/PR-1/audit-pack.pdf)** to see what BobGuard produces. No setup required.

## Production hardening notes

The hackathon submission is a working POC. The following items from Bob's own code review are documented as known follow-ups for production deployment:

- **Severity token case-sensitivity** (Medium) — regex matching on Critical/High/Medium severity tokens in watsonx output should be case-insensitive to handle model output variation.
- **Silent failure on empty markdown** (Medium) — markdown sanitization that removes all content should surface a warning rather than render an empty section.
- **Hardcoded severity-to-control mapping in prompts** (Medium) — should be derived from the controls catalog rather than hardcoded in `src/lib/watsonx.ts` prompt templates.
- **Magic constants** (Low) — `max_new_tokens: 1500` should be a named constant.
- **Page-count estimation accuracy** (Low) — current heuristic is approximate; should query Puppeteer for actual page count post-render.
- **DRY violation between CSS severity classes and TypeScript severity-class generator** (Low) — should share a single source of truth.
- **watsonx.governance integration is a liveness check, not a Factsheet write** (Medium) — `governance.register_pr` does a real IBM IAM token exchange + `GET /openscale/{instance_id}/v2/subscriptions` against the configured instance, then persists the audit register entry locally with the round-trip stamped in `ibm_governance_check`. Production should swap the GET for a `POST /v2/factsheets/...` call once a Factsheet / AI Use Case is provisioned in the watsonx.governance instance.
- **node:https instead of fetch in `src/lib/http.ts`** (Low) — required because the OpenScale gateway returns HTTP 500 to undici-shaped requests for our user's instance. Once the IBM-side issue is resolved, the helper can be replaced with the global fetch.

These do not affect the working pipeline or the demo. BobGuard's own `/audit-pr` against itself flagged most of them — proving the system is candid about its own gaps.

## Repo map

```
.bob/                             ← Bob configuration (see .bob/AGENTS.md)
src/                              ← telehealth sample app  [P2]
mcp/bob-guard/                    ← custom MCP server      [P3]
compliance/
  controls/                       ← HIPAA controls catalog + NPRM overlay
  references/hhs/                 ← HHS public-domain reference PDFs
  policies/                       ← team policies
  evidence/PR-{N}/                ← per-PR evidence packs (auto-generated)
plans/                            ← persistent planning markdown (Session 11 pattern)
docs/
  adrs/                           ← Architecture Decision Records
  ARCHITECTURE.png                ← exported from .gdraw
bob_sessions/                     ← exported Bob task sessions  [HACKATHON REQUIRED]
README.md
LICENSE                           ← MIT
```

---

## Hackathon deliverables status

- [x] Public repo, created in contest period
- [x] `.bob/` Compliance Officer mode + skills + MCP config
- [x] `compliance/controls/` populated (AuditGuardX 98 + BobGuard-extended 12 + NPRM overlay)
- [x] `compliance/references/hhs/` populated (12 public-domain HHS PDFs, 4 MB)
- [x] `bob_sessions/` with all phase exports (01-init through 05b-demo-asset-lock)
- [x] `src/` sample telehealth API with deliberate HIPAA violations
- [x] `mcp/bob-guard/` server (5 tools, 36 unit tests passing)
- [x] `compliance/evidence/PR-1/` example committed as canonical demo asset
- [ ] 3-minute demo video (P9)
- [ ] 500-word problem/solution writeup (P8)
- [ ] Bob/watsonx usage statement (P8)

---

## Acknowledgements & data sources

- **HIPAA controls baseline** — derived from the AuditGuardX HIPAA controls catalog (98 controls across all 9 HIPAA families). Schema-extended for BobGuard with code patterns and refusal templates.
- **HHS reference PDFs** in `compliance/references/hhs/` — U.S. Department of Health and Human Services, Office for Civil Rights and CMS. **Public domain.** Used for citation evidence in the auditor PDF.
- **2024 HIPAA Security Rule NPRM** — HHS OCR, RIN 0945-AA22, *Federal Register* Vol. 90, No. 3 (Jan. 6, 2025). Public domain.
- **Sample patient data** — synthetic, generated by `@faker-js/faker`. **No real Personal Information is used in this repo** (per hackathon rules).

## License

[MIT](LICENSE).
