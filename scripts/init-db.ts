/**
 * Database initialization script.
 * Creates indexes and seeds initial data (admin user, coverage areas).
 * Task 24.4: Requirements 11.1, 12.1, 18.1
 *
 * Usage: npx ts-node scripts/init-db.ts
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import { User } from '../src/models/User';
import { CoverageArea } from '../src/models/CoverageArea';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/nairobi-delivery';

async function seedAdmin(): Promise<void> {
  const existing = await User.findOne({ role: 'admin' });
  if (existing) {
    console.log('Admin user already exists, skipping.');
    return;
  }
  const passwordHash = await bcrypt.hash('Admin@123!', 12);
  await User.create({
    email: 'admin@nairobi-delivery.com',
    phoneNumber: '+254700000000',
    passwordHash,
    role: 'admin',
    isPhoneVerified: true,
    isActive: true,
    profile: { firstName: 'System', lastName: 'Admin' },
  });
  console.log('Admin user created: admin@nairobi-delivery.com / Admin@123!');
  console.log('IMPORTANT: Change the admin password immediately after first login.');
}

async function seedCoverageAreas(): Promise<void> {
  const count = await CoverageArea.countDocuments();
  if (count > 0) {
    console.log(`${count} coverage areas already exist, skipping.`);
    return;
  }

  const areas = [
    {
      name: 'Westlands',
      city: 'Nairobi',
      boundaries: {
        type: 'Polygon' as const,
        coordinates: [[[36.78, -1.26], [36.82, -1.26], [36.82, -1.29], [36.78, -1.29], [36.78, -1.26]]],
      },
      isActive: true,
    },
    {
      name: 'CBD',
      city: 'Nairobi',
      boundaries: {
        type: 'Polygon' as const,
        coordinates: [[[36.81, -1.28], [36.83, -1.28], [36.83, -1.30], [36.81, -1.30], [36.81, -1.28]]],
      },
      isActive: true,
    },
    {
      name: 'Kilimani',
      city: 'Nairobi',
      boundaries: {
        type: 'Polygon' as const,
        coordinates: [[[36.77, -1.28], [36.80, -1.28], [36.80, -1.31], [36.77, -1.31], [36.77, -1.28]]],
      },
      isActive: true,
    },
  ];

  await CoverageArea.insertMany(areas);
  console.log(`Seeded ${areas.length} coverage areas.`);
}

async function main(): Promise<void> {
  console.log('Connecting to database...');
  await mongoose.connect(MONGODB_URI);
  console.log('Connected.');

  await seedAdmin();
  await seedCoverageAreas();

  await mongoose.disconnect();
  console.log('Database initialization complete.');
}

main().catch((err) => {
  console.error('Init script failed:', err);
  process.exit(1);
});
