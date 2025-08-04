import { PrismaClient } from '@prisma/client';
import { logger } from '../config/logger';
import { RequestContext, InventoryUpdate, BulkUpdateResult } from '../types';
import { InventoryService } from './inventoryService';
import * as csv from 'csv-parser';
import { Readable } from 'stream';

export interface CSVInventoryRow {
  sku: string;
  locationName: string;
  quantity: number;
  safetyStock?: number | undefined;
  reason?: string;
  reference?: string;
}

export interface CSVImportResult {
  totalRows: number;
  successful: number;
  failed: number;
  errors: Array<{
    row: number;
    sku: string;
    error: string;
  }>;
  summary: {
    newItems: number;
    updatedItems: number;
    skippedItems: number;
  };
}

export interface CSVExportOptions {
  locationId?: string;
  includeZeroQuantity?: boolean;
  includeInactive?: boolean;
  format: 'standard' | 'shopify' | 'tcgplayer';
}

export interface InventoryExportData {
  sku: string;
  title: string;
  locationName: string;
  onHand: number;
  reserved: number;
  available: number;
  safetyStock: number;
  price: number;
  cost?: number;
  lastCountedAt?: string | undefined;
  lastMovementAt?: string | undefined;
  category?: string | undefined;
  vendor?: string | undefined;
}

export interface BatchOperation {
  id: string;
  tenantId: string;
  type: 'import' | 'export' | 'bulk_update' | 'recount';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number; // 0-100
  totalItems: number;
  processedItems: number;
  successfulItems: number;
  failedItems: number;
  startedAt: Date;
  completedAt?: Date;
  errorMessage?: string;
  resultData?: any;
  createdBy: string;
}

export class BatchInventoryService {
  private prisma: PrismaClient;
  private inventoryService: InventoryService;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.inventoryService = new InventoryService(prisma);
  }

  /**
   * Import inventory from CSV data
   */
  async importInventoryFromCSV(
    csvData: string,
    tenantId: string,
    context: RequestContext,
    options: {
      updateExisting?: boolean;
      createMissing?: boolean;
      skipValidation?: boolean;
    } = {}
  ): Promise<CSVImportResult> {
    logger.info('Starting CSV inventory import', {
      tenantId,
      userId: context.userId,
      correlationId: context.correlationId,
      options
    });

    const result: CSVImportResult = {
      totalRows: 0,
      successful: 0,
      failed: 0,
      errors: [],
      summary: {
        newItems: 0,
        updatedItems: 0,
        skippedItems: 0
      }
    };

    try {
      // Parse CSV data
      const rows = await this.parseCSVData(csvData);
      result.totalRows = rows.length;

      // Get all locations for mapping
      const locations = await this.prisma.inventoryLocation.findMany({
        where: { tenantId, isActive: true }
      });
      const locationMap = new Map(locations.map(loc => [loc.name.toLowerCase(), loc.id]));

      // Get all variants for SKU mapping
      const variants = await this.prisma.productVariant.findMany({
        where: { tenantId },
        include: { product: true }
      });
      const variantMap = new Map(variants.map(v => [v.sku.toLowerCase(), v]));

      // Process each row
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row) continue;
        
        const rowNumber = i + 1;

        try {
          // Validate row data
          const validation = this.validateCSVRow(row, rowNumber);
          if (!validation.isValid) {
            result.errors.push({
              row: rowNumber,
              sku: row.sku || 'unknown',
              error: validation.errors.join(', ')
            });
            result.failed++;
            continue;
          }

          // Find variant by SKU
          const variant = variantMap.get(row.sku.toLowerCase());
          if (!variant) {
            if (options.createMissing) {
              // TODO: Create missing variant
              result.errors.push({
                row: rowNumber,
                sku: row.sku,
                error: 'Variant creation not implemented yet'
              });
              result.failed++;
              continue;
            } else {
              result.errors.push({
                row: rowNumber,
                sku: row.sku,
                error: 'SKU not found'
              });
              result.failed++;
              continue;
            }
          }

          // Find location
          const locationId = locationMap.get(row.locationName.toLowerCase());
          if (!locationId) {
            result.errors.push({
              row: rowNumber,
              sku: row.sku,
              error: `Location '${row.locationName}' not found`
            });
            result.failed++;
            continue;
          }

          // Check if inventory item exists
          const existingItem = await this.prisma.inventoryItem.findFirst({
            where: {
              tenantId,
              variantId: variant.id,
              locationId
            }
          });

          if (existingItem) {
            if (options.updateExisting) {
              // Update existing item
              await this.inventoryService.setInventoryLevel(
                variant.id,
                locationId,
                row.quantity,
                context,
                row.reason || 'csv_import'
              );

              // Update safety stock if provided
              if (row.safetyStock !== undefined) {
                await this.prisma.inventoryItem.update({
                  where: { id: existingItem.id },
                  data: { safetyStock: row.safetyStock }
                });
              }

              result.summary.updatedItems++;
              result.successful++;
            } else {
              result.summary.skippedItems++;
            }
          } else {
            // Create new inventory item
            await this.inventoryService.setInventoryLevel(
              variant.id,
              locationId,
              row.quantity,
              context,
              row.reason || 'csv_import'
            );

            // Set safety stock if provided
            if (row.safetyStock !== undefined) {
              const newItem = await this.prisma.inventoryItem.findFirst({
                where: { tenantId, variantId: variant.id, locationId }
              });
              if (newItem) {
                await this.prisma.inventoryItem.update({
                  where: { id: newItem.id },
                  data: { safetyStock: row.safetyStock }
                });
              }
            }

            result.summary.newItems++;
            result.successful++;
          }

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          result.errors.push({
            row: rowNumber,
            sku: row.sku || 'unknown',
            error: errorMessage
          });
          result.failed++;
        }
      }

      logger.info('CSV inventory import completed', {
        tenantId,
        result,
        userId: context.userId,
        correlationId: context.correlationId
      });

      return result;

    } catch (error) {
      logger.error('CSV inventory import failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        tenantId,
        userId: context.userId,
        correlationId: context.correlationId
      });
      throw error;
    }
  }

  /**
   * Export inventory to CSV format
   */
  async exportInventoryToCSV(
    tenantId: string,
    options: CSVExportOptions = { format: 'standard' }
  ): Promise<string> {
    logger.info('Starting CSV inventory export', { tenantId, options });

    try {
      const where: any = { tenantId };
      if (options.locationId) {
        where.locationId = options.locationId;
      }
      if (!options.includeZeroQuantity) {
        where.onHand = { gt: 0 };
      }

      const inventoryItems = await this.prisma.inventoryItem.findMany({
        where,
        include: {
          variant: {
            include: {
              product: true
            }
          },
          location: true
        },
        orderBy: [
          { location: { name: 'asc' } },
          { variant: { sku: 'asc' } }
        ]
      });

      // Get last movement dates
      const variantIds = inventoryItems.map(item => item.variantId);
      const lastMovements = await this.getLastMovementDates(tenantId, variantIds);

      // Transform data based on format
      const exportData: InventoryExportData[] = inventoryItems.map(item => {
        const baseData: InventoryExportData = {
          sku: item.variant.sku,
          title: item.variant.title,
          locationName: item.location.name,
          onHand: item.onHand,
          reserved: item.reserved,
          available: item.onHand - item.reserved,
          safetyStock: item.safetyStock,
          price: item.variant.price,
          lastCountedAt: item.lastCountedAt?.toISOString() || undefined,
          lastMovementAt: lastMovements.get(item.variantId)?.toISOString() || undefined,
          category: item.variant.product.category || undefined,
          vendor: item.variant.product.vendor || undefined
        };

        return baseData;
      });

      // Generate CSV based on format
      return this.generateCSV(exportData, options.format);

    } catch (error) {
      logger.error('CSV inventory export failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        tenantId,
        options
      });
      throw error;
    }
  }

  /**
   * Perform bulk inventory operations
   */
  async performBulkOperation(
    operation: 'adjust' | 'recount' | 'transfer' | 'safety_stock_update',
    data: any[],
    tenantId: string,
    context: RequestContext
  ): Promise<BulkUpdateResult> {
    logger.info('Starting bulk inventory operation', {
      operation,
      itemCount: data.length,
      tenantId,
      userId: context.userId,
      correlationId: context.correlationId
    });

    const result: BulkUpdateResult = {
      success: 0,
      failed: 0,
      errors: []
    };

    try {
      switch (operation) {
        case 'adjust':
          return await this.performBulkAdjustments(data, context);
        
        case 'recount':
          return await this.performBulkRecounts(data, context);
        
        case 'safety_stock_update':
          return await this.performBulkSafetyStockUpdates(data, tenantId, context);
        
        default:
          throw new Error(`Unsupported bulk operation: ${operation}`);
      }

    } catch (error) {
      logger.error('Bulk inventory operation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        operation,
        tenantId,
        correlationId: context.correlationId
      });
      throw error;
    }
  }

  // =============================================================================
  // PRIVATE HELPER METHODS
  // =============================================================================

  private async parseCSVData(csvData: string): Promise<CSVInventoryRow[]> {
    return new Promise((resolve, reject) => {
      const rows: CSVInventoryRow[] = [];
      const stream = Readable.from([csvData]);

      stream
        .pipe(csv.default({
          mapHeaders: ({ header }: { header: string }) => header.toLowerCase().trim()
        }))
        .on('data', (row: any) => {
          const safetyStock = row.safety_stock ? parseInt(row.safety_stock, 10) : undefined;
          
          rows.push({
            sku: row.sku?.trim() || '',
            locationName: row.location_name?.trim() || row.location?.trim() || '',
            quantity: parseInt(row.quantity || row.on_hand || '0', 10),
            safetyStock: safetyStock || undefined,
            reason: row.reason?.trim() || 'csv_import',
            reference: row.reference?.trim()
          });
        })
        .on('end', () => resolve(rows))
        .on('error', reject);
    });
  }

  private validateCSVRow(row: CSVInventoryRow, rowNumber: number): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!row.sku) {
      errors.push('SKU is required');
    }

    if (!row.locationName) {
      errors.push('Location name is required');
    }

    if (isNaN(row.quantity) || row.quantity < 0) {
      errors.push('Quantity must be a non-negative number');
    }

    if (row.safetyStock !== undefined && (isNaN(row.safetyStock) || row.safetyStock < 0)) {
      errors.push('Safety stock must be a non-negative number');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private generateCSV(data: InventoryExportData[], format: string): string {
    if (data.length === 0) {
      return '';
    }

    let headers: string[];
    let rowMapper: (item: InventoryExportData) => string[];

    switch (format) {
      case 'shopify':
        headers = ['Handle', 'Title', 'Variant SKU', 'Variant Inventory Qty', 'Variant Price'];
        rowMapper = (item) => [
          item.sku.toLowerCase().replace(/[^a-z0-9]/g, '-'),
          item.title,
          item.sku,
          item.onHand.toString(),
          item.price.toString()
        ];
        break;

      case 'tcgplayer':
        headers = ['SKU', 'Quantity', 'Price', 'Condition'];
        rowMapper = (item) => [
          item.sku,
          item.available.toString(),
          item.price.toString(),
          'Near Mint' // Default condition
        ];
        break;

      default: // standard
        headers = [
          'SKU',
          'Title',
          'Location',
          'On Hand',
          'Reserved',
          'Available',
          'Safety Stock',
          'Price',
          'Category',
          'Vendor',
          'Last Counted',
          'Last Movement'
        ];
        rowMapper = (item) => [
          item.sku,
          item.title,
          item.locationName,
          item.onHand.toString(),
          item.reserved.toString(),
          item.available.toString(),
          item.safetyStock.toString(),
          item.price.toString(),
          item.category || '',
          item.vendor || '',
          item.lastCountedAt || '',
          item.lastMovementAt || ''
        ];
    }

    // Generate CSV content
    const csvRows = [headers.join(',')];
    
    for (const item of data) {
      const row = rowMapper(item).map(field => {
        // Escape fields that contain commas or quotes
        if (field.includes(',') || field.includes('"') || field.includes('\n')) {
          return `"${field.replace(/"/g, '""')}"`;
        }
        return field;
      });
      csvRows.push(row.join(','));
    }

    return csvRows.join('\n');
  }

  private async getLastMovementDates(
    tenantId: string,
    variantIds: string[]
  ): Promise<Map<string, Date>> {
    const movements = await this.prisma.stockMovement.findMany({
      where: {
        tenantId,
        variantId: { in: variantIds }
      },
      select: {
        variantId: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const lastMovements = new Map<string, Date>();
    for (const movement of movements) {
      if (!lastMovements.has(movement.variantId)) {
        lastMovements.set(movement.variantId, movement.createdAt);
      }
    }

    return lastMovements;
  }

  private async performBulkAdjustments(
    adjustments: InventoryUpdate[],
    context: RequestContext
  ): Promise<BulkUpdateResult> {
    return await this.inventoryService.bulkUpdateInventory(adjustments, context);
  }

  private async performBulkRecounts(
    recounts: Array<{ variantId: string; locationId: string; newQuantity: number }>,
    context: RequestContext
  ): Promise<BulkUpdateResult> {
    const result: BulkUpdateResult = {
      success: 0,
      failed: 0,
      errors: []
    };

    for (const recount of recounts) {
      try {
        await this.inventoryService.setInventoryLevel(
          recount.variantId,
          recount.locationId,
          recount.newQuantity,
          context,
          'physical_count'
        );

        // Update last counted date
        await this.prisma.inventoryItem.updateMany({
          where: {
            tenantId: context.tenantId,
            variantId: recount.variantId,
            locationId: recount.locationId
          },
          data: {
            lastCountedAt: new Date()
          }
        });

        result.success++;
      } catch (error) {
        result.failed++;
        result.errors.push({
          row: result.success + result.failed,
          message: error instanceof Error ? error.message : 'Unknown error',
          data: recount
        });
      }
    }

    return result;
  }

  private async performBulkSafetyStockUpdates(
    updates: Array<{ variantId: string; locationId: string; safetyStock: number }>,
    tenantId: string,
    context: RequestContext
  ): Promise<BulkUpdateResult> {
    const result: BulkUpdateResult = {
      success: 0,
      failed: 0,
      errors: []
    };

    for (const update of updates) {
      try {
        await this.prisma.inventoryItem.updateMany({
          where: {
            tenantId,
            variantId: update.variantId,
            locationId: update.locationId
          },
          data: {
            safetyStock: update.safetyStock,
            updatedAt: new Date()
          }
        });

        result.success++;
      } catch (error) {
        result.failed++;
        result.errors.push({
          row: result.success + result.failed,
          message: error instanceof Error ? error.message : 'Unknown error',
          data: update
        });
      }
    }

    return result;
  }
}