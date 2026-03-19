import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/nairobi-delivery');
  const agents = await mongoose.connection.collection('agents').find({}).toArray();
  const packages = await mongoose.connection.collection('packages').find({}).toArray();
  const agentUsers = await mongoose.connection.collection('users').find({ role: 'agent' }).toArray();

  console.log('\n=== Agent Users ===');
  agentUsers.forEach(u => console.log(' -', u.email, '| userId:', u._id.toString()));

  console.log('\n=== Agent Profiles ===');
  agents.forEach(a => console.log(' -', a.locationName, '| agentId:', a.agentId, '| _id:', a._id.toString(), '| userId:', a.userId?.toString()));

  console.log('\n=== Packages ===', packages.length, 'total');
  packages.forEach(p => console.log(' -', p.packageId, '| status:', p.status, '| destAgent:', p.destinationAgentId?.toString(), '| pickupAgent:', p.pickupAgentId?.toString()));

  await mongoose.disconnect();
}
main().catch(console.error);
