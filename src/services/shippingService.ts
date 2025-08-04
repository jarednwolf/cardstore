import { PrismaClient } from '@prisma/client';
import { logger } from '../config/logger';
import { getTenantCurrency } from '../utils/currency';
import { env } from '../config/env';
import {
  Order,
  Address,
  RequestContext,
  APIResponse
} from '../types';

export interface ShippingLabel {
  id: string;
  orderId: string;
  trackingNumber: string;
  labelUrl: string;
  carrier: string;
  service: string;
  cost: number;
  currency: string;
  createdAt: Date;
}

export interface CreateLabelRequest {
  orderId: string;
  carrier: 'usps' | 'ups' | 'fedex' | 'dhl';
  service: string;
  packageType: string;
  weight: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  insurance?: number;
  signature?: boolean;
}

export interface ShippingRate {
  carrier: string;
  service: string;
  cost: number;
  currency: string;
  estimatedDays: number;
}

export interface TrackingInfo {
  trackingNumber: string;
  status: string;
  estimatedDelivery?: Date;
  events: TrackingEvent[];
}

export interface TrackingEvent {
  timestamp: Date;
  status: string;
  location?: string;
  description: string;
}

export class ShippingService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Get shipping rates for an order
   */
  async getShippingRates(
    orderId: string,
    context: RequestContext
  ): Promise<ShippingRate[]> {
    logger.info('Getting shipping rates', { orderId, tenantId: context.tenantId });

    try {
      const order = await this.prisma.order.findFirst({
        where: {
          id: orderId,
          tenantId: context.tenantId
        },
        include: {
          lineItems: {
            include: {
              variant: true
            }
          }
        }
      });

      if (!order) {
        throw new Error(`Order not found: ${orderId}`);
      }

      // Calculate total weight
      const totalWeight = order.lineItems?.reduce((weight: number, item: any) => {
        const itemWeight = item.variant?.weight || 0;
        return weight + (itemWeight * item.quantity);
      }, 0) || 0;

      // Get shipping address
      const shippingAddress = order.shippingAddress ? JSON.parse(order.shippingAddress) : null;
      if (!shippingAddress) {
        throw new Error('Order missing shipping address');
      }

      // Get tenant currency
      const currency = await getTenantCurrency(this.prisma, context.tenantId);

      // Mock shipping rates (in production, integrate with ShipStation/Stamps.com API)
      const rates: ShippingRate[] = [
        {
          carrier: 'usps',
          service: 'First-Class Mail',
          cost: 3.50,
          currency,
          estimatedDays: 3
        },
        {
          carrier: 'usps',
          service: 'Priority Mail',
          cost: 7.95,
          currency,
          estimatedDays: 2
        },
        {
          carrier: 'ups',
          service: 'UPS Ground',
          cost: 9.50,
          currency,
          estimatedDays: 3
        },
        {
          carrier: 'fedex',
          service: 'FedEx Ground',
          cost: 10.25,
          currency,
          estimatedDays: 3
        }
      ];

      // Adjust rates based on weight
      const adjustedRates = rates.map(rate => ({
        ...rate,
        cost: rate.cost + (totalWeight > 1 ? (totalWeight - 1) * 2 : 0)
      }));

      logger.info('Shipping rates calculated', {
        orderId,
        rateCount: adjustedRates.length,
        totalWeight
      });

      return adjustedRates;
    } catch (error) {
      logger.error('Failed to get shipping rates', {
        orderId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Create shipping label
   */
  async createShippingLabel(
    request: CreateLabelRequest,
    context: RequestContext
  ): Promise<ShippingLabel> {
    logger.info('Creating shipping label', {
      orderId: request.orderId,
      carrier: request.carrier,
      service: request.service,
      tenantId: context.tenantId
    });

    try {
      const order = await this.prisma.order.findFirst({
        where: {
          id: request.orderId,
          tenantId: context.tenantId
        }
      });

      if (!order) {
        throw new Error(`Order not found: ${request.orderId}`);
      }

      // Generate tracking number (in production, this comes from carrier API)
      const trackingNumber = this.generateTrackingNumber(request.carrier);

      // Mock label creation (in production, integrate with ShipStation/Stamps.com API)
      const labelUrl = await this.generateLabelUrl(request, trackingNumber);

      const shippingLabel: ShippingLabel = {
        id: `label-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        orderId: request.orderId,
        trackingNumber,
        labelUrl,
        carrier: request.carrier,
        service: request.service,
        cost: this.calculateShippingCost(request),
        currency: await getTenantCurrency(this.prisma, context.tenantId),
        createdAt: new Date()
      };

      // Store label information (you might want to add a shipping_labels table)
      // For now, we'll update the order with tracking info
      await this.prisma.order.update({
        where: { id: request.orderId },
        data: {
          channelData: JSON.stringify({
            ...JSON.parse(order.channelData || '{}'),
            shippingLabel: shippingLabel
          })
        }
      });

      logger.info('Shipping label created successfully', {
        orderId: request.orderId,
        trackingNumber,
        labelId: shippingLabel.id
      });

      return shippingLabel;
    } catch (error) {
      logger.error('Failed to create shipping label', {
        orderId: request.orderId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get tracking information
   */
  async getTrackingInfo(
    trackingNumber: string,
    carrier: string
  ): Promise<TrackingInfo> {
    logger.info('Getting tracking info', { trackingNumber, carrier });

    try {
      // Mock tracking info (in production, integrate with carrier APIs)
      const trackingInfo: TrackingInfo = {
        trackingNumber,
        status: 'In Transit',
        estimatedDelivery: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
        events: [
          {
            timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
            status: 'Label Created',
            location: 'Origin Facility',
            description: 'Shipping label created'
          },
          {
            timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
            status: 'Picked Up',
            location: 'Origin Facility',
            description: 'Package picked up by carrier'
          },
          {
            timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
            status: 'In Transit',
            location: 'Sorting Facility',
            description: 'Package in transit to destination'
          }
        ]
      };

      return trackingInfo;
    } catch (error) {
      logger.error('Failed to get tracking info', {
        trackingNumber,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Batch create labels for multiple orders
   */
  async batchCreateLabels(
    requests: CreateLabelRequest[],
    context: RequestContext
  ): Promise<{ success: ShippingLabel[]; failed: Array<{ orderId: string; error: string }> }> {
    logger.info('Batch creating shipping labels', {
      orderCount: requests.length,
      tenantId: context.tenantId
    });

    const success: ShippingLabel[] = [];
    const failed: Array<{ orderId: string; error: string }> = [];

    for (const request of requests) {
      try {
        const label = await this.createShippingLabel(request, context);
        success.push(label);
      } catch (error) {
        failed.push({
          orderId: request.orderId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    logger.info('Batch label creation completed', {
      successCount: success.length,
      failedCount: failed.length
    });

    return { success, failed };
  }

  /**
   * Print labels (send to printer or generate PDF)
   */
  async printLabels(
    labelIds: string[],
    format: 'pdf' | 'zpl' | 'png' = 'pdf'
  ): Promise<{ printJobId: string; downloadUrl?: string }> {
    logger.info('Printing labels', { labelIds, format });

    try {
      // Generate print job ID
      const printJobId = `print-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // In production, this would:
      // 1. Retrieve label data
      // 2. Format for printer (ZPL for thermal printers, PDF for regular printers)
      // 3. Send to printer queue or generate download URL

      let downloadUrl: string | undefined;
      if (format === 'pdf') {
        downloadUrl = `/api/shipping/labels/download/${printJobId}`;
      }

      // Mock print job processing
      setTimeout(() => {
        logger.info('Print job completed', { printJobId });
      }, 2000);

      return { printJobId, ...(downloadUrl && { downloadUrl }) };
    } catch (error) {
      logger.error('Failed to print labels', {
        labelIds,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  // Private helper methods
  private generateTrackingNumber(carrier: string): string {
    const prefix = {
      usps: '9400',
      ups: '1Z',
      fedex: '7712',
      dhl: '00'
    }[carrier] || '9400';

    const randomDigits = Math.random().toString().substr(2, 12);
    return `${prefix}${randomDigits}`;
  }

  private async generateLabelUrl(request: CreateLabelRequest, trackingNumber: string): Promise<string> {
    // In production, this would call the carrier API to generate the actual label
    // For now, return a mock URL
    return `/api/shipping/labels/${trackingNumber}/download`;
  }

  private calculateShippingCost(request: CreateLabelRequest): number {
    // Mock cost calculation based on carrier and service
    const baseCosts: Record<string, Record<string, number>> = {
      usps: { 'First-Class Mail': 3.50, 'Priority Mail': 7.95 },
      ups: { 'UPS Ground': 9.50, 'UPS 2nd Day Air': 15.00 },
      fedex: { 'FedEx Ground': 10.25, 'FedEx 2Day': 16.50 },
      dhl: { 'DHL Ground': 12.00, 'DHL Express': 25.00 }
    };

    const carrierCosts = baseCosts[request.carrier] || baseCosts['usps'];
    const baseCost = (carrierCosts && carrierCosts[request.service]) || 10.00;

    // Add weight-based cost
    const weightCost = request.weight > 1 ? (request.weight - 1) * 2 : 0;

    // Add insurance cost
    const insuranceCost = request.insurance ? request.insurance * 0.01 : 0;

    return baseCost + weightCost + insuranceCost;
  }
}