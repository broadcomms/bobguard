# BobGuard Custom MCP Server — Implementation Plan

**Meta-narrative:** This is Bob building Bob's own tool. The MCP server is the enforcement engine that powers Compliance Officer mode. When Bob audits a PR in Phase 3, Bob will be calling tools that Bob built in this phase. The recursion is the point.

## Architecture Overview

**Purpose:** Custom MCP server exposing 5 tools for HIPAA compliance enforcement at PR time.

**Stack:**
- Node 20 + TypeScript (strict)
- `@modelcontextprotocol/sdk` v0.5.0+ (stdio transport)
- Puppeteer (headless Chromium for PDF rendering)
- `@mermaid-js/mermaid-cli` (mmdc for inline diagram rendering)
- `@ibm-cloud/watsonx-ai` SDK (granite-3-8b-instruct for prose generation)
- Vitest (unit tests, one per tool)

**Location:** `mcp/bob-guard/` (separate package, NOT npm workspace — see Design Question c)

## 5 Required Tools

### 1. `controls.lookup(control_id: string)`
**Returns:** Full control object from `hipaa-technical-extended.json` + `hipaa.json`
**Implementation:** `src/tools/controls.ts`
- Loads both JSON files at server startup (cached in memory)
- Merges `bobguard.*` extensions onto base control
- Returns 404-like error if control_id not found

### 2. `controls.scan(diff: string, lang: string = "ts")`
**Returns:** Array of `{control_id, control_name, file, line, snippet, severity, code_pattern_comment}`
**Implementation:** `src/tools/controls.ts`
- Iterates all controls with `bobguard.code_patterns`
- Filters by `lang` match
- Runs each regex pattern against diff
- Captures line number, snippet (±3 lines context)
- Returns findings sorted by severity (block → warn)

### 3. `evidence.render_pdf({ pr_number, repo_metadata, triggered_controls, control_map_md, threat_delta_md, test_evidence_json, nprm_narrative })`
**Returns:** `{ pdf_path: string, page_count: number }`
**Implementation:** `src/tools/evidence.ts`
- Loads `templates/audit-pack.html` + `audit-pack.css`
- Injects variables via Handlebars-style `{{var}}` replacement
- Renders Mermaid diagrams inline via `mmdc` CLI (see Design Question e)
- Calls watsonx.ai (granite-3-8b-instruct) for prose sections (see Design Question f)
- Puppeteer renders to PDF: `compliance/evidence/PR-{n}/audit-pack.pdf`
- Returns path + page count

### 4. `governance.register_pr({ pr_number, controls, status, evidence_path })`
**Returns:** `{ entry_id: string, status: 'live' | 'mocked' }`
**Implementation:** `src/tools/governance.ts`
- Attempts POST to `WATSONX_GOVERNANCE_URL` with `WATSONX_GOVERNANCE_KEY`
- Payload: `{ pr_number, controls, status, evidence_path, timestamp, repo }`
- If API unreachable (network error, 5xx), falls back to `compliance/evidence/PR-{n}/governance-mock.json`
- Returns `{entry_id, status: 'live'}` on success, `{entry_id: 'mock-{uuid}', status: 'mocked'}` on fallback

### 5. `nprm.forward_compat_check({ triggered_controls })`
**Returns:** Array of `{control_id, existing_status, nprm_proposal, bobguard_action, nprm_reference_section}`
**Implementation:** `src/tools/nprm.ts`
- Loads `hipaa-2024-nprm-overlay.json`
- For each `triggered_controls[i].control_id`, checks if it appears in `proposed_changes[].affects_controls`
- Returns enriched objects with NPRM context
- Used to append "Forward-compat: under the 2024 NPRM..." notes to refusal messages

## Design Questions (Answered)

### a) MCP SDK version + transport
- **SDK:** `@modelcontextprotocol/sdk@^0.5.0` (latest stable as of May 2026)
- **Transport:** stdio (as specified in `.bob/mcp.json`)
- **Rationale:** stdio is Bob's default for local MCP servers; SSE is for remote servers

### b) Invocation scripts
- **Development:** `npm run mcp:dev` → `tsx watch src/server.ts`
- **Production:** `npm run mcp:build` → `tsc && node dist/server.js`
- **Test:** `npm test` → `vitest run`
- `.bob/mcp.json` points to `dist/server.js` (production build)

### c) Workspace layout
**Recommendation:** Separate directory with its own `node_modules` (NOT npm workspace)

**Rationale:**
- MCP server has different dependencies (Puppeteer, watsonx SDK) than the sample app
- Avoids hoisting conflicts (e.g., Puppeteer's Chromium binary)
- Cleaner isolation for hackathon judges reviewing the MCP code
- Simpler to extract into a standalone npm package post-hackathon

**Structure:**
```
mcp/bob-guard/
  package.json
  tsconfig.json
  node_modules/  (separate)
  src/
  dist/
```

### d) Puppeteer Chromium fetch strategy
- **Install:** `PUPPETEER_SKIP_DOWNLOAD=true npm install puppeteer-core`
- **Runtime:** Use `puppeteer.launch({ executablePath: '/usr/bin/chromium' })` if system Chromium available, else download on first run to `~/.cache/puppeteer`
- **Rationale:** Network-friendly for CI; avoids 200MB download during `npm install`
- **Fallback:** If no Chromium found, emit warning and skip PDF generation (return mock path)

### e) PDF template + Mermaid rendering
- **Template engine:** Simple `{{var}}` string replacement (no Handlebars dependency)
- **Mermaid:** Use `@mermaid-js/mermaid-cli` (`mmdc` binary)
  - Pre-render diagrams to SVG: `mmdc -i diagram.mmd -o diagram.svg`
  - Inline SVG into HTML via `<img src="data:image/svg+xml;base64,{base64}"/>`
- **CSS:** `audit-pack.css` for print-friendly styling (page breaks, headers, footers)

### f) watsonx.ai client
- **SDK:** `@ibm-cloud/watsonx-ai@^1.0.0`
- **Model:** `ibm/granite-3-8b-instruct` (specified in `.bob/mcp.json`)
- **Env vars:**
  - `WATSONX_AI_KEY` (IAM API key)
  - `WATSONX_AI_PROJECT_ID` (watsonx.ai project ID)
  - `WATSONX_AI_MODEL` (model ID, defaults to granite-3-8b-instruct)
- **Usage:** Generate prose for:
  - Executive summary
  - Threat delta narrative
  - NPRM forward-compat explanation
- **Prompt template:** `src/lib/watsonx.ts` exports `generateProse(section, context)`

### g) Test strategy
- **Unit tests:** Mock external APIs (watsonx, governance) using Vitest `vi.mock()`
- **Fixture diffs:** `src/tools/__fixtures__/sample-diffs/` contains known-bad code snippets
- **Assertions:**
  - `controls.scan()` finds expected violations in fixture diffs
  - `evidence.render_pdf()` produces valid PDF (check file size > 0, page count > 0)
  - `governance.register_pr()` falls back to mock when API unreachable
  - `nprm.forward_compat_check()` returns correct NPRM overlays
- **No live API calls in CI:** All external deps mocked

## 3-Phase Implementation Split

### Phase 3a: Scaffold + Controls Tools
**Deliverables:**
- `mcp/bob-guard/package.json` + `tsconfig.json`
- `src/server.ts` (MCP bootstrap with stdio transport)
- `src/tools/controls.ts` (lookup + scan)
- `src/tools/controls.test.ts` (unit tests with fixture diffs)
- `npm run mcp:build && npm test` passes

**Checkpoint:** Verify `controls.scan()` detects all 4 violations in Phase 2 code

### Phase 3b: NPRM + Governance Tools
**Deliverables:**
- `src/tools/nprm.ts` (forward_compat_check)
- `src/tools/nprm.test.ts`
- `src/tools/governance.ts` (register_pr with fallback)
- `src/tools/governance.test.ts` (mock API, test fallback)
- `npm test` passes

**Checkpoint:** Verify governance fallback writes mock JSON when API unreachable

### Phase 3c: watsonx + Evidence PDF
**Deliverables:**
- `src/lib/watsonx.ts` (granite client)
- `src/lib/watsonx.test.ts` (mocked)
- `src/tools/evidence.ts` (render_pdf)
- `src/tools/evidence.test.ts`
- `templates/audit-pack.html` + `audit-pack.css`
- `npm test` passes, sample PDF generated

**Checkpoint:** Render a sample PDF with all sections populated

## Unknowns (Bob 1.0.2)

1. **MCP discovery timing:** Does Bob auto-discover the MCP server after `.bob/mcp.json` is updated, or does the user need to restart Bob? (Assume restart required; document in session export.)

2. **Tool parameter validation:** Does the MCP SDK auto-validate tool parameters against the schema, or must we validate manually? (Assume manual validation required; add Zod schemas.)

3. **Stdio buffering:** Large PDF base64 responses may exceed stdio buffer limits. (Mitigation: return file path only, not base64 content.)

## Safety Checks

- ✅ No secrets in code (all via env vars)
- ✅ No real patient data (synthetic only)
- ✅ Puppeteer runs headless (no GUI dependencies)
- ✅ Governance fallback prevents hard failures
- ✅ All file writes go to `compliance/evidence/` (gitignored per `.bobignore`)

## Success Criteria

- [ ] All 5 tools callable from Compliance Officer mode
- [ ] `controls.scan()` detects all 4 Phase 2 violations
- [ ] PDF renders with Mermaid diagrams + watsonx prose
- [ ] Governance API fallback works when offline
- [ ] NPRM overlay correctly flags forward-compat controls
- [ ] 100% test coverage on tool logic
- [ ] Session export documents the recursion narrative

---

**Next:** Switch to Code mode, implement Phase 3a.