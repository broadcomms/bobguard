/**
 * Controls Tools
 * 
 * - controls.lookup: Returns full control object by ID
 * - controls.scan: Scans diffs for HIPAA violations using regex patterns
 */

interface Control {
  control_id: string;
  control_name: string;
  family: string;
  description: string;
  keywords: string[];
  bobguard?: {
    severity: 'block' | 'warn';
    code_patterns?: Array<{
      lang: string;
      kind: string;
      match: string;
      comment: string;
    }>;
    refusal_template?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface ScanFinding {
  control_id: string;
  control_name: string;
  file: string;
  line: number;
  snippet: string;
  severity: 'block' | 'warn';
  code_pattern_comment: string;
}

const DIFF_SIZE_LIMIT = 256 * 1024; // 256KB

/**
 * Creates the controls.lookup tool handler
 */
export function createControlsLookupTool(controlsMap: Map<string, Control>) {
  return (args: { control_id: string }) => {
    const { control_id } = args;

    const control = controlsMap.get(control_id);

    if (!control) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: 'Control not found',
              control_id,
              available_count: controlsMap.size,
            }, null, 2),
          },
        ],
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(control, null, 2),
        },
      ],
    };
  };
}

/**
 * Creates the controls.scan tool handler
 */
export function createControlsScanTool(controlsMap: Map<string, Control>) {
  return (args: { diff: string; lang?: string }) => {
    const { diff, lang = 'ts' } = args;

    // Check diff size limit (stdio buffer protection)
    if (diff.length > DIFF_SIZE_LIMIT) {
      const warningFinding: ScanFinding = {
        control_id: 'DIFF_SIZE_LIMIT',
        control_name: 'Diff Size Limit Exceeded',
        file: '(multiple files)',
        line: 0,
        snippet: `Diff size: ${(diff.length / 1024).toFixed(1)}KB (limit: 256KB)`,
        severity: 'warn',
        code_pattern_comment: 'Diff exceeds 256KB stdio buffer limit. Scan truncated.',
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              findings: [warningFinding],
              truncated: true,
            }, null, 2),
          },
        ],
      };
    }

    const findings: ScanFinding[] = [];

    // Iterate all controls with bobguard.code_patterns
    for (const control of controlsMap.values()) {
      if (!control.bobguard?.code_patterns) {
        continue;
      }

      // Filter patterns by language
      const patterns = control.bobguard.code_patterns.filter(
        (pattern) => pattern.lang === lang
      );

      for (const pattern of patterns) {
        if (pattern.kind !== 'regex') {
          continue; // Only regex patterns supported in Phase 3a
        }

        try {
          const regex = new RegExp(pattern.match, 'gm');
          let match;

          while ((match = regex.exec(diff)) !== null) {
            // Extract file and line number from diff context
            const { file, line, snippet } = extractDiffContext(diff, match.index);

            findings.push({
              control_id: control.control_id,
              control_name: control.control_name,
              file,
              line,
              snippet,
              severity: control.bobguard.severity,
              code_pattern_comment: pattern.comment,
            });
          }
        } catch (error) {
          // Invalid regex - skip this pattern
          console.error(`[controls.scan] Invalid regex for ${control.control_id}:`, error);
        }
      }
    }

    // Sort findings by severity (block first, then warn)
    findings.sort((a, b) => {
      if (a.severity === 'block' && b.severity === 'warn') return -1;
      if (a.severity === 'warn' && b.severity === 'block') return 1;
      return 0;
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            findings,
            total: findings.length,
            by_severity: {
              block: findings.filter((f) => f.severity === 'block').length,
              warn: findings.filter((f) => f.severity === 'warn').length,
            },
          }, null, 2),
        },
      ],
    };
  };
}

/**
 * Extracts file, line number, and snippet from diff context
 * Returns ±3 lines of context around the match
 */
function extractDiffContext(diff: string, matchIndex: number): {
  file: string;
  line: number;
  snippet: string;
} {
  const lines = diff.substring(0, matchIndex).split('\n');
  const matchLine = lines.length;

  // Find the most recent file header (diff --git a/... b/...)
  let file = '(unknown)';
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].startsWith('diff --git')) {
      const match = lines[i].match(/b\/(.+)$/);
      if (match) {
        file = match[1];
      }
      break;
    }
  }

  // Find the most recent hunk header (@@ -X,Y +A,B @@)
  let line = 0;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].startsWith('@@')) {
      const match = lines[i].match(/\+(\d+)/);
      if (match) {
        line = parseInt(match[1], 10);
        // Add lines since the hunk header
        for (let j = i + 1; j < lines.length; j++) {
          if (lines[j].startsWith('+') || !lines[j].startsWith('-')) {
            line++;
          }
        }
      }
      break;
    }
  }

  // Extract ±3 lines of context
  const allLines = diff.split('\n');
  const startLine = Math.max(0, matchLine - 3);
  const endLine = Math.min(allLines.length, matchLine + 4);
  const snippet = allLines.slice(startLine, endLine).join('\n');

  return { file, line, snippet };
}

// Made with Bob