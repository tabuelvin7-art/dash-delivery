import mongoose from 'mongoose';
import { User } from './User';
import { MongoMemoryServer } from 'mongodb-memory-server';

describe('User Model', () => {
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  afterEach(async () => {
    await User.deleteMany({});
  });

  describe('User Creation', () => {
    it('should create a valid user with all required fields', async () => {
      const userData = {
        email: 'test@example.com',
        phoneNumber: '+254712345678',
        passwordHash: 'plainPassword123',
        role: 'customer' as const,
        profile: {
          firstName: 'John',
          lastName: 'Doe',
        },
      };

      const user = await User.create(userData);

      expect(user.email).toBe('test@example.com');
      expect(user.phoneNumber).toBe('+254712345678');
      expect(user.role).toBe('customer');
      expect(user.profile.firstName).toBe('John');
      expect(user.profile.lastName).toBe('Doe');
      expect(user.isPhoneVerified).toBe(false);
      expect(user.isActive).toBe(true);
      expect(user.createdAt).toBeDefined();
      expect(user.updatedAt).toBeDefined();
    });

    it('should hash password before saving', async () => {
      const plainPassword = 'mySecurePassword123';
      const userData = {
        email: 'hash@example.com',
        phoneNumber: '+254723456789',
        passwordHash: plainPassword,
        role: 'business_owner' as const,
        profile: {
          firstName: 'Jane',
          lastName: 'Smith',
        },
      };

      const user = await User.create(userData);

      expect(user.passwordHash).not.toBe(plainPassword);
      expect(user.passwordHash.length).toBeGreaterThan(20);
    });

    it('should enforce unique email constraint', async () => {
      const userData = {
        email: 'duplicate@example.com',
        phoneNumber: '+254734567890',
        passwordHash: 'password123',
        role: 'customer' as const,
        profile: {
          firstName: 'User',
          lastName: 'One',
        },
      };

      await User.create(userData);

      const duplicateUser = {
        ...userData,
        phoneNumber: '+254745678901',
      };

      await expect(User.create(duplicateUser)).rejects.toThrow();
    });

    it('should enforce unique phoneNumber constraint', async () => {
      const userData = {
        email: 'user1@example.com',
        phoneNumber: '+254756789012',
        passwordHash: 'password123',
        role: 'customer' as const,
        profile: {
          firstName: 'User',
          lastName: 'One',
        },
      };

      await User.create(userData);

      const duplicateUser = {
        ...userData,
        email: 'user2@example.com',
      };

      await expect(User.create(duplicateUser)).rejects.toThrow();
    });

    it('should validate email format', async () => {
      const userData = {
        email: 'invalid-email',
        phoneNumber: '+254767890123',
        passwordHash: 'password123',
        role: 'customer' as const,
        profile: {
          firstName: 'Test',
          lastName: 'User',
        },
      };

      await expect(User.create(userData)).rejects.toThrow();
    });

    it('should validate phone number format', async () => {
      const userData = {
        email: 'valid@example.com',
        phoneNumber: '0712345678', // Invalid format, should be +254XXXXXXXXX
        passwordHash: 'password123',
        role: 'customer' as const,
        profile: {
          firstName: 'Test',
          lastName: 'User',
        },
      };

      await expect(User.create(userData)).rejects.toThrow();
    });

    it('should validate role enum values', async () => {
      const userData = {
        email: 'role@example.com',
        phoneNumber: '+254778901234',
        passwordHash: 'password123',
        role: 'invalid_role' as any,
        profile: {
          firstName: 'Test',
          lastName: 'User',
        },
      };

      await expect(User.create(userData)).rejects.toThrow();
    });

    it('should accept all valid role values', async () => {
      const roles = ['business_owner', 'customer', 'agent', 'admin'] as const;

      for (let i = 0; i < roles.length; i++) {
        const userData = {
          email: `user${i}@example.com`,
          phoneNumber: `+25478901234${i}`,
          passwordHash: 'password123',
          role: roles[i],
          profile: {
            firstName: 'Test',
            lastName: 'User',
          },
        };

        const user = await User.create(userData);
        expect(user.role).toBe(roles[i]);
      }
    });

    it('should store optional businessName for business owners', async () => {
      const userData = {
        email: 'business@example.com',
        phoneNumber: '+254790123456',
        passwordHash: 'password123',
        role: 'business_owner' as const,
        profile: {
          firstName: 'Business',
          lastName: 'Owner',
          businessName: 'My Shop',
        },
      };

      const user = await User.create(userData);
      expect(user.profile.businessName).toBe('My Shop');
    });

    it('should store optional address', async () => {
      const userData = {
        email: 'address@example.com',
        phoneNumber: '+254701234567',
        passwordHash: 'password123',
        role: 'customer' as const,
        profile: {
          firstName: 'Test',
          lastName: 'User',
          address: '123 Main St, Nairobi',
        },
      };

      const user = await User.create(userData);
      expect(user.profile.address).toBe('123 Main St, Nairobi');
    });
  });

  describe('Indexes', () => {
    it('should have compound index on role and isActive', async () => {
      const indexes = User.schema.indexes();
      const compoundIndex = indexes.find(
        (idx) => idx[0].role === 1 && idx[0].isActive === 1
      );
      expect(compoundIndex).toBeDefined();
    });
  });

  describe('comparePassword', () => {
    it('should return true for correct password', async () => {
      const plainPassword = 'correctPassword123';
      const user = await User.create({
        email: 'compare@example.com',
        phoneNumber: '+254711111111',
        passwordHash: plainPassword,
        role: 'customer' as const,
        profile: { firstName: 'Test', lastName: 'User' },
      });

      const result = await user.comparePassword(plainPassword);
      expect(result).toBe(true);
    });

    it('should return false for incorrect password', async () => {
      const user = await User.create({
        email: 'compare2@example.com',
        phoneNumber: '+254722222222',
        passwordHash: 'correctPassword123',
        role: 'customer' as const,
        profile: { firstName: 'Test', lastName: 'User' },
      });

      const result = await user.comparePassword('wrongPassword');
      expect(result).toBe(false);
    });
  });
});
