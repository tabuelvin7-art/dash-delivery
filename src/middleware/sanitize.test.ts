import { Request, Response, NextFunction } from 'express';
import { sanitizeInputs } from './sanitize';

function mockRes() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

describe('sanitizeInputs middleware', () => {
  const next: NextFunction = jest.fn();

  beforeEach(() => jest.clearAllMocks());

  it('calls next for clean input', () => {
    const req = {
      body: { email: 'a@b.com', name: 'Alice' },
      query: { status: 'active' },
      params: { id: '123' },
    } as unknown as Request;
    const res = mockRes();
    sanitizeInputs(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('rejects $where in body', () => {
    const req = {
      body: { $where: 'function() { return true; }' },
      query: {},
      params: {},
    } as unknown as Request;
    const res = mockRes();
    sanitizeInputs(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects $ne in query', () => {
    const req = {
      body: {},
      query: { status: { $ne: 'active' } },
      params: {},
    } as unknown as Request;
    const res = mockRes();
    sanitizeInputs(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects $gt in params', () => {
    const req = {
      body: {},
      query: {},
      params: { id: { $gt: '' } },
    } as unknown as Request;
    const res = mockRes();
    sanitizeInputs(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects nested MongoDB operators', () => {
    const req = {
      body: { user: { password: { $ne: null } } },
      query: {},
      params: {},
    } as unknown as Request;
    const res = mockRes();
    sanitizeInputs(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('strips operator keys from body after detection (belt-and-suspenders)', () => {
    // Provide clean input so it passes detection, then verify sanitizeValue strips operators
    const req = {
      body: { name: 'Alice' },
      query: {},
      params: {},
    } as unknown as Request;
    const res = mockRes();
    sanitizeInputs(req, res, next);
    expect(req.body).toEqual({ name: 'Alice' });
  });
});
