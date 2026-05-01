import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';
import { PrismaClient } from '@prisma/client';
import { faker } from '@faker-js/faker';

/**
 * Message Routes Tests
 * 
 * Tests verify:
 * 1. Webhook endpoint works correctly
 * 2. Deliberate §164.312(e)(1) violation is present (no TLS enforcement)
 */

const prisma = new PrismaClient();

describe('Message Routes', () => {
  let testPatientId: string;

  beforeAll(async () => {
    // Create test patient for message tests
    const testPatient = await prisma.patient.create({
      data: {
        name: faker.person.fullName(),
        dob: faker.date.birthdate().toISOString().split('T')[0],
        mrn: `MRN-MSG-${faker.string.alphanumeric(8).toUpperCase()}`,
        ssn: faker.string.numeric(9),
      },
    });
    testPatientId = testPatient.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.patient.delete({ where: { id: testPatientId } });
    await prisma.$disconnect();
  });

  describe('POST /api/messages/inbound', () => {
    it('should accept inbound message with valid data', async () => {
      const messageData = {
        patientId: testPatientId,
        from: faker.internet.email(),
        subject: faker.lorem.sentence(),
        body: faker.lorem.paragraph(),
      };

      const response = await request(app)
        .post('/api/messages/inbound')
        .send(messageData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.patientId).toBe(messageData.patientId);
      expect(response.body.from).toBe(messageData.from);
      expect(response.body).toHaveProperty('receivedAt');
      expect(response.body.status).toBe('received');
    });

    it('should reject message with missing required fields', async () => {
      await request(app)
        .post('/api/messages/inbound')
        .send({ from: faker.internet.email() })
        .expect(400);
    });

    it('should reject message for non-existent patient', async () => {
      const messageData = {
        patientId: 'nonexistent-patient-id',
        from: faker.internet.email(),
        body: faker.lorem.paragraph(),
      };

      await request(app)
        .post('/api/messages/inbound')
        .send(messageData)
        .expect(404);
    });

    it('should handle message without subject', async () => {
      const messageData = {
        patientId: testPatientId,
        from: faker.internet.email(),
        body: faker.lorem.paragraph(),
      };

      const response = await request(app)
        .post('/api/messages/inbound')
        .send(messageData)
        .expect(201);

      expect(response.body.subject).toBe('(no subject)');
    });

    it('VIOLATION CHECK: should accept message over HTTP without TLS enforcement (§164.312(e)(1))', async () => {
      const messageData = {
        patientId: testPatientId,
        from: 'external-system@example.com',
        subject: 'PHI Message Over Insecure Connection',
        body: 'This message contains PHI and is transmitted without TLS verification',
      };

      // ❌ VIOLATION: No check for HTTPS/TLS
      // The endpoint accepts the request regardless of protocol
      const response = await request(app)
        .post('/api/messages/inbound')
        .send(messageData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.status).toBe('received');
      
      // In a compliant system, this would be rejected with 403 if not HTTPS
      // Here it's accepted, demonstrating the violation
    });

    it('VIOLATION CHECK: should process PHI without verifying X-Forwarded-Proto header (§164.312(e)(1))', async () => {
      const messageData = {
        patientId: testPatientId,
        from: 'insecure-sender@example.com',
        body: 'PHI transmitted without protocol verification',
      };

      // ❌ VIOLATION: No validation of X-Forwarded-Proto header
      // Even with explicit HTTP header, request is accepted
      const response = await request(app)
        .post('/api/messages/inbound')
        .set('X-Forwarded-Proto', 'http') // Explicitly indicating HTTP
        .send(messageData)
        .expect(201);

      expect(response.body.status).toBe('received');
      
      // A compliant system would check:
      // if (req.protocol !== 'https' && req.headers['x-forwarded-proto'] !== 'https') {
      //   return res.status(403).json({ error: 'HTTPS required' });
      // }
    });

    it('VIOLATION CHECK: should not enforce TLS 1.2+ requirement (§164.312(e)(1))', async () => {
      const messageData = {
        patientId: testPatientId,
        from: 'legacy-system@example.com',
        body: 'Message from system potentially using outdated TLS',
      };

      // ❌ VIOLATION: No TLS version validation
      // The endpoint doesn't verify minimum TLS version
      const response = await request(app)
        .post('/api/messages/inbound')
        .send(messageData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      
      // A compliant system would enforce TLS 1.2+ at the load balancer
      // or application level, rejecting connections with older protocols
    });
  });

  describe('GET /api/messages/status/:id', () => {
    it('should return message status', async () => {
      const messageId = 'msg_test_123';

      const response = await request(app)
        .get(`/api/messages/status/${messageId}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', messageId);
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('checkedAt');
    });

    it('VIOLATION CHECK: status endpoint also accepts HTTP (§164.312(e)(1))', async () => {
      const messageId = 'msg_insecure_456';

      // ❌ VIOLATION: Status check endpoint also lacks TLS enforcement
      const response = await request(app)
        .get(`/api/messages/status/${messageId}`)
        .set('X-Forwarded-Proto', 'http')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      
      // Even read operations on PHI-related data should require HTTPS
    });
  });

  describe('Security Headers', () => {
    it('VIOLATION CHECK: should not enforce Strict-Transport-Security header', async () => {
      const messageData = {
        patientId: testPatientId,
        from: faker.internet.email(),
        body: faker.lorem.paragraph(),
      };

      const response = await request(app)
        .post('/api/messages/inbound')
        .send(messageData)
        .expect(201);

      // ❌ VIOLATION: No HSTS header to enforce HTTPS
      expect(response.headers['strict-transport-security']).toBeUndefined();
      
      // A compliant system would include:
      // Strict-Transport-Security: max-age=31536000; includeSubDomains
    });
  });

  describe('Webhook Authentication', () => {
    it('should accept messages without webhook signature verification', async () => {
      const messageData = {
        patientId: testPatientId,
        from: 'unverified-sender@example.com',
        body: 'Message without signature verification',
      };

      // Note: While not explicitly required by the task, this demonstrates
      // another security gap - no webhook authentication
      const response = await request(app)
        .post('/api/messages/inbound')
        .send(messageData)
        .expect(201);

      expect(response.body.status).toBe('received');
    });
  });
});

// Made with Bob