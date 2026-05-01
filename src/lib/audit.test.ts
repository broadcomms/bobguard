import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { log } from './audit.js';

describe('audit', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe('log', () => {
    it('should log audit entry in JSON Lines format', () => {
      log({
        actor: {
          userId: 'user-123',
          email: 'doctor@example.com',
          role: 'clinician',
        },
        action: 'read',
        resource: {
          type: 'patient',
          id: 'patient-456',
          phi: true,
        },
        outcome: 'success',
      });

      expect(consoleLogSpy).toHaveBeenCalledOnce();
      
      const loggedData = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(loggedData).toMatchObject({
        actor: {
          userId: 'user-123',
          email: 'doctor@example.com',
          role: 'clinician',
        },
        action: 'read',
        resource: {
          type: 'patient',
          id: 'patient-456',
          phi: true,
        },
        outcome: 'success',
      });
      expect(loggedData.timestamp).toBeDefined();
      expect(new Date(loggedData.timestamp).toISOString()).toBe(loggedData.timestamp);
    });

    it('should include failure reason when provided', () => {
      log({
        actor: {
          userId: 'user-123',
        },
        action: 'delete',
        resource: {
          type: 'patient',
          id: 'patient-789',
        },
        outcome: 'failure',
        reason: 'Insufficient permissions',
      });

      const loggedData = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(loggedData.reason).toBe('Insufficient permissions');
    });

    it('should include metadata when provided', () => {
      log({
        actor: {
          userId: 'user-123',
          ip: '192.168.1.1',
        },
        action: 'update',
        resource: {
          type: 'encounter',
          id: 'encounter-001',
        },
        outcome: 'success',
        metadata: {
          changedFields: ['notes', 'diagnosis'],
          requestId: 'req-abc-123',
        },
      });

      const loggedData = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(loggedData.metadata).toEqual({
        changedFields: ['notes', 'diagnosis'],
        requestId: 'req-abc-123',
      });
    });

    it('should handle minimal audit entry', () => {
      log({
        actor: {
          userId: 'anonymous',
        },
        action: 'access',
        resource: {
          type: 'user',
          id: 'user-999',
        },
        outcome: 'failure',
      });

      expect(consoleLogSpy).toHaveBeenCalledOnce();
      const loggedData = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(loggedData.actor.userId).toBe('anonymous');
    });
  });
});

// Made with Bob
