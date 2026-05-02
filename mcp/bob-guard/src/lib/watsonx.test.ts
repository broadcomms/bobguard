import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateProse } from './watsonx';

// Mock the watsonx SDK + the authenticator import
vi.mock('@ibm-cloud/watsonx-ai', () => ({
  WatsonXAI: {
    newInstance: vi.fn(() => ({
      generateText: vi.fn(async () => ({
        result: {
          results: [
            {
              generated_text: 'This is a mock auditor response from granite-3-8b-instruct.',
            },
          ],
        },
      })),
    })),
  },
}));

vi.mock('@ibm-cloud/watsonx-ai/authentication/index.js', () => ({
  // Class form so `new IamAuthenticator(...)` works under vitest's mock
  // (vi.fn(opts => opts) is not a constructor).
  IamAuthenticator: class {
    apikey: string;
    constructor(opts: { apikey: string }) {
      this.apikey = opts.apikey;
    }
  },
}));

describe('watsonx.generateProse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set env vars for tests
    process.env.WATSONX_AI_KEY = 'test-api-key';
    process.env.WATSONX_AI_PROJECT_ID = 'test-project-id';
  });

  it('generates executive_summary prose', async () => {
    const result = await generateProse('executive_summary', {
      pr_number: 123,
      repo_name: 'bobguard',
      triggered_controls: [
        { control_id: '164.312(a)(2)(iv)', severity: 'block' },
      ],
    });

    expect(result).toBeTruthy();
    expect(result).not.toBe('[watsonx.ai unavailable — placeholder]');
    expect(result).toContain('mock auditor response');
  });

  it('generates threat_delta prose', async () => {
    const result = await generateProse('threat_delta', {
      threat_delta: 'New PHI fields stored unencrypted',
      triggered_controls: [
        { control_id: '164.312(a)(2)(iv)', severity: 'block' },
      ],
    });

    expect(result).toBeTruthy();
    expect(result).not.toBe('[watsonx.ai unavailable — placeholder]');
  });

  it('generates nprm_narrative prose', async () => {
    const result = await generateProse('nprm_narrative', {
      nprm_affected: [
        {
          control_id: '164.312(a)(2)(iv)',
          nprm_proposal: 'Would become required',
        },
      ],
    });

    expect(result).toBeTruthy();
    expect(result).not.toBe('[watsonx.ai unavailable — placeholder]');
  });

  it('generates control_rationale prose', async () => {
    const result = await generateProse('control_rationale', {
      triggered_controls: [{ control_id: '164.312(b)' }],
      control_map: 'Audit logging missing',
    });

    expect(result).toBeTruthy();
    expect(result).not.toBe('[watsonx.ai unavailable — placeholder]');
  });

  it('falls back to placeholder when env vars missing', async () => {
    delete process.env.WATSONX_AI_KEY;
    delete process.env.WATSONX_AI_PROJECT_ID;

    const result = await generateProse('executive_summary', {
      pr_number: 123,
    });

    expect(result).toBe('[watsonx.ai unavailable — placeholder]');
  });

  it('falls back to placeholder on API error', async () => {
    const { WatsonXAI } = await import('@ibm-cloud/watsonx-ai');
    vi.mocked(WatsonXAI.newInstance).mockReturnValueOnce({
      generateText: vi.fn().mockRejectedValueOnce(new Error('API error')),
    } as any);

    const result = await generateProse('executive_summary', {
      pr_number: 123,
    });

    expect(result).toBe('[watsonx.ai unavailable — placeholder]');
  });

  it('falls back to placeholder on empty response', async () => {
    const { WatsonXAI } = await import('@ibm-cloud/watsonx-ai');
    vi.mocked(WatsonXAI.newInstance).mockReturnValueOnce({
      generateText: vi.fn().mockResolvedValueOnce({
        result: { results: [{ generated_text: '' }] },
      }),
    } as any);

    const result = await generateProse('executive_summary', {
      pr_number: 123,
    });

    expect(result).toBe('[watsonx.ai unavailable — placeholder]');
  });
});

// Made with Bob
