import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { verifyToken, requirePhoneVerification } from './auth';
import * as authService from '../services/authService';

process.env['JWT_SECRET'] = 'test-secret-key-for-jest';

function mockRes() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

function makeToken(payload: object, expiresIn: number = 3600) {
  return jwt.sign(payload, process.env['JWT_SECRET']!, { expiresIn });
}

describe('verifyToken middleware', () => {
  const next: NextFunction = jest.fn();

  beforeEach(() => jest.clearAllMocks());

  it('attaches user to req and calls next for a valid token', () => {
    const token = makeToken({ sub: 'u1', email: 'a@b.com', role: 'customer', isPhoneVerified: true });
    const req = { headers: { authorization: `Bearer ${token}` } } as Request;
    const res = mockRes();
    verifyToken(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user?.email).toBe('a@b.com');
  });

  it('returns 401 when no Authorization header', () => {
    const req = { headers: {} } as Request;
    const res = mockRes();
    verifyToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 for an expired token', () => {
    const token = makeToken({ sub: 'u1', email: 'a@b.com', role: 'customer', isPhoneVerified: true }, -10);
    const req = { headers: { authorization: `Bearer ${token}` } } as Request;
    const res = mockRes();
    verifyToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 401 for a blacklisted token', () => {
    const token = makeToken({ sub: 'u1', email: 'a@b.com', role: 'customer', isPhoneVerified: true });
    authService.logout(token);
    const req = { headers: { authorization: `Bearer ${token}` } } as Request;
    const res = mockRes();
    verifyToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe('requirePhoneVerification middleware', () => {
  const next: NextFunction = jest.fn();

  beforeEach(() => jest.clearAllMocks());

  it('calls next when phone is verified', () => {
    const req = { user: { sub: 'u1', email: 'a@b.com', role: 'customer', isPhoneVerified: true } } as Request;
    const res = mockRes();
    requirePhoneVerification(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('returns 403 when phone is not verified', () => {
    const req = { user: { sub: 'u1', email: 'a@b.com', role: 'customer', isPhoneVerified: false } } as Request;
    const res = mockRes();
    requirePhoneVerification(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when no user on request', () => {
    const req = { user: undefined } as Request;
    const res = mockRes();
    requirePhoneVerification(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
