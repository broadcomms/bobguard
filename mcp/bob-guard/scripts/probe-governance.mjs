import { config as loadDotenv } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: '/Users/patrickndille/bobguard/.env' });
const { createGovernanceRegisterPRTool } = await import('/Users/patrickndille/bobguard/mcp/bob-guard/dist/tools/governance.js');
process.chdir('/Users/patrickndille/bobguard');
const tool = createGovernanceRegisterPRTool();
const result = await tool({
  pr_number: 1,
  controls: [
    { control_id: '164.312(a)(2)(iv)', status: 'violated' },
    { control_id: '164.312(b)', status: 'violated' },
    { control_id: '164.312(d)', status: 'violated' },
    { control_id: '164.312(e)(1)', status: 'violated' },
    { control_id: '164.312(c)(1)', status: 'warning' },
  ],
  status: 'blocked',
  evidence_path: 'compliance/evidence/PR-1/audit-pack.pdf',
});
console.log('Tool returned:');
console.log(result.content[0].text);
