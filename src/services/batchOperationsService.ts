/**
 * Batch Operations Service - Phase 5
 * Advanced bulk processing and batch operations for enterprise scalability
 */

import { PrismaClient } from '@prisma/client';
import { RequestContext } from '../types';

interface BatchOperation {
  id: string;
  type: 'inventory_update' | 'price_update' | 'product_import' | 'order_fulfillment' | 'bulk_export';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  totalItems: number;
  processedItems: number;
  failedItems: number;
  startedAt?: Date;
  completedAt?: Date;
  errorLog: string[];
  metadata: any;
  createdBy: string;
  tenantId: string;
}

interface BatchInventoryUpdate {
  variantId: string;
  locationId: string;
  quantity: number;
  operation: 'set' | 'add' | 'subtract';
  reason?: string;
}

interface BatchPriceUpdate {
  variantId: string;
  price: number;
  compareAtPrice?: number;
  effectiveDate?: Date;
}

interface BatchProductImport {
  title: string;
  description?: string;
  vendor?: string;
  category?: string;
  variants: {
    sku: string;
    title: string;
    price: number;
    barcode?: string;
    weight?: number;
    tcgAttributes?: any;
  }[];
}

interface BatchOrderFulfillment {
  orderIds: string[];
  carrier: string;
  service: string;
  trackingNumbers?: string[];
  notifyCustomers: boolean;
}

interface BatchExportRequest {
  type: 'products' | 'inventory' | 'orders' | 'customers';
  format: 'csv' | 'xlsx' | 'json';
  filters?: any;
  includeFields?: string[];
}

interface BatchProgress {
  operationId: string;
  status: string;
  progress: number;
  currentItem: number;
  totalItems: number;
  estimatedTimeRemaining: number;
  errors: string[];
  lastUpdate: Date;
}

export class BatchOperationsService {
  private operations: Map<string, BatchOperation> = new Map();
  private progressCallbacks: Map<string, Function[]> = new Map();

  constructor(private prisma: PrismaClient) {}

  async createBatchInventoryUpdate(
    updates: BatchInventoryUpdate[],
    context: RequestContext
  ): Promise<string> {
    const operationId = this.generateOperationId();
    
    const operation: BatchOperation = {
      id: operationId,
      type: 'inventory_update',
      status: 'pending',
      totalItems: updates.length,
      processedItems: 0,
      failedItems: 0,
      errorLog: [],
      metadata: { updates },
      createdBy: context.userId,
      tenantId: context.tenantId
    };

    this.operations.set(operationId, operation);
    
    // Start processing in background
    this.processBatchInventoryUpdate(operationId, updates, context);
    
    return operationId;
  }

  async createBatchPriceUpdate(
    updates: BatchPriceUpdate[],
    context: RequestContext
  ): Promise<string> {
    const operationId = this.generateOperationId();
    
    const operation: BatchOperation = {
      id: operationId,
      type: 'price_update',
      status: 'pending',
      totalItems: updates.length,
      processedItems: 0,
      failedItems: 0,
      errorLog: [],
      metadata: { updates },
      createdBy: context.userId,
      tenantId: context.tenantId
    };

    this.operations.set(operationId, operation);
    
    // Start processing in background
    this.processBatchPriceUpdate(operationId, updates, context);
    
    return operationId;
  }

  async createBatchProductImport(
    products: BatchProductImport[],
    context: RequestContext
  ): Promise<string> {
    const operationId = this.generateOperationId();
    
    const operation: BatchOperation = {
      id: operationId,
      type: 'product_import',
      status: 'pending',
      totalItems: products.length,
      processedItems: 0,
      failedItems: 0,
      errorLog: [],
      metadata: { products },
      createdBy: context.userId,
      tenantId: context.tenantId
    };

    this.operations.set(operationId, operation);
    
    // Start processing in background
    this.processBatchProductImport(operationId, products, context);
    
    return operationId;
  }

  async createBatchOrderFulfillment(
    fulfillment: BatchOrderFulfillment,
    context: RequestContext
  ): Promise<string> {
    const operationId = this.generateOperationId();
    
    const operation: BatchOperation = {
      id: operationId,
      type: 'order_fulfillment',
      status: 'pending',
      totalItems: fulfillment.orderIds.length,
      processedItems: 0,
      failedItems: 0,
      errorLog: [],
      metadata: { fulfillment },
      createdBy: context.userId,
      tenantId: context.tenantId
    };

    this.operations.set(operationId, operation);
    
    // Start processing in background
    this.processBatchOrderFulfillment(operationId, fulfillment, context);
    
    return operationId;
  }

  async createBatchExport(
    exportRequest: BatchExportRequest,
    context: RequestContext
  ): Promise<string> {
    const operationId = this.generateOperationId();
    
    // Estimate total items
    const totalItems = await this.estimateExportSize(exportRequest, context);
    
    const operation: BatchOperation = {
      id: operationId,
      type: 'bulk_export',
      status: 'pending',
      totalItems,
      processedItems: 0,
      failedItems: 0,
      errorLog: [],
      metadata: { exportRequest },
      createdBy: context.userId,
      tenantId: context.tenantId
    };

    this.operations.set(operationId, operation);
    
    // Start processing in background
    this.processBatchExport(operationId, exportRequest, context);
    
    return operationId;
  }

  async getBatchProgress(operationId: string): Promise<BatchProgress | null> {
    const operation = this.operations.get(operationId);
    if (!operation) return null;

    const progress = operation.totalItems > 0 ? 
      (operation.processedItems / operation.totalItems) * 100 : 0;

    const estimatedTimeRemaining = this.calculateEstimatedTime(operation);

    return {
      operationId,
      status: operation.status,
      progress,
      currentItem: operation.processedItems,
      totalItems: operation.totalItems,
      estimatedTimeRemaining,
      errors: operation.errorLog.slice(-10), // Last 10 errors
      lastUpdate: new Date()
    };
  }

  async cancelBatchOperation(operationId: string): Promise<boolean> {
    const operation = this.operations.get(operationId);
    if (!operation || operation.status === 'completed') {
      return false;
    }

    operation.status = 'cancelled';
    operation.completedAt = new Date();
    
    return true;
  }

  async getBatchOperations(
    tenantId: string,
    limit: number = 50
  ): Promise<BatchOperation[]> {
    return Array.from(this.operations.values())
      .filter(op => op.tenantId === tenantId)
      .sort((a, b) => (b.startedAt?.getTime() || 0) - (a.startedAt?.getTime() || 0))
      .slice(0, limit);
  }

  private async processBatchInventoryUpdate(
    operationId: string,
    updates: BatchInventoryUpdate[],
    context: RequestContext
  ): Promise<void> {
    const operation = this.operations.get(operationId)!;
    operation.status = 'processing';
    operation.startedAt = new Date();

    try {
      for (let i = 0; i < updates.length; i++) {
        if (operation.status === 'cancelled') break;

        const update = updates[i];
        
        try {
          await this.processInventoryUpdate(update, context);
          operation.processedItems++;
        } catch (error) {
          operation.failedItems++;
          operation.errorLog.push(`Item ${i + 1}: ${error.message}`);
        }

        // Update progress
        this.notifyProgress(operationId);
        
        // Small delay to prevent overwhelming the database
        if (i % 100 === 0) {
          await this.sleep(100);
        }
      }

      operation.status = operation.failedItems === 0 ? 'completed' : 'completed';
      operation.completedAt = new Date();
      
    } catch (error) {
      operation.status = 'failed';
      operation.errorLog.push(`Operation failed: ${error.message}`);
      operation.completedAt = new Date();
    }
  }

  private async processInventoryUpdate(
    update: BatchInventoryUpdate,
    context: RequestContext
  ): Promise<void> {
    const inventoryItem = await this.prisma.inventoryItem.findFirst({
      where: {
        tenantId: context.tenantId,
        variantId: update.variantId,
        locationId: update.locationId
      }
    });

    if (!inventoryItem) {
      throw new Error(`Inventory item not found for variant ${update.variantId} at location ${update.locationId}`);
    }

    let newQuantity: number;
    
    switch (update.operation) {
      case 'set':
        newQuantity = update.quantity;
        break;
      case 'add':
        newQuantity = inventoryItem.onHand + update.quantity;
        break;
      case 'subtract':
        newQuantity = Math.max(0, inventoryItem.onHand - update.quantity);
        break;
      default:
        throw new Error(`Invalid operation: ${update.operation}`);
    }

    // Update inventory
    await this.prisma.inventoryItem.update({
      where: { id: inventoryItem.id },
      data: { onHand: newQuantity }
    });

    // Create stock movement record
    await this.prisma.stockMovement.create({
      data: {
        tenantId: context.tenantId,
        variantId: update.variantId,
        locationId: update.locationId,
        type: update.quantity > 0 ? 'in' : 'out',
        quantity: Math.abs(update.quantity),
        reason: update.reason || 'batch_update',
        reference: `Batch operation`,
        createdBy: context.userId
      }
    });
  }

  private async processBatchPriceUpdate(
    operationId: string,
    updates: BatchPriceUpdate[],
    context: RequestContext
  ): Promise<void> {
    const operation = this.operations.get(operationId)!;
    operation.status = 'processing';
    operation.startedAt = new Date();

    try {
      for (let i = 0; i < updates.length; i++) {
        if (operation.status === 'cancelled') break;

        const update = updates[i];
        
        try {
          await this.prisma.productVariant.update({
            where: {
              id: update.variantId,
              product: { tenantId: context.tenantId }
            },
            data: {
              price: update.price,
              ...(update.compareAtPrice && { compareAtPrice: update.compareAtPrice })
            }
          });
          
          operation.processedItems++;
        } catch (error) {
          operation.failedItems++;
          operation.errorLog.push(`Variant ${update.variantId}: ${error.message}`);
        }

        this.notifyProgress(operationId);
        
        if (i % 100 === 0) {
          await this.sleep(100);
        }
      }

      operation.status = operation.failedItems === 0 ? 'completed' : 'completed';
      operation.completedAt = new Date();
      
    } catch (error) {
      operation.status = 'failed';
      operation.errorLog.push(`Operation failed: ${error.message}`);
      operation.completedAt = new Date();
    }
  }

  private async processBatchProductImport(
    operationId: string,
    products: BatchProductImport[],
    context: RequestContext
  ): Promise<void> {
    const operation = this.operations.get(operationId)!;
    operation.status = 'processing';
    operation.startedAt = new Date();

    try {
      for (let i = 0; i < products.length; i++) {
        if (operation.status === 'cancelled') break;

        const productData = products[i];
        
        try {
          await this.prisma.$transaction(async (tx) => {
            // Create product
            const product = await tx.product.create({
              data: {
                tenantId: context.tenantId,
                title: productData.title,
                description: productData.description,
                vendor: productData.vendor,
                category: productData.category,
                status: 'active'
              }
            });

            // Create variants
            for (const variantData of productData.variants) {
              await tx.productVariant.create({
                data: {
                  tenantId: context.tenantId,
                  productId: product.id,
                  title: variantData.title,
                  sku: variantData.sku,
                  price: variantData.price,
                  barcode: variantData.barcode,
                  weight: variantData.weight,
                  tcgAttributes: JSON.stringify(variantData.tcgAttributes || {})
                }
              });
            }
          });
          
          operation.processedItems++;
        } catch (error) {
          operation.failedItems++;
          operation.errorLog.push(`Product ${i + 1}: ${error.message}`);
        }

        this.notifyProgress(operationId);
        
        if (i % 50 === 0) {
          await this.sleep(200);
        }
      }

      operation.status = operation.failedItems === 0 ? 'completed' : 'completed';
      operation.completedAt = new Date();
      
    } catch (error) {
      operation.status = 'failed';
      operation.errorLog.push(`Operation failed: ${error.message}`);
      operation.completedAt = new Date();
    }
  }

  private async processBatchOrderFulfillment(
    operationId: string,
    fulfillment: BatchOrderFulfillment,
    context: RequestContext
  ): Promise<void> {
    const operation = this.operations.get(operationId)!;
    operation.status = 'processing';
    operation.startedAt = new Date();

    try {
      for (let i = 0; i < fulfillment.orderIds.length; i++) {
        if (operation.status === 'cancelled') break;

        const orderId = fulfillment.orderIds[i];
        const trackingNumber = fulfillment.trackingNumbers?.[i];
        
        try {
          await this.prisma.order.update({
            where: {
              id: orderId,
              tenantId: context.tenantId
            },
            data: {
              fulfillmentStatus: 'fulfilled',
              trackingNumber,
              trackingCompany: fulfillment.carrier
            }
          });
          
          // TODO: Send notification to customer if requested
          if (fulfillment.notifyCustomers) {
            // Implement customer notification
          }
          
          operation.processedItems++;
        } catch (error) {
          operation.failedItems++;
          operation.errorLog.push(`Order ${orderId}: ${error.message}`);
        }

        this.notifyProgress(operationId);
        
        if (i % 20 === 0) {
          await this.sleep(100);
        }
      }

      operation.status = operation.failedItems === 0 ? 'completed' : 'completed';
      operation.completedAt = new Date();
      
    } catch (error) {
      operation.status = 'failed';
      operation.errorLog.push(`Operation failed: ${error.message}`);
      operation.completedAt = new Date();
    }
  }

  private async processBatchExport(
    operationId: string,
    exportRequest: BatchExportRequest,
    context: RequestContext
  ): Promise<void> {
    const operation = this.operations.get(operationId)!;
    operation.status = 'processing';
    operation.startedAt = new Date();

    try {
      let data: any[] = [];
      
      switch (exportRequest.type) {
        case 'products':
          data = await this.exportProducts(exportRequest, context);
          break;
        case 'inventory':
          data = await this.exportInventory(exportRequest, context);
          break;
        case 'orders':
          data = await this.exportOrders(exportRequest, context);
          break;
        case 'customers':
          data = await this.exportCustomers(exportRequest, context);
          break;
      }

      // Generate export file
      const exportData = this.formatExportData(data, exportRequest.format);
      
      // Store export result (in production, save to file storage)
      operation.metadata.exportData = exportData;
      operation.metadata.exportSize = data.length;
      
      operation.processedItems = data.length;
      operation.status = 'completed';
      operation.completedAt = new Date();
      
    } catch (error) {
      operation.status = 'failed';
      operation.errorLog.push(`Export failed: ${error.message}`);
      operation.completedAt = new Date();
    }
  }

  private async exportProducts(
    exportRequest: BatchExportRequest,
    context: RequestContext
  ): Promise<any[]> {
    return await this.prisma.product.findMany({
      where: {
        tenantId: context.tenantId,
        ...exportRequest.filters
      },
      include: {
        variants: {
          include: {
            inventoryItems: true
          }
        }
      }
    });
  }

  private async exportInventory(
    exportRequest: BatchExportRequest,
    context: RequestContext
  ): Promise<any[]> {
    return await this.prisma.inventoryItem.findMany({
      where: {
        tenantId: context.tenantId,
        ...exportRequest.filters
      },
      include: {
        variant: {
          include: {
            product: true
          }
        },
        location: true
      }
    });
  }

  private async exportOrders(
    exportRequest: BatchExportRequest,
    context: RequestContext
  ): Promise<any[]> {
    return await this.prisma.order.findMany({
      where: {
        tenantId: context.tenantId,
        ...exportRequest.filters
      },
      include: {
        lineItems: {
          include: {
            variant: {
              include: {
                product: true
              }
            }
          }
        }
      }
    });
  }

  private async exportCustomers(
    exportRequest: BatchExportRequest,
    context: RequestContext
  ): Promise<any[]> {
    // Get unique customers from orders
    const customerOrders = await this.prisma.order.groupBy({
      by: ['customerId'],
      where: {
        tenantId: context.tenantId,
        ...exportRequest.filters
      },
      _sum: {
        totalPrice: true
      },
      _count: {
        id: true
      }
    });

    return customerOrders.map(customer => ({
      customerId: customer.customerId,
      totalOrders: customer._count.id,
      totalSpent: customer._sum.totalPrice || 0
    }));
  }

  private formatExportData(data: any[], format: string): string {
    switch (format) {
      case 'csv':
        return this.convertToCSV(data);
      case 'json':
        return JSON.stringify(data, null, 2);
      case 'xlsx':
        // In production, use a library like xlsx to generate Excel files
        return this.convertToCSV(data); // Fallback to CSV
      default:
        return JSON.stringify(data);
    }
  }

  private convertToCSV(data: any[]): string {
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          const value = row[header];
          return typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value;
        }).join(',')
      )
    ];

    return csvRows.join('\n');
  }

  private async estimateExportSize(
    exportRequest: BatchExportRequest,
    context: RequestContext
  ): Promise<number> {
    switch (exportRequest.type) {
      case 'products':
        return await this.prisma.product.count({
          where: { tenantId: context.tenantId, ...exportRequest.filters }
        });
      case 'inventory':
        return await this.prisma.inventoryItem.count({
          where: { tenantId: context.tenantId, ...exportRequest.filters }
        });
      case 'orders':
        return await this.prisma.order.count({
          where: { tenantId: context.tenantId, ...exportRequest.filters }
        });
      case 'customers':
        return await this.prisma.order.groupBy({
          by: ['customerId'],
          where: { tenantId: context.tenantId, ...exportRequest.filters }
        }).then(result => result.length);
      default:
        return 0;
    }
  }

  private calculateEstimatedTime(operation: BatchOperation): number {
    if (operation.processedItems === 0) return 0;
    
    const elapsed = Date.now() - (operation.startedAt?.getTime() || Date.now());
    const rate = operation.processedItems / elapsed;
    const remaining = operation.totalItems - operation.processedItems;
    
    return remaining / rate;
  }

  private notifyProgress(operationId: string): void {
    const callbacks = this.progressCallbacks.get(operationId) || [];
    const progress = this.getBatchProgress(operationId);
    
    callbacks.forEach(callback => {
      try {
        callback(progress);
      } catch (error) {
        console.error('Progress callback error:', error);
      }
    });
  }

  private generateOperationId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  onProgress(operationId: string, callback: Function): void {
    if (!this.progressCallbacks.has(operationId)) {
      this.progressCallbacks.set(operationId, []);
    }
    this.progressCallbacks.get(operationId)!.push(callback);
  }

  removeProgressCallback(operationId: string, callback: Function): void {
    const callbacks = this.progressCallbacks.get(operationId);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }
}