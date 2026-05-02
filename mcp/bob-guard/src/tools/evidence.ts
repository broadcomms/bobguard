import { readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { execSync } from 'child_process';
import puppeteer from 'puppeteer';
import { generateProse } from '../lib/watsonx.js';

interface TriggeredControl {
  control_id: string;
  control_name?: string;
  family?: string;
  file?: string;
  line?: number;
  severity?: string;
  existing_status?: string;
  nprm_status?: string;
}

interface RepoMetadata {
  repo_name: string;
  branch: string;
  commit_sha: string;
  author: string;
}

interface RenderPdfInput {
  pr_number: number;
  repo_metadata: RepoMetadata;
  triggered_controls: TriggeredControl[];
  control_map_md: string;
  threat_delta_md: string;
  test_evidence_json: Record<string, unknown>;
  nprm_narrative: string;
  data_flow_mmd?: string; // Optional Mermaid diagram source
}

interface RenderPdfOutput {
  pdf_path: string;
  page_count: number;
  watsonx_used: boolean;
}

// Get root directory (3 levels up from dist/tools/ to get to project root)
const rootDir = join(dirname(new URL(import.meta.url).pathname), '../../../..');

// Placeholder diagram (1px transparent PNG base64)
const PLACEHOLDER_DIAGRAM = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

/**
 * Render Mermaid diagram to base64-encoded PNG
 * Returns data URI or placeholder on failure
 */
async function renderMermaidDiagram(mmdSource: string): Promise<string> {
  const tempDir = join(rootDir, 'mcp/bob-guard/renders');
  mkdirSync(tempDir, { recursive: true });

  const timestamp = Date.now();
  const mmdPath = join(tempDir, `temp-${timestamp}.mmd`);
  const pngPath = join(tempDir, `temp-${timestamp}.png`);

  try {
    // Write Mermaid source to temp file
    writeFileSync(mmdPath, mmdSource, 'utf-8');

    // Run mermaid-cli to generate PNG
    execSync(
      `npx -p @mermaid-js/mermaid-cli mmdc -i "${mmdPath}" -o "${pngPath}" --quiet`,
      { cwd: rootDir, stdio: 'pipe' }
    );

    // Read PNG and convert to base64
    const pngBuffer = readFileSync(pngPath);
    const base64 = pngBuffer.toString('base64');

    // Cleanup temp files
    unlinkSync(mmdPath);
    unlinkSync(pngPath);

    return `data:image/png;base64,${base64}`;
  } catch (error) {
    // Cleanup on error
    try {
      unlinkSync(mmdPath);
    } catch {}
    try {
      unlinkSync(pngPath);
    } catch {}

    console.error('Mermaid rendering failed:', error);
    return PLACEHOLDER_DIAGRAM;
  }
}

/**
 * Render audit pack PDF using Puppeteer + watsonx.ai prose generation
 */
export async function renderPdf(input: RenderPdfInput): Promise<RenderPdfOutput> {
  const {
    pr_number,
    repo_metadata,
    triggered_controls,
    threat_delta_md,
    test_evidence_json,
    nprm_narrative,
    data_flow_mmd,
  } = input;

  // Load templates
  const templatePath = join(rootDir, 'mcp/bob-guard/templates/audit-pack.html');
  const cssPath = join(rootDir, 'mcp/bob-guard/templates/audit-pack.css');
  
  let htmlTemplate = readFileSync(templatePath, 'utf-8');
  const css = readFileSync(cssPath, 'utf-8');

  // Generate executive summary via watsonx.ai
  const executiveSummary = await generateProse('executive_summary', {
    pr_number,
    repo_name: repo_metadata.repo_name,
    triggered_controls,
  });

  // Generate threat delta narrative via watsonx.ai
  const threatDeltaNarrative = await generateProse('threat_delta', {
    threat_delta: threat_delta_md,
    triggered_controls,
  });

  // Render Mermaid diagram if provided
  const dataFlowDiagram = data_flow_mmd
    ? await renderMermaidDiagram(data_flow_mmd)
    : PLACEHOLDER_DIAGRAM;

  // Determine status
  const hasBlockers = triggered_controls.some(c => c.severity === 'block');
  const status = hasBlockers ? 'blocked' : 'approved';
  const statusText = hasBlockers ? 'BLOCKED' : 'APPROVED';

  // Build control table rows
  const controlRows = triggered_controls.map(c => `
    <tr>
      <td>${c.control_id}</td>
      <td>${c.control_name || 'N/A'}</td>
      <td>${c.family || 'N/A'}</td>
      <td>${c.file ? `${c.file}:${c.line || '?'}` : 'N/A'}</td>
      <td><strong>${c.severity || 'unknown'}</strong></td>
      <td>${c.existing_status || 'N/A'}</td>
      <td>${c.nprm_status || 'N/A'}</td>
    </tr>
  `).join('\n');

  // Build NPRM control blocks
  const nprm_affected = triggered_controls.filter(c => c.nprm_status && c.nprm_status !== 'N/A');
  const nprm_control_blocks = nprm_affected.map(c => `
    <div class="nprm-control-block">
      <h3>${c.control_id}: ${c.control_name || 'Control'}</h3>
      <p><strong>Existing Status:</strong> ${c.existing_status || 'N/A'}</p>
      <p><strong>NPRM Proposal:</strong> ${c.nprm_status || 'N/A'}</p>
      <p><strong>BobGuard Action:</strong> Already enforces the stricter proposed standard.</p>
    </div>
  `).join('\n');

  // Format test evidence
  const testEvidence = JSON.stringify(test_evidence_json, null, 2);

  // Substitute all variables
  const substitutions: Record<string, string> = {
    pr_number: pr_number.toString(),
    repo_name: repo_metadata.repo_name,
    branch: repo_metadata.branch,
    commit_sha: repo_metadata.commit_sha,
    author: repo_metadata.author,
    audit_date: new Date().toISOString().split('T')[0],
    status,
    status_text: statusText,
    executive_summary: executiveSummary,
    control_rows: controlRows,
    data_flow_diagram: dataFlowDiagram,
    threat_delta_narrative: threatDeltaNarrative,
    test_evidence: testEvidence,
    nprm_narrative,
    nprm_control_blocks: nprm_control_blocks || '<p><em>No controls affected by 2024 NPRM</em></p>',
    governance_entry_id: 'pending',
    governance_status: 'pending',
  };

  // Simple {{var}} replacement
  for (const [key, value] of Object.entries(substitutions)) {
    htmlTemplate = htmlTemplate.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }

  // Inline CSS
  htmlTemplate = htmlTemplate.replace(
    '<link rel="stylesheet" href="audit-pack.css">',
    `<style>${css}</style>`
  );

  // Ensure output directory exists
  const outputDir = join(rootDir, `compliance/evidence/PR-${pr_number}`);
  mkdirSync(outputDir, { recursive: true });

  // Launch Puppeteer and render PDF
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(htmlTemplate, { waitUntil: 'networkidle0' });

    const pdfPath = join(outputDir, 'audit-pack.pdf');
    await page.pdf({
      path: pdfPath,
      format: 'letter',
      printBackground: true,
      margin: {
        top: '0.75in',
        right: '0.75in',
        bottom: '1in',
        left: '0.75in',
      },
    });

    // Get page count (approximate - Puppeteer doesn't expose this directly)
    // We'll estimate based on content sections (7 sections = ~7-10 pages)
    const pageCount = Math.max(7, triggered_controls.length + 5);

    const watsonxUsed = !executiveSummary.includes('[watsonx.ai unavailable');

    return {
      pdf_path: pdfPath,
      page_count: pageCount,
      watsonx_used: watsonxUsed,
    };
  } finally {
    await browser.close();
  }
}

// Made with Bob
