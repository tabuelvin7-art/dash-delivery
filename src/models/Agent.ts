import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IAgent extends Document {
  agentId: string;
  userId: Types.ObjectId;
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
  createdAt: Date;
  updatedAt: Date;
}

const AgentSchema = new Schema<IAgent>(
  {
    agentId: {
      type: String,
      unique: true,
      sparse: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
    },
    locationName: {
      type: String,
      required: [true, 'Location name is required'],
      trim: true,
    },
    address: {
      type: String,
      required: [true, 'Address is required'],
      trim: true,
    },
    neighborhood: {
      type: String,
      required: [true, 'Neighborhood is required'],
      trim: true,
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true,
    },
    coordinates: {
      latitude: {
        type: Number,
        required: [true, 'Latitude is required'],
        min: [-90, 'Latitude must be between -90 and 90'],
        max: [90, 'Latitude must be between -90 and 90'],
      },
      longitude: {
        type: Number,
        required: [true, 'Longitude is required'],
        min: [-180, 'Longitude must be between -180 and 180'],
        max: [180, 'Longitude must be between -180 and 180'],
      },
    },
    contactPhone: {
      type: String,
      required: [true, 'Contact phone is required'],
      trim: true,
    },
    operatingHours: {
      open: { type: String, required: [true, 'Opening time is required'] },
      close: { type: String, required: [true, 'Closing time is required'] },
      daysOfWeek: {
        type: [String],
        required: [true, 'Days of week are required'],
      },
    },
    capacity: {
      totalShelves: {
        type: Number,
        required: [true, 'Total shelves is required'],
        min: [0, 'Total shelves cannot be negative'],
      },
      availableShelves: {
        type: Number,
        required: [true, 'Available shelves is required'],
        min: [0, 'Available shelves cannot be negative'],
      },
    },
    isActive: {
      type: Boolean,
      required: true,
      default: true,
    },
  },
  { timestamps: true }
);

// Indexes
AgentSchema.index({ city: 1, neighborhood: 1, isActive: 1 });
// GeoJSON 2dsphere index — stored as { type: 'Point', coordinates: [lng, lat] }
AgentSchema.index({ 'coordinates.longitude': 1, 'coordinates.latitude': 1 });

// Pre-save hook: auto-generate agentId in format AGT-YYYYMMDD-XXXXX
AgentSchema.pre('save', async function (next) {
  if (this.agentId) return next();

  try {
    const now = new Date();
    const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `AGT-${datePart}-`;

    const count = await mongoose.model('Agent').countDocuments({
      agentId: { $regex: `^${prefix}` },
    });

    const sequence = String(count + 1).padStart(5, '0');
    this.agentId = `${prefix}${sequence}`;

    next();
  } catch (error) {
    next(error as Error);
  }
});

export const Agent = mongoose.model<IAgent>('Agent', AgentSchema);
