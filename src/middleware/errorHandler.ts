import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

// ---------------------------------------------------------------------------
// Task 9.6 – Global error handling middleware
// ---------------------------------------------------------------------------

export interface AppError extends Error {
  code?: string;
  statusCode?: number;
  details?: unknown[];
}

/**
 * Central error handler. Must be registered AFTER all routes.
 * Requirements: 20.3, 20.4, 22.1, 22.2
 */
export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  logger.error(`${req.method} ${req.path} - ${err.message}`, {
    code: err.code,
    stack: err.stack,
    userId: req.user?.sub,
  });

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: err.details ?? [],
      },
    });
    return;
  }

  // Mongoose duplicate key
  if ((err as any).code === 11000) {
    res.status(409).json({
      success: false,
      error: { code: 'CONFLICT', message: 'Duplicate entry' },
    });
    return;
  }

  const statusMap: Record<string, number> = {
    NOT_FOUND: 404,
    FORBIDDEN: 403,
    UNAUTHORIZED: 401,
    CONFLICT: 409,
    VALIDATION_ERROR: 400,
  };

  const status = err.statusCode ?? (err.code ? (statusMap[err.code] ?? 400) : 500);

  res.status(status).json({
    success: false,
    error: {
      code: err.code ?? 'INTERNAL_ERROR',
      message: err.message ?? 'An unexpected error occurred',
      ...(err.details ? { details: err.details } : {}),
    },
  });
}

/**
 * 404 handler for unmatched routes.
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` },
  });
}
