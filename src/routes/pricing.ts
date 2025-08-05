import express from 'express';
import { AdvancedPricingService } from '../services/advancedPricingService';
import { authMiddleware } from '../middleware/auth';
import { validateTenant } from '../middleware/tenant';
import { body, param, query, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';

const router = express.Router();

// Apply authentication and tenant validation to all routes
router.use(authMiddleware as express.RequestHandler);
router.use(validateTenant as express.RequestHandler);

// Validation middleware
const handleValidationErrors = (req: any, res: express.Response, next: express.NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      error: 'Validation failed', 
      details: errors.array() 
    });
  }
  next();
};

// Create pricing rule
router.post('/rules',
  [
    body('name').isString().isLength({ min: 1, max: 255 }).withMessage('Name is required and must be 1-255 characters'),
    body('description').optional().isString().isLength({ max: 1000 }).withMessage('Description must be max 1000 characters'),
    body('priority').optional().isInt({ min: 0, max: 1000 }).withMessage('Priority must be between 0 and 1000'),
    body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
    body('conditions').isArray().withMessage('Conditions must be an array'),
    body('actions').isArray().withMessage('Actions must be an array'),
    body('schedule').optional().isObject().withMessage('Schedule must be an object'),
    handleValidationErrors
  ],
  async (req: any, res: express.Response) => {
    try {
      const prisma = new PrismaClient();
      const pricingService = new AdvancedPricingService(prisma);
      
      const ruleData = {
        tenantId: req.tenantId,
        name: req.body.name,
        description: req.body.description || null,
        priority: req.body.priority || 0,
        isActive: req.body.isActive !== false,
        conditions: JSON.stringify(req.body.conditions),
        actions: JSON.stringify(req.body.actions),
        schedule: req.body.schedule ? JSON.stringify(req.body.schedule) : null,
        createdBy: req.user.id,
        updatedBy: req.user.id
      };

      const rule = await prisma.pricingRule.create({
        data: ruleData
      });

      res.status(201).json({
        success: true,
        data: rule
      });
    } catch (error) {
      console.error('Error creating pricing rule:', error);
      res.status(500).json({
        error: 'Failed to create pricing rule',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// Update pricing rule
router.put('/rules/:ruleId',
  [
    param('ruleId').isString().withMessage('Rule ID is required'),
    body('name').optional().isString().isLength({ min: 1, max: 255 }).withMessage('Name must be 1-255 characters'),
    body('description').optional().isString().isLength({ max: 1000 }).withMessage('Description must be max 1000 characters'),
    body('priority').optional().isInt({ min: 0, max: 1000 }).withMessage('Priority must be between 0 and 1000'),
    body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
    body('conditions').optional().isArray().withMessage('Conditions must be an array'),
    body('actions').optional().isArray().withMessage('Actions must be an array'),
    body('schedule').optional().isObject().withMessage('Schedule must be an object'),
    handleValidationErrors
  ],
  async (req: any, res: express.Response) => {
    try {
      const prisma = new PrismaClient();
      
      const updateData: any = { ...req.body };
      if (updateData.conditions) updateData.conditions = JSON.stringify(updateData.conditions);
      if (updateData.actions) updateData.actions = JSON.stringify(updateData.actions);
      if (updateData.schedule) updateData.schedule = JSON.stringify(updateData.schedule);
      updateData.updatedBy = req.user.id;
      
      const rule = await prisma.pricingRule.update({
        where: {
          id: req.params.ruleId,
          tenantId: req.tenantId
        },
        data: updateData
      });

      res.json({
        success: true,
        data: rule
      });
    } catch (error) {
      console.error('Error updating pricing rule:', error);
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({
          error: 'Pricing rule not found'
        });
      } else {
        res.status(500).json({
          error: 'Failed to update pricing rule',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }
);

// Delete pricing rule
router.delete('/rules/:ruleId',
  [
    param('ruleId').isString().withMessage('Rule ID is required'),
    handleValidationErrors
  ],
  async (req: any, res: express.Response) => {
    try {
      const prisma = new PrismaClient();
      
      await prisma.pricingRule.delete({
        where: {
          id: req.params.ruleId,
          tenantId: req.tenantId
        }
      });

      res.json({
        success: true,
        message: 'Pricing rule deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting pricing rule:', error);
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({
          error: 'Pricing rule not found'
        });
      } else {
        res.status(500).json({
          error: 'Failed to delete pricing rule',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }
);

// Get pricing rules
router.get('/rules',
  [
    query('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    handleValidationErrors
  ],
  async (req: any, res: express.Response) => {
    try {
      const prisma = new PrismaClient();
      
      const rules = await prisma.pricingRule.findMany({
        where: {
          tenantId: req.tenantId,
          ...(req.query.isActive !== undefined && { isActive: req.query.isActive === 'true' })
        },
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'desc' }
        ]
      });

      res.json({
        success: true,
        data: rules
      });
    } catch (error) {
      console.error('Error getting pricing rules:', error);
      res.status(500).json({
        error: 'Failed to get pricing rules',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// Apply pricing rules to product
router.post('/products/:productId/apply-rules',
  [
    param('productId').isString().withMessage('Product ID is required'),
    body('marketplaces').optional().isArray().withMessage('Marketplaces must be an array'),
    handleValidationErrors
  ],
  async (req: any, res: express.Response) => {
    try {
      const prisma = new PrismaClient();
      const pricingService = new AdvancedPricingService(prisma);
      
      const result = await pricingService.applyPricingRules(
        req.tenantId,
        req.params.productId,
        req.body.marketplaces
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error applying pricing rules:', error);
      res.status(500).json({
        error: 'Failed to apply pricing rules',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// Get market prices for product
router.get('/products/:productId/market-prices',
  [
    param('productId').isString().withMessage('Product ID is required'),
    handleValidationErrors
  ],
  async (req: any, res: express.Response) => {
    try {
      // For now, return mock data
      const marketPrice = {
        productId: req.params.productId,
        prices: [
          {
            marketplace: 'amazon',
            price: 0,
            lastUpdated: new Date(),
            source: 'mock'
          }
        ],
        message: 'Market price monitoring not yet implemented'
      };

      res.json({
        success: true,
        data: marketPrice
      });
    } catch (error) {
      console.error('Error getting market prices:', error);
      res.status(500).json({
        error: 'Failed to get market prices',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// Get pricing recommendations
router.get('/products/:productId/recommendations',
  [
    param('productId').isString().withMessage('Product ID is required'),
    query('strategy').optional().isIn(['competitive', 'margin_optimization', 'market_penetration', 'premium']).withMessage('Invalid strategy'),
    handleValidationErrors
  ],
  async (req: any, res: express.Response) => {
    try {
      // For now, return a simple recommendation structure
      const recommendations = {
        productId: req.params.productId,
        strategy: req.query.strategy || 'competitive',
        recommendations: [
          {
            marketplace: 'amazon',
            currentPrice: 0,
            recommendedPrice: 0,
            reason: 'Feature not yet implemented'
          }
        ]
      };

      res.json({
        success: true,
        data: recommendations
      });
    } catch (error) {
      console.error('Error getting pricing recommendations:', error);
      res.status(500).json({
        error: 'Failed to get pricing recommendations',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// Get pricing analytics
router.get('/analytics',
  [
    query('startDate').optional().isISO8601().withMessage('Start date must be a valid ISO 8601 date'),
    query('endDate').optional().isISO8601().withMessage('End date must be a valid ISO 8601 date'),
    query('productIds').optional().isArray().withMessage('Product IDs must be an array'),
    handleValidationErrors
  ],
  async (req: any, res: express.Response) => {
    try {
      // For now, return a simple analytics structure
      const analytics = {
        period: {
          startDate: req.query.startDate ? new Date(req.query.startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          endDate: req.query.endDate ? new Date(req.query.endDate as string) : new Date()
        },
        metrics: {
          totalProducts: 0,
          averageMargin: 0,
          priceChanges: 0,
          revenueImpact: 0
        },
        message: 'Analytics feature not yet implemented'
      };

      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      console.error('Error getting pricing analytics:', error);
      res.status(500).json({
        error: 'Failed to get pricing analytics',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

export default router;