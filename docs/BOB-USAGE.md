# IBM Bob and watsonx Usage Statement

## IBM Bob IDE

We used Bob across the entire SDLC. **Plan mode** designed the architecture in phases 1, 3a, 3b, 3c, and 5a. **Code mode** implemented all source code in phases 2a (scaffold), 2b (routes), 2c (seed + tests), 3a (MCP controls tools), 3b (NPRM + governance tools), 3c (evidence pipeline), 4 (end-to-end audit), and 5b (demo asset lock). **Ask mode** explained HIPAA Security Rule nuances and watsonx.ai API patterns. **Compliance Officer custom mode** (`.bob/custom_modes.yaml`) is the primary interface for PR-time auditing, invoking five specialized skills under `.bob/skills/`: `pr-block-with-citation.md` (formal refusal language), `audit-evidence-generator.md` (artifact generation), `nprm-forward-compat-narrator.md` (2024 NPRM overlay), `governance-register.md` (watsonx.governance integration), and `controls-lookup.md` (control retrieval). The `/audit-pr` slash command (`.bob/commands/audit-pr.md`) orchestrates the full pipeline. Bob's `/init` command seeded `AGENTS.md` with project-specific context. `.bob/rules.md` enforces deterministic refusal language with exact citation templates. Bob Findings rules surface violations live as code is written. We used checkpoints to break work into sub-phases (2a/2b/2c, 3a/3b/3c). The code review tab and auto-PR creation streamlined the evidence-pack workflow. **The `bob-guard` custom MCP was authored entirely inside Bob in Plan→Code mode — Bob building Bob's own tool.**

## IBM watsonx.ai

Granite-3-8b-instruct generates the auditor prose in each evidence pack: Executive Summary (2-paragraph overview of triggered controls and risk posture), Threat Model Delta (narrative analysis of new attack surfaces introduced by the PR), NPRM forward-compatibility narrative (explaining how BobGuard enforces proposed 2024 rules before they're final), and control rationale (why each control was triggered). The client is implemented at `mcp/bob-guard/src/lib/watsonx.ts` with graceful fallback to `"[watsonx.ai unavailable — placeholder]"` when API keys are missing. Prompts are constructed dynamically from control metadata, diff context, and threat analysis. The model runs in streaming mode with a 2048-token max output and 0.7 temperature for balanced creativity and precision.

## IBM watsonx.governance

Each refusal Bob issues registers an entry in watsonx.governance via the `bob-guard.governance.register_pr()` MCP tool (`mcp/bob-guard/src/tools/governance.ts`). The payload includes PR number, triggered controls (with status: "reviewed" | "approved" | "blocked"), evidence pack file path, and commit metadata. The result is written to `compliance/evidence/PR-{n}/governance-register-result.json` with a `mode` field indicating `"live"` (API succeeded) or `"mocked"` (local fallback). This creates a continuous register of compliance events tied to specific commits and controls, enabling CISOs to query "which PRs touched §164.312(b) in Q1?" or "how many encryption violations were blocked this sprint?" The governance dashboard becomes the single source of truth for audit readiness.

## IBM Cloud

Optional Cloud Object Storage for auditor PDF archive is mentioned as future work in `plans/bob-guard-mcp-plan.md` but deferred from the hackathon scope. The current implementation writes PDFs to the local `compliance/evidence/` directory, which is committed to the repository for version control and GitHub PR review integration.

---

Total Bob-authored artifacts in this submission: 7,304 files across `.bob/`, `mcp/bob-guard/`, `src/`, and `compliance/`. Total Bob session reports exported to `bob_sessions/`: 13. Every commit on `origin/main` was driven by Bob in Plan or Code mode.