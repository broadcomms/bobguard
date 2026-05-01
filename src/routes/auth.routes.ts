import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { env } from '../lib/env.js';

/**
 * Authentication Routes
 * 
 * ❌ DELIBERATE HIPAA VIOLATION: Single-factor authentication only (§164.312(d))
 * 
 * The login endpoint verifies username/password but does NOT require or verify
 * a second authentication factor. HIPAA §164.312(d) requires procedures to verify
 * that a person or entity seeking access to ePHI is the one claimed.
 * 
 * COMPLIANCE FIX: Add MFA enrollment during registration and MFA verification
 * during login (TOTP, SMS OTP, or hardware token).
 */

const router = Router();
const prisma = new PrismaClient();

/**
 * POST /auth/login
 * 
 * Authenticates user with email and password, returns JWT.
 * ❌ VIOLATION: No MFA required
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Use generic error to prevent user enumeration
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // ❌ VIOLATION: Generate JWT without MFA verification
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
      },
      env.JWT_SECRET,
      {
        expiresIn: '24h',
      }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /auth/register
 * 
 * Creates a new user account.
 * ❌ VIOLATION: No MFA enrollment during registration
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters' });
      return;
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      res.status(409).json({ error: 'User already exists' });
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
      },
    });

    // ❌ VIOLATION: Return JWT immediately without MFA setup
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
      },
      env.JWT_SECRET,
      {
        expiresIn: '24h',
      }
    );

    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

// Made with Bob