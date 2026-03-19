import { generateOtp, verifyOtp, hasValidOtp, clearOtp } from './otp';

describe('OTP utility', () => {
  const phone = '+254712345678';

  afterEach(() => {
    clearOtp(phone);
  });

  it('generates a 6-digit numeric code', () => {
    const code = generateOtp(phone);
    expect(code).toMatch(/^\d{6}$/);
  });

  it('verifies a correct OTP and removes it afterwards', () => {
    const code = generateOtp(phone);
    expect(verifyOtp(phone, code)).toBe(true);
    // Second call should fail – entry was deleted
    expect(verifyOtp(phone, code)).toBe(false);
  });

  it('rejects an incorrect OTP', () => {
    generateOtp(phone);
    expect(verifyOtp(phone, '000000')).toBe(false);
  });

  it('returns false for unknown phone number', () => {
    expect(verifyOtp('+254799999999', '123456')).toBe(false);
  });

  it('hasValidOtp returns true when OTP exists', () => {
    generateOtp(phone);
    expect(hasValidOtp(phone)).toBe(true);
  });

  it('hasValidOtp returns false when no OTP exists', () => {
    expect(hasValidOtp(phone)).toBe(false);
  });

  it('clearOtp removes the entry', () => {
    generateOtp(phone);
    clearOtp(phone);
    expect(hasValidOtp(phone)).toBe(false);
  });
});
