/**
 * Test data factories for users, packages, and payments.
 * Used by both integration tests and property-based tests.
 */
import * as fc from 'fast-check';

// ─── User Factories ───────────────────────────────────────────────────────────

export const userRoles = ['business_owner', 'customer', 'agent', 'admin'] as const;
export type UserRole = (typeof userRoles)[number];

export function makeUserData(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    name: 'Test User',
    email: `test_${Date.now()}@example.com`,
    phoneNumber: '+254700000001',
    password: 'Password123!',
    role: 'business_owner' as UserRole,
    ...overrides,
  };
}

// Arbitrary generators for property-based tests
export const arbEmail = fc
  .tuple(fc.string({ minLength: 3, maxLength: 10 }), fc.string({ minLength: 2, maxLength: 6 }))
  .map(([local, domain]) => `${local.replace(/[^a-z0-9]/gi, 'x')}@${domain.replace(/[^a-z]/gi, 'x')}.com`);

export const arbKenyanPhone = fc
  .integer({ min: 700000000, max: 799999999 })
  .map((n) => `+254${n}`);

export const arbPassword = fc
  .string({ minLength: 8, maxLength: 20 })
  .map((s) => `Aa1!${s}`); // ensure complexity

export const arbUserRole = fc.constantFrom(...userRoles);

// ─── Package Factories ────────────────────────────────────────────────────────

export const packageStatuses = [
  'created', 'picked_up', 'in_transit', 'arrived_at_destination_agent',
  'out_for_delivery', 'delivered', 'failed_delivery', 'returned',
] as const;
export type PackageStatus = (typeof packageStatuses)[number];

export const deliveryMethods = ['agent_pickup', 'doorstep_delivery'] as const;

export function makePackageData(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    customerName: 'Jane Doe',
    customerPhone: '+254711000001',
    customerEmail: 'jane@example.com',
    deliveryMethod: 'agent_pickup' as const,
    itemDescription: 'Electronics',
    itemPrice: 1500,
    deliveryFee: 200,
    ...overrides,
  };
}

export const arbPackageStatus = fc.constantFrom(...packageStatuses);
export const arbDeliveryMethod = fc.constantFrom(...deliveryMethods);

// ─── Payment Factories ────────────────────────────────────────────────────────

export const paymentStatuses = ['pending', 'completed', 'failed', 'refunded'] as const;
export const paymentTypes = ['delivery_fee', 'item_price', 'shelf_rental'] as const;

export function makePaymentData(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    amount: 500,
    currency: 'KES',
    paymentType: 'delivery_fee' as const,
    phoneNumber: '+254700000001',
    ...overrides,
  };
}

export const arbPaymentStatus = fc.constantFrom(...paymentStatuses);
export const arbPaymentType = fc.constantFrom(...paymentTypes);
export const arbPositiveAmount = fc.integer({ min: 1, max: 100000 });
