import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcrypt';

export interface IUser extends Document {
  email: string;
  phoneNumber: string;
  passwordHash: string;
  role: 'business_owner' | 'customer' | 'agent' | 'admin';
  isPhoneVerified: boolean;
  isActive: boolean;
  profile: {
    firstName: string;
    lastName: string;
    businessName?: string;
    address?: string;
  };
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    phoneNumber: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
      match: [/^\+254\d{9}$/, 'Phone number must be in format +254XXXXXXXXX'],
    },
    passwordHash: {
      type: String,
      required: [true, 'Password is required'],
    },
    role: {
      type: String,
      required: [true, 'Role is required'],
      enum: {
        values: ['business_owner', 'customer', 'agent', 'admin'],
        message: '{VALUE} is not a valid role',
      },
    },
    isPhoneVerified: {
      type: Boolean,
      default: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    profile: {
      firstName: {
        type: String,
        required: [true, 'First name is required'],
        trim: true,
      },
      lastName: {
        type: String,
        required: [true, 'Last name is required'],
        trim: true,
      },
      businessName: {
        type: String,
        trim: true,
      },
      address: {
        type: String,
        trim: true,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ phoneNumber: 1 }, { unique: true });
UserSchema.index({ role: 1, isActive: 1 });

// Pre-save hook for password hashing
UserSchema.pre('save', async function (next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('passwordHash')) {
    return next();
  }

  try {
    // Hash password with 12 salt rounds as specified in requirements
    const salt = await bcrypt.genSalt(12);
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Instance method to compare passwords
UserSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

export const User = mongoose.model<IUser>('User', UserSchema);
