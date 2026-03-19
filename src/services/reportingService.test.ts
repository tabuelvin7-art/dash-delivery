import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Package } from '../models/Package';
import { Payment } from '../models/Payment';
import {
  getDeliveryStats,
  getRevenueReport,
  getDashboardStats,
  exportDeliveriesCSV,
  exportRevenueCSV,
} from './reportingService';

describe('ReportingService', () => {
  let mongoServer: MongoMemoryServer;
  const ownerId = new Types.ObjectId().toString();

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  afterEach(async () => {
    await Package.deleteMany({});
    await Payment.deleteMany({});
  });

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  async function createPackage(status: string, deliveredAt?: Date) {
    return Package.create({
      packageId: `PKG-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
      businessOwnerId: new Types.ObjectId(ownerId),
      customerId: new Types.ObjectId(),
      deliveryMethod: 'agent_delivery',
      destinationAgentId: new Types.ObjectId(),
      itemPrice: 500,
      deliveryFee: 100,
      status,
      deliveredAt: deliveredAt ?? undefined,
      trackingHistory: [{ status, updatedBy: new Types.ObjectId(), timestamp: new Date() }],
    });
  }

  async function createPayment(paymentType: string, amount: number, status = 'completed') {
    return Payment.create({
      transactionId: `TXN-${Date.now()}-${Math.random()}`,
      packageId: new Types.ObjectId(),
      payerId: new Types.ObjectId(),
      payeeId: new Types.ObjectId(ownerId),
      amount,
      paymentType,
      status,
      mpesaReceiptNumber: status === 'completed' ? 'RCP123' : undefined,
      completedAt: status === 'completed' ? new Date() : undefined,
    });
  }

  // -------------------------------------------------------------------------
  // getDeliveryStats()
  // -------------------------------------------------------------------------

  describe('getDeliveryStats()', () => {
    it('returns zeros when no packages exist', async () => {
      const stats = await getDeliveryStats(ownerId);
      expect(stats.total).toBe(0);
      expect(stats.pending).toBe(0);
      expect(stats.completed).toBe(0);
      expect(stats.successRate).toBe(0);
      expect(stats.avgDeliveryTimeHours).toBe(0);
    });

    it('counts total, pending, and completed correctly', async () => {
      await createPackage('dispatched');
      await createPackage('dispatched');
      await createPackage('delivered', new Date());

      const stats = await getDeliveryStats(ownerId);
      expect(stats.total).toBe(3);
      expect(stats.completed).toBe(1);
      expect(stats.pending).toBe(2);
    });

    it('calculates success rate correctly', async () => {
      await createPackage('delivered', new Date());
      await createPackage('delivered', new Date());
      await createPackage('dispatched');

      const stats = await getDeliveryStats(ownerId);
      expect(stats.successRate).toBeCloseTo(2 / 3);
    });

    it('returns successRate of 1 when all packages are delivered', async () => {
      await createPackage('delivered', new Date());
      const stats = await getDeliveryStats(ownerId);
      expect(stats.successRate).toBe(1);
    });

    it('only counts packages for the given businessOwnerId', async () => {
      await createPackage('delivered', new Date());
      // package for a different owner
      await Package.create({
        packageId: `PKG-OTHER-${Date.now()}`,
        businessOwnerId: new Types.ObjectId(),
        customerId: new Types.ObjectId(),
        deliveryMethod: 'agent_delivery',
        destinationAgentId: new Types.ObjectId(),
        itemPrice: 100,
        deliveryFee: 50,
        status: 'delivered',
        deliveredAt: new Date(),
        trackingHistory: [],
      });

      const stats = await getDeliveryStats(ownerId);
      expect(stats.total).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // getRevenueReport()
  // -------------------------------------------------------------------------

  describe('getRevenueReport()', () => {
    it('returns zero revenue when no payments exist', async () => {
      const report = await getRevenueReport(ownerId);
      expect(report.totalRevenue).toBe(0);
      expect(report.breakdown.delivery_fee).toBe(0);
      expect(report.breakdown.item_price).toBe(0);
      expect(report.breakdown.shelf_rental).toBe(0);
    });

    it('sums revenue by payment type', async () => {
      await createPayment('delivery_fee', 200);
      await createPayment('item_price', 500);
      await createPayment('shelf_rental', 1000);

      const report = await getRevenueReport(ownerId);
      expect(report.totalRevenue).toBe(1700);
      expect(report.breakdown.delivery_fee).toBe(200);
      expect(report.breakdown.item_price).toBe(500);
      expect(report.breakdown.shelf_rental).toBe(1000);
    });

    it('excludes non-completed payments', async () => {
      await createPayment('delivery_fee', 300, 'pending');
      await createPayment('delivery_fee', 200, 'completed');

      const report = await getRevenueReport(ownerId);
      expect(report.totalRevenue).toBe(200);
    });
  });

  // -------------------------------------------------------------------------
  // getDashboardStats()
  // -------------------------------------------------------------------------

  describe('getDashboardStats()', () => {
    it('returns correct dashboard stats', async () => {
      await createPackage('dispatched');
      await createPackage('delivered', new Date());
      await createPayment('delivery_fee', 400);

      const stats = await getDashboardStats(ownerId);
      expect(stats.totalPackages).toBe(2);
      expect(stats.completedDeliveries).toBe(1);
      expect(stats.pendingDeliveries).toBe(1);
      expect(stats.revenueThisMonth).toBe(400);
    });
  });

  // -------------------------------------------------------------------------
  // exportDeliveriesCSV()
  // -------------------------------------------------------------------------

  describe('exportDeliveriesCSV()', () => {
    it('returns CSV with header row', async () => {
      const csv = await exportDeliveriesCSV(ownerId);
      expect(csv.startsWith('Package ID,')).toBe(true);
    });

    it('includes one row per package', async () => {
      await createPackage('dispatched');
      await createPackage('delivered', new Date());

      const csv = await exportDeliveriesCSV(ownerId);
      const lines = csv.trim().split('\n');
      expect(lines).toHaveLength(3); // header + 2 rows
    });

    it('returns only header when no packages exist', async () => {
      const csv = await exportDeliveriesCSV(ownerId);
      const lines = csv.trim().split('\n');
      expect(lines).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // exportRevenueCSV()
  // -------------------------------------------------------------------------

  describe('exportRevenueCSV()', () => {
    it('returns CSV with header row', async () => {
      const csv = await exportRevenueCSV(ownerId);
      expect(csv.startsWith('Transaction ID,')).toBe(true);
    });

    it('includes one row per completed payment', async () => {
      await createPayment('delivery_fee', 200);
      await createPayment('item_price', 500);

      const csv = await exportRevenueCSV(ownerId);
      const lines = csv.trim().split('\n');
      expect(lines).toHaveLength(3); // header + 2 rows
    });
  });
});
