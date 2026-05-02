# Bob Session 03a: MCP Controls Tools (Phase 3a)

**Date:** 2026-05-01  
**Phase:** 3a - BobGuard MCP Server (Controls Tools)  
**Status:** ✅ Complete  
**Cost:** $16.31

## Objective

Build a custom MCP (Model Context Protocol) server that provides HIPAA compliance enforcement tools for Bob. This is the "recursive moment" where Bob builds Bob's own compliance tool.

## Deliverables

### 1. MCP Server Infrastructure

**Files Created:**
- `mcp/bob-guard/package.json` - Separate package with own node_modules
- `mcp/bob-guard/tsconfig.json` - Strict TypeScript config (ESM, NodeNext)
- `mcp/bob-guard/.gitignore` - Excludes node_modules, dist, temp files
- `mcp/bob-guard/README.md` - Documentation

**Configuration:**
- Separate npm workspace from main app
- Uses `@modelcontextprotocol/sdk` v1.0.4
- Builds to `dist/` directory via TypeScript compiler

### 2. MCP Server Implementation

**File:** `mcp/bob-guard/src/server.ts`

**Key Features:**
- Loads HIPAA control catalogs once at startup (not per-request)
- Merges `hipaa.json` (98 base controls) + `hipaa-technical-extended.json` (12 extended controls)
- Registers 2 tools: `controls.lookup` and `controls.scan`
- Uses stdio transport for Bob communication
- Logs initialization status to stderr

**Startup Logs:**
```
[bob-guard] Loading control catalogs...
[bob-guard] Loaded 98 base controls
[bob-guard] Loaded 12 extended controls
[bob-guard] Merged catalog contains 98 controls
[bob-guard] MCP server running on stdio
```

### 3. Controls Tools Implementation

**File:** `mcp/bob-guard/src/tools/controls.ts`

#### Tool 1: `controls.lookup`
- **Purpose:** Returns full control object by ID
- **Input:** `control_id` (string)
- **Output:** JSON with merged base + bobguard.* extensions
- **Example:** `controls.lookup({ control_id: "164.312(a)(2)(iv)" })`

#### Tool 2: `controls.scan`
- **Purpose:** Scans git diffs for HIPAA violations using regex patterns
- **Input:** `diff` (string, max 256KB), `lang` (optional, default "ts")
- **Output:** JSON with findings array, sorted by severity (block → warn)
- **Features:**
  - Regex-based pattern matching from `bobguard.code_patterns`
  - Extracts file, line number, and ±3 lines context
  - 256KB diff size limit (stdio buffer protection)
  - Returns warning entry if limit exceeded

**Diff Size Cap Rationale:**
- Protects stdio buffer from overflow
- Forces PR authors to split large changes
- Aligns with "small, reviewable PRs" best practice

### 4. Test Fixtures

**Directory:** `mcp/bob-guard/src/tools/__fixtures__/sample-diffs/`

Created 4 real git diffs from Phase 2 violations:

1. **unencrypted-phi.diff** - Schema with plain-text PHI fields (dob, ssn, mrn)
2. **missing-audit-log.diff** - Patient routes without audit.log() calls
3. **single-factor-jwt.diff** - JWT auth without MFA gate
4. **plain-http-webhook.diff** - Message endpoint accepting plain HTTP

### 5. Unit Tests

**File:** `mcp/bob-guard/src/tools/controls.test.ts`

**Test Coverage:**
- ✅ controls.lookup returns control by ID
- ✅ controls.lookup handles unknown control ID
- ✅ controls.scan finds unencrypted PHI violation (164.312(a)(2)(iv))
- ✅ controls.scan finds missing audit log violation (164.312(b))
- ✅ controls.scan finds plain HTTP webhook violation (164.312(e)(1))
- ✅ controls.scan finds single-factor JWT violation (164.312(d))
- ✅ controls.scan handles empty diff
- ✅ controls.scan handles diff with no violations
- ✅ controls.scan enforces 256KB size limit
- ✅ controls.scan filters by language
- ✅ controls.scan sorts findings by severity
- ✅ Integration test: scans all 4 Phase 2 fixture diffs

**Test Results:**
```
✓ src/tools/controls.test.ts  (12 tests) 11ms

Test Files  1 passed (1)
     Tests  12 passed (12)
  Duration  237ms
```

### 6. HIPAA Controls Catalog Updates

**File:** `compliance/controls/hipaa-technical-extended.json`

Updated regex patterns to be diff-aware (match git diff format with `+` prefixes):

- **164.312(a)(2)(iv)** - Encryption at rest: `[+\s].*\b(dob|ssn|mrn).*String`
- **164.312(b)** - Audit controls: `\+router\.(get|post|put|delete|patch).*requireAuth`
- **164.312(d)** - Person authentication: `\+.*jwt\.verify\(`
- **164.312(e)(1)** - Transmission security: `\+router\.post\(['\"]/(inbound|webhook|message)`

### 7. MCP Configuration

**File:** `.bob/mcp.json`

```json
{
  "mcpServers": {
    "bob-guard": {
      "command": "node",
      "args": ["./mcp/bob-guard/dist/server.js"],
      "env": {
        "BOBGUARD_CONTROLS_DIR": "./compliance/controls",
        "BOBGUARD_EVIDENCE_DIR": "./compliance/evidence",
        "BOBGUARD_TEMPLATES_DIR": "./mcp/bob-guard/templates",
        "BOBGUARD_HHS_REFS_DIR": "./compliance/references/hhs",
        "BOBGUARD_GOVERNANCE_MODE": "live"
      },
      "description": "BobGuard custom MCP. Tools: controls.lookup, controls.scan..."
    }
  }
}
```

## Verification

### Build & Test
```bash
cd mcp/bob-guard
npm install
npm run mcp:build  # tsc compiles to dist/
npm test           # vitest run
```

**Result:** ✅ All tests passing

### MCP Server Status
- ✅ Server starts successfully
- ✅ Loads 98 controls from merged catalogs
- ✅ Registers 2 tools (controls.lookup, controls.scan)
- ✅ Responds to tool calls via stdio transport

**Note:** Bob's MCP panel shows "error" level logs (red indicator), but these are just console.error() debug messages. The server is fully operational - confirmed by successful tool registration and test execution.

## Key Technical Decisions

1. **Separate npm workspace** - Isolates MCP dependencies from main app
2. **Load catalogs once at startup** - Performance optimization (not per-request)
3. **256KB diff size limit** - Protects stdio buffer, encourages small PRs
4. **Regex-based scanning** - Simple, fast, no AST parsing needed for Phase 3a
5. **Diff-aware patterns** - Regex matches git diff format (`+` prefixes)
6. **Stdio transport** - Standard MCP communication method for Bob

## Phase 3a Completion Checklist

- [x] Create mcp/bob-guard/package.json (separate node_modules)
- [x] Create mcp/bob-guard/tsconfig.json (strict, ESM, NodeNext)
- [x] Create mcp/bob-guard/.gitignore
- [x] Create mcp/bob-guard/README.md
- [x] Extract 4 fixture diffs from Phase 2 git history
- [x] Create mcp/bob-guard/src/server.ts (MCP bootstrap, load catalogs once)
- [x] Create mcp/bob-guard/src/tools/controls.ts (lookup + scan with 256KB cap)
- [x] Create mcp/bob-guard/src/tools/controls.test.ts (Vitest unit tests)
- [x] Run `cd mcp/bob-guard && npm install && npm run build && npm test`
- [x] Verify bob-guard MCP server is connected (logs show success)
- [x] Export Bob session to bob_sessions/03a-mcp-controls.md

## Next Steps (Phase 3b)

Phase 3b will implement:
- `evidence.render_pdf` tool (Puppeteer-based PDF generation)
- `governance.register_pr` tool (watsonx.governance integration)
- `nprm.forward_compat_check` tool (2024 NPRM rule changes)

These tools will be used in Compliance Officer mode for automated PR reviews.

## Lessons Learned

1. **MCP "error" logs are misleading** - console.error() output shows as red in Bob's UI, but server is working
2. **Diff-aware regex patterns** - Need to account for git diff format (`+`, `-`, ` ` prefixes)
3. **Test fixtures from real code** - Using actual Phase 2 diffs ensures patterns match real violations
4. **256KB limit is practical** - Large diffs should be split anyway for reviewability

## Files Modified/Created

**New Files:**
- mcp/bob-guard/package.json
- mcp/bob-guard/tsconfig.json
- mcp/bob-guard/.gitignore
- mcp/bob-guard/README.md
- mcp/bob-guard/src/server.ts
- mcp/bob-guard/src/tools/controls.ts
- mcp/bob-guard/src/tools/controls.test.ts
- mcp/bob-guard/src/tools/__fixtures__/sample-diffs/unencrypted-phi.diff
- mcp/bob-guard/src/tools/__fixtures__/sample-diffs/missing-audit-log.diff
- mcp/bob-guard/src/tools/__fixtures__/sample-diffs/single-factor-jwt.diff
- mcp/bob-guard/src/tools/__fixtures__/sample-diffs/plain-http-webhook.diff

**Modified Files:**
- compliance/controls/hipaa-technical-extended.json (updated regex patterns)

**Generated Files (gitignored):**
- mcp/bob-guard/dist/server.js
- mcp/bob-guard/dist/server.d.ts
- mcp/bob-guard/dist/tools/controls.js
- mcp/bob-guard/dist/tools/controls.d.ts

---

**Session completed successfully.** Phase 3a deliverables met. MCP server operational and ready for Phase 3b tool additions.