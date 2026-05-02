# Bob Session 03b: NPRM Forward-Compatibility + Governance Registration

**Date**: 2026-05-02  
**Phase**: 3b (MCP Server - NPRM & Governance Tools)  
**Duration**: ~45 minutes  
**Mode**: Compliance Officer  

---

## Objective

Extend the BobGuard MCP server with two additional tools:
1. `nprm.forward_compat_check` - Maps triggered controls to 2024 HIPAA Security Rule NPRM proposed changes
2. `governance.register_pr` - Registers PR compliance status with watsonx.governance (with local fallback)

---

## Deliverables

### 1. NPRM Forward-Compatibility Tool

**File**: `mcp/bob-guard/src/tools/nprm.ts`

**Purpose**: When Bob identifies HIPAA violations, this tool checks if the triggered controls are affected by the 2024 NPRM and returns forward-compatibility narratives.

**Key Features**:
- Loads `compliance/controls/hipaa-2024-nprm-overlay.json` at server startup
- Maps control IDs to NPRM proposed changes
- Returns enriched objects with:
  - `existing_status` - Current rule status (required/addressable)
  - `nprm_proposal` - What the NPRM proposes to change
  - `bobguard_action` - How BobGuard already enforces the stricter standard
  - `nprm_reference_section` - Citation to NPRM preamble section
- Uses conditional language: "proposes", "would require" (never "HIPAA requires")
- Returns empty array for unaffected controls

**Example Output**:
```json
[
  {
    "control_id": "164.312(a)(2)(iv)",
    "existing_status": "addressable",
    "nprm_proposal": "The NPRM proposes to remove the distinction between addressable and required implementation specifications. Most existing addressable specifications would become required.",
    "bobguard_action": "BobGuard treats all listed controls as required by default. The refusal language always offers a 'forward-compat' note when an existing addressable spec is being enforced.",
    "nprm_reference_section": "Preamble, II.B. (Major Provisions)"
  },
  {
    "control_id": "164.312(d)",
    "existing_status": "required",
    "nprm_proposal": "The NPRM proposes to add an explicit MFA requirement and a defined term for 'Multi-factor Authentication.'",
    "bobguard_action": "BobGuard's pattern set under 164.312(d) flags single-factor authentication on ePHI-bearing systems with `severity: block`.",
    "nprm_reference_section": "Preamble, II.B.10–11 (Definitions)"
  }
]
```

**Unit Tests**: `mcp/bob-guard/src/tools/nprm.test.ts` (5 tests)
- ✅ Returns NPRM narrative for §164.312(a)(2)(iv) (encryption)
- ✅ Returns NPRM narrative for §164.312(d) (MFA)
- ✅ Returns empty array for unaffected controls
- ✅ Uses conditional language ("proposes", "would")
- ✅ Handles multiple triggered controls

---

### 2. Governance Registration Tool

**File**: `mcp/bob-guard/src/tools/governance.ts`

**Purpose**: Registers PR compliance status with watsonx.governance for audit trail. Falls back to local JSON file if API is unreachable.

**Key Features**:
- Attempts POST to `WATSONX_GOVERNANCE_URL` with Bearer token
- Request payload:
  ```json
  {
    "pr_number": 123,
    "controls": [
      {"control_id": "164.312(a)(2)(iv)", "status": "blocked"},
      {"control_id": "164.312(b)", "status": "violated"}
    ],
    "status": "blocked",
    "evidence_path": "compliance/evidence/PR-123/audit-pack.pdf"
  }
  ```
- Fallback triggers on:
  - Network errors (ECONNREFUSED, ETIMEDOUT)
  - 5xx server responses
  - Missing `WATSONX_GOVERNANCE_URL` or `WATSONX_API_KEY` env vars
- Fallback writes to: `compliance/evidence/PR-{n}/governance-register-result.json`
- Returns: `{entry_id: string, status: 'live' | 'mocked'}`
- Uses Zod validation only at API response boundary (not internal data)

**Unit Tests**: `mcp/bob-guard/src/tools/governance.test.ts` (5 tests)
- ✅ Registers successfully in live mode
- ✅ Falls back on network error
- ✅ Falls back on 500 response
- ✅ Falls back on missing env vars
- ✅ Always writes to `governance-register-result.json` (not `governance-register.json`)

---

### 3. MCP Server Integration

**Modified File**: `mcp/bob-guard/src/server.ts`

**Changes**:
1. Added NPRM overlay loading at startup:
   ```typescript
   const nprm = JSON.parse(
     readFileSync(join(rootDir, 'compliance/controls/hipaa-2024-nprm-overlay.json'), 'utf-8')
   );
   ```

2. Registered `nprm.forward_compat_check` tool:
   ```typescript
   server.setRequestHandler(ListToolsRequestSchema, async () => ({
     tools: [
       // ... existing controls.* tools ...
       {
         name: 'nprm.forward_compat_check',
         description: 'Checks if triggered controls are affected by the 2024 HIPAA Security Rule NPRM...',
         inputSchema: { /* ... */ }
       }
     ]
   }));
   ```

3. Registered `governance.register_pr` tool:
   ```typescript
   {
     name: 'governance.register_pr',
     description: 'Registers PR compliance status with watsonx.governance...',
     inputSchema: { /* ... */ }
   }
   ```

**Did NOT modify**: Existing `controls.lookup` and `controls.scan` tool registrations (frozen from Phase 3a)

---

## Test Results

```bash
$ npm test

> bob-guard@1.0.0 test
> vitest run

 ✓ src/tools/controls.test.ts (12 tests) 234ms
 ✓ src/tools/nprm.test.ts (5 tests) 89ms
 ✓ src/tools/governance.test.ts (5 tests) 156ms

Test Files  3 passed (3)
     Tests  22 passed (22)
  Start at  00:35:12
  Duration  1.2s
```

**All 22 tests passing** (12 from Phase 3a + 5 NPRM + 5 governance)

---

## MCP Server Status

**Connected**: ✅ Green status in Bob's MCP panel  
**Tools Registered**: 4 total
1. `controls.lookup` - Returns full control object by ID
2. `controls.scan` - Scans git diffs for violations (256KB limit)
3. `nprm.forward_compat_check` - Returns NPRM forward-compatibility narratives
4. `governance.register_pr` - Registers PR status with watsonx.governance

---

## Live Tool Verification

**Test Command**: Called `nprm.forward_compat_check` via Bob chat with:
```json
{
  "triggered_controls": [
    {"control_id": "164.312(a)(2)(iv)"},
    {"control_id": "164.312(d)"}
  ]
}
```

**Response**: ✅ Returned two forward-compatibility narratives with proper conditional language:
- §164.312(a)(2)(iv): addressable → required (NPRM proposes)
- §164.312(d): explicit MFA requirement (NPRM proposes)

Both narratives use "proposes"/"would" language, never asserting HIPAA already requires what is only proposed.

---

## Citation Discipline Verified

✅ **Existing rule citations**: "is required" or "is addressable" (matches actual rule status)  
✅ **2024 NPRM citations**: "the 2024 NPRM proposes" or "would require" (conditional language)  
✅ **Section numbers**: Always cited (e.g., §164.312(a)(2)(iv), not "HIPAA encryption rule")  

---

## Dependencies Added

**File**: `mcp/bob-guard/package.json`

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.4",
    "zod": "^3.22.4"
  }
}
```

Zod is used only at API response boundary in `governance.ts`, not for internal data validation.

---

## Files Created/Modified

### Created (Phase 3b):
- `mcp/bob-guard/src/tools/nprm.ts` (95 lines)
- `mcp/bob-guard/src/tools/nprm.test.ts` (5 tests)
- `mcp/bob-guard/src/tools/governance.ts` (128 lines)
- `mcp/bob-guard/src/tools/governance.test.ts` (5 tests)

### Modified (Phase 3b):
- `mcp/bob-guard/package.json` - Added zod dependency
- `mcp/bob-guard/src/server.ts` - Registered 2 new tools (4 total)

### Unchanged (Frozen from Phase 3a):
- `mcp/bob-guard/src/tools/controls.ts` - No modifications
- `mcp/bob-guard/src/tools/controls.test.ts` - No modifications

---

## Next Steps (Phase 4)

Phase 3b is complete. The MCP server now has all 4 core tools operational:
1. ✅ Controls lookup
2. ✅ Controls scanning
3. ✅ NPRM forward-compatibility checking
4. ✅ Governance registration with fallback

**Phase 4 deliverables** (from `plans/bob-guard-mcp-plan.md`):
- Audit evidence generator skill (control-map.md, data-flow.mmd, threat-delta.md, test-evidence.json, audit-pack.pdf)
- PR block with citation skill
- Integration tests with real git diffs from Phase 2

---

## Session Export

**Exported**: 2026-05-02 00:40 UTC  
**Screenshot**: Included (NPRM tool response showing forward-compatibility narratives)  
**Cost**: $24.23  
**Mode**: Compliance Officer  

---

## Compliance Notes

- All tools use formal auditor tone (no "Bob", "AI", or "assistant" references)
- Citation discipline enforced: existing rule vs. NPRM proposals clearly distinguished
- Governance fallback ensures audit trail even when watsonx.governance is unreachable
- NPRM narratives use conditional language exclusively ("proposes", "would require")
- All 22 unit tests passing, MCP server operational with 4 tools

**Trust is built by saying no.**

---

*End of Session 03b*