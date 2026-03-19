/**
 * Audit logging middleware for sensitive operations.
 * Task 21.4: Requirements 19.6
 * Logs: payment transactions, auth attempts, package status changes, admin ops.
 */
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export function auditLog(action: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    logger.info('AUDIT', {
      action,
      requestId: req.requestId,
      userId: req.user?.sub ?? 'anonymous',
      role: req.user?.role ?? 'unknown',
      method: req.method,
      path: req.path,
      ip: req.ip,
      timestamp: new Date().toISOString(),
    });
    next();
  };
}
