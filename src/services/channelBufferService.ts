import { PrismaClient } from '@prisma/client';
import { logger } from '../config/logger';
import { RequestContext } from '../types';
import { InventoryAnalyticsService } from './inventoryAnalyticsService';

export interface ChannelBufferRule {
  id: string;
  tenantId: string;
  channel: string;
  variantId?: string | undefined; // If null, applies to all variants
  locationId?: string | undefined; // If null, applies to all locations
  bufferType: 'fixed' | 'percentage' | 'velocity_based' | 'dynamic';
  value: number; // Fixed quantity, percentage, or days of velocity
  minBuffer: number;
  maxBuffer: number;
  priority: number; // Higher priority rules override lower priority
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChannelAvailability {
  variantId: string;
  locationId: string;
  channel: string;
  totalOnHand: number;
  reserved: number;
  safetyStock: number;
  channelBuffer: number;
  availableToSell: number;
  bufferRule?: ChannelBufferRule;
  calculation: {
    baseAvailable: number;
    appliedBuffers: Record<string, number>;
    finalAvailable: number;
  };
}

export interface BufferOptimizationSuggestion {
  variantId: string;
  variantTitle: string;
  locationId: string;
  locationName: string;
  channel: string;
  currentBuffer: number;
  suggestedBuffer: number;
  reason: string;
  impact: {
    additionalSales: number;
    reducedStockouts: number;
    confidence: number;
  };
}

export class ChannelBufferService {
  private prisma: PrismaClient;
  private analyticsService: InventoryAnalyticsService;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.analyticsService = new InventoryAnalyticsService(prisma);
  }

  /**
   * Calculate sophisticated channel availability with dynamic buffers
   */
  async calculateChannelAvailability(
    tenantId: string,
    variantId: string,
    channel: string,
    locationId?: string
  ): Promise<ChannelAvailability[]> {
    logger.info('Calculating channel availability', { tenantId, variantId, channel, locationId });

    const where: any = { tenantId, variantId };
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

    const availabilities: ChannelAvailability[] = [];

    for (const item of inventoryItems) {
      const baseAvailable = item.onHand - item.reserved;
      const channelBuffer = await this.calculateDynamicBuffer(
        tenantId,
        variantId,
        item.locationId,
        channel
      );

      // Get all channel buffers for this item
      const currentBuffers = item.channelBuffers ? JSON.parse(item.channelBuffers) : {};
      const appliedBuffers: Record<string, number> = {};
      
      // Calculate buffers for other channels
      let totalOtherChannelBuffers = 0;
      for (const [otherChannel, buffer] of Object.entries(currentBuffers)) {
        if (otherChannel !== channel) {
          appliedBuffers[otherChannel] = buffer as number;
          totalOtherChannelBuffers += buffer as number;
        }
      }

      // Available to sell = base available - safety stock - other channel buffers + this channel's buffer
      const availableToSell = Math.max(0, 
        baseAvailable - item.safetyStock - totalOtherChannelBuffers + channelBuffer
      );

      availabilities.push({
        variantId,
        locationId: item.locationId,
        channel,
        totalOnHand: item.onHand,
        reserved: item.reserved,
        safetyStock: item.safetyStock,
        channelBuffer,
        availableToSell,
        calculation: {
          baseAvailable,
          appliedBuffers,
          finalAvailable: availableToSell
        }
      });
    }

    return availabilities;
  }

  /**
   * Calculate dynamic buffer based on sales velocity and channel performance
   */
  async calculateDynamicBuffer(
    tenantId: string,
    variantId: string,
    locationId: string,
    channel: string
  ): Promise<number> {
    // Get buffer rules for this combination
    const bufferRule = await this.getApplicableBufferRule(tenantId, variantId, locationId, channel);
    
    if (!bufferRule) {
      return 0; // No buffer rule, no buffer
    }

    let calculatedBuffer = 0;

    switch (bufferRule.bufferType) {
      case 'fixed':
        calculatedBuffer = bufferRule.value;
        break;

      case 'percentage':
        const inventory = await this.prisma.inventoryItem.findFirst({
          where: { tenantId, variantId, locationId }
        });
        const available = inventory ? inventory.onHand - inventory.reserved : 0;
        calculatedBuffer = Math.floor(available * (bufferRule.value / 100));
        break;

      case 'velocity_based':
        const salesVelocity = await this.analyticsService.calculateSalesVelocity(
          tenantId,
          variantId,
          locationId,
          30
        );
        calculatedBuffer = Math.ceil(salesVelocity.dailyAverage * bufferRule.value);
        break;

      case 'dynamic':
        calculatedBuffer = await this.calculateIntelligentBuffer(
          tenantId,
          variantId,
          locationId,
          channel,
          bufferRule
        );
        break;
    }

    // Apply min/max constraints
    calculatedBuffer = Math.max(bufferRule.minBuffer, calculatedBuffer);
    calculatedBuffer = Math.min(bufferRule.maxBuffer, calculatedBuffer);

    return calculatedBuffer;
  }

  /**
   * Calculate intelligent buffer using machine learning-like approach
   */
  private async calculateIntelligentBuffer(
    tenantId: string,
    variantId: string,
    locationId: string,
    channel: string,
    rule: ChannelBufferRule
  ): Promise<number> {
    // Get sales velocity and trends
    const salesVelocity = await this.analyticsService.calculateSalesVelocity(
      tenantId,
      variantId,
      locationId,
      60 // Use 60 days for better trend analysis
    );

    // Base buffer on sales velocity
    let buffer = Math.ceil(salesVelocity.dailyAverage * 7); // 1 week of sales

    // Adjust for trend
    if (salesVelocity.trend === 'increasing') {
      buffer = Math.ceil(buffer * 1.3); // 30% increase for growing demand
    } else if (salesVelocity.trend === 'decreasing') {
      buffer = Math.ceil(buffer * 0.7); // 30% decrease for declining demand
    }

    // Adjust for channel performance (mock implementation)
    const channelPerformance = await this.getChannelPerformance(tenantId, channel);
    if (channelPerformance.conversionRate > 0.1) {
      buffer = Math.ceil(buffer * 1.2); // High-performing channel gets more buffer
    }

    // Seasonal adjustment (simplified)
    const seasonalFactor = this.getSeasonalFactor();
    buffer = Math.ceil(buffer * seasonalFactor);

    return buffer;
  }

  /**
   * Get applicable buffer rule with priority handling
   */
  private async getApplicableBufferRule(
    tenantId: string,
    variantId: string,
    locationId: string,
    channel: string
  ): Promise<ChannelBufferRule | null> {
    // For now, we'll simulate buffer rules since we don't have the table yet
    // In a real implementation, this would query a buffer_rules table
    
    // Default rule for demonstration
    return {
      id: `rule-${channel}-default`,
      tenantId,
      channel,
      variantId: undefined,
      locationId: undefined,
      bufferType: 'velocity_based',
      value: 3, // 3 days of velocity
      minBuffer: 1,
      maxBuffer: 50,
      priority: 1,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    } as ChannelBufferRule;
  }

  /**
   * Generate buffer optimization suggestions
   */
  async generateBufferOptimizationSuggestions(
    tenantId: string,
    channel?: string
  ): Promise<BufferOptimizationSuggestion[]> {
    logger.info('Generating buffer optimization suggestions', { tenantId, channel });

    const suggestions: BufferOptimizationSuggestion[] = [];
    
    // Get all inventory items
    const inventoryItems = await this.prisma.inventoryItem.findMany({
      where: { tenantId },
      include: {
        variant: { include: { product: true } },
        location: true
      }
    });

    const channels = channel ? [channel] : ['shopify', 'ebay', 'amazon', 'tcgplayer'];

    for (const item of inventoryItems) {
      for (const ch of channels) {
        const currentBuffers = item.channelBuffers ? JSON.parse(item.channelBuffers) : {};
        const currentBuffer = currentBuffers[ch] || 0;

        // Calculate optimal buffer
        const optimalBuffer = await this.calculateDynamicBuffer(
          tenantId,
          item.variantId,
          item.locationId,
          ch
        );

        // Only suggest if there's a significant difference
        const difference = Math.abs(optimalBuffer - currentBuffer);
        if (difference >= 2) { // At least 2 units difference
          const salesVelocity = await this.analyticsService.calculateSalesVelocity(
            tenantId,
            item.variantId,
            item.locationId,
            30
          );

          let reason = '';
          let additionalSales = 0;
          let reducedStockouts = 0;

          if (optimalBuffer > currentBuffer) {
            reason = 'Increase buffer to capture more sales and reduce stockouts';
            additionalSales = (optimalBuffer - currentBuffer) * 0.8; // Estimate
            reducedStockouts = salesVelocity.dailyAverage > 0.5 ? 1 : 0;
          } else {
            reason = 'Reduce buffer to free up inventory for other channels';
            additionalSales = 0;
            reducedStockouts = 0;
          }

          suggestions.push({
            variantId: item.variantId,
            variantTitle: item.variant.title,
            locationId: item.locationId,
            locationName: item.location.name,
            channel: ch,
            currentBuffer,
            suggestedBuffer: optimalBuffer,
            reason,
            impact: {
              additionalSales,
              reducedStockouts,
              confidence: salesVelocity.dailyAverage > 0.1 ? 0.8 : 0.5
            }
          });
        }
      }
    }

    // Sort by potential impact
    suggestions.sort((a, b) => 
      (b.impact.additionalSales + b.impact.reducedStockouts) - 
      (a.impact.additionalSales + a.impact.reducedStockouts)
    );

    return suggestions.slice(0, 20); // Top 20 suggestions
  }

  /**
   * Apply buffer optimization suggestions
   */
  async applyBufferOptimization(
    suggestions: BufferOptimizationSuggestion[],
    context: RequestContext
  ): Promise<{ applied: number; failed: number; errors: string[] }> {
    logger.info('Applying buffer optimizations', {
      suggestionCount: suggestions.length,
      tenantId: context.tenantId,
      userId: context.userId
    });

    let applied = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const suggestion of suggestions) {
      try {
        // Get current inventory item
        const inventoryItem = await this.prisma.inventoryItem.findFirst({
          where: {
            tenantId: context.tenantId,
            variantId: suggestion.variantId,
            locationId: suggestion.locationId
          }
        });

        if (!inventoryItem) {
          errors.push(`Inventory item not found: ${suggestion.variantId} at ${suggestion.locationId}`);
          failed++;
          continue;
        }

        // Update channel buffers
        const currentBuffers = inventoryItem.channelBuffers ? 
          JSON.parse(inventoryItem.channelBuffers) : {};
        currentBuffers[suggestion.channel] = suggestion.suggestedBuffer;

        await this.prisma.inventoryItem.update({
          where: { id: inventoryItem.id },
          data: {
            channelBuffers: JSON.stringify(currentBuffers),
            updatedAt: new Date()
          }
        });

        applied++;
        
        logger.debug('Buffer optimization applied', {
          variantId: suggestion.variantId,
          locationId: suggestion.locationId,
          channel: suggestion.channel,
          oldBuffer: suggestion.currentBuffer,
          newBuffer: suggestion.suggestedBuffer
        });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Failed to apply optimization for ${suggestion.variantId}: ${errorMessage}`);
        failed++;
      }
    }

    logger.info('Buffer optimization completed', {
      applied,
      failed,
      errorCount: errors.length,
      tenantId: context.tenantId
    });

    return { applied, failed, errors };
  }

  // =============================================================================
  // HELPER METHODS
  // =============================================================================

  private async getChannelPerformance(tenantId: string, channel: string): Promise<{
    conversionRate: number;
    averageOrderValue: number;
    returnRate: number;
  }> {
    // Mock implementation - in reality, this would analyze order data
    const channelPerformance = {
      shopify: { conversionRate: 0.15, averageOrderValue: 45, returnRate: 0.05 },
      ebay: { conversionRate: 0.08, averageOrderValue: 35, returnRate: 0.08 },
      amazon: { conversionRate: 0.12, averageOrderValue: 55, returnRate: 0.06 },
      tcgplayer: { conversionRate: 0.20, averageOrderValue: 25, returnRate: 0.03 }
    };

    return channelPerformance[channel as keyof typeof channelPerformance] || 
           { conversionRate: 0.10, averageOrderValue: 40, returnRate: 0.05 };
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