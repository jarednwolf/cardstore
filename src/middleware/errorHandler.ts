import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';
import { env } from '../config/env';

// Custom error classes
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code?: string | undefined;
  public readonly details?: any;

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    code?: string,
    details?: any
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.code = code || undefined;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 400, true, 'VALIDATION_ERROR', details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401, true, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 403, true, 'FORBIDDEN');
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404, true, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 409, true, 'CONFLICT', details);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message: string = 'Too many requests') {
    super(message, 429, true, 'TOO_MANY_REQUESTS');
  }
}

export class InternalServerError extends AppError {
  constructor(message: string = 'Internal server error', details?: any) {
    super(message, 500, true, 'INTERNAL_SERVER_ERROR', details);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message: string = 'Service unavailable') {
    super(message, 503, true, 'SERVICE_UNAVAILABLE');
  }
}

// Error response interface
interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
    requestId: string;
    stack?: string | undefined;
  };
}

// Generate unique request ID
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Enhanced error handler middleware
export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const requestId = req.headers['x-request-id'] as string || generateRequestId();
  const correlationId = req.headers['x-correlation-id'] as string || requestId;

  // Default error values
  let statusCode = 500;
  let code = 'INTERNAL_SERVER_ERROR';
  let message = 'An unexpected error occurred';
  let details: any = undefined;
  let isOperational = false;

  // Handle known error types
  if (error instanceof AppError) {
    statusCode = error.statusCode;
    code = error.code || 'APP_ERROR';
    message = error.message;
    details = error.details;
    isOperational = error.isOperational;
  } else if (error.name === 'ValidationError') {
    // Mongoose/Joi validation errors
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = error.message;
  } else if (error.name === 'CastError') {
    // MongoDB cast errors
    statusCode = 400;
    code = 'INVALID_ID';
    message = 'Invalid ID format';
  } else if (error.name === 'MongoError' && (error as any).code === 11000) {
    // MongoDB duplicate key error
    statusCode = 409;
    code = 'DUPLICATE_RESOURCE';
    message = 'Resource already exists';
  } else if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    code = 'INVALID_TOKEN';
    message = 'Invalid authentication token';
  } else if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    code = 'TOKEN_EXPIRED';
    message = 'Authentication token has expired';
  } else if (error.name === 'PrismaClientKnownRequestError') {
    // Prisma known errors
    const prismaError = error as any;
    switch (prismaError.code) {
      case 'P2002':
        statusCode = 409;
        code = 'UNIQUE_CONSTRAINT_VIOLATION';
        message = 'A record with this data already exists';
        details = { field: prismaError.meta?.target };
        break;
      case 'P2025':
        statusCode = 404;
        code = 'RECORD_NOT_FOUND';
        message = 'The requested record was not found';
        break;
      case 'P2003':
        statusCode = 400;
        code = 'FOREIGN_KEY_CONSTRAINT';
        message = 'Foreign key constraint failed';
        break;
      default:
        statusCode = 400;
        code = 'DATABASE_ERROR';
        message = 'Database operation failed';
    }
  } else if (error.name === 'PrismaClientValidationError') {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'Invalid data provided';
  }

  // Create error response
  const errorResponse: ErrorResponse = {
    error: {
      code,
      message,
      details,
      timestamp: new Date().toISOString(),
      requestId
    }
  };

  // Include stack trace in development
  if (env.NODE_ENV === 'development' && error.stack) {
    errorResponse.error.stack = error.stack;
  }

  // Log error with appropriate level
  const logContext = {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code,
      statusCode,
      isOperational
    },
    request: {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.method !== 'GET' ? req.body : undefined,
      params: req.params,
      query: req.query,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    },
    user: (req as any).user ? {
      id: (req as any).user.id,
      tenantId: (req as any).user.tenantId,
      role: (req as any).user.role
    } : undefined,
    requestId,
    correlationId
  };

  if (statusCode >= 500) {
    logger.error('Server error occurred', logContext);
  } else if (statusCode >= 400) {
    logger.warn('Client error occurred', logContext);
  } else {
    logger.info('Request completed with error', logContext);
  }

  // Send error response
  res.status(statusCode).json(errorResponse);
};

// Async error wrapper
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Not found handler
export const notFoundHandler = (req: Request, res: Response, next: NextFunction): void => {
  const error = new NotFoundError(`Route ${req.method} ${req.path} not found`);
  next(error);
};

// Unhandled promise rejection handler
export const handleUnhandledRejection = (reason: any, promise: Promise<any>): void => {
  logger.error('Unhandled Promise Rejection', {
    reason: reason?.message || reason,
    stack: reason?.stack,
    promise: promise.toString()
  });

  // Graceful shutdown
  process.exit(1);
};

// Uncaught exception handler
export const handleUncaughtException = (error: Error): void => {
  logger.error('Uncaught Exception', {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack
    }
  });

  // Graceful shutdown
  process.exit(1);
};

// Health check error
export class HealthCheckError extends AppError {
  constructor(service: string, details?: any) {
    super(`Health check failed for ${service}`, 503, true, 'HEALTH_CHECK_FAILED', details);
  }
}

// Rate limiting error
export class RateLimitError extends AppError {
  constructor(limit: number, windowMs: number) {
    super(
      `Rate limit exceeded. Maximum ${limit} requests per ${windowMs / 1000} seconds`,
      429,
      true,
      'RATE_LIMIT_EXCEEDED',
      { limit, windowMs }
    );
  }
}

// Business logic errors
export class InsufficientInventoryError extends AppError {
  constructor(variantId: string, requested: number, available: number) {
    super(
      `Insufficient inventory for variant ${variantId}. Requested: ${requested}, Available: ${available}`,
      400,
      true,
      'INSUFFICIENT_INVENTORY',
      { variantId, requested, available }
    );
  }
}

export class OrderProcessingError extends AppError {
  constructor(orderId: string, reason: string, details?: any) {
    super(
      `Order processing failed for order ${orderId}: ${reason}`,
      400,
      true,
      'ORDER_PROCESSING_FAILED',
      { orderId, reason, ...details }
    );
  }
}

export class PaymentError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 402, true, 'PAYMENT_ERROR', details);
  }
}

export class SubscriptionError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 402, true, 'SUBSCRIPTION_ERROR', details);
  }
}

// Export all error types for easy importing
export {
  AppError as BaseError
};