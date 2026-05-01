import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';
import { PrismaClient } from '@prisma/client';
import { faker } from '@faker-js/faker';
import jwt from 'jsonwebtoken';
import { env } from '../lib/env.js';

/**
 * Encounter Routes Tests
 * 
 * Tests verify:
 * 1. Endpoints work correctly with authentication
 * 2. Deliberate §164.312(b) violation is present (no audit logging)
 */

const prisma = new PrismaClient();

describe('Encounter Routes', () => {
  let authToken: string;
  let testUserId: string;
  let testPatientId: string;
  let testEncounterId: string;

  beforeAll(async () => {
    // Create test user and generate token
    const testUser = await prisma.user.create({
      data: {
        email: faker.internet.email(),
        password: 'hashedpassword',
      },
    });
    testUserId = testUser.id;

    authToken = jwt.sign(
      { id: testUser.id, email: testUser.email },
      env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Create test patient
    const testPatient = await prisma.patient.create({
      data: {
        name: faker.person.fullName(),
        dob: faker.date.birthdate().toISOString().split('T')[0],
        mrn: `MRN-ENC-${faker.string.alphanumeric(8).toUpperCase()}`,
        ssn: faker.string.numeric(9),
      },
    });
    testPatientId = testPatient.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.encounter.deleteMany({
      where: { patientId: testPatientId },
    });
    await prisma.patient.delete({ where: { id: testPatientId } });
    await prisma.user.delete({ where: { id: testUserId } });
    await prisma.$disconnect();
  });

  describe('POST /api/encounters', () => {
    it('should create a new encounter with authentication', async () => {
      const encounterData = {
        patientId: testPatientId,
        providerId: `PROV-${faker.string.alphanumeric(6).toUpperCase()}`,
        notes: faker.lorem.paragraph(),
      };

      const response = await request(app)
        .post('/api/encounters')
        .set('Authorization', `Bearer ${authToken}`)
        .send(encounterData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.patientId).toBe(encounterData.patientId);
      expect(response.body.providerId).toBe(encounterData.providerId);
      expect(response.body.notes).toBe(encounterData.notes);
      expect(response.body).toHaveProperty('patient');

      testEncounterId = response.body.id;
    });

    it('should reject encounter creation without authentication', async () => {
      const encounterData = {
        patientId: testPatientId,
        providerId: `PROV-${faker.string.alphanumeric(6).toUpperCase()}`,
        notes: faker.lorem.paragraph(),
      };

      await request(app)
        .post('/api/encounters')
        .send(encounterData)
        .expect(401);
    });

    it('should reject encounter creation with missing fields', async () => {
      await request(app)
        .post('/api/encounters')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ patientId: testPatientId })
        .expect(400);
    });

    it('should reject encounter creation for non-existent patient', async () => {
      const encounterData = {
        patientId: 'nonexistent-patient-id',
        providerId: `PROV-${faker.string.alphanumeric(6).toUpperCase()}`,
        notes: faker.lorem.paragraph(),
      };

      await request(app)
        .post('/api/encounters')
        .set('Authorization', `Bearer ${authToken}`)
        .send(encounterData)
        .expect(404);
    });

    it('VIOLATION CHECK: should NOT call audit.log() for PHI creation (§164.312(b))', async () => {
      const encounterData = {
        patientId: testPatientId,
        providerId: `PROV-NOAUDIT-${Date.now()}`,
        notes: 'Sensitive clinical notes without audit trail',
      };

      // ❌ VIOLATION: PHI creation not logged
      const response = await request(app)
        .post('/api/encounters')
        .set('Authorization', `Bearer ${authToken}`)
        .send(encounterData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.notes).toContain('Sensitive clinical notes');
      // No audit trail exists for this PHI creation
    });
  });

  describe('GET /api/encounters/:id', () => {
    it('should retrieve an encounter by ID with authentication', async () => {
      const response = await request(app)
        .get(`/api/encounters/${testEncounterId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', testEncounterId);
      expect(response.body).toHaveProperty('patientId');
      expect(response.body).toHaveProperty('providerId');
      expect(response.body).toHaveProperty('notes');
      expect(response.body).toHaveProperty('patient');
    });

    it('should reject encounter retrieval without authentication', async () => {
      await request(app)
        .get(`/api/encounters/${testEncounterId}`)
        .expect(401);
    });

    it('should return 404 for non-existent encounter', async () => {
      await request(app)
        .get('/api/encounters/nonexistent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('VIOLATION CHECK: should NOT call audit.log() for PHI access (§164.312(b))', async () => {
      // ❌ VIOLATION: PHI access not logged
      const response = await request(app)
        .get(`/api/encounters/${testEncounterId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('notes'); // Clinical PHI accessed
      expect(response.body.patient).toHaveProperty('mrn'); // Patient PHI accessed
      // No audit trail exists for this PHI access
    });
  });

  describe('GET /api/encounters', () => {
    it('should list all encounters with pagination', async () => {
      const response = await request(app)
        .get('/api/encounters')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should filter encounters by patientId', async () => {
      const response = await request(app)
        .get('/api/encounters')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ patientId: testPatientId })
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      
      // All encounters should belong to the test patient
      response.body.data.forEach((encounter: any) => {
        expect(encounter.patientId).toBe(testPatientId);
      });
    });

    it('should reject encounter listing without authentication', async () => {
      await request(app)
        .get('/api/encounters')
        .expect(401);
    });

    it('VIOLATION CHECK: should NOT call audit.log() for bulk PHI access (§164.312(b))', async () => {
      // ❌ VIOLATION: Bulk PHI access not logged
      const response = await request(app)
        .get('/api/encounters')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.length).toBeGreaterThan(0);
      // Each encounter contains clinical notes and patient PHI
      response.body.data.forEach((encounter: any) => {
        expect(encounter).toHaveProperty('notes');
        expect(encounter.patient).toHaveProperty('mrn');
      });
      // No audit trail exists for this bulk PHI access
    });
  });

  describe('Authentication Requirements', () => {
    it('should require valid JWT for all encounter endpoints', async () => {
      const invalidToken = 'invalid.jwt.token';

      await request(app)
        .post('/api/encounters')
        .set('Authorization', `Bearer ${invalidToken}`)
        .send({
          patientId: testPatientId,
          providerId: 'PROV-TEST',
          notes: 'Test notes',
        })
        .expect(401);

      await request(app)
        .get(`/api/encounters/${testEncounterId}`)
        .set('Authorization', `Bearer ${invalidToken}`)
        .expect(401);

      await request(app)
        .get('/api/encounters')
        .set('Authorization', `Bearer ${invalidToken}`)
        .expect(401);
    });

    it('should reject requests without Authorization header', async () => {
      await request(app)
        .post('/api/encounters')
        .send({
          patientId: testPatientId,
          providerId: 'PROV-TEST',
          notes: 'Test notes',
        })
        .expect(401);
    });
  });
});

// Made with Bob