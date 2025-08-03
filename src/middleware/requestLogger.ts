import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../config/logger';

export interface RequestWithContext extends Request {
  requestId: string;
  startTime: number;
}

export const requestLogger = (
  req: RequestWithContext,
  res: Response,
  next: NextFunction
): void => {
  // Generate unique request ID
  req.requestId = req.headers['x-request-id'] as string || uuidv4();
  req.startTime = Date.now();

  // Set request ID in response headers
  res.setHeader('X-Request-ID', req.requestId);

  // Log incoming request
  logger.info('Incoming request', {
    requestId: req.requestId,
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    contentLength: req.get('Content-Length'),
  });

  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(this: any, chunk?: any, encoding?: any, cb?: any): any {
    const duration = Date.now() - req.startTime;
    
    logger.info('Request completed', {
      requestId: req.requestId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      contentLength: res.get('Content-Length'),
    });

    // Call original end method
    return originalEnd.call(this, chunk, encoding, cb);
  } as any;

  next();
};