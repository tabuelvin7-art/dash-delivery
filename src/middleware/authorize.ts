import { Request, Response, NextFunction } from 'express';
import { AuthUser } from './auth';

// ---------------------------------------------------------------------------
// Task 3.7 – requireRole middleware
// ---------------------------------------------------------------------------

/**
 * Restrict access to users with one of the specified roles.
 * Must be used after verifyToken.
 */
export function requireRole(...roles: AuthUser['role'][]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Access restricted to: ${roles.join(', ')}`,
        },
      });
      return;
    }

    next();
  };
}

// ---------------------------------------------------------------------------
// Task 3.7 – requireOwnership middleware
// ---------------------------------------------------------------------------

/**
 * Options for the ownership check.
 *
 * @param getResourceOwnerId  Async function that resolves the owner ID of the
 *                            requested resource from the current request.
 *                            Return null/undefined if the resource is not found.
 * @param allowedRoles        Roles that bypass the ownership check (e.g. 'admin').
 */
export interface OwnershipOptions {
  getResourceOwnerId: (req: Request) => Promise<string | null | undefined>;
  allowedRoles?: AuthUser['role'][];
}

/**
 * Validate that the authenticated user owns the requested resource.
 * Users whose role is listed in `allowedRoles` bypass the ownership check.
 * Must be used after verifyToken.
 */
export function requireOwnership(options: OwnershipOptions) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
      return;
    }

    // Privileged roles bypass ownership check
    if (options.allowedRoles && options.allowedRoles.includes(req.user.role)) {
      next();
      return;
    }

    try {
      const ownerId = await options.getResourceOwnerId(req);

      if (ownerId === null || ownerId === undefined) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Resource not found' },
        });
        return;
      }

      if (ownerId !== req.user.sub) {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have permission to access this resource',
          },
        });
        return;
      }

      next();
    } catch {
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to verify resource ownership' },
      });
    }
  };
}
