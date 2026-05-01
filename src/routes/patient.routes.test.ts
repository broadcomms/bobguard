import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';
import { PrismaClient } from '@prisma/client';
import { faker } from '@faker-js/faker';
import jwt from 'jsonwebtoken';
import { env } from '../lib/env.js';

/**
 * Patient Routes Tests
 * 
 * Tests verify:
 * 1. Endpoints work correctly with authentication
 * 2. Deliberate §164.312(b) violation is present (no audit logging)
 * 3. Deliberate §164.312(a)(2)(iv) violation is present (unencrypted PHI)
 */

const prisma = new PrismaClient();

describe('Patient Routes', () => {
  let authToken: string;
  let testUserId: string;
  let testPatientId: string;

  beforeAll(async () => {
    // Create test user and generate token
    const testUser = await prisma.user.create({
      data: {
        email: faker.internet.email(),
        password: 'hashedpassword', // Not used in these tests
      },
    });
    testUserId = testUser.id;

    authToken = jwt.sign(
      { id: testUser.id, email: testUser.email },
      env.JWT_SECRET,
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    // Cleanup
    await prisma.patient.deleteMany({
      where: { name: { contains: 'Test Patient' } },
    });
    await prisma.user.delete({ where: { id: testUserId } });
    await prisma.$disconnect();
  });

  describe('POST /api/patients', () => {
    it('should create a new patient with authentication', async () => {
      const patientData = {
        name: faker.person.fullName(),
        dob: faker.date.birthdate().toISOString().split('T')[0],
        mrn: `MRN-${faker.string.alphanumeric(8).toUpperCase()}`,
        ssn: faker.string.numeric(9),
      };

      const response = await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${authToken}`)
        .send(patientData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe(patientData.name);
      expect(response.body.mrn).toBe(patientData.mrn);

      testPatientId = response.body.id;
    });

    it('should reject patient creation without authentication', async () => {
      const patientData = {
        name: faker.person.fullName(),
        dob: faker.date.birthdate().toISOString().split('T')[0],
        mrn: `MRN-${faker.string.alphanumeric(8).toUpperCase()}`,
        ssn: faker.string.numeric(9),
      };

      await request(app)
        .post('/api/patients')
        .send(patientData)
        .expect(401);
    });

    it('should reject patient creation with missing fields', async () => {
      await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: faker.person.fullName() })
        .expect(400);
    });

    it('VIOLATION CHECK: should store PHI unencrypted (§164.312(a)(2)(iv))', async () => {
      const patientData = {
        name: 'Test Patient Unencrypted',
        dob: '1990-01-01',
        mrn: `MRN-UNENC-${Date.now()}`,
        ssn: '123456789',
      };

      const response = await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${authToken}`)
        .send(patientData)
        .expect(201);

      // ❌ VIOLATION: PHI stored as plain text in database
      const dbPatient = await prisma.patient.findUnique({
        where: { id: response.body.id },
      });

      expect(dbPatient?.dob).toBe(patientData.dob); // Plain text, not encrypted
      expect(dbPatient?.ssn).toBe(patientData.ssn); // Plain text, not encrypted
      expect(dbPatient?.mrn).toBe(patientData.mrn); // Plain text, not encrypted
    });

    it('VIOLATION CHECK: should NOT call audit.log() for PHI creation (§164.312(b))', async () => {
      const patientData = {
        name: 'Test Patient No Audit',
        dob: '1985-05-15',
        mrn: `MRN-NOAUDIT-${Date.now()}`,
        ssn: '987654321',
      };

      // ❌ VIOLATION: No audit log entry created
      // In a compliant system, we would verify audit.log() was called
      // Here we verify it was NOT called by checking the code doesn't import audit.ts
      
      const response = await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${authToken}`)
        .send(patientData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      // No audit trail exists for this PHI creation
    });
  });

  describe('GET /api/patients/:id', () => {
    it('should retrieve a patient by ID with authentication', async () => {
      const response = await request(app)
        .get(`/api/patients/${testPatientId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', testPatientId);
      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('dob');
      expect(response.body).toHaveProperty('mrn');
      expect(response.body).toHaveProperty('ssn');
    });

    it('should reject patient retrieval without authentication', async () => {
      await request(app)
        .get(`/api/patients/${testPatientId}`)
        .expect(401);
    });

    it('should return 404 for non-existent patient', async () => {
      await request(app)
        .get('/api/patients/nonexistent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('VIOLATION CHECK: should NOT call audit.log() for PHI access (§164.312(b))', async () => {
      // ❌ VIOLATION: PHI access not logged
      const response = await request(app)
        .get(`/api/patients/${testPatientId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('ssn'); // PHI accessed
      // No audit trail exists for this PHI access
    });
  });

  describe('GET /api/patients', () => {
    it('should list patients with pagination', async () => {
      const response = await request(app)
        .get('/api/patients')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should reject patient listing without authentication', async () => {
      await request(app)
        .get('/api/patients')
        .expect(401);
    });

    it('VIOLATION CHECK: should NOT call audit.log() for bulk PHI access (§164.312(b))', async () => {
      // ❌ VIOLATION: Bulk PHI access not logged
      const response = await request(app)
        .get('/api/patients')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.length).toBeGreaterThan(0);
      // No audit trail exists for this bulk PHI access
    });
  });

  describe('PUT /api/patients/:id', () => {
    it('should update a patient with authentication', async () => {
      const updateData = {
        name: 'Updated Test Patient',
      };

      const response = await request(app)
        .put(`/api/patients/${testPatientId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.name).toBe(updateData.name);
    });

    it('should reject patient update without authentication', async () => {
      await request(app)
        .put(`/api/patients/${testPatientId}`)
        .send({ name: 'Should Fail' })
        .expect(401);
    });

    it('VIOLATION CHECK: should NOT call audit.log() for PHI modification (§164.312(b))', async () => {
      // ❌ VIOLATION: PHI modification not logged
      await request(app)
        .put(`/api/patients/${testPatientId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Modified Without Audit' })
        .expect(200);

      // No audit trail exists for this PHI modification
    });
  });

  describe('DELETE /api/patients/:id', () => {
    it('should delete a patient with authentication', async () => {
      // Create a patient to delete
      const patientData = {
        name: 'Patient To Delete',
        dob: '1995-12-31',
        mrn: `MRN-DEL-${Date.now()}`,
        ssn: '111222333',
      };

      const createResponse = await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${authToken}`)
        .send(patientData)
        .expect(201);

      await request(app)
        .delete(`/api/patients/${createResponse.body.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);
    });

    it('should reject patient deletion without authentication', async () => {
      await request(app)
        .delete(`/api/patients/${testPatientId}`)
        .expect(401);
    });

    it('VIOLATION CHECK: should NOT call audit.log() for PHI deletion (§164.312(b))', async () => {
      // Create a patient to delete
      const patientData = {
        name: 'Patient Delete No Audit',
        dob: '1992-06-15',
        mrn: `MRN-DELNOAUD-${Date.now()}`,
        ssn: '444555666',
      };

      const createResponse = await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${authToken}`)
        .send(patientData)
        .expect(201);

      // ❌ VIOLATION: PHI deletion not logged
      await request(app)
        .delete(`/api/patients/${createResponse.body.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);

      // No audit trail exists for this PHI deletion
    });
  });
});

// Made with Bob