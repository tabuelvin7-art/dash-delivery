/**
 * Integration tests for package endpoints.
 * Tests: create, list, get by ID, status update, search
 */
import request from 'supertest';
import app from '../../index';
import { connectTestDb, disconnectTestDb, clearTestDb } from '../helpers/testDb';
import { Agent } from '../../models/Agent';
import { User } from '../../models/User';

beforeAll(async () => {
  await connectTestDb();
});

afterAll(async () => {
  await disconnectTestDb();
});

afterEach(async () => {
  await clearTestDb();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function registerAndLogin(
  email: string,
  phone: string,
  role: 'business_owner' | 'customer' | 'agent' | 'admin'
) {
  const regRes = await request(app).post('/api/auth/register').send({
    email,
    phoneNumber: phone,
    password: 'Password123!',
    role,
    profile: { firstName: 'Test', lastName: 'User' },
  });
  const otp = regRes.body.otp;
  await request(app).post('/api/auth/verify-phone').send({ phoneNumber: phone, otp });
  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email, password: 'Password123!' });
  return {
    token: loginRes.body.data.tokens.accessToken,
    userId: regRes.body.data.userId,
  };
}

async function createTestAgent(userId: string) {
  return Agent.create({
    userId,
    locationName: 'Test Agent Location',
    address: '123 Test St, Westlands',
    neighborhood: 'Westlands',
    city: 'Nairobi',
    coordinates: { latitude: -1.3, longitude: 36.8 },
    contactPhone: '+254722000001',
    operatingHours: { open: '08:00', close: '18:00', daysOfWeek: ['Monday', 'Tuesday'] },
    capacity: { totalShelves: 50, availableShelves: 50 },
    isActive: true,
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/packages', () => {
  it('creates a package as business_owner', async () => {
    const { token } = await registerAndLogin(
      'owner@test.com', '+254700000001', 'business_owner'
    );
    const { userId: custId } = await registerAndLogin(
      'cust@test.com', '+254700000002', 'customer'
    );
    // Create an agent user directly in DB (agents can't self-register via API)
    const agentUser = await User.create({
      email: 'agentuser@test.com',
      phoneNumber: '+254700000009',
      passwordHash: 'hashed',
      role: 'agent',
      isPhoneVerified: true,
      isActive: true,
      profile: { firstName: 'Agent', lastName: 'User' },
    });
    const agent = await createTestAgent(agentUser._id.toString());

    const res = await request(app)
      .post('/api/packages')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerId: custId,
        destinationAgentId: agent._id,
        deliveryMethod: 'agent_delivery',
        itemDescription: 'Books',
        itemPrice: 1000,
        deliveryFee: 150,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.packageId).toMatch(/^PKG-/);
    expect(res.body.data.status).toBe('created');
  });

  it('rejects package creation by customer role', async () => {
    const { token } = await registerAndLogin('cust2@test.com', '+254700000003', 'customer');
    const res = await request(app)
      .post('/api/packages')
      .set('Authorization', `Bearer ${token}`)
      .send({ customerId: 'x', deliveryMethod: 'agent_delivery', itemPrice: 100, deliveryFee: 50 });
    expect(res.status).toBe(403);
  });

  it('rejects unauthenticated request', async () => {
    const res = await request(app).post('/api/packages').send({});
    expect(res.status).toBe(401);
  });
});

describe('GET /api/packages', () => {
  it('returns packages for business_owner', async () => {
    const { token } = await registerAndLogin(
      'owner2@test.com', '+254700000004', 'business_owner'
    );
    const res = await request(app)
      .get('/api/packages')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe('GET /api/packages/:id', () => {
  it('returns 404 for non-existent package', async () => {
    const { token } = await registerAndLogin(
      'owner3@test.com', '+254700000005', 'business_owner'
    );
    const res = await request(app)
      .get('/api/packages/PKG-NONEXISTENT')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

describe('Authorization', () => {
  it('returns 401 when no token provided', async () => {
    const res = await request(app).get('/api/packages');
    expect(res.status).toBe(401);
  });

  it('returns 401 with invalid token', async () => {
    const res = await request(app)
      .get('/api/packages')
      .set('Authorization', 'Bearer invalid.token.here');
    expect(res.status).toBe(401);
  });
});
