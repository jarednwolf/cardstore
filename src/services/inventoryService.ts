import { PrismaClient } from '@prisma/client';
import { logger } from '../config/logger';
import { 
  InventoryItem, 
  InventoryLocation, 
  StockMovement,
  InventoryUpdate,
  BulkUpdateResult
} from '../types';

export class InventoryService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  // =============================================================================
  // LOCATION MANAGEMENT
  // =============================================================================

  async createLocation(tenantId: string, data: {
    name: string;
    type: 'warehouse' | 'store' | 'virtual';
    shopifyLocationId?: string;
    address?: any;
  }): Promise<InventoryLocation> {
    try {
      const location = await this.prisma.inventoryLocation.create({
        data: {
          tenantId,
          shopifyLocationId: data.shopifyLocationId,
          name: data.name,
          type: data.type,
          address: JSON.stringify(data.address || {}),
          isActive: true,
        },
      });

      const result = this.transformLocation(location);
      logger.info('Inventory location created', { locationId: location.id, tenantId });
      return result;
    } catch (error) {
      logger.error('Failed to create inventory location', { error, tenantId, data });
      throw error;
    }
  }

  async getLocations(tenantId: string): Promise<InventoryLocation[]> {
    try {
      const locations = await this.prisma.inventoryLocation.findMany({
        where: { tenantId, isActive: true },
        orderBy: { createdAt: 'asc' },
      });

      return locations.map((l: any) => this.transformLocation(l));
    } catch (error) {
      logger.error('Failed to get inventory locations', { error, tenantId });
      throw error;
    }
  }

  async getLocation(tenantId: string, locationId: string): Promise<InventoryLocation | null> {
    try {
      const location = await this.prisma.inventoryLocation.findFirst({
        where: { id: locationId, tenantId },
      });

      return location ? this.transformLocation(location) : null;
    } catch (error) {
      logger.error('Failed to get inventory location', { error, locationId, tenantId });
      throw error;
    }
  }

  // =============================================================================
  // INVENTORY OPERATIONS
  // =============================================================================

  async getInventory(tenantId: string, variantId: string, locationId?: string): Promise<InventoryItem[]> {
    try {
      const where: any = { tenantId, variantId };
      if (locationId) {
        where.locationId = locationId;
      }

      const inventoryItems = await this.prisma.inventoryItem.findMany({
        where,
        include: {
          variant: {
            include: {
              product: true,
            },
          },
          location: true,
        },
      });

      return inventoryItems.map((item: any) => this.transformInventoryItem(item));
    } catch (error) {
      logger.error('Failed to get inventory', { error, variantId, locationId, tenantId });
      throw error;
    }
  }

  async getAllInventory(tenantId: string, locationId?: string): Promise<InventoryItem[]> {
    try {
      const where: any = { tenantId };
      if (locationId) {
        where.locationId = locationId;
      }

      const inventoryItems = await this.prisma.inventoryItem.findMany({
        where,
        include: {
          variant: {
            include: {
              product: true,
            },
          },
          location: true,
        },
        orderBy: [
          { location: { name: 'asc' } },
          { variant: { sku: 'asc' } },
        ],
      });

      return inventoryItems.map((item: any) => this.transformInventoryItem(item));
    } catch (error) {
      logger.error('Failed to get all inventory', { error, locationId, tenantId });
      throw error;
    }
  }

  async updateInventory(tenantId: string, updates: InventoryUpdate[]): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx: any) => {
        for (const update of updates) {
          // Get or create inventory item
          let inventoryItem = await tx.inventoryItem.findFirst({
            where: {
              tenantId,
              variantId: update.variantId,
              locationId: update.locationId,
            },
          });

          if (!inventoryItem) {
            // Create new inventory item
            inventoryItem = await tx.inventoryItem.create({
              data: {
                tenantId,
                variantId: update.variantId,
                locationId: update.locationId,
                onHand: Math.max(0, update.quantityChange),
                reserved: 0,
                safetyStock: 0,
                channelBuffers: '{}',
              },
            });
          } else {
            // Update existing inventory item
            const newOnHand = Math.max(0, inventoryItem.onHand + update.quantityChange);
            await tx.inventoryItem.update({
              where: { id: inventoryItem.id },
              data: {
                onHand: newOnHand,
                updatedAt: new Date(),
              },
            });
          }

          // Record stock movement
          await tx.stockMovement.create({
            data: {
              tenantId,
              variantId: update.variantId,
              locationId: update.locationId,
              type: update.quantityChange > 0 ? 'in' : 'out',
              quantity: Math.abs(update.quantityChange),
              reason: update.reason,
              reference: update.reference,
              createdBy: 'dev-user', // TODO: Get from request context
            },
          });
        }
      });

      logger.info('Inventory updated successfully', { tenantId, updateCount: updates.length });
    } catch (error) {
      logger.error('Failed to update inventory', { error, tenantId, updates });
      throw error;
    }
  }

  async setInventoryLevel(
    tenantId: string, 
    variantId: string, 
    locationId: string, 
    quantity: number,
    reason: string = 'adjustment'
  ): Promise<InventoryItem> {
    try {
      const result = await this.prisma.$transaction(async (tx: any) => {
        // Get or create inventory item
        let inventoryItem = await tx.inventoryItem.findFirst({
          where: { tenantId, variantId, locationId },
        });

        const previousQuantity = inventoryItem?.onHand || 0;
        const quantityChange = quantity - previousQuantity;

        if (!inventoryItem) {
          inventoryItem = await tx.inventoryItem.create({
            data: {
              tenantId,
              variantId,
              locationId,
              onHand: Math.max(0, quantity),
              reserved: 0,
              safetyStock: 0,
              channelBuffers: '{}',
            },
            include: {
              variant: { include: { product: true } },
              location: true,
            },
          });
        } else {
          inventoryItem = await tx.inventoryItem.update({
            where: { id: inventoryItem.id },
            data: {
              onHand: Math.max(0, quantity),
              updatedAt: new Date(),
            },
            include: {
              variant: { include: { product: true } },
              location: true,
            },
          });
        }

        // Record stock movement if there was a change
        if (quantityChange !== 0) {
          await tx.stockMovement.create({
            data: {
              tenantId,
              variantId,
              locationId,
              type: quantityChange > 0 ? 'in' : 'out',
              quantity: Math.abs(quantityChange),
              reason,
              reference: `Set to ${quantity}`,
              createdBy: 'dev-user', // TODO: Get from request context
            },
          });
        }

        return inventoryItem;
      });

      const transformedItem = this.transformInventoryItem(result);
      logger.info('Inventory level set', { 
        tenantId, 
        variantId, 
        locationId, 
        quantity,
        previousQuantity: result.onHand - (quantity - (result.onHand || 0))
      });
      
      return transformedItem;
    } catch (error) {
      logger.error('Failed to set inventory level', { error, tenantId, variantId, locationId, quantity });
      throw error;
    }
  }

  // =============================================================================
  // CHANNEL BUFFER MANAGEMENT
  // =============================================================================

  async setChannelBuffer(
    tenantId: string,
    variantId: string,
    locationId: string,
    channel: string,
    buffer: number
  ): Promise<void> {
    try {
      // Get or create inventory item
      let inventoryItem = await this.prisma.inventoryItem.findFirst({
        where: { tenantId, variantId, locationId },
      });

      if (!inventoryItem) {
        inventoryItem = await this.prisma.inventoryItem.create({
          data: {
            tenantId,
            variantId,
            locationId,
            onHand: 0,
            reserved: 0,
            safetyStock: 0,
            channelBuffers: JSON.stringify({ [channel]: buffer }),
          },
        });
      } else {
        const currentBuffers = inventoryItem.channelBuffers ? 
          JSON.parse(inventoryItem.channelBuffers) : {};
        currentBuffers[channel] = buffer;

        await this.prisma.inventoryItem.update({
          where: { id: inventoryItem.id },
          data: {
            channelBuffers: JSON.stringify(currentBuffers),
            updatedAt: new Date(),
          },
        });
      }

      logger.info('Channel buffer set', { tenantId, variantId, locationId, channel, buffer });
    } catch (error) {
      logger.error('Failed to set channel buffer', { error, tenantId, variantId, locationId, channel, buffer });
      throw error;
    }
  }

  async getAvailableToSell(
    tenantId: string,
    variantId: string,
    channel: string,
    locationId?: string
  ): Promise<number> {
    try {
      const where: any = { tenantId, variantId };
      if (locationId) {
        where.locationId = locationId;
      }

      const inventoryItems = await this.prisma.inventoryItem.findMany({
        where,
      });

      let totalAvailable = 0;

      for (const item of inventoryItems) {
        const available = item.onHand - item.reserved;
        const channelBuffers = item.channelBuffers ? JSON.parse(item.channelBuffers) : {};
        const channelBuffer = channelBuffers[channel] || 0;
        const safetyStock = item.safetyStock || 0;

        // Available to sell = on hand - reserved - safety stock - other channel buffers + this channel's buffer
        const otherChannelBuffers = Object.entries(channelBuffers)
          .filter(([ch]) => ch !== channel)
          .reduce((sum, [, buffer]) => sum + (buffer as number), 0);

        const availableForChannel = Math.max(0, 
          available - safetyStock - otherChannelBuffers + channelBuffer
        );

        totalAvailable += availableForChannel;
      }

      return totalAvailable;
    } catch (error) {
      logger.error('Failed to get available to sell', { error, tenantId, variantId, channel, locationId });
      throw error;
    }
  }

  // =============================================================================
  // STOCK MOVEMENTS
  // =============================================================================

  async getStockHistory(
    tenantId: string,
    variantId: string,
    locationId?: string,
    limit: number = 50
  ): Promise<StockMovement[]> {
    try {
      const where: any = { tenantId, variantId };
      if (locationId) {
        where.locationId = locationId;
      }

      const movements = await this.prisma.stockMovement.findMany({
        where,
        include: {
          variant: { include: { product: true } },
          location: true,
          user: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      return movements.map((movement: any) => this.transformStockMovement(movement));
    } catch (error) {
      logger.error('Failed to get stock history', { error, tenantId, variantId, locationId });
      throw error;
    }
  }

  // =============================================================================
  // BULK OPERATIONS
  // =============================================================================

  async bulkUpdateInventory(tenantId: string, updates: InventoryUpdate[]): Promise<BulkUpdateResult> {
    const results: BulkUpdateResult = {
      success: 0,
      failed: 0,
      errors: [],
    };

    // Process in batches to avoid overwhelming the database
    const batchSize = 50;
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);
      
      try {
        await this.updateInventory(tenantId, batch);
        results.success += batch.length;
      } catch (error) {
        results.failed += batch.length;
        results.errors.push({
          row: i + 1,
          message: error instanceof Error ? error.message : 'Unknown error',
          data: batch,
        });
      }
    }

    logger.info('Bulk inventory update completed', { tenantId, results });
    return results;
  }

  // =============================================================================
  // HELPER METHODS
  // =============================================================================

  private transformLocation(location: any): InventoryLocation {
    return {
      id: location.id,
      tenantId: location.tenantId,
      shopifyLocationId: location.shopifyLocationId,
      name: location.name,
      type: location.type,
      address: location.address ? JSON.parse(location.address) : undefined,
      isActive: location.isActive,
      createdAt: location.createdAt,
    };
  }

  private transformInventoryItem(item: any): InventoryItem {
    return {
      id: item.id,
      tenantId: item.tenantId,
      variantId: item.variantId,
      locationId: item.locationId,
      onHand: item.onHand,
      reserved: item.reserved,
      available: item.onHand - item.reserved,
      safetyStock: item.safetyStock,
      channelBuffers: item.channelBuffers ? JSON.parse(item.channelBuffers) : {},
      lastCountedAt: item.lastCountedAt,
      updatedAt: item.updatedAt,
      variant: item.variant,
      location: item.location ? this.transformLocation(item.location) : undefined,
    } as InventoryItem;
  }

  private transformStockMovement(movement: any): StockMovement {
    return {
      id: movement.id,
      variantId: movement.variantId,
      locationId: movement.locationId,
      type: movement.type,
      quantity: movement.quantity,
      reason: movement.reason,
      reference: movement.reference,
      createdAt: movement.createdAt,
      createdBy: movement.createdBy,
    };
  }
}