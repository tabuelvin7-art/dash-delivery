import mongoose from 'mongoose';
import { logger } from '../utils/logger';

interface DatabaseConfig {
  uri: string;
  maxPoolSize: number;
  minPoolSize: number;
  connectTimeoutMS: number;
  serverSelectionTimeoutMS: number;
}

const getDatabaseConfig = (): DatabaseConfig => {
  return {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/nairobi-delivery',
    maxPoolSize: parseInt(process.env.MONGODB_MAX_POOL_SIZE || '10', 10),
    minPoolSize: parseInt(process.env.MONGODB_MIN_POOL_SIZE || '2', 10),
    connectTimeoutMS: parseInt(process.env.MONGODB_CONNECT_TIMEOUT_MS || '10000', 10),
    serverSelectionTimeoutMS: parseInt(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS || '5000', 10),
  };
};

/**
 * Connect to MongoDB with retry logic
 * @param retries - Number of retry attempts (default: 5)
 * @param delay - Delay between retries in milliseconds (default: 5000)
 */
export const connectDatabase = async (retries = 5, delay = 5000): Promise<void> => {
  const config = getDatabaseConfig();
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      logger.info(`Attempting to connect to MongoDB (attempt ${attempt}/${retries})...`);
      
      await mongoose.connect(config.uri, {
        maxPoolSize: config.maxPoolSize,
        minPoolSize: config.minPoolSize,
        connectTimeoutMS: config.connectTimeoutMS,
        serverSelectionTimeoutMS: config.serverSelectionTimeoutMS,
      });
      
      logger.info('Successfully connected to MongoDB');
      
      // Set up connection event handlers
      mongoose.connection.on('error', (error) => {
        logger.error('MongoDB connection error:', error);
      });
      
      mongoose.connection.on('disconnected', () => {
        logger.warn('MongoDB disconnected. Attempting to reconnect...');
      });
      
      mongoose.connection.on('reconnected', () => {
        logger.info('MongoDB reconnected successfully');
      });
      
      return;
    } catch (error) {
      logger.error(`MongoDB connection attempt ${attempt} failed:`, error);
      
      if (attempt === retries) {
        logger.error('All MongoDB connection attempts failed. Exiting...');
        throw new Error('Failed to connect to MongoDB after multiple attempts');
      }
      
      logger.info(`Retrying in ${delay / 1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

/**
 * Disconnect from MongoDB gracefully
 */
export const disconnectDatabase = async (): Promise<void> => {
  try {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed successfully');
  } catch (error) {
    logger.error('Error closing MongoDB connection:', error);
    throw error;
  }
};

/**
 * Check if database is connected
 */
export const isDatabaseConnected = (): boolean => {
  return mongoose.connection.readyState === 1;
};
