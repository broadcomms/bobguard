// @ts-ignore - SDK types may not be fully available
import { WatsonXAI } from '@ibm-cloud/watsonx-ai';
// @ts-ignore - authenticator types
import { IamAuthenticator } from '@ibm-cloud/watsonx-ai/authentication/index.js';

type Section = 'executive_summary' | 'threat_delta' | 'nprm_narrative' | 'control_rationale';

interface SectionContext {
  pr_number?: number;
  repo_name?: string;
  triggered_controls?: Array<{ control_id: string; severity?: string }>;
  control_map?: string;
  threat_delta?: string;
  nprm_affected?: Array<{ control_id: string; nprm_proposal?: string }>;
  [key: string]: unknown;
}

const FALLBACK_TEXT = '[watsonx.ai unavailable — placeholder]';

// Prompt templates: each requests STRUCTURED MARKDOWN with H3 sub-headings,
// bullet lists, and bold key terms. The PDF template adds the section H2,
// so prompts must NOT restate the section title or include leading separators.
const PROMPTS: Record<Section, (ctx: SectionContext) => string> = {
  executive_summary: (ctx) => `You are a HIPAA auditor. Produce an executive summary using EXACTLY this structure (markdown):

### Audit Scope
1-2 sentences naming the PR, the repository, and the controls reviewed.

### Findings Summary
Bulleted list, one bullet per triggered control. Format each bullet as: **§{control_id} — {control_name}:** {one-sentence finding}.

### Recommendation
2-3 sentences with the audit decision (BLOCKED / APPROVED) and the immediate next steps.

Do NOT include an 'Executive Summary' heading — the template adds that. Do NOT use --- separators. Use formal auditor tone. Do not reference AI, Bob, or assistants.

Context:
- PR Number: ${ctx.pr_number || 'N/A'}
- Repository: ${ctx.repo_name || 'N/A'}
- Triggered Controls: ${ctx.triggered_controls?.map(c => `${c.control_id} (${c.severity || 'unknown'})`).join(', ') || 'None'}`,

  threat_delta: (ctx) => `You are a HIPAA auditor producing a NEW threat model delta from scratch, using ONLY the control violations listed below as input. You MUST output every sub-section. Do NOT abbreviate or summarize.

Output format (markdown, EXACT structure):

### New Attack Surface
2-3 sentences describing what attack vectors this PR introduces, given the violated controls below.

### Critical and High Risks
A bulleted list. One bullet for EACH violated control. Format: **{Severity}** — {one-sentence description of the risk}, violating §{control_id}. Severity tokens MUST be one of: Critical, High, Medium.

### Recommended Mitigations
A bulleted list. One bullet for EACH violated control. Format: §{control_id}: {one-sentence fix}.

### Aggregate Risk Level
One sentence stating the overall classification (CRITICAL / HIGH / MEDIUM) and the rationale.

Hard rules:
- Do NOT include a top-level heading (no H1, no H2). The four H3 sub-headings above are required.
- Do NOT use --- separators.
- Do NOT add a "Conclusion" or "Summary" section.
- Do NOT reference AI, Bob, or assistants.
- Severity-to-control mapping (treat as ground truth):
  - 164.312(a)(2)(iv) Encryption: Critical
  - 164.312(b) Audit Controls: High
  - 164.312(d) Authentication: High
  - 164.312(e)(1) Transmission Security: High
  - 164.312(c)(1) Integrity: Medium

Violated controls (one bullet per control in your output):
${ctx.triggered_controls?.map(c => `- ${c.control_id} (severity: ${c.severity || 'unknown'})`).join('\n') || 'None'}`,

  nprm_narrative: (ctx) => `You are a HIPAA auditor. Produce a forward-compatibility narrative using EXACTLY this structure (markdown):

### Affected Controls
Bulleted list. One bullet per affected control. Format: **§{control_id}:** {what the NPRM proposes}.

### BobGuard Position
2-3 sentences explaining that BobGuard already enforces the stricter proposed standard. Use conditional language for the NPRM ("would require", "the NPRM proposes") — never assert HIPAA already mandates what is only proposed.

Do NOT include a top-level heading. Do NOT use --- separators. Do not reference AI, Bob, or assistants.

Affected Controls Context:
${ctx.nprm_affected?.map(c => `- ${c.control_id}: ${c.nprm_proposal || 'No proposal details'}`).join('\n') || 'None'}`,

  control_rationale: (ctx) => `You are a HIPAA auditor. Produce a one-paragraph control rationale (markdown):

A single 3-4 sentence paragraph explaining (a) what control **§${ctx.triggered_controls?.[0]?.control_id || 'N/A'}** requires, (b) how the code change violates it, and (c) the compliance risk. Do NOT add headings or bullets. Do NOT use --- separators. Use formal auditor tone.

Context: ${ctx.control_map || 'No context provided'}`,
};

/**
 * Generate prose for a specific section using watsonx.ai granite-3-8b-instruct.
 * Falls back to placeholder text if API is unavailable or env vars missing.
 */
export async function generateProse(section: Section, context: SectionContext): Promise<string> {
  const apiKey = process.env.WATSONX_AI_KEY;
  const projectId = process.env.WATSONX_AI_PROJECT_ID;
  const modelId = process.env.WATSONX_AI_MODEL || 'ibm/granite-3-8b-instruct';

  // Fallback if env vars missing
  if (!apiKey || !projectId) {
    console.warn(`[watsonx] Missing env vars (WATSONX_AI_KEY or WATSONX_AI_PROJECT_ID) - using fallback for section: ${section}`);
    return FALLBACK_TEXT;
  }

  try {
    // @ts-ignore - SDK types may not match exactly
    const watsonx = WatsonXAI.newInstance({
      version: '2024-05-31',
      serviceUrl: process.env.WATSONX_AI_URL || 'https://us-south.ml.cloud.ibm.com',
      authenticator: new IamAuthenticator({ apikey: apiKey }),
    });

    const prompt = PROMPTS[section](context);

    // @ts-ignore - SDK method signature may vary
    const response = await watsonx.generateText({
      input: prompt,
      modelId,
      projectId,
      parameters: {
        // Structured-markdown output (multiple H3 sections + bullets) needs
        // more headroom than free prose. 1500 covers exec summary and threat
        // delta comfortably; cheaper sections finish well below the cap.
        max_new_tokens: 1500,
        temperature: 0.3,
        top_p: 0.9,
        repetition_penalty: 1.1,
      },
    });

    // @ts-ignore - Response structure may vary
    const generatedText = response.result?.results?.[0]?.generated_text?.trim();
    
    if (!generatedText) {
      console.warn(`[watsonx] Empty response for section: ${section} - using fallback`);
      return FALLBACK_TEXT;
    }

    if (process.env.WATSONX_DEBUG === '1') {
      console.error(`\n--- [watsonx debug] section=${section} raw output:\n${generatedText}\n--- end ---\n`);
    }

    return generatedText;
  } catch (error) {
    console.error(`[watsonx] Error generating prose for section ${section}:`, error);
    return FALLBACK_TEXT;
  }
}

// Made with Bob
