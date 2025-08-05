/**
 * Enhanced Error Handler
 * Comprehensive error handling with circuit breaker pattern and correlation tracking
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';
import { env } from '../config/env';
import { getCorrelationId } from './correlationId';

// Circuit breaker for external services
class CircuitBreaker {
  private failures: number = 0;
  private lastFailureTime: number = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  
  constructor(
    private threshold: number = 5,
    private timeout: number = 60000 // 1 minute
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.threshold) {
      this.state = 'OPEN';
    }
  }

  getState(): string {
    return this.state;
  }
}

// Global circuit breakers for different services
const circuitBreakers = new Map<string, CircuitBreaker>();

export function getCircuitBreaker(serviceName: string): CircuitBreaker {
  if (!circuitBreakers.has(serviceName)) {
    circuitBreakers.set(serviceName, new CircuitBreaker());
  }
  return circuitBreakers.get(serviceName)!;
}

// Enhanced error types
export class ServiceUnavailableError extends Error {
  constructor(service: string, public readonly retryAfter?: number) {
    super(`Service ${service} is currently unavailable`);
    this.name = 'ServiceUnavailableError';
  }
}

export class TimeoutError extends Error {
  constructor(operation: string, timeout: number) {
    super(`Operation ${operation} timed out after ${timeout}ms`);
    this.name = 'TimeoutError';
  }
}

export class RateLimitExceededError extends Error {
  constructor(public readonly retryAfter: number) {
    super(`Rate limit exceeded. Retry after ${retryAfter} seconds`);
    this.name = 'RateLimitExceededError';
  }
}

// Async operation wrapper with timeout and error handling
export async function withTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  operationName: string = 'operation'
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new TimeoutError(operationName, timeoutMs));
    }, timeoutMs);

    operation()
      .then(result => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch(error => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

// Retry mechanism with exponential backoff
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
  operationName: string = 'operation'
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries) {
        break;
      }

      // Don't retry on certain errors
      if (error instanceof RateLimitExceededError ||
          error instanceof ServiceUnavailableError ||
          (error as any).statusCode === 401 ||
          (error as any).statusCode === 403) {
        break;
      }

      const delay = baseDelay * Math.pow(2, attempt);
      logger.warn(`${operationName} failed, retrying in ${delay}ms`, {
        attempt: attempt + 1,
        maxRetries,
        error: error instanceof Error ? error.message : String(error)
      });

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

// Enhanced error handler middleware
export const enhancedErrorHandler = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const correlationId = getCorrelationId(req);
  const requestId = req.headers['x-request-id'] as string || correlationId;

  // Default error values
  let statusCode = 500;
  let code = 'INTERNAL_SERVER_ERROR';
  let message = 'An unexpected error occurred';
  let details: any = undefined;
  let retryAfter: number | undefined = undefined;

  // Handle specific error types
  if (error instanceof ServiceUnavailableError) {
    statusCode = 503;
    code = 'SERVICE_UNAVAILABLE';
    message = error.message;
    retryAfter = error.retryAfter;
  } else if (error instanceof TimeoutError) {
    statusCode = 504;
    code = 'GATEWAY_TIMEOUT';
    message = error.message;
  } else if (error instanceof RateLimitExceededError) {
    statusCode = 429;
    code = 'RATE_LIMIT_EXCEEDED';
    message = error.message;
    retryAfter = error.retryAfter;
  } else if (error.name === 'ValidationError') {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = error.message;
    details = error.details;
  } else if (error.name === 'UnauthorizedError') {
    statusCode = 401;
    code = 'UNAUTHORIZED';
    message = error.message;
  } else if (error.name === 'ForbiddenError') {
    statusCode = 403;
    code = 'FORBIDDEN';
    message = error.message;
  } else if (error.name === 'NotFoundError') {
    statusCode = 404;
    code = 'NOT_FOUND';
    message = error.message;
  } else if (error.name === 'ConflictError') {
    statusCode = 409;
    code = 'CONFLICT';
    message = error.message;
    details = error.details;
  } else if (error.code === 'ECONNREFUSED') {
    statusCode = 503;
    code = 'SERVICE_UNAVAILABLE';
    message = 'External service unavailable';
  } else if (error.code === 'ETIMEDOUT') {
    statusCode = 504;
    code = 'GATEWAY_TIMEOUT';
    message = 'Request timeout';
  }

  // Create error response
  const errorResponse: any = {
    error: {
      code,
      message,
      timestamp: new Date().toISOString(),
      requestId,
      correlationId
    }
  };

  if (details) {
    errorResponse.error.details = details;
  }

  if (retryAfter) {
    res.setHeader('Retry-After', retryAfter);
    errorResponse.error.retryAfter = retryAfter;
  }

  // Include stack trace in development
  if (env.NODE_ENV === 'development' && error.stack) {
    errorResponse.error.stack = error.stack;
  }

  // Enhanced logging context
  const logContext = {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code,
      statusCode
    },
    request: {
      method: req.method,
      url: req.url,
      headers: {
        'user-agent': req.headers['user-agent'],
        'content-type': req.headers['content-type'],
        'authorization': req.headers.authorization ? '[REDACTED]' : undefined
      },
      body: req.method !== 'GET' ? sanitizeRequestBody(req.body) : undefined,
      params: req.params,
      query: req.query,
      ip: req.ip
    },
    user: (req as any).user ? {
      id: (req as any).user.id,
      tenantId: (req as any).user.tenantId,
      role: (req as any).user.role
    } : undefined,
    requestId,
    correlationId,
    timestamp: new Date().toISOString()
  };

  // Log with appropriate level
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

// Unhandled promise rejection handler
export const handleUnhandledRejection = (reason: any, promise: Promise<any>): void => {
  logger.error('Unhandled Promise Rejection', {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
    promise: promise.toString()
  });

  // In production, we might want to gracefully shutdown
  if (env.NODE_ENV === 'production') {
    process.exit(1);
  }
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

  // Always exit on uncaught exceptions
  process.exit(1);
};

// Graceful shutdown handler
export const setupGracefulShutdown = (server: any): void => {
  const gracefulShutdown = (signal: string) => {
    logger.info(`Received ${signal}, starting graceful shutdown...`);

    server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });

    // Force shutdown after 30 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 30000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
};

// Sanitize request body for logging (remove sensitive data)
function sanitizeRequestBody(body: any): any {
  if (!body || typeof body !== 'object') {
    return body;
  }

  const sensitiveFields = ['password', 'token', 'secret', 'key', 'authorization'];
  const sanitized = { ...body };

  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  }

  return sanitized;
}

// Health check for circuit breakers
export function getCircuitBreakerStatus(): Record<string, string> {
  const status: Record<string, string> = {};
  
  for (const [serviceName, breaker] of circuitBreakers.entries()) {
    status[serviceName] = breaker.getState();
  }
  
  return status;
}