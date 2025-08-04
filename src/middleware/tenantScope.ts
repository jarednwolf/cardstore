import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { logger } from '../config/logger';
import { ForbiddenError, BadRequestError } from './errorHandler';
import { AuthenticatedRequest } from './auth';

const prisma = new PrismaClient();

export interface TenantScopedRequest extends AuthenticatedRequest {
  tenantScope: {
    tenantId: string;
    enforceScope: boolean;
    allowCrossTenant: boolean;
  };
}

/**
 * Middleware to enforce tenant-scoped data access
 * Ensures all database operations are automatically scoped to the user's tenant
 */
export const tenantScopeMiddleware = (options: {
  enforceScope?: boolean;
  allowCrossTenant?: boolean;
} = {}) => {
  return async (req: TenantScopedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { enforceScope = true, allowCrossTenant = false } = options;

      // Skip tenant scoping for owner operations when cross-tenant is allowed
      if (req.user?.role === 'owner' && allowCrossTenant) {
        req.tenantScope = {
          tenantId: req.user.tenantId || '',
          enforceScope: false,
          allowCrossTenant: true
        };
        return next();
      }

      // Ensure user has tenant context
      if (!req.user?.tenantId) {
        throw new BadRequestError('Tenant context required');
      }

      // Set tenant scope context
      req.tenantScope = {
        tenantId: req.user.tenantId,
        enforceScope,
        allowCrossTenant
      };

      // Validate tenant is active
      if (enforceScope) {
        const tenant = await prisma.tenant.findUnique({
          where: { id: req.user.tenantId },
          select: { isActive: true }
        });

        if (!tenant || !tenant.isActive) {
          throw new ForbiddenError('Tenant is not active');
        }
      }

      logger.debug('Tenant scope applied', {
        userId: req.user.id,
        tenantId: req.user.tenantId,
        enforceScope,
        allowCrossTenant
      });

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Utility class for tenant-scoped database operations
 */
export class TenantScopedPrisma {
  private tenantId: string;
  private enforceScope: boolean;

  constructor(tenantId: string, enforceScope: boolean = true) {
    this.tenantId = tenantId;
    this.enforceScope = enforceScope;
  }

  /**
   * Get tenant-scoped Prisma client with automatic filtering
   */
  get client() {
    if (!this.enforceScope) {
      return prisma;
    }

    // Create a proxy to automatically add tenant filtering
    return new Proxy(prisma, {
      get: (target, prop) => {
        const originalMethod = target[prop as keyof typeof target];

        // Only proxy database model methods
        if (typeof originalMethod === 'object' && originalMethod !== null) {
          return new Proxy(originalMethod, {
            get: (modelTarget, modelProp) => {
              const modelMethod = modelTarget[modelProp as keyof typeof modelTarget];

              if (typeof modelMethod === 'function') {
                return (...args: any[]) => {
                  // Add tenant filtering to queries
                  if (args[0] && typeof args[0] === 'object') {
                    args[0] = this.addTenantFilter(args[0]);
                  }
                  return (modelMethod as Function).apply(modelTarget, args);
                };
              }

              return modelMethod;
            }
          });
        }

        return originalMethod;
      }
    });
  }

  /**
   * Add tenant filter to query options
   */
  private addTenantFilter(queryOptions: any): any {
    // Skip if already has tenant filter or is a raw query
    if (queryOptions.where?.tenantId || queryOptions.raw) {
      return queryOptions;
    }

    // Add tenant filter to where clause
    if (queryOptions.where) {
      queryOptions.where = {
        ...queryOptions.where,
        tenantId: this.tenantId
      };
    } else {
      queryOptions.where = { tenantId: this.tenantId };
    }

    return queryOptions;
  }

  /**
   * Validate that data belongs to the current tenant
   */
  async validateTenantOwnership(model: string, id: string): Promise<boolean> {
    try {
      const record = await (prisma as any)[model].findUnique({
        where: { id },
        select: { tenantId: true }
      });

      return record?.tenantId === this.tenantId;
    } catch (error) {
      logger.error('Failed to validate tenant ownership', { error, model, id, tenantId: this.tenantId });
      return false;
    }
  }

  /**
   * Get tenant-scoped count for a model
   */
  async getTenantCount(model: string, where: any = {}): Promise<number> {
    try {
      return await (prisma as any)[model].count({
        where: {
          ...where,
          tenantId: this.tenantId
        }
      });
    } catch (error) {
      logger.error('Failed to get tenant count', { error, model, tenantId: this.tenantId });
      return 0;
    }
  }

  /**
   * Bulk update with tenant scope validation
   */
  async bulkUpdate(model: string, data: any, where: any = {}): Promise<any> {
    try {
      return await (prisma as any)[model].updateMany({
        where: {
          ...where,
          tenantId: this.tenantId
        },
        data
      });
    } catch (error) {
      logger.error('Failed to bulk update', { error, model, tenantId: this.tenantId });
      throw error;
    }
  }

  /**
   * Bulk delete with tenant scope validation
   */
  async bulkDelete(model: string, where: any = {}): Promise<any> {
    try {
      return await (prisma as any)[model].deleteMany({
        where: {
          ...where,
          tenantId: this.tenantId
        }
      });
    } catch (error) {
      logger.error('Failed to bulk delete', { error, model, tenantId: this.tenantId });
      throw error;
    }
  }
}

/**
 * Helper function to get tenant-scoped Prisma client from request
 */
export const getTenantScopedPrisma = (req: TenantScopedRequest): TenantScopedPrisma => {
  if (!req.tenantScope?.tenantId) {
    throw new BadRequestError('Tenant scope not available');
  }

  return new TenantScopedPrisma(req.tenantScope.tenantId, req.tenantScope.enforceScope);
};

/**
 * Decorator for automatic tenant scoping in service methods
 */
export const withTenantScope = (tenantId: string) => {
  return (target: any, propertyName: string, descriptor: PropertyDescriptor) => {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const scopedPrisma = new TenantScopedPrisma(tenantId);
      
      // Replace prisma instance in the method context
      const originalPrisma = (this as any).prisma;
      (this as any).prisma = scopedPrisma.client;

      try {
        const result = await method.apply(this, args);
        return result;
      } finally {
        // Restore original prisma instance
        (this as any).prisma = originalPrisma;
      }
    };

    return descriptor;
  };
};

/**
 * Middleware to validate resource ownership before operations
 */
export const validateResourceOwnership = (resourceModel: string, paramName: string = 'id') => {
  return async (req: TenantScopedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const resourceId = req.params[paramName];
      if (!resourceId) {
        throw new BadRequestError(`${paramName} parameter is required`);
      }

      if (!req.tenantScope?.tenantId) {
        throw new BadRequestError('Tenant scope not available');
      }

      const scopedPrisma = new TenantScopedPrisma(req.tenantScope.tenantId);
      const isOwner = await scopedPrisma.validateTenantOwnership(resourceModel, resourceId);

      if (!isOwner) {
        throw new ForbiddenError('Resource not found or access denied');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Audit logging for tenant operations
 */
export const auditTenantOperation = (operation: string, resource: string) => {
  return (req: TenantScopedRequest, res: Response, next: NextFunction): void => {
    const originalSend = res.send;

    res.send = function (data: any) {
      // Log successful operations
      if (res.statusCode < 400) {
        logger.info('Tenant operation completed', {
          operation,
          resource,
          tenantId: req.tenantScope?.tenantId,
          userId: req.user?.id,
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          timestamp: new Date().toISOString()
        });
      }

      return originalSend.call(this, data);
    };

    next();
  };
};

export default tenantScopeMiddleware;