import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createGovernanceRegisterPRTool } from './governance.js';
import { readFileSync, existsSync, rmSync } from 'fs';

describe('Governance Registration Tool', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment
    process.env = { ...originalEnv };
    
    // Clean up any test evidence directories
    const testDir = 'compliance/evidence/PR-9999';
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    // Restore environment
    process.env = originalEnv;
    
    // Clean up test evidence directories
    const testDir = 'compliance/evidence/PR-9999';
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should return status "live" when API returns success', async () => {
    // Mock environment variables
    process.env.WATSONX_GOVERNANCE_URL = 'https://api.example.com/governance';
    process.env.WATSONX_GOVERNANCE_KEY = 'test-key';
    process.env.GITHUB_REPO = 'test/repo';

    // Mock fetch to return success
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        entry_id: 'live-12345',
        status: 'registered',
        timestamp: new Date().toISOString(),
      }),
    });

    const tool = createGovernanceRegisterPRTool();

    const result = await tool({
      pr_number: 9999,
      controls: [{ control_id: '164.312(a)(2)(iv)', status: 'violated' }],
      status: 'blocked',
      evidence_path: 'compliance/evidence/PR-9999/audit-pack.pdf',
    });

    const response = JSON.parse(result.content[0].text);

    expect(response.entry_id).toBe('live-12345');
    expect(response.status).toBe('live');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.example.com/governance',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-key',
        }),
      })
    );
  });

  it('should fall back to mocked mode when fetch throws network error', async () => {
    // Mock environment variables
    process.env.WATSONX_GOVERNANCE_URL = 'https://api.example.com/governance';
    process.env.WATSONX_GOVERNANCE_KEY = 'test-key';
    process.env.GITHUB_REPO = 'test/repo';

    // Mock fetch to throw network error
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

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

    // Verify file was written
    const filePath = 'compliance/evidence/PR-9999/governance-register-result.json';
    expect(existsSync(filePath)).toBe(true);

    const fileContent = JSON.parse(readFileSync(filePath, 'utf-8'));
    expect(fileContent.mode).toBe('mocked');
    expect(fileContent.entry_id).toBe(response.entry_id);
    expect(fileContent.payload.pr_number).toBe(9999);
  });

  it('should fall back to mocked mode when API returns 500', async () => {
    // Mock environment variables
    process.env.WATSONX_GOVERNANCE_URL = 'https://api.example.com/governance';
    process.env.WATSONX_GOVERNANCE_KEY = 'test-key';
    process.env.GITHUB_REPO = 'test/repo';

    // Mock fetch to return 500
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Internal server error' }),
    });

    const tool = createGovernanceRegisterPRTool();

    const result = await tool({
      pr_number: 9999,
      controls: [{ control_id: '164.312(d)', status: 'violated' }],
      status: 'blocked',
      evidence_path: 'compliance/evidence/PR-9999/audit-pack.pdf',
    });

    const response = JSON.parse(result.content[0].text);

    expect(response.status).toBe('mocked');
    expect(response.entry_id).toMatch(/^mock-/);

    // Verify file was written
    const filePath = 'compliance/evidence/PR-9999/governance-register-result.json';
    expect(existsSync(filePath)).toBe(true);
  });

  it('should use filename "governance-register-result.json" regardless of mode', async () => {
    // Test mocked mode (no env vars)
    delete process.env.WATSONX_GOVERNANCE_URL;
    delete process.env.WATSONX_GOVERNANCE_KEY;

    const tool = createGovernanceRegisterPRTool();

    await tool({
      pr_number: 9999,
      controls: [{ control_id: '164.312(e)(1)', status: 'violated' }],
      status: 'blocked',
      evidence_path: 'compliance/evidence/PR-9999/audit-pack.pdf',
    });

    // Verify exact filename
    const filePath = 'compliance/evidence/PR-9999/governance-register-result.json';
    expect(existsSync(filePath)).toBe(true);

    const fileContent = JSON.parse(readFileSync(filePath, 'utf-8'));
    expect(fileContent.mode).toBe('mocked');
  });

  it('should fall back to mocked mode when env vars are missing', async () => {
    // No environment variables set
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
    expect(response.entry_id).toMatch(/^mock-/);

    // Verify file was written
    const filePath = 'compliance/evidence/PR-9999/governance-register-result.json';
    expect(existsSync(filePath)).toBe(true);
  });
});

// Made with Bob
