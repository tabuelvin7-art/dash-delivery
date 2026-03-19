import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import morgan from 'morgan';
import { logger } from './utils/logger';
import { connectDatabase, isDatabaseConnected } from './config/database';
import { securityHeaders, authRateLimit, paymentRateLimit, generalRateLimit } from './middleware/security';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { attachRequestId } from './middleware/requestId';
import authRoutes from './routes/auth';
import packageRoutes from './routes/packages';
import paymentRoutes from './routes/payments';
import agentRoutes from './routes/agents';
import shelfRoutes from './routes/shelves';
import userRoutes from './routes/users';
import notificationRoutes from './routes/notifications';
import reportRoutes from './routes/reports';
import { expireRentals, checkExpiringRentals } from './services/shelfRentalService';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// HTTP request logging (18.4 - performance monitoring)
const morganFormat = process.env.NODE_ENV === 'production' ? 'combined' : 'dev';
app.use(morgan(morganFormat, {
  stream: { write: (msg: string) => logger.info(msg.trim()) },
}));

// Attach unique request ID for log correlation (21.2)
app.use(attachRequestId);

// HTTPS enforcement in production (23.3)
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.headers['x-forwarded-proto'] !== 'https') {
      return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
    next();
  });
}

// Middleware
app.use(securityHeaders);
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(generalRateLimit);

// API Routes
app.use('/api/auth', authRateLimit, authRoutes);
app.use('/api/packages', packageRoutes);
app.use('/api/payments', paymentRateLimit, paymentRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/shelves', shelfRoutes);
app.use('/api/users', userRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reports', reportRoutes);

// Health check endpoint
app.get('/health', (_req, res) => {
  const dbConnected = isDatabaseConnected();
  res.status(dbConnected ? 200 : 503).json({ 
    success: dbConnected, 
    message: dbConnected ? 'Server is running' : 'Server is running but database is not connected',
    database: dbConnected ? 'connected' : 'disconnected'
  });
});

// 404 and global error handlers (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

// Initialize database and start server
const startServer = async () => {
  try {
    await connectDatabase();

    // Shelf expiry cron — runs every hour
    const runShelfJobs = async () => {
      try {
        await expireRentals();
        await checkExpiringRentals();
      } catch (err) {
        logger.error('Shelf cron error:', err);
      }
    };
    runShelfJobs(); // run once on startup
    setInterval(runShelfJobs, 60 * 60 * 1000); // then every hour

    app.listen(PORT, () => {
      logger.info(`Server is running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT signal received: closing HTTP server');
  process.exit(0);
});

// Start the server only when run directly (not imported by tests)
if (require.main === module) {
  startServer();
}

export default app;
