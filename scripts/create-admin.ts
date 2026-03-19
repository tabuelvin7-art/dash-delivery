/**
 * Creates a specific admin user.
 * Usage: npx ts-node scripts/create-admin.ts
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/nairobi-delivery';

async function main(): Promise<void> {
  await mongoose.connect(MONGODB_URI);

  const email = 'admin@gmail.com';
  const passwordHash = await bcrypt.hash('Admin@123', 12);

  // Use updateOne with upsert to avoid triggering the pre-save double-hash hook
  await mongoose.connection.collection('users').updateOne(
    { email },
    {
      $set: {
        email,
        phoneNumber: '+254700000001',
        passwordHash,
        role: 'admin',
        isPhoneVerified: true,
        isActive: true,
        profile: { firstName: 'Admin', lastName: 'User' },
        updatedAt: new Date(),
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true }
  );

  console.log(`Admin upserted: ${email} / Admin@123`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
