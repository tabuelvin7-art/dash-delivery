/**
 * Property-based tests for package management.
 * Properties: Package status validity, status transitions, release code generation,
 *             package ID uniqueness, delivery method validation.
 */
import * as fc from 'fast-check';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Package } from '../../models/Package';
import { User } from '../../models/User';
import { Agent, IAgent } from '../../models/Agent';
import { createPackage, updatePackageStatus } from '../../services/packageService';
import { packageStatuses } from '../helpers/testFactories';

process.env['JWT_SECRET'] = 'test-secret-key-for-jest';

let mongod: MongoMemoryServer;
let ownerId: string;
let customerId: string;
let agentUserId: string;
let agentDocObjectId: string; // _id used for destinationAgentId
let agentDocAgentId: string;  // agentId string used for updatePackageStatus

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  const owner = await User.create({
    email: 'owner@pkg.test',
    phoneNumber: '+254700000001',
    passwordHash: 'hashed',
    role: 'business_owner',
    isPhoneVerified: true,
    isActive: true,
    profile: { firstName: 'Owner', lastName: 'Test' },
  });
  ownerId = owner._id.toString();

  const customer = await User.create({
    email: 'customer@pkg.test',
    phoneNumber: '+254700000002',
    passwordHash: 'hashed',
    role: 'customer',
    isPhoneVerified: true,
    isActive: true,
    profile: { firstName: 'Customer', lastName: 'Test' },
  });
  customerId = customer._id.toString();

  const agentUser = await User.create({
    email: 'agent@pkg.test',
    phoneNumber: '+254700000003',
    passwordHash: 'hashed',
    role: 'agent',
    isPhoneVerified: true,
    isActive: true,
    profile: { firstName: 'Agent', lastName: 'Test' },
  });
  agentUserId = agentUser._id.toString();

  const agentDoc = await Agent.create({
    userId: agentUserId,
    locationName: 'Test Location',
    address: '123 Test St',
    neighborhood: 'Westlands',
    city: 'Nairobi',
    coordinates: { latitude: -1.3, longitude: 36.8 },
    contactPhone: '+254722000001',
    operatingHours: { open: '08:00', close: '18:00', daysOfWeek: ['Monday'] },
    capacity: { totalShelves: 50, availableShelves: 50 },
    isActive: true,
  });
  agentDocObjectId = agentDoc._id.toString();
  agentDocAgentId = (agentDoc as IAgent).agentId;
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  await mongod.stop();
});

afterEach(async () => {
  await Package.deleteMany({});
});

// ─── Property 9: Package Status Validity ─────────────────────────────────────
// Validates: Requirements 3.5, 4.3
test('Property 9: newly created package always has status "created"', async () => {
  await fc.assert(
    fc.asyncProperty(fc.nat(), async () => {
      const pkg = await createPackage({
        businessOwnerId: ownerId,
        customerId,
        destinationAgentId: agentDocObjectId,
        deliveryMethod: 'agent_delivery',
        itemPrice: 1000,
        deliveryFee: 150,
      });
      expect(pkg.status).toBe('created');
      expect(packageStatuses).toContain(pkg.status);
    }),
    { numRuns: 5 }
  );
});

// ─── Property 7: Package ID Uniqueness ───────────────────────────────────────
// Validates: Requirements 3.1, 3.2
test('Property 7: each package gets a unique packageId', async () => {
  await Package.deleteMany({});
  const ids = new Set<string>();
  for (let i = 0; i < 5; i++) {
    const pkg = await createPackage({
      businessOwnerId: ownerId,
      customerId,
      destinationAgentId: agentDocObjectId,
      deliveryMethod: 'agent_delivery',
      itemPrice: 500,
      deliveryFee: 100,
    });
    expect(ids.has(pkg.packageId)).toBe(false);
    ids.add(pkg.packageId);
  }
  expect(ids.size).toBe(5);
});

// ─── Property 10: Status Update Tracking History ─────────────────────────────
// Validates: Requirements 4.2, 4.4
test('Property 10: every status update appends to tracking history', async () => {
  const pkg = await createPackage({
    businessOwnerId: ownerId,
    customerId,
    destinationAgentId: agentDocObjectId,
    deliveryMethod: 'agent_delivery',
    itemPrice: 500,
    deliveryFee: 100,
  });

  const initialHistoryLength = pkg.trackingHistory.length;
  expect(initialHistoryLength).toBeGreaterThan(0);

  // Valid transition: created → dropped_off_at_agent
  const updated = await updatePackageStatus(
    pkg.packageId,
    'dropped_off_at_agent',
    agentDocAgentId,
    agentUserId
  );

  expect(updated.trackingHistory.length).toBe(initialHistoryLength + 1);
  expect(updated.status).toBe('dropped_off_at_agent');
  const lastEntry = updated.trackingHistory[updated.trackingHistory.length - 1];
  expect(lastEntry.status).toBe('dropped_off_at_agent');
  expect(lastEntry.timestamp).toBeDefined();
});

// ─── Property 22: Arrival Status Generates Release Code ──────────────────────
// Validates: Requirements 9.1, 9.3
test('Property 22: status "arrived_at_destination_agent" generates a 6-digit release code', async () => {
  const pkg = await createPackage({
    businessOwnerId: ownerId,
    customerId,
    destinationAgentId: agentDocObjectId,
    deliveryMethod: 'agent_delivery',
    itemPrice: 500,
    deliveryFee: 100,
  });

  // Advance through valid transition chain: created → dropped_off_at_agent → dispatched → arrived
  await updatePackageStatus(pkg.packageId, 'dropped_off_at_agent', agentDocAgentId, agentUserId);
  await updatePackageStatus(pkg.packageId, 'dispatched', agentDocAgentId, agentUserId);
  const arrived = await updatePackageStatus(
    pkg.packageId,
    'arrived_at_destination_agent',
    agentDocAgentId,
    agentUserId
  );

  expect(arrived.releaseCode).toBeDefined();
  expect(arrived.releaseCode).toMatch(/^\d{6}$/);
});

// ─── Property 4: Delivery Method Validation ──────────────────────────────────
// Validates: Requirements 2.1, 2.2
test('Property 4: package creation rejects invalid delivery methods', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.string({ minLength: 1, maxLength: 20 }).filter(
        (s) => !['agent_delivery', 'doorstep_delivery', 'rent_a_shelf'].includes(s)
      ),
      async (invalidMethod) => {
        await expect(
          createPackage({
            businessOwnerId: ownerId,
            customerId,
            destinationAgentId: agentDocObjectId,
            deliveryMethod: invalidMethod as any,
            itemPrice: 500,
            deliveryFee: 100,
          })
        ).rejects.toThrow();
      }
    ),
    { numRuns: 10 }
  );
});
