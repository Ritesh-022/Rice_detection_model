import { createServer } from 'node:http';
import process from 'node:process';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { connectDatabase } from './src/config/database.js';
import { env } from './src/config/env.js';
import { startQueueScheduler, hydrateQueue, stopQueueScheduler } from './src/services/analysisQueue.service.js';
import { startCleanupScheduler, stopCleanupScheduler } from './src/services/cleanup.service.js';
import { logError, logInfo } from './src/utils/logger.js';
import routes from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
];

async function bootstrap() {
  await connectDatabase();
  await hydrateQueue();
  startCleanupScheduler();

  const app = express();
  app.disable('x-powered-by');
  app.use(cors({
    origin: (origin, cb) => {
      // Allow requests with no origin (curl, Postman, server-to-server)
      if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      cb(new Error(`CORS: origin ${origin} not allowed`));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Client'],
    credentials: true,
  }));
  app.use(helmet());
  app.use(rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false
  }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use('/api', routes);
  app.use(notFoundHandler);
  app.use(errorHandler);

  const server = createServer(app);

  server.listen(env.PORT, () => {
    logInfo(`Server is running on port ${env.PORT}`, {
      port: env.PORT,
      environment: env.NODE_ENV
    });
  });

  const shutdown = async (signal) => {
    logInfo(`Received ${signal}, shutting down gracefully...`, { signal });
    stopQueueScheduler();
    stopCleanupScheduler();
    server.close(async () => {
      await mongoose.disconnect().catch(() => {});
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  process.on('unhandledRejection', (error) => {
    logError('Unhandled promise rejection', {
      message: error?.message,
      stack: error?.stack
    });
  });
  process.on('uncaughtException', (error) => {
    logError('Uncaught exception', {
      message: error?.message,
      stack: error?.stack
    });
  });

  startQueueScheduler();
}

bootstrap().catch((error) => {
  console.error('Failed to start backend', error);
  process.exit(1);
});
