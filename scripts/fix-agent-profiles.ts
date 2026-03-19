/**
 * Patches agent user documents that are missing profile.firstName / profile.lastName.
 * Usage: npx ts-node scripts/fix-agent-profiles.ts
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/nairobi-delivery';

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected.');

  const users = mongoose.connection.collection('users');

  // Find all agent users missing a profile or missing firstName
  const broken = await users.find({
    role: 'agent',
    $or: [
      { profile: { $exists: false } },
      { 'profile.firstName': { $exists: false } },
      { 'profile.firstName': '' },
    ],
  }).toArray();

  console.log(`Found ${broken.length} agent(s) with missing profile fields.`);

  for (const u of broken) {
    // Derive a name from the email prefix, e.g. "agent.westlands@gmail.com" → "Agent Westlands"
    const emailPrefix = (u.email as string).split('@')[0]; // e.g. "agent.westlands"
    const parts = emailPrefix.split('.').filter((p: string) => p.toLowerCase() !== 'agent');
    const firstName = parts.length > 0
      ? parts[0].charAt(0).toUpperCase() + parts[0].slice(1)
      : 'Agent';
    const lastName = parts.length > 1
      ? parts[1].charAt(0).toUpperCase() + parts[1].slice(1)
      : 'User';

    await users.updateOne(
      { _id: u._id },
      { $set: { 'profile.firstName': firstName, 'profile.lastName': lastName, updatedAt: new Date() } }
    );
    console.log(`  Fixed: ${u.email} → ${firstName} ${lastName}`);
  }

  console.log('Done.');
  await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
