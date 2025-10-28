import pino from 'pino';
import { getEnv } from '../config/env.js';

let logger: pino.Logger;

export const createLogger = (): pino.Logger => {
  const env = getEnv();

  logger = pino({
    level: env.LOG_LEVEL,
    transport: env.LOG_PRETTY && env.NODE_ENV !== 'production'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            ignore: 'pid,hostname',
            translateTime: 'SYS:standard',
          },
        }
      : undefined,
    base: {
      env: env.NODE_ENV,
    },
  });

  return logger;
};

export const getLogger = (): pino.Logger => {
  if (!logger) {
    throw new Error('Logger not initialized. Call createLogger() first.');
  }
  return logger;
};

