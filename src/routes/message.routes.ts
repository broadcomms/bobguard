import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

/**
 * Message Routes (Webhook Endpoint)
 * 
 * ❌ DELIBERATE HIPAA VIOLATION: No TLS enforcement (§164.312(e)(1))
 * 
 * This endpoint accepts inbound messages containing PHI over plain HTTP without
 * requiring or enforcing TLS/HTTPS. HIPAA §164.312(e)(1) requires "technical
 * security measures to guard against unauthorized access to electronic protected
 * health information that is being transmitted over an electronic communications
 * network."
 * 
 * COMPLIANCE FIX:
 * 1. Add middleware to reject non-HTTPS requests in production
 * 2. Enforce TLS 1.2+ at the load balancer/reverse proxy level
 * 3. Add X-Forwarded-Proto header validation
 */

const router = Router();
const prisma = new PrismaClient();

/**
 * POST /messages/inbound
 * 
 * Webhook endpoint for receiving inbound messages (e.g., from external systems).
 * ❌ VIOLATION: Accepts plain HTTP, no TLS enforcement
 */
router.post('/inbound', async (req, res) => {
  try {
    const { patientId, from, subject, body } = req.body;

    // Validate input
    if (!patientId || !from || !body) {
      res.status(400).json({ 
        error: 'Required fields: patientId, from, body' 
      });
      return;
    }

    // ❌ VIOLATION: No check for HTTPS/TLS
    // Should verify: req.protocol === 'https' || req.headers['x-forwarded-proto'] === 'https'
    
    // Log the protocol for demonstration (would be removed in production)
    const protocol = req.protocol;
    const forwardedProto = req.headers['x-forwarded-proto'];
    
    console.log(`⚠️  Message received over ${protocol} (X-Forwarded-Proto: ${forwardedProto})`);

    // Verify patient exists
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
    });

    if (!patient) {
      res.status(404).json({ error: 'Patient not found' });
      return;
    }

    // In a real system, this would store the message in a messages table
    // For this demo, we'll just acknowledge receipt
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // ❌ VIOLATION: PHI transmitted and processed without TLS verification
    res.status(201).json({
      id: messageId,
      patientId,
      from,
      subject: subject || '(no subject)',
      receivedAt: new Date().toISOString(),
      status: 'received',
      warning: protocol !== 'https' ? 'Message received over insecure connection' : undefined,
    });
  } catch (error) {
    console.error('Inbound message error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /messages/status/:id
 * 
 * Check status of a message (for testing purposes).
 * ❌ VIOLATION: Also accepts plain HTTP
 */
router.get('/status/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Mock response - in real system would query database
    res.json({
      id,
      status: 'delivered',
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Message status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

// Made with Bob