import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { asyncHandler } from '../middleware/errorHandler';
import { billingService, SUBSCRIPTION_PLANS } from '../services/billingService';
import { logger } from '../config/logger';

const router = Router();

// Get available subscription plans
router.get('/plans', asyncHandler(async (req: Request, res: Response) => {
  res.json({
    data: {
      plans: SUBSCRIPTION_PLANS.map(plan => ({
        id: plan.id,
        name: plan.name,
        price: plan.price,
        interval: plan.interval,
        features: plan.features
      }))
    }
  });
}));

// Get current subscription status
router.get('/subscription', asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  
  try {
    const usageStats = await billingService.getUsageStats(user.tenantId);
    
    // Get tenant billing info from settings
    const { prisma } = await import('../config/database');
    const tenant = await prisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: { settings: true }
    });
    
    let billing = {};
    if (tenant?.settings) {
      try {
        const settings = typeof tenant.settings === 'string' 
          ? JSON.parse(tenant.settings) 
          : tenant.settings;
        billing = settings.billing || {};
      } catch {
        billing = {};
      }
    }
    
    res.json({
      data: {
        subscription: billing,
        usage: usageStats,
        plans: SUBSCRIPTION_PLANS
      }
    });
  } catch (error) {
    logger.error('Failed to get subscription status', { error, tenantId: user.tenantId });
    res.status(500).json({
      error: {
        code: 'SUBSCRIPTION_ERROR',
        message: 'Failed to retrieve subscription information',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || '',
      }
    });
  }
}));

// Create a new subscription
router.post('/subscribe', [
  body('planId').isIn(SUBSCRIPTION_PLANS.map(p => p.id)).withMessage('Invalid plan ID'),
  body('paymentMethodId').optional().isString().withMessage('Payment method ID must be a string')
], asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input data',
        details: errors.array(),
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || '',
      }
    });
  }

  const { planId } = req.body;
  const user = req.user!;
  
  try {
    const plan = SUBSCRIPTION_PLANS.find(p => p.id === planId);
    if (!plan) {
      return res.status(400).json({
        error: {
          code: 'INVALID_PLAN',
          message: 'Invalid subscription plan',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || '',
        }
      });
    }

    // Create or get Stripe customer
    let customerId: string;
    
    // Check if customer already exists
    const { prisma } = await import('../config/database');
    const tenant = await prisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: { settings: true }
    });
    
    let existingCustomerId: string | null = null;
    if (tenant?.settings) {
      try {
        const settings = typeof tenant.settings === 'string' 
          ? JSON.parse(tenant.settings) 
          : tenant.settings;
        existingCustomerId = settings.billing?.stripeCustomerId;
      } catch {
        // Ignore parsing errors
      }
    }
    
    if (existingCustomerId) {
      customerId = existingCustomerId;
    } else {
      const customer = await billingService.createCustomer(
        user.email,
        user.name || 'Unknown',
        user.tenantId
      );
      customerId = customer.id;
    }
    
    // Create subscription
    const subscription = await billingService.createSubscription(
      customerId,
      plan.stripePriceId,
      user.tenantId
    );
    
    res.json({
      data: {
        subscriptionId: subscription.id,
        clientSecret: (subscription.latest_invoice as any)?.payment_intent?.client_secret,
        status: subscription.status
      }
    });
  } catch (error) {
    logger.error('Failed to create subscription', { error, planId, tenantId: user.tenantId });
    res.status(500).json({
      error: {
        code: 'SUBSCRIPTION_ERROR',
        message: 'Failed to create subscription',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || '',
      }
    });
  }
}));

// Update subscription plan
router.put('/subscription', [
  body('planId').isIn(SUBSCRIPTION_PLANS.map(p => p.id)).withMessage('Invalid plan ID')
], asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input data',
        details: errors.array(),
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || '',
      }
    });
  }

  const { planId } = req.body;
  const user = req.user!;
  
  try {
    const plan = SUBSCRIPTION_PLANS.find(p => p.id === planId);
    if (!plan) {
      return res.status(400).json({
        error: {
          code: 'INVALID_PLAN',
          message: 'Invalid subscription plan',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || '',
        }
      });
    }

    // Get current subscription ID
    const { prisma } = await import('../config/database');
    const tenant = await prisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: { settings: true }
    });
    
    let subscriptionId: string | null = null;
    if (tenant?.settings) {
      try {
        const settings = typeof tenant.settings === 'string' 
          ? JSON.parse(tenant.settings) 
          : tenant.settings;
        subscriptionId = settings.billing?.stripeSubscriptionId;
      } catch {
        // Ignore parsing errors
      }
    }
    
    if (!subscriptionId) {
      return res.status(400).json({
        error: {
          code: 'NO_SUBSCRIPTION',
          message: 'No active subscription found',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || '',
        }
      });
    }
    
    const subscription = await billingService.updateSubscription(
      subscriptionId,
      plan.stripePriceId,
      user.tenantId
    );
    
    res.json({
      data: {
        subscription: {
          id: subscription.id,
          status: subscription.status,
          planId: planId
        }
      }
    });
  } catch (error) {
    logger.error('Failed to update subscription', { error, planId, tenantId: user.tenantId });
    res.status(500).json({
      error: {
        code: 'SUBSCRIPTION_ERROR',
        message: 'Failed to update subscription',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || '',
      }
    });
  }
}));

// Cancel subscription
router.delete('/subscription', asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  
  try {
    // Get current subscription ID
    const { prisma } = await import('../config/database');
    const tenant = await prisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: { settings: true }
    });
    
    let subscriptionId: string | null = null;
    if (tenant?.settings) {
      try {
        const settings = typeof tenant.settings === 'string' 
          ? JSON.parse(tenant.settings) 
          : tenant.settings;
        subscriptionId = settings.billing?.stripeSubscriptionId;
      } catch {
        // Ignore parsing errors
      }
    }
    
    if (!subscriptionId) {
      return res.status(400).json({
        error: {
          code: 'NO_SUBSCRIPTION',
          message: 'No active subscription found',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || '',
        }
      });
    }
    
    const subscription = await billingService.cancelSubscription(subscriptionId, user.tenantId);
    
    res.json({
      data: {
        subscription: {
          id: subscription.id,
          status: subscription.status,
          cancelAtPeriodEnd: subscription.cancel_at_period_end
        }
      }
    });
  } catch (error) {
    logger.error('Failed to cancel subscription', { error, tenantId: user.tenantId });
    res.status(500).json({
      error: {
        code: 'SUBSCRIPTION_ERROR',
        message: 'Failed to cancel subscription',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || '',
      }
    });
  }
}));

// Create billing portal session
router.post('/portal', asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  
  try {
    // Get customer ID
    const { prisma } = await import('../config/database');
    const tenant = await prisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: { settings: true }
    });
    
    let customerId: string | null = null;
    if (tenant?.settings) {
      try {
        const settings = typeof tenant.settings === 'string' 
          ? JSON.parse(tenant.settings) 
          : tenant.settings;
        customerId = settings.billing?.stripeCustomerId;
      } catch {
        // Ignore parsing errors
      }
    }
    
    if (!customerId) {
      return res.status(400).json({
        error: {
          code: 'NO_CUSTOMER',
          message: 'No billing account found',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || '',
        }
      });
    }
    
    const returnUrl = `${req.protocol}://${req.get('host')}/dashboard.html?tab=billing`;
    const session = await billingService.createPortalSession(customerId, returnUrl);
    
    res.json({
      data: {
        url: session.url
      }
    });
  } catch (error) {
    logger.error('Failed to create portal session', { error, tenantId: user.tenantId });
    res.status(500).json({
      error: {
        code: 'PORTAL_ERROR',
        message: 'Failed to create billing portal session',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || '',
      }
    });
  }
}));

// Stripe webhook endpoint
router.post('/webhook', asyncHandler(async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;
  const webhookSecret = process.env['STRIPE_WEBHOOK_SECRET'];
  
  if (!webhookSecret) {
    logger.error('Stripe webhook secret not configured');
    return res.status(500).json({ error: 'Webhook not configured' });
  }
  
  try {
    const stripe = (await import('stripe')).default;
    const stripeInstance = new stripe(process.env['STRIPE_SECRET_KEY']!, {
      apiVersion: '2025-07-30.basil',
    });
    
    const event = stripeInstance.webhooks.constructEvent(req.body, sig, webhookSecret);
    
    await billingService.handleWebhook(event);
    
    res.json({ received: true });
  } catch (error) {
    logger.error('Webhook signature verification failed', { error });
    res.status(400).json({ error: 'Invalid signature' });
  }
}));

export { router as billingRoutes };