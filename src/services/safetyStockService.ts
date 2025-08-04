import { PrismaClient } from '@prisma/client';
import { logger } from '../config/logger';
import { RequestContext } from '../types';
import { InventoryAnalyticsService } from './inventoryAnalyticsService';

export interface SafetyStockRule {
  id: string;
  tenantId: string;
  variantId?: string | undefined; // If null, applies to all variants
  locationId?: string | undefined; // If null, applies to all locations
  category?: string | undefined; // Product category filter
  vendor?: string | undefined; // Product vendor filter
  ruleType: 'fixed' | 'percentage' | 'velocity_based' | 'seasonal' | 'dynamic';
  value: number; // Days of stock, percentage, or fixed quantity
  minStock: number;
  maxStock: number;
  priority: number; // Higher priority rules override lower priority
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface SafetyStockCalculation {
  variantId: string;
  variantTitle: string;
  sku: string;
  locationId: string;
  locationName: string;
  currentSafetyStock: number;
  recommendedSafetyStock: number;
  calculation: {
    method: string;
    leadTimeDays: number;
    averageDemand: number;
    demandVariability: number;
    serviceLevel: number;
    seasonalFactor: number;
    finalRecommendation: number;
  };
  confidence: number;
  lastReviewDate?: Date | undefined;
}

export interface SafetyStockOptimization {
  variantId: string;
  variantTitle: string;
  locationId: string;
  locationName: string;
  currentSafetyStock: number;
  optimizedSafetyStock: number;
  potentialSavings: number;
  riskReduction: number;
  reason: string;
  priority: 'high' | 'medium' | 'low';
}

export interface SafetyStockPerformance {
  variantId: string;
  locationId: string;
  period: {
    startDate: Date;
    endDate: Date;
  };
  metrics: {
    stockoutEvents: number;
    stockoutDays: number;
    averageStockLevel: number;
    turnoverRate: number;
    carryingCost: number;
    serviceLevel: number;
  };
  effectiveness: 'excellent' | 'good' | 'fair' | 'poor';
}

export class SafetyStockService {
  private prisma: PrismaClient;
  private analyticsService: InventoryAnalyticsService;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.analyticsService = new InventoryAnalyticsService(prisma);
  }

  /**
   * Calculate recommended safety stock levels for all variants
   */
  async calculateRecommendedSafetyStock(
    tenantId: string,
    variantId?: string,
    locationId?: string
  ): Promise<SafetyStockCalculation[]> {
    logger.info('Calculating recommended safety stock levels', { tenantId, variantId, locationId });

    const where: any = { tenantId };
    if (variantId) where.variantId = variantId;
    if (locationId) where.locationId = locationId;

    const inventoryItems = await this.prisma.inventoryItem.findMany({
      where,
      include: {
        variant: { include: { product: true } },
        location: true
      }
    });

    const calculations: SafetyStockCalculation[] = [];

    for (const item of inventoryItems) {
      const calculation = await this.calculateSafetyStockForItem(
        tenantId,
        item.variantId,
        item.locationId
      );

      calculations.push({
        variantId: item.variantId,
        variantTitle: item.variant.title,
        sku: item.variant.sku,
        locationId: item.locationId,
        locationName: item.location.name,
        currentSafetyStock: item.safetyStock,
        recommendedSafetyStock: calculation.recommendedSafetyStock,
        calculation: calculation.details,
        confidence: calculation.confidence,
        lastReviewDate: undefined // Would track when last reviewed
      });
    }

    // Sort by potential impact (difference between current and recommended)
    calculations.sort((a, b) => {
      const impactA = Math.abs(a.recommendedSafetyStock - a.currentSafetyStock);
      const impactB = Math.abs(b.recommendedSafetyStock - b.currentSafetyStock);
      return impactB - impactA;
    });

    return calculations;
  }

  /**
   * Apply safety stock recommendations
   */
  async applySafetyStockRecommendations(
    recommendations: Array<{
      variantId: string;
      locationId: string;
      newSafetyStock: number;
    }>,
    context: RequestContext
  ): Promise<{
    applied: number;
    failed: number;
    errors: string[];
  }> {
    logger.info('Applying safety stock recommendations', {
      recommendationCount: recommendations.length,
      tenantId: context.tenantId,
      userId: context.userId
    });

    let applied = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const recommendation of recommendations) {
      try {
        await this.prisma.inventoryItem.updateMany({
          where: {
            tenantId: context.tenantId,
            variantId: recommendation.variantId,
            locationId: recommendation.locationId
          },
          data: {
            safetyStock: recommendation.newSafetyStock,
            updatedAt: new Date()
          }
        });

        // Record the change in stock movements for audit trail
        await this.prisma.stockMovement.create({
          data: {
            tenantId: context.tenantId,
            variantId: recommendation.variantId,
            locationId: recommendation.locationId,
            type: 'in', // Conceptual - safety stock adjustment
            quantity: 0, // No actual quantity change
            reason: 'safety_stock_adjustment',
            reference: `Safety stock updated to ${recommendation.newSafetyStock}`,
            createdBy: context.userId
          }
        });

        applied++;
      } catch (error) {
        failed++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Failed to update ${recommendation.variantId}: ${errorMessage}`);
      }
    }

    logger.info('Safety stock recommendations applied', {
      applied,
      failed,
      errorCount: errors.length,
      tenantId: context.tenantId
    });

    return { applied, failed, errors };
  }

  /**
   * Generate safety stock optimization suggestions
   */
  async generateOptimizationSuggestions(
    tenantId: string,
    locationId?: string
  ): Promise<SafetyStockOptimization[]> {
    logger.info('Generating safety stock optimization suggestions', { tenantId, locationId });

    const calculations = await this.calculateRecommendedSafetyStock(tenantId, undefined, locationId);
    const optimizations: SafetyStockOptimization[] = [];

    for (const calc of calculations) {
      const difference = calc.recommendedSafetyStock - calc.currentSafetyStock;
      
      if (Math.abs(difference) >= 2) { // Only suggest if difference is significant
        const variant = await this.prisma.productVariant.findFirst({
          where: { id: calc.variantId }
        });

        const unitCost = variant?.price || 0; // Simplified - would use actual cost
        const potentialSavings = difference < 0 ? Math.abs(difference) * unitCost : 0;
        const riskReduction = difference > 0 ? this.calculateRiskReduction(calc) : 0;

        let priority: 'high' | 'medium' | 'low' = 'low';
        if (Math.abs(difference) > 10 || potentialSavings > 100) priority = 'high';
        else if (Math.abs(difference) > 5 || potentialSavings > 50) priority = 'medium';

        let reason = '';
        if (difference > 0) {
          reason = `Increase safety stock by ${difference} units to reduce stockout risk`;
        } else {
          reason = `Reduce safety stock by ${Math.abs(difference)} units to free up capital`;
        }

        optimizations.push({
          variantId: calc.variantId,
          variantTitle: calc.variantTitle,
          locationId: calc.locationId,
          locationName: calc.locationName,
          currentSafetyStock: calc.currentSafetyStock,
          optimizedSafetyStock: calc.recommendedSafetyStock,
          potentialSavings,
          riskReduction,
          reason,
          priority
        });
      }
    }

    // Sort by priority and potential impact
    optimizations.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      
      return (b.potentialSavings + b.riskReduction) - (a.potentialSavings + a.riskReduction);
    });

    return optimizations;
  }

  /**
   * Analyze safety stock performance
   */
  async analyzeSafetyStockPerformance(
    tenantId: string,
    variantId: string,
    locationId: string,
    days: number = 30
  ): Promise<SafetyStockPerformance> {
    logger.info('Analyzing safety stock performance', { tenantId, variantId, locationId, days });

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get stock movements for the period
    const movements = await this.prisma.stockMovement.findMany({
      where: {
        tenantId,
        variantId,
        locationId,
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    // Get current inventory item with variant
    const inventoryItem = await this.prisma.inventoryItem.findFirst({
      where: { tenantId, variantId, locationId },
      include: { variant: true }
    });

    const safetyStock = inventoryItem?.safetyStock || 0;

    // Calculate daily stock levels
    const dailyStockLevels = this.calculateDailyStockLevels(movements, days);
    
    // Calculate metrics
    const stockoutEvents = dailyStockLevels.filter(level => level <= 0).length;
    const stockoutDays = stockoutEvents;
    const averageStockLevel = dailyStockLevels.reduce((sum, level) => sum + level, 0) / dailyStockLevels.length;
    
    const salesMovements = movements.filter(m => m.type === 'out' && m.reason === 'sale');
    const totalSales = salesMovements.reduce((sum, m) => sum + m.quantity, 0);
    const turnoverRate = averageStockLevel > 0 ? totalSales / averageStockLevel : 0;
    
    const carryingCost = averageStockLevel * (inventoryItem?.variant?.price || 0) * 0.25; // 25% annual carrying cost
    const serviceLevel = stockoutDays > 0 ? ((days - stockoutDays) / days) * 100 : 100;

    let effectiveness: 'excellent' | 'good' | 'fair' | 'poor' = 'poor';
    if (serviceLevel >= 98 && turnoverRate >= 2) effectiveness = 'excellent';
    else if (serviceLevel >= 95 && turnoverRate >= 1.5) effectiveness = 'good';
    else if (serviceLevel >= 90 && turnoverRate >= 1) effectiveness = 'fair';

    return {
      variantId,
      locationId,
      period: { startDate, endDate },
      metrics: {
        stockoutEvents,
        stockoutDays,
        averageStockLevel,
        turnoverRate,
        carryingCost,
        serviceLevel
      },
      effectiveness
    };
  }

  /**
   * Set up automated safety stock rules
   */
  async createSafetyStockRule(
    rule: Omit<SafetyStockRule, 'id' | 'createdAt' | 'updatedAt'>,
    context: RequestContext
  ): Promise<SafetyStockRule> {
    logger.info('Creating safety stock rule', {
      rule,
      tenantId: context.tenantId,
      userId: context.userId
    });

    const safetyStockRule: SafetyStockRule = {
      ...rule,
      id: `rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // In a real implementation, this would be stored in a safety_stock_rules table
    logger.info('Safety stock rule created', {
      ruleId: safetyStockRule.id,
      tenantId: context.tenantId
    });

    return safetyStockRule;
  }

  // =============================================================================
  // PRIVATE HELPER METHODS
  // =============================================================================

  private async calculateSafetyStockForItem(
    tenantId: string,
    variantId: string,
    locationId: string
  ): Promise<{
    recommendedSafetyStock: number;
    confidence: number;
    details: any;
  }> {
    // Get sales velocity data
    const salesVelocity = await this.analyticsService.calculateSalesVelocity(
      tenantId,
      variantId,
      locationId,
      60 // 60 days for better accuracy
    );

    // Default parameters
    const leadTimeDays = 7; // Default lead time
    const serviceLevel = 0.95; // 95% service level
    const zScore = 1.65; // Z-score for 95% service level

    // Calculate demand variability (simplified)
    const averageDemand = salesVelocity.dailyAverage;
    const demandVariability = averageDemand * 0.3; // Assume 30% coefficient of variation

    // Seasonal factor
    const seasonalFactor = this.getSeasonalFactor();

    // Basic safety stock formula: Z * sqrt(lead_time) * demand_std_dev
    const basicSafetyStock = zScore * Math.sqrt(leadTimeDays) * demandVariability;
    
    // Apply seasonal adjustment
    const seasonalAdjustedSafetyStock = basicSafetyStock * seasonalFactor;
    
    // Apply trend adjustment
    let trendAdjustedSafetyStock = seasonalAdjustedSafetyStock;
    if (salesVelocity.trend === 'increasing') {
      trendAdjustedSafetyStock *= 1.2; // 20% increase for growing demand
    } else if (salesVelocity.trend === 'decreasing') {
      trendAdjustedSafetyStock *= 0.8; // 20% decrease for declining demand
    }

    const finalRecommendation = Math.max(1, Math.round(trendAdjustedSafetyStock));

    // Calculate confidence based on data quality
    let confidence = 0.7; // Base confidence
    if (salesVelocity.dailyAverage > 0.1) confidence += 0.2; // Has meaningful sales
    if (salesVelocity.trend === 'stable') confidence += 0.1; // Stable demand

    return {
      recommendedSafetyStock: finalRecommendation,
      confidence: Math.min(1, confidence),
      details: {
        method: 'statistical',
        leadTimeDays,
        averageDemand,
        demandVariability,
        serviceLevel,
        seasonalFactor,
        finalRecommendation
      }
    };
  }

  private calculateRiskReduction(calculation: SafetyStockCalculation): number {
    // Simplified risk reduction calculation
    const increase = calculation.recommendedSafetyStock - calculation.currentSafetyStock;
    if (increase <= 0) return 0;
    
    // Estimate risk reduction based on service level improvement
    const currentServiceLevel = 0.85; // Assume current service level
    const improvedServiceLevel = Math.min(0.99, currentServiceLevel + (increase * 0.02));
    
    return (improvedServiceLevel - currentServiceLevel) * 100;
  }

  private calculateDailyStockLevels(movements: any[], days: number): number[] {
    const dailyLevels: number[] = [];
    let currentStock = 0;

    // Simplified calculation - in reality would need starting stock level
    for (let day = 0; day < days; day++) {
      const dayMovements = movements.filter(m => {
        const movementDay = Math.floor((m.createdAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        return movementDay === -day;
      });

      for (const movement of dayMovements) {
        if (movement.type === 'in') {
          currentStock += movement.quantity;
        } else {
          currentStock -= movement.quantity;
        }
      }

      dailyLevels.push(Math.max(0, currentStock));
    }

    return dailyLevels;
  }

  private getSeasonalFactor(): number {
    // Simple seasonal adjustment based on month
    const month = new Date().getMonth();
    
    // Higher demand in Q4 (Oct-Dec) for holiday season
    if (month >= 9) return 1.3;
    
    // Lower demand in Q1 (Jan-Mar) post-holiday
    if (month <= 2) return 0.8;
    
    // Normal demand rest of year
    return 1.0;
  }
}