/**
 * Governance Registration Tool
 *
 * Registers PR compliance status against a watsonx.governance / IBM Cloud
 * AI OpenScale instance. The "live" path:
 *   1. Exchanges WATSONX_GOVERNANCE_KEY (an IAM apikey) for an IAM access
 *      token via https://iam.cloud.ibm.com/identity/token.
 *   2. GETs WATSONX_GOVERNANCE_URL (e.g. .../v2/subscriptions) as a
 *      liveness check against the configured instance.
 *   3. Persists the audit register entry to
 *      compliance/evidence/PR-{n}/governance-register-result.json with
 *      mode: "live" and an `ibm_governance_check` block proving the IBM
 *      round-trip happened.
 *
 * Falls back to mode: "mocked" if env vars are missing OR any step in the
 * IBM round-trip fails — never throws.
 *
 * Implementation note: uses node:https rather than the global fetch (undici)
 * because the OpenScale gateway returns HTTP 500 to undici-shaped requests
 * for our user's instance, while accepting node:https requests cleanly. Same
 * URL, same access token. Likely a header / negotiation quirk in undici.
 */

import { randomUUID } from 'crypto';
import { writeFileSync, mkdirSync } from 'fs';
import { httpJsonRequest } from '../lib/http.js';

interface GovernancePayload {
  pr_number: number;
  controls: Array<{ control_id: string; status: string }>;
  status: 'reviewed' | 'approved' | 'blocked';
  evidence_path: string;
  timestamp: string;
  repo: string;
}

interface IbmGovernanceCheck {
  url: string;
  instance_id: string | null;
  iam_authenticated: boolean;
  http_status: number;
  resource_count: number | null;
  checked_at: string;
}

interface GovernanceResult {
  entry_id: string;
  status: 'live' | 'mocked';
}

const IAM_TOKEN_URL = 'https://iam.cloud.ibm.com/identity/token';

/**
 * Exchange an IBM Cloud apikey for a short-lived IAM access token.
 */
async function exchangeIamToken(apikey: string): Promise<string> {
  const body = new URLSearchParams({
    grant_type: 'urn:ibm:params:oauth:grant-type:apikey',
    apikey,
  }).toString();
  const response = await httpJsonRequest({
    method: 'POST',
    url: IAM_TOKEN_URL,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      'Content-Length': Buffer.byteLength(body).toString(),
    },
    body,
  });
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`IAM token exchange failed: HTTP ${response.status}`);
  }
  const data = JSON.parse(response.body) as { access_token?: string };
  if (!data.access_token) {
    throw new Error('IAM token exchange returned no access_token');
  }
  return data.access_token;
}

/**
 * Liveness check against the watsonx.governance / OpenScale instance.
 * Returns the resource count if the response body is shaped like
 * { service_providers: [...] } or { subscriptions: [...] }, else null.
 */
async function checkGovernanceInstance(
  url: string,
  accessToken: string
): Promise<{ status: number; resourceCount: number | null }> {
  const response = await httpJsonRequest({
    method: 'GET',
    url,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Governance liveness check failed: HTTP ${response.status}`);
  }
  let resourceCount: number | null = null;
  try {
    const body = JSON.parse(response.body) as Record<string, unknown>;
    for (const value of Object.values(body)) {
      if (Array.isArray(value)) {
        resourceCount = value.length;
        break;
      }
    }
  } catch {
    // Non-JSON body — instance is live but we can't count
  }
  return { status: response.status, resourceCount };
}

export function createGovernanceRegisterPRTool() {
  return async (args: {
    pr_number: number;
    controls: Array<{ control_id: string; status: string }>;
    status: 'reviewed' | 'approved' | 'blocked';
    evidence_path: string;
  }) => {
    const { pr_number, controls, status, evidence_path } = args;

    const payload: GovernancePayload = {
      pr_number,
      controls,
      status,
      evidence_path,
      timestamp: new Date().toISOString(),
      repo: process.env.GITHUB_REPO || 'unknown',
    };

    const governanceURL = process.env.WATSONX_GOVERNANCE_URL;
    const governanceKey = process.env.WATSONX_GOVERNANCE_KEY;
    const instanceId = process.env.WATSONX_GOVERNANCE_INSTANCE_ID || null;

    let result: GovernanceResult;

    if (governanceURL && governanceKey) {
      try {
        const accessToken = await exchangeIamToken(governanceKey);
        const check = await checkGovernanceInstance(governanceURL, accessToken);

        const ibmCheck: IbmGovernanceCheck = {
          url: governanceURL,
          instance_id: instanceId,
          iam_authenticated: true,
          http_status: check.status,
          resource_count: check.resourceCount,
          checked_at: new Date().toISOString(),
        };

        const entry_id = `live-${randomUUID()}`;
        writeAuditRegister(pr_number, {
          mode: 'live',
          entry_id,
          payload,
          ibm_governance_check: ibmCheck,
          timestamp: new Date().toISOString(),
        });
        result = { entry_id, status: 'live' };
      } catch (error) {
        console.error(
          '[governance.register_pr] Live IBM round-trip failed, falling back to mocked mode:',
          error
        );
        result = await fallbackToMockedMode(pr_number, payload);
      }
    } else {
      console.error(
        '[governance.register_pr] Missing WATSONX_GOVERNANCE_URL or WATSONX_GOVERNANCE_KEY, using mocked mode'
      );
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

async function fallbackToMockedMode(
  pr_number: number,
  payload: GovernancePayload
): Promise<GovernanceResult> {
  const entry_id = `mock-${randomUUID()}`;
  writeAuditRegister(pr_number, {
    mode: 'mocked',
    entry_id,
    payload,
    timestamp: new Date().toISOString(),
  });
  return { entry_id, status: 'mocked' };
}

function writeAuditRegister(pr_number: number, entry: Record<string, unknown>): void {
  const evidenceDir = `compliance/evidence/PR-${pr_number}`;
  const filePath = `${evidenceDir}/governance-register-result.json`;
  try {
    mkdirSync(evidenceDir, { recursive: true });
    writeFileSync(filePath, JSON.stringify(entry, null, 2));
    console.error(`[governance.register_pr] Wrote ${entry.mode} entry to ${filePath}`);
  } catch (error) {
    console.error('[governance.register_pr] Failed to write audit register:', error);
  }
}

// Made with Bob
