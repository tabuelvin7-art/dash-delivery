// User types
export type UserRole = 'business_owner' | 'customer' | 'agent' | 'admin';

export interface User {
  _id: string;
  email: string;
  phoneNumber: string;
  role: UserRole;
  isPhoneVerified: boolean;
  isActive: boolean;
  profile: {
    firstName: string;
    lastName: string;
    businessName?: string;
    address?: string;
  };
  createdAt: string;
  updatedAt: string;
}

// Package types
export type DeliveryMethod = 'agent_delivery' | 'doorstep_delivery' | 'rent_a_shelf';

export type PackageStatus = 
  | 'created' 
  | 'dropped_off_at_agent' 
  | 'dispatched' 
  | 'arrived_at_destination_agent' 
  | 'out_for_delivery' 
  | 'delivered';

export type PaymentStatus = 'pending' | 'paid' | 'failed';

export interface TrackingHistoryEntry {
  status: string;
  timestamp: string;
  updatedBy: string;
  location?: string;
}

export interface Package {
  _id: string;
  packageId: string;
  businessOwnerId: string;
  customerId: string;
  deliveryMethod: DeliveryMethod;
  pickupAgentId?: string;
  destinationAgentId?: string;
  deliveryAddress?: string;
  shelfRentalId?: string;
  itemPrice: number;
  deliveryFee: number;
  status: PackageStatus;
  trackingHistory: TrackingHistoryEntry[];
  releaseCode?: string;
  releaseCodeGeneratedAt?: string;
  deliveryFeePaymentStatus: PaymentStatus;
  itemPricePaymentStatus: PaymentStatus;
  createdAt: string;
  updatedAt: string;
  deliveredAt?: string;
}

// Payment types
export type PaymentType = 'delivery_fee' | 'item_price' | 'shelf_rental';

export interface Payment {
  _id: string;
  transactionId: string;
  packageId: string;
  paymentType: PaymentType;
  amount: number;
  payerId: string;
  payeeId: string;
  mpesaRequestId?: string;
  mpesaReceiptNumber?: string;
  status: PaymentStatus;
  failureReason?: string;
  initiatedAt: string;
  completedAt?: string;
}

// Agent types
export interface Agent {
  _id: string;
  agentId: string;
  userId: string;
  locationName: string;
  address: string;
  neighborhood: string;
  city: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  contactPhone: string;
  operatingHours: {
    open: string;
    close: string;
    daysOfWeek: string[];
  };
  capacity: {
    totalShelves: number;
    availableShelves: number;
  };
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Shelf Rental types
export type RentalStatus = 'active' | 'expired' | 'cancelled';

export interface InventoryItem {
  itemName: string;
  quantity: number;
  addedAt: string;
}

export interface ShelfRental {
  _id: string;
  rentalId: string;
  businessOwnerId: string;
  agentId: string;
  shelfNumber: string;
  rentalPeriod: {
    startDate: string;
    endDate: string;
  };
  pricing: {
    monthlyRate: number;
    totalAmount: number;
  };
  paymentStatus: PaymentStatus;
  paymentId?: string;
  inventory: InventoryItem[];
  status: RentalStatus;
  createdAt: string;
  updatedAt: string;
}

// Notification types
export type NotificationType = 
  | 'package_status' 
  | 'payment_prompt' 
  | 'payment_received' 
  | 'release_code' 
  | 'shelf_rental' 
  | 'system';

export interface Notification {
  _id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedEntityType?: 'package' | 'payment' | 'shelf_rental';
  relatedEntityId?: string;
  channels: {
    inApp: {
      sent: boolean;
      readAt?: string;
    };
    sms: {
      sent: boolean;
      sentAt?: string;
      deliveryStatus?: 'delivered' | 'failed';
      retryCount: number;
    };
  };
  createdAt: string;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code: string;
    message: string;
    details?: Array<{
      field: string;
      message: string;
    }>;
  };
}

// Pagination types
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: PaginationMeta;
}
