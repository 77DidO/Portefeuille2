import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors.js';
import { getEnv } from '../config/env.js';
import { getLogger } from '../utils/logger.js';

interface ErrorResponse {
  message: string;
  statusCode: number;
  stack?: string;
  errors?: unknown;
}

export const errorHandler = (
  err: Error | AppError | ZodError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const env = getEnv();
  const logger = getLogger();
  
  let statusCode = 500;
  let message = 'Internal server error';
  let errors: unknown = undefined;

  // Handle custom AppError
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    
    logger.warn({
      err,
      statusCode,
      path: req.path,
      method: req.method,
      ip: req.ip,
    }, 'Application error');
  }
  // Handle Zod validation errors
  else if (err instanceof ZodError) {
    statusCode = 400;
    message = 'Validation error';
    errors = err.errors;
    
    logger.warn({
      errors: err.errors,
      path: req.path,
      method: req.method,
    }, 'Validation error');
  }
  // Handle Prisma errors
  else if (err.name === 'PrismaClientKnownRequestError') {
    statusCode = 400;
    message = 'Database operation failed';
    
    logger.error({
      err,
      path: req.path,
      method: req.method,
    }, 'Prisma error');
  }
  // Handle generic errors
  else {
    logger.error({
      err,
      path: req.path,
      method: req.method,
      ip: req.ip,
    }, 'Unexpected error');
  }

  const response: ErrorResponse = {
    message: env.NODE_ENV === 'production' && statusCode === 500 ? 'Internal server error' : message,
    statusCode,
  };

  // Include stack trace only in development
  if (env.NODE_ENV !== 'production') {
    response.stack = err.stack;
  }

  // Include validation errors
  if (errors) {
    response.errors = errors;
  }

  res.status(statusCode).json(response);
};

// Handle async route errors
export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// 404 handler
export const notFoundHandler = (req: Request, res: Response): void => {
  const logger = getLogger();
  logger.warn({ path: req.path, method: req.method }, 'Route not found');
  res.status(404).json({
    message: 'Route not found',
    statusCode: 404,
    path: req.path,
  });
};
