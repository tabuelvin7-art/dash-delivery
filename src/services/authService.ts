import jwt from 'jsonwebtoken';
import { User, IUser } from '../models/User';
import { generateOtp, verifyOtp } from '../utils/otp';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RegisterInput {
  email: string;
  phoneNumber: string;
  password: string;
  role: 'business_owner' | 'customer';
  profile: {
    firstName: string;
    lastName: string;
    businessName?: string;
    address?: string;
  };
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  expiresIn: number; // seconds
}

export interface AuthResult {
  user: IUser;
  tokens: AuthTokens;
}

// ---------------------------------------------------------------------------
// Token blacklist (in-memory; replace with Redis in production)
// ---------------------------------------------------------------------------

const tokenBlacklist = new Set<string>();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+254\d{9}$/;

function getJwtSecret(): string {
  const secret = process.env['JWT_SECRET'];
  if (!secret) throw new Error('JWT_SECRET environment variable is not set');
  return secret;
}

function signToken(payload: object): AuthTokens {
  const expiresIn = 24 * 60 * 60; // 24 hours in seconds
  const accessToken = jwt.sign(payload, getJwtSecret(), { expiresIn });
  return { accessToken, expiresIn };
}

// ---------------------------------------------------------------------------
// Task 3.1 – User registration
// ---------------------------------------------------------------------------

/**
 * Register a new user.
 * - Validates email format and Kenyan phone number format (+254XXXXXXXXX)
 * - Checks for duplicate email / phone
 * - Hashes password (delegated to User pre-save hook)
 * - Generates a phone-verification OTP
 * Returns the created user and the OTP (caller is responsible for sending it).
 */
export async function register(
  input: RegisterInput
): Promise<{ user: IUser; otp: string }> {
  const { email, phoneNumber, password, role, profile } = input;

  // Validate email format
  if (!EMAIL_REGEX.test(email)) {
    throw Object.assign(new Error('Invalid email format'), { code: 'VALIDATION_ERROR' });
  }

  // Validate phone number format
  if (!PHONE_REGEX.test(phoneNumber)) {
    throw Object.assign(
      new Error('Phone number must be in format +254XXXXXXXXX'),
      { code: 'VALIDATION_ERROR' }
    );
  }

  // Check for duplicate email
  const existingEmail = await User.findOne({ email: email.toLowerCase() });
  if (existingEmail) {
    throw Object.assign(new Error('Email is already registered'), { code: 'CONFLICT' });
  }

  // Check for duplicate phone number
  const existingPhone = await User.findOne({ phoneNumber });
  if (existingPhone) {
    throw Object.assign(new Error('Phone number is already registered'), { code: 'CONFLICT' });
  }

  // Create user – password hashing is handled by the pre-save hook
  const user = await User.create({
    email,
    phoneNumber,
    passwordHash: password, // pre-save hook will hash this
    role,
    profile,
  });

  // Generate OTP for phone verification
  const otp = generateOtp(phoneNumber);

  return { user, otp };
}

// ---------------------------------------------------------------------------
// Task 3.3 – Authentication service
// ---------------------------------------------------------------------------

/**
 * Authenticate a user with email and password.
 * Returns the user and a signed JWT on success.
 */
export async function login(input: LoginInput): Promise<AuthResult> {
  const { email, password } = input;

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    throw Object.assign(new Error('Invalid email or password'), { code: 'UNAUTHORIZED' });
  }

  if (!user.isActive) {
    throw Object.assign(new Error('Account is deactivated'), { code: 'UNAUTHORIZED' });
  }

  const passwordValid = await user.comparePassword(password);
  if (!passwordValid) {
    throw Object.assign(new Error('Invalid email or password'), { code: 'UNAUTHORIZED' });
  }

  const tokens = signToken({
    sub: (user._id as unknown as string).toString(),
    email: user.email,
    role: user.role,
    isPhoneVerified: user.isPhoneVerified,
  });

  return { user, tokens };
}

/**
 * Refresh an access token.
 * Verifies the existing token (ignoring expiry) and issues a new one.
 */
export async function refreshToken(token: string): Promise<AuthTokens> {
  if (tokenBlacklist.has(token)) {
    throw Object.assign(new Error('Token has been invalidated'), { code: 'UNAUTHORIZED' });
  }

  let decoded: jwt.JwtPayload;
  try {
    // Allow expired tokens to be refreshed (within reason – add a refresh window if needed)
    decoded = jwt.verify(token, getJwtSecret(), { ignoreExpiration: true }) as jwt.JwtPayload;
  } catch {
    throw Object.assign(new Error('Invalid token'), { code: 'UNAUTHORIZED' });
  }

  const user = await User.findById(decoded['sub']);
  if (!user || !user.isActive) {
    throw Object.assign(new Error('User not found or deactivated'), { code: 'UNAUTHORIZED' });
  }

  // Blacklist the old token
  tokenBlacklist.add(token);

  return signToken({
    sub: (user._id as unknown as string).toString(),
    email: user.email,
    role: user.role,
    isPhoneVerified: user.isPhoneVerified,
  });
}

/**
 * Logout by adding the token to the blacklist.
 */
export function logout(token: string): void {
  tokenBlacklist.add(token);
}

/**
 * Check whether a token has been blacklisted.
 */
export function isTokenBlacklisted(token: string): boolean {
  return tokenBlacklist.has(token);
}

// ---------------------------------------------------------------------------
// Task 3.4 – Phone verification service
// ---------------------------------------------------------------------------

/**
 * Generate and return a new OTP for the given phone number.
 * The caller is responsible for delivering it via SMS.
 */
export function sendOtp(phoneNumber: string): string {
  if (!PHONE_REGEX.test(phoneNumber)) {
    throw Object.assign(
      new Error('Phone number must be in format +254XXXXXXXXX'),
      { code: 'VALIDATION_ERROR' }
    );
  }
  return generateOtp(phoneNumber);
}

/**
 * Verify the OTP for a phone number and mark the user's phone as verified.
 * Returns the updated user document.
 */
export async function verifyPhone(
  phoneNumber: string,
  code: string
): Promise<IUser> {
  const valid = verifyOtp(phoneNumber, code);
  if (!valid) {
    throw Object.assign(new Error('Invalid or expired OTP'), { code: 'VALIDATION_ERROR' });
  }

  const user = await User.findOneAndUpdate(
    { phoneNumber },
    { isPhoneVerified: true },
    { new: true }
  );

  if (!user) {
    throw Object.assign(new Error('User not found'), { code: 'NOT_FOUND' });
  }

  return user;
}
