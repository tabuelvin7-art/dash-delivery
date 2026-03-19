import { Types } from 'mongoose';
import { Package } from '../models/Package';
import { Payment } from '../models/Payment';
import { ShelfRental } from '../models/ShelfRental';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DeliveryStats {
  totalPackages: number;
  deliveredPackages: number;
  pendingPackages: number;
  deliverySuccessRate: number; // percentage 0–100
  byMethod: Record<string, number>;
  byStatus: Record<string, number>;
}

export interface RevenueReport {
  totalRevenue: number;
  deliveryFeeRevenue: number;
  itemPriceRevenue: number;
  shelfRentalRevenue: number;
  byMonth: Array<{ month: string; revenue: number }>;
}

export interface DashboardStats {
  totalPackages: number;
  pendingDeliveries: number;
  completedDeliveries: number;
  revenueThisMonth: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function startOfMonth(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function buildOwnerQuery(businessOwnerId: string, isAdmin: boolean): Record<string, unknown> {
  if (isAdmin) return {};
  return { businessOwnerId: new Types.ObjectId(businessOwnerId) };
}

// ---------------------------------------------------------------------------
// Reporting service
// ---------------------------------------------------------------------------

/**
 * Delivery statistics. Admin sees all packages; business_owner sees only theirs.
 */
export async function getDeliveryStats(
  userId: string,
  startDate?: Date,
  endDate?: Date,
  isAdmin = false
): Promise<DeliveryStats> {
  const baseQuery: Record<string, unknown> = { ...buildOwnerQuery(userId, isAdmin) };
  if (startDate || endDate) {
    const dateQ: Record<string, unknown> = {};
    if (startDate) dateQ['$gte'] = startDate;
    if (endDate) dateQ['$lte'] = endDate;
    baseQuery['createdAt'] = dateQ;
  }

  const allPackages = await Package.find(baseQuery).select('status deliveryMethod');

  const totalPackages = allPackages.length;
  const deliveredPackages = allPackages.filter(p => p.status === 'delivered').length;
  const cancelledPackages = allPackages.filter(p => p.status === 'cancelled').length;
  const returnedPackages = allPackages.filter(p => p.status === 'returned').length;
  const activePackages = totalPackages - cancelledPackages - returnedPackages;
  const pendingPackages = activePackages - deliveredPackages;
  const deliverySuccessRate = activePackages > 0 ? (deliveredPackages / activePackages) * 100 : 0;

  const byMethod: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  for (const p of allPackages) {
    byMethod[p.deliveryMethod] = (byMethod[p.deliveryMethod] || 0) + 1;
    byStatus[p.status] = (byStatus[p.status] || 0) + 1;
  }

  return { totalPackages, deliveredPackages, pendingPackages, deliverySuccessRate, byMethod, byStatus };
}

/**
 * Revenue report. Admin sees all revenue; business_owner sees only theirs.
 * Aggregates from both completed Payments AND directly from Package prices
 * (since M-Pesa may not be live in all environments).
 */
export async function getRevenueReport(
  userId: string,
  startDate?: Date,
  endDate?: Date,
  isAdmin = false
): Promise<RevenueReport> {
  const dateFilter: Record<string, unknown> = {};
  if (startDate || endDate) {
    const dateQ: Record<string, unknown> = {};
    if (startDate) dateQ['$gte'] = startDate;
    if (endDate) dateQ['$lte'] = endDate;
    dateFilter['createdAt'] = dateQ;
  }

  // Sum from completed payments
  const paymentQuery: Record<string, unknown> = {
    ...(isAdmin ? {} : { payeeId: new Types.ObjectId(userId) }),
    status: 'completed',
    ...dateFilter,
  };
  const payments = await Payment.find(paymentQuery).select('paymentType amount createdAt');

  let deliveryFeeRevenue = 0;
  let itemPriceRevenue = 0;
  let shelfRentalRevenue = 0;
  const monthMap: Record<string, number> = {};

  for (const p of payments) {
    if (p.paymentType === 'delivery_fee') deliveryFeeRevenue += p.amount;
    else if (p.paymentType === 'item_price') itemPriceRevenue += p.amount;
    else if (p.paymentType === 'shelf_rental') shelfRentalRevenue += p.amount;
    const month = p.createdAt.toISOString().slice(0, 7);
    monthMap[month] = (monthMap[month] || 0) + p.amount;
  }

  // If no completed payments exist, fall back to summing delivered package item prices
  // (business owner receives item price; delivery fee goes to agent)
  if (itemPriceRevenue === 0) {
    const pkgQuery: Record<string, unknown> = {
      ...(isAdmin ? {} : { businessOwnerId: new Types.ObjectId(userId) }),
      status: 'delivered',
      ...dateFilter,
    };
    const deliveredPkgs = await Package.find(pkgQuery).select('itemPrice createdAt');
    for (const pkg of deliveredPkgs) {
      itemPriceRevenue += pkg.itemPrice || 0;
      const month = pkg.createdAt.toISOString().slice(0, 7);
      monthMap[month] = (monthMap[month] || 0) + (pkg.itemPrice || 0);
    }
  }

  const totalRevenue = deliveryFeeRevenue + itemPriceRevenue + shelfRentalRevenue;

  const byMonth = Object.entries(monthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, revenue]) => ({
      month: new Date(month + '-01').toLocaleDateString('en-US', { year: 'numeric', month: 'short' }),
      revenue,
    }));

  return { totalRevenue, deliveryFeeRevenue, itemPriceRevenue, shelfRentalRevenue, byMonth };
}

/**
 * Dashboard statistics for a business owner.
 */
export async function getDashboardStats(businessOwnerId: string): Promise<DashboardStats> {
  const ownerId = new Types.ObjectId(businessOwnerId);
  const monthStart = startOfMonth();

  const [totalPackages, completedDeliveries, cancelledPackages, returnedPackages, revenuePayments] = await Promise.all([
    Package.countDocuments({ businessOwnerId: ownerId }),
    Package.countDocuments({ businessOwnerId: ownerId, status: 'delivered' }),
    Package.countDocuments({ businessOwnerId: ownerId, status: 'cancelled' }),
    Package.countDocuments({ businessOwnerId: ownerId, status: 'returned' }),
    Payment.find({ payeeId: ownerId, status: 'completed', createdAt: { $gte: monthStart } }).select('amount'),
  ]);

  const activePackages = totalPackages - cancelledPackages - returnedPackages;
  const pendingDeliveries = activePackages - completedDeliveries;
  const revenueThisMonth = revenuePayments.reduce((sum, p) => sum + p.amount, 0);

  return { totalPackages: activePackages, pendingDeliveries, completedDeliveries, revenueThisMonth };
}

// ---------------------------------------------------------------------------
// Agent reporting
// ---------------------------------------------------------------------------

export interface AgentStats {
  totalPackages: number;
  activePackages: number;
  deliveredPackages: number;
  returnedPackages: number;
  deliverySuccessRate: number;
  byStatus: Record<string, number>;
  shelfRentals: {
    total: number;
    active: number;
    totalBilled: number;
    totalPaid: number;
  };
  byMonth: Array<{ month: string; received: number; delivered: number }>;
}

export async function getAgentStats(
  userId: string,
  startDate?: Date,
  endDate?: Date
): Promise<AgentStats> {
  const { Agent } = await import('../models/Agent');
  const agentDoc = await Agent.findOne({ userId: new Types.ObjectId(userId) }).select('_id agentId');
  if (!agentDoc) {
    return {
      totalPackages: 0, activePackages: 0, deliveredPackages: 0,
      returnedPackages: 0, deliverySuccessRate: 0, byStatus: {},
      shelfRentals: { total: 0, active: 0, totalBilled: 0, totalPaid: 0 },
      byMonth: [],
    };
  }

  const agentObjId = agentDoc._id as Types.ObjectId;
  const dateFilter: Record<string, unknown> = {};
  if (startDate || endDate) {
    const dq: Record<string, unknown> = {};
    if (startDate) dq['$gte'] = startDate;
    if (endDate) dq['$lte'] = endDate;
    dateFilter['createdAt'] = dq;
  }

  const pkgQuery = {
    $or: [{ pickupAgentId: agentObjId }, { destinationAgentId: agentObjId }],
    ...dateFilter,
  };

  const packages = await Package.find(pkgQuery).select('status createdAt deliveredAt trackingHistory');

  const totalPackages = packages.length;
  const deliveredPackages = packages.filter(p => p.status === 'delivered').length;
  const returnedPackages = packages.filter(p => p.status === 'returned').length;
  const cancelledPackages = packages.filter(p => p.status === 'cancelled').length;
  const activePackages = totalPackages - deliveredPackages - returnedPackages - cancelledPackages;
  const deliverySuccessRate = (totalPackages - cancelledPackages - returnedPackages) > 0
    ? (deliveredPackages / (totalPackages - cancelledPackages - returnedPackages)) * 100
    : 0;

  const byStatus: Record<string, number> = {};
  const monthMap: Record<string, { received: number; delivered: number }> = {};
  for (const p of packages) {
    byStatus[p.status] = (byStatus[p.status] || 0) + 1;
    const month = p.createdAt.toISOString().slice(0, 7);
    if (!monthMap[month]) monthMap[month] = { received: 0, delivered: 0 };
    monthMap[month].received += 1;
    if (p.status === 'delivered') monthMap[month].delivered += 1;
  }

  const byMonth = Object.entries(monthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({
      month: new Date(month + '-01').toLocaleDateString('en-US', { year: 'numeric', month: 'short' }),
      ...v,
    }));

  const rentals = await ShelfRental.find({ agentId: agentObjId, ...dateFilter }).select('status pricing paymentStatus');
  const shelfRentals = {
    total: rentals.length,
    active: rentals.filter(r => r.status === 'active').length,
    totalBilled: rentals.reduce((s, r) => s + (r.pricing?.totalAmount || 0), 0),
    totalPaid: rentals.filter(r => r.paymentStatus === 'paid').reduce((s, r) => s + (r.pricing?.totalAmount || 0), 0),
  };

  return { totalPackages, activePackages, deliveredPackages, returnedPackages, deliverySuccessRate, byStatus, shelfRentals, byMonth };
}

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------

export async function exportDeliveriesCSV(
  userId: string,
  startDate?: Date,
  endDate?: Date,
  isAdmin = false
): Promise<string> {
  const query: Record<string, unknown> = { ...buildOwnerQuery(userId, isAdmin) };
  if (startDate || endDate) {
    const dateQ: Record<string, unknown> = {};
    if (startDate) dateQ['$gte'] = startDate;
    if (endDate) dateQ['$lte'] = endDate;
    query['createdAt'] = dateQ;
  }

  const packages = await Package.find(query)
    .select('packageId status deliveryMethod itemPrice deliveryFee createdAt deliveredAt')
    .sort({ createdAt: -1 });

  const header = 'Package ID,Status,Delivery Method,Item Price (KES),Delivery Fee (KES),Created At,Delivered At';
  const rows = packages.map(pkg => [
    pkg.packageId, pkg.status, pkg.deliveryMethod,
    pkg.itemPrice, pkg.deliveryFee,
    pkg.createdAt.toISOString(),
    pkg.deliveredAt ? pkg.deliveredAt.toISOString() : '',
  ].join(','));

  return [header, ...rows].join('\n');
}

export async function exportRevenueCSV(
  userId: string,
  startDate?: Date,
  endDate?: Date,
  isAdmin = false
): Promise<string> {
  const query: Record<string, unknown> = isAdmin ? { status: 'completed' } : { payeeId: new Types.ObjectId(userId), status: 'completed' };
  if (startDate || endDate) {
    const dateQ: Record<string, unknown> = {};
    if (startDate) dateQ['$gte'] = startDate;
    if (endDate) dateQ['$lte'] = endDate;
    query['createdAt'] = dateQ;
  }

  const payments = await Payment.find(query)
    .select('transactionId paymentType amount mpesaReceiptNumber completedAt')
    .sort({ completedAt: -1 });

  const header = 'Transaction ID,Payment Type,Amount (KES),M-Pesa Receipt,Completed At';
  const rows = payments.map(p => [
    p.transactionId, p.paymentType, p.amount,
    p.mpesaReceiptNumber ?? '',
    p.completedAt ? p.completedAt.toISOString() : '',
  ].join(','));

  return [header, ...rows].join('\n');
}
