import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { logger } from './config/logger';
import { prisma } from './config/database';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { correlationIdMiddleware, correlationErrorMiddleware } from './middleware/correlationId';
import { apiTrackingMiddleware } from './middleware/apiTracking';
import { authMiddleware } from './middleware/auth';
import { tenantMiddleware } from './middleware/tenant';

// Import route handlers
import { healthRoutes } from './routes/health';
import { authRoutes } from './routes/auth';
import { productRoutes } from './routes/products';
import { inventoryRoutes } from './routes/inventory';
import { orderRoutes } from './routes/orders';
import { shippingRoutes } from './routes/shipping';
import { webhookRoutes } from './routes/webhooks';
import { onboardingRoutes } from './routes/onboarding';
import { systemRoutes } from './routes/system';
import tenantRoutes from './routes/tenants';
import userRoutes from './routes/users';
import { billingRoutes } from './routes/billing';
import { transferRoutes } from './routes/transfers';
import { analyticsRoutes } from './routes/analytics';

class Application {
  public app: express.Application;
  private server: any;

  constructor() {
    this.app = express();
    this.initializeMiddleware();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private initializeMiddleware(): void {
    // Security middleware with relaxed CSP for development
    this.app.use(helmet({
      contentSecurityPolicy: process.env['NODE_ENV'] === 'production' ? {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
        },
      } : {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          scriptSrcAttr: ["'unsafe-inline'"],
          connectSrc: ["'self'", "ws://localhost:3005", "http://localhost:3005"],
          imgSrc: ["'self'", "data:", "https:"],
          fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
        },
      },
    }));

    // CORS configuration
    this.app.use(cors({
      origin: process.env['NODE_ENV'] === 'production'
        ? [
            'https://cardstore-woad.vercel.app',
            'https://deckstack.com',
            'https://www.deckstack.com',
            ...(process.env['CORS_ORIGIN'] ? process.env['CORS_ORIGIN'].split(',') : [])
          ]
        : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3005'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID'],
    }));

    // Compression
    this.app.use(compression());

    // Rate limiting
    const limiter = rateLimit({
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      max: env.RATE_LIMIT_MAX_REQUESTS,
      message: {
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests from this IP, please try again later.',
          timestamp: new Date().toISOString(),
          requestId: '',
        },
      },
      standardHeaders: true,
      legacyHeaders: false,
    });
    this.app.use('/api', limiter);

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Correlation ID tracking (must be first to ensure all requests have correlation IDs)
    this.app.use(correlationIdMiddleware() as any);

    // API call tracking for billing and analytics
    this.app.use(apiTrackingMiddleware());

    // Trust proxy for accurate IP addresses
    this.app.set('trust proxy', 1);
  }

  private initializeRoutes(): void {
    // Serve static frontend files
    this.app.use(express.static('frontend'));

    // Health check routes (no auth required)
    this.app.use('/health', healthRoutes);

    // Webhook routes (special auth handling)
    this.app.use('/webhooks', webhookRoutes);

    // Authentication routes
    this.app.use('/api/auth', authRoutes);

    // Onboarding routes (no auth required for setup)
    this.app.use('/api/v1/onboarding', onboardingRoutes);

    // System management routes (no auth required for setup)
    this.app.use('/api/v1/system', systemRoutes);

    // Enhanced health check route
    this.app.use('/api/v1/health', healthRoutes);

    // Protected API routes
    const apiRouter = express.Router();
    
    // Apply authentication and tenant middleware to all API routes
    apiRouter.use(authMiddleware as any);
    apiRouter.use(tenantMiddleware as any);

    // API routes
    apiRouter.use('/tenants', tenantRoutes);
    apiRouter.use('/users', userRoutes);
    apiRouter.use('/billing', billingRoutes);
    apiRouter.use('/products', productRoutes);
    apiRouter.use('/inventory', inventoryRoutes);
    apiRouter.use('/transfers', transferRoutes);
    apiRouter.use('/analytics', analyticsRoutes);
    apiRouter.use('/orders', orderRoutes);
    apiRouter.use('/shipping', shippingRoutes);

    this.app.use(`/api/${env.API_VERSION}`, apiRouter);

    // Simple WebSocket endpoint (returns 200 for now)
    this.app.get('/ws', (req, res) => {
      res.status(200).json({
        message: 'WebSocket endpoint - upgrade to WebSocket not implemented yet',
        timestamp: new Date().toISOString()
      });
    });

    // Serve frontend for all other routes (SPA fallback)
    this.app.get('*', (req, res) => {
      res.sendFile('index.html', { root: 'frontend' });
    });
  }

  private initializeErrorHandling(): void {
    // Add correlation ID to error responses
    this.app.use(correlationErrorMiddleware() as any);
    this.app.use(errorHandler);
  }

  public async start(): Promise<void> {
    try {
      // Test database connection (but don't fail if database doesn't exist during setup)
      try {
        await prisma.$connect();
        logger.info('Database connected successfully');
      } catch (error: any) {
        if (error.code === 'P1010') {
          logger.warn('Database does not exist - application will start in setup mode');
        } else {
          logger.error('Database connection failed', { error: error.message });
          // Don't exit - allow setup wizard to handle database creation
        }
      }

      // Start server
      this.server = this.app.listen(env.PORT, () => {
        logger.info(`DeckStack started`, {
          port: env.PORT,
          environment: env.NODE_ENV,
          version: env.API_VERSION,
        });
      });

      // Graceful shutdown handling
      this.setupGracefulShutdown();

    } catch (error) {
      logger.error('Failed to start application', { error });
      process.exit(1);
    }
  }

  private setupGracefulShutdown(): void {
    const gracefulShutdown = async (signal: string) => {
      logger.info(`Received ${signal}, starting graceful shutdown...`);

      // Stop accepting new connections
      if (this.server) {
        this.server.close(async () => {
          logger.info('HTTP server closed');

          try {
            // Close database connections
            await prisma.$disconnect();
            logger.info('Database connections closed');

            logger.info('Graceful shutdown completed');
            process.exit(0);
          } catch (error) {
            logger.error('Error during graceful shutdown', { error });
            process.exit(1);
          }
        });
      }

      // Force shutdown after 30 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception', { error });
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection', { reason, promise });
      process.exit(1);
    });
  }
}

// Start the application
const application = new Application();

// For serverless environments, export the Express app
export const app = application.app;
export default application;

// Only start the server if not in serverless environment
if (process.env['VERCEL'] !== '1') {
  application.start().catch((error) => {
    logger.error('Failed to start application', { error });
    process.exit(1);
  });
}