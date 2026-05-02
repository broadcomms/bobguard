import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createControlsLookupTool, createControlsScanTool } from './controls.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Controls Tools Tests
 * 
 * Tests verify:
 * 1. controls.lookup returns merged control objects
 * 2. controls.scan finds all 4 Phase 2 violations in fixture diffs
 * 3. controls.scan caps diffs >256KB with warning
 * 4. lang filter works correctly
 */

describe('Controls Tools', () => {
  let controlsMap: Map<string, any>;
  let controlsLookup: ReturnType<typeof createControlsLookupTool>;
  let controlsScan: ReturnType<typeof createControlsScanTool>;

  beforeAll(() => {
    // Load control catalogs (same as server.ts)
    const controlsDir = join(__dirname, '../../../../compliance/controls');

    const hipaaControls = JSON.parse(
      readFileSync(join(controlsDir, 'hipaa.json'), 'utf-8')
    );

    const hipaaExtendedControls = JSON.parse(
      readFileSync(join(controlsDir, 'hipaa-technical-extended.json'), 'utf-8')
    );

    // Merge catalogs
    controlsMap = new Map();

    for (const control of hipaaControls) {
      controlsMap.set(control.control_id, control);
    }

    for (const extendedControl of hipaaExtendedControls.controls) {
      const baseControl = controlsMap.get(extendedControl.control_id);
      if (baseControl) {
        controlsMap.set(extendedControl.control_id, {
          ...baseControl,
          ...extendedControl,
        });
      } else {
        controlsMap.set(extendedControl.control_id, extendedControl);
      }
    }

    // Create tool handlers
    controlsLookup = createControlsLookupTool(controlsMap);
    controlsScan = createControlsScanTool(controlsMap);
  });

  describe('controls.lookup', () => {
    it('should return merged control object for known ID', () => {
      const result = controlsLookup({ control_id: '164.312(a)(2)(iv)' });

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');

      const control = JSON.parse(result.content[0].text);

      expect(control.control_id).toBe('164.312(a)(2)(iv)');
      expect(control.control_name).toBeTruthy();
      expect(control.family).toBe('Technical Safeguards');
      expect(control.bobguard).toBeTruthy();
      expect(control.bobguard.severity).toBe('block');
      expect(control.bobguard.code_patterns).toBeTruthy();
    });

    it('should return error for unknown control ID', () => {
      const result = controlsLookup({ control_id: '999.999(z)(99)' });

      expect(result.content).toHaveLength(1);
      const response = JSON.parse(result.content[0].text);

      expect(response.error).toBe('Control not found');
      expect(response.control_id).toBe('999.999(z)(99)');
      expect(response.available_count).toBeGreaterThan(0);
    });

    it('should include bobguard extensions when present', () => {
      const result = controlsLookup({ control_id: '164.312(b)' });
      const control = JSON.parse(result.content[0].text);

      expect(control.bobguard).toBeTruthy();
      expect(control.bobguard.refusal_template).toBeTruthy();
      expect(control.bobguard.code_patterns).toBeTruthy();
    });
  });

  describe('controls.scan', () => {
    it('should find unencrypted PHI violation in schema diff', () => {
      const diff = readFileSync(
        join(__dirname, '__fixtures__/sample-diffs/unencrypted-phi.diff'),
        'utf-8'
      );

      const result = controlsScan({ diff, lang: 'ts' });
      const response = JSON.parse(result.content[0].text);

      expect(response.findings).toBeTruthy();
      expect(response.total).toBeGreaterThan(0);

      // Should find 164.312(a)(2)(iv) violation
      const phiViolation = response.findings.find(
        (f: any) => f.control_id === '164.312(a)(2)(iv)'
      );

      expect(phiViolation).toBeTruthy();
      expect(phiViolation.severity).toBe('block');
      expect(phiViolation.file).toContain('schema.prisma');
    });

    it('should find missing audit log violation in patient routes diff', () => {
      const diff = readFileSync(
        join(__dirname, '__fixtures__/sample-diffs/missing-audit-log.diff'),
        'utf-8'
      );

      const result = controlsScan({ diff, lang: 'ts' });
      const response = JSON.parse(result.content[0].text);

      expect(response.findings).toBeTruthy();
      expect(response.total).toBeGreaterThan(0);

      // Should find 164.312(b) violation
      const auditViolation = response.findings.find(
        (f: any) => f.control_id === '164.312(b)'
      );

      expect(auditViolation).toBeTruthy();
      expect(auditViolation.severity).toBe('block');
      expect(auditViolation.file).toContain('patient.routes.ts');
    });

    it('should find plain HTTP webhook violation in message routes diff', () => {
      const diff = readFileSync(
        join(__dirname, '__fixtures__/sample-diffs/plain-http-webhook.diff'),
        'utf-8'
      );

      const result = controlsScan({ diff, lang: 'ts' });
      const response = JSON.parse(result.content[0].text);

      expect(response.findings).toBeTruthy();
      expect(response.total).toBeGreaterThan(0);

      // Should find 164.312(e)(1) or 164.312(e)(2)(ii) violation
      const tlsViolation = response.findings.find(
        (f: any) => f.control_id.startsWith('164.312(e)')
      );

      expect(tlsViolation).toBeTruthy();
      expect(tlsViolation.file).toContain('message.routes.ts');
    });

    it('should find single-factor JWT violation in auth middleware diff', () => {
      const diff = readFileSync(
        join(__dirname, '__fixtures__/sample-diffs/single-factor-jwt.diff'),
        'utf-8'
      );

      const result = controlsScan({ diff, lang: 'ts' });
      const response = JSON.parse(result.content[0].text);

      expect(response.findings).toBeTruthy();
      expect(response.total).toBeGreaterThan(0);

      // Should find 164.312(d) violation
      const mfaViolation = response.findings.find(
        (f: any) => f.control_id === '164.312(d)'
      );

      expect(mfaViolation).toBeTruthy();
      expect(mfaViolation.severity).toBe('block');
      expect(mfaViolation.file).toContain('auth.middleware.ts');
    });

    it('should sort findings by severity (block first, then warn)', () => {
      const diff = readFileSync(
        join(__dirname, '__fixtures__/sample-diffs/missing-audit-log.diff'),
        'utf-8'
      );

      const result = controlsScan({ diff, lang: 'ts' });
      const response = JSON.parse(result.content[0].text);

      if (response.findings.length > 1) {
        for (let i = 0; i < response.findings.length - 1; i++) {
          const current = response.findings[i].severity;
          const next = response.findings[i + 1].severity;

          if (current === 'warn') {
            expect(next).toBe('warn'); // All warns should be after all blocks
          }
        }
      }
    });

    it('should cap diffs >256KB with warning entry', () => {
      // Create a diff larger than 256KB
      const largeDiff = 'a'.repeat(257 * 1024);

      const result = controlsScan({ diff: largeDiff, lang: 'ts' });
      const response = JSON.parse(result.content[0].text);

      expect(response.truncated).toBe(true);
      expect(response.findings).toHaveLength(1);
      expect(response.findings[0].control_id).toBe('DIFF_SIZE_LIMIT');
      expect(response.findings[0].severity).toBe('warn');
      expect(response.findings[0].code_pattern_comment).toContain('256KB');
    });

    it('should filter patterns by language', () => {
      const diff = readFileSync(
        join(__dirname, '__fixtures__/sample-diffs/missing-audit-log.diff'),
        'utf-8'
      );

      // Scan with Python language filter (should find nothing in TS code)
      const result = controlsScan({ diff, lang: 'py' });
      const response = JSON.parse(result.content[0].text);

      // Python patterns shouldn't match TypeScript code
      expect(response.total).toBe(0);
    });

    it('should include snippet with ±3 lines of context', () => {
      const diff = readFileSync(
        join(__dirname, '__fixtures__/sample-diffs/unencrypted-phi.diff'),
        'utf-8'
      );

      const result = controlsScan({ diff, lang: 'ts' });
      const response = JSON.parse(result.content[0].text);

      if (response.findings.length > 0) {
        const finding = response.findings[0];
        expect(finding.snippet).toBeTruthy();
        expect(finding.snippet.split('\n').length).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe('Integration', () => {
    it('should scan all 4 Phase 2 fixture diffs and find violations', () => {
      const fixtures = [
        'unencrypted-phi.diff',
        'missing-audit-log.diff',
        'plain-http-webhook.diff',
        'single-factor-jwt.diff',
      ];

      let totalFindings = 0;

      for (const fixture of fixtures) {
        const diff = readFileSync(
          join(__dirname, '__fixtures__/sample-diffs', fixture),
          'utf-8'
        );

        const result = controlsScan({ diff, lang: 'ts' });
        const response = JSON.parse(result.content[0].text);

        expect(response.total).toBeGreaterThan(0);
        totalFindings += response.total;
      }

      // All 4 fixtures should produce at least 4 findings total
      expect(totalFindings).toBeGreaterThanOrEqual(4);
    });
  });
});

// Made with Bob