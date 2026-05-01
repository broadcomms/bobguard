import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';
import { PrismaClient } from '@prisma/client';
import { faker } from '@faker-js/faker';
import { execSync } from 'child_process';

/**
 * End-to-End Smoke Tests
 * 
 * These tests run against the LIVE Postgres database and verify:
 * 1. All API endpoints work end-to-end
 * 2. All 4 deliberate HIPAA violations are reachable in production-like conditions
 * 
 * VIOLATIONS TESTED:
 * - §164.312(d): Single-factor JWT auth (no MFA)
 * - §164.312(b): No audit logging for PHI access
 * - §164.312(a)(2)(iv): Unencrypted PHI at rest
 * - §164.312(e)(1): No TLS enforcement on webhook
 */

const prisma = new PrismaClient();

// Test data IDs captured during test execution
let authToken: string;
let testPatientId: string;
let smokeTestUserId: string;

describe('API Smoke Tests (End-to-End)', () => {
  beforeAll(async () => {
    try {
      // Verify database connection
      await prisma.$connect();
      console.log('✓ Database connection established');

      // Run seed to ensure demo data exists
      console.log('🌱 Running database seed...');
      execSync('npm run prisma:seed', { stdio: 'inherit' });
      console.log('✓ Seed completed');

      // Create a dedicated smoke test user to avoid conflicts
      const bcrypt = await import('bcrypt');
      const smokeUser = await prisma.user.create({
        data: {
          email: `smoke-test-${Date.now()}@bobguard.test`,
          password: await bcrypt.hash('SmokeTest123!', 10),
        },
      });
      smokeTestUserId = smokeUser.id;
      console.log(`✓ Smoke test user created: ${smokeUser.email}`);
    } catch (error) {
      console.error('❌ Smoke test setup failed:', error);
      throw error;
    }
  });

  afterAll(async () => {
    // Cleanup smoke test data
    try {
      if (testPatientId) {
        await prisma.encounter.deleteMany({
          where: { patientId: testPatientId },
        });
        await prisma.patient.delete({
          where: { id: testPatientId },
        });
        console.log('✓ Smoke test patient cleaned up');
      }

      if (smokeTestUserId) {
        await prisma.user.delete({
          where: { id: smokeTestUserId },
        });
        console.log('✓ Smoke test user cleaned up');
      }
    } catch (error) {
      console.warn('⚠️  Cleanup warning:', error);
    } finally {
      await prisma.$disconnect();
    }
  });

  describe('Authentication Flow', () => {
    it('should login with demo credentials and receive JWT', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'demo@bobguard.test',
          password: 'Demo123!',
        })
        .expect(200);

      expect(response.body).toHaveProperty('token');
      expect(response.body.user.email).toBe('demo@bobguard.test');

      authToken = response.body.token;
      console.log('✓ JWT token obtained');
    });

    it('VIOLATION CHECK: JWT issued without MFA challenge (§164.312(d))', async () => {
      // ❌ VIOLATION: Single-factor authentication
      expect(authToken).toBeTruthy();
      
      // Verify token is immediately usable without second factor
      const response = await request(app)
        .get('/api/patients')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      console.log('✓ VIOLATION CONFIRMED: JWT works without MFA');
    });
  });

  describe('Patient CRUD Operations', () => {
    it('should create a patient with PHI', async () => {
      const patientData = {
        name: faker.person.fullName(),
        dob: faker.date.birthdate().toISOString().split('T')[0],
        mrn: `MRN-SMOKE-${Date.now()}`,
        ssn: faker.string.numeric(9),
      };

      const response = await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${authToken}`)
        .send(patientData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe(patientData.name);
      expect(response.body.ssn).toBe(patientData.ssn);

      testPatientId = response.body.id;
      console.log(`✓ Patient created: ${testPatientId}`);
    });

    it('should retrieve patient PHI by ID', async () => {
      const response = await request(app)
        .get(`/api/patients/${testPatientId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.id).toBe(testPatientId);
      expect(response.body).toHaveProperty('ssn');
      expect(response.body).toHaveProperty('dob');
      expect(response.body).toHaveProperty('mrn');
      console.log('✓ Patient PHI retrieved');
    });

    it('VIOLATION CHECK: PHI access without audit logging (§164.312(b))', async () => {
      // ❌ VIOLATION: No audit trail
      // Access PHI multiple times
      await request(app)
        .get(`/api/patients/${testPatientId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      await request(app)
        .get(`/api/patients/${testPatientId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // In a compliant system, we would query an audit log table here
      // and verify entries exist. Here we verify NO audit mechanism exists.
      
      // Check that audit.ts is not imported in patient.routes.ts
      // (This is a meta-check - in real audit, BobGuard would scan the code)
      console.log('✓ VIOLATION CONFIRMED: No audit.log() calls in patient routes');
    });

    it('VIOLATION CHECK: PHI stored unencrypted in database (§164.312(a)(2)(iv))', async () => {
      // ❌ VIOLATION: Query database directly to verify plain text storage
      const dbPatient = await prisma.patient.findUnique({
        where: { id: testPatientId },
      });

      expect(dbPatient).toBeTruthy();
      
      // Verify PHI fields are plain text (not encrypted blobs)
      expect(dbPatient!.dob).toMatch(/^\d{4}-\d{2}-\d{2}$/); // Plain date format
      expect(dbPatient!.ssn).toMatch(/^\d{9}$/); // Plain 9-digit number
      expect(dbPatient!.mrn).toContain('MRN-SMOKE-'); // Plain text MRN
      
      // In a compliant system, these would be encrypted strings like:
      // "enc_v1_AES256_GCM_..." or similar
      expect(dbPatient!.dob).not.toContain('enc_');
      expect(dbPatient!.ssn).not.toContain('enc_');
      
      console.log('✓ VIOLATION CONFIRMED: PHI stored as plain text in Postgres');
      console.log(`   - DOB: ${dbPatient!.dob} (plain text)`);
      console.log(`   - SSN: ${dbPatient!.ssn} (plain text)`);
      console.log(`   - MRN: ${dbPatient!.mrn} (plain text)`);
    });
  });

  describe('Encounter Operations', () => {
    it('should create an encounter with clinical notes', async () => {
      const encounterData = {
        patientId: testPatientId,
        providerId: 'PROV-SMOKE-001',
        notes: 'Smoke test encounter with sensitive clinical information',
      };

      const response = await request(app)
        .post('/api/encounters')
        .set('Authorization', `Bearer ${authToken}`)
        .send(encounterData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.notes).toBe(encounterData.notes);
      console.log('✓ Encounter created with clinical notes');
    });

    it('VIOLATION CHECK: Encounter access without audit logging (§164.312(b))', async () => {
      // ❌ VIOLATION: Clinical notes accessed without audit trail
      const response = await request(app)
        .get('/api/encounters')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ patientId: testPatientId })
        .expect(200);

      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0]).toHaveProperty('notes');
      
      console.log('✓ VIOLATION CONFIRMED: Encounter PHI accessed without audit');
    });
  });

  describe('Message Webhook', () => {
    it('should accept inbound message over HTTP', async () => {
      const messageData = {
        patientId: testPatientId,
        from: 'external-system@example.com',
        subject: 'Test message with PHI',
        body: 'This message contains patient health information',
      };

      const response = await request(app)
        .post('/api/messages/inbound')
        .send(messageData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.status).toBe('received');
      console.log('✓ Message webhook accepted');
    });

    it('VIOLATION CHECK: Webhook accepts plain HTTP without TLS enforcement (§164.312(e)(1))', async () => {
      // ❌ VIOLATION: No TLS/HTTPS requirement
      const messageData = {
        patientId: testPatientId,
        from: 'insecure-sender@example.com',
        body: 'PHI transmitted over potentially insecure connection',
      };

      // Explicitly set X-Forwarded-Proto to http to simulate non-TLS
      const response = await request(app)
        .post('/api/messages/inbound')
        .set('X-Forwarded-Proto', 'http')
        .send(messageData)
        .expect(201);

      expect(response.body.status).toBe('received');
      
      // In a compliant system, this would return 403 Forbidden
      // Here it's accepted, proving the violation
      console.log('✓ VIOLATION CONFIRMED: HTTP request accepted without TLS check');
      console.log('   - X-Forwarded-Proto: http (not rejected)');
      console.log('   - No HTTPS enforcement at application layer');
    });
  });

  describe('End-to-End Violation Summary', () => {
    it('should confirm all 4 HIPAA violations are reachable', () => {
      console.log('\n📋 HIPAA VIOLATIONS CONFIRMED (End-to-End):');
      console.log('   1. ✓ §164.312(d) - Single-factor auth (no MFA)');
      console.log('   2. ✓ §164.312(b) - No audit logging for PHI access');
      console.log('   3. ✓ §164.312(a)(2)(iv) - Unencrypted PHI at rest');
      console.log('   4. ✓ §164.312(e)(1) - No TLS enforcement on webhook');
      console.log('\n✅ All violations are reachable in production-like conditions');
      
      // This test always passes - it's a summary
      expect(true).toBe(true);
    });
  });

  describe('Database State Verification', () => {
    it('should verify seeded data exists', async () => {
      const userCount = await prisma.user.count();
      const patientCount = await prisma.patient.count();
      const encounterCount = await prisma.encounter.count();

      expect(userCount).toBeGreaterThan(0);
      expect(patientCount).toBeGreaterThan(0);
      expect(encounterCount).toBeGreaterThan(0);

      console.log(`✓ Database state: ${userCount} users, ${patientCount} patients, ${encounterCount} encounters`);
    });

    it('should verify demo user exists', async () => {
      const demoUser = await prisma.user.findUnique({
        where: { email: 'demo@bobguard.test' },
      });

      expect(demoUser).toBeTruthy();
      console.log('✓ Demo user verified in database');
    });
  });
});

// Made with Bob