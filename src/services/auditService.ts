import { PrismaClient } from '@prisma/client';
import { logger } from '../config/logger';
import { Request } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';

const prisma = new PrismaClient();

export interface AuditLogEntry {
  id: string;
  tenantId: string;
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  changes?: Record<string, any>;
  metadata?: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
}

export interface CreateAuditLogRequest {
  tenantId: string;
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  changes?: Record<string, any>;
  metadata?: Record<string, any>;
  ipAddress: string;
  userAgent: string;
}

export interface AuditLogFilters {
  tenantId?: string;
  userId?: string;
  action?: string;
  resource?: string;
  resourceId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
}

export class AuditService {
  /**
   * Create an audit log entry
   */
  async createAuditLog(data: CreateAuditLogRequest): Promise<AuditLogEntry> {
    try {
      // First, ensure we have an audit_logs table
      await this.ensureAuditTable();

      const auditLog = await prisma.$executeRaw`
        INSERT INTO audit_logs (
          id, tenant_id, user_id, action, resource, resource_id,
          changes, metadata, ip_address, user_agent, timestamp
        ) VALUES (
          ${this.generateId()}, ${data.tenantId}, ${data.userId}, ${data.action},
          ${data.resource}, ${data.resourceId || null}, ${JSON.stringify(data.changes || {})},
          ${JSON.stringify(data.metadata || {})}, ${data.ipAddress}, ${data.userAgent}, ${new Date()}
        )
      `;

      logger.debug('Audit log created', {
        tenantId: data.tenantId,
        userId: data.userId,
        action: data.action,
        resource: data.resource
      });

      return {
        id: this.generateId(),
        ...data,
        timestamp: new Date()
      };
    } catch (error) {
      logger.error('Failed to create audit log', { error, data });
      // Don't throw error to avoid breaking main operations
      return {
        id: this.generateId(),
        ...data,
        timestamp: new Date()
      };
    }
  }

  /**
   * Get audit logs with filtering and pagination
   */
  async getAuditLogs(
    filters: AuditLogFilters,
    page: number = 1,
    limit: number = 50
  ): Promise<{ logs: AuditLogEntry[]; total: number }> {
    try {
      await this.ensureAuditTable();

      let whereClause = 'WHERE 1=1';
      const params: any[] = [];
      let paramIndex = 1;

      if (filters.tenantId) {
        whereClause += ` AND tenant_id = $${paramIndex}`;
        params.push(filters.tenantId);
        paramIndex++;
      }

      if (filters.userId) {
        whereClause += ` AND user_id = $${paramIndex}`;
        params.push(filters.userId);
        paramIndex++;
      }

      if (filters.action) {
        whereClause += ` AND action = $${paramIndex}`;
        params.push(filters.action);
        paramIndex++;
      }

      if (filters.resource) {
        whereClause += ` AND resource = $${paramIndex}`;
        params.push(filters.resource);
        paramIndex++;
      }

      if (filters.resourceId) {
        whereClause += ` AND resource_id = $${paramIndex}`;
        params.push(filters.resourceId);
        paramIndex++;
      }

      if (filters.dateFrom) {
        whereClause += ` AND timestamp >= $${paramIndex}`;
        params.push(filters.dateFrom);
        paramIndex++;
      }

      if (filters.dateTo) {
        whereClause += ` AND timestamp <= $${paramIndex}`;
        params.push(filters.dateTo);
        paramIndex++;
      }

      if (filters.search) {
        whereClause += ` AND (action LIKE $${paramIndex} OR resource LIKE $${paramIndex + 1})`;
        params.push(`%${filters.search}%`, `%${filters.search}%`);
        paramIndex += 2;
      }

      const offset = (page - 1) * limit;

      // Get total count
      const totalResult = await prisma.$queryRaw`
        SELECT COUNT(*) as count FROM audit_logs ${whereClause}
      ` as any[];
      const total = parseInt(totalResult[0]?.count || '0');

      // Get logs
      const logs = await prisma.$queryRaw`
        SELECT * FROM audit_logs 
        ${whereClause}
        ORDER BY timestamp DESC 
        LIMIT ${limit} OFFSET ${offset}
      ` as any[];

      return {
        logs: logs.map((log: any) => this.transformAuditLog(log)),
        total
      };
    } catch (error) {
      logger.error('Failed to get audit logs', { error, filters });
      return { logs: [], total: 0 };
    }
  }

  /**
   * Log user action from request context
   */
  async logUserAction(
    req: AuthenticatedRequest,
    action: string,
    resource: string,
    resourceId?: string,
    changes?: Record<string, any>,
    metadata?: Record<string, any>
  ): Promise<void> {
    if (!req.user?.id || !req.user?.tenantId) {
      return;
    }

    const ipAddress = this.getClientIP(req);
    const userAgent = req.get('User-Agent') || 'Unknown';

    await this.createAuditLog({
      tenantId: req.user.tenantId,
      userId: req.user.id,
      action,
      resource,
      resourceId: resourceId || undefined,
      changes: changes || undefined,
      metadata: metadata || undefined,
      ipAddress,
      userAgent
    });
  }

  /**
   * Log tenant management action
   */
  async logTenantAction(
    req: AuthenticatedRequest,
    action: string,
    tenantId: string,
    changes?: Record<string, any>
  ): Promise<void> {
    if (!req.user?.id) {
      return;
    }

    const ipAddress = this.getClientIP(req);
    const userAgent = req.get('User-Agent') || 'Unknown';

    await this.createAuditLog({
      tenantId: req.user.tenantId || tenantId,
      userId: req.user.id,
      action,
      resource: 'tenant',
      resourceId: tenantId,
      changes: changes || undefined,
      metadata: {
        targetTenantId: tenantId
      },
      ipAddress,
      userAgent
    });
  }

  /**
   * Log authentication events
   */
  async logAuthEvent(
    action: string,
    userId?: string,
    tenantId?: string,
    metadata?: Record<string, any>,
    req?: Request
  ): Promise<void> {
    const ipAddress = req ? this.getClientIP(req) : 'Unknown';
    const userAgent = req?.get('User-Agent') || 'Unknown';

    await this.createAuditLog({
      tenantId: tenantId || 'system',
      userId: userId || 'anonymous',
      action,
      resource: 'authentication',
      metadata: metadata || undefined,
      ipAddress,
      userAgent
    });
  }

  /**
   * Get audit summary for a tenant
   */
  async getAuditSummary(tenantId: string, days: number = 30): Promise<{
    totalActions: number;
    actionsByType: Record<string, number>;
    resourcesByType: Record<string, number>;
    userActivity: Record<string, number>;
    recentActivity: AuditLogEntry[];
  }> {
    try {
      await this.ensureAuditTable();

      const dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - days);

      const logs = await this.getAuditLogs(
        { tenantId, dateFrom },
        1,
        1000 // Get more for summary
      );

      const actionsByType: Record<string, number> = {};
      const resourcesByType: Record<string, number> = {};
      const userActivity: Record<string, number> = {};

      logs.logs.forEach(log => {
        actionsByType[log.action] = (actionsByType[log.action] || 0) + 1;
        resourcesByType[log.resource] = (resourcesByType[log.resource] || 0) + 1;
        userActivity[log.userId] = (userActivity[log.userId] || 0) + 1;
      });

      const recentActivity = logs.logs.slice(0, 10);

      return {
        totalActions: logs.total,
        actionsByType,
        resourcesByType,
        userActivity,
        recentActivity
      };
    } catch (error) {
      logger.error('Failed to get audit summary', { error, tenantId });
      return {
        totalActions: 0,
        actionsByType: {},
        resourcesByType: {},
        userActivity: {},
        recentActivity: []
      };
    }
  }

  /**
   * Clean up old audit logs
   */
  async cleanupOldLogs(retentionDays: number = 365): Promise<number> {
    try {
      await this.ensureAuditTable();

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const result = await prisma.$executeRaw`
        DELETE FROM audit_logs WHERE timestamp < ${cutoffDate}
      `;

      logger.info('Cleaned up old audit logs', {
        deletedCount: result,
        cutoffDate,
        retentionDays
      });

      return result as number;
    } catch (error) {
      logger.error('Failed to cleanup old audit logs', { error });
      return 0;
    }
  }

  /**
   * Ensure audit table exists
   */
  private async ensureAuditTable(): Promise<void> {
    try {
      await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          action TEXT NOT NULL,
          resource TEXT NOT NULL,
          resource_id TEXT,
          changes TEXT DEFAULT '{}',
          metadata TEXT DEFAULT '{}',
          ip_address TEXT NOT NULL,
          user_agent TEXT NOT NULL,
          timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `;

      // Create indexes for better performance
      await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_timestamp 
        ON audit_logs(tenant_id, timestamp DESC)
      `;

      await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS idx_audit_logs_user_timestamp 
        ON audit_logs(user_id, timestamp DESC)
      `;

      await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS idx_audit_logs_resource 
        ON audit_logs(resource, resource_id)
      `;
    } catch (error) {
      logger.error('Failed to ensure audit table', { error });
    }
  }

  /**
   * Get client IP address from request
   */
  private getClientIP(req: Request): string {
    return (
      req.ip ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      (req.connection as any)?.socket?.remoteAddress ||
      'Unknown'
    );
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return require('crypto').randomBytes(16).toString('hex');
  }

  /**
   * Transform database audit log to API format
   */
  private transformAuditLog(log: any): AuditLogEntry {
    return {
      id: log.id,
      tenantId: log.tenant_id,
      userId: log.user_id,
      action: log.action,
      resource: log.resource,
      resourceId: log.resource_id,
      changes: log.changes ? JSON.parse(log.changes) : {},
      metadata: log.metadata ? JSON.parse(log.metadata) : {},
      ipAddress: log.ip_address,
      userAgent: log.user_agent,
      timestamp: new Date(log.timestamp)
    };
  }
}

/**
 * Middleware to automatically log API actions
 */
export const auditMiddleware = (action: string, resource: string) => {
  return async (req: AuthenticatedRequest, res: any, next: any): Promise<void> => {
    const originalSend = res.send;
    const startTime = Date.now();

    res.send = function (data: any) {
      // Only log successful operations (2xx status codes)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const duration = Date.now() - startTime;
        
        // Extract resource ID from params or body
        const resourceId = req.params?.['id'] || req.body?.['id'];
        
        // Determine changes based on method
        let changes: Record<string, any> | undefined;
        if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
          changes = req.body;
        }

        const metadata = {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          duration,
          timestamp: new Date().toISOString()
        };

        // Log asynchronously to avoid blocking response
        setImmediate(() => {
          auditService.logUserAction(req, action, resource, resourceId, changes, metadata)
            .catch(error => {
              logger.error('Failed to log audit action', { error, action, resource });
            });
        });
      }

      return originalSend.call(this, data);
    };

    next();
  };
};

export const auditService = new AuditService();