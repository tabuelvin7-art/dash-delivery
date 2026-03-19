import { Router, Request, Response } from 'express';
import * as reportingService from '../services/reportingService';
import * as coverageService from '../services/coverageAreaService';
import { verifyToken } from '../middleware/auth';
import { requireRole } from '../middleware/authorize';
import { sanitizeInputs } from '../middleware/sanitize';

const router = Router();
router.use(verifyToken, sanitizeInputs);

// GET /api/reports/deliveries
router.get('/deliveries', requireRole('business_owner', 'admin'), async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query as any;
    const isAdmin = req.user!.role === 'admin';
    const stats = await reportingService.getDeliveryStats(req.user!.sub, startDate ? new Date(startDate) : undefined, endDate ? new Date(endDate) : undefined, isAdmin);
    res.json({ success: true, data: stats });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'ERROR', message: err.message } });
  }
});

// GET /api/reports/revenue
router.get('/revenue', requireRole('business_owner', 'admin'), async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query as any;
    const isAdmin = req.user!.role === 'admin';
    const report = await reportingService.getRevenueReport(req.user!.sub, startDate ? new Date(startDate) : undefined, endDate ? new Date(endDate) : undefined, isAdmin);
    res.json({ success: true, data: report });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'ERROR', message: err.message } });
  }
});

// GET /api/reports/export/:type  (type = 'deliveries' | 'revenue')
router.get('/export/:type', requireRole('business_owner', 'admin'), async (req: Request, res: Response) => {
  try {
    const type = req.params.type as 'deliveries' | 'revenue';
    const { startDate, endDate } = req.query as any;
    const isAdmin = req.user!.role === 'admin';
    const sd = startDate ? new Date(startDate) : undefined;
    const ed = endDate ? new Date(endDate) : undefined;
    const csv = type === 'revenue'
      ? await reportingService.exportRevenueCSV(req.user!.sub, sd, ed, isAdmin)
      : await reportingService.exportDeliveriesCSV(req.user!.sub, sd, ed, isAdmin);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${type}-report.csv"`);
    res.send(csv);
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'ERROR', message: err.message } });
  }
});

// GET /api/reports/coverage-areas
router.get('/coverage-areas', async (_req: Request, res: Response) => {
  try {
    const areas = await coverageService.getCoverageAreas();
    res.json({ success: true, data: areas });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'ERROR', message: err.message } });
  }
});

// POST /api/reports/coverage-areas/validate
router.post('/coverage-areas/validate', async (req: Request, res: Response) => {
  const { address } = req.body;
  if (!address) { res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'address required' } }); return; }
  try {
    const valid = await coverageService.validateAddressInCoverage(address);
    res.json({ success: true, data: { valid } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'ERROR', message: err.message } });
  }
});

export default router;
