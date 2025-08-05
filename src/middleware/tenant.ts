import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { ForbiddenError, ValidationError } from './errorHandler';
import { AuthenticatedRequest } from './auth';
// import { Tenant } from '../types';

const prisma = new PrismaClient();

export interface TenantRequest extends AuthenticatedRequest {
  tenantId: string;
  tenant?: {
    id: string;
    name: string;
    subdomain: string;
    settings: any;
    isActive: boolean;
  };
}

export const tenantMiddleware = (
  req: TenantRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    // Get tenant ID from various sources (in order of preference)
    let tenantId: string | undefined;

    // 1. From authenticated user (most secure)
    if (req.user?.tenantId) {
      tenantId = req.user.tenantId;
    }

    // 2. From X-Tenant-ID header (for service-to-service calls)
    if (!tenantId) {
      tenantId = req.headers['x-tenant-id'] as string;
    }

    // 3. From query parameter (least secure, only for development)
    if (!tenantId && env.NODE_ENV === 'development') {
      tenantId = req.query['tenantId'] as string;
    }

    // 4. Use default tenant if none specified (for single-tenant deployments)
    if (!tenantId) {
      tenantId = env.DEFAULT_TENANT_ID;
    }

    if (!tenantId) {
      throw new ValidationError('Tenant ID is required');
    }

    // Validate tenant ID format (UUID, CUID, or development format)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const cuidRegex = /^c[a-z0-9]{24}$/; // CUID format: c + 24 alphanumeric characters
    const isValidDevTenant = (env.NODE_ENV === 'development' || env.NODE_ENV === 'test') && /^[a-zA-Z0-9-_]+$/.test(tenantId);
    
    if (tenantId !== env.DEFAULT_TENANT_ID && !uuidRegex.test(tenantId) && !cuidRegex.test(tenantId) && !isValidDevTenant) {
      throw new ValidationError('Invalid tenant ID format');
    }

    // Ensure user belongs to the requested tenant
    if (req.user && req.user.tenantId !== tenantId) {
      logger.warn('Tenant access denied', {
        userId: req.user.id,
        userTenantId: req.user.tenantId,
        requestedTenantId: tenantId,
      });
      throw new ForbiddenError('Access denied to requested tenant');
    }

    // Set tenant ID in request context
    req.tenantId = tenantId;

    // Set tenant context for database queries (Row Level Security)
    // This will be used by Prisma middleware to filter queries by tenant
    res.locals['tenantId'] = tenantId;

    logger.debug('Tenant context set', {
      tenantId,
      userId: req.user?.id,
    });

    next();
  } catch (error) {
    next(error);
  }
};

// Middleware to validate tenant exists and is active
export const validateTenant = async (
  req: TenantRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const tenantId = req.tenantId;
    
    if (!tenantId) {
      throw new ValidationError('Tenant ID is required for validation');
    }

    // Implement proper tenant validation against database
    const tenant = await prisma.tenant.findFirst({
      where: {
        id: tenantId,
        isActive: true
      }
    });
    
    if (!tenant) {
      throw new ForbiddenError('Invalid or inactive tenant');
    }
    
    // Check if tenant subscription is active (if billing is enabled)
    const settings = tenant.settings ? JSON.parse(tenant.settings) : {};
    const subscription = settings.subscription;
    
    if (subscription && subscription.status !== 'active') {
      throw new ForbiddenError('Tenant subscription is not active');
    }
    
    // Add tenant info to request for downstream use
    req.tenant = {
      id: tenant.id,
      name: tenant.name,
      subdomain: tenant.subdomain,
      settings: settings,
      isActive: tenant.isActive
    };
    
    logger.debug('Tenant validated successfully', {
      tenantId: tenant.id,
      tenantName: tenant.name,
      correlationId: req.headers['x-correlation-id']
    });

    next();
  } catch (error) {
    next(error);
  }
};

// Utility function to get tenant ID from request
export const getTenantId = (req: Request): string => {
  return (req as TenantRequest).tenantId || env.DEFAULT_TENANT_ID;
};