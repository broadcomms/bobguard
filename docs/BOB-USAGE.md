# IBM Bob and watsonx Usage Statement

## IBM Bob IDE

We used Bob across the entire SDLC. **Plan mode** designed the architecture in every planning phase; **Code mode** implemented every source phase (scaffold, routes, seed, MCP tools, NPRM + governance, evidence pipeline, end-to-end audit, demo lock). **Ask mode** explained HIPAA Security Rule nuances and watsonx.ai API patterns. **Compliance Officer custom mode** (`.bob/custom_modes.yaml`) is the primary interface for PR-time auditing, invoking five specialized skills under `.bob/skills/`: `pr-block-with-citation` (deterministic refusal-language template), `control-mapper` (HIPAA control mapping table generation), `audit-evidence-generator` (artifact orchestration), `data-flow-tracer` (Mermaid ePHI flow diagram), and `nprm-forward-compat-check` (2024 NPRM overlay narrative). The `/audit-pr` slash command (`.bob/commands/audit-pr.md`) orchestrates the full pipeline. Bob's `/init` seeded `AGENTS.md`; `.bob/rules.md` enforces refusal-language templates; Bob Findings surface violations live; checkpoints, the code-review tab, and auto-PR creation streamlined the evidence-pack workflow. **The `bob-guard` custom MCP was authored entirely inside Bob in Plan→Code mode — Bob building Bob's own tool.**

## IBM watsonx.ai

Granite-3-8b-instruct generates the auditor prose in each evidence pack: Executive Summary, Threat Model Delta, NPRM forward-compatibility narrative, and per-control rationale. The client is implemented at `mcp/bob-guard/src/lib/watsonx.ts` with graceful fallback to `"[watsonx.ai unavailable — placeholder]"` when API keys are missing. Prompts are constructed dynamically from control metadata, diff context, and threat analysis.

## IBM watsonx.governance

Each refusal Bob issues registers an entry in watsonx.governance via the `bob-guard.governance.register_pr()` MCP tool (`mcp/bob-guard/src/tools/governance.ts`). The payload includes PR number, triggered controls (with status: "reviewed" | "approved" | "blocked"), evidence pack file path, and commit metadata. The result is written to `compliance/evidence/PR-{n}/governance-register-result.json` with a `mode` field indicating `"live"` (API succeeded) or `"mocked"` (local fallback). This creates a continuous register of compliance events tied to specific commits and controls, enabling CISOs to query "which PRs touched §164.312(b) in Q1?" or "how many encryption violations were blocked this sprint?" The governance dashboard becomes the single source of truth for audit readiness.

## IBM Cloud

Cloud Object Storage for the auditor PDF archive is noted as future work in `plans/bob-guard-mcp-plan.md`; the hackathon build writes PDFs locally to `compliance/evidence/` and commits them for PR review.

---

Total Bob-authored artifacts in this submission: approximately 99 source files tracked in `git ls-files` (excluding node_modules, dist, and the HHS public-domain reference PDFs), plus 13 Bob session reports and 7 canonical screenshots in `bob_sessions/`. Every commit on `origin/main` was driven by Bob in Plan or Code mode.