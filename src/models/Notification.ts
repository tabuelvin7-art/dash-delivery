import mongoose, { Schema, Document, Types } from 'mongoose';

export interface INotification extends Document {
  userId: Types.ObjectId;
  type:
    | 'package_status'
    | 'payment_prompt'
    | 'payment_received'
    | 'release_code'
    | 'shelf_rental'
    | 'system';
  title: string;
  message: string;
  relatedEntityType?: 'package' | 'payment' | 'shelf_rental';
  relatedEntityId?: Types.ObjectId;
  channels: {
    inApp: {
      sent: boolean;
      readAt?: Date;
    };
    sms: {
      sent: boolean;
      sentAt?: Date;
      deliveryStatus?: 'delivered' | 'failed';
      retryCount: number;
    };
  };
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
    },
    type: {
      type: String,
      required: [true, 'Notification type is required'],
      enum: {
        values: [
          'package_status',
          'payment_prompt',
          'payment_received',
          'release_code',
          'shelf_rental',
          'system',
        ],
        message: '{VALUE} is not a valid notification type',
      },
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
    },
    message: {
      type: String,
      required: [true, 'Message is required'],
      trim: true,
    },
    relatedEntityType: {
      type: String,
      enum: {
        values: ['package', 'payment', 'shelf_rental'],
        message: '{VALUE} is not a valid entity type',
      },
    },
    relatedEntityId: { type: Schema.Types.ObjectId },
    channels: {
      inApp: {
        sent: { type: Boolean, required: true, default: false },
        readAt: { type: Date },
      },
      sms: {
        sent: { type: Boolean, required: true, default: false },
        sentAt: { type: Date },
        deliveryStatus: {
          type: String,
          enum: {
            values: ['delivered', 'failed'],
            message: '{VALUE} is not a valid delivery status',
          },
        },
        retryCount: { type: Number, required: true, default: 0 },
      },
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Indexes
NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({
  userId: 1,
  'channels.inApp.sent': 1,
  'channels.inApp.readAt': 1,
});

export const Notification = mongoose.model<INotification>('Notification', NotificationSchema);
