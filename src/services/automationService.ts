import { EventEmitter } from 'events';
import { OrderService } from './orderService';
import { InventoryService } from './inventoryService';
import { BinderPOSService } from './binderPOSService';
import { websocketService, AutomationEvent } from './websocketService';
import { logger } from '../utils/logger';
// import { prisma } from '../config/database';

export interface OrderProcessingState {
  orderId: string;
  stage: 'received' | 'validated' | 'synced' | 'printed' | 'complete' | 'failed';
  startTime: Date;
  lastUpdate?: Date;
  attempts: number;
  errors: Array<{
    message: string;
    timestamp: Date;
    stage: string;
  }>;
  tenantId: string;
}

export interface AutomationConfig {
  enabled: boolean;
  maxRetries: number;
  retryDelay: number;
  batchSize: number;
  tenantId: string;
}

export interface AutomationMetrics {
  ordersProcessed: number;
  averageProcessingTime: number;
  successRate: number;
  errorRate: number;
  timeRange: string;
  generatedAt: Date;
}

export class AutomationService extends EventEmitter {
  private isEnabled: boolean = false;
  private processingOrders: Map<string, OrderProcessingState> = new Map();
  private orderService: OrderService | null = null;
  private inventoryService: InventoryService | null = null;
  private binderPOSService: BinderPOSService;
  private config: AutomationConfig;

  constructor() {
    super();
    // TODO: Initialize services when database is ready
    // this.orderService = new OrderService(prisma, new InventoryService(prisma));
    // this.inventoryService = new InventoryService(prisma);
    this.binderPOSService = new BinderPOSService();
    
    this.config = {
      enabled: process.env['AUTOMATION_ENABLED'] === 'true',
      maxRetries: parseInt(process.env['AUTOMATION_MAX_RETRIES'] || '3'),
      retryDelay: parseInt(process.env['AUTOMATION_RETRY_DELAY'] || '5000'),
      batchSize: parseInt(process.env['AUTOMATION_BATCH_SIZE'] || '10'),
      tenantId: 'default'
    };

    this.isEnabled = this.config.enabled;
    this.setupEventHandlers();

    logger.info('AutomationService initialized', {
      enabled: this.isEnabled,
      maxRetries: this.config.maxRetries,
      retryDelay: this.config.retryDelay
    });
  }

  async startAutomation(tenantId: string = 'default'): Promise<void> {
    this.isEnabled = true;
    this.config.tenantId = tenantId;
    
    logger.info('Automation started', { tenantId });
    
    // Record automation start in database
    await this.recordAutomationEvent('started', tenantId);
    
    this.emit('automation.started', { tenantId, timestamp: new Date() });
  }

  async stopAutomation(tenantId: string = 'default'): Promise<void> {
    this.isEnabled = false;
    
    logger.info('Automation stopped', { tenantId });
    
    // Record automation stop in database
    await this.recordAutomationEvent('stopped', tenantId);
    
    this.emit('automation.stopped', { tenantId, timestamp: new Date() });
  }

  async processShopifyOrder(orderData: any, tenantId: string = 'default'): Promise<void> {
    if (!this.isEnabled) {
      logger.debug('Automation disabled, skipping order processing', {
        orderId: orderData.id,
        tenantId
      });
      return;
    }

    const orderId = orderData.id.toString();
    const processingState: OrderProcessingState = {
      orderId,
      stage: 'received',
      startTime: new Date(),
      attempts: 0,
      errors: [],
      tenantId
    };

    this.processingOrders.set(orderId, processingState);
    
    logger.info('Starting order processing', {
      orderId,
      orderNumber: orderData.order_number,
      tenantId,
      lineItemCount: orderData.line_items?.length || 0
    });

    // Record automation job start
    await this.createAutomationJob(orderId, tenantId);

    this.broadcastOrderUpdate(orderId, 'received', orderData, tenantId);
    this.emitWebSocketEvent('order_received', orderId, { orderData });

    try {
      // Stage 1: Validate Inventory
      await this.validateInventory(orderId, orderData, tenantId);
      this.updateOrderStage(orderId, 'validated', tenantId);
      this.emitWebSocketEvent('order_validated', orderId, { stage: 'validated' });

      // Stage 2: Update BinderPOS Inventory
      await this.updateBinderPOSInventory(orderId, orderData, tenantId);
      this.updateOrderStage(orderId, 'synced', tenantId);
      this.emitWebSocketEvent('inventory_synced', orderId, { stage: 'synced' });

      // Stage 3: Print Receipt
      await this.printReceipt(orderId, orderData, tenantId);
      this.updateOrderStage(orderId, 'printed', tenantId);
      this.emitWebSocketEvent('receipt_printed', orderId, { stage: 'printed' });

      // Stage 4: Mark Complete
      this.updateOrderStage(orderId, 'complete', tenantId);
      await this.completeAutomationJob(orderId, 'completed');
      this.emitWebSocketEvent('order_complete', orderId, { stage: 'complete' });
      this.processingOrders.delete(orderId);

      logger.info('Order processing completed successfully', {
        orderId,
        tenantId,
        processingTime: Date.now() - processingState.startTime.getTime()
      });

    } catch (error: any) {
      this.emitWebSocketEvent('error', orderId, { error: error.message });
      await this.handleProcessingError(orderId, error, tenantId);
    }
  }

  private async validateInventory(orderId: string, orderData: any, tenantId: string): Promise<void> {
    logger.debug('Validating inventory for order', { orderId, tenantId });

    // Mock inventory validation for now
    const inventoryChecks = orderData.line_items.map((item: any) => ({
      variantId: item.variant_id,
      sku: item.sku,
      requested: item.quantity,
      available: item.quantity + 5, // Mock sufficient inventory
      sufficient: true
    }));

    const insufficientItems = inventoryChecks.filter((check: any) => !check.sufficient);
    if (insufficientItems.length > 0) {
      const errorMessage = `Insufficient inventory for items: ${insufficientItems.map((i: any) => `${i.sku} (need ${i.requested}, have ${i.available})`).join(', ')}`;
      throw new Error(errorMessage);
    }

    logger.info('Inventory validation passed', {
      orderId,
      tenantId,
      itemsChecked: inventoryChecks.length
    });

    this.broadcastOrderUpdate(orderId, 'validated', { inventoryChecks }, tenantId);
  }

  private async updateBinderPOSInventory(orderId: string, orderData: any, tenantId: string): Promise<void> {
    logger.debug('Updating BinderPOS inventory', { orderId, tenantId });

    const inventoryUpdates = orderData.line_items.map((item: any) => ({
      sku: item.sku,
      operation: 'decrement' as const,
      quantity: item.quantity,
      reason: 'sale',
      reference: `shopify_order_${orderId}`
    }));

    const syncResult = await this.binderPOSService.syncInventory(inventoryUpdates);

    logger.info('BinderPOS inventory updated', {
      orderId,
      tenantId,
      syncedItems: syncResult.syncedItems,
      conflicts: syncResult.conflicts.length
    });

    this.broadcastOrderUpdate(orderId, 'synced', { syncResult }, tenantId);
  }

  private async printReceipt(orderId: string, orderData: any, tenantId: string): Promise<void> {
    logger.debug('Printing receipt', { orderId, tenantId });

    const receiptData = {
      orderId,
      orderNumber: orderData.order_number,
      timestamp: new Date(),
      items: orderData.line_items.map((item: any) => ({
        sku: item.sku,
        title: item.title,
        quantity: item.quantity,
        location: item.properties?.find((p: any) => p.name === 'location')?.value || 'General'
      })),
      totalItems: orderData.line_items.reduce((sum: number, item: any) => sum + item.quantity, 0),
      pickingInstructions: this.generatePickingInstructions(orderData)
    };

    const printJob = await this.binderPOSService.printReceipt(orderId, receiptData);

    // Record print job in database
    await this.recordPrintJob(orderId, printJob.id, tenantId);

    logger.info('Receipt printed successfully', {
      orderId,
      tenantId,
      printJobId: printJob.id
    });

    this.broadcastOrderUpdate(orderId, 'printed', { printJobId: printJob.id }, tenantId);
  }

  private generatePickingInstructions(orderData: any): string[] {
    const instructions = ['PICKING INSTRUCTIONS:', ''];
    
    orderData.line_items.forEach((item: any, index: number) => {
      instructions.push(`${index + 1}. ${item.title}`);
      instructions.push(`   SKU: ${item.sku}`);
      instructions.push(`   Quantity: ${item.quantity}`);
      instructions.push(`   Location: ${item.properties?.find((p: any) => p.name === 'location')?.value || 'General'}`);
      instructions.push('');
    });

    instructions.push('SPECIAL INSTRUCTIONS:');
    if (orderData.shipping_address?.company) {
      instructions.push(`- Business delivery to: ${orderData.shipping_address.company}`);
    }
    if (orderData.note) {
      instructions.push(`- Customer note: ${orderData.note}`);
    }
    if (orderData.tags && orderData.tags.length > 0) {
      instructions.push(`- Order tags: ${orderData.tags.join(', ')}`);
    }

    instructions.push('');
    instructions.push(`Order #: ${orderData.order_number}`);
    instructions.push(`Customer: ${orderData.customer?.first_name} ${orderData.customer?.last_name}`);
    instructions.push(`Email: ${orderData.customer?.email}`);

    return instructions;
  }

  private updateOrderStage(orderId: string, stage: OrderProcessingState['stage'], tenantId: string): void {
    const processingState = this.processingOrders.get(orderId);
    if (processingState) {
      processingState.stage = stage;
      processingState.lastUpdate = new Date();
      
      // Update database
      this.updateAutomationJob(orderId, stage).catch(error => {
        logger.error('Failed to update automation job', { orderId, stage, error: error.message });
      });
    }
    
    this.broadcastOrderUpdate(orderId, stage, {}, tenantId);
  }

  private broadcastOrderUpdate(orderId: string, stage: string, data: any, tenantId: string): void {
    const updateData = {
      orderId,
      stage,
      timestamp: new Date(),
      data,
      tenantId
    };

    this.emit('order.stage.updated', updateData);
    
    logger.debug('Order stage updated', {
      orderId,
      stage,
      tenantId
    });
  }

  private async handleProcessingError(orderId: string, error: Error, tenantId: string): Promise<void> {
    const processingState = this.processingOrders.get(orderId);
    if (!processingState) return;

    processingState.attempts++;
    processingState.errors.push({
      message: error.message,
      timestamp: new Date(),
      stage: processingState.stage
    });

    logger.error('Order processing error', {
      orderId,
      tenantId,
      stage: processingState.stage,
      attempt: processingState.attempts,
      error: error.message
    });

    // Update database with error
    await this.updateAutomationJob(orderId, 'failed', error.message);

    if (processingState.attempts < this.config.maxRetries) {
      // Schedule retry
      const retryDelay = this.config.retryDelay * processingState.attempts;
      
      logger.info('Scheduling order retry', {
        orderId,
        tenantId,
        attempt: processingState.attempts,
        retryDelay
      });

      setTimeout(() => {
        this.retryOrder(orderId, tenantId).catch(retryError => {
          logger.error('Failed to retry order', {
            orderId,
            tenantId,
            error: retryError.message
          });
        });
      }, retryDelay);
    } else {
      // Mark as failed, require manual intervention
      processingState.stage = 'failed';
      
      logger.error('Order processing failed after max retries', {
        orderId,
        tenantId,
        attempts: processingState.attempts,
        maxRetries: this.config.maxRetries
      });

      this.broadcastOrderUpdate(orderId, 'failed', {
        error: error.message,
        attempts: processingState.attempts,
        requiresManualIntervention: true
      }, tenantId);
    }
  }

  async retryOrder(orderId: string, tenantId: string = 'default'): Promise<void> {
    const processingState = this.processingOrders.get(orderId);
    if (!processingState) {
      throw new Error(`Order ${orderId} not found in processing queue`);
    }

    logger.info('Retrying order processing', {
      orderId,
      tenantId,
      currentStage: processingState.stage,
      attempt: processingState.attempts
    });

    try {
      // Get original order data
      const orderData = await this.getOrderData(orderId, tenantId);
      
      // Resume from current stage
      switch (processingState.stage) {
        case 'received':
          await this.validateInventory(orderId, orderData, tenantId);
          this.updateOrderStage(orderId, 'validated', tenantId);
          // Fall through to next stage
        case 'validated':
          await this.updateBinderPOSInventory(orderId, orderData, tenantId);
          this.updateOrderStage(orderId, 'synced', tenantId);
          // Fall through to next stage
        case 'synced':
          await this.printReceipt(orderId, orderData, tenantId);
          this.updateOrderStage(orderId, 'printed', tenantId);
          // Fall through to completion
        case 'printed':
          this.updateOrderStage(orderId, 'complete', tenantId);
          await this.completeAutomationJob(orderId, 'completed');
          this.processingOrders.delete(orderId);
          break;
      }

      logger.info('Order retry completed successfully', { orderId, tenantId });
    } catch (error: any) {
      await this.handleProcessingError(orderId, error, tenantId);
    }
  }

  getAutomationStatus(tenantId: string = 'default'): any {
    const tenantOrders = Array.from(this.processingOrders.values())
      .filter(order => order.tenantId === tenantId);

    return {
      enabled: this.isEnabled,
      activeOrders: tenantOrders.length,
      processingOrders: tenantOrders,
      config: this.config,
      lastUpdate: new Date()
    };
  }

  getOrderPipeline(tenantId: string = 'default'): any {
    const pipeline: Record<string, any[]> = {
      received: [],
      validated: [],
      synced: [],
      printed: [],
      complete: [],
      failed: []
    };

    this.processingOrders.forEach((state, orderId) => {
      if (state.tenantId === tenantId && pipeline[state.stage]) {
        pipeline[state.stage]?.push({
          orderId,
          startTime: state.startTime,
          lastUpdate: state.lastUpdate,
          attempts: state.attempts,
          errors: state.errors
        });
      }
    });

    return pipeline;
  }

  async getPerformanceAnalytics(timeRange: string = '24h', tenantId: string = 'default'): Promise<AutomationMetrics> {
    // TODO: Implement database queries for real analytics
    // For now, return placeholder data
    return {
      ordersProcessed: 0,
      averageProcessingTime: 0,
      successRate: 100,
      errorRate: 0,
      timeRange,
      generatedAt: new Date()
    };
  }

  async getErrorAnalytics(timeRange: string = '24h', tenantId: string = 'default'): Promise<any> {
    // TODO: Implement database queries for error analytics
    return {
      totalErrors: 0,
      errorsByStage: {},
      commonErrors: [],
      timeRange,
      generatedAt: new Date()
    };
  }

  private async getOrderData(orderId: string, tenantId: string): Promise<any> {
    // TODO: Implement order data retrieval
    // This would typically fetch from your order service or database
    return {
      id: orderId,
      order_number: `ORD-${orderId.slice(-6)}`,
      line_items: [],
      customer: {},
      shipping_address: {},
      note: ''
    };
  }

  private async createAutomationJob(orderId: string, tenantId: string): Promise<void> {
    try {
      // TODO: Implement when database schema is updated
      // await prisma.automationJob.create({
      //   data: {
      //     orderId,
      //     tenantId,
      //     stage: 'received',
      //     status: 'processing',
      //     attempts: 0
      //   }
      // });
      logger.debug('Automation job created (placeholder)', { orderId, tenantId });
    } catch (error: any) {
      logger.error('Failed to create automation job', {
        orderId,
        tenantId,
        error: error.message
      });
    }
  }

  private async updateAutomationJob(orderId: string, stage: string, errorMessage?: string): Promise<void> {
    try {
      // TODO: Implement when database schema is updated
      // await prisma.automationJob.updateMany({
      //   where: { orderId },
      //   data: {
      //     stage,
      //     status: stage === 'failed' ? 'failed' : 'processing',
      //     errorMessage,
      //     updatedAt: new Date()
      //   }
      // });
      logger.debug('Automation job updated (placeholder)', { orderId, stage, errorMessage });
    } catch (error: any) {
      logger.error('Failed to update automation job', {
        orderId,
        stage,
        error: error.message
      });
    }
  }

  private async completeAutomationJob(orderId: string, status: string): Promise<void> {
    try {
      // TODO: Implement when database schema is updated
      // await prisma.automationJob.updateMany({
      //   where: { orderId },
      //   data: {
      //     stage: 'complete',
      //     status,
      //     completedAt: new Date(),
      //     updatedAt: new Date()
      //   }
      // });
      logger.debug('Automation job completed (placeholder)', { orderId, status });
    } catch (error: any) {
      logger.error('Failed to complete automation job', {
        orderId,
        status,
        error: error.message
      });
    }
  }

  private async recordAutomationEvent(event: string, tenantId: string): Promise<void> {
    try {
      // TODO: Implement automation event logging
      logger.info('Automation event recorded', { event, tenantId });
    } catch (error: any) {
      logger.error('Failed to record automation event', {
        event,
        tenantId,
        error: error.message
      });
    }
  }

  private async recordPrintJob(orderId: string, printJobId: string, tenantId: string): Promise<void> {
    try {
      // TODO: Implement when database schema is updated
      // await prisma.binderposPrintJob.create({
      //   data: {
      //     orderId,
      //     printJobId,
      //     tenantId,
      //     status: 'submitted'
      //   }
      // });
      logger.debug('Print job recorded (placeholder)', { orderId, printJobId, tenantId });
    } catch (error: any) {
      logger.error('Failed to record print job', {
        orderId,
        printJobId,
        tenantId,
        error: error.message
      });
    }
  }

  private setupEventHandlers(): void {
    // Listen for Shopify webhook events
    this.on('shopify.order.created', (data) => {
      this.processShopifyOrder(data.order, data.tenantId).catch(error => {
        logger.error('Failed to process Shopify order created event', {
          orderId: data.order?.id,
          tenantId: data.tenantId,
          error: error.message
        });
      });
    });

    this.on('shopify.order.paid', (data) => {
      this.processShopifyOrder(data.order, data.tenantId).catch(error => {
        logger.error('Failed to process Shopify order paid event', {
          orderId: data.order?.id,
          tenantId: data.tenantId,
          error: error.message
        });
      });
    });

    logger.info('Automation event handlers setup complete');
  }

  /**
   * Emit WebSocket event for real-time updates
   */
  private emitWebSocketEvent(type: AutomationEvent['type'], orderId: string, data?: any, error?: string): void {
    const event: AutomationEvent = {
      type,
      orderId,
      timestamp: new Date(),
      data,
      ...(error && { error })
    };

    websocketService.emit('automation_event', event);
  }
}

// Export singleton instance
export const automationService = new AutomationService();