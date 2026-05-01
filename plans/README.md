# plans/

Persistent planning markdown — survives across Bob conversations and across team members. (Session 11 pattern.)

## Convention

- One file per feature: `plans/{feature-slug}.md`.
- Bob in **Plan mode** writes to this folder.
- Bob in **Code mode** reads from this folder via `@plans/{slug}.md`.
- After a feature's implementation is committed, **delete the plan file in the same PR** (Session 11). Don't leave dead plans in the repo.

## Forthcoming plans

- `plans/sample-app-plan.md` — Phase 2 sample telehealth API design (Bob authors this in P2.1)
- `plans/bob-guard-mcp-plan.md` — Phase 3 custom MCP design (Bob authors this in P3.1)
- `plans/auditor-pdf-template-plan.md` — Phase 5 PDF design (Bob co-authors with the designer in P5)
