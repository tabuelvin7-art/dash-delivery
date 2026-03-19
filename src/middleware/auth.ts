import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { isTokenBlacklisted } from '../services/authService';

// ---------------------------------------------------------------------------
// Augment Express Request to carry the authenticated user payload
// ---------------------------------------------------------------------------

export interface AuthUser {
  sub: string;
  email: string;
  role: 'business_owner' | 'customer' | 'agent' | 'admin';
  isPhoneVerified: boolean;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getJwtSecret(): string {
  const secret = process.env['JWT_SECRET'];
  if (!secret) throw new Error('JWT_SECRET environment variable is not set');
  return secret;
}

function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice(7);
}

// ---------------------------------------------------------------------------
// Task 3.6 – verifyToken middleware
// ---------------------------------------------------------------------------

/**
 * Verify the JWT in the Authorization header.
 * Attaches the decoded payload to req.user on success.
 */
export function verifyToken(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const token = extractBearerToken(req);

  if (!token) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication token is required' },
    });
    return;
  }

  if (isTokenBlacklisted(token)) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Token has been invalidated' },
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as AuthUser;
    req.user = decoded;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        error: { code: 'TOKEN_EXPIRED', message: 'Authentication token has expired' },
      });
    } else {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid authentication token' },
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Task 3.6 – requirePhoneVerification middleware
// ---------------------------------------------------------------------------

/**
 * Reject requests from users whose phone number has not been verified.
 * Must be used after verifyToken.
 */
export function requirePhoneVerification(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
    });
    return;
  }

  if (!req.user.isPhoneVerified) {
    res.status(403).json({
      success: false,
      error: {
        code: 'PHONE_NOT_VERIFIED',
        message: 'Phone number verification is required to access this resource',
      },
    });
    return;
  }

  next();
}
