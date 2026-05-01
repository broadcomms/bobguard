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

> Forthcoming once Phase 2 ships. Provisional commands:

```bash
# 1. Install
pnpm install
docker compose up -d            # Postgres
pnpm prisma migrate dev         # schema + seed
pnpm build                      # build sample app + MCP

# 2. Start the bob-guard MCP (Bob will pick it up via .bob/mcp.json)
pnpm --filter bob-guard mcp:dev

# 3. Open in Bob IDE, switch to Compliance Officer mode, run /audit-pr
```

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
- [ ] `bob_sessions/` with all phase exports — **disqualifier if missing**
- [ ] `src/` sample telehealth API (P2)
- [ ] `mcp/bob-guard/` server (P3)
- [ ] `compliance/evidence/PR-1/` example (P5)
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
