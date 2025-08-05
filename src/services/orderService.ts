import { PrismaClient } from '@prisma/client';
import { logger } from '../config/logger';
import { getTenantCurrency } from '../utils/currency';
import {
  Order,
  OrderLineItem,
  CreateOrderRequest,
  OrderSearchQuery,
  OrderSearchResult,
  APIResponse,
  OrderSource,
  OrderStatus,
  FinancialStatus,
  FulfillmentStatus,
  InventoryReservation,
  ReservationResult,
  RequestContext,
  InventoryUpdate
} from '../types/index';
import { InventoryService } from './inventoryService';

export interface OrderProcessingResult {
  success: boolean;
  orderId: string;
  reservations?: string[];
  errors?: string[];
}

export interface FulfillmentRequest {
  lineItems: Array<{
    lineItemId: string;
    quantity: number;
    locationId: string;
  }>;
  trackingNumber?: string;
  trackingCompany?: string;
  notifyCustomer?: boolean;
}

export interface ReturnRequest {
  lineItems: Array<{
    lineItemId: string;
    quantity: number;
    reason: string;
  }>;
  restockItems?: boolean;
  refundAmount?: number;
  notes?: string;
}

export class OrderService {
  private prisma: PrismaClient;
  private inventoryService: InventoryService;

  constructor(prisma: PrismaClient, inventoryService: InventoryService) {
    this.prisma = prisma;
    this.inventoryService = inventoryService;
  }

  // =============================================================================
  // CORE ORDER MANAGEMENT
  // =============================================================================

  /**
   * Create a new order
   */
  async createOrder(
    data: CreateOrderRequest,
    context: RequestContext
  ): Promise<Order> {
    logger.info('Creating new order', {
      source: data.source,
      lineItemCount: data.lineItems.length,
      tenantId: context.tenantId,
      correlationId: context.correlationId
    });

    try {
      // Generate order number
      const orderNumber = await this.generateOrderNumber(context.tenantId);

      // Calculate totals
      const { subtotalPrice, totalTax, totalShipping, totalPrice } = this.calculateOrderTotals(data.lineItems);

      // Create order with line items in transaction
      const order = await this.prisma.$transaction(async (tx: any) => {
        // Create the order
        const newOrder = await tx.order.create({
          data: {
            tenantId: context.tenantId,
            shopifyOrderId: data.source === 'shopify' ? data.externalOrderId : undefined,
            externalOrderId: data.externalOrderId,
            orderNumber,
            source: data.source,
            customerId: data.customerId,
            status: 'pending',
            financialStatus: 'pending',
            fulfillmentStatus: 'unfulfilled',
            subtotalPrice,
            totalTax,
            totalShipping,
            totalPrice,
            currency: await getTenantCurrency(this.prisma, context.tenantId),
            shippingAddress: data.shippingAddress ? JSON.stringify(data.shippingAddress) : undefined,
            billingAddress: data.billingAddress ? JSON.stringify(data.billingAddress) : undefined,
            tags: JSON.stringify([]),
            notes: data.notes,
            channelData: JSON.stringify(data.channelData || {})
          }
        });

        // Create line items
        for (const lineItemData of data.lineItems) {
          // Get variant details for snapshot
          const variant = await tx.productVariant.findUnique({
            where: { id: lineItemData.variantId },
            include: { product: true }
          });

          if (!variant) {
            throw new Error(`Variant not found: ${lineItemData.variantId}`);
          }

          await tx.orderLineItem.create({
            data: {
              orderId: newOrder.id,
              variantId: lineItemData.variantId,
              quantity: lineItemData.quantity,
              price: lineItemData.price,
              totalDiscount: 0,
              fulfilledQuantity: 0,
              title: variant.product?.title || variant.title,
              sku: variant.sku,
              variantTitle: variant.title
            }
          });
        }

        return newOrder;
      });

      logger.info('Order created successfully', {
        orderId: order.id,
        orderNumber: order.orderNumber,
        tenantId: context.tenantId
      });

      // Return order with line items
      return this.getOrderById(order.id, context);
    } catch (error) {
      logger.error('Failed to create order', {
        error: error instanceof Error ? error.message : 'Unknown error',
        tenantId: context.tenantId,
        correlationId: context.correlationId
      });
      throw error;
    }
  }

  /**
   * Get order by ID
   */
  async getOrderById(orderId: string, context: RequestContext): Promise<Order> {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        tenantId: context.tenantId
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

    if (!order) {
      throw new Error(`Order not found: ${orderId}`);
    }

    return this.transformOrderFromDb(order);
  }

  /**
   * Update order
   */
  async updateOrder(
    orderId: string,
    data: UpdateOrderRequest,
    context: RequestContext
  ): Promise<Order> {
    logger.info('Updating order', {
      orderId,
      tenantId: context.tenantId,
      correlationId: context.correlationId
    });

    const updateData: any = {
      updatedAt: new Date()
    };
    
    if (data.status !== undefined) updateData.status = data.status;
    if (data.financialStatus !== undefined) updateData.financialStatus = data.financialStatus;
    if (data.fulfillmentStatus !== undefined) updateData.fulfillmentStatus = data.fulfillmentStatus;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.tags !== undefined) updateData.tags = JSON.stringify(data.tags);

    const updatedOrder = await this.prisma.order.update({
      where: {
        id: orderId,
        tenantId: context.tenantId
      },
      data: updateData,
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

    return this.transformOrderFromDb(updatedOrder);
  }

  /**
   * Search orders with filters and pagination
   */
  async searchOrders(
    query: OrderSearchQuery,
    context: RequestContext
  ): Promise<OrderSearchResult> {
    const where: any = {
      tenantId: context.tenantId
    };

    // Apply filters
    if (query.status) {
      where.status = query.status;
    }

    if (query.source) {
      where.source = query.source;
    }

    if (query.customerId) {
      where.customerId = query.customerId;
    }

    if (query.dateRange) {
      where.createdAt = {
        gte: query.dateRange.start,
        lte: query.dateRange.end
      };
    }

    // Get total count
    const totalCount = await this.prisma.order.count({ where });

    // Apply pagination
    const take = Math.min(query.limit || 20, 100);
    const orderBy = {
      [query.sortBy || 'createdAt']: query.sortOrder || 'desc'
    };

    let skip = 0;
    if (query.cursor) {
      const cursorOrder = await this.prisma.order.findUnique({
        where: { id: query.cursor }
      });
      if (cursorOrder) {
        skip = 1; // Skip the cursor record
        where.createdAt = {
          ...where.createdAt,
          lt: cursorOrder.createdAt
        };
      }
    }

    const orders = await this.prisma.order.findMany({
      where,
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
      },
      orderBy,
      take,
      skip
    });

    const transformedOrders = orders.map((order: any) => this.transformOrderFromDb(order));

    const startCursor = orders.length > 0 ? orders[0]?.id : undefined;
    const endCursor = orders.length > 0 ? orders[orders.length - 1]?.id : undefined;

    return {
      orders: transformedOrders,
      pagination: {
        hasNextPage: orders.length === take,
        hasPreviousPage: skip > 0,
        startCursor,
        endCursor,
        totalCount
      }
    };
  }

  // =============================================================================
  // ORDER PROCESSING
  // =============================================================================

  /**
   * Process order - reserve inventory and update status
   */
  async processOrder(
    orderId: string,
    context: RequestContext
  ): Promise<OrderProcessingResult> {
    logger.info('Processing order', {
      orderId,
      tenantId: context.tenantId,
      correlationId: context.correlationId
    });

    try {
      const order = await this.getOrderById(orderId, context);

      if (order.status !== 'pending') {
        throw new Error(`Order ${orderId} is not in pending status`);
      }

      // Get the first available location for inventory reservation
      const locations = await this.inventoryService.getLocations(context.tenantId);
      const defaultLocation = locations.length > 0 && locations[0] ? locations[0].id : 'default';

      // Reserve inventory for all line items
      const reservations: InventoryReservation[] = order.lineItems?.map(item => ({
        variantId: item.variantId,
        locationId: defaultLocation,
        quantity: item.quantity,
        orderId: order.id
      })) || [];

      const reservationResults: ReservationResult[] = [];
      const errors: string[] = [];

      // Process reservations
      for (const reservation of reservations) {
        try {
          // Use the new inventory reservation system
          const reservationResult = await this.inventoryService.reserveInventory([reservation], context);
          
          if (reservationResult[0]?.success) {
            reservationResults.push(reservationResult[0]);
          } else {
            throw new Error(reservationResult[0]?.error || 'Reservation failed');
          }
        } catch (error) {
          const errorMsg = `Failed to reserve inventory for variant ${reservation.variantId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          errors.push(errorMsg);
          logger.error('Inventory reservation failed', {
            orderId,
            variantId: reservation.variantId,
            error: errorMsg,
            correlationId: context.correlationId
          });
        }
      }

      // Update order status
      if (errors.length === 0) {
        await this.updateOrder(orderId, {
          status: 'processing'
        }, context);

        logger.info('Order processed successfully', {
          orderId,
          reservationCount: reservationResults.length
        });

        return {
          success: true,
          orderId,
          reservations: reservationResults.map(r => r.reservationId).filter(Boolean) as string[]
        };
      } else {
        logger.error('Order processing failed', {
          orderId,
          errors
        });

        return {
          success: false,
          orderId,
          errors
        };
      }
    } catch (error) {
      logger.error('Failed to process order', {
        orderId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        orderId,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  /**
   * Fulfill order
   */
  async fulfillOrder(
    orderId: string,
    fulfillmentData: FulfillmentRequest,
    context: RequestContext
  ): Promise<void> {
    logger.info('Fulfilling order', {
      orderId,
      lineItemCount: fulfillmentData.lineItems.length,
      tenantId: context.tenantId
    });

    // Process inventory updates outside of transaction to avoid timeout
    const inventoryUpdates: InventoryUpdate[] = [];
    
    // First, update line items and collect inventory updates
    await this.prisma.$transaction(async (tx: any) => {
      // Update line item fulfilled quantities
      for (const item of fulfillmentData.lineItems) {
        await tx.orderLineItem.update({
          where: { id: item.lineItemId },
          data: {
            fulfilledQuantity: {
              increment: item.quantity
            }
          }
        });

        // Collect inventory updates for later processing
        const lineItem = await tx.orderLineItem.findUnique({
          where: { id: item.lineItemId }
        });

        if (lineItem) {
          inventoryUpdates.push({
            variantId: lineItem.variantId,
            locationId: item.locationId,
            quantityChange: -item.quantity,
            reason: 'sale',
            reference: orderId
          });
        }
      }
    });

    // Process inventory updates outside transaction
    if (inventoryUpdates.length > 0) {
      await this.inventoryService.updateInventory(inventoryUpdates, context);
    }

    // Update order status in separate transaction
    await this.prisma.$transaction(async (tx: any) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { lineItems: true }
      });

      if (order) {
        const allFulfilled = order.lineItems.every(
          (item: any) => item.fulfilledQuantity >= item.quantity
        );

        const partiallyFulfilled = order.lineItems.some(
          (item: any) => item.fulfilledQuantity > 0
        );

        let fulfillmentStatus: FulfillmentStatus = 'unfulfilled';
        if (allFulfilled) {
          fulfillmentStatus = 'fulfilled';
        } else if (partiallyFulfilled) {
          fulfillmentStatus = 'partial';
        }

        await tx.order.update({
          where: { id: orderId },
          data: {
            fulfillmentStatus,
            status: allFulfilled ? 'fulfilled' : 'processing'
          }
        });
      }
    });

    logger.info('Order fulfilled successfully', { orderId });
  }

  /**
   * Cancel order
   */
  async cancelOrder(
    orderId: string,
    reason: string,
    context: RequestContext
  ): Promise<void> {
    logger.info('Cancelling order', {
      orderId,
      reason,
      tenantId: context.tenantId
    });

    await this.prisma.$transaction(async (tx: any) => {
      // Get order details for reservation release
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { lineItems: true }
      });

      if (order && order.tenantId !== context.tenantId) {
        throw new Error('Order not found or access denied');
      }

      // Release any inventory reservations
      if (order?.lineItems) {
        logger.info('Releasing inventory reservations for cancelled order', {
          orderId,
          lineItemCount: order.lineItems.length,
          userId: context.userId,
          correlationId: context.correlationId
        });
        
        // Release reservations by order ID
        await this.inventoryService.releaseReservationsByOrder(orderId, context);
      }

      // Update order status
      await tx.order.update({
        where: {
          id: orderId,
          tenantId: context.tenantId
        },
        data: {
          status: 'cancelled',
          notes: reason,
          updatedAt: new Date()
        }
      });
    });

    logger.info('Order cancelled successfully', { orderId });
  }

  // =============================================================================
  // RETURNS AND REFUNDS
  // =============================================================================

  /**
   * Process return
   */
  async processReturn(
    orderId: string,
    returnData: ReturnRequest,
    context: RequestContext
  ): Promise<void> {
    logger.info('Processing return', {
      orderId,
      lineItemCount: returnData.lineItems.length,
      tenantId: context.tenantId
    });

    await this.prisma.$transaction(async (tx: any) => {
      // Update line item fulfilled quantities
      for (const item of returnData.lineItems) {
        await tx.orderLineItem.update({
          where: { id: item.lineItemId },
          data: {
            fulfilledQuantity: {
              decrement: item.quantity
            }
          }
        });

        // Restock inventory if requested
        if (returnData.restockItems) {
          const lineItem = await tx.orderLineItem.findUnique({
            where: { id: item.lineItemId }
          });

          if (lineItem) {
            // Get the first available location for returns
            const locations = await this.inventoryService.getLocations(context.tenantId);
            const defaultLocation = locations.length > 0 && locations[0] ? locations[0].id : 'default';
            
            const inventoryUpdate: InventoryUpdate = {
              variantId: lineItem.variantId,
              locationId: defaultLocation,
              quantityChange: item.quantity,
              reason: 'return',
              reference: orderId
            };
            await this.inventoryService.updateInventory([inventoryUpdate], context);
          }
        }
      }

      // Update order fulfillment status
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { lineItems: true }
      });

      if (order) {
        const allFulfilled = order.lineItems.every(
          (item: any) => item.fulfilledQuantity >= item.quantity
        );

        const partiallyFulfilled = order.lineItems.some(
          (item: any) => item.fulfilledQuantity > 0
        );

        let fulfillmentStatus: FulfillmentStatus = 'unfulfilled';
        if (allFulfilled) {
          fulfillmentStatus = 'fulfilled';
        } else if (partiallyFulfilled) {
          fulfillmentStatus = 'partial';
        }

        await tx.order.update({
          where: { id: orderId },
          data: { fulfillmentStatus }
        });
      }
    });

    logger.info('Return processed successfully', { orderId });
  }

  // =============================================================================
  // CHANNEL INTEGRATION
  // =============================================================================

  /**
   * Sync order from external channel
   */
  async syncOrderFromChannel(
    channel: OrderSource,
    externalOrderId: string,
    orderData: any,
    context: RequestContext
  ): Promise<Order> {
    logger.info('Syncing order from channel', {
      channel,
      externalOrderId,
      tenantId: context.tenantId
    });

    // Check if order already exists
    const existingOrder = await this.prisma.order.findFirst({
      where: {
        tenantId: context.tenantId,
        externalOrderId,
        source: channel
      }
    });

    if (existingOrder) {
      logger.info('Order already exists, updating', {
        orderId: existingOrder.id,
        externalOrderId,
        userId: context.userId,
        correlationId: context.correlationId
      });
      
      // Update existing order with new data
      const updatedOrder = await this.prisma.order.update({
        where: { id: existingOrder.id },
        data: {
          channelData: JSON.stringify(orderData),
          updatedAt: new Date()
        }
      });
      
      logger.info('Order updated from channel sync', {
        orderId: existingOrder.id,
        channel,
        userId: context.userId,
        correlationId: context.correlationId
      });
      
      return this.getOrderById(existingOrder.id, context);
    }

    // Create new order from channel data
    const createRequest: CreateOrderRequest = {
      externalOrderId,
      source: channel,
      customerId: orderData.customerId,
      lineItems: orderData.lineItems || [],
      shippingAddress: orderData.shippingAddress,
      billingAddress: orderData.billingAddress,
      notes: orderData.notes,
      channelData: orderData
    };

    return this.createOrder(createRequest, context);
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  /**
   * Generate unique order number
   */
  private async generateOrderNumber(tenantId: string): Promise<string> {
    const today = new Date();
    const datePrefix = today.toISOString().slice(0, 10).replace(/-/g, '');
    
    // Get count of orders created today
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
    
    const todayOrderCount = await this.prisma.order.count({
      where: {
        tenantId,
        createdAt: {
          gte: startOfDay,
          lt: endOfDay
        }
      }
    });

    const sequence = (todayOrderCount + 1).toString().padStart(4, '0');
    return `${datePrefix}-${sequence}`;
  }

  /**
   * Calculate order totals
   */
  private calculateOrderTotals(lineItems: Array<{ quantity: number; price: number }>) {
    const subtotalPrice = lineItems.reduce(
      (total, item) => total + (item.quantity * item.price),
      0
    );

    // Calculate tax and shipping (basic implementation - will be enhanced)
    const taxRate = 0.08; // 8% default tax rate - should come from tenant settings
    const totalTax = subtotalPrice * taxRate;
    const totalShipping = this.calculateBasicShipping(lineItems);
    const totalPrice = subtotalPrice + totalTax + totalShipping;

    return {
      subtotalPrice,
      totalTax,
      totalShipping,
      totalPrice
    };
  }

  /**
   * Calculate basic shipping cost
   */
  private calculateBasicShipping(lineItems: Array<{ quantity: number; price: number }>): number {
    // Basic shipping calculation - $5 base + $1 per item
    const baseShipping = 5.00;
    const perItemShipping = 1.00;
    const totalItems = lineItems.reduce((sum, item) => sum + item.quantity, 0);
    
    return baseShipping + (totalItems * perItemShipping);
  }

  /**
   * Transform order from database format to API format
   */
  private transformOrderFromDb(dbOrder: any): Order {
    return {
      id: dbOrder.id,
      tenantId: dbOrder.tenantId,
      shopifyOrderId: dbOrder.shopifyOrderId,
      externalOrderId: dbOrder.externalOrderId,
      orderNumber: dbOrder.orderNumber,
      source: dbOrder.source as OrderSource,
      customerId: dbOrder.customerId,
      status: dbOrder.status as OrderStatus,
      financialStatus: dbOrder.financialStatus as FinancialStatus,
      fulfillmentStatus: dbOrder.fulfillmentStatus as FulfillmentStatus,
      subtotalPrice: dbOrder.subtotalPrice,
      totalTax: dbOrder.totalTax,
      totalShipping: dbOrder.totalShipping,
      totalPrice: dbOrder.totalPrice,
      currency: dbOrder.currency,
      shippingAddress: dbOrder.shippingAddress ? JSON.parse(dbOrder.shippingAddress) : undefined,
      billingAddress: dbOrder.billingAddress ? JSON.parse(dbOrder.billingAddress) : undefined,
      tags: JSON.parse(dbOrder.tags || '[]'),
      notes: dbOrder.notes,
      channelData: JSON.parse(dbOrder.channelData || '{}'),
      createdAt: dbOrder.createdAt,
      updatedAt: dbOrder.updatedAt,
      lineItems: dbOrder.lineItems?.map((item: any) => ({
        id: item.id,
        orderId: item.orderId,
        variantId: item.variantId,
        quantity: item.quantity,
        price: item.price,
        totalDiscount: item.totalDiscount,
        fulfilledQuantity: item.fulfilledQuantity,
        title: item.title,
        sku: item.sku,
        variantTitle: item.variantTitle,
        createdAt: item.createdAt,
        variant: item.variant
      }))
    };
  }
}

// Additional request/response types for order service
export interface UpdateOrderRequest {
  status?: OrderStatus;
  financialStatus?: FinancialStatus;
  fulfillmentStatus?: FulfillmentStatus;
  notes?: string;
  tags?: string[];
}