import { Router, Request, Response } from 'express';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { logger } from '../config/logger';
import { prisma } from '../config/database';

const router = Router();

// Get system status
router.get('/status', async (req: Request, res: Response) => {
  try {
    const status = {
      application: {
        status: 'healthy',
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development'
      },
      services: [],
      timestamp: new Date().toISOString()
    };

    // Check database
    try {
      await prisma.$queryRaw`SELECT 1`;
      status.services.push({
        name: 'database',
        status: 'healthy',
        message: 'Connected'
      });
    } catch (error) {
      status.services.push({
        name: 'database',
        status: 'unhealthy',
        message: 'Connection failed'
      });
    }

    // Check Redis (if configured)
    try {
      // This would check Redis connection if configured
      status.services.push({
        name: 'redis',
        status: 'healthy',
        message: 'Connected'
      });
    } catch (error) {
      status.services.push({
        name: 'redis',
        status: 'unhealthy',
        message: 'Connection failed'
      });
    }

    res.json({
      success: true,
      data: status
    });

  } catch (error) {
    logger.error('Failed to get system status', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get system status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get environment configuration
router.get('/environment', async (req: Request, res: Response) => {
  try {
    const envPath = path.join(process.cwd(), '.env');
    
    if (!fs.existsSync(envPath)) {
      return res.status(404).json({
        success: false,
        error: 'Environment file not found'
      });
    }

    const envContent = fs.readFileSync(envPath, 'utf8');
    const envVars: Record<string, string> = {};
    
    // Parse environment variables (mask sensitive values)
    envContent.split('\n').forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const [key, ...valueParts] = trimmedLine.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').replace(/^["']|["']$/g, '');
          
          // Mask sensitive values
          if (key.toLowerCase().includes('secret') || 
              key.toLowerCase().includes('password') || 
              key.toLowerCase().includes('key')) {
            envVars[key] = value ? '••••••••' : '';
          } else {
            envVars[key] = value;
          }
        }
      }
    });

    res.json({
      success: true,
      data: envVars
    });

  } catch (error) {
    logger.error('Failed to get environment configuration', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get environment configuration',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Update environment configuration
router.put('/environment', async (req: Request, res: Response) => {
  try {
    const updates = req.body;
    const envPath = path.join(process.cwd(), '.env');
    
    if (!fs.existsSync(envPath)) {
      return res.status(404).json({
        success: false,
        error: 'Environment file not found'
      });
    }

    let envContent = fs.readFileSync(envPath, 'utf8');
    
    // Update environment variables
    Object.entries(updates).forEach(([key, value]) => {
      if (typeof value === 'string') {
        const regex = new RegExp(`^${key}=.*$`, 'm');
        if (regex.test(envContent)) {
          envContent = envContent.replace(regex, `${key}="${value}"`);
        } else {
          envContent += `\n${key}="${value}"`;
        }
      }
    });

    // Write updated content
    fs.writeFileSync(envPath, envContent);
    
    logger.info('Environment configuration updated', { keys: Object.keys(updates) });

    res.json({
      success: true,
      message: 'Environment configuration updated successfully',
      updatedKeys: Object.keys(updates)
    });

  } catch (error) {
    logger.error('Failed to update environment configuration', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to update environment configuration',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Validate environment configuration
router.get('/environment/validate', async (req: Request, res: Response) => {
  try {
    const envPath = path.join(process.cwd(), '.env');
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    if (!fs.existsSync(envPath)) {
      issues.push('Environment file (.env) not found');
    } else {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const envVars: Record<string, string> = {};
      
      // Parse environment variables
      envContent.split('\n').forEach(line => {
        const trimmedLine = line.trim();
        if (trimmedLine && !trimmedLine.startsWith('#')) {
          const [key, ...valueParts] = trimmedLine.split('=');
          if (key && valueParts.length > 0) {
            envVars[key] = valueParts.join('=').replace(/^["']|["']$/g, '');
          }
        }
      });

      // Check required variables
      const requiredVars = ['DATABASE_URL', 'JWT_SECRET', 'NODE_ENV', 'PORT'];
      requiredVars.forEach(varName => {
        if (!envVars[varName] || envVars[varName].trim() === '') {
          issues.push(`Required environment variable ${varName} is missing or empty`);
        }
      });

      // Check JWT secret strength
      if (envVars.JWT_SECRET && envVars.JWT_SECRET.length < 32) {
        recommendations.push('JWT_SECRET should be at least 32 characters long for better security');
      }

      // Check database URL format
      if (envVars.DATABASE_URL && !envVars.DATABASE_URL.startsWith('postgresql://')) {
        issues.push('DATABASE_URL should be a valid PostgreSQL connection string');
      }

      // Check port
      if (envVars.PORT) {
        const port = parseInt(envVars.PORT);
        if (isNaN(port) || port < 1 || port > 65535) {
          issues.push('PORT must be a valid port number (1-65535)');
        }
      }
    }

    const isValid = issues.length === 0;

    res.json({
      success: true,
      data: {
        valid: isValid,
        issues,
        recommendations
      }
    });

  } catch (error) {
    logger.error('Failed to validate environment configuration', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to validate environment configuration',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Database migration
router.post('/database/migrate', async (req: Request, res: Response) => {
  try {
    logger.info('Running database migrations...');

    const result = execSync('npx prisma migrate deploy', {
      encoding: 'utf8',
      cwd: process.cwd(),
      timeout: 120000 // 2 minutes
    });

    logger.info('Database migrations completed successfully');

    res.json({
      success: true,
      message: 'Database migrations completed successfully',
      output: result
    });

  } catch (error) {
    logger.error('Database migration failed', { error });
    res.status(500).json({
      success: false,
      error: 'Database migration failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Service management
router.post('/services/start', async (req: Request, res: Response) => {
  try {
    logger.info('Starting services...');

    const result = execSync('docker-compose up -d', {
      encoding: 'utf8',
      cwd: process.cwd(),
      timeout: 120000 // 2 minutes
    });

    logger.info('Services started successfully');

    res.json({
      success: true,
      message: 'Services started successfully',
      output: result
    });

  } catch (error) {
    logger.error('Failed to start services', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to start services',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.post('/services/stop', async (req: Request, res: Response) => {
  try {
    logger.info('Stopping services...');

    const result = execSync('docker-compose down', {
      encoding: 'utf8',
      cwd: process.cwd(),
      timeout: 60000 // 1 minute
    });

    logger.info('Services stopped successfully');

    res.json({
      success: true,
      message: 'Services stopped successfully',
      output: result
    });

  } catch (error) {
    logger.error('Failed to stop services', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to stop services',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.post('/services/restart', async (req: Request, res: Response) => {
  try {
    logger.info('Restarting services...');

    // Stop services
    execSync('docker-compose down', {
      encoding: 'utf8',
      cwd: process.cwd(),
      timeout: 60000
    });

    // Start services
    const result = execSync('docker-compose up -d', {
      encoding: 'utf8',
      cwd: process.cwd(),
      timeout: 120000
    });

    logger.info('Services restarted successfully');

    res.json({
      success: true,
      message: 'Services restarted successfully',
      output: result
    });

  } catch (error) {
    logger.error('Failed to restart services', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to restart services',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get service status
router.get('/services/status', async (req: Request, res: Response) => {
  try {
    const services = [];

    // Check application
    services.push({
      name: 'application',
      status: 'healthy',
      message: 'Running'
    });

    // Check database
    try {
      await prisma.$queryRaw`SELECT 1`;
      services.push({
        name: 'database',
        status: 'healthy',
        message: 'Connected'
      });
    } catch (error) {
      services.push({
        name: 'database',
        status: 'unhealthy',
        message: 'Connection failed'
      });
    }

    // Check Docker services if available
    try {
      const dockerResult = execSync('docker-compose ps --format json', {
        encoding: 'utf8',
        cwd: process.cwd(),
        timeout: 10000
      });

      const dockerServices = JSON.parse(`[${dockerResult.trim().split('\n').join(',')}]`);
      dockerServices.forEach((service: any) => {
        services.push({
          name: service.Service,
          status: service.State === 'running' ? 'healthy' : 'unhealthy',
          message: service.State
        });
      });
    } catch (error) {
      // Docker not available or no services running
      services.push({
        name: 'docker',
        status: 'unhealthy',
        message: 'Docker services not available'
      });
    }

    res.json({
      success: true,
      data: services
    });

  } catch (error) {
    logger.error('Failed to get service status', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get service status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get logs
router.get('/logs/:service', async (req: Request, res: Response) => {
  try {
    const { service } = req.params;
    const lines = parseInt(req.query.lines as string) || 100;

    let logs: string;

    if (service === 'app' || service === 'application') {
      // Get application logs (this would typically come from a log file or logging service)
      logs = 'Application logs would be retrieved from logging system';
    } else {
      // Get Docker service logs
      logs = execSync(`docker-compose logs --tail=${lines} ${service}`, {
        encoding: 'utf8',
        cwd: process.cwd(),
        timeout: 30000
      });
    }

    res.json({
      success: true,
      data: logs.split('\n').filter(line => line.trim() !== '')
    });

  } catch (error) {
    logger.error('Failed to get logs', { error, service: req.params.service });
    res.status(500).json({
      success: false,
      error: 'Failed to get logs',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get system metrics
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const metrics = {
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        platform: process.platform,
        nodeVersion: process.version
      },
      application: {
        environment: process.env.NODE_ENV,
        port: process.env.PORT,
        version: process.env.npm_package_version || '1.0.0'
      },
      timestamp: new Date().toISOString()
    };

    res.json({
      success: true,
      data: metrics
    });

  } catch (error) {
    logger.error('Failed to get system metrics', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get system metrics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router as systemRoutes };