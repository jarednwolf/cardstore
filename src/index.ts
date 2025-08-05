import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { env } from './config/env';
import { logger } from './config/logger';
import { prisma } from './config/database';
import { errorHandler } from './middleware/errorHandler';
// import { requestLogger } from './middleware/requestLogger';
import { correlationIdMiddleware, correlationErrorMiddleware } from './middleware/correlationId';
import { apiTrackingMiddleware } from './middleware/apiTracking';
import { authMiddleware } from './middleware/auth';
import { tenantMiddleware } from './middleware/tenant';
import { websocketService } from './services/websocketService';
import { automationService } from './services/automationService';

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
import pricingRoutes from './routes/pricing';
import marketplaceRoutes from './routes/marketplace';
import automationRoutes from './routes/automation';

class Application {
  public app: express.Application;
  private server: any;
  private httpServer: any;

  constructor() {
    this.app = express();
    this.httpServer = createServer(this.app);
    this.initializeMiddleware();
    this.initializeRoutes();
    this.initializeErrorHandling();
    this.initializeWebSocket();
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
          scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.socket.io"],
          scriptSrcAttr: ["'unsafe-inline'"],
          connectSrc: ["'self'", "ws://localhost:3005", "http://localhost:3005"],
          imgSrc: ["'self'", "data:", "https:"],
          fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
        },
      },
    }));

    // CORS configuration - more restrictive and secure
    this.app.use(cors({
      origin: (origin, callback) => {
        const allowedOrigins = process.env['NODE_ENV'] === 'production'
          ? [
              'https://cardstore-woad.vercel.app',
              'https://deckstack.com',
              'https://www.deckstack.com',
              ...(process.env['CORS_ORIGIN'] ? process.env['CORS_ORIGIN'].split(',') : [])
            ]
          : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3005'];
        
        // Allow requests with no origin (mobile apps, etc.)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID', 'X-Correlation-ID'],
      maxAge: 86400, // 24 hours
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
    apiRouter.use('/pricing', pricingRoutes);
    apiRouter.use('/marketplace', marketplaceRoutes);
    apiRouter.use('/automation', automationRoutes);
    apiRouter.use('/orders', orderRoutes);
    apiRouter.use('/shipping', shippingRoutes);

    this.app.use(`/api/${env.API_VERSION}`, apiRouter);

    // WebSocket status endpoint
    this.app.get('/ws', (_req, res) => {
      res.status(200).json({
        message: 'WebSocket server is running',
        connectedClients: websocketService.getConnectedClientCount(),
        timestamp: new Date().toISOString()
      });
    });

    // Serve frontend for all other routes (SPA fallback)
    this.app.get('*', (_req, res) => {
      res.sendFile('index.html', { root: 'frontend' });
    });
  }

  private initializeErrorHandling(): void {
    // Add correlation ID to error responses
    this.app.use(correlationErrorMiddleware() as any);
    this.app.use(errorHandler);
  }

  private initializeWebSocket(): void {
    try {
      // Initialize WebSocket service
      websocketService.initialize(this.httpServer);
      
      // Connect automation service events to WebSocket
      this.setupAutomationWebSocketIntegration();
      
      logger.info('WebSocket service initialized successfully');
    } catch (error: any) {
      logger.error('Failed to initialize WebSocket service', { error: error.message });
    }
  }

  private setupAutomationWebSocketIntegration(): void {
    // Listen for automation events and broadcast via WebSocket
    automationService.on('automation.started', (data) => {
      websocketService.broadcastAutomationStatus(true, data);
    });

    automationService.on('automation.stopped', (data) => {
      websocketService.broadcastAutomationStatus(false, data);
    });

    automationService.on('order.stage.updated', (data) => {
      websocketService.broadcastAutomationEvent({
        type: this.mapStageToEventType(data.stage),
        orderId: data.orderId,
        timestamp: data.timestamp,
        data: data.data
      });
    });

    // Listen for WebSocket automation control events
    websocketService.on('automation:start', () => {
      automationService.startAutomation().catch(error => {
        logger.error('Failed to start automation from WebSocket', { error: error.message });
      });
    });

    websocketService.on('automation:stop', () => {
      automationService.stopAutomation().catch(error => {
        logger.error('Failed to stop automation from WebSocket', { error: error.message });
      });
    });

    websocketService.on('automation:test', () => {
      // Simulate a test order for demonstration
      const testOrder = {
        id: `test_${Date.now()}`,
        order_number: `TEST-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
        line_items: [
          {
            variant_id: 'test_variant_1',
            sku: 'TEST-SKU-001',
            title: 'Test Product',
            quantity: 1,
            properties: [{ name: 'location', value: 'A1-B2' }]
          }
        ],
        customer: {
          first_name: 'Test',
          last_name: 'Customer',
          email: 'test@example.com'
        },
        shipping_address: {
          company: 'Test Company'
        },
        note: 'This is a test order for automation testing',
        tags: ['test', 'automation']
      };

      automationService.processShopifyOrder(testOrder, 'default').catch(error => {
        logger.error('Failed to process test order', { error: error.message });
      });
    });

    logger.info('Automation WebSocket integration setup complete');
  }

  private mapStageToEventType(stage: string): any {
    switch (stage) {
      case 'received':
        return 'order_received';
      case 'validated':
        return 'order_validated';
      case 'synced':
        return 'inventory_synced';
      case 'printed':
        return 'receipt_printed';
      case 'complete':
        return 'order_complete';
      case 'failed':
        return 'error';
      default:
        return 'order_received';
    }
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
      this.server = this.httpServer.listen(env.PORT, () => {
        logger.info(`DeckStack started`, {
          port: env.PORT,
          environment: env.NODE_ENV,
          version: env.API_VERSION,
          websocket: 'enabled'
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
            // Shutdown WebSocket service
            websocketService.shutdown();
            logger.info('WebSocket service shut down');

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