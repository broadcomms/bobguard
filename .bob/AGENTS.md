# BobGuard — Project Context for IBM Bob

> Loaded into every Bob conversation in this repo. Tells Bob what we're building, where things live, and how to behave.

## What we're building

**BobGuard** is a Bob-native compliance enforcement layer for HIPAA-regulated software. It watches every PR, refuses unsafe changes with cited HIPAA Security Rule control numbers, proposes fixes, and emits an auditor-ready evidence pack.

This is our submission to the **IBM Bob Dev Day Hackathon** (theme: "Turn Idea into Impact Faster"). Submission deadline May 3, 2026 10:00 AM ET.

## Strategic anchors (do not lose sight of)

- IBM keynote stat: **30-day compliance cycle → 2 days, $84K saved per release**.
- Bob's signature differentiator (Session 04, Marcus Biel): **"Trust is built by saying no."**
- Asymmetric authority play: **2024 HIPAA Security Rule NPRM** (HHS OCR, RIN 0945-AA22, Jan. 6, 2025) — BobGuard's enforcement is forward-compatible with the proposed stricter rule.
- AuditGuardX 98-control HIPAA catalog is the substrate. Bob does not rewrite it; Bob extends it.

## Stack

- **Sample telehealth API** (`src/`): TypeScript + Express + Prisma + Postgres. Contains deliberate non-compliant code patterns BobGuard catches.
- **Custom MCP server** (`mcp/bob-guard/`): Node 20 + TypeScript + MCP SDK. Tools: `controls.lookup`, `controls.scan`, `evidence.render_pdf`, `governance.register_pr`, `nprm.forward_compat_check`.
- **Compliance content** (`compliance/controls/`): existing AuditGuardX catalog + BobGuard schema extensions + 2024 NPRM overlay.
- **Evidence pipeline** (`mcp/bob-guard/templates/`): Puppeteer + Mermaid + watsonx.ai (granite for prose).
- **IBM stack**: Bob IDE (required), watsonx.ai, watsonx.governance. Optional: Cloud Object Storage for PDF archive.

## Repo map

```
.bob/                                  ← Bob configuration (this folder lives here)
src/                                   ← telehealth sample app
  patient.routes.ts
  encounter.routes.ts
  lib/phi-crypto.ts                    ← encryption helpers
  lib/audit.ts                         ← audit-log helper
  prisma/schema.prisma
mcp/bob-guard/                         ← custom MCP server
  src/server.ts
  src/tools/                           ← controls, evidence, governance, nprm
  templates/audit-pack.html            ← auditor PDF template (Puppeteer-rendered)
  templates/audit-pack.css
compliance/
  controls/
    hipaa.json                         ← AuditGuardX 98-control catalog
    hipaa-technical-extended.json      ← BobGuard-extended Technical Safeguards
    hipaa-2024-nprm-overlay.json       ← forward-compat overlay
  evidence/PR-{N}/                     ← per-PR evidence packs (auto-generated)
  references/hhs/                      ← public-domain HHS HIPAA PDFs
  policies/                            ← team policies referenced by controls
plans/                                 ← persistent planning markdown (per Session 11)
bob_sessions/                          ← exported Bob task sessions (HACKATHON DISQUALIFIER IF MISSING)
README.md
ARCHITECTURE.png
```

## Files Bob should reference often (use @ context)

- `@compliance/controls/hipaa-technical-extended.json` — control patterns + refusal templates
- `@compliance/controls/hipaa-2024-nprm-overlay.json` — NPRM proposed-rule narratives
- `@AGENTS.md` — this file
- `@.bob/rules.md` — refusal language and behavior

## Behavioral defaults (also encoded in rules.md)

1. TypeScript strict mode. Always.
2. Never commit secrets. BobGuard's own §164.312(a)(2)(iv) check should pass on its own repo.
3. Never use real patient data. Faker for synthetic only.
4. Always `npm run build && npm test` before claiming a task done.
5. Plans go in `plans/`. They survive across conversations.
6. Export Bob session reports to `bob_sessions/` after every meaningful task.

## Modes available in this repo

- **Plan** — for designing features, the MCP, the evidence pipeline.
- **Code** — for implementation in phases.
- **Compliance Officer** (custom, see `.bob/modes/compliance-officer.yaml`) — PR-time auditing.
- **Ask** — explanation without edits.

## When in doubt, push back.

(Session 04, Marcus Biel: "Trust is built by saying no.") If a request would violate HIPAA, leak secrets, or contradict the architecture — refuse with a citation and propose the right path. We score creativity points by saying no, not by being agreeable.
