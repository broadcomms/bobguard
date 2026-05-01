/**
 * Production-quality audit logging helper for HIPAA §164.312(b) compliance.
 * 
 * ⚠️ DELIBERATELY UNUSED in the sample app routes to demonstrate
 * HIPAA §164.312(b) violation (missing audit logs on PHI access).
 * This is the "right answer" that BobGuard's Compliance Officer mode
 * will propose as a fix.
 * 
 * In production:
 * - Send to a SIEM (Splunk, Datadog, ELK)
 * - Store in tamper-evident log storage
 * - Implement log retention policy (typically 6+ years for HIPAA)
 * - Alert on suspicious patterns
 * - Protect logs from unauthorized access
 */

export interface AuditLogEntry {
  timestamp: string;
  actor: {
    userId: string;
    email?: string;
    role?: string;
    ip?: string;
  };
  action: 'create' | 'read' | 'update' | 'delete' | 'access' | 'export';
  resource: {
    type: 'patient' | 'encounter' | 'user' | 'message';
    id: string;
    phi?: boolean; // Flag if resource contains PHI
  };
  outcome: 'success' | 'failure';
  reason?: string; // For failures or access denials
  metadata?: Record<string, unknown>;
}

/**
 * Log an audit event to stdout in JSON Lines format.
 * In production, send to a SIEM or tamper-evident log store.
 */
export function log(entry: Omit<AuditLogEntry, 'timestamp'>): void {
  const auditEntry: AuditLogEntry = {
    timestamp: new Date().toISOString(),
    ...entry,
  };

  // JSON Lines format: one JSON object per line
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(auditEntry));
}

/**
 * Create an audit log middleware for Express routes.
 * Automatically logs all requests to PHI-bearing endpoints.
 */
export function createAuditMiddleware() {
  return (req: any, res: any, next: any) => {
    const startTime = Date.now();

    // Capture response
    const originalSend = res.send;
    res.send = function (data: any) {
      const duration = Date.now() - startTime;

      log({
        actor: {
          userId: req.user?.id || 'anonymous',
          email: req.user?.email,
          ip: req.ip || req.connection.remoteAddress,
        },
        action: mapMethodToAction(req.method),
        resource: {
          type: inferResourceType(req.path),
          id: req.params.id || 'collection',
          phi: true, // Assume PHI for this demo
        },
        outcome: res.statusCode < 400 ? 'success' : 'failure',
        metadata: {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          durationMs: duration,
        },
      });

      return originalSend.call(this, data);
    };

    next();
  };
}

function mapMethodToAction(method: string): AuditLogEntry['action'] {
  switch (method.toUpperCase()) {
    case 'GET':
      return 'read';
    case 'POST':
      return 'create';
    case 'PUT':
    case 'PATCH':
      return 'update';
    case 'DELETE':
      return 'delete';
    default:
      return 'access';
  }
}

function inferResourceType(path: string): AuditLogEntry['resource']['type'] {
  if (path.includes('patient')) return 'patient';
  if (path.includes('encounter')) return 'encounter';
  if (path.includes('message')) return 'message';
  return 'user';
}

// Made with Bob
