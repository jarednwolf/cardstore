import { PrismaClient, ProductVariant } from '@prisma/client';
import { logger } from '../config/logger';
import { cacheService } from './cacheService';

export interface PricingRule {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  priority: number;
  isActive: boolean;
  conditions: PricingCondition[];
  actions: PricingAction[];
  schedule?: PricingSchedule;
  createdAt: Date;
  updatedAt: Date;
}

export interface PricingCondition {
  type: 'product_category' | 'vendor' | 'inventory_level' | 'sales_velocity' | 'market_price' | 'competitor_price' | 'cost_margin' | 'age_days';
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'between' | 'in' | 'not_in';
  value: any;
  secondaryValue?: any; // For 'between' operator
}

export interface PricingAction {
  type: 'set_price' | 'adjust_percentage' | 'adjust_fixed' | 'match_competitor' | 'set_margin' | 'round_to' | 'min_price' | 'max_price';
  value: number;
  marketplace?: string; // If null, applies to all marketplaces
  conditions?: PricingActionCondition[];
}

export interface PricingActionCondition {
  type: 'min_margin' | 'max_margin' | 'min_price' | 'max_price';
  value: number;
}

export interface PricingSchedule {
  type: 'once' | 'recurring';
  startDate: Date;
  endDate?: Date;
  frequency?: 'hourly' | 'daily' | 'weekly' | 'monthly';
  daysOfWeek?: number[]; // 0-6, Sunday = 0
  timeOfDay?: string; // HH:MM format
}

export interface PricingResult {
  variantId: string;
  originalPrice: number;
  newPrice: number;
  marketplace: string;
  rulesApplied: string[];
  reasoning: string[];
  timestamp: Date;
}

export interface CompetitorPrice {
  marketplace: string;
  price: number;
  url?: string;
  lastUpdated: Date;
}

export interface MarketPrice {
  averagePrice: number;
  lowestPrice: number;
  highestPrice: number;
  sampleSize: number;
  lastUpdated: Date;
}

export interface SalesVelocity {
  unitsPerDay: number;
  revenuePerDay: number;
  period: number; // days
  trend: 'increasing' | 'decreasing' | 'stable';
}

export interface RequestContext {
  userId: string;
  tenantId: string;
  userRole: string;
  correlationId: string;
}

export class AdvancedPricingService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a new pricing rule
   */
  async createPricingRule(
    ruleData: Omit<PricingRule, 'id' | 'createdAt' | 'updatedAt'>,
    context: RequestContext
  ): Promise<PricingRule> {
    try {
      const rule = await this.prisma.pricingRule.create({
        data: {
          tenantId: context.tenantId,
          name: ruleData.name,
          description: ruleData.description,
          priority: ruleData.priority,
          isActive: ruleData.isActive,
          conditions: JSON.stringify(ruleData.conditions),
          actions: JSON.stringify(ruleData.actions),
          schedule: ruleData.schedule ? JSON.stringify(ruleData.schedule) : null,
          createdBy: context.userId
        }
      });

      logger.info('Pricing rule created', {
        ruleId: rule.id,
        name: ruleData.name,
        tenantId: context.tenantId
      });

      return this.mapPricingRuleFromDB(rule);
    } catch (error) {
      logger.error('Failed to create pricing rule', error);
      throw error;
    }
  }

  /**
   * Update an existing pricing rule
   */
  async updatePricingRule(
    ruleId: string,
    updates: Partial<Omit<PricingRule, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>>,
    context: RequestContext
  ): Promise<PricingRule> {
    try {
      const rule = await this.prisma.pricingRule.update({
        where: {
          id: ruleId,
          tenantId: context.tenantId
        },
        data: {
          ...(updates.name && { name: updates.name }),
          ...(updates.description && { description: updates.description }),
          ...(updates.priority !== undefined && { priority: updates.priority }),
          ...(updates.isActive !== undefined && { isActive: updates.isActive }),
          ...(updates.conditions && { conditions: JSON.stringify(updates.conditions) }),
          ...(updates.actions && { actions: JSON.stringify(updates.actions) }),
          ...(updates.schedule && { schedule: JSON.stringify(updates.schedule) }),
          updatedBy: context.userId
        }
      });

      logger.info('Pricing rule updated', {
        ruleId,
        tenantId: context.tenantId
      });

      return this.mapPricingRuleFromDB(rule);
    } catch (error) {
      logger.error('Failed to update pricing rule', error);
      throw error;
    }
  }

  /**
   * Delete a pricing rule
   */
  async deletePricingRule(ruleId: string, context: RequestContext): Promise<void> {
    try {
      await this.prisma.pricingRule.delete({
        where: {
          id: ruleId,
          tenantId: context.tenantId
        }
      });

      logger.info('Pricing rule deleted', {
        ruleId,
        tenantId: context.tenantId
      });
    } catch (error) {
      logger.error('Failed to delete pricing rule', error);
      throw error;
    }
  }

  /**
   * Get all pricing rules for a tenant
   */
  async getPricingRules(context: RequestContext): Promise<PricingRule[]> {
    try {
      const rules = await this.prisma.pricingRule.findMany({
        where: { tenantId: context.tenantId },
        orderBy: { priority: 'desc' }
      });

      return rules.map(rule => this.mapPricingRuleFromDB(rule));
    } catch (error) {
      logger.error('Failed to get pricing rules', error);
      throw error;
    }
  }

  /**
   * Apply pricing rules to a specific variant
   */
  async applyPricingRules(
    variantId: string,
    marketplace?: string,
    context?: RequestContext
  ): Promise<PricingResult[]> {
    try {
      const variant = await this.getVariantWithContext(variantId, context);
      if (!variant) {
        throw new Error('Variant not found');
      }

      const rules = await this.getActivePricingRules(variant.tenantId);
      const results: PricingResult[] = [];

      // Get marketplaces to apply pricing to
      const marketplaces = marketplace ? [marketplace] : await this.getActiveMarketplaces(variant.tenantId);

      for (const targetMarketplace of marketplaces) {
        const result = await this.applyRulesToVariant(variant, targetMarketplace, rules);
        if (result) {
          results.push(result);
        }
      }

      return results;
    } catch (error) {
      logger.error('Failed to apply pricing rules', error);
      throw error;
    }
  }

  /**
   * Apply pricing rules to multiple variants in batch
   */
  async batchApplyPricingRules(
    variantIds: string[],
    marketplace?: string,
    context?: RequestContext
  ): Promise<PricingResult[]> {
    const results: PricingResult[] = [];

    for (const variantId of variantIds) {
      try {
        const variantResults = await this.applyPricingRules(variantId, marketplace, context);
        results.push(...variantResults);
      } catch (error) {
        logger.error('Failed to apply pricing rules to variant', {
          variantId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return results;
  }

  /**
   * Get competitor prices for a variant
   */
  async getCompetitorPrices(variantId: string, context: RequestContext): Promise<CompetitorPrice[]> {
    const cacheKey = cacheService.generateKey('competitor_prices', context.tenantId, variantId);

    return await cacheService.getOrSet(
      cacheKey,
      async () => {
        // This would integrate with price monitoring services
        // For now, return mock data
        return [
          {
            marketplace: 'tcgplayer',
            price: 19.99,
            url: 'https://tcgplayer.com/product/123',
            lastUpdated: new Date()
          },
          {
            marketplace: 'ebay',
            price: 21.50,
            url: 'https://ebay.com/itm/456',
            lastUpdated: new Date()
          }
        ];
      },
      'marketplace'
    );
  }

  /**
   * Get market price data for a variant
   */
  async getMarketPrice(variantId: string, context: RequestContext): Promise<MarketPrice> {
    const cacheKey = cacheService.generateKey('market_price', context.tenantId, variantId);

    return await cacheService.getOrSet(
      cacheKey,
      async () => {
        const competitorPrices = await this.getCompetitorPrices(variantId, context);
        
        if (competitorPrices.length === 0) {
          return {
            averagePrice: 0,
            lowestPrice: 0,
            highestPrice: 0,
            sampleSize: 0,
            lastUpdated: new Date()
          };
        }

        const prices = competitorPrices.map(cp => cp.price);
        
        return {
          averagePrice: prices.reduce((sum, price) => sum + price, 0) / prices.length,
          lowestPrice: Math.min(...prices),
          highestPrice: Math.max(...prices),
          sampleSize: prices.length,
          lastUpdated: new Date()
        };
      },
      'analytics'
    );
  }

  /**
   * Get sales velocity for a variant
   */
  async getSalesVelocity(variantId: string, context: RequestContext): Promise<SalesVelocity> {
    const cacheKey = cacheService.generateKey('sales_velocity', context.tenantId, variantId);

    return await cacheService.getOrSet(
      cacheKey,
      async () => {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const orderItems = await this.prisma.orderLineItem.findMany({
          where: {
            variantId,
            order: {
              tenantId: context.tenantId,
              createdAt: { gte: thirtyDaysAgo },
              status: { in: ['processing', 'fulfilled'] }
            }
          },
          include: {
            order: true
          }
        });

        const totalUnits = orderItems.reduce((sum, item) => sum + item.quantity, 0);
        const totalRevenue = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        
        const unitsPerDay = totalUnits / 30;
        const revenuePerDay = totalRevenue / 30;

        // Simple trend calculation (compare last 15 days vs previous 15 days)
        const fifteenDaysAgo = new Date();
        fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);

        const recentItems = orderItems.filter(item => item.order.createdAt >= fifteenDaysAgo);
        const olderItems = orderItems.filter(item => item.order.createdAt < fifteenDaysAgo);

        const recentUnitsPerDay = recentItems.reduce((sum, item) => sum + item.quantity, 0) / 15;
        const olderUnitsPerDay = olderItems.reduce((sum, item) => sum + item.quantity, 0) / 15;

        let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
        if (recentUnitsPerDay > olderUnitsPerDay * 1.1) {
          trend = 'increasing';
        } else if (recentUnitsPerDay < olderUnitsPerDay * 0.9) {
          trend = 'decreasing';
        }

        return {
          unitsPerDay,
          revenuePerDay,
          period: 30,
          trend
        };
      },
      'analytics'
    );
  }

  /**
   * Schedule automatic pricing rule execution
   */
  async scheduleAutomaticPricing(): Promise<void> {
    // Run every hour
    setInterval(async () => {
      await this.executeScheduledPricingRules();
    }, 3600000); // 1 hour

    logger.info('Automatic pricing scheduler initialized');
  }

  /**
   * Execute scheduled pricing rules
   */
  private async executeScheduledPricingRules(): Promise<void> {
    try {
      const tenants = await this.prisma.tenant.findMany({
        where: { isActive: true }
      });

      for (const tenant of tenants) {
        await this.executeScheduledPricingForTenant(tenant.id);
      }
    } catch (error) {
      logger.error('Failed to execute scheduled pricing rules', error);
    }
  }

  /**
   * Execute scheduled pricing rules for a specific tenant
   */
  private async executeScheduledPricingForTenant(tenantId: string): Promise<void> {
    try {
      const rules = await this.getScheduledPricingRules(tenantId);
      
      for (const rule of rules) {
        if (this.shouldExecuteRule(rule)) {
          await this.executeRuleForAllVariants(rule, tenantId);
        }
      }
    } catch (error) {
      logger.error('Failed to execute scheduled pricing for tenant', {
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Apply rules to a specific variant for a marketplace
   */
  private async applyRulesToVariant(
    variant: ProductVariant & { product: any },
    marketplace: string,
    rules: PricingRule[]
  ): Promise<PricingResult | null> {
    const originalPrice = await this.getCurrentPrice(variant.id, marketplace);
    let newPrice = originalPrice;
    const rulesApplied: string[] = [];
    const reasoning: string[] = [];

    // Sort rules by priority (highest first)
    const sortedRules = rules.sort((a, b) => b.priority - a.priority);

    for (const rule of sortedRules) {
      const conditionsMet = await this.evaluateConditions(rule.conditions, variant, marketplace);
      
      if (conditionsMet) {
        const ruleResult = await this.applyActions(rule.actions, variant, marketplace, newPrice);
        
        if (ruleResult.priceChanged) {
          newPrice = ruleResult.newPrice;
          rulesApplied.push(rule.name);
          reasoning.push(...ruleResult.reasoning);
        }
      }
    }

    if (newPrice !== originalPrice) {
      // Update the price in the database
      await this.updateVariantPrice(variant.id, marketplace, newPrice);

      return {
        variantId: variant.id,
        originalPrice,
        newPrice,
        marketplace,
        rulesApplied,
        reasoning,
        timestamp: new Date()
      };
    }

    return null;
  }

  /**
   * Evaluate pricing rule conditions
   */
  private async evaluateConditions(
    conditions: PricingCondition[],
    variant: ProductVariant & { product: any },
    marketplace: string
  ): Promise<boolean> {
    for (const condition of conditions) {
      const result = await this.evaluateCondition(condition, variant, marketplace);
      if (!result) return false;
    }
    return true;
  }

  /**
   * Evaluate a single pricing condition
   */
  private async evaluateCondition(
    condition: PricingCondition,
    variant: ProductVariant & { product: any },
    marketplace: string
  ): Promise<boolean> {
    let actualValue: any;

    switch (condition.type) {
      case 'product_category':
        actualValue = variant.product.category;
        break;
        
      case 'vendor':
        actualValue = variant.product.vendor;
        break;
        
      case 'inventory_level':
        actualValue = await this.getInventoryLevel(variant.id);
        break;
        
      case 'sales_velocity':
        const velocity = await this.getSalesVelocity(variant.id, { tenantId: variant.tenantId } as RequestContext);
        actualValue = velocity.unitsPerDay;
        break;
        
      case 'market_price':
        const marketPrice = await this.getMarketPrice(variant.id, { tenantId: variant.tenantId } as RequestContext);
        actualValue = marketPrice.averagePrice;
        break;
        
      case 'competitor_price':
        const competitorPrices = await this.getCompetitorPrices(variant.id, { tenantId: variant.tenantId } as RequestContext);
        actualValue = competitorPrices.length > 0 ? Math.min(...competitorPrices.map(cp => cp.price)) : 0;
        break;
        
      case 'cost_margin':
        const currentPrice = await this.getCurrentPrice(variant.id, marketplace);
        const cost = await this.getProductCost(variant.id);
        actualValue = cost > 0 ? ((currentPrice - cost) / cost) * 100 : 0;
        break;
        
      case 'age_days':
        actualValue = Math.floor((Date.now() - variant.createdAt.getTime()) / (1000 * 60 * 60 * 24));
        break;
        
      default:
        return false;
    }

    return this.evaluateOperator(actualValue, condition.operator, condition.value, condition.secondaryValue);
  }

  /**
   * Evaluate operator conditions
   */
  private evaluateOperator(
    actualValue: any,
    operator: string,
    expectedValue: any,
    secondaryValue?: any
  ): boolean {
    switch (operator) {
      case 'equals':
        return actualValue === expectedValue;
      case 'not_equals':
        return actualValue !== expectedValue;
      case 'contains':
        return String(actualValue).toLowerCase().includes(String(expectedValue).toLowerCase());
      case 'not_contains':
        return !String(actualValue).toLowerCase().includes(String(expectedValue).toLowerCase());
      case 'greater_than':
        return Number(actualValue) > Number(expectedValue);
      case 'less_than':
        return Number(actualValue) < Number(expectedValue);
      case 'between':
        return Number(actualValue) >= Number(expectedValue) && Number(actualValue) <= Number(secondaryValue);
      case 'in':
        return Array.isArray(expectedValue) && expectedValue.includes(actualValue);
      case 'not_in':
        return Array.isArray(expectedValue) && !expectedValue.includes(actualValue);
      default:
        return false;
    }
  }

  /**
   * Apply pricing actions
   */
  private async applyActions(
    actions: PricingAction[],
    variant: ProductVariant,
    marketplace: string,
    currentPrice: number
  ): Promise<{ priceChanged: boolean; newPrice: number; reasoning: string[] }> {
    let newPrice = currentPrice;
    const reasoning: string[] = [];
    let priceChanged = false;

    for (const action of actions) {
      // Skip if action is for a different marketplace
      if (action.marketplace && action.marketplace !== marketplace) {
        continue;
      }

      const actionResult = await this.applyAction(action, variant, marketplace, newPrice);
      
      if (actionResult.priceChanged) {
        newPrice = actionResult.newPrice;
        reasoning.push(actionResult.reasoning);
        priceChanged = true;
      }
    }

    return { priceChanged, newPrice, reasoning };
  }

  /**
   * Apply a single pricing action
   */
  private async applyAction(
    action: PricingAction,
    variant: ProductVariant,
    marketplace: string,
    currentPrice: number
  ): Promise<{ priceChanged: boolean; newPrice: number; reasoning: string }> {
    let newPrice = currentPrice;
    let reasoning = '';

    switch (action.type) {
      case 'set_price':
        newPrice = action.value;
        reasoning = `Set price to $${action.value}`;
        break;
        
      case 'adjust_percentage':
        newPrice = currentPrice * (1 + action.value / 100);
        reasoning = `Adjusted price by ${action.value}% (${action.value > 0 ? '+' : ''}$${(newPrice - currentPrice).toFixed(2)})`;
        break;
        
      case 'adjust_fixed':
        newPrice = currentPrice + action.value;
        reasoning = `Adjusted price by ${action.value > 0 ? '+' : ''}$${action.value}`;
        break;
        
      case 'match_competitor':
        const competitorPrices = await this.getCompetitorPrices(variant.id, { tenantId: variant.tenantId } as RequestContext);
        if (competitorPrices.length > 0) {
          const lowestCompetitorPrice = Math.min(...competitorPrices.map(cp => cp.price));
          newPrice = lowestCompetitorPrice * (1 - action.value / 100); // Undercut by percentage
          reasoning = `Matched competitor price ($${lowestCompetitorPrice}) with ${action.value}% undercut`;
        }
        break;
        
      case 'set_margin':
        const cost = await this.getProductCost(variant.id);
        if (cost > 0) {
          newPrice = cost * (1 + action.value / 100);
          reasoning = `Set ${action.value}% margin on cost ($${cost})`;
        }
        break;
        
      case 'round_to':
        newPrice = Math.round(currentPrice / action.value) * action.value;
        reasoning = `Rounded price to nearest $${action.value}`;
        break;
        
      case 'min_price':
        if (currentPrice < action.value) {
          newPrice = action.value;
          reasoning = `Applied minimum price of $${action.value}`;
        }
        break;
        
      case 'max_price':
        if (currentPrice > action.value) {
          newPrice = action.value;
          reasoning = `Applied maximum price of $${action.value}`;
        }
        break;
    }

    // Apply action conditions (constraints)
    if (action.conditions) {
      for (const condition of action.conditions) {
        const constraintResult = await this.applyActionConstraint(condition, newPrice, variant);
        if (constraintResult.priceChanged) {
          newPrice = constraintResult.newPrice;
          reasoning += ` (constrained: ${constraintResult.reasoning})`;
        }
      }
    }

    return {
      priceChanged: newPrice !== currentPrice,
      newPrice,
      reasoning
    };
  }

  /**
   * Apply action constraints
   */
  private async applyActionConstraint(
    condition: PricingActionCondition,
    price: number,
    variant: ProductVariant
  ): Promise<{ priceChanged: boolean; newPrice: number; reasoning: string }> {
    let newPrice = price;
    let reasoning = '';

    switch (condition.type) {
      case 'min_margin':
        const cost = await this.getProductCost(variant.id);
        if (cost > 0) {
          const minPrice = cost * (1 + condition.value / 100);
          if (price < minPrice) {
            newPrice = minPrice;
            reasoning = `minimum ${condition.value}% margin`;
          }
        }
        break;
        
      case 'max_margin':
        const costForMax = await this.getProductCost(variant.id);
        if (costForMax > 0) {
          const maxPrice = costForMax * (1 + condition.value / 100);
          if (price > maxPrice) {
            newPrice = maxPrice;
            reasoning = `maximum ${condition.value}% margin`;
          }
        }
        break;
        
      case 'min_price':
        if (price < condition.value) {
          newPrice = condition.value;
          reasoning = `minimum price $${condition.value}`;
        }
        break;
        
      case 'max_price':
        if (price > condition.value) {
          newPrice = condition.value;
          reasoning = `maximum price $${condition.value}`;
        }
        break;
    }

    return {
      priceChanged: newPrice !== price,
      newPrice,
      reasoning
    };
  }

  // Helper methods
  private async getVariantWithContext(variantId: string, context?: RequestContext): Promise<(ProductVariant & { product: any }) | null> {
    return await this.prisma.productVariant.findFirst({
      where: {
        id: variantId,
        ...(context && { tenantId: context.tenantId })
      },
      include: {
        product: true
      }
    });
  }

  private async getActivePricingRules(tenantId: string): Promise<PricingRule[]> {
    const rules = await this.prisma.pricingRule.findMany({
      where: {
        tenantId,
        isActive: true
      },
      orderBy: { priority: 'desc' }
    });

    return rules.map(rule => this.mapPricingRuleFromDB(rule));
  }

  private async getScheduledPricingRules(tenantId: string): Promise<PricingRule[]> {
    const rules = await this.prisma.pricingRule.findMany({
      where: {
        tenantId,
        isActive: true,
        schedule: { not: null }
      }
    });

    return rules.map(rule => this.mapPricingRuleFromDB(rule));
  }

  private async getActiveMarketplaces(tenantId: string): Promise<string[]> {
    // This would query the marketplace listings to find active marketplaces
    const marketplaces = await this.prisma.marketplaceListing.findMany({
      where: { tenantId },
      select: { marketplace: true },
      distinct: ['marketplace']
    });

    return marketplaces.map(m => m.marketplace);
  }

  private async getCurrentPrice(variantId: string, marketplace: string): Promise<number> {
    // Try to get marketplace-specific price first
    const channelPrice = await this.prisma.channelPrice.findFirst({
      where: { variantId, channel: marketplace, isActive: true }
    });

    if (channelPrice) {
      return channelPrice.price;
    }

    // Fall back to base variant price
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId }
    });

    return variant?.price || 0;
  }

  private async updateVariantPrice(variantId: string, marketplace: string, price: number): Promise<void> {
    await this.prisma.channelPrice.upsert({
      where: {
        variantId_channel: {
          variantId,
          channel: marketplace
        }
      },
      update: {
        price,
        updatedAt: new Date()
      },
      create: {
        variantId,
        channel: marketplace,
        price,
        isActive: true
      }
    });
  }

  private async getInventoryLevel(variantId: string): Promise<number> {
    const inventory = await this.prisma.inventoryItem.findMany({
      where: { variantId }
    });

    return inventory.reduce((total, item) => total + (item.onHand - item.reserved), 0);
  }

  private async getProductCost(variantId: string): Promise<number> {
    // This would integrate with cost tracking system
    // For now, return a mock cost (60% of current price)
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId }
    });

    return variant ? variant.price * 0.6 : 0;
  }

  private shouldExecuteRule(rule: PricingRule): boolean {
    if (!rule.schedule) return false;

    const now = new Date();
    const schedule = rule.schedule;

    // Check if rule is within date range
    if (schedule.startDate > now) return false;
    if (schedule.endDate && schedule.endDate < now) return false;

    // For recurring rules, check frequency
    if (schedule.type === 'recurring') {
      // This is a simplified check - in production, you'd want more sophisticated scheduling
      return true;
    }

    return schedule.type === 'once';
  }

  private async executeRuleForAllVariants(rule: PricingRule, tenantId: string): Promise<void> {
    // This would apply the rule to all applicable variants
    // Implementation would depend on rule conditions and scope
    logger.info('Executing pricing rule for all variants', {
      ruleId: rule.id,
      ruleName: rule.name,
      tenantId
    });
  }

  private mapPricingRuleFromDB(dbRule: any): PricingRule {
    return {
      id: dbRule.id,
      tenantId: dbRule.tenantId,
      name: dbRule.name,
      description: dbRule.description,
      priority: dbRule.priority,
      isActive: dbRule.isActive,
      conditions: JSON.parse(dbRule.conditions || '[]'),
      actions: JSON.parse(dbRule.actions || '[]'),
      schedule: dbRule.schedule ? JSON.parse(dbRule.schedule) : undefined,
      createdAt: dbRule.createdAt,
      updatedAt: dbRule.updatedAt
    };
  }
}

// Export singleton instance
export const advancedPricingService = new AdvancedPricingService(
  new PrismaClient()
);