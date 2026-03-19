/**
 * Integration tests for authentication endpoints.
 * Tests: register, login, verify-phone, refresh-token, logout
 */
import request from 'supertest';
import app from '../../index';
import { connectTestDb, disconnectTestDb, clearTestDb } from '../helpers/testDb';

beforeAll(async () => {
  await connectTestDb();
});

afterAll(async () => {
  await disconnectTestDb();
});

afterEach(async () => {
  await clearTestDb();
});

const validUser = {
  email: 'owner@example.com',
  phoneNumber: '+254700000001',
  password: 'Password123!',
  role: 'business_owner',
  profile: { firstName: 'John', lastName: 'Doe' },
};

describe('POST /api/auth/register', () => {
  it('registers a new user and returns userId', async () => {
    const res = await request(app).post('/api/auth/register').send(validUser);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.userId).toBeDefined();
    expect(res.body.data.email).toBe(validUser.email);
  });

  it('rejects duplicate email', async () => {
    await request(app).post('/api/auth/register').send(validUser);
    const res = await request(app).post('/api/auth/register').send(validUser);
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('rejects invalid phone number format', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validUser, phoneNumber: '0700000001' });
    expect(res.status).toBe(400);
  });

  it('rejects missing required fields', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@example.com' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    // Register and verify phone first
    const regRes = await request(app).post('/api/auth/register').send(validUser);
    const otp = regRes.body.otp;
    await request(app)
      .post('/api/auth/verify-phone')
      .send({ phoneNumber: validUser.phoneNumber, otp });
  });

  it('logs in with valid credentials and returns tokens', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: validUser.email, password: validUser.password });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.tokens.accessToken).toBeDefined();
    expect(res.body.data.tokens.expiresIn).toBeDefined();
  });

  it('rejects wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: validUser.email, password: 'wrongpassword' });
    expect(res.status).toBe(401);
  });

  it('rejects non-existent email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'Password123!' });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/verify-phone', () => {
  it('verifies phone with correct OTP', async () => {
    const regRes = await request(app).post('/api/auth/register').send(validUser);
    const otp = regRes.body.otp;
    const res = await request(app)
      .post('/api/auth/verify-phone')
      .send({ phoneNumber: validUser.phoneNumber, otp });
    expect(res.status).toBe(200);
    expect(res.body.data.isPhoneVerified).toBe(true);
  });

  it('rejects wrong OTP', async () => {
    await request(app).post('/api/auth/register').send(validUser);
    const res = await request(app)
      .post('/api/auth/verify-phone')
      .send({ phoneNumber: validUser.phoneNumber, otp: '000000' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/logout', () => {
  it('logs out authenticated user', async () => {
    const regRes = await request(app).post('/api/auth/register').send(validUser);
    await request(app)
      .post('/api/auth/verify-phone')
      .send({ phoneNumber: validUser.phoneNumber, otp: regRes.body.otp });
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: validUser.email, password: validUser.password });
    expect(loginRes.body.data?.tokens?.accessToken).toBeDefined();
    const token = loginRes.body.data.tokens.accessToken;

    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
