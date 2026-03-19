import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ITrackingEntry {
  status: string;
  timestamp: Date;
  updatedBy: Types.ObjectId;
  location?: string;
}

export interface IPackage extends Document {
  packageId: string;
  businessOwnerId: Types.ObjectId;
  customerId: Types.ObjectId;
  deliveryMethod: 'agent_delivery' | 'doorstep_delivery' | 'rent_a_shelf';
  pickupAgentId?: Types.ObjectId;
  destinationAgentId?: Types.ObjectId;
  deliveryAddress?: string;
  shelfRentalId?: Types.ObjectId;
  itemPrice: number;
  deliveryFee: number;
  status:
    | 'created'
    | 'dropped_off_at_agent'
    | 'dispatched'
    | 'arrived_at_destination_agent'
    | 'out_for_delivery'
    | 'delivered'
    | 'returned'
    | 'cancelled';
  trackingHistory: ITrackingEntry[];
  releaseCode?: string;
  releaseCodeGeneratedAt?: Date;
  deliveryFeePaymentStatus: 'pending' | 'paid' | 'failed';
  itemPricePaymentStatus: 'pending' | 'paid' | 'failed';
  deliveredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TrackingEntrySchema = new Schema<ITrackingEntry>(
  {
    status: { type: String, required: true },
    timestamp: { type: Date, required: true, default: Date.now },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    location: { type: String },
  },
  { _id: false }
);

const PackageSchema = new Schema<IPackage>(
  {
    packageId: {
      type: String,
      unique: true,
      sparse: true, // allows pre-save hook to generate it
    },
    businessOwnerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Business owner is required'],
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Customer is required'],
    },
    deliveryMethod: {
      type: String,
      required: [true, 'Delivery method is required'],
      enum: {
        values: ['agent_delivery', 'doorstep_delivery', 'rent_a_shelf'],
        message: '{VALUE} is not a valid delivery method',
      },
    },
    pickupAgentId: { type: Schema.Types.ObjectId, ref: 'Agent' },
    destinationAgentId: { type: Schema.Types.ObjectId, ref: 'Agent' },
    deliveryAddress: { type: String, trim: true },
    shelfRentalId: { type: Schema.Types.ObjectId },
    itemPrice: {
      type: Number,
      required: [true, 'Item price is required'],
      min: [0, 'Item price cannot be negative'],
    },
    deliveryFee: {
      type: Number,
      required: [true, 'Delivery fee is required'],
      min: [0, 'Delivery fee cannot be negative'],
    },
    status: {
      type: String,
      required: true,
      default: 'created',
      enum: {
        values: [
          'created',
          'dropped_off_at_agent',
          'dispatched',
          'arrived_at_destination_agent',
          'out_for_delivery',
          'delivered',
          'returned',
          'cancelled',
        ],
        message: '{VALUE} is not a valid status',
      },
    },
    trackingHistory: { type: [TrackingEntrySchema], default: [] },
    releaseCode: { type: String },
    releaseCodeGeneratedAt: { type: Date },
    deliveryFeePaymentStatus: {
      type: String,
      required: true,
      default: 'pending',
      enum: {
        values: ['pending', 'paid', 'failed'],
        message: '{VALUE} is not a valid payment status',
      },
    },
    itemPricePaymentStatus: {
      type: String,
      required: true,
      default: 'pending',
      enum: {
        values: ['pending', 'paid', 'failed'],
        message: '{VALUE} is not a valid payment status',
      },
    },
    deliveredAt: { type: Date },
  },
  { timestamps: true }
);

// Indexes
PackageSchema.index({ businessOwnerId: 1, createdAt: -1 });
PackageSchema.index({ customerId: 1, createdAt: -1 });
PackageSchema.index({ status: 1 });
PackageSchema.index({ destinationAgentId: 1, status: 1 });

// Pre-save hook: auto-generate packageId in format PKG-YYYYMMDD-XXX
PackageSchema.pre('save', async function (next) {
  if (this.packageId) return next();

  try {
    const now = new Date();
    const datePart = now
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, ''); // YYYYMMDD

    const prefix = `PKG-${datePart}-`;

    // Count existing packages with the same date prefix to determine sequence
    const count = await mongoose.model('Package').countDocuments({
      packageId: { $regex: `^${prefix}` },
    });

    const sequence = String(count + 1).padStart(3, '0');
    this.packageId = `${prefix}${sequence}`;

    next();
  } catch (error) {
    next(error as Error);
  }
});

export const Package = mongoose.model<IPackage>('Package', PackageSchema);
