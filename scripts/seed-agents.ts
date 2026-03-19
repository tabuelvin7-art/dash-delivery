/**
 * Seeds sample agent users and their agent profiles.
 * Usage: npx ts-node scripts/seed-agents.ts
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import { User } from '../src/models/User';
import { Agent } from '../src/models/Agent';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/nairobi-delivery';

const AGENTS = [
  {
    user: {
      email: 'agent.westlands@gmail.com',
      phoneNumber: '+254711000001',
      profile: { firstName: 'James', lastName: 'Mwangi' },
    },
    agent: {
      locationName: 'Westlands Hub',
      address: 'Westlands Road, Nairobi',
      neighborhood: 'Westlands',
      city: 'Nairobi',
      coordinates: { latitude: -1.2676, longitude: 36.8031 },
      contactPhone: '+254711000001',
      operatingHours: { open: '08:00', close: '20:00', daysOfWeek: ['Mon','Tue','Wed','Thu','Fri','Sat'] },
      capacity: { totalShelves: 20, availableShelves: 20 },
    },
  },
  {
    user: {
      email: 'agent.cbd@gmail.com',
      phoneNumber: '+254711000002',
      profile: { firstName: 'Grace', lastName: 'Otieno' },
    },
    agent: {
      locationName: 'CBD Pickup Point',
      address: 'Moi Avenue, Nairobi CBD',
      neighborhood: 'CBD',
      city: 'Nairobi',
      coordinates: { latitude: -1.2864, longitude: 36.8172 },
      contactPhone: '+254711000002',
      operatingHours: { open: '07:00', close: '21:00', daysOfWeek: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'] },
      capacity: { totalShelves: 30, availableShelves: 30 },
    },
  },
  {
    user: {
      email: 'agent.kilimani@gmail.com',
      phoneNumber: '+254711000003',
      profile: { firstName: 'Brian', lastName: 'Kamau' },
    },
    agent: {
      locationName: 'Kilimani Drop-off',
      address: 'Argwings Kodhek Road, Kilimani',
      neighborhood: 'Kilimani',
      city: 'Nairobi',
      coordinates: { latitude: -1.2921, longitude: 36.7873 },
      contactPhone: '+254711000003',
      operatingHours: { open: '08:00', close: '19:00', daysOfWeek: ['Mon','Tue','Wed','Thu','Fri','Sat'] },
      capacity: { totalShelves: 15, availableShelves: 15 },
    },
  },
  {
    user: {
      email: 'agent.karen@gmail.com',
      phoneNumber: '+254711000004',
      profile: { firstName: 'Amina', lastName: 'Hassan' },
    },
    agent: {
      locationName: 'Karen Station',
      address: 'Karen Road, Karen',
      neighborhood: 'Karen',
      city: 'Nairobi',
      coordinates: { latitude: -1.3197, longitude: 36.7128 },
      contactPhone: '+254711000004',
      operatingHours: { open: '09:00', close: '18:00', daysOfWeek: ['Mon','Tue','Wed','Thu','Fri'] },
      capacity: { totalShelves: 10, availableShelves: 10 },
    },
  },
  {
    user: {
      email: 'agent.eastleigh@gmail.com',
      phoneNumber: '+254711000005',
      profile: { firstName: 'Mohamed', lastName: 'Ali' },
    },
    agent: {
      locationName: 'Eastleigh Express',
      address: '1st Avenue, Eastleigh',
      neighborhood: 'Eastleigh',
      city: 'Nairobi',
      coordinates: { latitude: -1.2741, longitude: 36.8508 },
      contactPhone: '+254711000005',
      operatingHours: { open: '07:00', close: '22:00', daysOfWeek: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'] },
      capacity: { totalShelves: 25, availableShelves: 25 },
    },
  },
];

async function main(): Promise<void> {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to database.');

  const passwordHash = await bcrypt.hash('Agent@123', 12);
  let created = 0;
  let skipped = 0;

  for (const { user: userData, agent: agentData } of AGENTS) {
    const existing = await User.findOne({ email: userData.email });
    if (existing) {
      console.log(`Skipping ${userData.email} — already exists.`);
      skipped++;
      continue;
    }

    // Insert user directly to avoid pre-save double-hash
    const userResult = await mongoose.connection.collection('users').insertOne({
      email: userData.email,
      phoneNumber: userData.phoneNumber,
      passwordHash,
      role: 'agent',
      isPhoneVerified: true,
      isActive: true,
      profile: userData.profile,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await Agent.create({
      userId: userResult.insertedId,
      ...agentData,
    });

    console.log(`Created agent: ${userData.email} / Agent@123 — ${agentData.locationName}`);
    created++;
  }

  console.log(`\nDone. Created: ${created}, Skipped: ${skipped}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
