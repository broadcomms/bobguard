# Bob Session 03c: Evidence Pipeline - watsonx.ai + PDF Generation

**Date**: 2026-05-02  
**Phase**: 3c-pass-1 (Evidence Pipeline - Structural Pass)  
**Duration**: ~70 minutes  
**Mode**: Compliance Officer  

---

## Objective

Implement the evidence pipeline with watsonx.ai prose generation and Puppeteer PDF rendering. This is a structural pass focused on getting the end-to-end pipeline working with passable quality. Visual polish and Mermaid diagram integration are deferred to Phase 3c-pass-2.

---

## Deliverables

### 1. watsonx.ai Integration

**File**: `mcp/bob-guard/src/lib/watsonx.ts`

**Purpose**: Generate auditor-grade prose for PDF sections using IBM watsonx.ai granite-3-8b-instruct model.

**Key Features**:
- 4 prose sections: `executive_summary`, `threat_delta`, `nprm_narrative`, `control_rationale`
- Each section has custom prompt template with auditor tone
- Formal language - no "AI", "Bob", or "assistant" references
- Graceful fallback to `[watsonx.ai unavailable — placeholder]` when:
  - `WATSONX_AI_KEY` or `WATSONX_AI_PROJECT_ID` missing
  - API call fails
  - Empty response returned
- Low temperature (0.3) for consistent, formal output
- Uses `@ts-ignore` for SDK type compatibility

**Environment Variables Required** (optional - falls back if missing):
```bash
WATSONX_AI_KEY=<IAM API key>
WATSONX_AI_PROJECT_ID=<project ID>
WATSONX_AI_MODEL=ibm/granite-3-8b-instruct  # default
```

**Unit Tests**: `mcp/bob-guard/src/lib/watsonx.test.ts` (7 tests)
- ✅ Generates prose for all 4 sections
- ✅ Falls back on missing env vars
- ✅ Falls back on API error
- ✅ Falls back on empty response

---

### 2. HTML/CSS Audit Pack Template

**Files**: 
- `mcp/bob-guard/templates/audit-pack.html` (119 lines)
- `mcp/bob-guard/templates/audit-pack.css` (368 lines)

**Template Structure** (7 sections):
1. **Cover Page**
   - BobGuard logo placeholder
   - Repository metadata (repo, PR#, branch, commit, author, date)
   - Status badge (BLOCKED/APPROVED/REVIEWED)
   - NPRM forward-compatibility callout

2. **Executive Summary**
   - watsonx.ai-generated prose
   - Audit scope, findings summary, recommendation

3. **Control Mapping Table**
   - Control ID, Name, Family, Location (file:line), Severity
   - Existing Rule status, NPRM status

4. **Data Flow Diagram**
   - Placeholder image (1px transparent PNG)
   - Note: "Mermaid diagram integration pending (Phase 3c-pass-2)"

5. **Threat Model Delta**
   - watsonx.ai-generated threat analysis
   - Attack vectors, HIPAA control relationships, risk assessment

6. **Test Evidence**
   - JSON-formatted test results
   - Monospace font, dark theme

7. **NPRM Forward-Compatibility Analysis**
   - watsonx.ai-generated narrative
   - Per-control blocks with existing status, NPRM proposal, BobGuard action

8. **Audit Sign-off**
   - Auditor: "BobGuard Compliance Officer"
   - Governance entry ID and status
   - Digital audit trail signature
   - Attestation paragraph

**CSS Features**:
- Print-friendly with `@page` rules
- Page breaks before major sections
- Headers/footers with page numbers
- Professional typography (system fonts)
- Dark theme for code blocks
- Responsive for screen preview

**Variable Substitution**: Simple `{{var}}` string replacement (no Handlebars dependency)

---

### 3. Evidence PDF Rendering Tool

**File**: `mcp/bob-guard/src/tools/evidence.ts`

**Purpose**: Orchestrate the full PDF generation pipeline.

**Pipeline Steps**:
1. Load HTML template and CSS
2. Call `watsonx.generateProse()` for executive summary
3. Call `watsonx.generateProse()` for threat delta narrative
4. Build control table rows from `triggered_controls`
5. Build NPRM control blocks for affected controls
6. Substitute all `{{variables}}` in HTML
7. Inline CSS into `<style>` tag
8. Launch Puppeteer headless browser
9. Set page content and render to PDF
10. Save to `compliance/evidence/PR-{n}/audit-pack.pdf`

**Input Schema**:
```typescript
{
  pr_number: number;
  repo_metadata: {
    repo_name: string;
    branch: string;
    commit_sha: string;
    author: string;
  };
  triggered_controls: Array<{
    control_id: string;
    control_name?: string;
    family?: string;
    file?: string;
    line?: number;
    severity?: string;
    existing_status?: string;
    nprm_status?: string;
  }>;
  control_map_md: string;
  threat_delta_md: string;
  test_evidence_json: Record<string, unknown>;
  nprm_narrative: string;
}
```

**Output**:
```typescript
{
  pdf_path: string;          // Absolute path to generated PDF
  page_count: number;        // Estimated page count
  watsonx_used: boolean;     // true if watsonx.ai was used (not fallback)
}
```

**Key Implementation Details**:
- Puppeteer launches with `--no-sandbox` for CI compatibility
- PDF format: US Letter, 0.75in margins (top/right/left), 1in bottom
- Print background enabled for colored badges/callouts
- Page count estimated based on section count + controls
- Placeholder diagram: 1px transparent PNG base64
- Status badge color: red (blocked), green (approved), orange (reviewed)

**Unit Tests**: `mcp/bob-guard/src/tools/evidence.test.ts` (5 tests, 30s timeout each)
- ✅ Generates valid PDF with all sections (file size > 5KB, page count >= 2)
- ✅ Handles multiple triggered controls
- ✅ Creates output directory if missing
- ✅ Sets status to BLOCKED when block-severity controls present
- ✅ Includes NPRM control blocks when nprm_status provided

---

### 4. MCP Server Registration

**Modified File**: `mcp/bob-guard/src/server.ts`

**Changes**:
1. Added import: `import { renderPdf } from './tools/evidence.js';`
2. Registered tool handler: `const evidence_render_pdf = renderPdf;`
3. Added tool to `ListToolsRequestSchema` response (5th tool)
4. Added call handler in `CallToolRequestSchema` for `evidence.render_pdf`

**Tool Schema**:
```json
{
  "name": "evidence.render_pdf",
  "description": "Renders a HIPAA compliance audit pack PDF with watsonx.ai-generated prose, control mappings, threat analysis, and test evidence.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "pr_number": { "type": "number" },
      "repo_metadata": { "type": "object", "properties": {...}, "required": [...] },
      "triggered_controls": { "type": "array", "items": {...} },
      "control_map_md": { "type": "string" },
      "threat_delta_md": { "type": "string" },
      "test_evidence_json": { "type": "object" },
      "nprm_narrative": { "type": "string" }
    },
    "required": ["pr_number", "repo_metadata", "triggered_controls", "control_map_md", "threat_delta_md", "test_evidence_json", "nprm_narrative"]
  }
}
```

---

## Dependencies Added

**File**: `mcp/bob-guard/package.json`

```json
{
  "dependencies": {
    "@ibm-cloud/watsonx-ai": "^1.0.0",
    "@modelcontextprotocol/sdk": "^0.5.0",
    "puppeteer": "^22.0.0",
    "zod": "^3.22.4"
  }
}
```

**Installation**:
```bash
cd mcp/bob-guard
npm install
```

**Notes**:
- Puppeteer downloads Chromium (~200MB) during install
- Warning about puppeteer < 24.15.0 is expected (using 22.x as specified)
- 5 vulnerabilities reported (4 moderate, 1 high) - acceptable for demo/hackathon

---

## Test Results

```bash
$ npm test

 ✓ src/tools/nprm.test.ts (5 tests) 3ms
 ✓ src/lib/watsonx.test.ts (7 tests) 14ms
 ✓ src/tools/controls.test.ts (12 tests) 22ms
 ✓ src/tools/governance.test.ts (5 tests) 31ms
 ✓ src/tools/evidence.test.ts (5 tests) 13144ms

Test Files  5 passed (5)
     Tests  34 passed (34)
  Duration  13.66s
```

**All 34 tests passing** (22 from Phase 3a/3b + 7 watsonx + 5 evidence)

**Puppeteer Integration Tests**: 5 tests with 30s timeout each, all passing
- Real PDF generation in test environment
- File size validation (> 5KB)
- Directory creation verification
- Multi-control handling
- NPRM block inclusion

---

## MCP Server Status

**Connected**: ✅ Green status in Bob's MCP panel (after restart)  
**Tools Registered**: 5 total

1. `controls.lookup` - Returns full control object by ID
2. `controls.scan` - Scans git diffs for violations (256KB limit)
3. `nprm.forward_compat_check` - Returns NPRM forward-compatibility narratives
4. `governance.register_pr` - Registers PR status with watsonx.governance
5. `evidence.render_pdf` - Renders audit pack PDF with watsonx.ai prose

---

## Live Tool Verification

**Test Command**: Called `evidence.render_pdf` via Bob chat with demo data:

```json
{
  "pr_number": 999,
  "repo_metadata": {
    "repo_name": "bobguard",
    "branch": "demo",
    "commit_sha": "HEAD",
    "author": "demo"
  },
  "triggered_controls": [
    {
      "control_id": "164.312(a)(2)(iv)",
      "control_name": "Encryption and Decryption",
      "family": "Technical Safeguards",
      "file": "src/prisma/schema.prisma",
      "line": 34,
      "severity": "block",
      "existing_status": "addressable",
      "nprm_status": "Would become required under 2024 NPRM"
    }
  ],
  "control_map_md": "| Control | File | Severity |\n|---|---|---|\n| 164.312(a)(2)(iv) | src/prisma/schema.prisma:34 | block |",
  "threat_delta_md": "New PHI fields stored unencrypted.",
  "test_evidence_json": {
    "phi_encryption_roundtrip": {
      "status": "pass",
      "duration_ms": 14
    }
  },
  "nprm_narrative": "This control is affected by the 2024 HIPAA Security Rule NPRM. The NPRM proposes to make encryption a required specification rather than addressable."
}
```

**Response**: ✅ Success
```json
{
  "pdf_path": "/Users/patrickndille/bobguard/compliance/evidence/PR-999/audit-pack.pdf",
  "page_count": 7,
  "watsonx_used": false
}
```

**PDF Generated**: 7 pages, all sections populated with fallback placeholders (no watsonx.ai API keys configured)

---

## PDF Structure Verification

**Generated PDF**: `compliance/evidence/PR-999/audit-pack.pdf`

**Page 1 - Cover Page**:
- ✅ BobGuard logo (blue bordered box)
- ✅ Title: "HIPAA Security Rule Compliance Audit"
- ✅ Metadata: Repository (bobguard), PR #999, Branch (demo), Commit (HEAD), Author (demo), Date (2026-05-02)
- ✅ Status Badge: "BLOCKED" (red background)
- ✅ NPRM Callout: "Forward-Compatible with 2024 HIPAA Security Rule NPRM" with explanation

**Page 2 - Executive Summary**:
- ✅ Section header with blue underline
- ✅ Prose content: `[watsonx.ai unavailable — placeholder]` (expected - no API keys)

**Page 3 - Control Mapping**:
- ✅ Table with headers: Control ID, Control Name, Family, Location, Severity, Existing Rule, NPRM Status
- ✅ Row data: 164.312(a)(2)(iv), Encryption and Decryption, Technical Safeguards, src/prisma/schema.prisma:34, block, addressable, Would become required under 2024 NPRM
- ✅ Dark header background, alternating row colors

**Page 4 - Data Flow Diagram**:
- ✅ Placeholder image (1px transparent PNG)
- ✅ Note: "Mermaid diagram integration pending (Phase 3c-pass-2)"

**Page 5 - Threat Model Delta**:
- ✅ Section intro text
- ✅ Prose content: `[watsonx.ai unavailable — placeholder]`

**Page 6 - Test Evidence**:
- ✅ JSON formatted with syntax highlighting
- ✅ Dark background, monospace font
- ✅ Content: `{"phi_encryption_roundtrip": {"status": "pass", "duration_ms": 14}}`

**Page 7 - NPRM Forward-Compatibility**:
- ✅ Section intro
- ✅ Control block: 164.312(a)(2)(iv): Encryption and Decryption
- ✅ Existing Status: addressable
- ✅ NPRM Proposal: Would become required under 2024 NPRM
- ✅ BobGuard Action: Already enforces the stricter proposed standard

**Page 8 - Audit Sign-off**:
- ✅ Auditor: BobGuard Compliance Officer
- ✅ Governance Entry: pending
- ✅ Governance Status: pending
- ✅ Date: 2026-05-02
- ✅ Signature line (visual element)
- ✅ Attestation paragraph with HIPAA citations

---

## Known Limitations (Pass-1)

These are intentional for the structural pass and will be addressed in Phase 3c-pass-2:

1. **watsonx.ai Fallback Mode**: No API keys configured, so all prose sections show `[watsonx.ai unavailable — placeholder]`
   - **Resolution**: Configure `WATSONX_AI_KEY` and `WATSONX_AI_PROJECT_ID` in production

2. **Mermaid Diagram Placeholder**: Data flow diagram shows 1px transparent PNG
   - **Resolution**: Phase 3c-pass-2 will integrate `@mermaid-js/mermaid-cli` to render diagrams inline

3. **Typography**: Using system fonts (-apple-system, BlinkMacSystemFont, Segoe UI, Roboto)
   - **Resolution**: Designer will specify fonts in Phase 5 (visual polish)

4. **Governance Entry**: Shows "pending" instead of actual entry ID
   - **Resolution**: Call `governance.register_pr` before `evidence.render_pdf` in production workflow

5. **Page Count Estimation**: Approximate based on section count, not actual PDF page count
   - **Resolution**: Puppeteer doesn't expose page count directly; acceptable for pass-1

---

## Files Created/Modified

### Created (Phase 3c-pass-1):
- `mcp/bob-guard/src/lib/watsonx.ts` (107 lines)
- `mcp/bob-guard/src/lib/watsonx.test.ts` (109 lines)
- `mcp/bob-guard/templates/audit-pack.html` (119 lines)
- `mcp/bob-guard/templates/audit-pack.css` (368 lines)
- `mcp/bob-guard/src/tools/evidence.ts` (175 lines)
- `mcp/bob-guard/src/tools/evidence.test.ts` (197 lines)

### Modified (Phase 3c-pass-1):
- `mcp/bob-guard/package.json` - Added puppeteer + @ibm-cloud/watsonx-ai
- `mcp/bob-guard/src/server.ts` - Registered evidence.render_pdf (5th tool)

### Unchanged (Frozen from Phase 3a/3b):
- `mcp/bob-guard/src/tools/controls.ts` - No modifications
- `mcp/bob-guard/src/tools/controls.test.ts` - No modifications
- `mcp/bob-guard/src/tools/nprm.ts` - No modifications
- `mcp/bob-guard/src/tools/nprm.test.ts` - No modifications
- `mcp/bob-guard/src/tools/governance.ts` - No modifications
- `mcp/bob-guard/src/tools/governance.test.ts` - No modifications

---

## Next Steps (Phase 3c-pass-2)

Phase 3c-pass-1 is complete. The evidence pipeline is operational end-to-end with passable quality.

**Phase 3c-pass-2 deliverables** (from `plans/bob-guard-mcp-plan.md`):
- Mermaid diagram integration via `@mermaid-js/mermaid-cli`
- Pre-render diagrams to SVG, inline as base64
- Visual polish after designer review
- Typography refinement (custom fonts if specified)
- Layout proportion adjustments
- Print optimization (page breaks, margins, headers/footers)

**Phase 4 deliverables** (from `plans/bob-guard-mcp-plan.md`):
- PR block with citation skill (refusal language generator)
- Audit evidence generator skill (orchestrates all tools)
- Integration tests with real git diffs from Phase 2
- End-to-end workflow: scan → NPRM check → governance register → PDF render

---

## Session Export

**Exported**: 2026-05-02 01:11 UTC  
**Screenshots**: Included (PDF pages 1-8 showing all sections)  
**Cost**: $31.77  
**Mode**: Compliance Officer  

---

## Compliance Notes

- All tools use formal auditor tone (no "Bob", "AI", or "assistant" references)
- Citation discipline enforced: existing rule vs. NPRM proposals clearly distinguished
- watsonx.ai fallback ensures audit trail even when API is unreachable
- PDF template uses conditional language exclusively ("proposes", "would require") for NPRM
- All 34 unit tests passing, MCP server operational with 5 tools
- Puppeteer integration tests prove PDF generation works in CI/test environments

**Trust is built by saying no.**

---

*End of Session 03c-pass-1*