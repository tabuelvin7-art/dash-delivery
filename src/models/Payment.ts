import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IPayment extends Document {
  transactionId: string;
  packageId: Types.ObjectId | null;
  paymentType: 'delivery_fee' | 'item_price' | 'shelf_rental';
  amount: number;
  payerId: Types.ObjectId;
  payeeId: Types.ObjectId;
  mpesaRequestId?: string;
  mpesaReceiptNumber?: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  failureReason?: string;
  initiatedAt: Date;
  completedAt?: Date;
  metadata: {
    ipAddress?: string;
    userAgent?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    transactionId: {
      type: String,
      unique: true,
      sparse: true,
    },
    packageId: {
      type: Schema.Types.ObjectId,
      ref: 'Package',
      required: false,
    },
    paymentType: {
      type: String,
      required: [true, 'Payment type is required'],
      enum: {
        values: ['delivery_fee', 'item_price', 'shelf_rental'],
        message: '{VALUE} is not a valid payment type',
      },
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0, 'Amount cannot be negative'],
    },
    payerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Payer is required'],
    },
    payeeId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Payee is required'],
    },
    mpesaRequestId: { type: String },
    mpesaReceiptNumber: { type: String },
    status: {
      type: String,
      required: true,
      default: 'pending',
      enum: {
        values: ['pending', 'completed', 'failed', 'refunded'],
        message: '{VALUE} is not a valid payment status',
      },
    },
    failureReason: { type: String },
    initiatedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    completedAt: { type: Date },
    metadata: {
      ipAddress: { type: String },
      userAgent: { type: String },
    },
  },
  { timestamps: true }
);

// Indexes
PaymentSchema.index({ packageId: 1 });
PaymentSchema.index({ payerId: 1, createdAt: -1 });
PaymentSchema.index({ status: 1 });

// Pre-save hook: auto-generate transactionId in format TXN-YYYYMMDD-XXXXX
PaymentSchema.pre('save', async function (next) {
  if (this.transactionId) return next();

  try {
    const now = new Date();
    const datePart = now.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
    const prefix = `TXN-${datePart}-`;

    const count = await mongoose.model('Payment').countDocuments({
      transactionId: { $regex: `^${prefix}` },
    });

    const sequence = String(count + 1).padStart(5, '0');
    this.transactionId = `${prefix}${sequence}`;

    next();
  } catch (error) {
    next(error as Error);
  }
});

export const Payment = mongoose.model<IPayment>('Payment', PaymentSchema);
