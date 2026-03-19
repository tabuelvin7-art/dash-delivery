import { Router, Request, Response } from 'express';
import { body, query } from 'express-validator';
import * as packageService from '../services/packageService';
import * as paymentService from '../services/paymentService';
import * as notificationService from '../services/notificationService';
import { verifyToken } from '../middleware/auth';
import { requireRole } from '../middleware/authorize';
import { sanitizeInputs } from '../middleware/sanitize';
import { handleValidation } from '../utils/routeHelpers';

const router = Router();

// GET /api/packages/track/:id — public, no auth required
router.get('/track/:id', async (req: Request, res: Response) => {
  try {
    const { Package } = await import('../models/Package');
    const pkg = await Package.findOne({ packageId: req.params.id }).select('packageId deliveryMethod status trackingHistory deliveredAt');
    if (!pkg) { res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Package not found' } }); return; }
    res.json({ success: true, data: pkg });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'ERROR', message: err.message } });
  }
});

router.use(verifyToken, sanitizeInputs);

// POST /api/packages
router.post('/', requireRole('business_owner'), [
  body('customerId').notEmpty(),
  body('deliveryMethod').isIn(['agent_delivery', 'doorstep_delivery', 'rent_a_shelf']),
  body('itemPrice').isFloat({ min: 0 }),
  body('deliveryFee').isFloat({ min: 0 }),
], async (req: Request, res: Response) => {
  if (!handleValidation(req, res)) return;
  try {
    const pkg = await packageService.createPackage({ ...req.body, businessOwnerId: req.user!.sub });
    // Trigger delivery fee payment record
    paymentService.sendDeliveryFeePrompt(pkg.packageId).catch(() => {});
    // Notify assigned agents
    notificationService.notifyAgentsOfNewPackage(pkg.packageId).catch(() => {});
    // Notify customer that a package has been created for them
    notificationService.notifyCustomerPackageCreated(pkg.packageId).catch(() => {});
    res.status(201).json({ success: true, data: pkg });
  } catch (err: any) {
    const status = err.code === 'NOT_FOUND' ? 404 : 400;
    res.status(status).json({ success: false, error: { code: err.code || 'ERROR', message: err.message } });
  }
});

// GET /api/packages
router.get('/', async (req: Request, res: Response) => {
  try {
    const { status, startDate, endDate, customerId, shelfRentalId, page } = req.query as any;
    const filters = { status, startDate: startDate ? new Date(startDate) : undefined, endDate: endDate ? new Date(endDate) : undefined, customerId, shelfRentalId, page: page ? parseInt(page) : 1 };
    let result;
    if (req.user!.role === 'business_owner') {
      result = await packageService.getPackagesByBusinessOwner(req.user!.sub, filters);
    } else if (req.user!.role === 'customer') {
      result = await packageService.getPackagesByCustomer(req.user!.sub, filters);
    } else if (req.user!.role === 'admin') {
      // Admin sees all packages — pass no owner filter
      result = await packageService.getAllPackages(filters);
    } else if (req.user!.role === 'agent') {
      // Agent sees packages assigned to their location
      const { Agent } = await import('../models/Agent');
      const { Types } = await import('mongoose');
      const agentDoc = await Agent.findOne({ userId: new Types.ObjectId(req.user!.sub) });
      if (!agentDoc) {
        res.json({ success: true, data: [], page: 1, limit: 50, total: 0, totalPages: 0 });
        return;
      }
      result = await packageService.getPackagesByAgent(agentDoc._id.toString(), filters);
    } else {
      result = await packageService.getPackagesByBusinessOwner(req.user!.sub, filters);
    }
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'ERROR', message: err.message } });
  }
});

// GET /api/packages/search
router.get('/search', [query('q').notEmpty()], async (req: Request, res: Response) => {
  if (!handleValidation(req, res)) return;
  try {
    const results = await packageService.searchPackages(req.query.q as string, req.user!.sub, req.user!.role);
    res.json({ success: true, data: results });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'ERROR', message: err.message } });
  }
});

// GET /api/packages/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const pkg = await packageService.getPackageById(req.params.id, req.user!.sub, req.user!.role);
    res.json({ success: true, data: pkg });
  } catch (err: any) {
    const status = err.code === 'NOT_FOUND' ? 404 : err.code === 'FORBIDDEN' ? 403 : 500;
    res.status(status).json({ success: false, error: { code: err.code || 'ERROR', message: err.message } });
  }
});

// GET /api/packages/:id/tracking
router.get('/:id/tracking', async (req: Request, res: Response) => {
  try {
    const pkg = await packageService.getPackageById(req.params.id, req.user!.sub, req.user!.role);
    res.json({ success: true, data: { packageId: pkg.packageId, status: pkg.status, trackingHistory: pkg.trackingHistory } });
  } catch (err: any) {
    const status = err.code === 'NOT_FOUND' ? 404 : err.code === 'FORBIDDEN' ? 403 : 500;
    res.status(status).json({ success: false, error: { code: err.code || 'ERROR', message: err.message } });
  }
});

// PATCH /api/packages/:id/status
router.patch('/:id/status', requireRole('agent'), [
  body('status').isIn(['dropped_off_at_agent', 'dispatched', 'arrived_at_destination_agent', 'out_for_delivery', 'delivered', 'returned']),
  body('agentId').notEmpty(),
], async (req: Request, res: Response) => {
  if (!handleValidation(req, res)) return;
  try {
    const pkg = await packageService.updatePackageStatus(req.params.id, req.body.status, req.body.agentId, req.user!.sub);
    // Trigger notifications and payment prompts
    // For 'returned', notifyPackageReturned sends a specific message — skip the generic one
    if (pkg.status === 'returned') {
      notificationService.notifyPackageReturned(pkg.packageId).catch(() => {});
    } else {
      notificationService.notifyPackageStatusChange(pkg.packageId, pkg.status).catch(() => {});
    }
    if (pkg.status === 'dropped_off_at_agent' && pkg.deliveryMethod === 'rent_a_shelf') {
      notificationService.notifyReleaseCode(pkg.packageId).catch(() => {});
    }
    if (pkg.status === 'arrived_at_destination_agent') {
      notificationService.notifyReleaseCode(pkg.packageId).catch(() => {});
      paymentService.sendItemPricePrompt(pkg.packageId).catch(() => {});
    }
    if (pkg.status === 'out_for_delivery') {
      paymentService.sendItemPricePrompt(pkg.packageId).catch(() => {});
    }
    res.json({ success: true, data: pkg });
  } catch (err: any) {
    const status = err.code === 'NOT_FOUND' ? 404 : err.code === 'FORBIDDEN' ? 403 : err.code === 'CONFLICT' ? 409 : 400;
    res.status(status).json({ success: false, error: { code: err.code || 'ERROR', message: err.message } });
  }
});

// PATCH /api/packages/:id/cancel — business owner cancels a created package
router.patch('/:id/cancel', requireRole('business_owner'), async (req: Request, res: Response) => {
  try {
    const { Package } = await import('../models/Package');
    const { Types } = await import('mongoose');
    const pkg = await Package.findOne({ packageId: req.params.id });
    if (!pkg) { res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Package not found' } }); return; }
    if (!pkg.businessOwnerId.equals(new Types.ObjectId(req.user!.sub))) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } }); return;
    }
    if (pkg.status !== 'created') {
      res.status(409).json({ success: false, error: { code: 'CONFLICT', message: 'Only packages with status "created" can be cancelled' } }); return;
    }
    pkg.status = 'cancelled';
    pkg.trackingHistory.push({ status: 'cancelled' as any, timestamp: new Date(), updatedBy: new Types.ObjectId(req.user!.sub), location: 'Cancelled by business owner' });
    await pkg.save();
    res.json({ success: true, data: pkg });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'ERROR', message: err.message } });
  }
});

// PATCH /api/packages/:id/admin-status — admin overrides any package status
router.patch('/:id/admin-status', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { Package } = await import('../models/Package');
    const { Types } = await import('mongoose');
    const { status, note } = req.body;
    if (!status) { res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'status is required' } }); return; }
    const pkg = await Package.findOne({ packageId: req.params.id });
    if (!pkg) { res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Package not found' } }); return; }
    pkg.status = status;
    pkg.trackingHistory.push({ status, timestamp: new Date(), updatedBy: new Types.ObjectId(req.user!.sub), location: note || 'Admin override' });
    if (status === 'delivered') pkg.deliveredAt = new Date();
    await pkg.save();
    res.json({ success: true, data: pkg });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'ERROR', message: err.message } });
  }
});

export default router;
