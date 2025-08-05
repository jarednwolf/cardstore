import { PrismaClient } from '@prisma/client';
import { logger } from '../config/logger';
import { RequestContext } from '../types/index';

export interface InventoryTransfer {
  id: string;
  tenantId: string;
  variantId: string;
  fromLocationId: string;
  toLocationId: string;
  quantity: number;
  status: 'pending' | 'in_transit' | 'completed' | 'cancelled';
  reason: string;
  reference?: string | undefined;
  notes?: string | undefined;
  createdBy: string;
  createdAt: Date;
  completedAt?: Date | undefined;
  completedBy?: string | undefined;
}

export interface CreateTransferRequest {
  variantId: string;
  fromLocationId: string;
  toLocationId: string;
  quantity: number;
  reason: string;
  reference?: string;
  notes?: string;
}

export interface TransferValidationResult {
  isValid: boolean;
  errors: string[];
  availableQuantity?: number;
}

export class InventoryTransferService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Create a new inventory transfer
   */
  async createTransfer(
    request: CreateTransferRequest,
    context: RequestContext
  ): Promise<InventoryTransfer> {
    logger.info('Creating inventory transfer', {
      request,
      tenantId: context.tenantId,
      userId: context.userId,
      correlationId: context.correlationId
    });

    // Validate the transfer request
    const validation = await this.validateTransfer(request, context);
    if (!validation.isValid) {
      throw new Error(`Transfer validation failed: ${validation.errors.join(', ')}`);
    }

    return await this.prisma.$transaction(async (tx) => {
      // Check source inventory availability
      const sourceInventory = await tx.inventoryItem.findFirst({
        where: {
          tenantId: context.tenantId,
          variantId: request.variantId,
          locationId: request.fromLocationId
        }
      });

      if (!sourceInventory || sourceInventory.onHand < request.quantity) {
        throw new Error('Insufficient inventory at source location');
      }

      // Reserve inventory at source location
      await tx.inventoryItem.update({
        where: { id: sourceInventory.id },
        data: {
          reserved: { increment: request.quantity }
        }
      });

      // Create the transfer record in database
      const transfer = await tx.inventoryTransfer.create({
        data: {
          tenantId: context.tenantId,
          variantId: request.variantId,
          fromLocationId: request.fromLocationId,
          toLocationId: request.toLocationId,
          quantity: request.quantity,
          status: 'pending',
          reason: request.reason,
          reference: request.reference || null,
          notes: request.notes || null,
          createdBy: context.userId
        }
      });

      // Record stock movement for source (out)
      await tx.stockMovement.create({
        data: {
          tenantId: context.tenantId,
          variantId: request.variantId,
          locationId: request.fromLocationId,
          type: 'out',
          quantity: request.quantity,
          reason: 'transfer_out',
          reference: `Transfer ${transfer.id} to ${request.toLocationId}`,
          createdBy: context.userId
        }
      });

      logger.info('Inventory transfer created', {
        transferId: transfer.id,
        tenantId: context.tenantId,
        variantId: request.variantId,
        fromLocationId: request.fromLocationId,
        toLocationId: request.toLocationId,
        quantity: request.quantity
      });

      return {
        id: transfer.id,
        tenantId: transfer.tenantId,
        variantId: transfer.variantId,
        fromLocationId: transfer.fromLocationId,
        toLocationId: transfer.toLocationId,
        quantity: transfer.quantity,
        status: transfer.status as 'pending' | 'in_transit' | 'completed' | 'cancelled',
        reason: transfer.reason,
        reference: transfer.reference || undefined,
        notes: transfer.notes || undefined,
        createdBy: transfer.createdBy,
        createdAt: transfer.createdAt,
        completedAt: transfer.completedAt || undefined,
        completedBy: transfer.completedBy || undefined
      };
    });
  }

  /**
   * Complete an inventory transfer
   */
  async completeTransfer(
    transferId: string,
    context: RequestContext
  ): Promise<InventoryTransfer> {
    logger.info('Completing inventory transfer', {
      transferId,
      tenantId: context.tenantId,
      userId: context.userId,
      correlationId: context.correlationId
    });

    return await this.prisma.$transaction(async (tx) => {
      // Get the transfer record
      const transfer = await tx.inventoryTransfer.findFirst({
        where: {
          id: transferId,
          tenantId: context.tenantId,
          status: 'pending'
        }
      });

      if (!transfer) {
        throw new Error('Transfer not found or already completed');
      }

      // Release reservation from source location
      await tx.inventoryItem.updateMany({
        where: {
          tenantId: context.tenantId,
          variantId: transfer.variantId,
          locationId: transfer.fromLocationId
        },
        data: {
          onHand: { decrement: transfer.quantity },
          reserved: { decrement: transfer.quantity }
        }
      });

      // Add inventory to destination location
      await tx.inventoryItem.upsert({
        where: {
          variantId_locationId: {
            variantId: transfer.variantId,
            locationId: transfer.toLocationId
          }
        },
        update: {
          onHand: { increment: transfer.quantity }
        },
        create: {
          tenantId: context.tenantId,
          variantId: transfer.variantId,
          locationId: transfer.toLocationId,
          onHand: transfer.quantity,
          reserved: 0,
          safetyStock: 0,
          channelBuffers: '{}'
        }
      });

      // Update transfer status
      const completedTransfer = await tx.inventoryTransfer.update({
        where: { id: transferId },
        data: {
          status: 'completed',
          completedAt: new Date(),
          completedBy: context.userId
        }
      });

      // Record stock movement for destination (in)
      await tx.stockMovement.create({
        data: {
          tenantId: context.tenantId,
          variantId: transfer.variantId,
          locationId: transfer.toLocationId,
          type: 'in',
          quantity: transfer.quantity,
          reason: 'transfer_in',
          reference: `Transfer ${transferId} from ${transfer.fromLocationId}`,
          createdBy: context.userId
        }
      });

      logger.info('Inventory transfer completed', {
        transferId,
        tenantId: context.tenantId,
        variantId: transfer.variantId,
        fromLocationId: transfer.fromLocationId,
        toLocationId: transfer.toLocationId,
        quantity: transfer.quantity
      });

      return {
        id: completedTransfer.id,
        tenantId: completedTransfer.tenantId,
        variantId: completedTransfer.variantId,
        fromLocationId: completedTransfer.fromLocationId,
        toLocationId: completedTransfer.toLocationId,
        quantity: completedTransfer.quantity,
        status: completedTransfer.status as 'pending' | 'in_transit' | 'completed' | 'cancelled',
        reason: completedTransfer.reason,
        reference: completedTransfer.reference || undefined,
        notes: completedTransfer.notes || undefined,
        createdBy: completedTransfer.createdBy,
        createdAt: completedTransfer.createdAt,
        completedAt: completedTransfer.completedAt || undefined,
        completedBy: completedTransfer.completedBy || undefined
      };
    });
  }

  /**
   * Validate a transfer request
   */
  async validateTransfer(
    request: CreateTransferRequest,
    context: RequestContext
  ): Promise<TransferValidationResult> {
    const errors: string[] = [];

    // Basic validation
    if (request.quantity <= 0) {
      errors.push('Quantity must be greater than 0');
    }

    if (request.fromLocationId === request.toLocationId) {
      errors.push('Source and destination locations cannot be the same');
    }

    // Check if locations exist
    const [fromLocation, toLocation] = await Promise.all([
      this.prisma.inventoryLocation.findFirst({
        where: { id: request.fromLocationId, tenantId: context.tenantId, isActive: true }
      }),
      this.prisma.inventoryLocation.findFirst({
        where: { id: request.toLocationId, tenantId: context.tenantId, isActive: true }
      })
    ]);

    if (!fromLocation) {
      errors.push('Source location not found or inactive');
    }

    if (!toLocation) {
      errors.push('Destination location not found or inactive');
    }

    // Check variant exists
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: request.variantId, tenantId: context.tenantId }
    });

    if (!variant) {
      errors.push('Product variant not found');
    }

    // Check inventory availability
    let availableQuantity = 0;
    if (fromLocation && variant) {
      const sourceInventory = await this.prisma.inventoryItem.findFirst({
        where: {
          tenantId: context.tenantId,
          variantId: request.variantId,
          locationId: request.fromLocationId
        }
      });

      if (sourceInventory) {
        availableQuantity = sourceInventory.onHand - sourceInventory.reserved;
        if (availableQuantity < request.quantity) {
          errors.push(`Insufficient inventory: ${availableQuantity} available, ${request.quantity} requested`);
        }
      } else {
        errors.push('No inventory found at source location');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      availableQuantity
    };
  }

  /**
   * Get transfer history for a variant
   */
  async getTransferHistory(
    tenantId: string,
    variantId?: string,
    locationId?: string,
    limit: number = 50
  ): Promise<InventoryTransfer[]> {
    const where: any = { tenantId };

    if (variantId) {
      where.variantId = variantId;
    }

    if (locationId) {
      where.OR = [
        { fromLocationId: locationId },
        { toLocationId: locationId }
      ];
    }

    const transfers = await this.prisma.inventoryTransfer.findMany({
      where,
      include: {
        variant: { include: { product: true } },
        fromLocation: true,
        toLocation: true,
        creator: true,
        completer: true
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    return transfers.map(transfer => ({
      id: transfer.id,
      tenantId: transfer.tenantId,
      variantId: transfer.variantId,
      fromLocationId: transfer.fromLocationId,
      toLocationId: transfer.toLocationId,
      quantity: transfer.quantity,
      status: transfer.status as 'pending' | 'in_transit' | 'completed' | 'cancelled',
      reason: transfer.reason,
      reference: transfer.reference || undefined,
      notes: transfer.notes || undefined,
      createdBy: transfer.createdBy,
      createdAt: transfer.createdAt,
      completedAt: transfer.completedAt || undefined,
      completedBy: transfer.completedBy || undefined
    }));
  }

  /**
   * Get optimal transfer suggestions based on inventory levels
   */
  async getTransferSuggestions(
    tenantId: string,
    variantId?: string
  ): Promise<Array<{
    variantId: string;
    variantTitle: string;
    fromLocationId: string;
    fromLocationName: string;
    toLocationId: string;
    toLocationName: string;
    suggestedQuantity: number;
    reason: string;
  }>> {
    const suggestions: Array<{
      variantId: string;
      variantTitle: string;
      fromLocationId: string;
      fromLocationName: string;
      toLocationId: string;
      toLocationName: string;
      suggestedQuantity: number;
      reason: string;
    }> = [];

    const where: any = { tenantId };
    if (variantId) {
      where.variantId = variantId;
    }

    // Get all inventory items with location and variant details
    const inventoryItems = await this.prisma.inventoryItem.findMany({
      where,
      include: {
        variant: { include: { product: true } },
        location: true
      }
    });

    // Group by variant
    const variantGroups = new Map<string, typeof inventoryItems>();
    for (const item of inventoryItems) {
      const key = item.variantId;
      if (!variantGroups.has(key)) {
        variantGroups.set(key, []);
      }
      variantGroups.get(key)!.push(item);
    }

    // Analyze each variant for transfer opportunities
    for (const [vId, items] of variantGroups) {
      if (items.length < 2) continue; // Need at least 2 locations

      // Find locations with excess and shortage
      const excessLocations = items.filter(item => {
        const available = item.onHand - item.reserved;
        return available > item.safetyStock + 10; // 10+ buffer above safety stock
      });

      const shortageLocations = items.filter(item => {
        const available = item.onHand - item.reserved;
        return available <= item.safetyStock;
      });

      // Suggest transfers from excess to shortage
      for (const excessItem of excessLocations) {
        for (const shortageItem of shortageLocations) {
          const excessQuantity = (excessItem.onHand - excessItem.reserved) - excessItem.safetyStock - 5;
          const neededQuantity = shortageItem.safetyStock - (shortageItem.onHand - shortageItem.reserved) + 5;
          
          if (excessQuantity > 0 && neededQuantity > 0) {
            const transferQuantity = Math.min(excessQuantity, neededQuantity);
            
            suggestions.push({
              variantId: vId,
              variantTitle: excessItem.variant.title,
              fromLocationId: excessItem.locationId,
              fromLocationName: excessItem.location.name,
              toLocationId: shortageItem.locationId,
              toLocationName: shortageItem.location.name,
              suggestedQuantity: transferQuantity,
              reason: 'Rebalance inventory levels'
            });
          }
        }
      }
    }

    return suggestions.slice(0, 20); // Limit to top 20 suggestions
  }
}