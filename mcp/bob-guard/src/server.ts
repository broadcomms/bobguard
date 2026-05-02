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

console.error(`[bob-guard] Loaded ${hipaaControls.length} base controls`);
console.error(`[bob-guard] Loaded ${hipaaExtendedControls.controls.length} extended controls`);

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