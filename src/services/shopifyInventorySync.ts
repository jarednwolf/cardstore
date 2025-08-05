import { PrismaClient } from '@prisma/client';
import { logger } from '../config/logger';
import { RequestContext } from '../types';
import { getShopifyRestClient, ShopifyConfig, validateShopifyConfig } from '../config/shopify';
import { RestClient } from '@shopify/shopify-api';

export interface ShopifyInventorySync {
  id: string;
  tenantId: string;
  variantId: string;
  shopifyVariantId: string;
  locationId: string;
  shopifyLocationId: string;
  lastSyncAt: Date;
  syncStatus: 'pending' | 'syncing' | 'completed' | 'failed';
  errorMessage?: string;
  retryCount: number;
}

export interface SyncResult {
  success: boolean;
  variantId: string;
  shopifyVariantId: string;
  previousQuantity: number;
  newQuantity: number;
  errorMessage?: string;
}

export interface BulkSyncResult {
  totalItems: number;
  successful: number;
  failed: number;
  results: SyncResult[];
  errors: string[];
}

export class ShopifyInventorySyncService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    
    // Validate Shopify configuration on startup
    if (!validateShopifyConfig()) {
      logger.warn('Shopify configuration is incomplete. Some features may not work.');
    }
  }

  /**
   * Get Shopify client for a specific tenant
   */
  private async getShopifyClient(tenantId: string): Promise<RestClient | null> {
    try {
      // Get tenant's Shopify configuration from settings
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          settings: true
        }
      });

      if (!tenant?.settings) {
        logger.warn('Tenant not found', { tenantId });
        return null;
      }

      const settings = JSON.parse(tenant.settings);
      const shopifyConfig = settings.shopify;

      if (!shopifyConfig?.shop || !shopifyConfig?.accessToken) {
        logger.warn('Tenant Shopify configuration not found in settings', { tenantId });
        return null;
      }

      const config: ShopifyConfig = {
        shop: shopifyConfig.shop,
        accessToken: shopifyConfig.accessToken
      };

      return getShopifyRestClient(config);
    } catch (error) {
      logger.error('Failed to get Shopify client', {
        error: error instanceof Error ? error.message : 'Unknown error',
        tenantId
      });
      return null;
    }
  }

  /**
   * Sync inventory level to Shopify for a specific variant
   */
  async syncInventoryToShopify(
    tenantId: string,
    variantId: string,
    locationId: string,
    context: RequestContext
  ): Promise<SyncResult> {
    logger.info('Syncing inventory to Shopify', {
      tenantId,
      variantId,
      locationId,
      userId: context.userId,
      correlationId: context.correlationId
    });

    try {
      // Get variant and location mapping
      const variant = await this.prisma.productVariant.findFirst({
        where: { id: variantId, tenantId }
      });

      if (!variant?.shopifyVariantId) {
        throw new Error('Variant not linked to Shopify');
      }

      const location = await this.prisma.inventoryLocation.findFirst({
        where: { id: locationId, tenantId }
      });

      if (!location?.shopifyLocationId) {
        throw new Error('Location not linked to Shopify');
      }

      // Get current inventory level
      const inventoryItem = await this.prisma.inventoryItem.findFirst({
        where: { tenantId, variantId, locationId }
      });

      if (!inventoryItem) {
        throw new Error('Inventory item not found');
      }

      // Calculate available to sell (considering channel buffers)
      const channelBuffers = inventoryItem.channelBuffers ? 
        JSON.parse(inventoryItem.channelBuffers) : {};
      const shopifyBuffer = channelBuffers.shopify || 0;
      const availableToSell = Math.max(0, 
        inventoryItem.onHand - inventoryItem.reserved - inventoryItem.safetyStock + shopifyBuffer
      );

      // Get current Shopify inventory level
      const currentShopifyLevel = await this.getShopifyInventoryLevel(
        tenantId,
        variant.shopifyVariantId,
        location.shopifyLocationId
      );

      // Update Shopify if different
      if (currentShopifyLevel !== availableToSell) {
        await this.updateShopifyInventoryLevel(
          tenantId,
          variant.shopifyVariantId,
          location.shopifyLocationId,
          availableToSell
        );

        logger.info('Shopify inventory updated', {
          variantId,
          shopifyVariantId: variant.shopifyVariantId,
          locationId,
          shopifyLocationId: location.shopifyLocationId,
          previousQuantity: currentShopifyLevel,
          newQuantity: availableToSell
        });
      }

      // Record sync activity
      await this.recordSyncActivity(
        tenantId,
        variantId,
        variant.shopifyVariantId,
        locationId,
        location.shopifyLocationId,
        'completed',
        context
      );

      return {
        success: true,
        variantId,
        shopifyVariantId: variant.shopifyVariantId,
        previousQuantity: currentShopifyLevel,
        newQuantity: availableToSell
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      logger.error('Failed to sync inventory to Shopify', {
        error: errorMessage,
        tenantId,
        variantId,
        locationId,
        correlationId: context.correlationId
      });

      // Record failed sync
      await this.recordSyncActivity(
        tenantId,
        variantId,
        '',
        locationId,
        '',
        'failed',
        context,
        errorMessage
      );

      return {
        success: false,
        variantId,
        shopifyVariantId: '',
        previousQuantity: 0,
        newQuantity: 0,
        errorMessage
      };
    }
  }

  /**
   * Bulk sync all inventory to Shopify
   */
  async bulkSyncInventoryToShopify(
    tenantId: string,
    locationId?: string,
    context?: RequestContext
  ): Promise<BulkSyncResult> {
    logger.info('Starting bulk inventory sync to Shopify', { tenantId, locationId });

    const where: any = { tenantId };
    if (locationId) {
      where.locationId = locationId;
    }

    const inventoryItems = await this.prisma.inventoryItem.findMany({
      where,
      include: {
        variant: true,
        location: true
      }
    });

    const results: SyncResult[] = [];
    const errors: string[] = [];
    let successful = 0;
    let failed = 0;

    // Process in batches to avoid overwhelming Shopify API
    const batchSize = 10;
    for (let i = 0; i < inventoryItems.length; i += batchSize) {
      const batch = inventoryItems.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (item) => {
        if (!item.variant.shopifyVariantId || !item.location.shopifyLocationId) {
          failed++;
          errors.push(`Variant ${item.variantId} or location ${item.locationId} not linked to Shopify`);
          return;
        }

        try {
          const syncContext = context || {
            userId: 'system',
            tenantId,
            userRole: 'owner',
            correlationId: `bulk-sync-${Date.now()}`,
            timestamp: new Date(),
            user: {
              id: 'system',
              email: 'system@system.local',
              name: 'System',
              role: 'owner',
              tenantId,
              isActive: true,
              lastLoginAt: new Date(),
              createdAt: new Date(),
              updatedAt: new Date()
            },
            ipAddress: '127.0.0.1',
            userAgent: 'system'
          };

          const result = await this.syncInventoryToShopify(
            tenantId,
            item.variantId,
            item.locationId,
            syncContext
          );

          results.push(result);
          
          if (result.success) {
            successful++;
          } else {
            failed++;
            if (result.errorMessage) {
              errors.push(result.errorMessage);
            }
          }
        } catch (error) {
          failed++;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Failed to sync ${item.variantId}: ${errorMessage}`);
        }
      });

      await Promise.all(batchPromises);

      // Add delay between batches to respect rate limits
      if (i + batchSize < inventoryItems.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    logger.info('Bulk inventory sync completed', {
      tenantId,
      totalItems: inventoryItems.length,
      successful,
      failed,
      errorCount: errors.length
    });

    return {
      totalItems: inventoryItems.length,
      successful,
      failed,
      results,
      errors
    };
  }

  /**
   * Sync inventory from Shopify to DeckStack
   */
  async syncInventoryFromShopify(
    tenantId: string,
    shopifyVariantId: string,
    shopifyLocationId: string,
    newQuantity: number,
    context: RequestContext
  ): Promise<boolean> {
    logger.info('Syncing inventory from Shopify', {
      tenantId,
      shopifyVariantId,
      shopifyLocationId,
      newQuantity,
      correlationId: context.correlationId
    });

    try {
      // Find the corresponding variant and location
      const variant = await this.prisma.productVariant.findFirst({
        where: { tenantId, shopifyVariantId }
      });

      if (!variant) {
        logger.warn('Variant not found for Shopify sync', { shopifyVariantId, tenantId });
        return false;
      }

      const location = await this.prisma.inventoryLocation.findFirst({
        where: { tenantId, shopifyLocationId }
      });

      if (!location) {
        logger.warn('Location not found for Shopify sync', { shopifyLocationId, tenantId });
        return false;
      }

      // Get current inventory
      const currentInventory = await this.prisma.inventoryItem.findFirst({
        where: {
          tenantId,
          variantId: variant.id,
          locationId: location.id
        }
      });

      const currentOnHand = currentInventory?.onHand || 0;
      const quantityChange = newQuantity - currentOnHand;

      if (quantityChange !== 0) {
        // Update inventory level
        await this.prisma.inventoryItem.upsert({
          where: {
            variantId_locationId: {
              variantId: variant.id,
              locationId: location.id
            }
          },
          update: {
            onHand: newQuantity,
            updatedAt: new Date()
          },
          create: {
            tenantId,
            variantId: variant.id,
            locationId: location.id,
            onHand: newQuantity,
            reserved: 0,
            safetyStock: 0,
            channelBuffers: '{}'
          }
        });

        // Record stock movement
        await this.prisma.stockMovement.create({
          data: {
            tenantId,
            variantId: variant.id,
            locationId: location.id,
            type: quantityChange > 0 ? 'in' : 'out',
            quantity: Math.abs(quantityChange),
            reason: 'shopify_sync',
            reference: `Shopify sync: ${shopifyVariantId}`,
            createdBy: context.userId
          }
        });

        logger.info('Inventory synced from Shopify', {
          variantId: variant.id,
          locationId: location.id,
          previousQuantity: currentOnHand,
          newQuantity,
          quantityChange
        });
      }

      return true;

    } catch (error) {
      logger.error('Failed to sync inventory from Shopify', {
        error: error instanceof Error ? error.message : 'Unknown error',
        tenantId,
        shopifyVariantId,
        shopifyLocationId,
        correlationId: context.correlationId
      });
      return false;
    }
  }

  /**
   * Get sync status and history
   */
  async getSyncHistory(
    tenantId: string,
    variantId?: string,
    limit: number = 50
  ): Promise<ShopifyInventorySync[]> {
    try {
      const where: any = { tenantId };
      if (variantId) {
        where.variantId = variantId;
      }

      const syncRecords = await this.prisma.shopifyInventorySync.findMany({
        where,
        orderBy: { syncedAt: 'desc' },
        take: limit,
        include: {
          variant: {
            select: { sku: true, title: true }
          },
          location: {
            select: { name: true }
          }
        }
      });

      // Map database records to interface format
      return syncRecords.map(record => ({
        id: record.id,
        tenantId: record.tenantId,
        variantId: record.variantId,
        shopifyVariantId: record.shopifyVariantId,
        locationId: record.locationId,
        shopifyLocationId: record.shopifyLocationId,
        lastSyncAt: record.syncedAt,
        syncStatus: record.status as 'pending' | 'syncing' | 'completed' | 'failed',
        errorMessage: record.errorMessage || '',
        retryCount: record.retryCount
      }));
    } catch (error) {
      logger.error('Failed to get sync history', {
        error: error instanceof Error ? error.message : 'Unknown error',
        tenantId,
        variantId
      });
      return [];
    }
  }

  // =============================================================================
  // PRIVATE HELPER METHODS
  // =============================================================================

  private async getShopifyInventoryLevel(
    tenantId: string,
    shopifyVariantId: string,
    shopifyLocationId: string
  ): Promise<number> {
    try {
      const client = await this.getShopifyClient(tenantId);
      if (!client) {
        throw new Error('Shopify client not available');
      }

      // First get the inventory item ID from the variant
      const variantResponse = await client.get({
        path: `variants/${shopifyVariantId}`,
      });

      const inventoryItemId = variantResponse.body.variant?.inventory_item_id;
      if (!inventoryItemId) {
        throw new Error('Inventory item ID not found for variant');
      }

      // Get inventory levels for the specific location
      const response = await client.get({
        path: 'inventory_levels',
        query: {
          inventory_item_ids: inventoryItemId,
          location_ids: shopifyLocationId
        }
      });

      const inventoryLevels = response.body.inventory_levels;
      return inventoryLevels?.[0]?.available || 0;
    } catch (error) {
      logger.error('Failed to get Shopify inventory level', {
        error: error instanceof Error ? error.message : 'Unknown error',
        tenantId,
        shopifyVariantId,
        shopifyLocationId
      });
      return 0;
    }
  }

  private async updateShopifyInventoryLevel(
    tenantId: string,
    shopifyVariantId: string,
    shopifyLocationId: string,
    quantity: number
  ): Promise<void> {
    try {
      const client = await this.getShopifyClient(tenantId);
      if (!client) {
        throw new Error('Shopify client not available');
      }

      // First get the inventory item ID from the variant
      const variantResponse = await client.get({
        path: `variants/${shopifyVariantId}`,
      });

      const inventoryItemId = variantResponse.body.variant?.inventory_item_id;
      if (!inventoryItemId) {
        throw new Error('Inventory item ID not found for variant');
      }

      // Update inventory level using the inventory_levels endpoint
      await client.post({
        path: 'inventory_levels/set',
        data: {
          inventory_item_id: inventoryItemId,
          location_id: shopifyLocationId,
          available: quantity
        }
      });

      logger.debug('Shopify inventory level updated', {
        tenantId,
        shopifyVariantId,
        shopifyLocationId,
        quantity,
        inventoryItemId
      });
    } catch (error) {
      logger.error('Failed to update Shopify inventory level', {
        error: error instanceof Error ? error.message : 'Unknown error',
        tenantId,
        shopifyVariantId,
        shopifyLocationId,
        quantity
      });
      throw error;
    }
  }

  private async recordSyncActivity(
    tenantId: string,
    variantId: string,
    shopifyVariantId: string,
    locationId: string,
    shopifyLocationId: string,
    status: 'completed' | 'failed',
    context: RequestContext,
    errorMessage?: string
  ): Promise<void> {
    try {
      // Create sync record with proper schema fields
      await this.prisma.shopifyInventorySync.create({
        data: {
          tenantId,
          variantId,
          shopifyVariantId,
          locationId,
          shopifyLocationId,
          syncType: 'to_shopify',
          previousQuantity: 0, // We'd need to track this properly
          newQuantity: 0, // We'd need to track this properly
          status: status === 'completed' ? 'completed' : 'failed',
          errorMessage: errorMessage || null,
          retryCount: status === 'failed' ? 1 : 0,
          syncedAt: new Date()
        }
      });

      logger.info('Sync activity recorded', {
        tenantId,
        variantId,
        shopifyVariantId,
        locationId,
        shopifyLocationId,
        status,
        errorMessage,
        userId: context.userId,
        correlationId: context.correlationId
      });
    } catch (error) {
      logger.error('Failed to record sync activity', {
        error: error instanceof Error ? error.message : 'Unknown error',
        tenantId,
        variantId,
        correlationId: context.correlationId
      });
    }
  }

}