import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { config } from 'dotenv';
import portfolioRoutes from './routes/portfolioRoutes.js';
import assetRoutes from './routes/assetRoutes.js';
import transactionRoutes from './routes/transactionRoutes.js';
import importRoutes from './routes/importRoutes.js';
import systemRoutes from './routes/systemRoutes.js';
import backupRoutes from './routes/backupRoutes.js';
import { ensureGlobalPortfolio } from './services/importService.js';
import { loadEnv, getEnv } from './config/env.js';
import { createLogger, getLogger } from './utils/logger.js';
import { createApiLimiter } from './middleware/rateLimiter.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { initializeRedis, closeRedis } from './utils/cache.js';

// Load .env file FIRST
config();

// Load and validate environment variables
loadEnv();
const env = getEnv();

// Initialize logger
createLogger();
const logger = getLogger();

// Initialize Redis cache
initializeRedis();

const app = express();

app.use(cors({
  origin: env.CORS_ORIGIN,
  credentials: true,
}));
app.use(express.json({ limit: env.MAX_UPLOAD_SIZE }));
app.use(morgan('dev', {
  stream: {
    write: (message) => logger.info(message.trim()),
  },
}));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Apply rate limiting to all API routes
const apiLimiter = createApiLimiter();
app.use('/api', apiLimiter);

app.use('/api/portfolios', portfolioRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/import', importRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/backup', backupRoutes);

// 404 handler for unknown routes
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

app.listen(env.PORT, async () => {
  await ensureGlobalPortfolio();
  logger.info({ port: env.PORT, env: env.NODE_ENV, cors: env.CORS_ORIGIN }, 'API portefeuille démarrée');
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await closeRedis();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await closeRedis();
  process.exit(0);
});
