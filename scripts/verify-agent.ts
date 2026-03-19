import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/nairobi-delivery');

  const userId = '69ba82347c976d347b4ec1a9'; // westlands agent user _id
  const agent = await mongoose.connection.collection('agents').findOne({
    userId: new mongoose.Types.ObjectId(userId),
  });
  console.log('Agent found:', agent ? `${agent.locationName} (${agent.agentId})` : 'NOT FOUND');

  if (agent) {
    const pkgs = await mongoose.connection.collection('packages').find({
      $or: [
        { destinationAgentId: agent._id },
        { pickupAgentId: agent._id },
      ],
    }).toArray();
    console.log('Packages for this agent:', pkgs.length);
    pkgs.forEach(p => console.log(' -', p.packageId, p.status));
  }

  await mongoose.disconnect();
}
main().catch(console.error);
