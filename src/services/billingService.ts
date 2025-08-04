import Stripe from 'stripe';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { getApiCallCount } from '../middleware/apiTracking';

const stripe = new Stripe(process.env['STRIPE_SECRET_KEY']!, {
  apiVersion: '2025-07-30.basil',
});

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  interval: 'month' | 'year';
  features: string[];
  stripePriceId: string;
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'starter',
    name: 'Beta Starter',
    price: 1500, // $15.00 in cents (50% off $30)
    interval: 'month',
    stripePriceId: process.env['STRIPE_STARTER_PRICE_ID'] || 'price_starter',
    features: [
      'Up to 5 team members',
      'Professional user management',
      'Secure multi-tenant architecture',
      'Basic reporting',
      'Email support'
    ]
  },
  {
    id: 'professional',
    name: 'Beta Professional',
    price: 5000, // $50.00 in cents (50% off $100)
    interval: 'month',
    stripePriceId: process.env['STRIPE_PROFESSIONAL_PRICE_ID'] || 'price_professional',
    features: [
      'Up to 20 team members',
      'Advanced user roles',
      'Multi-location support',
      'Priority support',
      'Inventory management (coming soon)',
      'Order processing (coming soon)'
    ]
  },
  {
    id: 'enterprise',
    name: 'Beta Enterprise',
    price: 15000, // $150.00 in cents (50% off $300)
    interval: 'month',
    stripePriceId: process.env['STRIPE_ENTERPRISE_PRICE_ID'] || 'price_enterprise',
    features: [
      'Unlimited team members',
      'Custom integrations',
      'Dedicated support',
      'Advanced analytics',
      'All future features included',
      'Priority feature requests'
    ]
  }
];

export class BillingService {
  /**
   * Create a Stripe customer for a user
   */
  async createCustomer(email: string, name: string, tenantId: string): Promise<Stripe.Customer> {
    try {
      const customer = await stripe.customers.create({
        email,
        name,
        metadata: {
          tenantId,
          source: 'deckstack'
        }
      });

      logger.info('Stripe customer created', {
        customerId: customer.id,
        email,
        tenantId
      });

      return customer;
    } catch (error) {
      logger.error('Failed to create Stripe customer', { error, email, tenantId });
      throw new Error('Failed to create customer account');
    }
  }

  /**
   * Create a subscription for a customer
   */
  async createSubscription(
    customerId: string,
    priceId: string,
    tenantId: string
  ): Promise<Stripe.Subscription> {
    try {
      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        payment_behavior: 'default_incomplete',
        payment_settings: { 
          save_default_payment_method: 'on_subscription',
          payment_method_types: ['card']
        },
        expand: ['latest_invoice.payment_intent'],
        metadata: {
          tenantId,
          source: 'deckstack'
        },
        trial_period_days: 14 // 14-day free trial
      });

      // Update tenant with subscription info
      await this.updateTenantSubscription(tenantId, {
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscription.id,
        subscriptionStatus: subscription.status,
        currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
        planId: this.getPlanIdFromPriceId(priceId)
      });

      logger.info('Subscription created', {
        subscriptionId: subscription.id,
        customerId,
        tenantId,
        priceId
      });

      return subscription;
    } catch (error) {
      logger.error('Failed to create subscription', { error, customerId, priceId, tenantId });
      throw new Error('Failed to create subscription');
    }
  }

  /**
   * Get subscription details
   */
  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    try {
      return await stripe.subscriptions.retrieve(subscriptionId, {
        expand: ['latest_invoice', 'customer']
      });
    } catch (error) {
      logger.error('Failed to retrieve subscription', { error, subscriptionId });
      throw new Error('Failed to retrieve subscription');
    }
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(subscriptionId: string, tenantId: string): Promise<Stripe.Subscription> {
    try {
      const subscription = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true
      });

      // Update tenant subscription status
      await this.updateTenantSubscription(tenantId, {
        subscriptionStatus: 'canceled',
        cancelAtPeriodEnd: true
      });

      logger.info('Subscription canceled', { subscriptionId, tenantId });
      return subscription;
    } catch (error) {
      logger.error('Failed to cancel subscription', { error, subscriptionId, tenantId });
      throw new Error('Failed to cancel subscription');
    }
  }

  /**
   * Update subscription plan
   */
  async updateSubscription(
    subscriptionId: string,
    newPriceId: string,
    tenantId: string
  ): Promise<Stripe.Subscription> {
    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      
      if (!subscription.items.data[0]?.id) {
        throw new Error('No subscription items found');
      }
      
      const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
        items: [{
          id: subscription.items.data[0].id,
          price: newPriceId,
        }],
        proration_behavior: 'create_prorations'
      });

      // Update tenant with new plan
      await this.updateTenantSubscription(tenantId, {
        planId: this.getPlanIdFromPriceId(newPriceId),
        subscriptionStatus: updatedSubscription.status
      });

      logger.info('Subscription updated', {
        subscriptionId,
        newPriceId,
        tenantId
      });

      return updatedSubscription;
    } catch (error) {
      logger.error('Failed to update subscription', { error, subscriptionId, newPriceId, tenantId });
      throw new Error('Failed to update subscription');
    }
  }

  /**
   * Create a billing portal session
   */
  async createPortalSession(customerId: string, returnUrl: string): Promise<Stripe.BillingPortal.Session> {
    try {
      return await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
      });
    } catch (error) {
      logger.error('Failed to create portal session', { error, customerId });
      throw new Error('Failed to create billing portal session');
    }
  }

  /**
   * Handle webhook events
   */
  async handleWebhook(event: Stripe.Event): Promise<void> {
    try {
      switch (event.type) {
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdate(event.data.object as Stripe.Subscription);
          break;
        
        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
          break;
        
        case 'invoice.payment_succeeded':
          await this.handlePaymentSucceeded(event.data.object as Stripe.Invoice);
          break;
        
        case 'invoice.payment_failed':
          await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
          break;
        
        default:
          logger.info('Unhandled webhook event', { type: event.type });
      }
    } catch (error) {
      logger.error('Webhook handling failed', { error, eventType: event.type });
      throw error;
    }
  }

  /**
   * Get usage statistics for a tenant
   */
  async getUsageStats(tenantId: string): Promise<{
    users: number;
    products: number;
    orders: number;
    apiCalls: number;
  }> {
    try {
      const [users, products, orders] = await Promise.all([
        prisma.user.count({ where: { tenantId } }),
        prisma.product.count({ where: { tenantId } }),
        prisma.order.count({ where: { tenantId } })
      ]);

      // Get API calls for current month
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const apiCalls = await getApiCallCount(tenantId, startOfMonth);

      return { users, products, orders, apiCalls };
    } catch (error) {
      logger.error('Failed to get usage stats', { error, tenantId });
      throw new Error('Failed to retrieve usage statistics');
    }
  }

  /**
   * Check if tenant has access to a feature
   */
  async hasFeatureAccess(tenantId: string, feature: string): Promise<boolean> {
    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          settings: true
        }
      });

      if (!tenant) return false;

      // Parse tenant settings to get billing info
      const settings = await this.getTenantSettings(tenantId);
      const billing = settings.billing || {};

      // Check if subscription is active
      if (billing.subscriptionStatus !== 'active' && billing.subscriptionStatus !== 'trialing') {
        return false;
      }

      // Check if subscription hasn't expired
      if (billing.currentPeriodEnd && new Date(billing.currentPeriodEnd) < new Date()) {
        return false;
      }

      // Check feature access based on plan
      const plan = SUBSCRIPTION_PLANS.find(p => p.id === billing.planId);
      if (!plan) return false;

      // Define feature access by plan
      const featureAccess: Record<string, string[]> = {
        starter: ['user_management', 'basic_reporting'],
        professional: ['user_management', 'basic_reporting', 'inventory_management', 'multi_location'],
        enterprise: ['user_management', 'basic_reporting', 'inventory_management', 'multi_location', 'advanced_analytics', 'custom_integrations']
      };

      return featureAccess[plan.id]?.includes(feature) || false;
    } catch (error) {
      logger.error('Failed to check feature access', { error, tenantId, feature });
      return false;
    }
  }

  /**
   * Private helper methods
   */
  private async updateTenantSubscription(tenantId: string, data: any): Promise<void> {
    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        settings: {
          // Merge with existing settings
          ...(await this.getTenantSettings(tenantId)),
          billing: {
            ...data,
            updatedAt: new Date().toISOString()
          }
        }
      }
    });
  }

  private async getTenantSettings(tenantId: string): Promise<any> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true }
    });
    
    try {
      return typeof tenant?.settings === 'string' 
        ? JSON.parse(tenant.settings) 
        : tenant?.settings || {};
    } catch {
      return {};
    }
  }

  private getPlanIdFromPriceId(priceId: string): string {
    const plan = SUBSCRIPTION_PLANS.find(p => p.stripePriceId === priceId);
    return plan?.id || 'starter';
  }

  private async handleSubscriptionUpdate(subscription: Stripe.Subscription): Promise<void> {
    const tenantId = subscription.metadata['tenantId'];
    if (!tenantId) return;

    await this.updateTenantSubscription(tenantId, {
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end
    });

    logger.info('Subscription updated via webhook', {
      subscriptionId: subscription.id,
      tenantId,
      status: subscription.status
    });
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    const tenantId = subscription.metadata['tenantId'];
    if (!tenantId) return;

    await this.updateTenantSubscription(tenantId, {
      subscriptionStatus: 'canceled',
      canceledAt: new Date().toISOString()
    });

    logger.info('Subscription deleted via webhook', {
      subscriptionId: subscription.id,
      tenantId
    });
  }

  private async handlePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    if ((invoice as any).subscription) {
      const subscription = await this.getSubscription((invoice as any).subscription as string);
      const tenantId = subscription.metadata['tenantId'];
      
      if (tenantId) {
        await this.updateTenantSubscription(tenantId, {
          lastPaymentAt: new Date().toISOString(),
          subscriptionStatus: 'active'
        });

        logger.info('Payment succeeded', {
          subscriptionId: subscription.id,
          tenantId,
          amount: invoice.amount_paid
        });
      }
    }
  }

  private async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    if ((invoice as any).subscription) {
      const subscription = await this.getSubscription((invoice as any).subscription as string);
      const tenantId = subscription.metadata['tenantId'];
      
      if (tenantId) {
        await this.updateTenantSubscription(tenantId, {
          lastPaymentFailedAt: new Date().toISOString(),
          subscriptionStatus: 'past_due'
        });

        logger.warn('Payment failed', {
          subscriptionId: subscription.id,
          tenantId,
          amount: invoice.amount_due
        });
      }
    }
  }
}

export const billingService = new BillingService();