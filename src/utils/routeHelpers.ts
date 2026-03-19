import { Request, Response } from 'express';
import { validationResult } from 'express-validator';

/** Shared validation handler — returns false and sends 400 if validation fails. */
export function handleValidation(req: Request, res: Response): boolean {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input',
        details: errors.array().map(e => ({ field: (e as any).path, message: e.msg })),
      },
    });
    return false;
  }
  return true;
}
