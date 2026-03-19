import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

// ---------------------------------------------------------------------------
// Task 9.8 – Security middleware
// Requirements: 19.1, 19.2, 20.5
// ---------------------------------------------------------------------------

/**
 * Helmet – sets secure HTTP headers (CSP, HSTS, X-Powered-By removal, etc.)
 */
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true },
});

/**
 * Rate limiter for authentication endpoints.
 * 5 requests per 15 minutes per IP (disabled in test env).
 * Requirements: 19.1, 19.4
 */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 5 : 10000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Too many attempts, please try again later' },
  },
});

/**
 * Rate limiter for payment endpoints.
 * 20 requests per 15 minutes per IP (disabled in test env).
 */
export const paymentRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 20 : 10000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Too many payment requests, please try again later' },
  },
});

/**
 * General API rate limiter – 100 requests per 15 minutes per IP (disabled in test env).
 */
export const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 100 : 10000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' },
  },
});
