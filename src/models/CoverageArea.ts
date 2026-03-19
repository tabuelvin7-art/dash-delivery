import mongoose, { Schema, Document } from 'mongoose';

export interface ICoverageArea extends Document {
  areaId: string;
  name: string;
  city: string;
  boundaries: {
    type: 'Polygon';
    coordinates: number[][][];
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CoverageAreaSchema = new Schema<ICoverageArea>(
  {
    areaId: {
      type: String,
      unique: true,
      sparse: true,
    },
    name: {
      type: String,
      required: [true, 'Area name is required'],
      trim: true,
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true,
    },
    boundaries: {
      type: {
        type: String,
        required: true,
        enum: {
          values: ['Polygon'],
          message: 'Boundary type must be Polygon',
        },
      },
      coordinates: {
        type: [[[Number]]],
        required: [true, 'Boundary coordinates are required'],
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
CoverageAreaSchema.index({ boundaries: '2dsphere' });

// Pre-save hook: auto-generate areaId in format AREA-YYYYMMDD-XXXXX
CoverageAreaSchema.pre('save', async function (next) {
  if (this.areaId) return next();

  try {
    const now = new Date();
    const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `AREA-${datePart}-`;

    const count = await mongoose.model('CoverageArea').countDocuments({
      areaId: { $regex: `^${prefix}` },
    });

    const sequence = String(count + 1).padStart(5, '0');
    this.areaId = `${prefix}${sequence}`;

    next();
  } catch (error) {
    next(error as Error);
  }
});

export const CoverageArea = mongoose.model<ICoverageArea>('CoverageArea', CoverageAreaSchema);
