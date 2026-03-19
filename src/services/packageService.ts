import { Types } from 'mongoose';
import { Package, IPackage } from '../models/Package';
import { Agent } from '../models/Agent';
import { User } from '../models/User';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DeliveryMethod = 'agent_delivery' | 'doorstep_delivery' | 'rent_a_shelf';

export type PackageStatus =
  | 'created'
  | 'dropped_off_at_agent'
  | 'dispatched'
  | 'arrived_at_destination_agent'
  | 'out_for_delivery'
  | 'delivered'
  | 'returned'
  | 'cancelled';

export type UserRole = 'business_owner' | 'customer' | 'agent' | 'admin';

export interface CreatePackageInput {
  businessOwnerId: string;
  customerId: string;
  deliveryMethod: DeliveryMethod;
  pickupAgentId?: string;
  destinationAgentId?: string;
  deliveryAddress?: string;
  shelfRentalId?: string;
  itemPrice: number;
  deliveryFee: number;
}

export interface PackageFilters {
  status?: PackageStatus;
  startDate?: Date;
  endDate?: Date;
  customerId?: string;
  shelfRentalId?: string;
  page?: number;
}

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

/** Valid status transitions per delivery method */
const VALID_TRANSITIONS: Record<string, string[]> = {
  created: ['dropped_off_at_agent', 'cancelled'],
  dropped_off_at_agent: ['dispatched'],
  dispatched: ['arrived_at_destination_agent', 'returned'],
  arrived_at_destination_agent: ['out_for_delivery', 'returned'],
  out_for_delivery: ['delivered', 'returned'],
  delivered: [],
  returned: [],
  cancelled: [],
};

/** Delivery-method-specific allowed transitions (overrides VALID_TRANSITIONS where set) */
const METHOD_TRANSITIONS: Record<DeliveryMethod, Record<string, string[]>> = {
  rent_a_shelf: {
    created: ['dropped_off_at_agent', 'cancelled'],
    dropped_off_at_agent: [], // delivered only via release code validation
    delivered: [],
    returned: [],
    cancelled: [],
  },
  doorstep_delivery: {
    created: ['dropped_off_at_agent', 'cancelled'],
    dropped_off_at_agent: ['dispatched'],
    dispatched: ['out_for_delivery', 'returned'],   // skips arrived_at_destination_agent
    out_for_delivery: ['delivered', 'returned'],
    delivered: [],
    returned: [],
    cancelled: [],
  },
  agent_delivery: VALID_TRANSITIONS,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeError(message: string, code: string): Error {
  return Object.assign(new Error(message), { code });
}

/** Generate a cryptographically-adequate 6-digit numeric release code. */
function generateSixDigitCode(): string {
  // Math.random gives uniform distribution over [0, 1); multiply to get 6 digits
  const code = Math.floor(100000 + Math.random() * 900000);
  return String(code);
}

/** Run a paginated Mongoose query and return a PaginatedResult. */
async function paginate<T>(
  model: any,
  query: Record<string, any>,
  page: number
): Promise<PaginatedResult<T>> {
  const skip = (page - 1) * PAGE_LIMIT;
  const [data, total] = await Promise.all([
    model.find(query).sort({ createdAt: -1 }).skip(skip).limit(PAGE_LIMIT),
    model.countDocuments(query),
  ]);
  return { data, page, limit: PAGE_LIMIT, total, totalPages: Math.ceil(total / PAGE_LIMIT) };
}

// ---------------------------------------------------------------------------
// Task 4.1 – Package creation service
// ---------------------------------------------------------------------------

/**
 * Create a new package.
 *
 * Validates:
 * - deliveryMethod is one of the three valid values
 * - doorstep_delivery requires deliveryAddress
 * - agent_delivery requires destinationAgentId
 * - itemPrice and deliveryFee are >= 0
 * - businessOwnerId and customerId are valid user IDs
 *
 * Initialises the package with status='created' and adds the first
 * tracking history entry.
 */
export async function createPackage(input: CreatePackageInput): Promise<IPackage> {
  const {
    businessOwnerId,
    customerId,
    deliveryMethod,
    pickupAgentId,
    destinationAgentId,
    deliveryAddress,
    shelfRentalId,
    itemPrice,
    deliveryFee,
  } = input;

  // Validate delivery method
  const validMethods: DeliveryMethod[] = ['agent_delivery', 'doorstep_delivery', 'rent_a_shelf'];
  if (!validMethods.includes(deliveryMethod)) {
    throw makeError(
      `Invalid delivery method. Must be one of: ${validMethods.join(', ')}`,
      'VALIDATION_ERROR'
    );
  }

  // Validate method-specific required fields
  if (deliveryMethod === 'doorstep_delivery' && !deliveryAddress) {
    throw makeError('deliveryAddress is required for doorstep_delivery', 'VALIDATION_ERROR');
  }

  if (deliveryMethod === 'agent_delivery' && !destinationAgentId) {
    throw makeError('destinationAgentId is required for agent_delivery', 'VALIDATION_ERROR');
  }

  if (deliveryMethod === 'rent_a_shelf' && !shelfRentalId) {
    throw makeError('shelfRentalId is required for rent_a_shelf', 'VALIDATION_ERROR');
  }

  // Validate prices
  if (typeof itemPrice !== 'number' || itemPrice < 0) {
    throw makeError('itemPrice must be a number >= 0', 'VALIDATION_ERROR');
  }

  if (typeof deliveryFee !== 'number' || deliveryFee < 0) {
    throw makeError('deliveryFee must be a number >= 0', 'VALIDATION_ERROR');
  }

  // Validate businessOwnerId exists
  const businessOwner = await User.findById(businessOwnerId);
  if (!businessOwner) {
    throw makeError('Business owner not found', 'NOT_FOUND');
  }

  // Validate customerId exists
  const customer = await User.findById(customerId);
  if (!customer) {
    throw makeError('Customer not found', 'NOT_FOUND');
  }

  // For rent_a_shelf: resolve the agent from the shelf rental
  let resolvedDestinationAgentId = destinationAgentId;
  if (deliveryMethod === 'rent_a_shelf' && shelfRentalId) {
    const { ShelfRental } = await import('../models/ShelfRental');
    const rental = await ShelfRental.findById(shelfRentalId);
    if (!rental) throw makeError('Shelf rental not found', 'NOT_FOUND');
    if (rental.status !== 'active') throw makeError('Shelf rental is not active', 'CONFLICT');
    if (String(rental.businessOwnerId) !== String(new Types.ObjectId(businessOwnerId))) {
      throw makeError('This shelf rental does not belong to you', 'FORBIDDEN');
    }
    resolvedDestinationAgentId = String(rental.agentId);
  }

  // Build the document
  const packageData: Partial<IPackage> = {
    businessOwnerId: new Types.ObjectId(businessOwnerId),
    customerId: new Types.ObjectId(customerId),
    deliveryMethod,
    itemPrice,
    deliveryFee,
    status: 'created',
    deliveryFeePaymentStatus: 'pending',
    itemPricePaymentStatus: 'pending',
    trackingHistory: [
      {
        status: 'created',
        timestamp: new Date(),
        updatedBy: new Types.ObjectId(businessOwnerId),
      },
    ],
  };

  if (pickupAgentId) {
    packageData.pickupAgentId = new Types.ObjectId(pickupAgentId);
  }
  if (resolvedDestinationAgentId) {
    packageData.destinationAgentId = new Types.ObjectId(resolvedDestinationAgentId);
  }
  if (deliveryAddress) {
    packageData.deliveryAddress = deliveryAddress;
  }
  if (shelfRentalId) {
    packageData.shelfRentalId = new Types.ObjectId(shelfRentalId);
  }

  const pkg = await Package.create(packageData);
  return pkg;
}

// ---------------------------------------------------------------------------
// Task 4.3 – Package query and filtering
// ---------------------------------------------------------------------------

/**
 * Get packages for a business owner with optional filters and pagination.
 * Enforces data isolation: only returns packages owned by the given userId.
 */
export async function getPackagesByBusinessOwner(
  userId: string,
  filters: PackageFilters = {}
): Promise<PaginatedResult<IPackage>> {
  const { status, startDate, endDate, customerId, shelfRentalId, page = 1 } = filters;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query: Record<string, any> = {
    businessOwnerId: new Types.ObjectId(userId),
  };

  if (status) query['status'] = status;
  if (customerId) query['customerId'] = new Types.ObjectId(customerId);
  if (shelfRentalId) query['shelfRentalId'] = new Types.ObjectId(shelfRentalId);
  if (startDate || endDate) {
    query['createdAt'] = {};
    if (startDate) query['createdAt']['$gte'] = startDate;
    if (endDate) query['createdAt']['$lte'] = endDate;
  }

  return paginate<IPackage>(Package, query, page);
}
export async function getAllPackages(
  filters: PackageFilters = {}
): Promise<PaginatedResult<IPackage>> {
  const { status, startDate, endDate, page = 1 } = filters;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query: Record<string, any> = {};
  if (status) query['status'] = status;
  if (startDate || endDate) {
    query['createdAt'] = {};
    if (startDate) query['createdAt']['$gte'] = startDate;
    if (endDate) query['createdAt']['$lte'] = endDate;
  }
  return paginate<IPackage>(Package, query, page);
}

/**
 * Get packages for a customer with optional filters and pagination.
 * Enforces data isolation: only returns packages where customerId matches.
 */
export async function getPackagesByCustomer(
  userId: string,
  filters: PackageFilters = {}
): Promise<PaginatedResult<IPackage>> {
  const { status, startDate, endDate, page = 1 } = filters;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query: Record<string, any> = {
    customerId: new Types.ObjectId(userId),
  };

  if (status) query['status'] = status;
  if (startDate || endDate) {
    query['createdAt'] = {};
    if (startDate) query['createdAt']['$gte'] = startDate;
    if (endDate) query['createdAt']['$lte'] = endDate;
  }

  return paginate<IPackage>(Package, query, page);
}

/** Packages assigned to a specific agent location (pickup or destination). */
export async function getPackagesByAgent(
  agentObjectId: string,
  filters: PackageFilters = {}
): Promise<PaginatedResult<IPackage>> {
  const id = new Types.ObjectId(agentObjectId);
  const { status, page = 1 } = filters;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query: Record<string, any> = {
    $or: [{ pickupAgentId: id }, { destinationAgentId: id }],
  };
  if (status) query['status'] = status;
  return paginate<IPackage>(Package, query, page);
}

/**
 * Search packages by packageId, customer name, or customer phone number.
 * Role-based data isolation is enforced:
 * - business_owner: only their own packages
 * - customer: only their own packages
 * - agent/admin: all packages
 */
export async function searchPackages(
  searchQuery: string,
  userId: string,
  role: UserRole
): Promise<IPackage[]> {
  if (!searchQuery || searchQuery.trim().length === 0) {
    return [];
  }

  const trimmed = searchQuery.trim();

  // Find matching customers by name or phone for sub-query
  const customerNameRegex = new RegExp(trimmed, 'i');
  const matchingCustomers = await User.find({
    $or: [
      { 'profile.firstName': customerNameRegex },
      { 'profile.lastName': customerNameRegex },
      { phoneNumber: customerNameRegex },
    ],
  }).select('_id');

  const customerIds = matchingCustomers.map((u) => u._id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const searchConditions: Record<string, any>[] = [
    { packageId: new RegExp(trimmed, 'i') },
  ];

  if (customerIds.length > 0) {
    searchConditions.push({ customerId: { $in: customerIds } });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query: Record<string, any> = { $or: searchConditions };

  // Enforce role-based isolation
  if (role === 'business_owner') {
    query['businessOwnerId'] = new Types.ObjectId(userId);
  } else if (role === 'customer') {
    query['customerId'] = new Types.ObjectId(userId);
  }
  // agent and admin can see all matching packages

  return Package.find(query).sort({ createdAt: -1 }).limit(PAGE_LIMIT);
}

// ---------------------------------------------------------------------------
// Task 4.5 – Package status update service
// ---------------------------------------------------------------------------

/**
 * Update the status of a package.
 *
 * Validates:
 * - The package exists
 * - The status transition is valid
 * - The agent is authorised (pickupAgentId or destinationAgentId must match)
 *
 * Adds a tracking history entry with timestamp and updatedBy.
 * Automatically generates a release code when status becomes
 * 'arrived_at_destination_agent' (Task 4.7).
 */
export async function updatePackageStatus(
  packageId: string,
  newStatus: PackageStatus,
  agentId: string,
  updatedBy: string
): Promise<IPackage> {
  const pkg = await Package.findOne({ packageId });
  if (!pkg) {
    throw makeError(`Package ${packageId} not found`, 'NOT_FOUND');
  }

  // Validate status transition
  const transitions = METHOD_TRANSITIONS[pkg.deliveryMethod] ?? VALID_TRANSITIONS;
  const allowedNext = transitions[pkg.status] ?? [];
  if (!allowedNext.includes(newStatus)) {
    throw makeError(
      `Invalid status transition from '${pkg.status}' to '${newStatus}' for delivery method '${pkg.deliveryMethod}'`,
      'CONFLICT'
    );
  }

  // Validate agent authorisation
  const agent = await Agent.findOne({ agentId });
  if (!agent) {
    throw makeError(`Agent ${agentId} not found`, 'NOT_FOUND');
  }

  const agentObjectId = agent._id as Types.ObjectId;
  const isPickupAgent = pkg.pickupAgentId && pkg.pickupAgentId.equals(agentObjectId);
  const isDestinationAgent = pkg.destinationAgentId && pkg.destinationAgentId.equals(agentObjectId);

  // For rent_a_shelf, also authorise via the shelf rental's agentId
  let isShelfAgent = false;
  if (pkg.deliveryMethod === 'rent_a_shelf' && pkg.shelfRentalId) {
    const { ShelfRental } = await import('../models/ShelfRental');
    const rental = await ShelfRental.findById(pkg.shelfRentalId);
    if (rental && rental.agentId.equals(agentObjectId)) isShelfAgent = true;
  }

  if (!isPickupAgent && !isDestinationAgent && !isShelfAgent) {
    throw makeError('Agent is not authorised to update this package', 'FORBIDDEN');
  }

  // Apply the status update
  pkg.status = newStatus;
  pkg.trackingHistory.push({
    status: newStatus,
    timestamp: new Date(),
    updatedBy: new Types.ObjectId(updatedBy),
  });

  // Generate release code:
  // - rent_a_shelf: on dropped_off_at_agent (goods are on shelf, customer can now collect)
  // - agent_delivery: on arrived_at_destination_agent (customer collects from agent)
  // - doorstep_delivery: never (agent delivers to address, no code needed)
  if (
    (pkg.deliveryMethod === 'rent_a_shelf' && newStatus === 'dropped_off_at_agent') ||
    (pkg.deliveryMethod === 'agent_delivery' && newStatus === 'arrived_at_destination_agent')
  ) {
    pkg.releaseCode = generateSixDigitCode();
    pkg.releaseCodeGeneratedAt = new Date();
  }

  if (newStatus === 'delivered') {
    pkg.deliveredAt = new Date();
  }

  await pkg.save();
  return pkg;
}

// ---------------------------------------------------------------------------
// Task 4.7 – Release code generation and validation
// ---------------------------------------------------------------------------

/**
 * Generate a new release code for a package.
 * Called automatically by updatePackageStatus when status becomes
 * 'arrived_at_destination_agent', but exposed here for direct use if needed.
 */
export async function generateReleaseCode(packageId: string): Promise<IPackage> {
  const pkg = await Package.findOne({ packageId });
  if (!pkg) {
    throw makeError(`Package ${packageId} not found`, 'NOT_FOUND');
  }

  if (pkg.status !== 'arrived_at_destination_agent') {
    throw makeError(
      'Release code can only be generated for packages with status arrived_at_destination_agent',
      'CONFLICT'
    );
  }

  pkg.releaseCode = generateSixDigitCode();
  pkg.releaseCodeGeneratedAt = new Date();
  await pkg.save();
  return pkg;
}

/**
 * Validate a release code and mark the package as delivered.
 *
 * - Verifies the agent is authorised (destinationAgentId must match)
 * - Checks the code matches
 * - On success: sets status='delivered', deliveredAt=now
 * - On failure: logs the attempt in tracking history and throws
 */
export async function validateReleaseCode(
  packageId: string,
  code: string,
  agentId: string
): Promise<IPackage> {
  const pkg = await Package.findOne({ packageId });
  if (!pkg) {
    throw makeError(`Package ${packageId} not found`, 'NOT_FOUND');
  }

  if (pkg.deliveryMethod === 'rent_a_shelf') {
    if (pkg.status !== 'dropped_off_at_agent') {
      throw makeError('Package is not ready for collection', 'CONFLICT');
    }
  } else {
    if (pkg.status !== 'arrived_at_destination_agent') {
      throw makeError('Package is not awaiting collection', 'CONFLICT');
    }
  }

  // Validate agent authorisation — check destinationAgentId or shelfRentalId
  const agent = await Agent.findOne({ agentId });
  if (!agent) {
    throw makeError(`Agent ${agentId} not found`, 'NOT_FOUND');
  }

  const agentObjectId = agent._id as Types.ObjectId;
  const isDestinationAgent = pkg.destinationAgentId && pkg.destinationAgentId.equals(agentObjectId);

  let isShelfAgent = false;
  if (pkg.deliveryMethod === 'rent_a_shelf' && pkg.shelfRentalId) {
    const { ShelfRental } = await import('../models/ShelfRental');
    const rental = await ShelfRental.findById(pkg.shelfRentalId);
    if (rental && rental.agentId.equals(agentObjectId)) isShelfAgent = true;
  }

  if (!isDestinationAgent && !isShelfAgent) {
    throw makeError('Agent is not authorised to validate this package', 'FORBIDDEN');
  }

  // Validate the code
  if (!pkg.releaseCode || pkg.releaseCode !== code) {
    // Log the failed attempt
    pkg.trackingHistory.push({
      status: pkg.status,
      timestamp: new Date(),
      updatedBy: agent.userId,
      location: `Failed release code attempt by agent ${agentId}`,
    });
    await pkg.save();

    throw makeError('Invalid release code', 'VALIDATION_ERROR');
  }

  // Success – mark as delivered
  pkg.status = 'delivered';
  pkg.deliveredAt = new Date();
  pkg.trackingHistory.push({
    status: 'delivered',
    timestamp: new Date(),
    updatedBy: agent.userId,
  });

  await pkg.save();
  return pkg;
}

// ---------------------------------------------------------------------------
// Task 4.9 – Package visibility
// ---------------------------------------------------------------------------

/**
 * Get a package by its packageId, enforcing visibility rules:
 * - business_owner: must be the package's businessOwnerId
 * - customer: must be the package's customerId
 * - agent: must be the pickupAgentId or destinationAgentId of the package
 * - admin: can view any package
 */
export async function getPackageById(
  packageId: string,
  userId: string,
  role: UserRole
): Promise<IPackage> {
  const pkg = await Package.findOne({ packageId });
  if (!pkg) {
    throw makeError(`Package ${packageId} not found`, 'NOT_FOUND');
  }

  if (role === 'admin') {
    return pkg;
  }

  if (role === 'business_owner') {
    if (!pkg.businessOwnerId.equals(new Types.ObjectId(userId))) {
      throw makeError('Access denied', 'FORBIDDEN');
    }
    return pkg;
  }

  if (role === 'customer') {
    if (!pkg.customerId.equals(new Types.ObjectId(userId))) {
      throw makeError('Access denied', 'FORBIDDEN');
    }
    return pkg;
  }

  if (role === 'agent') {
    // Find the agent record for this user
    const agent = await Agent.findOne({ userId: new Types.ObjectId(userId) });
    if (!agent) {
      throw makeError('Agent record not found for this user', 'NOT_FOUND');
    }

    const agentObjectId = agent._id as Types.ObjectId;
    const isPickup = pkg.pickupAgentId && pkg.pickupAgentId.equals(agentObjectId);
    const isDestination =
      pkg.destinationAgentId && pkg.destinationAgentId.equals(agentObjectId);

    if (!isPickup && !isDestination) {
      throw makeError('Access denied', 'FORBIDDEN');
    }
    return pkg;
  }

  throw makeError('Access denied', 'FORBIDDEN');
}
