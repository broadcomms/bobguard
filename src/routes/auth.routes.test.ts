import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';
import { PrismaClient } from '@prisma/client';
import { faker } from '@faker-js/faker';

/**
 * Auth Routes Tests
 * 
 * Tests verify:
 * 1. Endpoints work correctly
 * 2. Deliberate §164.312(d) violation is present (no MFA)
 */

const prisma = new PrismaClient();

describe('Auth Routes', () => {
  const testUser = {
    email: faker.internet.email(),
    password: faker.internet.password({ length: 12 }),
  };

  afterAll(async () => {
    // Cleanup test user
    await prisma.user.deleteMany({
      where: { email: testUser.email },
    });
    await prisma.$disconnect();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user and return JWT', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(testUser)
        .expect(201);

      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(testUser.email);
      expect(response.body.user).not.toHaveProperty('password');
    });

    it('should reject registration with existing email', async () => {
      await request(app)
        .post('/api/auth/register')
        .send(testUser)
        .expect(409);
    });

    it('should reject registration with short password', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          email: faker.internet.email(),
          password: 'short',
        })
        .expect(400);
    });

    it('should reject registration with missing fields', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({ email: faker.internet.email() })
        .expect(400);
    });

    it('VIOLATION CHECK: should return JWT immediately without MFA setup (§164.312(d))', async () => {
      const newUser = {
        email: faker.internet.email(),
        password: faker.internet.password({ length: 12 }),
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(newUser)
        .expect(201);

      // ❌ VIOLATION: JWT returned immediately without MFA enrollment
      expect(response.body).toHaveProperty('token');
      expect(response.body.token).toBeTruthy();
      
      // Verify no MFA-related fields in response
      expect(response.body).not.toHaveProperty('mfaRequired');
      expect(response.body).not.toHaveProperty('mfaSecret');
      expect(response.body).not.toHaveProperty('qrCode');

      // Cleanup
      await prisma.user.delete({ where: { email: newUser.email } });
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials and return JWT', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send(testUser)
        .expect(200);

      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(testUser.email);
    });

    it('should reject login with invalid password', async () => {
      await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'wrongpassword',
        })
        .expect(401);
    });

    it('should reject login with non-existent email', async () => {
      await request(app)
        .post('/api/auth/login')
        .send({
          email: faker.internet.email(),
          password: faker.internet.password(),
        })
        .expect(401);
    });

    it('should reject login with missing fields', async () => {
      await request(app)
        .post('/api/auth/login')
        .send({ email: testUser.email })
        .expect(400);
    });

    it('VIOLATION CHECK: should return JWT without MFA verification (§164.312(d))', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send(testUser)
        .expect(200);

      // ❌ VIOLATION: JWT returned after password check only, no MFA
      expect(response.body).toHaveProperty('token');
      expect(response.body.token).toBeTruthy();
      
      // Verify no MFA challenge in response
      expect(response.body).not.toHaveProperty('mfaRequired');
      expect(response.body).not.toHaveProperty('mfaChallenge');
      
      // Verify token is immediately usable (single-factor auth)
      const protectedResponse = await request(app)
        .get('/api/patients')
        .set('Authorization', `Bearer ${response.body.token}`)
        .expect(200);

      expect(protectedResponse.body).toHaveProperty('data');
    });
  });
});

// Made with Bob