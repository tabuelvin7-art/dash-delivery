import { Request, Response, NextFunction } from 'express';

// ---------------------------------------------------------------------------
// Task 3.9 – Input sanitization middleware (NoSQL injection prevention)
// ---------------------------------------------------------------------------

/**
 * MongoDB operators that must be stripped from user input to prevent
 * NoSQL injection attacks.
 */
const MONGO_OPERATORS = [
  '$where',
  '$ne',
  '$gt',
  '$gte',
  '$lt',
  '$lte',
  '$in',
  '$nin',
  '$or',
  '$and',
  '$not',
  '$nor',
  '$exists',
  '$type',
  '$expr',
  '$regex',
  '$text',
  '$mod',
  '$all',
  '$elemMatch',
  '$size',
  '$slice',
  '$set',
  '$unset',
  '$inc',
  '$push',
  '$pull',
  '$addToSet',
  '$rename',
  '$lookup',
  '$match',
  '$group',
  '$project',
  '$sort',
  '$limit',
  '$skip',
  '$unwind',
  '$function',
  '$accumulator',
];

/**
 * Recursively strip MongoDB operator keys from an object or array.
 * Returns a sanitized deep copy.
 */
function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }

  if (value !== null && typeof value === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (MONGO_OPERATORS.includes(key)) {
        // Drop the operator key entirely
        continue;
      }
      sanitized[key] = sanitizeValue(val);
    }
    return sanitized;
  }

  // Primitive – return as-is
  return value;
}

/**
 * Check whether an object (or nested structure) contains any MongoDB operators.
 * Used to detect and reject injection attempts before processing.
 */
function containsMongoOperator(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(containsMongoOperator);
  }

  if (value !== null && typeof value === 'object') {
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (MONGO_OPERATORS.includes(key)) return true;
      if (containsMongoOperator(val)) return true;
    }
  }

  return false;
}

/**
 * Express middleware that sanitizes req.body, req.query, and req.params by
 * stripping MongoDB operator keys.  If any operator is detected the request
 * is rejected with a 400 validation error (Requirement 19.3).
 */
export function sanitizeInputs(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const targets: Array<'body' | 'query' | 'params'> = ['body', 'query', 'params'];

  for (const target of targets) {
    if (containsMongoOperator(req[target])) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Input contains invalid characters or operators',
          details: [
            {
              field: target,
              message: 'MongoDB operators are not allowed in user input',
            },
          ],
        },
      });
      return;
    }
  }

  // Sanitize in place (belt-and-suspenders: strip operators even if none were
  // detected at the top level, in case of deeply nested structures)
  req.body = sanitizeValue(req.body);
  req.query = sanitizeValue(req.query) as Request['query'];
  req.params = sanitizeValue(req.params) as Request['params'];

  next();
}
