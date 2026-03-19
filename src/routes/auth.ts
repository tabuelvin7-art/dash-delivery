import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import * as authService from '../services/authService';
import { verifyToken } from '../middleware/auth';
import { sanitizeInputs } from '../middleware/sanitize';
import { auditLog } from '../middleware/auditLog';

const router = Router();

const handleValidation = (req: Request, res: Response): boolean => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: errors.array().map(e => ({ field: (e as any).path, message: e.msg })) } });
    return false;
  }
  return true;
};

// POST /api/auth/register
router.post('/register', sanitizeInputs, [
  body('email').isEmail().withMessage('Valid email required'),
  body('phoneNumber').matches(/^\+254\d{9}$/).withMessage('Phone must be +254XXXXXXXXX'),
  body('password').matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/).withMessage('Password must be 8+ chars with uppercase, lowercase, number & symbol'),
  body('role').isIn(['business_owner', 'customer']).withMessage('Role must be business_owner or customer'),
  body('profile.firstName').notEmpty().withMessage('First name required'),
  body('profile.lastName').notEmpty().withMessage('Last name required'),
], async (req: Request, res: Response) => {
  if (!handleValidation(req, res)) return;
  try {
    const { user, otp } = await authService.register(req.body);
    const response: any = { success: true, data: { userId: user._id, email: user.email, role: user.role }, message: 'Registration successful' };
    // Expose OTP in dev mode so the frontend can pre-fill the verify page
    if (process.env.NODE_ENV !== 'production') response.devOtp = otp;
    res.status(201).json(response);
  } catch (err: any) {
    const status = err.code === 'CONFLICT' ? 409 : 400;
    res.status(status).json({ success: false, error: { code: err.code || 'ERROR', message: err.message } });
  }
});

// POST /api/auth/login
router.post('/login', sanitizeInputs, auditLog('AUTH_LOGIN_ATTEMPT'), [
  body('email').isEmail(),
  body('password').notEmpty(),
], async (req: Request, res: Response) => {
  if (!handleValidation(req, res)) return;
  try {
    const { user, tokens } = await authService.login(req.body);
    res.json({ success: true, data: { user: { id: user._id, email: user.email, role: user.role, isPhoneVerified: user.isPhoneVerified, phoneNumber: user.phoneNumber, profile: user.profile }, tokens } });
  } catch (err: any) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: err.message } });
  }
});

// POST /api/auth/refresh-token
router.post('/refresh-token', async (req: Request, res: Response) => {
  const { token } = req.body;
  if (!token) { res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Token required' } }); return; }
  try {
    const tokens = await authService.refreshToken(token);
    res.json({ success: true, data: tokens });
  } catch (err: any) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: err.message } });
  }
});

// POST /api/auth/verify-phone
router.post('/verify-phone', sanitizeInputs, [
  body('phoneNumber').matches(/^\+254\d{9}$/).withMessage('Phone must be +254XXXXXXXXX'),
  body('otp').isLength({ min: 6, max: 6 }).isNumeric().withMessage('OTP must be 6 digits'),
], async (req: Request, res: Response) => {
  if (!handleValidation(req, res)) return;
  try {
    const { phoneNumber, otp } = req.body;
    await authService.verifyPhone(phoneNumber, otp);
    res.json({ success: true, message: 'Phone verified successfully' });
  } catch (err: any) {
    const status = err.code === 'NOT_FOUND' ? 404 : 400;
    res.status(status).json({ success: false, error: { code: err.code || 'ERROR', message: err.message } });
  }
});

// POST /api/auth/logout — no auth required; token may already be expired
router.post('/logout', (req: Request, res: Response) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (token) authService.logout(token);
  res.json({ success: true, message: 'Logged out successfully' });
});

export default router;
