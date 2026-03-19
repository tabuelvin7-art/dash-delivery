import { Router, Request, Response } from 'express';
import { User } from '../models/User';
import * as reportingService from '../services/reportingService';
import { verifyToken } from '../middleware/auth';
import { sanitizeInputs } from '../middleware/sanitize';

const router = Router();
router.use(verifyToken, sanitizeInputs);

// GET /api/users/profile
router.get('/profile', async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.user!.sub).select('-passwordHash');
    if (!user) { res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } }); return; }
    res.json({ success: true, data: user });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'ERROR', message: err.message } });
  }
});

// PATCH /api/users/profile
router.patch('/profile', async (req: Request, res: Response) => {
  try {
    const update: Record<string, any> = {};
    if (req.body.phoneNumber) update['phoneNumber'] = req.body.phoneNumber;
    if (req.body.profile) {
      const p = req.body.profile;
      if (p.firstName) update['profile.firstName'] = p.firstName;
      if (p.lastName) update['profile.lastName'] = p.lastName;
      if (p.businessName !== undefined) update['profile.businessName'] = p.businessName;
      if (p.address !== undefined) update['profile.address'] = p.address;
    }
    const user = await User.findByIdAndUpdate(req.user!.sub, { $set: update }, { new: true, runValidators: true }).select('-passwordHash');
    res.json({ success: true, data: user });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'ERROR', message: err.message } });
  }
});

// PATCH /api/users/change-password
router.patch('/change-password', async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'currentPassword and newPassword are required' } });
      return;
    }
    const PW_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;
    if (!PW_REGEX.test(newPassword)) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Password must be 8+ chars with uppercase, lowercase, number & symbol' } });
      return;
    }
    const user = await User.findById(req.user!.sub);
    if (!user) { res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } }); return; }
    const valid = await user.comparePassword(currentPassword);
    if (!valid) { res.status(400).json({ success: false, error: { code: 'INVALID_PASSWORD', message: 'Current password is incorrect' } }); return; }
    user.passwordHash = newPassword; // pre-save hook will hash it
    await user.save();
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'ERROR', message: err.message } });
  }
});

// GET /api/users/by-phone/:phone — look up a customer by phone (business owners only)
router.get('/by-phone/:phone', async (req: Request, res: Response) => {
  try {
    if (!['business_owner', 'admin'].includes(req.user!.role)) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } });
      return;
    }
    const user = await User.findOne({ phoneNumber: req.params.phone, role: 'customer' }).select('_id email phoneNumber profile role');
    if (!user) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } });
      return;
    }
    res.json({ success: true, data: user });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'ERROR', message: err.message } });
  }
});

// GET /api/users/dashboard-stats
router.get('/dashboard-stats', async (req: Request, res: Response) => {
  try {
    if (req.user!.role !== 'business_owner') {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Only business owners have dashboard stats' } });
      return;
    }
    const stats = await reportingService.getDashboardStats(req.user!.sub);
    res.json({ success: true, data: stats });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'ERROR', message: err.message } });
  }
});

export default router;
