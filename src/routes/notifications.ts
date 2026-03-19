import { Router, Request, Response } from 'express';
import * as notificationService from '../services/notificationService';
import { verifyToken, requirePhoneVerification } from '../middleware/auth';
import { sanitizeInputs } from '../middleware/sanitize';

const router = Router();
router.use(verifyToken, requirePhoneVerification, sanitizeInputs);

// GET /api/notifications
router.get('/', async (req: Request, res: Response) => {
  try {
    const page = req.query.page ? parseInt(req.query.page as string) : 1;
    const result = await notificationService.getNotifications(req.user!.sub, page);
    const unreadCount = await notificationService.getUnreadCount(req.user!.sub);
    res.json({ success: true, ...result, unreadCount });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'ERROR', message: err.message } });
  }
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', async (req: Request, res: Response) => {
  try {
    const notification = await notificationService.markAsRead(req.params.id, req.user!.sub);
    res.json({ success: true, data: notification });
  } catch (err: any) {
    const status = err.code === 'NOT_FOUND' ? 404 : err.code === 'FORBIDDEN' ? 403 : 500;
    res.status(status).json({ success: false, error: { code: err.code || 'ERROR', message: err.message } });
  }
});

export default router;
