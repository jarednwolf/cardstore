import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { logger } from '../config/logger';
import { getCorrelationId } from './correlationId';

const prisma = new PrismaClient();

export interface ApiCallLog {
  id: string;
  tenantId: string;
  userId?: string;
  method: string;
  endpoint: string;
  statusCode: number;
  responseTime: number;
  userAgent?: string;
  ipAddress?: string;
  correlationId?: string;
  createdAt: Date;
}

export interface ApiUsageStats {
  totalCalls: number;
  callsThisMonth: number;
  callsToday: number;
  averageResponseTime: number;
  errorRate: number;
  topEndpoints: Array<{
    endpoint: string;
    count: number;
    averageResponseTime: number;
  }>;
}

/**
 * Middleware to track API calls for billing and analytics
 */
export function apiTrackingMiddleware() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    
    // Extract tenant and user info from request
    const tenantId = (req as any).tenantId || req.headers['x-tenant-id'] as string;
    const userId = (req as any).userId || req.headers['x-user-id'] as string;
    const correlationId = getCorrelationId(req);
    
    // Skip tracking for health checks and internal endpoints
    if (shouldSkipTracking(req.path)) {
      return next();
    }

    // Override res.end to capture response details
    const originalEnd = res.end;
    res.end = function(chunk?: any, encoding?: any, cb?: () => void): Response {
      const responseTime = Date.now() - startTime;
      
      // Log the API call asynchronously to avoid blocking the response
      setImmediate(async () => {
        try {
          await logApiCall({
            tenantId,
            userId,
            method: req.method,
            endpoint: normalizeEndpoint(req.path),
            statusCode: res.statusCode,
            responseTime,
            userAgent: req.headers['user-agent'] || undefined,
            ipAddress: getClientIpAddress(req),
            correlationId
          });
        } catch (error) {
          logger.error('Failed to log API call', {
            error: error instanceof Error ? error.message : 'Unknown error',
            tenantId,
            endpoint: req.path,
            correlationId
          });
        }
      });

      // Call the original end method with proper typing
      return originalEnd.call(this, chunk, encoding, cb) as Response;
    };

    // Correlation ID is already set by correlationIdMiddleware
    
    next();
  };
}

/**
 * Log an API call to the database
 */
async function logApiCall(data: {
  tenantId?: string;
  userId?: string;
  method: string;
  endpoint: string;
  statusCode: number;
  responseTime: number;
  userAgent?: string;
  ipAddress?: string;
  correlationId?: string;
}): Promise<void> {
  // Only log calls for valid tenants
  if (!data.tenantId) {
    return;
  }

  try {
    await prisma.apiCallLog.create({
      data: {
        tenantId: data.tenantId,
        userId: data.userId,
        method: data.method,
        endpoint: data.endpoint,
        statusCode: data.statusCode,
        responseTime: data.responseTime,
        userAgent: data.userAgent,
        ipAddress: data.ipAddress,
        correlationId: data.correlationId,
        createdAt: new Date()
      }
    });
  } catch (error) {
    // Log error but don't throw to avoid affecting the API response
    logger.error('Failed to create API call log entry', {
      error: error instanceof Error ? error.message : 'Unknown error',
      data
    });
  }
}

/**
 * Get API usage statistics for a tenant
 */
export async function getApiUsageStats(tenantId: string): Promise<ApiUsageStats> {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [
      totalCalls,
      callsThisMonth,
      callsToday,
      avgResponseTime,
      errorCalls,
      topEndpoints
    ] = await Promise.all([
      // Total calls
      prisma.apiCallLog.count({
        where: { tenantId }
      }),
      
      // Calls this month
      prisma.apiCallLog.count({
        where: {
          tenantId,
          createdAt: { gte: startOfMonth }
        }
      }),
      
      // Calls today
      prisma.apiCallLog.count({
        where: {
          tenantId,
          createdAt: { gte: startOfDay }
        }
      }),
      
      // Average response time
      prisma.apiCallLog.aggregate({
        where: { tenantId },
        _avg: { responseTime: true }
      }),
      
      // Error calls (4xx and 5xx status codes)
      prisma.apiCallLog.count({
        where: {
          tenantId,
          statusCode: { gte: 400 }
        }
      }),
      
      // Top endpoints
      prisma.apiCallLog.groupBy({
        by: ['endpoint'],
        where: {
          tenantId,
          createdAt: { gte: startOfMonth }
        },
        _count: { endpoint: true },
        _avg: { responseTime: true },
        orderBy: { _count: { endpoint: 'desc' } },
        take: 10
      })
    ]);

    const errorRate = totalCalls > 0 ? (errorCalls / totalCalls) * 100 : 0;

    return {
      totalCalls,
      callsThisMonth,
      callsToday,
      averageResponseTime: avgResponseTime._avg.responseTime || 0,
      errorRate,
      topEndpoints: topEndpoints.map((endpoint: any) => ({
        endpoint: endpoint.endpoint,
        count: endpoint._count.endpoint,
        averageResponseTime: endpoint._avg.responseTime || 0
      }))
    };
  } catch (error) {
    logger.error('Failed to get API usage stats', {
      error: error instanceof Error ? error.message : 'Unknown error',
      tenantId
    });
    
    // Return empty stats on error
    return {
      totalCalls: 0,
      callsThisMonth: 0,
      callsToday: 0,
      averageResponseTime: 0,
      errorRate: 0,
      topEndpoints: []
    };
  }
}

/**
 * Get API call count for a specific time period
 */
export async function getApiCallCount(
  tenantId: string,
  startDate: Date,
  endDate: Date = new Date()
): Promise<number> {
  try {
    return await prisma.apiCallLog.count({
      where: {
        tenantId,
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      }
    });
  } catch (error) {
    logger.error('Failed to get API call count', {
      error: error instanceof Error ? error.message : 'Unknown error',
      tenantId,
      startDate,
      endDate
    });
    return 0;
  }
}

/**
 * Clean up old API call logs (for data retention)
 */
export async function cleanupOldApiLogs(retentionDays: number = 90): Promise<number> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await prisma.apiCallLog.deleteMany({
      where: {
        createdAt: { lt: cutoffDate }
      }
    });

    logger.info('Cleaned up old API call logs', {
      deletedCount: result.count,
      cutoffDate,
      retentionDays
    });

    return result.count;
  } catch (error) {
    logger.error('Failed to cleanup old API logs', {
      error: error instanceof Error ? error.message : 'Unknown error',
      retentionDays
    });
    return 0;
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Check if an endpoint should be skipped from tracking
 */
function shouldSkipTracking(path: string): boolean {
  const skipPaths = [
    '/health',
    '/metrics',
    '/favicon.ico',
    '/robots.txt',
    '/.well-known',
    '/api/health',
    '/api/metrics'
  ];

  return skipPaths.some(skipPath => path.startsWith(skipPath));
}

/**
 * Normalize endpoint path for consistent tracking
 */
function normalizeEndpoint(path: string): string {
  // Replace IDs with placeholders for consistent grouping
  return path
    .replace(/\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/g, '/:id')
    .replace(/\/\d+/g, '/:id')
    .replace(/\/[a-zA-Z0-9_-]{20,}/g, '/:id');
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