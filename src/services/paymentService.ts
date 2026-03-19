import { Types } from 'mongoose';
import { Payment, IPayment } from '../models/Payment';
import { Package } from '../models/Package';
import { ShelfRental } from '../models/ShelfRental';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PaymentType = 'delivery_fee' | 'item_price' | 'shelf_rental';
export type UserRole = 'business_owner' | 'customer' | 'agent' | 'admin';

export interface PaginatedResult<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_LIMIT = 50;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeError(message: string, code: string): Error {
  return Object.assign(new Error(message), { code });
}

// ---------------------------------------------------------------------------
// Payment creation
// ---------------------------------------------------------------------------

export async function createPayment(
  packageId: string,
  paymentType: PaymentType,
  amount: number,
  payerId: string,
  payeeId: string
): Promise<IPayment> {
  if (amount < 0) {
    throw makeError('Amount cannot be negative', 'VALIDATION_ERROR');
  }

  return Payment.create({
    packageId: new Types.ObjectId(packageId),
    paymentType,
    amount,
    payerId: new Types.ObjectId(payerId),
    payeeId: new Types.ObjectId(payeeId),
    status: 'completed',
    initiatedAt: new Date(),
    completedAt: new Date(),
    metadata: {},
  });
}

export async function getPaymentByPackageId(packageId: string): Promise<IPayment | null> {
  // packageId here is the human-readable string (e.g. PKG-20260318-001)
  // Payments store the MongoDB _id of the package, so resolve it first
  const pkg = await Package.findOne({ packageId }).select('_id');
  if (!pkg) return null;
  return Payment.findOne({ packageId: pkg._id }).sort({ createdAt: -1 });
}

export async function getPaymentHistory(
  userId: string,
  role: UserRole,
  page = 1
): Promise<PaginatedResult<IPayment>> {
  // business_owner can be payee (shelf rental income) or payer (delivery fees they front)
  // customer is always payer; agent is always payee for shelf rentals
  const id = new Types.ObjectId(userId);
  const query =
    role === 'business_owner'
      ? { $or: [{ payerId: id }, { payeeId: id }] }
      : role === 'customer'
      ? { payerId: id }
      : { payeeId: id }; // agent, admin

  const skip = (page - 1) * PAGE_LIMIT;
  const [data, total] = await Promise.all([
    Payment.find(query).sort({ createdAt: -1 }).skip(skip).limit(PAGE_LIMIT),
    Payment.countDocuments(query),
  ]);

  return { data, page, limit: PAGE_LIMIT, total, totalPages: Math.ceil(total / PAGE_LIMIT) };
}

// ---------------------------------------------------------------------------
// Payment prompt workflows (no real payment gateway — records directly)
// ---------------------------------------------------------------------------

export async function sendDeliveryFeePrompt(packageId: string): Promise<IPayment | null> {
  const pkg = await Package.findOne({ packageId });
  if (!pkg) throw makeError(`Package ${packageId} not found`, 'NOT_FOUND');

  // Avoid duplicate — only create if none exists yet
  const existing = await Payment.findOne({ packageId: pkg._id, paymentType: 'delivery_fee' });
  if (existing) return existing;

  // Delivery fee: business owner pays the destination agent
  // Resolve agent's userId from the Agent record
  const { Agent } = await import('../models/Agent');
  const agentId = pkg.destinationAgentId;
  if (!agentId) return null; // no agent assigned yet

  const agent = await Agent.findById(agentId).select('userId');
  if (!agent) return null;

  return createPayment(
    String(pkg._id),
    'delivery_fee',
    pkg.deliveryFee,
    String(pkg.businessOwnerId), // business owner pays
    String(agent.userId)          // agent receives
  );
}

export async function sendItemPricePrompt(packageId: string): Promise<IPayment | null> {
  const pkg = await Package.findOne({ packageId });
  if (!pkg) throw makeError(`Package ${packageId} not found`, 'NOT_FOUND');

  // Avoid duplicate — only create if none exists yet
  const existing = await Payment.findOne({ packageId: pkg._id, paymentType: 'item_price' });
  if (existing) return existing;

  // Item price: customer pays the business owner
  return createPayment(
    String(pkg._id),
    'item_price',
    pkg.itemPrice,
    String(pkg.customerId),      // customer pays
    String(pkg.businessOwnerId)  // business owner receives
  );
}

export async function sendShelfRentalPrompt(rentalId: string): Promise<IPayment> {
  const rental = await ShelfRental.findOne({ rentalId });
  if (!rental) throw makeError(`Shelf rental ${rentalId} not found`, 'NOT_FOUND');

  // Resolve agent's User ID — payeeId must reference User, not Agent
  const { Agent } = await import('../models/Agent');
  const agent = await Agent.findById(rental.agentId).select('userId');
  if (!agent) throw makeError('Agent not found', 'NOT_FOUND');

  const payment = await Payment.create({
    packageId: null,  // shelf rental payments are not tied to a package
    paymentType: 'shelf_rental',
    amount: rental.pricing.totalAmount,
    payerId: rental.businessOwnerId,
    payeeId: agent.userId,
    status: 'completed',
    initiatedAt: new Date(),
    completedAt: new Date(),
    metadata: {},
  });

  rental.paymentId = payment._id as Types.ObjectId;
  await rental.save();

  return payment;
}

// ---------------------------------------------------------------------------
// Retry (simplified — just resets to completed since no gateway)
// ---------------------------------------------------------------------------

export async function retryPayment(transactionId: string, userId: string): Promise<IPayment> {
  const payment = await Payment.findOne({ transactionId });
  if (!payment) throw makeError(`Payment ${transactionId} not found`, 'NOT_FOUND');

  if (!payment.payerId.equals(new Types.ObjectId(userId))) {
    throw makeError('Access denied', 'FORBIDDEN');
  }

  if (payment.status !== 'failed') {
    throw makeError(`Cannot retry payment with status '${payment.status}'`, 'CONFLICT');
  }

  payment.status = 'completed';
  payment.completedAt = new Date();
  payment.failureReason = undefined;
  await payment.save();

  return payment;
}
