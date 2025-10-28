import rateLimit from 'express-rate-limit';
import { getEnv } from '../config/env.js';
import { getLogger } from '../utils/logger.js';

// General rate limiter for all API routes
export const createApiLimiter = () => {
  const env = getEnv();
  
  return rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX_REQUESTS,
    message: {
      message: 'Too many requests from this IP, please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
      try {
        const logger = getLogger();
        logger.warn('Rate limit exceeded');
      } catch {
        // Logger not ready, skip logging
      }
      res.status(429).json({
        message: 'Too many requests from this IP, please try again later.',
      });
    },
  });
};

// Strict limiter for write operations (import, create, update, delete)
export const createStrictLimiter = () => {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // Limit each IP to 20 write requests per windowMs
    message: {
      message: 'Too many write operations from this IP, please slow down.',
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    handler: (_req, res) => {
      try {
        const logger = getLogger();
        logger.warn('Strict rate limit exceeded for write operations');
      } catch {
        // Logger not ready, skip logging
      }
      res.status(429).json({
        message: 'Too many write operations from this IP, please slow down.',
      });
    },
  });
};

// Very strict limiter for sensitive operations (reset data, bulk operations)
export const createCriticalLimiter = () => {
  return rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // Limit each IP to 5 critical operations per hour
    message: {
      message: 'Too many critical operations from this IP, please wait.',
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
      try {
        const logger = getLogger();
        logger.error('Critical rate limit exceeded');
      } catch {
        // Logger not ready, skip logging
      }
      res.status(429).json({
        message: 'Too many critical operations from this IP, please wait.',
      });
    },
  });
};
