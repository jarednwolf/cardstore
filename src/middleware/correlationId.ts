import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../config/logger';

export interface RequestWithCorrelation extends Request {
  correlationId: string;
  requestId: string;
  startTime: number;
}

/**
 * Middleware to ensure every request has a correlation ID for tracing
 */
export function correlationIdMiddleware() {
  return (req: RequestWithCorrelation, res: Response, next: NextFunction): void => {
    // Generate or use existing correlation ID
    req.correlationId = (
      req.headers['x-correlation-id'] as string ||
      req.headers['x-request-id'] as string ||
      uuidv4()
    );

    // Also set requestId for backward compatibility
    req.requestId = req.correlationId;
    req.startTime = Date.now();

    // Set correlation ID in response headers for client tracking
    res.setHeader('X-Correlation-ID', req.correlationId);
    res.setHeader('X-Request-ID', req.correlationId);

    // Add correlation ID to all log entries for this request
    const originalLogger = logger;
    (req as any).logger = {
      error: (message: string, meta?: any) => originalLogger.error(message, { ...meta, correlationId: req.correlationId }),
      warn: (message: string, meta?: any) => originalLogger.warn(message, { ...meta, correlationId: req.correlationId }),
      info: (message: string, meta?: any) => originalLogger.info(message, { ...meta, correlationId: req.correlationId }),
      debug: (message: string, meta?: any) => originalLogger.debug(message, { ...meta, correlationId: req.correlationId }),
    };

    // Log incoming request with correlation ID
    logger.info('Request started', {
      correlationId: req.correlationId,
      method: req.method,
      url: req.url,
      userAgent: req.get('User-Agent'),
      ip: getClientIpAddress(req),
      contentLength: req.get('Content-Length'),
      timestamp: new Date().toISOString()
    });

    // Override res.end to log completion with correlation ID
    const originalEnd = res.end;
    res.end = function(chunk?: any, encoding?: any, cb?: any): Response {
      const duration = Date.now() - req.startTime;
      
      logger.info('Request completed', {
        correlationId: req.correlationId,
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        contentLength: res.get('Content-Length'),
        timestamp: new Date().toISOString()
      });

      // Call original end method
      return originalEnd.call(this, chunk, encoding, cb) as Response;
    };

    next();
  };
}

/**
 * Get correlation ID from request
 */
export function getCorrelationId(req: Request): string {
  return (req as RequestWithCorrelation).correlationId || 'unknown';
}

/**
 * Create a child correlation ID for sub-operations
 */
export function createChildCorrelationId(parentId: string, operation: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 4);
  return `${parentId}-${operation}-${timestamp}-${random}`;
}

/**
 * Middleware to add correlation ID to error responses
 */
export function correlationErrorMiddleware() {
  return (error: any, req: RequestWithCorrelation, res: Response, next: NextFunction): void => {
    // Ensure correlation ID is in error response
    if (req.correlationId) {
      res.setHeader('X-Correlation-ID', req.correlationId);
      
      // Add correlation ID to error response body
      if (error && typeof error === 'object') {
        error.correlationId = req.correlationId;
      }
    }

    next(error);
  };
}

/**
 * Extract client IP address from request
 */
function getClientIpAddress(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'] as string;
  const realIp = req.headers['x-real-ip'] as string;
  const connectionRemote = req.connection?.remoteAddress;
  const socketRemote = (req.socket as any)?.remoteAddress;
  
  const ipAddress = forwarded || realIp || connectionRemote || socketRemote || 'unknown';
  return ipAddress.split(',')[0].trim();
}

/**
 * Utility to propagate correlation ID to external service calls
 */
export function getCorrelationHeaders(req: Request): Record<string, string> {
  const correlationId = getCorrelationId(req);
  return {
    'X-Correlation-ID': correlationId,
    'X-Request-ID': correlationId
  };
}

/**
 * Enhanced logger that automatically includes correlation ID
 */
export class CorrelationLogger {
  constructor(private correlationId: string) {}

  error(message: string, meta?: any): void {
    logger.error(message, { ...meta, correlationId: this.correlationId });
  }

  warn(message: string, meta?: any): void {
    logger.warn(message, { ...meta, correlationId: this.correlationId });
  }

  info(message: string, meta?: any): void {
    logger.info(message, { ...meta, correlationId: this.correlationId });
  }

  debug(message: string, meta?: any): void {
    logger.debug(message, { ...meta, correlationId: this.correlationId });
  }

  static fromRequest(req: Request): CorrelationLogger {
    return new CorrelationLogger(getCorrelationId(req));
  }
}

/**
 * Async context for correlation ID (for use in async operations)
 */
export class CorrelationContext {
  private static current: string | null = null;

  static set(correlationId: string): void {
    this.current = correlationId;
  }

  static get(): string | null {
    return this.current;
  }

  static clear(): void {
    this.current = null;
  }

  static run<T>(correlationId: string, fn: () => T): T {
    const previous = this.current;
    this.current = correlationId;
    try {
      return fn();
    } finally {
      this.current = previous;
    }
  }

  static async runAsync<T>(correlationId: string, fn: () => Promise<T>): Promise<T> {
    const previous = this.current;
    this.current = correlationId;
    try {
      return await fn();
    } finally {
      this.current = previous;
    }
  }
}