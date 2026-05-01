import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.middleware.js';

/**
 * Encounter Routes
 * 
 * ❌ DELIBERATE HIPAA VIOLATION: No audit logging (§164.312(b))
 * 
 * Clinical encounter records contain PHI (patient ID, provider ID, clinical notes).
 * HIPAA §164.312(b) requires audit controls to record and examine activity in
 * systems containing ePHI.
 * 
 * COMPLIANCE FIX: Import and call audit.log() for all encounter operations.
 */

const router = Router();
const prisma = new PrismaClient();

/**
 * POST /encounters
 * 
 * Creates a new clinical encounter record.
 * ❌ VIOLATION: No audit log for PHI creation
 */
router.post('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { patientId, providerId, notes } = req.body;

    // Validate input
    if (!patientId || !providerId || !notes) {
      res.status(400).json({ 
        error: 'All fields are required: patientId, providerId, notes' 
      });
      return;
    }

    // Verify patient exists
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
    });

    if (!patient) {
      res.status(404).json({ error: 'Patient not found' });
      return;
    }

    // Create encounter
    const encounter = await prisma.encounter.create({
      data: {
        patientId,
        providerId,
        notes,
      },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            mrn: true,
          },
        },
      },
    });

    // ❌ VIOLATION: No audit.log() call for PHI creation
    // Should log: { 
    //   actor: req.user.id, 
    //   action: 'CREATE', 
    //   resource: `Encounter:${encounter.id}`, 
    //   outcome: 'SUCCESS',
    //   metadata: { patientId, providerId }
    // }

    res.status(201).json(encounter);
  } catch (error) {
    console.error('Create encounter error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /encounters/:id
 * 
 * Retrieves a single encounter record.
 * ❌ VIOLATION: No audit log for PHI access
 */
router.get('/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const encounter = await prisma.encounter.findUnique({
      where: { id },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            mrn: true,
          },
        },
      },
    });

    if (!encounter) {
      res.status(404).json({ error: 'Encounter not found' });
      return;
    }

    // ❌ VIOLATION: No audit.log() call for PHI access
    // Should log: { actor: req.user.id, action: 'READ', resource: `Encounter:${id}`, outcome: 'SUCCESS' }

    res.json(encounter);
  } catch (error) {
    console.error('Get encounter error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /encounters
 * 
 * Lists encounters with optional patient filter.
 * ❌ VIOLATION: No audit log for bulk PHI access
 */
router.get('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const patientId = req.query.patientId as string | undefined;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const where = patientId ? { patientId } : {};

    const [encounters, total] = await Promise.all([
      prisma.encounter.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          patient: {
            select: {
              id: true,
              name: true,
              mrn: true,
            },
          },
        },
      }),
      prisma.encounter.count({ where }),
    ]);

    // ❌ VIOLATION: No audit.log() call for bulk PHI access
    // Should log: { 
    //   actor: req.user.id, 
    //   action: 'LIST', 
    //   resource: 'Encounter', 
    //   outcome: 'SUCCESS',
    //   metadata: { count: encounters.length, patientId }
    // }

    res.json({
      data: encounters,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('List encounters error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

// Made with Bob