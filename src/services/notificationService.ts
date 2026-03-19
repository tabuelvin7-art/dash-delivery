import { Types } from 'mongoose';
import { Notification, INotification } from '../models/Notification';
import { Package } from '../models/Package';
import { Payment } from '../models/Payment';
import { ShelfRental } from '../models/ShelfRental';
import { sendSMS } from './smsService';
import { logger } from '../utils/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NotificationType =
  | 'package_status'
  | 'payment_prompt'
  | 'payment_received'
  | 'release_code'
  | 'shelf_rental'
  | 'system';

export type RelatedEntityType = 'package' | 'payment' | 'shelf_rental';

export interface CreateNotificationOptions {
  sendSms?: boolean;
  relatedEntityType?: RelatedEntityType;
  relatedEntityId?: string;
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeError(message: string, code: string): Error {
  return Object.assign(new Error(message), { code });
}

// ---------------------------------------------------------------------------
// Task 6.3 – createNotification
// ---------------------------------------------------------------------------

/**
 * Create a Notification record and optionally send an SMS.
 *
 * Both inApp and SMS channels are tracked.
 * If sendSms=true (default), the SMS is dispatched and the channel status
 * is updated with the delivery result.
 *
 * Requirements: 10.1, 10.2
 */
export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  options: CreateNotificationOptions = {}
): Promise<INotification> {
  const { sendSms = true, relatedEntityType, relatedEntityId } = options;

  // Fetch user phone number for SMS
  // Import inline to avoid circular deps with authService
  const { User } = await import('../models/User');
  const user = await User.findById(userId).select('phoneNumber');

  const notifData: Partial<INotification> = {
    userId: new Types.ObjectId(userId),
    type,
    title,
    message,
    channels: {
      inApp: { sent: true },
      sms: { sent: false, retryCount: 0 },
    },
  };

  if (relatedEntityType) notifData.relatedEntityType = relatedEntityType;
  if (relatedEntityId) notifData.relatedEntityId = new Types.ObjectId(relatedEntityId);

  const notification = await Notification.create(notifData);

  // Send SMS if requested and user has a phone number
  if (sendSms && user?.phoneNumber) {
    try {
      const result = await sendSMS(user.phoneNumber, message);

      notification.channels.sms.sent = result.deliveryStatus === 'delivered';
      notification.channels.sms.sentAt = new Date();
      notification.channels.sms.deliveryStatus = result.deliveryStatus;
      notification.channels.sms.retryCount = result.retryCount;
      await notification.save();
    } catch (err) {
      logger.error(
        `Failed to send SMS notification ${notification._id}: ${err instanceof Error ? err.message : err}`
      );
      notification.channels.sms.deliveryStatus = 'failed';
      await notification.save();
    }
  }

  return notification;
}

// ---------------------------------------------------------------------------
// Task 6.7 – getNotifications (paginated)
// ---------------------------------------------------------------------------

/**
 * Get paginated notifications for a user, newest first.
 *
 * Requirements: 10.1
 */
export async function getNotifications(
  userId: string,
  page = 1
): Promise<PaginatedResult<INotification>> {
  const query = { userId: new Types.ObjectId(userId) };
  const skip = (page - 1) * PAGE_LIMIT;

  const [data, total] = await Promise.all([
    Notification.find(query).sort({ createdAt: -1 }).skip(skip).limit(PAGE_LIMIT),
    Notification.countDocuments(query),
  ]);

  return {
    data,
    page,
    limit: PAGE_LIMIT,
    total,
    totalPages: Math.ceil(total / PAGE_LIMIT),
  };
}

// ---------------------------------------------------------------------------
// Task 6.7 – markAsRead
// ---------------------------------------------------------------------------

/**
 * Mark an in-app notification as read.
 * Validates that the notification belongs to the requesting user.
 *
 * Requirements: 10.1
 */
export async function markAsRead(
  notificationId: string,
  userId: string
): Promise<INotification> {
  const notification = await Notification.findById(notificationId);
  if (!notification) {
    throw makeError(`Notification ${notificationId} not found`, 'NOT_FOUND');
  }

  if (!notification.userId.equals(new Types.ObjectId(userId))) {
    throw makeError('Access denied', 'FORBIDDEN');
  }

  if (!notification.channels.inApp.readAt) {
    notification.channels.inApp.readAt = new Date();
    await notification.save();
  }

  return notification;
}

// ---------------------------------------------------------------------------
// Task 6.7 – getUnreadCount
// ---------------------------------------------------------------------------

/**
 * Count unread in-app notifications for a user.
 *
 * Requirements: 10.1
 */
export async function getUnreadCount(userId: string): Promise<number> {
  return Notification.countDocuments({
    userId: new Types.ObjectId(userId),
    'channels.inApp.sent': true,
    'channels.inApp.readAt': { $exists: false },
  });
}

// ---------------------------------------------------------------------------
// Task 6.5 – Notification triggers
// ---------------------------------------------------------------------------

/**
 * Notify assigned agents when a new package is created.
 * Notifies pickupAgentId and/or destinationAgentId if set.
 */
export async function notifyAgentsOfNewPackage(packageId: string): Promise<void> {
  const pkg = await Package.findOne({ packageId });
  if (!pkg) return;

  const { Agent } = await import('../models/Agent');

  // Collect all relevant agent ObjectIds (pickup, destination, or shelf rental agent)
  const agentObjectIds: any[] = [pkg.pickupAgentId, pkg.destinationAgentId].filter(Boolean);

  // For rent_a_shelf, destinationAgentId is resolved at creation time, but double-check via shelfRentalId
  if (pkg.deliveryMethod === 'rent_a_shelf' && pkg.shelfRentalId && agentObjectIds.length === 0) {
    const { ShelfRental } = await import('../models/ShelfRental');
    const rental = await ShelfRental.findById(pkg.shelfRentalId).select('agentId');
    if (rental) agentObjectIds.push(rental.agentId);
  }

  if (agentObjectIds.length === 0) return;

  const agents = await Agent.find({ _id: { $in: agentObjectIds } }).select('userId');

  await Promise.all(
    agents.map(agent =>
      createNotification(
        String(agent.userId),
        'package_status',
        'New Package Assigned',
        `Package ${packageId} has been assigned to your location and is awaiting drop-off.`,
        { sendSms: false, relatedEntityType: 'package', relatedEntityId: String(pkg._id) }
      )
    )
  );
}

/**
 * Notify customer when a package is created for them.
 */
export async function notifyCustomerPackageCreated(packageId: string): Promise<void> {
  const pkg = await Package.findOne({ packageId });
  if (!pkg) return;

  const method = pkg.deliveryMethod === 'rent_a_shelf'
    ? 'available for pickup at an agent location'
    : pkg.deliveryMethod === 'doorstep_delivery'
    ? 'being prepared for doorstep delivery to your address'
    : 'ready for pickup at an agent location';

  const msg = `A package (${packageId}) has been created for you and is ${method}. Track it in the app.`;
  const safeMsg = msg.length <= 160 ? msg : msg.slice(0, 160);

  await createNotification(
    String(pkg.customerId),
    'package_status',
    'New Package for You',
    safeMsg,
    { sendSms: true, relatedEntityType: 'package', relatedEntityId: String(pkg._id) }
  );
}

/**
 * Notify customer and business owner when a package status changes.
 *
 * Requirements: 5.5, 10.1, 10.3
 */
export async function notifyPackageStatusChange(
  packageId: string,
  newStatus: string
): Promise<void> {
  const pkg = await Package.findOne({ packageId });
  if (!pkg) {
    logger.warn(`notifyPackageStatusChange: package ${packageId} not found`);
    return;
  }

  const statusLabel = newStatus.replace(/_/g, ' ');
  const title = newStatus === 'delivered' ? 'Package Delivered 🎉' : 'Package Status Update';
  const baseMsg = newStatus === 'delivered'
    ? `Your package ${packageId} has been delivered/collected successfully.`
    : `Your package ${packageId} is now: ${statusLabel}.`;
  const smsMsg = baseMsg.length <= 160 ? baseMsg : baseMsg.slice(0, 160);

  const opts: CreateNotificationOptions = {
    sendSms: true,
    relatedEntityType: 'package',
    relatedEntityId: String(pkg._id),
  };

  await Promise.all([
    createNotification(
      String(pkg.customerId),
      'package_status',
      title,
      smsMsg,
      opts
    ),
    createNotification(
      String(pkg.businessOwnerId),
      'package_status',
      title,
      smsMsg,
      { ...opts, sendSms: false } // business owner gets in-app only for status changes
    ),
  ]);
}

/**
 * Notify user that a payment prompt was sent.
 *
 * Requirements: 7.1, 10.4
 */
export async function notifyPaymentPrompt(paymentId: string): Promise<void> {
  const payment = await Payment.findById(paymentId);
  if (!payment) {
    logger.warn(`notifyPaymentPrompt: payment ${paymentId} not found`);
    return;
  }

  const pkg = await Package.findById(payment.packageId);
  const pkgRef = pkg ? pkg.packageId : String(payment.packageId);
  const typeLabel =
    payment.paymentType === 'delivery_fee'
      ? 'delivery fee'
      : payment.paymentType === 'item_price'
        ? 'item price'
        : 'shelf rental';

  const msg = `Payment prompt sent: KES ${payment.amount} ${typeLabel} for ${pkgRef}.`;
  const safeMsg = msg.length <= 160 ? msg : msg.slice(0, 160);

  await createNotification(
    String(payment.payerId),
    'payment_prompt',
    'Payment Prompt Sent',
    safeMsg,
    {
      sendSms: true,
      relatedEntityType: 'payment',
      relatedEntityId: paymentId,
    }
  );
}

/**
 * Send release code to customer via SMS and in-app when package arrives.
 *
 * Requirements: 9.2, 10.3
 */
export async function notifyReleaseCode(packageId: string): Promise<void> {
  const pkg = await Package.findOne({ packageId });
  if (!pkg) {
    logger.warn(`notifyReleaseCode: package ${packageId} not found`);
    return;
  }

  if (!pkg.releaseCode) {
    logger.warn(`notifyReleaseCode: package ${packageId} has no release code`);
    return;
  }

  const msg = `Your package ${packageId} has arrived. Release code: ${pkg.releaseCode}. Show this to the agent to collect your package.`;
  // Enforce 160-char limit
  const safeMsg = msg.length <= 160 ? msg : msg.slice(0, 160);

  await createNotification(
    String(pkg.customerId),
    'release_code',
    'Package Arrived – Collect Now',
    safeMsg,
    {
      sendSms: true,
      relatedEntityType: 'package',
      relatedEntityId: String(pkg._id),
    }
  );
}

/**
 * Notify business owner that a payment was received.
 *
 * Requirements: 7.1, 7.2
 */
export async function notifyPaymentReceived(paymentId: string): Promise<void> {
  const payment = await Payment.findById(paymentId);
  if (!payment) {
    logger.warn(`notifyPaymentReceived: payment ${paymentId} not found`);
    return;
  }

  const pkg = await Package.findById(payment.packageId);
  const pkgRef = pkg ? pkg.packageId : String(payment.packageId);
  const typeLabel =
    payment.paymentType === 'delivery_fee' ? 'delivery fee' : 'item price';

  const msg = `Payment received: KES ${payment.amount} ${typeLabel} for package ${pkgRef}.`;
  const safeMsg = msg.length <= 160 ? msg : msg.slice(0, 160);

  await createNotification(
    String(payment.payeeId),
    'payment_received',
    'Payment Received',
    safeMsg,
    {
      sendSms: false, // in-app only for payment received
      relatedEntityType: 'payment',
      relatedEntityId: paymentId,
    }
  );
}

/**
 * Notify customer and assigned agent when a package is cancelled by the business owner.
 */
export async function notifyPackageCancelled(packageId: string): Promise<void> {
  const pkg = await Package.findOne({ packageId });
  if (!pkg) return;

  const msg = `Package ${packageId} has been cancelled by the business owner.`;

  const notifications: Promise<any>[] = [
    createNotification(
      String(pkg.customerId),
      'package_status',
      'Package Cancelled',
      msg,
      { sendSms: true, relatedEntityType: 'package', relatedEntityId: String(pkg._id) }
    ),
  ];

  // Notify the assigned agent(s) if any
  const { Agent } = await import('../models/Agent');
  const agentObjectIds = [pkg.pickupAgentId, pkg.destinationAgentId].filter(Boolean);
  if (agentObjectIds.length > 0) {
    const agents = await Agent.find({ _id: { $in: agentObjectIds } }).select('userId');
    agents.forEach(agent =>
      notifications.push(
        createNotification(
          String(agent.userId),
          'package_status',
          'Package Cancelled',
          msg,
          { sendSms: false, relatedEntityType: 'package', relatedEntityId: String(pkg._id) }
        )
      )
    );
  }

  await Promise.all(notifications);
}


export async function notifyPackageReturned(packageId: string): Promise<void> {
  const pkg = await Package.findOne({ packageId });
  if (!pkg) return;

  const msg = `Package ${packageId} has been returned to sender. Please arrange collection from the agent.`;
  const safeMsg = msg.length <= 160 ? msg : msg.slice(0, 160);

  await createNotification(
    String(pkg.businessOwnerId),
    'package_status',
    'Package Returned to Sender',
    safeMsg,
    { sendSms: true, relatedEntityType: 'package', relatedEntityId: String(pkg._id) }
  );
}

/**
 * Notify business owner that their shelf rental is expiring in 7 days.
 *
 * Requirements: 16.6
 */
export async function notifyShelfRentalExpiring(rentalId: string): Promise<void> {
  const rental = await ShelfRental.findOne({ rentalId });
  if (!rental) {
    logger.warn(`notifyShelfRentalExpiring: rental ${rentalId} not found`);
    return;
  }

  const endDate = rental.rentalPeriod.endDate.toISOString().slice(0, 10);
  const msg = `Your shelf rental ${rentalId} expires on ${endDate}. Renew to keep your inventory stored.`;
  const safeMsg = msg.length <= 160 ? msg : msg.slice(0, 160);

  await createNotification(
    String(rental.businessOwnerId),
    'shelf_rental',
    'Shelf Rental Expiring Soon',
    safeMsg,
    {
      sendSms: true,
      relatedEntityType: 'shelf_rental',
      relatedEntityId: String(rental._id),
    }
  );
}
