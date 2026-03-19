import { Types } from 'mongoose';
import { ShelfRental, IShelfRental, IInventoryItem } from '../models/ShelfRental';
import { Agent } from '../models/Agent';
import { sendShelfRentalPrompt } from './paymentService';
import { notifyShelfRentalExpiring } from './notificationService';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
const EXPIRY_WARNING_DAYS = 7;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeError(message: string, code: string): Error {
  return Object.assign(new Error(message), { code });
}

/**
 * Calculate total rental amount based on duration and monthly rate.
 * Partial months are rounded up to the nearest full month.
 */
function calculateTotalAmount(startDate: Date, endDate: Date, monthlyRate: number): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  const days = Math.ceil((endDate.getTime() - startDate.getTime()) / msPerDay);
  const months = Math.ceil(days / 30);
  return months * monthlyRate;
}

// ---------------------------------------------------------------------------
// Task 7.3 – Shelf rental service
// ---------------------------------------------------------------------------

/**
 * Create a new shelf rental agreement.
 *
 * - Calculates totalAmount from duration and monthlyRate
 * - Creates rental with status='active'
 * - Decrements agent's availableShelves
 * - Triggers sendShelfRentalPrompt payment
 *
 * Requirements: 16.1, 16.2, 16.3
 */
export async function createRental(
  businessOwnerId: string,
  agentId: string,
  shelfNumber: string,
  startDate: Date,
  endDate: Date,
  monthlyRate: number
): Promise<IShelfRental> {
  if (endDate <= startDate) {
    throw makeError('endDate must be after startDate', 'VALIDATION_ERROR');
  }

  if (monthlyRate < 0) {
    throw makeError('monthlyRate cannot be negative', 'VALIDATION_ERROR');
  }

  const agent = await Agent.findOne(
    Types.ObjectId.isValid(agentId) ? { _id: new Types.ObjectId(agentId) } : { agentId }
  );
  if (!agent) {
    throw makeError(`Agent ${agentId} not found`, 'NOT_FOUND');
  }

  if (agent.capacity.availableShelves <= 0) {
    throw makeError('No available shelves at this agent location', 'CONFLICT');
  }

  const totalAmount = calculateTotalAmount(startDate, endDate, monthlyRate);

  const rental = await ShelfRental.create({
    businessOwnerId: new Types.ObjectId(businessOwnerId),
    agentId: agent._id,
    shelfNumber,
    rentalPeriod: { startDate, endDate },
    pricing: { monthlyRate, totalAmount },
    paymentStatus: 'pending',
    inventory: [],
    status: 'active',
  });

  // Decrement available shelves
  agent.capacity.availableShelves -= 1;
  await agent.save();

  // Trigger payment prompt (fire-and-forget; errors are logged inside the service)
  sendShelfRentalPrompt(rental.rentalId).catch(() => {
    // Payment prompt failure is non-fatal for rental creation
  });

  return rental;
}

/**
 * Get paginated rentals for a business owner.
 *
 * Requirements: 16.1
 */
export async function getRentalsByBusinessOwner(
  businessOwnerId: string,
  page = 1
): Promise<PaginatedResult<IShelfRental>> {
  const query = { businessOwnerId: new Types.ObjectId(businessOwnerId) };
  const skip = (page - 1) * PAGE_LIMIT;

  const [data, total] = await Promise.all([
    ShelfRental.find(query).sort({ createdAt: -1 }).skip(skip).limit(PAGE_LIMIT),
    ShelfRental.countDocuments(query),
  ]);

  return { data, page, limit: PAGE_LIMIT, total, totalPages: Math.ceil(total / PAGE_LIMIT) };
}

/**
 * Get paginated rentals for an agent location.
 *
 * Requirements: 16.1
 */
export async function getRentalsByAgent(
  agentId: string,
  page = 1
): Promise<PaginatedResult<IShelfRental>> {
  const agent = await Agent.findOne({ agentId });
  if (!agent) {
    throw makeError(`Agent ${agentId} not found`, 'NOT_FOUND');
  }

  const query = { agentId: agent._id };
  const skip = (page - 1) * PAGE_LIMIT;

  const [data, total] = await Promise.all([
    ShelfRental.find(query).sort({ createdAt: -1 }).skip(skip).limit(PAGE_LIMIT),
    ShelfRental.countDocuments(query),
  ]);

  return { data, page, limit: PAGE_LIMIT, total, totalPages: Math.ceil(total / PAGE_LIMIT) };
}

/**
 * Get a single rental by rentalId.
 *
 * Requirements: 16.1
 */
export async function getRentalById(rentalId: string): Promise<IShelfRental> {
  const rental = await ShelfRental.findOne({ rentalId });
  if (!rental) {
    throw makeError(`Rental ${rentalId} not found`, 'NOT_FOUND');
  }
  return rental;
}

// ---------------------------------------------------------------------------
// Task 7.5 – Shelf inventory management
// ---------------------------------------------------------------------------

/**
 * Add an item to a shelf rental's inventory.
 * Validates that the requesting user is the business owner of the rental.
 *
 * Requirements: 16.5
 */
export async function addInventoryItem(
  rentalId: string,
  businessOwnerId: string,
  itemName: string,
  quantity: number
): Promise<IShelfRental> {
  const rental = await ShelfRental.findOne({ rentalId });
  if (!rental) {
    throw makeError(`Rental ${rentalId} not found`, 'NOT_FOUND');
  }

  if (!rental.businessOwnerId.equals(new Types.ObjectId(businessOwnerId))) {
    throw makeError('Access denied: you do not own this rental', 'FORBIDDEN');
  }

  if (rental.status !== 'active') {
    throw makeError('Cannot modify inventory of a non-active rental', 'CONFLICT');
  }

  if (quantity < 0) {
    throw makeError('Quantity cannot be negative', 'VALIDATION_ERROR');
  }

  const existing = rental.inventory.find(
    (item: IInventoryItem) => item.itemName.toLowerCase() === itemName.toLowerCase()
  );

  if (existing) {
    existing.quantity += quantity;
  } else {
    rental.inventory.push({ itemName, quantity, addedAt: new Date() });
  }

  await rental.save();
  return rental;
}

/**
 * Remove an item from a shelf rental's inventory.
 * Validates that the requesting user is the business owner of the rental.
 *
 * Requirements: 16.5
 */
export async function removeInventoryItem(
  rentalId: string,
  businessOwnerId: string,
  itemName: string
): Promise<IShelfRental> {
  const rental = await ShelfRental.findOne({ rentalId });
  if (!rental) {
    throw makeError(`Rental ${rentalId} not found`, 'NOT_FOUND');
  }

  if (!rental.businessOwnerId.equals(new Types.ObjectId(businessOwnerId))) {
    throw makeError('Access denied: you do not own this rental', 'FORBIDDEN');
  }

  if (rental.status !== 'active') {
    throw makeError('Cannot modify inventory of a non-active rental', 'CONFLICT');
  }

  const index = rental.inventory.findIndex(
    (item: IInventoryItem) => item.itemName.toLowerCase() === itemName.toLowerCase()
  );

  if (index === -1) {
    throw makeError(`Item '${itemName}' not found in inventory`, 'NOT_FOUND');
  }

  rental.inventory.splice(index, 1);
  await rental.save();
  return rental;
}

/**
 * Get the inventory list for a rental.
 * Validates that the requesting user is the business owner of the rental.
 *
 * Requirements: 16.5
 */
export async function getInventory(
  rentalId: string,
  businessOwnerId: string
): Promise<IInventoryItem[]> {
  const rental = await ShelfRental.findOne({ rentalId });
  if (!rental) {
    throw makeError(`Rental ${rentalId} not found`, 'NOT_FOUND');
  }

  if (!rental.businessOwnerId.equals(new Types.ObjectId(businessOwnerId))) {
    throw makeError('Access denied: you do not own this rental', 'FORBIDDEN');
  }

  return rental.inventory;
}

// ---------------------------------------------------------------------------
// Task 7.6 – Rental expiration notifications and expiry
// ---------------------------------------------------------------------------

/**
 * Find rentals expiring within the next 7 days and send expiration notifications.
 *
 * Requirements: 16.6
 */
export async function checkExpiringRentals(): Promise<void> {
  const now = new Date();
  const warningDate = new Date(now.getTime() + EXPIRY_WARNING_DAYS * 24 * 60 * 60 * 1000);

  const expiringRentals = await ShelfRental.find({
    status: 'active',
    'rentalPeriod.endDate': { $gte: now, $lte: warningDate },
  });

  await Promise.all(
    expiringRentals.map((rental) =>
      notifyShelfRentalExpiring(rental.rentalId).catch(() => {
        // Notification failure is non-fatal; continue processing others
      })
    )
  );
}

/**
 * Find rentals past their endDate, set status='expired', and increment
 * the agent's availableShelves count.
 *
 * Requirements: 16.6
 */
export async function expireRentals(): Promise<void> {
  const now = new Date();

  const overdueRentals = await ShelfRental.find({
    status: 'active',
    'rentalPeriod.endDate': { $lt: now },
  });

  await Promise.all(
    overdueRentals.map(async (rental) => {
      rental.status = 'expired';
      await rental.save();

      // Increment agent's available shelves
      await Agent.findByIdAndUpdate(rental.agentId, {
        $inc: { 'capacity.availableShelves': 1 },
      });
    })
  );
}
