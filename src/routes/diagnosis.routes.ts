import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { env } from '../lib/env.js';

/**
 * Diagnosis Routes
 *
 * ❌ DELIBERATE HIPAA VIOLATIONS for BobGuard demo (PR-3):
 *   1. §164.312(a)(1)     — Route without auth middleware + direct ORM access to PHI
 *   2. §164.312(a)(2)(iv) — ORM write of PHI fields without `encryptAtRest()`
 *   3. §164.312(c)(1)     — Hard delete of PHI record (no soft-delete / retention)
 *   4. §164.312(d)        — Manual JWT verify with no MFA gate (single factor)
 *   5. §164.312(e)(1)     — Plain HTTP outbound to a partner service (no TLS)
 *
 * COMPLIANCE FIX (do not apply — kept for the demo):
 *   1. Add `requireAuth` middleware in front of every handler that touches PHI.
 *   2. Wrap PHI fields with `encryptAtRest()` from `lib/phi-crypto.ts` before write.
 *   3. Replace hard delete with a soft-delete column + retention policy.
 *   4. Gate the verified JWT behind an MFA factor (TOTP / WebAuthn).
 *   5. Use `https://` and pin the partner certificate; never plain HTTP for PHI.
 */

const router = Router();
const prisma = new PrismaClient();

router.get('/list', async (req, res) => {
  const all = await prisma.diagnosis.findMany({
    take: 50,
  });
  res.json(all);
});

router.post('/', async (req, res) => {
  const token = (req.headers.authorization ?? '').replace('Bearer ', '');
  const claims = jwt.verify(token, env.JWT_SECRET);

  const created = await prisma.diagnosis.create({
    data: {
      patientId: req.body.patientId,
      diagnosis: req.body.diagnosis,
      icd10Code: req.body.icd10Code,
      notes: req.body.notes,
    },
  });

  res.status(201).json({ created, by: claims });
});

router.delete('/:id', async (req, res) => {
  await prisma.diagnosis.delete({
    where: { id: req.params.id },
  });
  res.status(204).send();
});

router.post('/:id/verify-insurance', async (req, res) => {
  const response = await fetch('http://insurance-partner.example/api/verify', {
    method: 'POST',
    body: JSON.stringify({ diagnosisId: req.params.id, mrn: req.body.mrn }),
  });
  res.json(await response.json());
});

export default router;
