import { Router, Request, Response } from 'express';
import { body } from 'express-validator';
import * as shelfService from '../services/shelfRentalService';
import { verifyToken } from '../middleware/auth';
import { requireRole } from '../middleware/authorize';
import { sanitizeInputs } from '../middleware/sanitize';
import { handleValidation } from '../utils/routeHelpers';

const router = Router();
router.use(verifyToken, sanitizeInputs);

/** Recalculate total rental amount from start/end dates and monthly rate. */
function calcTotal(startDate: Date, endDate: Date, monthlyRate: number): number {
  const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  return Math.ceil(days / 30) * monthlyRate;
}

// GET /api/shelves/my-rentals
router.get('/my-rentals', requireRole('business_owner'), async (req: Request, res: Response) => {
  try {
    const page = req.query.page ? parseInt(req.query.page as string) : 1;
    const result = await shelfService.getRentalsByBusinessOwner(req.user!.sub, page);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'ERROR', message: err.message } });
  }
});

// GET /api/shelves/my-earnings — agent sees their shelf rental income
router.get('/my-earnings', requireRole('agent'), async (req: Request, res: Response) => {
  try {
    const { Agent } = await import('../models/Agent');
    const agent = await Agent.findOne({ userId: req.user!.sub });
    if (!agent) { res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Agent profile not found' } }); return; }
    const { ShelfRental } = await import('../models/ShelfRental');
    const { Payment } = await import('../models/Payment');
    const rentals = await ShelfRental.find({ agentId: agent._id }).sort({ createdAt: -1 });
    const totalEarned = rentals.reduce((sum, r) => sum + (r.pricing?.totalAmount || 0), 0);
    const activeRentals = rentals.filter(r => r.status === 'active').length;
    const payments = await Payment.find({ payeeId: agent.userId, paymentType: 'shelf_rental', status: 'completed' });
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    res.json({ success: true, data: { totalEarned, totalPaid, activeRentals, rentals } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'ERROR', message: err.message } });
  }
});

// POST /api/shelves/rent  — must be before /:agentId to avoid param conflict
router.post('/rent', requireRole('business_owner'), [
  body('agentId').notEmpty(),
  body('shelfNumber').notEmpty(),
  body('startDate').isISO8601(),
  body('endDate').isISO8601(),
  body('monthlyRate').isFloat({ min: 0 }),
], async (req: Request, res: Response) => {
  if (!handleValidation(req, res)) return;
  try {
    const { agentId, shelfNumber, startDate, endDate, monthlyRate } = req.body;
    const rental = await shelfService.createRental(req.user!.sub, agentId, shelfNumber, new Date(startDate), new Date(endDate), monthlyRate);
    res.status(201).json({ success: true, data: rental });
  } catch (err: any) {
    const status = err.code === 'NOT_FOUND' ? 404 : err.code === 'CONFLICT' ? 409 : 400;
    res.status(status).json({ success: false, error: { code: err.code || 'ERROR', message: err.message } });
  }
});

// PATCH /api/shelves/:id — edit rental (endDate or days, shelfNumber, monthlyRate)
router.patch('/:id', requireRole('business_owner'), async (req: Request, res: Response) => {
  try {
    const { ShelfRental } = await import('../models/ShelfRental');
    const { Types } = await import('mongoose');
    const rental = await ShelfRental.findById(req.params.id);
    if (!rental) { res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Rental not found' } }); return; }
    if (!rental.businessOwnerId.equals(new Types.ObjectId(req.user!.sub))) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } }); return;
    }
    const { shelfNumber, monthlyRate, endDate } = req.body;
    if (shelfNumber) rental.shelfNumber = shelfNumber;
    if (monthlyRate) rental.pricing.monthlyRate = Number(monthlyRate);
    if (endDate) rental.rentalPeriod.endDate = new Date(endDate);
    rental.pricing.totalAmount = calcTotal(rental.rentalPeriod.startDate, rental.rentalPeriod.endDate, rental.pricing.monthlyRate);
    await rental.save();
    res.json({ success: true, data: rental });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'ERROR', message: err.message } });
  }
});

// POST /api/shelves/:id/inventory — add item
router.post('/:id/inventory', requireRole('business_owner'), [
  body('itemName').notEmpty(),
  body('quantity').isInt({ min: 1 }),
], async (req: Request, res: Response) => {
  if (!handleValidation(req, res)) return;
  try {
    // :id is the MongoDB _id from the frontend
    const { ShelfRental } = await import('../models/ShelfRental');
    const rental = await ShelfRental.findById(req.params.id);
    if (!rental) { res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Rental not found' } }); return; }
    const result = await shelfService.addInventoryItem(rental.rentalId, req.user!.sub, req.body.itemName, req.body.quantity || 1);
    res.json({ success: true, data: result });
  } catch (err: any) {
    const status = err.code === 'NOT_FOUND' ? 404 : err.code === 'FORBIDDEN' ? 403 : 400;
    res.status(status).json({ success: false, error: { code: err.code || 'ERROR', message: err.message } });
  }
});

// DELETE /api/shelves/:id/inventory/:itemName — remove item
router.delete('/:id/inventory/:itemName', requireRole('business_owner'), async (req: Request, res: Response) => {
  try {
    const { ShelfRental } = await import('../models/ShelfRental');
    const rental = await ShelfRental.findById(req.params.id);
    if (!rental) { res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Rental not found' } }); return; }
    const result = await shelfService.removeInventoryItem(rental.rentalId, req.user!.sub, decodeURIComponent(req.params.itemName));
    res.json({ success: true, data: result });
  } catch (err: any) {
    const status = err.code === 'NOT_FOUND' ? 404 : err.code === 'FORBIDDEN' ? 403 : 400;
    res.status(status).json({ success: false, error: { code: err.code || 'ERROR', message: err.message } });
  }
});

// POST /api/shelves/:id/renew — extend an active or expired rental
router.post('/:id/renew', requireRole('business_owner'), async (req: Request, res: Response) => {
  try {
    const { ShelfRental } = await import('../models/ShelfRental');
    const { Types } = await import('mongoose');
    const rental = await ShelfRental.findById(req.params.id);
    if (!rental) { res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Rental not found' } }); return; }
    if (!rental.businessOwnerId.equals(new Types.ObjectId(req.user!.sub))) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } }); return;
    }
    const { endDate } = req.body;
    if (!endDate) { res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'endDate is required' } }); return; }
    const newEnd = new Date(endDate);
    // Extend from current endDate (or today if already expired)
    const base = rental.rentalPeriod.endDate > new Date() ? rental.rentalPeriod.endDate : new Date();
    if (newEnd <= base) { res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'New end date must be after current end date' } }); return; }
    rental.rentalPeriod.endDate = newEnd;
    rental.status = 'active';
    rental.pricing.totalAmount = calcTotal(rental.rentalPeriod.startDate, rental.rentalPeriod.endDate, rental.pricing.monthlyRate);
    await rental.save();
    res.json({ success: true, data: rental });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'ERROR', message: err.message } });
  }
});

// GET /api/shelves/:agentId  — wildcard, must stay last
router.get('/:agentId', async (req: Request, res: Response) => {
  try {
    const page = req.query.page ? parseInt(req.query.page as string) : 1;
    const result = await shelfService.getRentalsByAgent(req.params.agentId, page);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: err.message } });
  }
});

export default router;
