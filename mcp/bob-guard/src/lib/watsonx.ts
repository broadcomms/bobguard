// @ts-ignore - SDK types may not be fully available
import { WatsonXAI } from '@ibm-cloud/watsonx-ai';

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

// Prompt templates for each section (auditor tone, no AI/Bob/assistant references)
const PROMPTS: Record<Section, (ctx: SectionContext) => string> = {
  executive_summary: (ctx) => `You are a HIPAA compliance auditor writing an executive summary for a pull request audit.

PR Number: ${ctx.pr_number || 'N/A'}
Repository: ${ctx.repo_name || 'N/A'}
Triggered Controls: ${ctx.triggered_controls?.map(c => c.control_id).join(', ') || 'None'}

Write a concise 2-3 paragraph executive summary that:
1. States the audit scope and PR context
2. Summarizes the compliance findings (violations detected, severity levels)
3. Provides a clear recommendation (approve, block, or conditional approval)

Use formal auditor language. Do not reference AI, Bob, or assistants. Write as if a human compliance officer produced this report.`,

  threat_delta: (ctx) => `You are a HIPAA compliance auditor analyzing threat model changes introduced by a code change.

Threat Delta Context:
${ctx.threat_delta || 'No threat delta provided'}

Control Violations:
${ctx.triggered_controls?.map(c => `- ${c.control_id} (${c.severity || 'unknown'})`).join('\n') || 'None'}

Write a 2-3 paragraph threat model delta analysis that:
1. Describes new attack vectors or vulnerabilities introduced
2. Explains how these threats relate to the HIPAA controls violated
3. Assesses the risk level and potential impact on ePHI

Use formal security auditor language. Do not reference AI, Bob, or assistants.`,

  nprm_narrative: (ctx) => `You are a HIPAA compliance auditor explaining forward-compatibility with the 2024 HIPAA Security Rule NPRM.

Affected Controls:
${ctx.nprm_affected?.map(c => `- ${c.control_id}: ${c.nprm_proposal || 'No proposal details'}`).join('\n') || 'None'}

Write a 1-2 paragraph forward-compatibility narrative that:
1. Explains which controls are affected by the 2024 NPRM proposed changes
2. Notes that BobGuard already enforces the stricter proposed standards
3. Uses conditional language ("the NPRM proposes", "would require") - never assert HIPAA already requires what is only proposed

Use formal auditor language. Do not reference AI, Bob, or assistants.`,

  control_rationale: (ctx) => `You are a HIPAA compliance auditor explaining why a specific control was triggered.

Control: ${ctx.triggered_controls?.[0]?.control_id || 'N/A'}
Context: ${ctx.control_map || 'No context provided'}

Write a 1 paragraph rationale that:
1. Explains what the control requires
2. Describes how the code change violates this requirement
3. States the compliance risk

Use formal auditor language. Do not reference AI, Bob, or assistants.`,
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
      serviceUrl: 'https://us-south.ml.cloud.ibm.com',
    });

    const prompt = PROMPTS[section](context);

    // @ts-ignore - SDK method signature may vary
    const response = await watsonx.textGeneration({
      input: prompt,
      modelId,
      projectId,
      parameters: {
        max_new_tokens: 500,
        temperature: 0.3, // Low temperature for consistent, formal output
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

    return generatedText;
  } catch (error) {
    console.error(`[watsonx] Error generating prose for section ${section}:`, error);
    return FALLBACK_TEXT;
  }
}

// Made with Bob
