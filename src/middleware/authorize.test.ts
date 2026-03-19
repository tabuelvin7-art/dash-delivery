import { Request, Response, NextFunction } from 'express';
import { requireRole, requireOwnership } from './authorize';

function mockRes() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

describe('requireRole middleware', () => {
  const next: NextFunction = jest.fn();

  beforeEach(() => jest.clearAllMocks());

  it('calls next when user has an allowed role', () => {
    const req = { user: { sub: 'u1', role: 'admin', isPhoneVerified: true } } as Request;
    const res = mockRes();
    requireRole('admin')(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('returns 403 when user role is not allowed', () => {
    const req = { user: { sub: 'u1', role: 'customer', isPhoneVerified: true } } as Request;
    const res = mockRes();
    requireRole('admin')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when no user on request', () => {
    const req = { user: undefined } as Request;
    const res = mockRes();
    requireRole('admin')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('accepts multiple allowed roles', () => {
    const req = { user: { sub: 'u1', role: 'agent', isPhoneVerified: true } } as Request;
    const res = mockRes();
    requireRole('admin', 'agent')(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});

describe('requireOwnership middleware', () => {
  const next: NextFunction = jest.fn();

  beforeEach(() => jest.clearAllMocks());

  it('calls next when user owns the resource', async () => {
    const req = { user: { sub: 'owner-id', role: 'customer', isPhoneVerified: true } } as Request;
    const res = mockRes();
    const mw = requireOwnership({ getResourceOwnerId: async () => 'owner-id' });
    await mw(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('returns 403 when user does not own the resource', async () => {
    const req = { user: { sub: 'other-id', role: 'customer', isPhoneVerified: true } } as Request;
    const res = mockRes();
    const mw = requireOwnership({ getResourceOwnerId: async () => 'owner-id' });
    await mw(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 404 when resource is not found', async () => {
    const req = { user: { sub: 'u1', role: 'customer', isPhoneVerified: true } } as Request;
    const res = mockRes();
    const mw = requireOwnership({ getResourceOwnerId: async () => null });
    await mw(req, res, next);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('bypasses ownership check for allowed roles', async () => {
    const req = { user: { sub: 'admin-id', role: 'admin', isPhoneVerified: true } } as Request;
    const res = mockRes();
    const mw = requireOwnership({
      getResourceOwnerId: async () => 'owner-id',
      allowedRoles: ['admin'],
    });
    await mw(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
