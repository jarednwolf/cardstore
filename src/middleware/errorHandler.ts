import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';
import { APIError } from '../types';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  details?: Record<string, any>;
}

export class ValidationError extends Error {
  public statusCode = 400;
  public code = 'VALIDATION_ERROR';
  public details: Record<string, any>;

  constructor(message: string, details: Record<string, any> = {}) {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
  }
}

export class NotFoundError extends Error {
  public statusCode = 404;
  public code = 'NOT_FOUND';

  constructor(message: string = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends Error {
  public statusCode = 401;
  public code = 'UNAUTHORIZED';

  constructor(message: string = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends Error {
  public statusCode = 403;
  public code = 'FORBIDDEN';

  constructor(message: string = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class ConflictError extends Error {
  public statusCode = 409;
  public code = 'CONFLICT';

  constructor(message: string = 'Conflict') {
    super(message);
    this.name = 'ConflictError';
  }
}

export class InternalServerError extends Error {
  public statusCode = 500;
  public code = 'INTERNAL_SERVER_ERROR';

  constructor(message: string = 'Internal server error') {
    super(message);
    this.name = 'InternalServerError';
  }
}

export const errorHandler = (
  error: AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const requestId = req.headers['x-request-id'] as string || 'unknown';
  const statusCode = error.statusCode || 500;
  const code = error.code || 'INTERNAL_SERVER_ERROR';

  // Log error details
  logger.error('Request error', {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code,
      statusCode,
      details: (error as any).details,
    },
    request: {
      id: requestId,
      method: req.method,
      url: req.url,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      userId: (req as any).user?.id,
      tenantId: (req as any).tenantId,
    },
  });

  // Prepare error response
  const errorResponse: APIError = {
    error: {
      code,
      message: error.message,
      timestamp: new Date().toISOString(),
      requestId,
    },
  };

  // Add details for validation errors
  if (error instanceof ValidationError) {
    errorResponse.error.details = error.details;
  }

  // Don't expose internal error details in production
  if (statusCode === 500 && process.env.NODE_ENV === 'production') {
    errorResponse.error.message = 'Internal server error';
  }

  res.status(statusCode).json(errorResponse);
};

// Async error wrapper
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};