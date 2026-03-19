import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IInventoryItem {
  itemName: string;
  quantity: number;
  addedAt: Date;
}

export interface IShelfRental extends Document {
  rentalId: string;
  businessOwnerId: Types.ObjectId;
  agentId: Types.ObjectId;
  shelfNumber: string;
  rentalPeriod: {
    startDate: Date;
    endDate: Date;
  };
  pricing: {
    monthlyRate: number;
    totalAmount: number;
  };
  paymentStatus: 'pending' | 'paid' | 'overdue';
  paymentId?: Types.ObjectId;
  inventory: IInventoryItem[];
  status: 'active' | 'expired' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
}

const InventoryItemSchema = new Schema<IInventoryItem>(
  {
    itemName: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: [0, 'Quantity cannot be negative'] },
    addedAt: { type: Date, required: true, default: Date.now },
  },
  { _id: false }
);

const ShelfRentalSchema = new Schema<IShelfRental>(
  {
    rentalId: {
      type: String,
      unique: true,
      sparse: true,
    },
    businessOwnerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Business owner is required'],
    },
    agentId: {
      type: Schema.Types.ObjectId,
      ref: 'Agent',
      required: [true, 'Agent is required'],
    },
    shelfNumber: {
      type: String,
      required: [true, 'Shelf number is required'],
      trim: true,
    },
    rentalPeriod: {
      startDate: { type: Date, required: [true, 'Start date is required'] },
      endDate: { type: Date, required: [true, 'End date is required'] },
    },
    pricing: {
      monthlyRate: {
        type: Number,
        required: [true, 'Monthly rate is required'],
        min: [0, 'Monthly rate cannot be negative'],
      },
      totalAmount: {
        type: Number,
        required: [true, 'Total amount is required'],
        min: [0, 'Total amount cannot be negative'],
      },
    },
    paymentStatus: {
      type: String,
      required: true,
      default: 'pending',
      enum: {
        values: ['pending', 'paid', 'overdue'],
        message: '{VALUE} is not a valid payment status',
      },
    },
    paymentId: { type: Schema.Types.ObjectId, ref: 'Payment' },
    inventory: { type: [InventoryItemSchema], default: [] },
    status: {
      type: String,
      required: true,
      default: 'active',
      enum: {
        values: ['active', 'expired', 'cancelled'],
        message: '{VALUE} is not a valid rental status',
      },
    },
  },
  { timestamps: true }
);

// Indexes
ShelfRentalSchema.index({ businessOwnerId: 1, status: 1 });
ShelfRentalSchema.index({ agentId: 1, status: 1 });

// Pre-save hook: auto-generate rentalId in format RNT-YYYYMMDD-XXXXX
ShelfRentalSchema.pre('save', async function (next) {
  if (this.rentalId) return next();

  try {
    const now = new Date();
    const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `RNT-${datePart}-`;

    const count = await mongoose.model('ShelfRental').countDocuments({
      rentalId: { $regex: `^${prefix}` },
    });

    const sequence = String(count + 1).padStart(5, '0');
    this.rentalId = `${prefix}${sequence}`;

    next();
  } catch (error) {
    next(error as Error);
  }
});

export const ShelfRental = mongoose.model<IShelfRental>('ShelfRental', ShelfRentalSchema);
