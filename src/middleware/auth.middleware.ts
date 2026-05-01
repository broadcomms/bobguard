import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../lib/env.js';

/**
 * JWT Authentication Middleware
 * 
 * ❌ DELIBERATE HIPAA VIOLATION: Single-factor authentication only (§164.312(d))
 * 
 * This middleware verifies JWT tokens but does NOT enforce multi-factor
 * authentication (MFA). HIPAA §164.312(d) requires procedures to verify that
 * a person or entity seeking access to ePHI is the one claimed, which typically
 * requires MFA for remote access to systems containing ePHI.
 * 
 * COMPLIANCE FIX: Add MFA verification step after JWT validation, checking
 * for a second factor (TOTP, SMS, hardware token) before granting access.
 */

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // ❌ VIOLATION: Only verifies JWT, no MFA check
    const decoded = jwt.verify(token, env.JWT_SECRET) as {
      id: string;
      email: string;
    };

    req.user = decoded;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: 'Token expired' });
      return;
    }
    res.status(500).json({ error: 'Authentication error' });
  }
}

// Made with Bob