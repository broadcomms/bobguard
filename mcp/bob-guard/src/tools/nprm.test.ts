import { describe, it, expect } from 'vitest';
import { createNPRMForwardCompatCheckTool } from './nprm.js';

describe('NPRM Forward Compatibility Tool', () => {
  // Mock NPRM overlay data
  const mockNPRMOverlay = {
    _meta: {
      name: 'HIPAA Security Rule 2024 NPRM Forward-Compatibility Overlay',
      source: 'HHS OCR, RIN 0945-AA22',
      framing_disclaimer: 'The 2024 NPRM is a PROPOSED rule, not law.',
    },
    proposed_changes: [
      {
        change_id: 'NPRM-003',
        title: 'Encryption of ePHI: addressable → required',
        summary:
          'The NPRM proposes to expressly require encryption of ePHI at rest and in transit, with limited exceptions, eliminating the existing per-entity reasonableness analysis.',
        affects_controls: ['164.312(a)(2)(iv)', '164.312(e)(2)(ii)'],
        bobguard_action:
          "BobGuard's encryption-at-rest and TLS controls are `severity: block` regardless of the addressable status under the existing rule.",
        nprm_reference_section:
          'Preamble, II.B.; §164.312(a)(2)(iv); §164.312(e)(2)(ii)',
      },
      {
        change_id: 'NPRM-002',
        title: 'Explicit Multi-Factor Authentication (MFA) requirement',
        summary:
          "The NPRM proposes to add an explicit MFA requirement and a defined term for 'Multi-factor Authentication.'",
        affects_controls: ['164.312(d)'],
        bobguard_action:
          "BobGuard's pattern set under 164.312(d) flags single-factor authentication on ePHI-bearing systems with `severity: block`.",
        nprm_reference_section: 'Preamble, II.B.10–11 (Definitions)',
      },
    ],
  };

  // Mock controls map
  const mockControlsMap = new Map([
    [
      '164.312(a)(2)(iv)',
      {
        control_id: '164.312(a)(2)(iv)',
        control_name: 'Encryption and Decryption (Addressable)',
      },
    ],
    [
      '164.312(d)',
      {
        control_id: '164.312(d)',
        control_name: 'Person or Entity Authentication',
      },
    ],
    [
      '164.312(b)',
      {
        control_id: '164.312(b)',
        control_name: 'Audit Controls',
      },
    ],
  ]);

  it('should return enriched object for §164.312(a)(2)(iv) (encryption — would_become_required)', () => {
    const tool = createNPRMForwardCompatCheckTool(mockNPRMOverlay, mockControlsMap);

    const result = tool({
      triggered_controls: [{ control_id: '164.312(a)(2)(iv)' }],
    });

    const response = JSON.parse(result.content[0].text);

    expect(response).toHaveLength(1);
    expect(response[0].control_id).toBe('164.312(a)(2)(iv)');
    expect(response[0].existing_status).toBe('addressable');
    expect(response[0].nprm_proposal).toContain('proposes to expressly require encryption');
    expect(response[0].bobguard_action).toContain('severity: block');
    expect(response[0].nprm_reference_section).toContain('§164.312(a)(2)(iv)');
  });

  it('should return enriched object for §164.312(d) (MFA — would_explicitly_require_MFA)', () => {
    const tool = createNPRMForwardCompatCheckTool(mockNPRMOverlay, mockControlsMap);

    const result = tool({
      triggered_controls: [{ control_id: '164.312(d)' }],
    });

    const response = JSON.parse(result.content[0].text);

    expect(response).toHaveLength(1);
    expect(response[0].control_id).toBe('164.312(d)');
    expect(response[0].existing_status).toBe('required');
    expect(response[0].nprm_proposal).toContain('proposes to add an explicit MFA requirement');
    expect(response[0].bobguard_action).toContain('single-factor authentication');
    expect(response[0].nprm_reference_section).toContain('Preamble, II.B.10–11');
  });

  it('should return empty array when triggered_controls contains only unaffected control_ids', () => {
    const tool = createNPRMForwardCompatCheckTool(mockNPRMOverlay, mockControlsMap);

    const result = tool({
      triggered_controls: [{ control_id: '164.312(b)' }],
    });

    const response = JSON.parse(result.content[0].text);

    expect(response).toHaveLength(0);
  });

  it('should handle multiple triggered controls', () => {
    const tool = createNPRMForwardCompatCheckTool(mockNPRMOverlay, mockControlsMap);

    const result = tool({
      triggered_controls: [
        { control_id: '164.312(a)(2)(iv)' },
        { control_id: '164.312(d)' },
      ],
    });

    const response = JSON.parse(result.content[0].text);

    expect(response).toHaveLength(2);
    expect(response[0].control_id).toBe('164.312(a)(2)(iv)');
    expect(response[1].control_id).toBe('164.312(d)');
  });

  it('should use "proposes" / "would" wording in narratives (never "HIPAA requires")', () => {
    const tool = createNPRMForwardCompatCheckTool(mockNPRMOverlay, mockControlsMap);

    const result = tool({
      triggered_controls: [
        { control_id: '164.312(a)(2)(iv)' },
        { control_id: '164.312(d)' },
      ],
    });

    const response = JSON.parse(result.content[0].text);

    // Check that all proposals use future/conditional language
    for (const item of response) {
      expect(item.nprm_proposal.toLowerCase()).toMatch(/proposes|would/);
      expect(item.nprm_proposal.toLowerCase()).not.toContain('hipaa requires');
    }
  });
});

// Made with Bob
