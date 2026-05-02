import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync, existsSync, rmSync } from 'fs';

const mockHttp = vi.hoisted(() => ({ httpJsonRequest: vi.fn() }));
vi.mock('../lib/http.js', () => mockHttp);

import { createGovernanceRegisterPRTool } from './governance.js';

const IAM_URL = 'https://iam.cloud.ibm.com/identity/token';
const GOV_URL = 'https://api.example.com/openscale/test-instance/v2/subscriptions';

const okIamResponse = {
  status: 200,
  body: JSON.stringify({ access_token: 'test-iam-access-token' }),
};
const okGovResponse = (count = 0) => ({
  status: 200,
  body: JSON.stringify({ subscriptions: new Array(count).fill({}) }),
});

function stubHttp(iam: { status: number; body: string }, gov: { status: number; body: string }) {
  mockHttp.httpJsonRequest.mockImplementation(async (opts: any) =>
    opts.url.includes('iam.cloud.ibm.com') ? iam : gov
  );
}

describe('Governance Registration Tool', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    const testDir = 'compliance/evidence/PR-9999';
    if (existsSync(testDir)) rmSync(testDir, { recursive: true, force: true });
    mockHttp.httpJsonRequest.mockReset();
  });

  afterEach(() => {
    process.env = originalEnv;
    const testDir = 'compliance/evidence/PR-9999';
    if (existsSync(testDir)) rmSync(testDir, { recursive: true, force: true });
  });

  it('returns status "live" when IAM exchange + governance liveness check both succeed', async () => {
    process.env.WATSONX_GOVERNANCE_URL = GOV_URL;
    process.env.WATSONX_GOVERNANCE_KEY = 'test-apikey';
    process.env.WATSONX_GOVERNANCE_INSTANCE_ID = 'test-instance';
    process.env.GITHUB_REPO = 'test/repo';

    stubHttp(okIamResponse, okGovResponse(0));

    const tool = createGovernanceRegisterPRTool();
    const result = await tool({
      pr_number: 9999,
      controls: [{ control_id: '164.312(a)(2)(iv)', status: 'violated' }],
      status: 'blocked',
      evidence_path: 'compliance/evidence/PR-9999/audit-pack.pdf',
    });

    const response = JSON.parse(result.content[0].text);
    expect(response.status).toBe('live');
    expect(response.entry_id).toMatch(/^live-/);

    expect(mockHttp.httpJsonRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        url: IAM_URL,
        body: expect.stringContaining('apikey=test-apikey'),
      })
    );
    expect(mockHttp.httpJsonRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        url: GOV_URL,
        headers: expect.objectContaining({
          Authorization: 'Bearer test-iam-access-token',
        }),
      })
    );

    const fileContent = JSON.parse(
      readFileSync('compliance/evidence/PR-9999/governance-register-result.json', 'utf-8')
    );
    expect(fileContent.mode).toBe('live');
    expect(fileContent.ibm_governance_check).toMatchObject({
      url: GOV_URL,
      instance_id: 'test-instance',
      iam_authenticated: true,
      http_status: 200,
      resource_count: 0,
    });
  });

  it('falls back to mocked mode when IAM token exchange returns 401', async () => {
    process.env.WATSONX_GOVERNANCE_URL = GOV_URL;
    process.env.WATSONX_GOVERNANCE_KEY = 'bad-apikey';

    stubHttp({ status: 401, body: '{}' }, okGovResponse());

    const tool = createGovernanceRegisterPRTool();
    const result = await tool({
      pr_number: 9999,
      controls: [{ control_id: '164.312(b)', status: 'violated' }],
      status: 'blocked',
      evidence_path: 'compliance/evidence/PR-9999/audit-pack.pdf',
    });

    const response = JSON.parse(result.content[0].text);
    expect(response.status).toBe('mocked');
    expect(response.entry_id).toMatch(/^mock-/);

    const fileContent = JSON.parse(
      readFileSync('compliance/evidence/PR-9999/governance-register-result.json', 'utf-8')
    );
    expect(fileContent.mode).toBe('mocked');
    expect(fileContent.ibm_governance_check).toBeUndefined();
  });

  it('falls back to mocked mode when the governance liveness check returns 5xx', async () => {
    process.env.WATSONX_GOVERNANCE_URL = GOV_URL;
    process.env.WATSONX_GOVERNANCE_KEY = 'test-apikey';

    stubHttp(okIamResponse, { status: 500, body: 'Internal server error' });

    const tool = createGovernanceRegisterPRTool();
    const result = await tool({
      pr_number: 9999,
      controls: [{ control_id: '164.312(d)', status: 'violated' }],
      status: 'blocked',
      evidence_path: 'compliance/evidence/PR-9999/audit-pack.pdf',
    });

    const response = JSON.parse(result.content[0].text);
    expect(response.status).toBe('mocked');
    expect(existsSync('compliance/evidence/PR-9999/governance-register-result.json')).toBe(true);
  });

  it('falls back to mocked mode on transport errors', async () => {
    process.env.WATSONX_GOVERNANCE_URL = GOV_URL;
    process.env.WATSONX_GOVERNANCE_KEY = 'test-apikey';

    mockHttp.httpJsonRequest.mockRejectedValue(new Error('Network error'));

    const tool = createGovernanceRegisterPRTool();
    const result = await tool({
      pr_number: 9999,
      controls: [{ control_id: '164.312(e)(1)', status: 'violated' }],
      status: 'blocked',
      evidence_path: 'compliance/evidence/PR-9999/audit-pack.pdf',
    });

    const response = JSON.parse(result.content[0].text);
    expect(response.status).toBe('mocked');
  });

  it('falls back to mocked mode when env vars are missing', async () => {
    delete process.env.WATSONX_GOVERNANCE_URL;
    delete process.env.WATSONX_GOVERNANCE_KEY;

    const tool = createGovernanceRegisterPRTool();
    const result = await tool({
      pr_number: 9999,
      controls: [{ control_id: '164.312(a)(1)', status: 'compliant' }],
      status: 'approved',
      evidence_path: 'compliance/evidence/PR-9999/audit-pack.pdf',
    });

    const response = JSON.parse(result.content[0].text);
    expect(response.status).toBe('mocked');
    expect(existsSync('compliance/evidence/PR-9999/governance-register-result.json')).toBe(true);
  });

  it('always writes to filename "governance-register-result.json" regardless of mode', async () => {
    delete process.env.WATSONX_GOVERNANCE_URL;
    delete process.env.WATSONX_GOVERNANCE_KEY;

    const tool = createGovernanceRegisterPRTool();
    await tool({
      pr_number: 9999,
      controls: [{ control_id: '164.312(e)(1)', status: 'violated' }],
      status: 'blocked',
      evidence_path: 'compliance/evidence/PR-9999/audit-pack.pdf',
    });

    const filePath = 'compliance/evidence/PR-9999/governance-register-result.json';
    expect(existsSync(filePath)).toBe(true);
    expect(JSON.parse(readFileSync(filePath, 'utf-8')).mode).toBe('mocked');
  });
});

// Made with Bob
