import { Request, Response, NextFunction } from 'express';
import { performanceMonitoringService } from '../services/performanceMonitoringService';
import { logger } from '../config/logger';

export interface PerformanceTrackingRequest extends Request {
  startTime?: number;
  performanceMetrics?: {
    endpoint: string;
    method: string;
    responseTime: number;
    statusCode: number;
  };
}

/**
 * Middleware to track API performance metrics
 */
export const performanceTrackingMiddleware = (
  req: PerformanceTrackingRequest,
  res: Response,
  next: NextFunction
): void => {
  // Record start time
  req.startTime = Date.now();

  // Override res.end to capture response time
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any): Response {
    const responseTime = Date.now() - (req.startTime || Date.now());
    
    // Extract endpoint and method
    const endpoint = req.route?.path || req.path;
    const method = req.method;
    const statusCode = res.statusCode;

    // Record performance metrics
    performanceMonitoringService.recordApiResponseTime(endpoint, method, responseTime);

    // Store metrics on request for potential use by other middleware
    req.performanceMetrics = {
      endpoint,
      method,
      responseTime,
      statusCode
    };

    // Log slow requests
    if (responseTime > 1000) {
      logger.warn('Slow API request detected', {
        endpoint,
        method,
        responseTime,
        statusCode,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });
    }

    // Call original end method
    return originalEnd.call(this, chunk, encoding);
  };

  next();
};

/**
 * Middleware to track database query performance
 */
export const databasePerformanceMiddleware = (
  req: PerformanceTrackingRequest,
  res: Response,
  next: NextFunction
): void => {
  // This would integrate with Prisma middleware to track query performance
  // For now, we'll add a hook to track when database operations complete
  
  const originalJson = res.json;
  res.json = function(body?: any): Response {
    // If this was a database-heavy operation, we could track it here
    // This is a placeholder for more sophisticated database performance tracking
    
    return originalJson.call(this, body);
  };

  next();
};

/**
 * Middleware to provide performance metrics endpoint
 */
export const performanceMetricsEndpoint = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const metrics = await performanceMonitoringService.getCurrentMetrics();
    
    res.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get performance metrics', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve performance metrics'
    });
  }
};

/**
 * Middleware to provide performance alerts endpoint
 */
export const performanceAlertsEndpoint = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const alerts = performanceMonitoringService.getActiveAlerts();
    
    res.json({
      success: true,
      data: alerts,
      count: alerts.length
    });
  } catch (error) {
    logger.error('Failed to get performance alerts', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve performance alerts'
    });
  }
};

/**
 * Middleware to provide performance recommendations endpoint
 */
export const performanceRecommendationsEndpoint = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const recommendations = await performanceMonitoringService.getPerformanceRecommendations();
    
    res.json({
      success: true,
      data: recommendations,
      count: recommendations.length
    });
  } catch (error) {
    logger.error('Failed to get performance recommendations', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve performance recommendations'
    });
  }
};

/**
 * Middleware to resolve performance alerts
 */
export const resolvePerformanceAlertEndpoint = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { alertId } = req.params;
    
    if (!alertId) {
      res.status(400).json({
        success: false,
        error: 'Alert ID is required'
      });
      return;
    }

    performanceMonitoringService.resolveAlert(alertId);
    
    res.json({
      success: true,
      message: 'Alert resolved successfully'
    });
  } catch (error) {
    logger.error('Failed to resolve performance alert', error);
    res.status(500).json({
      success: false,
      error: 'Failed to resolve performance alert'
    });
  }
};

/**
 * Middleware to get slow queries report
 */
export const slowQueriesReportEndpoint = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const limit = parseInt(req.query['limit'] as string) || 50;
    const slowQueries = performanceMonitoringService.getSlowQueriesReport(limit);
    
    res.json({
      success: true,
      data: slowQueries,
      count: slowQueries.length
    });
  } catch (error) {
    logger.error('Failed to get slow queries report', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve slow queries report'
    });
  }
};

/**
 * Performance monitoring dashboard data endpoint
 */
export const performanceDashboardEndpoint = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const [
      currentMetrics,
      activeAlerts,
      recommendations,
      slowQueries
    ] = await Promise.all([
      performanceMonitoringService.getCurrentMetrics(),
      performanceMonitoringService.getActiveAlerts(),
      performanceMonitoringService.getPerformanceRecommendations(),
      performanceMonitoringService.getSlowQueriesReport(10)
    ]);

    res.json({
      success: true,
      data: {
        metrics: currentMetrics,
        alerts: {
          active: activeAlerts,
          count: activeAlerts.length,
          critical: activeAlerts.filter(a => a.type === 'critical').length,
          warnings: activeAlerts.filter(a => a.type === 'warning').length
        },
        recommendations: {
          items: recommendations,
          count: recommendations.length,
          highPriority: recommendations.filter(r => r.priority === 'high').length
        },
        slowQueries: {
          items: slowQueries,
          count: slowQueries.length
        },
        summary: {
          overallHealth: calculateOverallHealth(currentMetrics, activeAlerts),
          lastUpdated: new Date().toISOString()
        }
      }
    });
  } catch (error) {
    logger.error('Failed to get performance dashboard data', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve performance dashboard data'
    });
  }
};

/**
 * Calculate overall system health score
 */
function calculateOverallHealth(metrics: any, alerts: any[]): {
  score: number;
  status: 'excellent' | 'good' | 'warning' | 'critical';
  factors: string[];
} {
  let score = 100;
  const factors: string[] = [];

  // Deduct points for performance issues
  if (metrics.apiResponseTimes.p95 > 1000) {
    score -= 20;
    factors.push('Slow API response times');
  }

  if (metrics.cacheMetrics.hitRate < 80) {
    score -= 15;
    factors.push('Low cache hit rate');
  }

  if (metrics.databaseMetrics.averageQueryTime > 500) {
    score -= 25;
    factors.push('Slow database queries');
  }

  if (metrics.systemHealth.memoryUsage > 85) {
    score -= 10;
    factors.push('High memory usage');
  }

  // Deduct points for active alerts
  const criticalAlerts = alerts.filter(a => a.type === 'critical').length;
  const warningAlerts = alerts.filter(a => a.type === 'warning').length;
  
  score -= criticalAlerts * 15;
  score -= warningAlerts * 5;

  if (criticalAlerts > 0) {
    factors.push(`${criticalAlerts} critical alerts`);
  }
  if (warningAlerts > 0) {
    factors.push(`${warningAlerts} warning alerts`);
  }

  // Determine status
  let status: 'excellent' | 'good' | 'warning' | 'critical';
  if (score >= 90) status = 'excellent';
  else if (score >= 75) status = 'good';
  else if (score >= 60) status = 'warning';
  else status = 'critical';

  return {
    score: Math.max(0, score),
    status,
    factors
  };
}