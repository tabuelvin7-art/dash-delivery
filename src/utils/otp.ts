/**
 * OTP generation and in-memory storage with TTL.
 * Each entry stores the OTP code and its expiry timestamp.
 */

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes

interface OtpEntry {
  code: string;
  expiresAt: number;
}

// Map key: phoneNumber → OTP entry
const otpStore = new Map<string, OtpEntry>();

/**
 * Generate a 6-digit OTP, store it with a 10-minute TTL, and return the code.
 */
export function generateOtp(phoneNumber: string): string {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore.set(phoneNumber, {
    code,
    expiresAt: Date.now() + OTP_TTL_MS,
  });
  return code;
}

/**
 * Verify an OTP for a given phone number.
 * Returns true if the code matches and has not expired; false otherwise.
 * Deletes the entry on successful verification.
 */
export function verifyOtp(phoneNumber: string, code: string): boolean {
  const entry = otpStore.get(phoneNumber);
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    otpStore.delete(phoneNumber);
    return false;
  }
  if (entry.code !== code) return false;
  otpStore.delete(phoneNumber);
  return true;
}

/**
 * Check whether a valid (non-expired) OTP exists for a phone number.
 */
export function hasValidOtp(phoneNumber: string): boolean {
  const entry = otpStore.get(phoneNumber);
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    otpStore.delete(phoneNumber);
    return false;
  }
  return true;
}

/**
 * Explicitly remove any stored OTP for a phone number.
 */
export function clearOtp(phoneNumber: string): void {
  otpStore.delete(phoneNumber);
}
