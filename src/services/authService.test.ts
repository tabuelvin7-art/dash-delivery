import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import jwt from 'jsonwebtoken';
import {
  register,
  login,
  logout,
  refreshToken,
  isTokenBlacklisted,
  sendOtp,
  verifyPhone,
} from './authService';
import { User } from '../models/User';

// Provide a JWT secret for tests
process.env['JWT_SECRET'] = 'test-secret-key-for-jest';

describe('AuthService', () => {
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  afterEach(async () => {
    await User.deleteMany({});
  });

  // -------------------------------------------------------------------------
  // register()
  // -------------------------------------------------------------------------

  describe('register()', () => {
    const validInput = {
      email: 'alice@example.com',
      phoneNumber: '+254712345678',
      password: 'SecurePass1!',
      role: 'customer' as const,
      profile: { firstName: 'Alice', lastName: 'Wanjiru' },
    };

    it('creates a user and returns an OTP', async () => {
      const { user, otp } = await register(validInput);
      expect(user.email).toBe('alice@example.com');
      expect(otp).toMatch(/^\d{6}$/);
    });

    it('hashes the password (stored hash differs from plaintext)', async () => {
      const { user } = await register(validInput);
      expect(user.passwordHash).not.toBe(validInput.password);
    });

    it('rejects an invalid email', async () => {
      await expect(
        register({ ...validInput, email: 'not-an-email' })
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('rejects a phone number not in +254XXXXXXXXX format', async () => {
      await expect(
        register({ ...validInput, email: 'b@example.com', phoneNumber: '0712345678' })
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('rejects duplicate email', async () => {
      await register(validInput);
      await expect(
        register({ ...validInput, phoneNumber: '+254799999999' })
      ).rejects.toMatchObject({ code: 'CONFLICT' });
    });

    it('rejects duplicate phone number', async () => {
      await register(validInput);
      await expect(
        register({ ...validInput, email: 'other@example.com' })
      ).rejects.toMatchObject({ code: 'CONFLICT' });
    });

    it('supports business_owner role', async () => {
      const { user } = await register({
        ...validInput,
        email: 'biz@example.com',
        phoneNumber: '+254711111111',
        role: 'business_owner',
        profile: { ...validInput.profile, businessName: 'My Shop' },
      });
      expect(user.role).toBe('business_owner');
    });
  });

  // -------------------------------------------------------------------------
  // login()
  // -------------------------------------------------------------------------

  describe('login()', () => {
    beforeEach(async () => {
      await register({
        email: 'login@example.com',
        phoneNumber: '+254712345678',
        password: 'MyPassword1!',
        role: 'customer',
        profile: { firstName: 'Bob', lastName: 'Kamau' },
      });
    });

    it('returns user and a valid JWT on correct credentials', async () => {
      const { user, tokens } = await login({
        email: 'login@example.com',
        password: 'MyPassword1!',
      });
      expect(user.email).toBe('login@example.com');
      expect(tokens.accessToken).toBeTruthy();
      expect(tokens.expiresIn).toBe(86400); // 24 h
    });

    it('JWT contains expected claims', async () => {
      const { tokens } = await login({
        email: 'login@example.com',
        password: 'MyPassword1!',
      });
      const decoded = jwt.verify(tokens.accessToken, process.env['JWT_SECRET']!) as jwt.JwtPayload;
      expect(decoded['email']).toBe('login@example.com');
      expect(decoded['role']).toBe('customer');
      expect(decoded['exp']).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });

    it('rejects wrong password', async () => {
      await expect(
        login({ email: 'login@example.com', password: 'WrongPass' })
      ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    });

    it('rejects unknown email', async () => {
      await expect(
        login({ email: 'nobody@example.com', password: 'anything' })
      ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    });
  });

  // -------------------------------------------------------------------------
  // logout() / isTokenBlacklisted()
  // -------------------------------------------------------------------------

  describe('logout()', () => {
    it('blacklists the token', async () => {
      await register({
        email: 'logout@example.com',
        phoneNumber: '+254712345678',
        password: 'Pass1!',
        role: 'customer',
        profile: { firstName: 'C', lastName: 'D' },
      });
      const { tokens } = await login({ email: 'logout@example.com', password: 'Pass1!' });
      expect(isTokenBlacklisted(tokens.accessToken)).toBe(false);
      logout(tokens.accessToken);
      expect(isTokenBlacklisted(tokens.accessToken)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // refreshToken()
  // -------------------------------------------------------------------------

  describe('refreshToken()', () => {
    it('issues a new token and blacklists the old one', async () => {
      await register({
        email: 'refresh@example.com',
        phoneNumber: '+254712345678',
        password: 'Pass1!',
        role: 'customer',
        profile: { firstName: 'E', lastName: 'F' },
      });
      const { tokens } = await login({ email: 'refresh@example.com', password: 'Pass1!' });
      const newTokens = await refreshToken(tokens.accessToken);
      // New token must be a valid JWT
      expect(newTokens.accessToken).toBeTruthy();
      // Old token must be blacklisted after refresh
      expect(isTokenBlacklisted(tokens.accessToken)).toBe(true);
    });

    it('rejects a blacklisted token', async () => {
      await register({
        email: 'refresh2@example.com',
        phoneNumber: '+254712345678',
        password: 'Pass1!',
        role: 'customer',
        profile: { firstName: 'G', lastName: 'H' },
      });
      const { tokens } = await login({ email: 'refresh2@example.com', password: 'Pass1!' });
      logout(tokens.accessToken);
      await expect(refreshToken(tokens.accessToken)).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
      });
    });
  });

  // -------------------------------------------------------------------------
  // sendOtp() / verifyPhone()
  // -------------------------------------------------------------------------

  describe('sendOtp()', () => {
    it('returns a 6-digit OTP for a valid phone number', () => {
      const otp = sendOtp('+254712345678');
      expect(otp).toMatch(/^\d{6}$/);
    });

    it('rejects an invalid phone number', () => {
      expect(() => sendOtp('0712345678')).toThrow();
    });
  });

  describe('verifyPhone()', () => {
    it('marks the user as phone-verified on correct OTP', async () => {
      const { otp } = await register({
        email: 'verify@example.com',
        phoneNumber: '+254712345678',
        password: 'Pass1!',
        role: 'customer',
        profile: { firstName: 'I', lastName: 'J' },
      });
      const updated = await verifyPhone('+254712345678', otp);
      expect(updated.isPhoneVerified).toBe(true);
    });

    it('rejects an incorrect OTP', async () => {
      await register({
        email: 'verify2@example.com',
        phoneNumber: '+254712345678',
        password: 'Pass1!',
        role: 'customer',
        profile: { firstName: 'K', lastName: 'L' },
      });
      await expect(verifyPhone('+254712345678', '000000')).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
    });
  });
});
