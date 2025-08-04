import { PrismaClient } from '@prisma/client';
import { logger } from '../config/logger';
import { RequestContext } from '../types';
import { getTenantCurrency } from '../utils/currency';

export interface LowStockItem {
  variantId: string;
  variantTitle: string;
  sku: string;
  locationId: string;
  locationName: string;
  onHand: number;
  reserved: number;
  available: number;
  safetyStock: number;
  daysOfStock: number;
  salesVelocity: number;
  urgency: number; // 0-1 scale, 1 being most urgent
  reorderSuggestion: number;
  lastSaleDate?: Date | undefined;
}

export interface InventoryForecast {
  variantId: string;
  variantTitle: string;
  locationId: string;
  locationName: string;
  currentStock: number;
  projectedStock: number;
  daysUntilStockout: number;
  recommendedReorderQuantity: number;
  recommendedReorderDate: Date;
  confidence: number; // 0-1 scale
}

export interface SalesVelocityData {
  variantId: string;
  locationId: string;
  dailyAverage: number;
  weeklyAverage: number;
  monthlyAverage: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  seasonality: number; // seasonal factor
}

export interface InventoryValuation {
  totalValue: number;
  totalItems: number;
  averageValue: number;
  valueByLocation: Record<string, { value: number; items: number; percentage: number }>;
  valueByCategory: Record<string, { value: number; items: number; percentage: number }>;
  slowMovingValue: number;
  fastMovingValue: number;
  currency: string;
}

export interface InventoryAging {
  variantId: string;
  variantTitle: string;
  sku: string;
  locationId: string;
  locationName: string;
  quantity: number;
  value: number;
  lastMovementDate: Date;
  daysWithoutMovement: number;
  agingCategory: 'fresh' | 'slow' | 'dead';
  recommendedAction: string;
}

export class InventoryAnalyticsService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Generate comprehensive low stock report with urgency scoring
   */
  async generateLowStockReport(
    tenantId: string,
    locationId?: string,
    threshold?: number
  ): Promise<LowStockItem[]> {
    logger.info('Generating low stock report', { tenantId, locationId, threshold });

    const where: any = { tenantId };
    if (locationId) {
      where.locationId = locationId;
    }

    const inventoryItems = await this.prisma.inventoryItem.findMany({
      where,
      include: {
        variant: { include: { product: true } },
        location: true
      }
    });

    const lowStockItems: LowStockItem[] = [];

    for (const item of inventoryItems) {
      const available = item.onHand - item.reserved;
      const isLowStock = threshold ? available <= threshold : available <= item.safetyStock;

      if (isLowStock) {
        const salesVelocity = await this.calculateSalesVelocity(
          tenantId,
          item.variantId,
          item.locationId,
          30 // 30 days
        );

        const daysOfStock = salesVelocity.dailyAverage > 0 ? 
          available / salesVelocity.dailyAverage : Infinity;

        const urgency = this.calculateUrgency(available, item.safetyStock, daysOfStock, salesVelocity.dailyAverage);
        const reorderSuggestion = this.calculateReorderQuantity(salesVelocity.dailyAverage, item.safetyStock);

        const lastSaleDate = await this.getLastSaleDate(tenantId, item.variantId, item.locationId);
        
        lowStockItems.push({
          variantId: item.variantId,
          variantTitle: item.variant.title,
          sku: item.variant.sku,
          locationId: item.locationId,
          locationName: item.location.name,
          onHand: item.onHand,
          reserved: item.reserved,
          available,
          safetyStock: item.safetyStock,
          daysOfStock,
          salesVelocity: salesVelocity.dailyAverage,
          urgency,
          reorderSuggestion,
          lastSaleDate: lastSaleDate || undefined
        });
      }
    }

    // Sort by urgency (highest first)
    lowStockItems.sort((a, b) => b.urgency - a.urgency);

    logger.info('Low stock report generated', {
      tenantId,
      itemCount: lowStockItems.length,
      criticalItems: lowStockItems.filter(item => item.urgency > 0.8).length
    });

    return lowStockItems;
  }

  /**
   * Generate inventory forecasts for the next 30-90 days
   */
  async generateInventoryForecast(
    tenantId: string,
    variantId?: string,
    locationId?: string,
    forecastDays: number = 30
  ): Promise<InventoryForecast[]> {
    logger.info('Generating inventory forecast', { tenantId, variantId, locationId, forecastDays });

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

    const forecasts: InventoryForecast[] = [];

    for (const item of inventoryItems) {
      const salesVelocity = await this.calculateSalesVelocity(
        tenantId,
        item.variantId,
        item.locationId,
        60 // Use 60 days for more accurate forecasting
      );

      const currentStock = item.onHand - item.reserved;
      const projectedDemand = salesVelocity.dailyAverage * forecastDays;
      const projectedStock = currentStock - projectedDemand;
      
      const daysUntilStockout = salesVelocity.dailyAverage > 0 ? 
        currentStock / salesVelocity.dailyAverage : Infinity;

      const recommendedReorderQuantity = this.calculateReorderQuantity(
        salesVelocity.dailyAverage,
        item.safetyStock,
        forecastDays
      );

      const recommendedReorderDate = new Date();
      recommendedReorderDate.setDate(recommendedReorderDate.getDate() + Math.max(0, daysUntilStockout - 7));

      const confidence = this.calculateForecastConfidence(salesVelocity);

      forecasts.push({
        variantId: item.variantId,
        variantTitle: item.variant.title,
        locationId: item.locationId,
        locationName: item.location.name,
        currentStock,
        projectedStock,
        daysUntilStockout: Math.round(daysUntilStockout),
        recommendedReorderQuantity,
        recommendedReorderDate,
        confidence
      });
    }

    // Sort by days until stockout (most urgent first)
    forecasts.sort((a, b) => a.daysUntilStockout - b.daysUntilStockout);

    return forecasts;
  }

  /**
   * Calculate sales velocity for a variant at a location
   */
  async calculateSalesVelocity(
    tenantId: string,
    variantId: string,
    locationId: string,
    days: number = 30
  ): Promise<SalesVelocityData> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // Get sales data from stock movements
    const salesMovements = await this.prisma.stockMovement.findMany({
      where: {
        tenantId,
        variantId,
        locationId,
        type: 'out',
        reason: { in: ['sale', 'order'] },
        createdAt: { gte: cutoffDate }
      },
      orderBy: { createdAt: 'asc' }
    });

    const totalSold = salesMovements.reduce((sum, movement) => sum + movement.quantity, 0);
    const dailyAverage = totalSold / days;
    const weeklyAverage = dailyAverage * 7;
    const monthlyAverage = dailyAverage * 30;

    // Calculate trend
    const midPoint = Math.floor(salesMovements.length / 2);
    const firstHalf = salesMovements.slice(0, midPoint);
    const secondHalf = salesMovements.slice(midPoint);

    const firstHalfAvg = firstHalf.length > 0 ? 
      firstHalf.reduce((sum, m) => sum + m.quantity, 0) / firstHalf.length : 0;
    const secondHalfAvg = secondHalf.length > 0 ? 
      secondHalf.reduce((sum, m) => sum + m.quantity, 0) / secondHalf.length : 0;

    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (secondHalfAvg > firstHalfAvg * 1.1) trend = 'increasing';
    else if (secondHalfAvg < firstHalfAvg * 0.9) trend = 'decreasing';

    return {
      variantId,
      locationId,
      dailyAverage,
      weeklyAverage,
      monthlyAverage,
      trend,
      seasonality: 1.0 // TODO: Implement seasonal analysis
    };
  }

  /**
   * Generate comprehensive inventory valuation report
   */
  async generateInventoryValuation(
    tenantId: string,
    locationId?: string
  ): Promise<InventoryValuation> {
    // Get tenant currency
    const currency = await getTenantCurrency(this.prisma, tenantId);
    const where: any = { tenantId };
    if (locationId) where.locationId = locationId;

    const inventoryItems = await this.prisma.inventoryItem.findMany({
      where,
      include: {
        variant: { include: { product: true } },
        location: true
      }
    });

    let totalValue = 0;
    let totalItems = 0;
    const valueByLocation: Record<string, { value: number; items: number; percentage: number }> = {};
    const valueByCategory: Record<string, { value: number; items: number; percentage: number }> = {};
    let slowMovingValue = 0;
    let fastMovingValue = 0;

    for (const item of inventoryItems) {
      const itemValue = item.onHand * item.variant.price;
      totalValue += itemValue;
      totalItems += item.onHand;

      // By location
      const locationName = item.location.name;
      if (!valueByLocation[locationName]) {
        valueByLocation[locationName] = { value: 0, items: 0, percentage: 0 };
      }
      valueByLocation[locationName].value += itemValue;
      valueByLocation[locationName].items += item.onHand;

      // By category
      const category = item.variant.product.category || 'Uncategorized';
      if (!valueByCategory[category]) {
        valueByCategory[category] = { value: 0, items: 0, percentage: 0 };
      }
      valueByCategory[category].value += itemValue;
      valueByCategory[category].items += item.onHand;

      // Fast vs slow moving (based on last 30 days sales velocity)
      const salesVelocity = await this.calculateSalesVelocity(
        tenantId,
        item.variantId,
        item.locationId,
        30
      );

      if (salesVelocity.dailyAverage > 0.5) {
        fastMovingValue += itemValue;
      } else {
        slowMovingValue += itemValue;
      }
    }

    // Calculate percentages
    Object.keys(valueByLocation).forEach(location => {
      const locationData = valueByLocation[location];
      if (locationData) {
        locationData.percentage = (locationData.value / totalValue) * 100;
      }
    });

    Object.keys(valueByCategory).forEach(category => {
      const categoryData = valueByCategory[category];
      if (categoryData) {
        categoryData.percentage = (categoryData.value / totalValue) * 100;
      }
    });

    return {
      totalValue,
      totalItems,
      averageValue: totalItems > 0 ? totalValue / totalItems : 0,
      valueByLocation,
      valueByCategory,
      slowMovingValue,
      fastMovingValue,
      currency
    };
  }

  /**
   * Generate inventory aging report
   */
  async generateInventoryAging(
    tenantId: string,
    locationId?: string
  ): Promise<InventoryAging[]> {
    const where: any = { tenantId };
    if (locationId) where.locationId = locationId;

    const inventoryItems = await this.prisma.inventoryItem.findMany({
      where,
      include: {
        variant: { include: { product: true } },
        location: true
      }
    });

    const agingItems: InventoryAging[] = [];

    for (const item of inventoryItems) {
      const lastMovementDate = await this.getLastMovementDate(tenantId, item.variantId, item.locationId);
      const daysWithoutMovement = lastMovementDate ? 
        Math.floor((Date.now() - lastMovementDate.getTime()) / (1000 * 60 * 60 * 24)) : 365;

      let agingCategory: 'fresh' | 'slow' | 'dead' = 'fresh';
      let recommendedAction = 'Monitor';

      if (daysWithoutMovement > 180) {
        agingCategory = 'dead';
        recommendedAction = 'Consider liquidation or return to vendor';
      } else if (daysWithoutMovement > 90) {
        agingCategory = 'slow';
        recommendedAction = 'Promote or discount to move inventory';
      }

      agingItems.push({
        variantId: item.variantId,
        variantTitle: item.variant.title,
        sku: item.variant.sku,
        locationId: item.locationId,
        locationName: item.location.name,
        quantity: item.onHand,
        value: item.onHand * item.variant.price,
        lastMovementDate: lastMovementDate || new Date(0),
        daysWithoutMovement,
        agingCategory,
        recommendedAction
      });
    }

    // Sort by days without movement (oldest first)
    agingItems.sort((a, b) => b.daysWithoutMovement - a.daysWithoutMovement);

    return agingItems;
  }

  // =============================================================================
  // HELPER METHODS
  // =============================================================================

  private calculateUrgency(
    available: number,
    safetyStock: number,
    daysOfStock: number,
    salesVelocity: number
  ): number {
    let urgency = 0;

    // Stock level urgency (0-0.4)
    if (available <= 0) urgency += 0.4;
    else if (available <= safetyStock * 0.5) urgency += 0.3;
    else if (available <= safetyStock) urgency += 0.2;
    else if (available <= safetyStock * 1.5) urgency += 0.1;

    // Days of stock urgency (0-0.3)
    if (daysOfStock <= 1) urgency += 0.3;
    else if (daysOfStock <= 3) urgency += 0.2;
    else if (daysOfStock <= 7) urgency += 0.1;
    else if (daysOfStock <= 14) urgency += 0.05;

    // Sales velocity urgency (0-0.3)
    if (salesVelocity > 2) urgency += 0.3; // High velocity
    else if (salesVelocity > 1) urgency += 0.2;
    else if (salesVelocity > 0.5) urgency += 0.1;

    return Math.min(1, urgency);
  }

  private calculateReorderQuantity(
    dailySalesVelocity: number,
    safetyStock: number,
    leadTimeDays: number = 14
  ): number {
    const leadTimeDemand = dailySalesVelocity * leadTimeDays;
    const reorderPoint = leadTimeDemand + safetyStock;
    return Math.max(reorderPoint, safetyStock * 2);
  }

  private calculateForecastConfidence(salesVelocity: SalesVelocityData): number {
    // Base confidence on data consistency and trend stability
    let confidence = 0.7; // Base confidence

    if (salesVelocity.trend === 'stable') confidence += 0.2;
    else if (salesVelocity.trend === 'increasing') confidence += 0.1;

    if (salesVelocity.dailyAverage > 0.1) confidence += 0.1; // Has meaningful sales

    return Math.min(1, confidence);
  }

  private async getLastSaleDate(
    tenantId: string,
    variantId: string,
    locationId: string
  ): Promise<Date | undefined> {
    const lastSale = await this.prisma.stockMovement.findFirst({
      where: {
        tenantId,
        variantId,
        locationId,
        type: 'out',
        reason: { in: ['sale', 'order'] }
      },
      orderBy: { createdAt: 'desc' }
    });

    return lastSale?.createdAt;
  }

  private async getLastMovementDate(
    tenantId: string,
    variantId: string,
    locationId: string
  ): Promise<Date | undefined> {
    const lastMovement = await this.prisma.stockMovement.findFirst({
      where: {
        tenantId,
        variantId,
        locationId
      },
      orderBy: { createdAt: 'desc' }
    });

    return lastMovement?.createdAt;
  }
}