/**
 * Governance Registration Tool
 * 
 * Registers PR compliance status with watsonx.governance.
 * Falls back to local JSON file if API is unreachable.
 */

import { randomUUID } from 'crypto';
import { writeFileSync, mkdirSync } from 'fs';
import { z } from 'zod';

// Zod schema for API response validation (only at API boundary)
const GovernanceAPIResponseSchema = z.object({
  entry_id: z.string(),
  status: z.string(),
  timestamp: z.string().optional(),
});

interface GovernancePayload {
  pr_number: number;
  controls: Array<{ control_id: string; status: string }>;
  status: 'reviewed' | 'approved' | 'blocked';
  evidence_path: string;
  timestamp: string;
  repo: string;
}

interface GovernanceResult {
  entry_id: string;
  status: 'live' | 'mocked';
}

/**
 * Creates the governance.register_pr tool handler
 */
export function createGovernanceRegisterPRTool() {
  return async (args: {
    pr_number: number;
    controls: Array<{ control_id: string; status: string }>;
    status: 'reviewed' | 'approved' | 'blocked';
    evidence_path: string;
  }) => {
    const { pr_number, controls, status, evidence_path } = args;

    // Build payload
    const payload: GovernancePayload = {
      pr_number,
      controls,
      status,
      evidence_path,
      timestamp: new Date().toISOString(),
      repo: process.env.GITHUB_REPO || 'unknown',
    };

    // Check if we have required env vars for live mode
    const governanceURL = process.env.WATSONX_GOVERNANCE_URL;
    const governanceKey = process.env.WATSONX_GOVERNANCE_KEY;

    let result: GovernanceResult;

    if (governanceURL && governanceKey) {
      // Attempt live registration
      try {
        const response = await fetch(governanceURL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${governanceKey}`,
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          // 5xx or other error - fall back
          throw new Error(`API returned ${response.status}`);
        }

        const data = await response.json();
        
        // Validate response with Zod (API boundary)
        const validated = GovernanceAPIResponseSchema.parse(data);

        result = {
          entry_id: validated.entry_id,
          status: 'live',
        };
      } catch (error) {
        // Network error, 5xx, or validation error - fall back to mocked mode
        console.error('[governance.register_pr] API unreachable, falling back to mocked mode:', error);
        result = await fallbackToMockedMode(pr_number, payload);
      }
    } else {
      // Missing env vars - fall back to mocked mode
      console.error('[governance.register_pr] Missing WATSONX_GOVERNANCE_URL or WATSONX_GOVERNANCE_KEY, using mocked mode');
      result = await fallbackToMockedMode(pr_number, payload);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  };
}

/**
 * Fallback: Write governance registration to local JSON file
 */
async function fallbackToMockedMode(
  pr_number: number,
  payload: GovernancePayload
): Promise<GovernanceResult> {
  const entry_id = `mock-${randomUUID()}`;
  
  const mockedEntry = {
    mode: 'mocked',
    entry_id,
    payload,
    timestamp: new Date().toISOString(),
  };

  // Write to compliance/evidence/PR-{n}/governance-register-result.json
  const evidenceDir = `compliance/evidence/PR-${pr_number}`;
  const filePath = `${evidenceDir}/governance-register-result.json`;

  try {
    mkdirSync(evidenceDir, { recursive: true });
    writeFileSync(filePath, JSON.stringify(mockedEntry, null, 2));
    console.error(`[governance.register_pr] Wrote mocked entry to ${filePath}`);
  } catch (error) {
    console.error(`[governance.register_pr] Failed to write mocked entry:`, error);
  }

  return {
    entry_id,
    status: 'mocked',
  };
}

// Made with Bob
