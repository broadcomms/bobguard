#!/usr/bin/env node
import { config as loadDotenv } from 'dotenv';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '../../..');

loadDotenv({ path: join(repoRoot, '.env') });

const { renderPdf } = await import('../dist/tools/evidence.js');
const evidenceDir = join(repoRoot, 'compliance/evidence/PR-1');

const testEvidence = JSON.parse(readFileSync(join(evidenceDir, 'test-evidence.json'), 'utf-8'));
const controlMap = readFileSync(join(evidenceDir, 'control-map.md'), 'utf-8');
const threatDelta = readFileSync(join(evidenceDir, 'threat-delta.md'), 'utf-8');
const dataFlowMmd = readFileSync(join(evidenceDir, 'data-flow.mmd'), 'utf-8');

const triggered = [
  { control_id: '164.312(a)(2)(iv)', control_name: 'Encryption and Decryption', family: 'Technical Safeguards', file: 'src/prisma/schema.prisma', line: 26, severity: 'block', existing_status: 'Addressable', nprm_status: 'Required (NPRM)' },
  { control_id: '164.312(b)', control_name: 'Audit Controls', family: 'Technical Safeguards', file: 'src/routes/patient.routes.ts', line: 31, severity: 'block', existing_status: 'Required', nprm_status: 'Required (clarified)' },
  { control_id: '164.312(d)', control_name: 'Person or Entity Authentication', family: 'Technical Safeguards', file: 'src/middleware/auth.middleware.ts', line: 43, severity: 'block', existing_status: 'Required', nprm_status: 'Required + MFA (NPRM)' },
  { control_id: '164.312(e)(1)', control_name: 'Transmission Security', family: 'Technical Safeguards', file: 'src/routes/message.routes.ts', line: 31, severity: 'block', existing_status: 'Required', nprm_status: 'Required' },
  { control_id: '164.312(c)(1)', control_name: 'Integrity', family: 'Technical Safeguards', file: 'src/routes/patient.routes.ts', line: 204, severity: 'warn', existing_status: 'Required', nprm_status: 'N/A' },
];

const result = await renderPdf({
  pr_number: 1,
  repo_metadata: {
    repo_name: 'bobguard',
    branch: 'main',
    commit_sha: 'afc682d',
    author: 'Patrick Ejelle-Ndille',
  },
  triggered_controls: triggered,
  control_map_md: controlMap,
  threat_delta_md: threatDelta,
  test_evidence_json: testEvidence,
  nprm_narrative: 'Two of the triggered controls — §164.312(a)(2)(iv) (Encryption) and §164.312(d) (Authentication) — are directly affected by the 2024 HIPAA Security Rule NPRM (HHS OCR, RIN 0945-AA22, January 6, 2025). The NPRM elevates encryption from Addressable to Required and explicitly mandates multi-factor authentication. BobGuard already enforces both stricter standards, so no additional remediation is required to maintain forward-compatibility.',
  data_flow_mmd: dataFlowMmd,
});

console.log(JSON.stringify(result, null, 2));
