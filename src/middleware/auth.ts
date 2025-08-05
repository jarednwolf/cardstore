import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { UnauthorizedError, ForbiddenError } from './errorHandler';
import { JWTPayload, User, RequestContext } from '../types';
import { authService } from '../services/authService';
import { isSupabaseConfigured } from '../config/supabase';
import { v4 as uuidv4 } from 'uuid';

export interface AuthenticatedRequest extends Request {
  user?: User;
  tenantId?: string;
  context?: RequestContext;
}

/**
 * Create a RequestContext from authenticated request
 */
export function createRequestContext(req: AuthenticatedRequest): RequestContext {
  if (!req.user || !req.tenantId) {
    throw new UnauthorizedError('User context not available');
  }

  return {
    userId: req.user.id,
    tenantId: req.tenantId,
    userRole: req.user.role,
    correlationId: req.headers['x-correlation-id'] as string || uuidv4(),
    userAgent: req.headers['user-agent'] || undefined,
    ipAddress: req.ip || req.connection.remoteAddress || undefined,
    timestamp: new Date()
  };
}

export const authMiddleware = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Development and test bypass - allow requests with x-tenant-id header
    if ((env.NODE_ENV === 'development' || env.NODE_ENV === 'test') && req.headers['x-tenant-id']) {
      req.user = {
        id: 'dev-user',
        tenantId: req.headers['x-tenant-id'] as string,
        email: 'dev@example.com',
        name: 'Development User',
        role: 'owner',
        isActive: true,
        lastLoginAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      req.tenantId = req.headers['x-tenant-id'] as string;
      req.context = createRequestContext(req);
      
      logger.debug('Development auth bypass', {
        tenantId: req.tenantId,
        correlationId: req.context.correlationId
      });
      
      return next();
    }

    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or invalid authorization header');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // Development and test demo token bypass
    if ((env.NODE_ENV === 'development' || env.NODE_ENV === 'test') && token === 'demo-token-for-testing') {
      const tenantId = req.headers['x-tenant-id'] as string || 'test-tenant';
      req.user = {
        id: 'demo-user',
        tenantId: tenantId,
        email: 'demo@example.com',
        name: 'Demo User',
        role: 'owner',
        isActive: true,
        lastLoginAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      req.tenantId = tenantId;
      req.context = createRequestContext(req);
      
      logger.debug('Demo token auth bypass', {
        tenantId: req.tenantId,
        correlationId: req.context.correlationId
      });
      
      return next();
    }
    
    // If Supabase is configured, use Supabase authentication
    if (isSupabaseConfigured()) {
      try {
        const user = await authService.verifyToken(token);
        
        if (!user) {
          throw new UnauthorizedError('Invalid or expired token');
        }
        
        req.user = user;
        req.tenantId = user.tenantId;
        req.context = createRequestContext(req);
        
        logger.debug('User authenticated via Supabase', {
          userId: user.id,
          tenantId: user.tenantId,
          role: user.role,
          correlationId: req.context.correlationId
        });
        
        next();
      } catch (supabaseError) {
        logger.warn('Supabase token verification failed', { error: supabaseError });
        throw new UnauthorizedError('Invalid or expired token');
      }
    } else {
      // Fallback to JWT verification for development
      try {
        const decoded = jwt.verify(token, env.JWT_SECRET) as JWTPayload;
        
        // Create a basic user object for development
        req.user = {
          id: decoded.userId,
          email: '', // Will be populated from database
          role: 'owner', // Default role for development
          tenantId: decoded.tenantId,
          name: 'Development User',
          lastLoginAt: new Date(),
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        
        req.tenantId = decoded.tenantId;
        req.context = createRequestContext(req);
        
        logger.debug('User authenticated via JWT fallback', {
          userId: decoded.userId,
          tenantId: decoded.tenantId,
          roles: decoded.roles,
          correlationId: req.context.correlationId
        });
        
        next();
      } catch (jwtError) {
        logger.warn('Invalid JWT token', { error: jwtError });
        throw new UnauthorizedError('Invalid or expired token');
      }
    }
  } catch (error) {
    next(error);
  }
};

export const requireRole = (requiredRoles: ('owner' | 'manager' | 'staff' | 'fulfillment')[]) => {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    const userRoles = [req.user.role];
    const hasRequiredRole = requiredRoles.some(role => userRoles.includes(role));

    if (!hasRequiredRole) {
      logger.warn('Insufficient permissions', {
        userId: req.user.id,
        userRoles,
        requiredRoles,
      });
      return next(new ForbiddenError('Insufficient permissions'));
    }

    next();
  };
};

export const requirePermission = (resource: string, action: string) => {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    // For now, allow all permissions for owners and managers
    const hasPermission = req.user.role === 'owner' || req.user.role === 'manager';

    if (!hasPermission) {
      logger.warn('Insufficient permissions', {
        userId: req.user.id,
        resource,
        action,
      });
      return next(new ForbiddenError(`Permission denied for ${action} on ${resource}`));
    }

    next();
  };
};

// Optional auth middleware for public endpoints that can benefit from user context
export const optionalAuth = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      try {
        const decoded = jwt.verify(token, env.JWT_SECRET) as JWTPayload;
        
        req.user = {
          id: decoded.userId,
          email: '',
          role: 'owner',
          tenantId: decoded.tenantId,
          name: 'Optional Auth User',
          isActive: true,
          lastLoginAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        
        req.tenantId = decoded.tenantId;
      } catch (jwtError) {
        // Ignore invalid tokens for optional auth
        logger.debug('Invalid token in optional auth', { error: jwtError });
      }
    }
    
    next();
  } catch (error) {
    next(error);
  }
};