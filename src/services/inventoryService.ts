import { PrismaClient } from '@prisma/client';
import { logger } from '../config/logger';
import {
  InventoryItem,
  InventoryLocation,
  StockMovement,
  InventoryUpdate,
  BulkUpdateResult,
  RequestContext,
  InventoryReservation,
  ReservationResult
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
          shopifyLocationId: data.shopifyLocationId || null,
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

  async updateInventory(updates: InventoryUpdate[], context: RequestContext): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx: any) => {
        for (const update of updates) {
          // Get or create inventory item
          let inventoryItem = await tx.inventoryItem.findFirst({
            where: {
              tenantId: context.tenantId,
              variantId: update.variantId,
              locationId: update.locationId,
            },
          });

          if (!inventoryItem) {
            // Create new inventory item
            inventoryItem = await tx.inventoryItem.create({
              data: {
                tenantId: context.tenantId,
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
              tenantId: context.tenantId,
              variantId: update.variantId,
              locationId: update.locationId,
              type: update.quantityChange > 0 ? 'in' : 'out',
              quantity: Math.abs(update.quantityChange),
              reason: update.reason,
              reference: update.reference,
              createdBy: context.userId,
            },
          });
        }
      });

      logger.info('Inventory updated successfully', {
        tenantId: context.tenantId,
        updateCount: updates.length,
        userId: context.userId,
        correlationId: context.correlationId
      });
    } catch (error) {
      logger.error('Failed to update inventory', {
        error,
        tenantId: context.tenantId,
        updates,
        userId: context.userId,
        correlationId: context.correlationId
      });
      throw error;
    }
  }

  async setInventoryLevel(
    variantId: string,
    locationId: string,
    quantity: number,
    context: RequestContext,
    reason: string = 'adjustment'
  ): Promise<InventoryItem> {
    try {
      const result = await this.prisma.$transaction(async (tx: any) => {
        // Get or create inventory item
        let inventoryItem = await tx.inventoryItem.findFirst({
          where: { tenantId: context.tenantId, variantId, locationId },
        });

        const previousQuantity = inventoryItem?.onHand || 0;
        const quantityChange = quantity - previousQuantity;

        if (!inventoryItem) {
          inventoryItem = await tx.inventoryItem.create({
            data: {
              tenantId: context.tenantId,
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
              tenantId: context.tenantId,
              variantId,
              locationId,
              type: quantityChange > 0 ? 'in' : 'out',
              quantity: Math.abs(quantityChange),
              reason,
              reference: `Set to ${quantity}`,
              createdBy: context.userId,
            },
          });
        }

        return inventoryItem;
      });

      const transformedItem = this.transformInventoryItem(result);
      logger.info('Inventory level set', {
        tenantId: context.tenantId,
        variantId,
        locationId,
        quantity,
        previousQuantity: result.onHand - (quantity - (result.onHand || 0)),
        userId: context.userId,
        correlationId: context.correlationId
      });
      
      return transformedItem;
    } catch (error) {
      logger.error('Failed to set inventory level', {
        error,
        tenantId: context.tenantId,
        variantId,
        locationId,
        quantity,
        userId: context.userId,
        correlationId: context.correlationId
      });
      throw error;
    }
  }

  // =============================================================================
  // INVENTORY RESERVATION SYSTEM
  // =============================================================================

  /**
   * Reserve inventory for an order
   */
  async reserveInventory(
    reservations: InventoryReservation[],
    context: RequestContext
  ): Promise<ReservationResult[]> {
    logger.info('Reserving inventory', {
      reservationCount: reservations.length,
      tenantId: context.tenantId,
      userId: context.userId,
      correlationId: context.correlationId
    });

    return await this.prisma.$transaction(async (tx: any) => {
      const results: ReservationResult[] = [];
      
      for (const reservation of reservations) {
        try {
          // Check available quantity
          const inventory = await tx.inventoryItem.findFirst({
            where: {
              tenantId: context.tenantId,
              variantId: reservation.variantId,
              locationId: reservation.locationId
            }
          });
          
          if (!inventory) {
            results.push({
              success: false,
              error: 'Inventory item not found',
              availableQuantity: 0
            });
            continue;
          }

          const availableQuantity = inventory.onHand - inventory.reserved;
          
          if (availableQuantity < reservation.quantity) {
            results.push({
              success: false,
              error: `Insufficient inventory: ${availableQuantity} available, ${reservation.quantity} requested`,
              availableQuantity
            });
            continue;
          }
          
          // Update reserved quantity
          await tx.inventoryItem.update({
            where: { id: inventory.id },
            data: {
              reserved: { increment: reservation.quantity }
            }
          });
          
          // Create reservation record
          const reservationRecord = await tx.inventoryReservation.create({
            data: {
              tenantId: context.tenantId,
              variantId: reservation.variantId,
              locationId: reservation.locationId,
              quantity: reservation.quantity,
              orderId: reservation.orderId,
              expiresAt: reservation.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours default
              createdBy: context.userId,
              status: 'active'
            }
          });
          
          // Record stock movement
          await tx.stockMovement.create({
            data: {
              tenantId: context.tenantId,
              variantId: reservation.variantId,
              locationId: reservation.locationId,
              type: 'out',
              quantity: reservation.quantity,
              reason: 'reservation',
              reference: `Reserved for order ${reservation.orderId}`,
              createdBy: context.userId
            }
          });
          
          results.push({
            success: true,
            reservationId: reservationRecord.id,
            availableQuantity: availableQuantity - reservation.quantity
          });

          logger.debug('Inventory reserved', {
            variantId: reservation.variantId,
            locationId: reservation.locationId,
            quantity: reservation.quantity,
            reservationId: reservationRecord.id,
            orderId: reservation.orderId
          });
          
        } catch (error) {
          logger.error('Failed to reserve inventory item', {
            error: error instanceof Error ? error.message : 'Unknown error',
            reservation,
            correlationId: context.correlationId
          });
          
          results.push({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            availableQuantity: 0
          });
        }
      }
      
      return results;
    });
  }

  /**
   * Release inventory reservations
   */
  async releaseReservations(
    reservationIds: string[],
    context: RequestContext
  ): Promise<void> {
    logger.info('Releasing inventory reservations', {
      reservationCount: reservationIds.length,
      tenantId: context.tenantId,
      userId: context.userId,
      correlationId: context.correlationId
    });

    await this.prisma.$transaction(async (tx) => {
      // Get all reservations to release
      const reservations = await tx.inventoryReservation.findMany({
        where: {
          id: { in: reservationIds },
          tenantId: context.tenantId,
          status: 'active'
        }
      });

      for (const reservation of reservations) {
        // Release the reserved inventory
        await tx.inventoryItem.updateMany({
          where: {
            tenantId: context.tenantId,
            variantId: reservation.variantId,
            locationId: reservation.locationId
          },
          data: {
            reserved: { decrement: reservation.quantity }
          }
        });

        // Mark reservation as cancelled
        await tx.inventoryReservation.update({
          where: { id: reservation.id },
          data: {
            status: 'cancelled',
            updatedAt: new Date()
          }
        });

        // Record stock movement
        await tx.stockMovement.create({
          data: {
            tenantId: context.tenantId,
            variantId: reservation.variantId,
            locationId: reservation.locationId,
            type: 'in',
            quantity: reservation.quantity,
            reason: 'reservation_released',
            reference: `Released reservation ${reservation.id}`,
            createdBy: context.userId
          }
        });
      }
    });

    logger.info('Reservation release completed', {
      reservationIds,
      tenantId: context.tenantId
    });
  }

  /**
   * Release reservations by order ID
   */
  async releaseReservationsByOrder(
    orderId: string,
    context: RequestContext
  ): Promise<void> {
    logger.info('Releasing reservations for order', {
      orderId,
      tenantId: context.tenantId,
      userId: context.userId,
      correlationId: context.correlationId
    });

    // Find all active reservations for this order
    const reservations = await this.prisma.inventoryReservation.findMany({
      where: {
        orderId,
        tenantId: context.tenantId,
        status: 'active'
      }
    });

    if (reservations.length > 0) {
      const reservationIds = reservations.map(r => r.id);
      await this.releaseReservations(reservationIds, context);
    }

    logger.info('Order reservation release completed', {
      orderId,
      reservationCount: reservations.length,
      tenantId: context.tenantId
    });
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

  async bulkUpdateInventory(updates: InventoryUpdate[], context: RequestContext): Promise<BulkUpdateResult> {
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
        await this.updateInventory(batch, context);
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

    logger.info('Bulk inventory update completed', {
      tenantId: context.tenantId,
      results,
      userId: context.userId,
      correlationId: context.correlationId
    });
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