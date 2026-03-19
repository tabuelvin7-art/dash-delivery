import { Router, Request, Response } from 'express';
import { body } from 'express-validator';
import * as agentService from '../services/agentService';
import * as packageService from '../services/packageService';
import { verifyToken } from '../middleware/auth';
import { requireRole } from '../middleware/authorize';
import { sanitizeInputs } from '../middleware/sanitize';
import { handleValidation } from '../utils/routeHelpers';

const router = Router();
router.use(verifyToken, sanitizeInputs);

// GET /api/agents/my-profile — get the agent profile for the logged-in agent user
router.get('/my-profile', requireRole('agent'), async (req: Request, res: Response) => {
  try {
    const { Agent } = await import('../models/Agent');
    const { Types } = await import('mongoose');
    const agent = await Agent.findOne({ userId: new Types.ObjectId(req.user!.sub) });
    if (!agent) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Agent profile not found' } });
      return;
    }
    res.json({ success: true, data: agent });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'ERROR', message: err.message } });
  }
});



// POST /api/agents/validate-code — must be before /:id to avoid param conflict
router.post('/validate-code', requireRole('agent'), [
  body('packageId').notEmpty(),
  body('releaseCode').notEmpty(),
  body('agentId').notEmpty(),
], async (req: Request, res: Response) => {
  if (!handleValidation(req, res)) return;
  try {
    const pkg = await packageService.validateReleaseCode(req.body.packageId, req.body.releaseCode, req.body.agentId);
    res.json({ success: true, data: pkg, message: 'Package released successfully' });
  } catch (err: any) {
    const status = err.code === 'NOT_FOUND' ? 404 : err.code === 'FORBIDDEN' ? 403 : 400;
    res.status(status).json({ success: false, error: { code: err.code || 'ERROR', message: err.message } });
  }
});

// GET /api/agents — list all active agents (admin sees inactive too)
router.get('/', async (req: Request, res: Response) => {
  try {
    const { city, neighborhood, page } = req.query as any;
    const includeInactive = req.user?.role === 'admin';
    const result = await agentService.getAgents({ city, neighborhood, page: page ? parseInt(page) : 1, includeInactive });
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'ERROR', message: err.message } });
  }
});

// GET /api/agents/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const agent = await agentService.getAgentById(req.params.id);
    res.json({ success: true, data: agent });
  } catch (err: any) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: err.message } });
  }
});

// POST /api/agents - admin only
// Accepts optional agentEmail + agentPassword to create a linked agent user account.
// If omitted, the agent location is linked to the admin's own userId (legacy behaviour).
router.post('/', requireRole('admin'), [
  body('locationName').notEmpty().withMessage('Location name required'),
  body('address').notEmpty().withMessage('Address required'),
  body('neighborhood').notEmpty().withMessage('Neighborhood required'),
  body('city').notEmpty().withMessage('City required'),
  body('coordinates.latitude').isFloat().withMessage('Valid latitude required'),
  body('coordinates.longitude').isFloat().withMessage('Valid longitude required'),
  body('contactPhone').notEmpty().withMessage('Contact phone required'),
  body('agentEmail').optional().isEmail().withMessage('Valid agent email required'),
  body('agentPassword').optional().isLength({ min: 6 }).withMessage('Password must be at least 6 chars'),
], async (req: Request, res: Response) => {
  if (!handleValidation(req, res)) return;
  try {
    const { agentEmail, agentPassword, agentFirstName, agentLastName, agentPhone, ...agentData } = req.body;

    let userId = req.user!.sub;

    // Create a dedicated agent user account if credentials were provided
    if (agentEmail && agentPassword) {
      const bcrypt = await import('bcrypt');
      const { User } = await import('../models/User');
      const mongoose = await import('mongoose');

      const existing = await User.findOne({ email: agentEmail.toLowerCase() });
      if (existing) {
        res.status(409).json({ success: false, error: { code: 'CONFLICT', message: 'An account with that email already exists' } });
        return;
      }

      const passwordHash = await bcrypt.hash(agentPassword, 12);
      const result = await mongoose.default.connection.collection('users').insertOne({
        email: agentEmail.toLowerCase(),
        phoneNumber: agentPhone || agentData.contactPhone,
        passwordHash,
        role: 'agent',
        isPhoneVerified: true,
        isActive: true,
        profile: { firstName: agentFirstName || 'Agent', lastName: agentLastName || 'User' },
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      userId = result.insertedId.toString();
    }

    const agent = await agentService.createAgent({ ...agentData, userId });
    res.status(201).json({ success: true, data: agent });
  } catch (err: any) {
    const status = err.code === 'CONFLICT' ? 409 : 400;
    res.status(status).json({ success: false, error: { code: err.code || 'ERROR', message: err.message } });
  }
});

// PATCH /api/agents/:id - admin only
router.patch('/:id', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const agent = await agentService.updateAgent(req.params.id, req.body);
    res.json({ success: true, data: agent });
  } catch (err: any) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: err.message } });
  }
});

// PATCH /api/agents/:id/deactivate - admin only
router.patch('/:id/deactivate', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    await agentService.deactivateAgent(req.params.id);
    res.json({ success: true, message: 'Agent deactivated' });
  } catch (err: any) {
    const status = err.code === 'NOT_FOUND' ? 404 : 500;
    res.status(status).json({ success: false, error: { code: err.code || 'ERROR', message: err.message } });
  }
});

export default router;
