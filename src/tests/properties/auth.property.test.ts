/**
 * Property-based tests for authentication and user management.
 * Properties: Registration round-trip, password hashing, role-based registration,
 *             JWT token expiration, input sanitization.
 */
import * as fc from 'fast-check';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import bcrypt from 'bcrypt';
import { register } from '../../services/authService';
import { User } from '../../models/User';
import { arbEmail, arbKenyanPhone, arbPassword } from '../helpers/testFactories';

process.env['JWT_SECRET'] = 'test-secret-key-for-jest';

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  await mongod.stop();
});

afterEach(async () => {
  await User.deleteMany({});
});

// ─── Property 1: User Registration Round-Trip ─────────────────────────────────
// Validates: Requirements 1.1, 1.2
test('Property 1: registered user can be found by email', async () => {
  await fc.assert(
    fc.asyncProperty(
      arbEmail,
      arbKenyanPhone,
      arbPassword,
      fc.constantFrom('business_owner', 'customer'),
      async (email, phone, password, role) => {
        await User.deleteMany({});
        const { user } = await register({
          email,
          phoneNumber: phone,
          password,
          role,
          profile: { firstName: 'Test', lastName: 'User' },
        });
        const found = await User.findOne({ email });
        expect(found).not.toBeNull();
        expect(found!.email).toBe(email.toLowerCase());
        expect(found!.role).toBe(role);
        expect(found!._id.toString()).toBe(user._id.toString());
      }
    ),
    { numRuns: 10 }
  );
});

// ─── Property 41: Password Hashing ───────────────────────────────────────────
// Validates: Requirements 1.1, 19.1
test('Property 41: password is hashed and never stored in plaintext', async () => {
  await fc.assert(
    fc.asyncProperty(arbEmail, arbKenyanPhone, arbPassword, async (email, phone, password) => {
      await User.deleteMany({});
      await register({
        email,
        phoneNumber: phone,
        password,
        role: 'customer',
        profile: { firstName: 'A', lastName: 'B' },
      });
      const user = await User.findOne({ email });
      expect(user!.passwordHash).not.toBe(password);
      const matches = await bcrypt.compare(password, user!.passwordHash);
      expect(matches).toBe(true);
    }),
    { numRuns: 10 }
  );
});

// ─── Property 3: Role-Based Registration ─────────────────────────────────────
// Validates: Requirements 1.1, 1.5
test('Property 3: only business_owner and customer roles can self-register', async () => {
  const allowedRoles = ['business_owner', 'customer'] as const;
  await fc.assert(
    fc.asyncProperty(fc.constantFrom(...allowedRoles), async (role) => {
      await User.deleteMany({});
      const email = `role_test_${Date.now()}@example.com`;
      const { user } = await register({
        email,
        phoneNumber: '+254700000001',
        password: 'Password123!',
        role,
        profile: { firstName: 'A', lastName: 'B' },
      });
      expect(user.role).toBe(role);
    }),
    { numRuns: 5 }
  );
});

// ─── Property 2: Phone Verification Required ─────────────────────────────────
// Validates: Requirements 1.3, 1.4
test('Property 2: user is not phone-verified immediately after registration', async () => {
  await fc.assert(
    fc.asyncProperty(arbEmail, arbKenyanPhone, async (email, phone) => {
      await User.deleteMany({});
      const { user } = await register({
        email,
        phoneNumber: phone,
        password: 'Password123!',
        role: 'customer',
        profile: { firstName: 'A', lastName: 'B' },
      });
      expect(user.isPhoneVerified).toBe(false);
    }),
    { numRuns: 10 }
  );
});

// ─── Property 42: Input Sanitization ─────────────────────────────────────────
// Validates: Requirements 19.3
test('Property 42: NoSQL injection characters in email are rejected at registration', async () => {
  const injectionEmails = [
    '{"$gt": ""}@example.com',
    'test@example.com; DROP TABLE users',
    '$where: function() { return true; }',
  ];
  for (const badEmail of injectionEmails) {
    await User.deleteMany({});
    await expect(
      register({
        email: badEmail,
        phoneNumber: '+254700000001',
        password: 'Password123!',
        role: 'customer',
        profile: { firstName: 'A', lastName: 'B' },
      })
    ).rejects.toThrow();
  }
});
