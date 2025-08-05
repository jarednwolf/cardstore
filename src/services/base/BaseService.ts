/**
 * Base Service Class
 * Provides common functionality and patterns for all services
 * Eliminates code duplication and ensures consistency
 */

import { PrismaClient } from '@prisma/client';
import { RequestContext } from '../../types';
import { logger } from '../../config/logger';
import { ValidationError, NotFoundError, ConflictError } from '../../middleware/errorHandler';

export abstract class BaseService {
  protected prisma: PrismaClient;
  protected serviceName: string;

  constructor(prisma: PrismaClient, serviceName: string) {
    this.prisma = prisma;
    this.serviceName = serviceName;
  }

  /**
   * Standard error handling with correlation ID
   */
  protected handleError(error: any, operation: string, context?: RequestContext): never {
    const errorContext = {
      service: this.serviceName,
      operation,
      correlationId: context?.correlationId,
      tenantId: context?.tenantId,
      userId: context?.userId,
      error: error.message,
      stack: error.stack
    };

    logger.error(`${this.serviceName} error in ${operation}`, errorContext);

    // Re-throw known errors
    if (error instanceof ValidationError || 
        error instanceof NotFoundError || 
        error instanceof ConflictError) {
      throw error;
    }

    // Handle Prisma errors
    if (error.code === 'P2002') {
      throw new ConflictError('Resource already exists', { field: error.meta?.target });
    }
    
    if (error.code === 'P2025') {
      throw new NotFoundError('Resource not found');
    }

    // Generic error
    throw new Error(`${this.serviceName} operation failed: ${error.message}`);
  }

  /**
   * Validate tenant access
   */
  protected validateTenantAccess(resourceTenantId: string, context: RequestContext): void {
    if (resourceTenantId !== context.tenantId) {
      throw new NotFoundError('Resource not found'); // Don't reveal existence
    }
  }

  /**
   * Standard pagination helper
   */
  protected buildPaginationQuery(limit?: number, cursor?: string) {
    const take = Math.min(limit || 50, 100); // Max 100 items
    
    return {
      take,
      ...(cursor && {
        skip: 1,
        cursor: { id: cursor }
      }),
      orderBy: { createdAt: 'desc' as const }
    };
  }

  /**
   * Standard tenant filtering
   */
  protected buildTenantFilter(tenantId: string, additionalFilters: any = {}) {
    return {
      tenantId,
      ...additionalFilters
    };
  }

  /**
   * Audit log helper
   */
  protected async createAuditLog(
    action: string,
    resourceType: string,
    resourceId: string,
    context: RequestContext,
    oldValues?: any,
    newValues?: any
  ): Promise<void> {
    try {
      // Only create audit log if auditTrail table exists
      // Note: This would need to be implemented when audit trail table is added
      // await this.prisma.auditTrail.create({
      //   data: {
      //     entityType: resourceType,
      //     entityId: resourceId,
      //     action: action as any,
      //     oldValues: oldValues ? JSON.stringify(oldValues) : null,
      //     newValues: newValues ? JSON.stringify(newValues) : null,
      //     userId: context.userId,
      //     tenantId: context.tenantId,
      //     ipAddress: context.ipAddress || 'unknown',
      //     userAgent: context.userAgent || 'unknown',
      //     correlationId: context.correlationId
      //   }
      // });
      
      // Temporary logging until audit table is implemented
      logger.info('Audit log', {
        service: this.serviceName,
        action,
        resourceType,
        resourceId,
        userId: context.userId,
        tenantId: context.tenantId,
        correlationId: context.correlationId
      });
    } catch (error) {
      // Don't fail the operation if audit logging fails
      logger.warn('Failed to create audit log', {
        service: this.serviceName,
        action,
        resourceType,
        resourceId,
        error: error instanceof Error ? error.message : String(error),
        correlationId: context.correlationId
      });
    }
  }

  /**
   * Safe database transaction wrapper
   */
  protected async withTransaction<T>(
    operation: (tx: any) => Promise<T>,
    context?: RequestContext
  ): Promise<T> {
    try {
      return await this.prisma.$transaction(operation);
    } catch (error) {
      this.handleError(error, 'transaction', context);
    }
  }

  /**
   * Validate required fields
   */
  protected validateRequired(data: any, requiredFields: string[]): void {
    const missing = requiredFields.filter(field => 
      data[field] === undefined || data[field] === null || data[field] === ''
    );

    if (missing.length > 0) {
      throw new ValidationError(`Missing required fields: ${missing.join(', ')}`, { missing });
    }
  }

  /**
   * Sanitize input data
   */
  protected sanitizeInput(data: any): any {
    if (typeof data === 'string') {
      return data.trim().replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    }
    
    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeInput(item));
    }
    
    if (data && typeof data === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(data)) {
        sanitized[key] = this.sanitizeInput(value);
      }
      return sanitized;
    }
    
    return data;
  }

  /**
   * Standard success response format
   */
  protected formatResponse<T>(data: T, meta?: any) {
    return {
      data,
      ...(meta && { meta })
    };
  }

  /**
   * Check if resource exists and user has access
   */
  protected async findResourceWithAccess<T>(
    model: any,
    id: string,
    context: RequestContext,
    include?: any
  ): Promise<T> {
    const resource = await model.findUnique({
      where: { id },
      ...(include && { include })
    });

    if (!resource) {
      throw new NotFoundError('Resource not found');
    }

    this.validateTenantAccess(resource.tenantId, context);
    return resource;
  }

  /**
   * Batch operation helper
   */
  protected async processBatch<T, R>(
    items: T[],
    processor: (item: T, index: number) => Promise<R>,
    batchSize: number = 10
  ): Promise<{ results: R[]; errors: Array<{ index: number; error: string }> }> {
    const results: R[] = [];
    const errors: Array<{ index: number; error: string }> = [];

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchPromises = batch.map(async (item, batchIndex) => {
        const globalIndex = i + batchIndex;
        try {
          const result = await processor(item, globalIndex);
          results[globalIndex] = result;
        } catch (error) {
          errors.push({
            index: globalIndex,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      });

      await Promise.all(batchPromises);
    }

    return { results, errors };
  }

  /**
   * Rate limiting check
   */
  protected async checkRateLimit(
    key: string,
    limit: number,
    windowMs: number
  ): Promise<boolean> {
    // Implementation would depend on Redis or in-memory store
    // For now, return true (no rate limiting)
    return true;
  }

  /**
   * Cache helper methods
   */
  protected getCacheKey(prefix: string, ...parts: string[]): string {
    return `${this.serviceName}:${prefix}:${parts.join(':')}`;
  }

  protected async getFromCache<T>(key: string): Promise<T | null> {
    // Implementation would depend on Redis
    // For now, return null (no caching)
    return null;
  }

  protected async setCache<T>(key: string, value: T, ttlSeconds: number = 300): Promise<void> {
    // Implementation would depend on Redis
    // For now, do nothing
  }

  protected async invalidateCache(pattern: string): Promise<void> {
    // Implementation would depend on Redis
    // For now, do nothing
  }
}

/**
 * Service factory for dependency injection
 */
export class ServiceFactory {
  private static instance: ServiceFactory;
  private services: Map<string, any> = new Map();

  static getInstance(): ServiceFactory {
    if (!ServiceFactory.instance) {
      ServiceFactory.instance = new ServiceFactory();
    }
    return ServiceFactory.instance;
  }

  register<T>(name: string, service: T): void {
    this.services.set(name, service);
  }

  get<T>(name: string): T {
    const service = this.services.get(name);
    if (!service) {
      throw new Error(`Service ${name} not registered`);
    }
    return service;
  }
}