import { PrismaClient } from '@prisma/client';
import { logger } from '../config/logger';
import { cacheService } from './cacheService';

// Database connection helper
class DatabaseConnection {
  private static instance: PrismaClient | null = null;
  private static isConnected = false;

  static getInstance(): PrismaClient | null {
    if (!this.instance) {
      try {
        // Only create Prisma client if DATABASE_URL is properly configured
        if (process.env['DATABASE_URL'] && process.env['DATABASE_URL'].startsWith('postgresql://')) {
          this.instance = new PrismaClient();
          this.isConnected = true;
          logger.info('Database connection established');
        } else {
          logger.warn('Database not configured - running in mock mode');
          this.isConnected = false;
        }
      } catch (error) {
        logger.error('Failed to initialize database connection', error);
        this.isConnected = false;
      }
    }
    return this.instance;
  }

  static isAvailable(): boolean {
    return this.isConnected && this.instance !== null;
  }

  static async testConnection(): Promise<boolean> {
    if (!this.isAvailable()) return false;
    
    try {
      await this.instance!.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      logger.error('Database connection test failed', error);
      this.isConnected = false;
      return false;
    }
  }
}

export interface PerformanceMetrics {
  timestamp: Date;
  apiResponseTimes: {
    p50: number;
    p95: number;
    p99: number;
    average: number;
  };
  databaseMetrics: {
    connectionCount: number;
    queryCount: number;
    averageQueryTime: number;
    slowQueries: number;
  };
  cacheMetrics: {
    hitRate: number;
    memory: string;
    keys: number;
    hits: number;
    misses: number;
  };
  businessMetrics: {
    activeUsers: number;
    apiCallsPerMinute: number;
    ordersPerHour: number;
    inventoryUpdatesPerHour: number;
  };
  systemHealth: {
    uptime: number;
    memoryUsage: number;
    cpuUsage: number;
    errorRate: number;
  };
}

export interface PerformanceAlert {
  id: string;
  type: 'warning' | 'critical';
  metric: string;
  threshold: number;
  currentValue: number;
  message: string;
  timestamp: Date;
  resolved: boolean;
}

export interface QueryPerformanceData {
  query: string;
  executionTime: number;
  timestamp: Date;
  tenantId: string;
  parameters?: any;
}

export class PerformanceMonitoringService {
  private metrics: Map<string, number[]> = new Map();
  private alerts: PerformanceAlert[] = [];
  private queryLog: QueryPerformanceData[] = [];
  private maxQueryLogSize = 1000;
  private prisma: PrismaClient | null;

  constructor() {
    this.prisma = DatabaseConnection.getInstance();
    this.initializeMonitoring();
  }

  /**
   * Initialize performance monitoring
   */
  private initializeMonitoring(): void {
    // Start collecting metrics every minute
    setInterval(() => {
      this.collectMetrics();
    }, 60000);

    // Clean up old data every hour
    setInterval(() => {
      this.cleanupOldData();
    }, 3600000);

    // Check for performance alerts every 5 minutes
    setInterval(() => {
      this.checkPerformanceAlerts();
    }, 300000);

    logger.info('Performance monitoring initialized');
  }

  /**
   * Record API response time
   */
  recordApiResponseTime(endpoint: string, method: string, responseTime: number): void {
    const key = `api:${method}:${endpoint}`;
    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }
    
    const times = this.metrics.get(key)!;
    times.push(responseTime);
    
    // Keep only last 1000 measurements
    if (times.length > 1000) {
      times.shift();
    }
  }

  /**
   * Record database query performance
   */
  recordDatabaseQuery(
    query: string,
    executionTime: number,
    tenantId: string,
    parameters?: any
  ): void {
    const queryData: QueryPerformanceData = {
      query: this.sanitizeQuery(query),
      executionTime,
      timestamp: new Date(),
      tenantId,
      parameters
    };

    this.queryLog.push(queryData);

    // Keep only recent queries
    if (this.queryLog.length > this.maxQueryLogSize) {
      this.queryLog.shift();
    }

    // Log slow queries
    if (executionTime > 1000) { // > 1 second
      logger.warn('Slow database query detected', {
        query: queryData.query,
        executionTime,
        tenantId
      });
    }
  }

  /**
   * Get current performance metrics
   */
  async getCurrentMetrics(): Promise<PerformanceMetrics> {
    const [
      apiMetrics,
      dbMetrics,
      cacheMetrics,
      businessMetrics,
      systemMetrics
    ] = await Promise.all([
      this.getApiMetrics(),
      this.getDatabaseMetrics(),
      this.getCacheMetrics(),
      this.getBusinessMetrics(),
      this.getSystemMetrics()
    ]);

    return {
      timestamp: new Date(),
      apiResponseTimes: apiMetrics,
      databaseMetrics: dbMetrics,
      cacheMetrics,
      businessMetrics,
      systemHealth: systemMetrics
    };
  }

  /**
   * Get performance metrics for a specific time range
   */
  async getMetricsHistory(
    startTime: Date,
    endTime: Date,
    interval: 'minute' | 'hour' | 'day' = 'hour'
  ): Promise<PerformanceMetrics[]> {
    const cacheKey = cacheService.generateKey(
      'metrics_history',
      'system',
      startTime.toISOString(),
      endTime.toISOString(),
      interval
    );

    return await cacheService.getOrSet(
      cacheKey,
      async () => {
        // In a real implementation, this would query a time-series database
        // For now, we'll return current metrics as a placeholder
        const currentMetrics = await this.getCurrentMetrics();
        return [currentMetrics];
      },
      'analytics'
    );
  }

  /**
   * Get slow queries report
   */
  getSlowQueriesReport(limit: number = 50): QueryPerformanceData[] {
    return this.queryLog
      .filter(q => q.executionTime > 500) // > 500ms
      .sort((a, b) => b.executionTime - a.executionTime)
      .slice(0, limit);
  }

  /**
   * Get performance alerts
   */
  getActiveAlerts(): PerformanceAlert[] {
    return this.alerts.filter(alert => !alert.resolved);
  }

  /**
   * Resolve performance alert
   */
  resolveAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      logger.info('Performance alert resolved', { alertId, metric: alert.metric });
    }
  }

  /**
   * Get performance recommendations
   */
  async getPerformanceRecommendations(): Promise<{
    type: 'database' | 'cache' | 'api' | 'system';
    priority: 'high' | 'medium' | 'low';
    title: string;
    description: string;
    action: string;
  }[]> {
    const recommendations = [];
    const metrics = await this.getCurrentMetrics();

    // Database recommendations
    if (metrics.databaseMetrics.averageQueryTime > 500) {
      recommendations.push({
        type: 'database' as const,
        priority: 'high' as const,
        title: 'Slow Database Queries',
        description: `Average query time is ${metrics.databaseMetrics.averageQueryTime}ms`,
        action: 'Review and optimize slow queries, add database indexes'
      });
    }

    // Cache recommendations
    if (metrics.cacheMetrics.hitRate < 80) {
      recommendations.push({
        type: 'cache' as const,
        priority: 'medium' as const,
        title: 'Low Cache Hit Rate',
        description: `Cache hit rate is ${metrics.cacheMetrics.hitRate}%`,
        action: 'Review caching strategy and increase cache TTL for stable data'
      });
    }

    // API recommendations
    if (metrics.apiResponseTimes.p95 > 1000) {
      recommendations.push({
        type: 'api' as const,
        priority: 'high' as const,
        title: 'Slow API Response Times',
        description: `95th percentile response time is ${metrics.apiResponseTimes.p95}ms`,
        action: 'Optimize API endpoints and implement response caching'
      });
    }

    // System recommendations
    if (metrics.systemHealth.errorRate > 5) {
      recommendations.push({
        type: 'system' as const,
        priority: 'high' as const,
        title: 'High Error Rate',
        description: `Error rate is ${metrics.systemHealth.errorRate}%`,
        action: 'Investigate and fix recurring errors'
      });
    }

    return recommendations;
  }

  /**
   * Collect current metrics
   */
  private async collectMetrics(): Promise<void> {
    try {
      const metrics = await this.getCurrentMetrics();
      
      // Store metrics in cache for historical tracking
      const cacheKey = cacheService.generateKey(
        'metrics',
        'system',
        new Date().toISOString()
      );
      
      await cacheService.set(cacheKey, metrics, 86400); // 24 hours
      
      logger.debug('Performance metrics collected', {
        timestamp: metrics.timestamp,
        apiP95: metrics.apiResponseTimes.p95,
        cacheHitRate: metrics.cacheMetrics.hitRate,
        dbQueryTime: metrics.databaseMetrics.averageQueryTime
      });
    } catch (error) {
      logger.error('Failed to collect performance metrics', error);
    }
  }

  /**
   * Get API performance metrics
   */
  private getApiMetrics(): {
    p50: number;
    p95: number;
    p99: number;
    average: number;
  } {
    const allTimes: number[] = [];
    
    for (const times of this.metrics.values()) {
      allTimes.push(...times);
    }

    if (allTimes.length === 0) {
      return { p50: 0, p95: 0, p99: 0, average: 0 };
    }

    allTimes.sort((a, b) => a - b);
    
    const p50Index = Math.floor(allTimes.length * 0.5);
    const p95Index = Math.floor(allTimes.length * 0.95);
    const p99Index = Math.floor(allTimes.length * 0.99);
    
    const average = allTimes.reduce((sum, time) => sum + time, 0) / allTimes.length;

    return {
      p50: allTimes[p50Index] || 0,
      p95: allTimes[p95Index] || 0,
      p99: allTimes[p99Index] || 0,
      average: Math.round(average)
    };
  }

  /**
   * Get database performance metrics
   */
  private getDatabaseMetrics(): {
    connectionCount: number;
    queryCount: number;
    averageQueryTime: number;
    slowQueries: number;
  } {
    const recentQueries = this.queryLog.filter(
      q => Date.now() - q.timestamp.getTime() < 300000 // Last 5 minutes
    );

    const averageQueryTime = recentQueries.length > 0
      ? recentQueries.reduce((sum, q) => sum + q.executionTime, 0) / recentQueries.length
      : 0;

    const slowQueries = recentQueries.filter(q => q.executionTime > 1000).length;

    return {
      connectionCount: 10, // This would come from actual connection pool
      queryCount: recentQueries.length,
      averageQueryTime: Math.round(averageQueryTime),
      slowQueries
    };
  }

  /**
   * Get cache performance metrics
   */
  private async getCacheMetrics() {
    return await cacheService.getStats();
  }

  /**
   * Get business metrics
   */
  private async getBusinessMetrics(): Promise<{
    activeUsers: number;
    apiCallsPerMinute: number;
    ordersPerHour: number;
    inventoryUpdatesPerHour: number;
  }> {
    // Return mock data if database is not available
    if (!DatabaseConnection.isAvailable() || !this.prisma) {
      return {
        activeUsers: 0,
        apiCallsPerMinute: 0,
        ordersPerHour: 0,
        inventoryUpdatesPerHour: 0
      };
    }

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 3600000);
    const oneMinuteAgo = new Date(now.getTime() - 60000);

    try {
      // Test database connection before making queries
      const isConnected = await DatabaseConnection.testConnection();
      if (!isConnected) {
        logger.warn('Database connection unavailable, returning mock metrics');
        return {
          activeUsers: 0,
          apiCallsPerMinute: 0,
          ordersPerHour: 0,
          inventoryUpdatesPerHour: 0
        };
      }

      const [apiCalls, orders] = await Promise.all([
        this.prisma.apiCallLog.count({
          where: {
            createdAt: { gte: oneMinuteAgo }
          }
        }),
        this.prisma.order.count({
          where: {
            createdAt: { gte: oneHourAgo }
          }
        })
      ]);

      return {
        activeUsers: 0, // Would need session tracking
        apiCallsPerMinute: apiCalls,
        ordersPerHour: orders,
        inventoryUpdatesPerHour: 0 // Would track inventory updates
      };
    } catch (error) {
      logger.error('Failed to get business metrics', error);
      return {
        activeUsers: 0,
        apiCallsPerMinute: 0,
        ordersPerHour: 0,
        inventoryUpdatesPerHour: 0
      };
    }
  }

  /**
   * Get system health metrics
   */
  private getSystemMetrics(): {
    uptime: number;
    memoryUsage: number;
    cpuUsage: number;
    errorRate: number;
  } {
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();

    return {
      uptime,
      memoryUsage: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100),
      cpuUsage: 0, // Would need CPU monitoring
      errorRate: 0 // Would calculate from error logs
    };
  }

  /**
   * Check for performance alerts
   */
  private async checkPerformanceAlerts(): Promise<void> {
    const metrics = await this.getCurrentMetrics();

    // Check API response time alert
    if (metrics.apiResponseTimes.p95 > 2000) {
      this.createAlert(
        'critical',
        'api_response_time',
        2000,
        metrics.apiResponseTimes.p95,
        'API response time (P95) is critically high'
      );
    }

    // Check cache hit rate alert
    if (metrics.cacheMetrics.hitRate < 70) {
      this.createAlert(
        'warning',
        'cache_hit_rate',
        70,
        metrics.cacheMetrics.hitRate,
        'Cache hit rate is below optimal threshold'
      );
    }

    // Check database query time alert
    if (metrics.databaseMetrics.averageQueryTime > 1000) {
      this.createAlert(
        'critical',
        'database_query_time',
        1000,
        metrics.databaseMetrics.averageQueryTime,
        'Database queries are running slowly'
      );
    }

    // Check memory usage alert
    if (metrics.systemHealth.memoryUsage > 85) {
      this.createAlert(
        'warning',
        'memory_usage',
        85,
        metrics.systemHealth.memoryUsage,
        'Memory usage is high'
      );
    }
  }

  /**
   * Create performance alert
   */
  private createAlert(
    type: 'warning' | 'critical',
    metric: string,
    threshold: number,
    currentValue: number,
    message: string
  ): void {
    // Check if alert already exists
    const existingAlert = this.alerts.find(
      a => a.metric === metric && !a.resolved
    );

    if (existingAlert) {
      existingAlert.currentValue = currentValue;
      existingAlert.timestamp = new Date();
      return;
    }

    const alert: PerformanceAlert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      metric,
      threshold,
      currentValue,
      message,
      timestamp: new Date(),
      resolved: false
    };

    this.alerts.push(alert);

    logger.warn('Performance alert created', {
      alertId: alert.id,
      type,
      metric,
      threshold,
      currentValue,
      message
    });
  }

  /**
   * Clean up old performance data
   */
  private cleanupOldData(): void {
    const cutoffTime = Date.now() - 86400000; // 24 hours ago

    // Clean up query log
    this.queryLog = this.queryLog.filter(
      q => q.timestamp.getTime() > cutoffTime
    );

    // Clean up resolved alerts older than 24 hours
    this.alerts = this.alerts.filter(
      a => !a.resolved || a.timestamp.getTime() > cutoffTime
    );

    // Clean up metrics
    for (const [key, times] of this.metrics.entries()) {
      if (times.length > 100) {
        this.metrics.set(key, times.slice(-100));
      }
    }

    logger.debug('Performance data cleanup completed');
  }

  /**
   * Sanitize SQL query for logging
   */
  private sanitizeQuery(query: string): string {
    // Remove sensitive data and normalize query
    return query
      .replace(/\$\d+/g, '?') // Replace parameter placeholders
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
      .substring(0, 200); // Limit length
  }
}

// Export singleton instance
export const performanceMonitoringService = new PerformanceMonitoringService();