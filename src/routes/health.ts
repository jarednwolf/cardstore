import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { logger } from '../config/logger';

const router = Router();

interface HealthCheck {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  version: string;
  environment: string;
  uptime: number;
  checks: {
    database: {
      status: 'healthy' | 'unhealthy';
      responseTime?: number;
      error?: string;
      message?: string;
    };
    memory: {
      status: 'healthy' | 'unhealthy';
      usage: {
        rss: number;
        heapTotal: number;
        heapUsed: number;
        external: number;
      };
    };
  } | any[];
}

interface ComprehensiveHealthCheck {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  version: string;
  environment: string;
  uptime: number;
  checks: Array<{
    name: string;
    status: 'healthy' | 'unhealthy' | 'warning';
    message: string;
    responseTime?: number;
    error?: string;
    details?: any;
  }>;
}

// Basic health check
router.get('/', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const healthCheck: any = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: env.API_VERSION,
      environment: env.NODE_ENV,
      uptime: process.uptime(),
      checks: {
        database: {
          status: 'healthy',
        },
        memory: {
          status: 'healthy',
          usage: process.memoryUsage(),
        },
      },
    };

    // Test database connection
    try {
      const dbStart = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      healthCheck.checks.database.responseTime = Date.now() - dbStart;
    } catch (error) {
      healthCheck.status = 'unhealthy';
      healthCheck.checks.database.status = 'unhealthy';
      healthCheck.checks.database.error = error instanceof Error ? error.message : 'Unknown error';
    }

    // Check memory usage
    const memoryUsage = process.memoryUsage();
    const memoryThreshold = 1024 * 1024 * 1024; // 1GB
    if (memoryUsage.heapUsed > memoryThreshold) {
      healthCheck.status = 'unhealthy';
      healthCheck.checks.memory.status = 'unhealthy';
    }

    const statusCode = healthCheck.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(healthCheck);

  } catch (error) {
    logger.error('Health check failed', { error });
    
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      version: env.API_VERSION,
      environment: env.NODE_ENV,
      uptime: process.uptime(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Readiness check (for Kubernetes)
router.get('/ready', async (req: Request, res: Response) => {
  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1`;
    
    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Readiness check failed', { error });
    
    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Liveness check (for Kubernetes)
router.get('/live', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Comprehensive health check (for frontend dashboard)
router.post('/run', async (req: Request, res: Response) => {
  try {
    const healthCheck: ComprehensiveHealthCheck = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: env.API_VERSION,
      environment: env.NODE_ENV,
      uptime: process.uptime(),
      checks: []
    };

    const checks: Array<{
      name: string;
      status: 'healthy' | 'unhealthy' | 'warning';
      message: string;
      responseTime?: number;
      error?: string;
      details?: any;
    }> = [];

    // Database check
    try {
      const dbStart = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      checks.push({
        name: 'Database Connection',
        status: 'healthy',
        message: 'PostgreSQL database is accessible',
        responseTime: Date.now() - dbStart
      });
    } catch (error) {
      checks.push({
        name: 'Database Connection',
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Database connection failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      healthCheck.status = 'unhealthy';
    }

    // Memory check
    const memoryUsage = process.memoryUsage();
    const memoryThreshold = 1024 * 1024 * 1024; // 1GB
    const memoryStatus = memoryUsage.heapUsed > memoryThreshold ? 'warning' : 'healthy';
    checks.push({
      name: 'Memory Usage',
      status: memoryStatus,
      message: `Heap used: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
      details: memoryUsage
    });

    // Environment file check
    try {
      const fs = require('fs');
      const envExists = fs.existsSync('.env');
      checks.push({
        name: 'Environment Configuration',
        status: envExists ? 'healthy' : 'unhealthy',
        message: envExists ? 'Environment file found' : 'Environment file (.env) not found'
      });
    } catch (error) {
      checks.push({
        name: 'Environment Configuration',
        status: 'unhealthy',
        message: 'Failed to check environment file'
      });
    }

    // Node.js version check
    checks.push({
      name: 'Node.js Version',
      status: 'healthy',
      message: `Node.js ${process.version}`,
      details: {
        version: process.version,
        platform: process.platform,
        arch: process.arch
      }
    });

    healthCheck.checks = checks;
    
    const statusCode = healthCheck.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json({
      success: true,
      data: healthCheck
    });

  } catch (error) {
    logger.error('Comprehensive health check failed', { error });
    
    res.status(500).json({
      success: false,
      error: 'Health check failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Detailed health check
router.get('/detailed', async (req: Request, res: Response) => {
  try {
    const healthCheck: any = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: env.API_VERSION,
      environment: env.NODE_ENV,
      uptime: process.uptime(),
      checks: {
        database: { status: 'healthy' },
        memory: { status: 'healthy', usage: process.memoryUsage() },
        environment: { status: 'healthy' },
        services: { status: 'healthy' }
      }
    };

    // Test database connection
    try {
      const dbStart = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      healthCheck.checks.database = {
        status: 'healthy',
        responseTime: Date.now() - dbStart,
        message: 'Database connection successful'
      };
    } catch (error) {
      healthCheck.status = 'unhealthy';
      healthCheck.checks.database = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Database connection failed'
      };
    }

    // Check memory usage
    const memoryUsage = process.memoryUsage();
    const memoryThreshold = 1024 * 1024 * 1024; // 1GB
    if (memoryUsage.heapUsed > memoryThreshold) {
      healthCheck.status = 'unhealthy';
      healthCheck.checks.memory.status = 'unhealthy';
    }
    healthCheck.checks.memory.usage = memoryUsage;

    const statusCode = healthCheck.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(healthCheck);

  } catch (error) {
    logger.error('Detailed health check failed', { error });
    
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      version: env.API_VERSION,
      environment: env.NODE_ENV,
      uptime: process.uptime(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export { router as healthRoutes };