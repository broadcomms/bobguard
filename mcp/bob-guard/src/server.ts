#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createControlsLookupTool, createControlsScanTool } from './tools/controls.js';
import { createNPRMForwardCompatCheckTool } from './tools/nprm.js';
import { createGovernanceRegisterPRTool } from './tools/governance.js';
import { renderPdf } from './tools/evidence.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * BobGuard MCP Server
 * 
 * Custom MCP server for HIPAA compliance enforcement.
 * Loads control catalogs once at startup and exposes tools via stdio transport.
 */

// Load control catalogs once at startup (not lazy-loaded)
const CONTROLS_DIR = process.env.BOBGUARD_CONTROLS_DIR || join(__dirname, '../../../compliance/controls');

console.error('[bob-guard] Loading control catalogs...');

const hipaaControls = JSON.parse(
  readFileSync(join(CONTROLS_DIR, 'hipaa.json'), 'utf-8')
);

const hipaaExtendedControls = JSON.parse(
  readFileSync(join(CONTROLS_DIR, 'hipaa-technical-extended.json'), 'utf-8')
);

const nprm_overlay = JSON.parse(
  readFileSync(join(CONTROLS_DIR, 'hipaa-2024-nprm-overlay.json'), 'utf-8')
);

console.error(`[bob-guard] Loaded ${hipaaControls.length} base controls`);
console.error(`[bob-guard] Loaded ${hipaaExtendedControls.controls.length} extended controls`);
console.error(`[bob-guard] Loaded NPRM overlay with ${nprm_overlay.proposed_changes.length} proposed changes`);

// Merge extended controls with base controls
// Extended controls have bobguard.* fields that augment the base
const controlsMap = new Map();

// First, load all base controls
for (const control of hipaaControls) {
  controlsMap.set(control.control_id, control);
}

// Then, merge in bobguard extensions
for (const extendedControl of hipaaExtendedControls.controls) {
  const baseControl = controlsMap.get(extendedControl.control_id);
  if (baseControl) {
    // Merge bobguard fields onto base control
    controlsMap.set(extendedControl.control_id, {
      ...baseControl,
      ...extendedControl,
    });
  } else {
    // Extended control without base (shouldn't happen, but handle it)
    controlsMap.set(extendedControl.control_id, extendedControl);
  }
}

console.error(`[bob-guard] Merged catalog contains ${controlsMap.size} controls`);

// Create MCP server
const server = new Server(
  {
    name: 'bob-guard',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register tools
const controlsLookup = createControlsLookupTool(controlsMap);
const controlsScan = createControlsScanTool(controlsMap);
const nprm_forward_compat_check = createNPRMForwardCompatCheckTool(nprm_overlay, controlsMap);
const governance_register_pr = createGovernanceRegisterPRTool();
const evidence_render_pdf = renderPdf;

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'controls.lookup',
        description: 'Returns the full control object for a given HIPAA control ID. Includes base fields from hipaa.json merged with bobguard.* extensions from hipaa-technical-extended.json.',
        inputSchema: {
          type: 'object',
          properties: {
            control_id: {
              type: 'string',
              description: 'HIPAA control ID (e.g., "164.312(a)(2)(iv)")',
            },
          },
          required: ['control_id'],
        },
      },
      {
        name: 'controls.scan',
        description: 'Scans a git diff for HIPAA violations using regex patterns from bobguard.code_patterns. Returns findings sorted by severity (block → warn). Caps diff input at 256KB.',
        inputSchema: {
          type: 'object',
          properties: {
            diff: {
              type: 'string',
              description: 'Unified git diff to scan',
            },
            lang: {
              type: 'string',
              description: 'Language filter (e.g., "ts", "py"). Defaults to "ts".',
              default: 'ts',
            },
          },
          required: ['diff'],
        },
      },
      {
        name: 'nprm.forward_compat_check',
        description: 'Checks if triggered controls are affected by the 2024 HIPAA Security Rule NPRM and returns forward-compatibility narratives.',
        inputSchema: {
          type: 'object',
          properties: {
            triggered_controls: {
              type: 'array',
              description: 'Array of triggered control objects',
              items: {
                type: 'object',
                properties: {
                  control_id: {
                    type: 'string',
                    description: 'HIPAA control ID',
                  },
                },
                required: ['control_id'],
              },
            },
          },
          required: ['triggered_controls'],
        },
      },
      {
        name: 'governance.register_pr',
        description: 'Registers PR compliance status with watsonx.governance. Falls back to local JSON file if API is unreachable.',
        inputSchema: {
          type: 'object',
          properties: {
            pr_number: {
              type: 'number',
              description: 'Pull request number',
            },
            controls: {
              type: 'array',
              description: 'Array of control status objects',
              items: {
                type: 'object',
                properties: {
                  control_id: {
                    type: 'string',
                  },
                  status: {
                    type: 'string',
                  },
                },
              },
            },
            status: {
              type: 'string',
              enum: ['reviewed', 'approved', 'blocked'],
              description: 'Overall PR status',
            },
            evidence_path: {
              type: 'string',
              description: 'Path to evidence PDF',
            },
          },
          required: ['pr_number', 'controls', 'status', 'evidence_path'],
        },
      },
      {
        name: 'evidence.render_pdf',
        description: 'Renders a HIPAA compliance audit pack PDF with watsonx.ai-generated prose, control mappings, threat analysis, and test evidence.',
        inputSchema: {
          type: 'object',
          properties: {
            pr_number: {
              type: 'number',
              description: 'Pull request number',
            },
            repo_metadata: {
              type: 'object',
              description: 'Repository metadata',
              properties: {
                repo_name: { type: 'string' },
                branch: { type: 'string' },
                commit_sha: { type: 'string' },
                author: { type: 'string' },
              },
              required: ['repo_name', 'branch', 'commit_sha', 'author'],
            },
            triggered_controls: {
              type: 'array',
              description: 'Array of triggered control objects',
              items: {
                type: 'object',
                properties: {
                  control_id: { type: 'string' },
                  control_name: { type: 'string' },
                  family: { type: 'string' },
                  file: { type: 'string' },
                  line: { type: 'number' },
                  severity: { type: 'string' },
                  existing_status: { type: 'string' },
                  nprm_status: { type: 'string' },
                },
              },
            },
            control_map_md: {
              type: 'string',
              description: 'Markdown table of control mappings',
            },
            threat_delta_md: {
              type: 'string',
              description: 'Threat model delta description',
            },
            test_evidence_json: {
              type: 'object',
              description: 'Test evidence as JSON object',
            },
            nprm_narrative: {
              type: 'string',
              description: 'NPRM forward-compatibility narrative',
            },
          },
          required: ['pr_number', 'repo_metadata', 'triggered_controls', 'control_map_md', 'threat_delta_md', 'test_evidence_json', 'nprm_narrative'],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (!args) {
    throw new Error('Missing arguments');
  }

  if (name === 'controls.lookup') {
    return controlsLookup(args as { control_id: string });
  }

  if (name === 'controls.scan') {
    return controlsScan(args as { diff: string; lang?: string });
  }

  if (name === 'nprm.forward_compat_check') {
    return nprm_forward_compat_check(args as { triggered_controls: Array<{ control_id: string }> });
  }

  if (name === 'governance.register_pr') {
    return governance_register_pr(args as {
      pr_number: number;
      controls: Array<{ control_id: string; status: string }>;
      status: 'reviewed' | 'approved' | 'blocked';
      evidence_path: string;
    });
  }

  if (name === 'evidence.render_pdf') {
    const result = await evidence_render_pdf(args as any);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  throw new Error(`Unknown tool: ${name}`);
});

// Start server with stdio transport
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[bob-guard] MCP server running on stdio');
}

main().catch((error) => {
  console.error('[bob-guard] Fatal error:', error);
  process.exit(1);
});

// Made with Bob