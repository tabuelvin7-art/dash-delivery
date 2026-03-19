import { Router, Request, Response } from 'express';
import * as paymentService from '../services/paymentService';
import { verifyToken, requirePhoneVerification } from '../middleware/auth';
import { sanitizeInputs } from '../middleware/sanitize';

const router = Router();

router.use(verifyToken, requirePhoneVerification, sanitizeInputs);

// GET /api/payments/history
router.get('/history', async (req: Request, res: Response) => {
  try {
    const page = req.query.page ? parseInt(req.query.page as string) : 1;
    const result = await paymentService.getPaymentHistory(req.user!.sub, req.user!.role as any, page);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'ERROR', message: err.message } });
  }
});

// GET /api/payments/:packageId
router.get('/:packageId', async (req: Request, res: Response) => {
  try {
    const payment = await paymentService.getPaymentByPackageId(req.params.packageId);
    if (!payment) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Payment not found' } });
      return;
    }
    res.json({ success: true, data: payment });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'ERROR', message: err.message } });
  }
});

// POST /api/payments/retry
router.post('/retry', async (req: Request, res: Response) => {
  const { transactionId } = req.body;
  if (!transactionId) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'transactionId required' } });
    return;
  }
  try {
    const payment = await paymentService.retryPayment(transactionId, req.user!.sub);
    res.json({ success: true, data: payment });
  } catch (err: any) {
    const status = err.code === 'NOT_FOUND' ? 404 : err.code === 'FORBIDDEN' ? 403 : err.code === 'CONFLICT' ? 409 : 400;
    res.status(status).json({ success: false, error: { code: err.code || 'ERROR', message: err.message } });
  }
});

export default router;
