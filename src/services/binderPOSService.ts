import axios, { AxiosInstance } from 'axios';
import { logger } from '../config/logger';

export interface BinderPOSConfig {
  apiUrl: string;
  apiKey: string;
  storeId: string;
  timeout: number;
  retryAttempts: number;
}

export interface InventoryUpdate {
  sku: string;
  operation: 'increment' | 'decrement' | 'set';
  quantity: number;
  reason: string;
  reference: string;
}

export interface SyncResult {
  success: boolean;
  syncedItems: number;
  conflicts: any[];
  timestamp: Date;
}

export interface ReceiptData {
  orderId: string;
  orderNumber: string;
  timestamp: Date;
  items: Array<{
    sku: string;
    title: string;
    quantity: number;
    location: string;
  }>;
  totalItems: number;
  pickingInstructions: string[];
}

export interface PrintJob {
  id: string;
  orderId: string;
  status: 'submitted' | 'printing' | 'completed' | 'failed';
  submittedAt: Date;
  printerName: string;
}

export interface PrintJobStatus {
  id: string;
  status: string;
  completedAt?: Date;
  error?: string;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringPeriod: number;
}

class CircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failureCount = 0;
  private lastFailureTime?: Date;
  private config: CircuitBreakerConfig;

  constructor(config: CircuitBreakerConfig) {
    this.config = config;
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (this.shouldAttemptReset()) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN - BinderPOS service unavailable');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private shouldAttemptReset(): boolean {
    if (!this.lastFailureTime) return false;
    const timeSinceLastFailure = Date.now() - this.lastFailureTime.getTime();
    return timeSinceLastFailure >= this.config.recoveryTimeout;
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = new Date();

    if (this.failureCount >= this.config.failureThreshold) {
      this.state = 'OPEN';
      logger.error('Circuit breaker opened for BinderPOS service', {
        failureCount: this.failureCount,
        threshold: this.config.failureThreshold
      });
    }
  }

  getState(): string {
    return this.state;
  }
}

export class BinderPOSService {
  private client!: AxiosInstance;
  private circuitBreaker!: CircuitBreaker;
  private config!: BinderPOSConfig;

  constructor() {
    this.loadConfiguration();
    this.setupClient();
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      recoveryTimeout: 30000,
      monitoringPeriod: 60000
    });
  }

  async testConnection(): Promise<{ connected: boolean; details: any }> {
    try {
      const response = await this.circuitBreaker.execute(async () => {
        return await this.client.get('/health');
      });

      logger.info('BinderPOS connection test successful', {
        version: response.data?.version,
        storeId: response.data?.storeId
      });

      return {
        connected: true,
        details: {
          version: response.data?.version || 'unknown',
          storeId: response.data?.storeId || this.config.storeId,
          capabilities: response.data?.capabilities || [],
          circuitBreakerState: this.circuitBreaker.getState()
        }
      };
    } catch (error: any) {
      logger.error('BinderPOS connection test failed', {
        error: error.message,
        circuitBreakerState: this.circuitBreaker.getState()
      });

      return {
        connected: false,
        details: {
          error: error.message,
          lastAttempt: new Date(),
          circuitBreakerState: this.circuitBreaker.getState()
        }
      };
    }
  }

  async syncInventory(updates: InventoryUpdate[]): Promise<SyncResult> {
    try {
      logger.info('Starting BinderPOS inventory sync', {
        updateCount: updates.length,
        updates: updates.map(u => ({ sku: u.sku, operation: u.operation, quantity: u.quantity }))
      });

      const response = await this.circuitBreaker.execute(async () => {
        return await this.client.post('/inventory/sync', {
          updates: updates.map(update => ({
            sku: update.sku,
            operation: update.operation,
            quantity: update.quantity,
            reason: update.reason,
            reference: update.reference,
            timestamp: new Date().toISOString()
          }))
        });
      });

      const result: SyncResult = {
        success: true,
        syncedItems: response.data?.syncedItems || updates.length,
        conflicts: response.data?.conflicts || [],
        timestamp: new Date()
      };

      logger.info('BinderPOS inventory sync completed', {
        syncedItems: result.syncedItems,
        conflicts: result.conflicts.length
      });

      return result;
    } catch (error: any) {
      logger.error('BinderPOS inventory sync failed', {
        error: error.message,
        updateCount: updates.length
      });
      throw new Error(`BinderPOS inventory sync failed: ${error.message}`);
    }
  }

  async printReceipt(orderId: string, receiptData: ReceiptData): Promise<PrintJob> {
    try {
      logger.info('Submitting receipt print job to BinderPOS', {
        orderId,
        orderNumber: receiptData.orderNumber,
        itemCount: receiptData.items.length
      });

      const response = await this.circuitBreaker.execute(async () => {
        return await this.client.post('/print/receipt', {
          orderId,
          template: 'picking_list',
          data: {
            ...receiptData,
            storeId: this.config.storeId,
            printedAt: new Date().toISOString()
          },
          copies: 1,
          printer: 'default'
        });
      });

      const printJob: PrintJob = {
        id: response.data?.printJobId || `job_${Date.now()}`,
        orderId,
        status: 'submitted',
        submittedAt: new Date(),
        printerName: response.data?.printerName || 'default'
      };

      logger.info('Receipt print job submitted successfully', {
        printJobId: printJob.id,
        orderId,
        printerName: printJob.printerName
      });

      return printJob;
    } catch (error: any) {
      logger.error('BinderPOS receipt printing failed', {
        error: error.message,
        orderId
      });
      throw new Error(`BinderPOS receipt printing failed: ${error.message}`);
    }
  }

  async getPrintStatus(printJobId: string): Promise<PrintJobStatus> {
    try {
      const response = await this.circuitBreaker.execute(async () => {
        return await this.client.get(`/print/status/${printJobId}`);
      });

      const status: PrintJobStatus = {
        id: printJobId,
        status: response.data?.status || 'unknown',
        ...(response.data?.completedAt && { completedAt: new Date(response.data.completedAt) }),
        ...(response.data?.error && { error: response.data.error })
      };

      logger.debug('Retrieved print job status', {
        printJobId,
        status: status.status
      });

      return status;
    } catch (error: any) {
      logger.error('Failed to get print job status', {
        error: error.message,
        printJobId
      });
      throw new Error(`Failed to get print status: ${error.message}`);
    }
  }

  async getConnectionHealth(): Promise<{
    connected: boolean;
    circuitBreakerState: string;
    lastCheck: Date;
  }> {
    const connectionTest = await this.testConnection();
    return {
      connected: connectionTest.connected,
      circuitBreakerState: this.circuitBreaker.getState(),
      lastCheck: new Date()
    };
  }

  private loadConfiguration(): void {
    this.config = {
      apiUrl: process.env['BINDERPOS_API_URL'] || 'http://localhost:8080/api',
      apiKey: process.env['BINDERPOS_API_KEY'] || '',
      storeId: process.env['BINDERPOS_STORE_ID'] || '',
      timeout: parseInt(process.env['BINDERPOS_TIMEOUT'] || '30000'),
      retryAttempts: parseInt(process.env['BINDERPOS_RETRY_ATTEMPTS'] || '3')
    };

    // Validate required configuration
    if (!this.config.apiKey) {
      logger.warn('BinderPOS API key not configured - service will operate in mock mode');
    }
    if (!this.config.storeId) {
      logger.warn('BinderPOS store ID not configured');
    }

    logger.info('BinderPOS service configuration loaded', {
      apiUrl: this.config.apiUrl,
      storeId: this.config.storeId,
      timeout: this.config.timeout,
      hasApiKey: !!this.config.apiKey
    });
  }

  private setupClient(): void {
    this.client = axios.create({
      baseURL: this.config.apiUrl,
      timeout: this.config.timeout,
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
        'X-Store-ID': this.config.storeId,
        'User-Agent': 'CardStore-Automation/1.0'
      }
    });

    // Add request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.debug('BinderPOS API Request', {
          method: config.method?.toUpperCase(),
          url: config.url,
          hasData: !!config.data
        });
        return config;
      },
      (error) => {
        logger.error('BinderPOS API Request Error', { error: error.message });
        return Promise.reject(error);
      }
    );

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => {
        logger.debug('BinderPOS API Response', {
          status: response.status,
          url: response.config.url
        });
        return response;
      },
      (error) => {
        logger.error('BinderPOS API Response Error', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          url: error.config?.url
        });
        return Promise.reject(error);
      }
    );
  }

  // Mock mode for development/testing when BinderPOS is not available
  private async mockOperation<T>(operation: string, data?: any): Promise<T> {
    logger.info(`BinderPOS Mock Operation: ${operation}`, { data });
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
    
    switch (operation) {
      case 'testConnection':
        return {
          connected: true,
          details: {
            version: 'mock-1.0.0',
            storeId: this.config.storeId || 'mock-store',
            capabilities: ['inventory', 'printing'],
            mode: 'mock'
          }
        } as T;
        
      case 'syncInventory':
        return {
          success: true,
          syncedItems: data?.updates?.length || 0,
          conflicts: [],
          timestamp: new Date()
        } as T;
        
      case 'printReceipt':
        return {
          id: `mock_job_${Date.now()}`,
          orderId: data?.orderId,
          status: 'submitted',
          submittedAt: new Date(),
          printerName: 'mock-printer'
        } as T;
        
      case 'getPrintStatus':
        return {
          id: data?.printJobId,
          status: 'completed',
          completedAt: new Date(),
          error: undefined
        } as T;
        
      default:
        throw new Error(`Unknown mock operation: ${operation}`);
    }
  }

  // Enable mock mode for development
  async enableMockMode(): Promise<void> {
    logger.info('BinderPOS service enabled in mock mode');
    
    // Override methods to use mock operations
    this.testConnection = () => this.mockOperation('testConnection');
    this.syncInventory = (updates) => this.mockOperation('syncInventory', { updates });
    this.printReceipt = (orderId, receiptData) => this.mockOperation('printReceipt', { orderId, receiptData });
    this.getPrintStatus = (printJobId) => this.mockOperation('getPrintStatus', { printJobId });
  }
}