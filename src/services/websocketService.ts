import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

export interface AutomationEvent {
  type: 'order_received' | 'order_validated' | 'inventory_synced' | 'receipt_printed' | 'order_complete' | 'error';
  orderId: string;
  timestamp: Date;
  data?: any;
  error?: string;
}

export interface OrderPipelineStatus {
  orderId: string;
  status: 'received' | 'validated' | 'synced' | 'printed' | 'complete' | 'error';
  timestamp: Date;
  details?: string;
  error?: string;
}

export class WebSocketService extends EventEmitter {
  private io: SocketIOServer | null = null;
  private connectedClients: Map<string, Socket> = new Map();
  private orderStatuses: Map<string, OrderPipelineStatus> = new Map();

  constructor() {
    super();
    this.setupEventHandlers();
  }

  /**
   * Initialize WebSocket server
   */
  public initialize(httpServer: HttpServer): void {
    try {
      this.io = new SocketIOServer(httpServer, {
        cors: {
          origin: process.env['FRONTEND_URL'] || "http://localhost:3000",
          methods: ["GET", "POST"],
          credentials: true
        },
        transports: ['websocket', 'polling']
      });

      this.setupSocketHandlers();
      logger.info('WebSocket service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize WebSocket service:', error);
      throw error;
    }
  }

  /**
   * Setup socket connection handlers
   */
  private setupSocketHandlers(): void {
    if (!this.io) return;

    this.io.on('connection', (socket: Socket) => {
      logger.info(`Client connected: ${socket.id}`);
      this.connectedClients.set(socket.id, socket);

      // Send current order statuses to newly connected client
      this.sendOrderStatuses(socket);

      // Handle client disconnection
      socket.on('disconnect', () => {
        logger.info(`Client disconnected: ${socket.id}`);
        this.connectedClients.delete(socket.id);
      });

      // Handle automation control requests
      socket.on('automation:start', () => {
        this.emit('automation:start');
        socket.emit('automation:status', { enabled: true });
      });

      socket.on('automation:stop', () => {
        this.emit('automation:stop');
        socket.emit('automation:status', { enabled: false });
      });

      socket.on('automation:test', () => {
        this.emit('automation:test');
      });

      // Handle order status requests
      socket.on('orders:get_status', (orderId: string) => {
        const status = this.orderStatuses.get(orderId);
        if (status) {
          socket.emit('orders:status_update', status);
        }
      });

      // Handle ping/pong for connection health
      socket.on('ping', () => {
        socket.emit('pong');
      });
    });
  }

  /**
   * Setup internal event handlers
   */
  private setupEventHandlers(): void {
    // Listen for automation events and broadcast to clients
    this.on('automation_event', (event: AutomationEvent) => {
      this.broadcastAutomationEvent(event);
      this.updateOrderStatus(event);
    });
  }

  /**
   * Broadcast automation event to all connected clients
   */
  public broadcastAutomationEvent(event: AutomationEvent): void {
    if (!this.io) return;

    logger.debug(`Broadcasting automation event: ${event.type} for order ${event.orderId}`);
    
    this.io.emit('automation:event', {
      type: event.type,
      orderId: event.orderId,
      timestamp: event.timestamp,
      data: event.data,
      error: event.error
    });
  }

  /**
   * Update order status and broadcast to clients
   */
  private updateOrderStatus(event: AutomationEvent): void {
    const status: OrderPipelineStatus = {
      orderId: event.orderId,
      status: this.mapEventTypeToStatus(event.type),
      timestamp: event.timestamp,
      details: event.data?.details,
      ...(event.error && { error: event.error })
    };

    this.orderStatuses.set(event.orderId, status);
    
    if (this.io) {
      this.io.emit('orders:status_update', status);
    }
  }

  /**
   * Map event type to order status
   */
  private mapEventTypeToStatus(eventType: string): OrderPipelineStatus['status'] {
    switch (eventType) {
      case 'order_received':
        return 'received';
      case 'order_validated':
        return 'validated';
      case 'inventory_synced':
        return 'synced';
      case 'receipt_printed':
        return 'printed';
      case 'order_complete':
        return 'complete';
      case 'error':
        return 'error';
      default:
        return 'received';
    }
  }

  /**
   * Send current order statuses to a specific client
   */
  private sendOrderStatuses(socket: Socket): void {
    const statuses = Array.from(this.orderStatuses.values());
    socket.emit('orders:initial_statuses', statuses);
  }

  /**
   * Broadcast automation system status
   */
  public broadcastAutomationStatus(enabled: boolean, details?: any): void {
    if (!this.io) return;

    this.io.emit('automation:status', {
      enabled,
      timestamp: new Date(),
      details
    });
  }

  /**
   * Broadcast system metrics
   */
  public broadcastMetrics(metrics: any): void {
    if (!this.io) return;

    this.io.emit('system:metrics', {
      ...metrics,
      timestamp: new Date()
    });
  }

  /**
   * Send notification to all clients
   */
  public sendNotification(type: 'info' | 'success' | 'warning' | 'error', message: string, details?: any): void {
    if (!this.io) return;

    this.io.emit('notification', {
      type,
      message,
      details,
      timestamp: new Date()
    });
  }

  /**
   * Get connected client count
   */
  public getConnectedClientCount(): number {
    return this.connectedClients.size;
  }

  /**
   * Get order status by ID
   */
  public getOrderStatus(orderId: string): OrderPipelineStatus | undefined {
    return this.orderStatuses.get(orderId);
  }

  /**
   * Get all order statuses
   */
  public getAllOrderStatuses(): OrderPipelineStatus[] {
    return Array.from(this.orderStatuses.values());
  }

  /**
   * Clear old order statuses (keep last 100)
   */
  public cleanupOrderStatuses(): void {
    const statuses = Array.from(this.orderStatuses.entries());
    if (statuses.length > 100) {
      // Sort by timestamp and keep the most recent 100
      statuses.sort((a, b) => b[1].timestamp.getTime() - a[1].timestamp.getTime());
      
      this.orderStatuses.clear();
      statuses.slice(0, 100).forEach(([orderId, status]) => {
        this.orderStatuses.set(orderId, status);
      });
      
      logger.info(`Cleaned up order statuses, kept ${this.orderStatuses.size} recent entries`);
    }
  }

  /**
   * Shutdown WebSocket service
   */
  public shutdown(): void {
    if (this.io) {
      this.io.close();
      this.io = null;
    }
    this.connectedClients.clear();
    this.orderStatuses.clear();
    logger.info('WebSocket service shut down');
  }
}

// Export singleton instance
export const websocketService = new WebSocketService();