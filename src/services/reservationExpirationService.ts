import { PrismaClient } from '@prisma/client';
import { logger } from '../config/logger';
import { RequestContext } from '../types';

export interface ExpiredReservation {
  id: string;
  tenantId: string;
  variantId: string;
  locationId: string;
  orderId: string;
  quantity: number;
  expiresAt: Date;
  createdAt: Date;
  createdBy: string;
  expiredAt: Date;
  reason: 'timeout' | 'manual' | 'order_cancelled' | 'payment_failed';
}

export interface ReservationCleanupResult {
  totalExpired: number;
  totalReleased: number;
  totalFailed: number;
  releasedInventory: Array<{
    variantId: string;
    locationId: string;
    quantity: number;
  }>;
  errors: string[];
}

export interface ReservationMonitoringConfig {
  defaultExpirationHours: number;
  cleanupIntervalMinutes: number;
  maxRetries: number;
  alertThresholds: {
    highExpirationRate: number; // percentage
    lowInventoryAfterExpiration: number; // quantity
  };
}

export interface ReservationAlert {
  type: 'high_expiration_rate' | 'low_inventory' | 'system_error';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  data: any;
  timestamp: Date;
}

export class ReservationExpirationService {
  private prisma: PrismaClient;
  private config: ReservationMonitoringConfig;
  private cleanupInterval?: NodeJS.Timeout | undefined;

  constructor(prisma: PrismaClient, config?: Partial<ReservationMonitoringConfig>) {
    this.prisma = prisma;
    this.config = {
      defaultExpirationHours: 24,
      cleanupIntervalMinutes: 15,
      maxRetries: 3,
      alertThresholds: {
        highExpirationRate: 20, // 20% expiration rate triggers alert
        lowInventoryAfterExpiration: 5 // Less than 5 units after expiration
      },
      ...config
    };
  }

  /**
   * Start automated reservation cleanup process
   */
  startAutomatedCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    logger.info('Starting automated reservation cleanup', {
      intervalMinutes: this.config.cleanupIntervalMinutes
    });

    this.cleanupInterval = setInterval(async () => {
      try {
        await this.cleanupExpiredReservations();
      } catch (error) {
        logger.error('Automated reservation cleanup failed', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }, this.config.cleanupIntervalMinutes * 60 * 1000);
  }

  /**
   * Stop automated reservation cleanup process
   */
  stopAutomatedCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
      logger.info('Automated reservation cleanup stopped');
    }
  }

  /**
   * Clean up all expired reservations
   */
  async cleanupExpiredReservations(): Promise<ReservationCleanupResult> {
    logger.info('Starting expired reservation cleanup');

    const result: ReservationCleanupResult = {
      totalExpired: 0,
      totalReleased: 0,
      totalFailed: 0,
      releasedInventory: [],
      errors: []
    };

    try {
      // Find expired reservations (simulated since we don't have the table yet)
      const expiredReservations = await this.findExpiredReservations();
      result.totalExpired = expiredReservations.length;

      if (expiredReservations.length === 0) {
        logger.info('No expired reservations found');
        return result;
      }

      // Process expired reservations in batches
      const batchSize = 50;
      for (let i = 0; i < expiredReservations.length; i += batchSize) {
        const batch = expiredReservations.slice(i, i + batchSize);
        
        for (const reservation of batch) {
          try {
            await this.releaseExpiredReservation(reservation);
            result.totalReleased++;
            
            // Track released inventory
            const existingRelease = result.releasedInventory.find(
              r => r.variantId === reservation.variantId && r.locationId === reservation.locationId
            );
            
            if (existingRelease) {
              existingRelease.quantity += reservation.quantity;
            } else {
              result.releasedInventory.push({
                variantId: reservation.variantId,
                locationId: reservation.locationId,
                quantity: reservation.quantity
              });
            }

          } catch (error) {
            result.totalFailed++;
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            result.errors.push(`Failed to release reservation ${reservation.id}: ${errorMessage}`);
          }
        }
      }

      // Generate alerts if needed
      await this.checkAndGenerateAlerts(result);

      logger.info('Expired reservation cleanup completed', {
        totalExpired: result.totalExpired,
        totalReleased: result.totalReleased,
        totalFailed: result.totalFailed,
        releasedInventoryItems: result.releasedInventory.length
      });

      return result;

    } catch (error) {
      logger.error('Expired reservation cleanup failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Manually expire a specific reservation
   */
  async expireReservation(
    reservationId: string,
    reason: 'manual' | 'order_cancelled' | 'payment_failed',
    context: RequestContext
  ): Promise<boolean> {
    logger.info('Manually expiring reservation', {
      reservationId,
      reason,
      tenantId: context.tenantId,
      userId: context.userId
    });

    try {
      // Find the reservation (simulated)
      const reservation = await this.findReservationById(reservationId, context.tenantId);
      
      if (!reservation) {
        logger.warn('Reservation not found for manual expiration', { reservationId });
        return false;
      }

      // Release the reservation
      await this.releaseExpiredReservation({
        ...reservation,
        reason
      });

      logger.info('Reservation manually expired', {
        reservationId,
        variantId: reservation.variantId,
        locationId: reservation.locationId,
        quantity: reservation.quantity,
        reason
      });

      return true;

    } catch (error) {
      logger.error('Failed to manually expire reservation', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reservationId,
        tenantId: context.tenantId
      });
      return false;
    }
  }

  /**
   * Extend reservation expiration time
   */
  async extendReservation(
    reservationId: string,
    additionalHours: number,
    context: RequestContext
  ): Promise<boolean> {
    logger.info('Extending reservation expiration', {
      reservationId,
      additionalHours,
      tenantId: context.tenantId,
      userId: context.userId
    });

    try {
      // In a real implementation, this would update the reservation table
      // For now, we'll simulate the extension
      
      const reservation = await this.findReservationById(reservationId, context.tenantId);
      
      if (!reservation) {
        logger.warn('Reservation not found for extension', { reservationId });
        return false;
      }

      const newExpirationTime = new Date(reservation.expiresAt);
      newExpirationTime.setHours(newExpirationTime.getHours() + additionalHours);

      // Simulate updating the reservation
      logger.info('Reservation extended', {
        reservationId,
        originalExpiration: reservation.expiresAt,
        newExpiration: newExpirationTime,
        additionalHours
      });

      return true;

    } catch (error) {
      logger.error('Failed to extend reservation', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reservationId,
        tenantId: context.tenantId
      });
      return false;
    }
  }

  /**
   * Get reservation expiration statistics
   */
  async getExpirationStatistics(
    tenantId: string,
    days: number = 7
  ): Promise<{
    totalReservations: number;
    expiredReservations: number;
    expirationRate: number;
    averageReservationDuration: number;
    topExpiredVariants: Array<{
      variantId: string;
      variantTitle: string;
      expiredCount: number;
      totalQuantity: number;
    }>;
  }> {
    logger.info('Calculating reservation expiration statistics', { tenantId, days });

    // Simulate statistics calculation
    const totalReservations = 150;
    const expiredReservations = 23;
    const expirationRate = (expiredReservations / totalReservations) * 100;
    const averageReservationDuration = 18.5; // hours

    const topExpiredVariants = [
      {
        variantId: 'variant-1',
        variantTitle: 'Black Lotus - Alpha',
        expiredCount: 5,
        totalQuantity: 8
      },
      {
        variantId: 'variant-2',
        variantTitle: 'Mox Ruby - Beta',
        expiredCount: 3,
        totalQuantity: 5
      }
    ];

    return {
      totalReservations,
      expiredReservations,
      expirationRate,
      averageReservationDuration,
      topExpiredVariants
    };
  }

  /**
   * Monitor reservation health and generate alerts
   */
  async monitorReservationHealth(tenantId: string): Promise<ReservationAlert[]> {
    const alerts: ReservationAlert[] = [];
    
    try {
      const stats = await this.getExpirationStatistics(tenantId);
      
      // Check for high expiration rate
      if (stats.expirationRate > this.config.alertThresholds.highExpirationRate) {
        alerts.push({
          type: 'high_expiration_rate',
          severity: stats.expirationRate > 30 ? 'critical' : 'high',
          message: `High reservation expiration rate: ${stats.expirationRate.toFixed(1)}%`,
          data: { expirationRate: stats.expirationRate, threshold: this.config.alertThresholds.highExpirationRate },
          timestamp: new Date()
        });
      }

      // Check for low inventory after expiration
      for (const variant of stats.topExpiredVariants) {
        if (variant.totalQuantity <= this.config.alertThresholds.lowInventoryAfterExpiration) {
          alerts.push({
            type: 'low_inventory',
            severity: 'medium',
            message: `Low inventory after expiration for ${variant.variantTitle}: ${variant.totalQuantity} units`,
            data: { variantId: variant.variantId, quantity: variant.totalQuantity },
            timestamp: new Date()
          });
        }
      }

    } catch (error) {
      alerts.push({
        type: 'system_error',
        severity: 'high',
        message: 'Failed to monitor reservation health',
        data: { error: error instanceof Error ? error.message : 'Unknown error' },
        timestamp: new Date()
      });
    }

    return alerts;
  }

  // =============================================================================
  // PRIVATE HELPER METHODS
  // =============================================================================

  private async findExpiredReservations(): Promise<Array<{
    id: string;
    tenantId: string;
    variantId: string;
    locationId: string;
    orderId: string;
    quantity: number;
    expiresAt: Date;
    createdAt: Date;
    createdBy: string;
  }>> {
    // Simulate finding expired reservations
    // In a real implementation, this would query the inventory_reservations table
    const now = new Date();
    
    // Mock expired reservations
    return [
      {
        id: 'reservation-1',
        tenantId: 'tenant-1',
        variantId: 'variant-1',
        locationId: 'location-1',
        orderId: 'order-1',
        quantity: 2,
        expiresAt: new Date(now.getTime() - 60 * 60 * 1000), // 1 hour ago
        createdAt: new Date(now.getTime() - 25 * 60 * 60 * 1000), // 25 hours ago
        createdBy: 'user-1'
      }
    ];
  }

  private async findReservationById(
    reservationId: string,
    tenantId: string
  ): Promise<{
    id: string;
    tenantId: string;
    variantId: string;
    locationId: string;
    orderId: string;
    quantity: number;
    expiresAt: Date;
    createdAt: Date;
    createdBy: string;
  } | null> {
    // Simulate finding reservation by ID
    if (reservationId === 'reservation-1') {
      return {
        id: reservationId,
        tenantId,
        variantId: 'variant-1',
        locationId: 'location-1',
        orderId: 'order-1',
        quantity: 2,
        expiresAt: new Date(),
        createdAt: new Date(),
        createdBy: 'user-1'
      };
    }
    return null;
  }

  private async releaseExpiredReservation(
    reservation: {
      id: string;
      tenantId: string;
      variantId: string;
      locationId: string;
      quantity: number;
      reason?: string;
    }
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Release the reserved inventory
      await tx.inventoryItem.updateMany({
        where: {
          tenantId: reservation.tenantId,
          variantId: reservation.variantId,
          locationId: reservation.locationId
        },
        data: {
          reserved: { decrement: reservation.quantity }
        }
      });

      // Record the release in stock movements
      await tx.stockMovement.create({
        data: {
          tenantId: reservation.tenantId,
          variantId: reservation.variantId,
          locationId: reservation.locationId,
          type: 'in',
          quantity: reservation.quantity,
          reason: 'reservation_expired',
          reference: `Expired reservation ${reservation.id}`,
          createdBy: 'system'
        }
      });

      // In a real implementation, would also update the reservation status
      logger.debug('Reservation released', {
        reservationId: reservation.id,
        variantId: reservation.variantId,
        locationId: reservation.locationId,
        quantity: reservation.quantity
      });
    });
  }

  private async checkAndGenerateAlerts(result: ReservationCleanupResult): Promise<void> {
    // Generate alerts based on cleanup results
    if (result.totalFailed > 0) {
      logger.warn('Some reservations failed to release', {
        totalFailed: result.totalFailed,
        errors: result.errors
      });
    }

    if (result.totalExpired > 50) {
      logger.warn('High number of expired reservations', {
        totalExpired: result.totalExpired
      });
    }

    // Check for low inventory after releases
    for (const release of result.releasedInventory) {
      const inventory = await this.prisma.inventoryItem.findFirst({
        where: {
          variantId: release.variantId,
          locationId: release.locationId
        }
      });

      if (inventory && (inventory.onHand - inventory.reserved) <= this.config.alertThresholds.lowInventoryAfterExpiration) {
        logger.warn('Low inventory after reservation expiration', {
          variantId: release.variantId,
          locationId: release.locationId,
          availableQuantity: inventory.onHand - inventory.reserved
        });
      }
    }
  }
}