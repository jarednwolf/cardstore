# CardStore Operations Layer - Complete Automation Implementation Guide

## Document Information
- **Version**: 1.0
- **Date**: 2025-08-05
- **Status**: Implementation Guide
- **Owner**: Engineering Team
- **Purpose**: Step-by-step guide for implementing full automation

## Overview

This guide provides the complete implementation roadmap for achieving full automation of the CardStore operations workflow. The core automation flow is:

**Shopify Order → Inventory Update → BinderPOS Sync → Receipt Print → Ready for Picking**

## Quick Start Implementation

### Phase 1: Immediate Automation (Week 1)

#### Step 1: Create Automation Dashboard Component
```javascript
// frontend/js/automation.js
class AutomationDashboard {
  constructor() {
    this.orderPipeline = new OrderPipeline();
    this.binderPOSManager = new BinderPOSManager();
    this.automationControls = new AutomationControls();
    this.realTimeUpdates = new RealTimeUpdates();
  }

  async initialize() {
    await this.loadAutomationStatus();
    this.setupEventListeners();
    this.startRealTimeMonitoring();
    this.renderDashboard();
  }

  renderDashboard() {
    const dashboardHTML = `
      <div class="automation-dashboard">
        <!-- Header with Status -->
        <div class="automation-header">
          <h2>Automation Control Center</h2>
          <div class="automation-status ${this.getStatusClass()}">
            <span class="status-indicator"></span>
            <span class="status-text">${this.getStatusText()}</span>
          </div>
        </div>

        <!-- Main Pipeline View -->
        <div class="pipeline-container">
          ${this.renderOrderPipeline()}
        </div>

        <!-- Control Panel -->
        <div class="control-panel">
          ${this.renderControlPanel()}
        </div>

        <!-- Metrics Dashboard -->
        <div class="metrics-dashboard">
          ${this.renderMetrics()}
        </div>

        <!-- Recent Activity -->
        <div class="activity-feed">
          ${this.renderActivityFeed()}
        </div>
      </div>
    `;

    document.getElementById('automation-view').innerHTML = dashboardHTML;
  }

  renderOrderPipeline() {
    return `
      <div class="order-pipeline">
        <h3>Live Order Processing Pipeline</h3>
        <div class="pipeline-stages">
          <div class="stage" data-stage="received">
            <div class="stage-header">
              <i class="fas fa-shopping-cart"></i>
              <span>Order Received</span>
            </div>
            <div class="stage-content" id="orders-received">
              <!-- Live orders will be populated here -->
            </div>
          </div>

          <div class="stage" data-stage="validated">
            <div class="stage-header">
              <i class="fas fa-check-circle"></i>
              <span>Inventory Validated</span>
            </div>
            <div class="stage-content" id="orders-validated">
              <!-- Validated orders -->
            </div>
          </div>

          <div class="stage" data-stage="synced">
            <div class="stage-header">
              <i class="fas fa-sync"></i>
              <span>BinderPOS Updated</span>
            </div>
            <div class="stage-content" id="orders-synced">
              <!-- Synced orders -->
            </div>
          </div>

          <div class="stage" data-stage="printed">
            <div class="stage-header">
              <i class="fas fa-print"></i>
              <span>Receipt Printed</span>
            </div>
            <div class="stage-content" id="orders-printed">
              <!-- Printed orders -->
            </div>
          </div>

          <div class="stage" data-stage="complete">
            <div class="stage-header">
              <i class="fas fa-package"></i>
              <span>Ready for Picking</span>
            </div>
            <div class="stage-content" id="orders-complete">
              <!-- Completed orders -->
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderControlPanel() {
    return `
      <div class="automation-controls">
        <h3>Automation Controls</h3>
        
        <div class="control-group">
          <label>Automation Status:</label>
          <div class="toggle-switch">
            <input type="checkbox" id="automation-toggle" ${this.isAutomationEnabled ? 'checked' : ''}>
            <label for="automation-toggle" class="toggle-label">
              <span class="toggle-text">Automation ${this.isAutomationEnabled ? 'ON' : 'OFF'}</span>
            </label>
          </div>
        </div>

        <div class="control-group">
          <label>BinderPOS Connection:</label>
          <div class="connection-status ${this.binderPOSStatus}">
            <span class="status-dot"></span>
            <span>${this.binderPOSStatus.toUpperCase()}</span>
            <button onclick="this.testBinderPOSConnection()" class="btn-sm">Test</button>
          </div>
        </div>

        <div class="control-actions">
          <button onclick="this.pauseAutomation()" class="btn-warning">Pause Automation</button>
          <button onclick="this.resumeAutomation()" class="btn-success">Resume Automation</button>
          <button onclick="this.emergencyStop()" class="btn-danger">Emergency Stop</button>
        </div>

        <div class="manual-controls">
          <h4>Manual Operations</h4>
          <button onclick="this.manualSync()" class="btn-secondary">Manual Sync</button>
          <button onclick="this.retryFailedOrders()" class="btn-info">Retry Failed</button>
          <button onclick="this.printMissedReceipts()" class="btn-warning">Print Missed Receipts</button>
        </div>
      </div>
    `;
  }
}
```

#### Step 2: Backend API Endpoints for Automation
```typescript
// src/routes/automation.ts
import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { AutomationService } from '../services/automationService';
import { BinderPOSService } from '../services/binderPOSService';

const router = Router();
const automationService = new AutomationService();
const binderPOSService = new BinderPOSService();

// Automation Control Endpoints
router.get('/status', authMiddleware, async (req: Request, res: Response) => {
  try {
    const status = await automationService.getAutomationStatus();
    res.json({ success: true, data: status });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/start', authMiddleware, async (req: Request, res: Response) => {
  try {
    await automationService.startAutomation();
    res.json({ success: true, message: 'Automation started' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/stop', authMiddleware, async (req: Request, res: Response) => {
  try {
    await automationService.stopAutomation();
    res.json({ success: true, message: 'Automation stopped' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// BinderPOS Integration Endpoints
router.post('/binderpos/test-connection', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await binderPOSService.testConnection();
    res.json({ success: true, connected: result.connected, details: result.details });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/binderpos/print-receipt', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { orderId, receiptData } = req.body;
    const printJob = await binderPOSService.printReceipt(orderId, receiptData);
    res.json({ success: true, printJobId: printJob.id });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/binderpos/sync-inventory', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { updates } = req.body;
    const result = await binderPOSService.syncInventory(updates);
    res.json({ success: true, syncResult: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Order Pipeline Endpoints
router.get('/orders/pipeline', authMiddleware, async (req: Request, res: Response) => {
  try {
    const pipeline = await automationService.getOrderPipeline();
    res.json({ success: true, data: pipeline });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/orders/:orderId/retry', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    await automationService.retryOrder(orderId);
    res.json({ success: true, message: 'Order retry initiated' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
```

#### Step 3: Core Automation Service
```typescript
// src/services/automationService.ts
import { EventEmitter } from 'events';
import { OrderService } from './orderService';
import { InventoryService } from './inventoryService';
import { BinderPOSService } from './binderPOSService';
import { WebSocketManager } from './webSocketManager';

export class AutomationService extends EventEmitter {
  private isEnabled: boolean = false;
  private processingOrders: Map<string, OrderProcessingState> = new Map();
  private orderService: OrderService;
  private inventoryService: InventoryService;
  private binderPOSService: BinderPOSService;
  private wsManager: WebSocketManager;

  constructor() {
    super();
    this.orderService = new OrderService();
    this.inventoryService = new InventoryService();
    this.binderPOSService = new BinderPOSService();
    this.wsManager = new WebSocketManager();
    this.setupEventHandlers();
  }

  async startAutomation(): Promise<void> {
    this.isEnabled = true;
    this.emit('automation.started');
    this.wsManager.broadcast('automation.status', { enabled: true });
  }

  async stopAutomation(): Promise<void> {
    this.isEnabled = false;
    this.emit('automation.stopped');
    this.wsManager.broadcast('automation.status', { enabled: false });
  }

  async processShopifyOrder(orderData: any): Promise<void> {
    if (!this.isEnabled) {
      console.log('Automation disabled, skipping order processing');
      return;
    }

    const orderId = orderData.id;
    const processingState: OrderProcessingState = {
      orderId,
      stage: 'received',
      startTime: new Date(),
      attempts: 0,
      errors: []
    };

    this.processingOrders.set(orderId, processingState);
    this.broadcastOrderUpdate(orderId, 'received', orderData);

    try {
      // Stage 1: Validate Inventory
      await this.validateInventory(orderId, orderData);
      this.updateOrderStage(orderId, 'validated');

      // Stage 2: Update BinderPOS Inventory
      await this.updateBinderPOSInventory(orderId, orderData);
      this.updateOrderStage(orderId, 'synced');

      // Stage 3: Print Receipt
      await this.printReceipt(orderId, orderData);
      this.updateOrderStage(orderId, 'printed');

      // Stage 4: Mark Complete
      this.updateOrderStage(orderId, 'complete');
      this.processingOrders.delete(orderId);

    } catch (error) {
      await this.handleProcessingError(orderId, error);
    }
  }

  private async validateInventory(orderId: string, orderData: any): Promise<void> {
    const inventoryChecks = await Promise.all(
      orderData.line_items.map(async (item: any) => {
        const available = await this.inventoryService.getAvailableToSell(
          item.variant_id,
          'shopify'
        );
        return {
          variantId: item.variant_id,
          requested: item.quantity,
          available,
          sufficient: available >= item.quantity
        };
      })
    );

    const insufficientItems = inventoryChecks.filter(check => !check.sufficient);
    if (insufficientItems.length > 0) {
      throw new Error(`Insufficient inventory for items: ${insufficientItems.map(i => i.variantId).join(', ')}`);
    }

    this.broadcastOrderUpdate(orderId, 'validated', { inventoryChecks });
  }

  private async updateBinderPOSInventory(orderId: string, orderData: any): Promise<void> {
    const inventoryUpdates = orderData.line_items.map((item: any) => ({
      sku: item.sku,
      operation: 'decrement',
      quantity: item.quantity,
      reason: 'sale',
      reference: `shopify_order_${orderId}`
    }));

    const syncResult = await this.binderPOSService.syncInventory(inventoryUpdates);
    this.broadcastOrderUpdate(orderId, 'synced', { syncResult });
  }

  private async printReceipt(orderId: string, orderData: any): Promise<void> {
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
    this.broadcastOrderUpdate(orderId, 'printed', { printJobId: printJob.id });
  }

  private generatePickingInstructions(orderData: any): string[] {
    const instructions = ['Pick the following items:'];
    
    orderData.line_items.forEach((item: any, index: number) => {
      instructions.push(`${index + 1}. ${item.title} (SKU: ${item.sku}) - Qty: ${item.quantity}`);
    });

    instructions.push('', 'Special Instructions:');
    if (orderData.shipping_address?.company) {
      instructions.push(`- Business delivery to: ${orderData.shipping_address.company}`);
    }
    if (orderData.note) {
      instructions.push(`- Customer note: ${orderData.note}`);
    }

    return instructions;
  }

  private updateOrderStage(orderId: string, stage: string): void {
    const processingState = this.processingOrders.get(orderId);
    if (processingState) {
      processingState.stage = stage;
      processingState.lastUpdate = new Date();
    }
    this.broadcastOrderUpdate(orderId, stage, {});
  }

  private broadcastOrderUpdate(orderId: string, stage: string, data: any): void {
    this.wsManager.broadcast('order.stage.updated', {
      orderId,
      stage,
      timestamp: new Date(),
      data
    });
  }

  private async handleProcessingError(orderId: string, error: Error): Promise<void> {
    const processingState = this.processingOrders.get(orderId);
    if (processingState) {
      processingState.attempts++;
      processingState.errors.push({
        message: error.message,
        timestamp: new Date(),
        stage: processingState.stage
      });

      if (processingState.attempts < 3) {
        // Retry after delay
        setTimeout(() => {
          this.retryOrder(orderId);
        }, 5000 * processingState.attempts);
      } else {
        // Mark as failed, require manual intervention
        this.broadcastOrderUpdate(orderId, 'failed', {
          error: error.message,
          attempts: processingState.attempts
        });
      }
    }
  }

  async retryOrder(orderId: string): Promise<void> {
    const processingState = this.processingOrders.get(orderId);
    if (processingState) {
      // Get original order data and retry from current stage
      const orderData = await this.orderService.getOrderById(orderId, { tenantId: 'default' });
      
      switch (processingState.stage) {
        case 'received':
          await this.validateInventory(orderId, orderData);
          break;
        case 'validated':
          await this.updateBinderPOSInventory(orderId, orderData);
          break;
        case 'synced':
          await this.printReceipt(orderId, orderData);
          break;
      }
    }
  }

  getAutomationStatus(): any {
    return {
      enabled: this.isEnabled,
      activeOrders: this.processingOrders.size,
      processingOrders: Array.from(this.processingOrders.values())
    };
  }

  getOrderPipeline(): any {
    const pipeline = {
      received: [],
      validated: [],
      synced: [],
      printed: [],
      complete: []
    };

    this.processingOrders.forEach((state, orderId) => {
      if (pipeline[state.stage]) {
        pipeline[state.stage].push({
          orderId,
          startTime: state.startTime,
          lastUpdate: state.lastUpdate,
          attempts: state.attempts
        });
      }
    });

    return pipeline;
  }

  private setupEventHandlers(): void {
    // Listen for Shopify webhook events
    this.on('shopify.order.created', this.processShopifyOrder.bind(this));
    this.on('shopify.order.paid', this.processShopifyOrder.bind(this));
  }
}

interface OrderProcessingState {
  orderId: string;
  stage: string;
  startTime: Date;
  lastUpdate?: Date;
  attempts: number;
  errors: Array<{
    message: string;
    timestamp: Date;
    stage: string;
  }>;
}
```

#### Step 4: BinderPOS Service Implementation
```typescript
// src/services/binderPOSService.ts
import axios, { AxiosInstance } from 'axios';
import { CircuitBreaker } from '../utils/circuitBreaker';

export class BinderPOSService {
  private client: AxiosInstance;
  private circuitBreaker: CircuitBreaker;
  private config: BinderPOSConfig;

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

      return {
        connected: true,
        details: {
          version: response.data.version,
          storeId: response.data.storeId,
          capabilities: response.data.capabilities
        }
      };
    } catch (error) {
      return {
        connected: false,
        details: {
          error: error.message,
          lastAttempt: new Date()
        }
      };
    }
  }

  async syncInventory(updates: InventoryUpdate[]): Promise<SyncResult> {
    try {
      const response = await this.circuitBreaker.execute(async () => {
        return await this.client.post('/inventory/sync', {
          updates: updates.map(update => ({
            sku: update.sku,
            operation: update.operation,
            quantity: update.quantity,
            reason: update.reason,
            reference: update.reference
          }))
        });
      });

      return {
        success: true,
        syncedItems: response.data.syncedItems,
        conflicts: response.data.conflicts || [],
        timestamp: new Date()
      };
    } catch (error) {
      throw new Error(`BinderPOS inventory sync failed: ${error.message}`);
    }
  }

  async printReceipt(orderId: string, receiptData: ReceiptData): Promise<PrintJob> {
    try {
      const response = await this.circuitBreaker.execute(async () => {
        return await this.client.post('/print/receipt', {
          orderId,
          template: 'picking_list',
          data: receiptData,
          copies: 1,
          printer: 'default'
        });
      });

      return {
        id: response.data.printJobId,
        orderId,
        status: 'submitted',
        submittedAt: new Date(),
        printerName: response.data.printerName
      };
    } catch (error) {
      throw new Error(`BinderPOS receipt printing failed: ${error.message}`);
    }
  }

  async getPrintStatus(printJobId: string): Promise<PrintJobStatus> {
    try {
      const response = await this.circuitBreaker.execute(async () => {
        return await this.client.get(`/print/status/${printJobId}`);
      });

      return {
        id: printJobId,
        status: response.data.status,
        completedAt: response.data.completedAt ? new Date(response.data.completedAt) : undefined,
        error: response.data.error
      };
    } catch (error) {
      throw new Error(`Failed to get print status: ${error.message}`);
    }
  }

  private loadConfiguration(): void {
    this.config = {
      apiUrl: process.env.BINDERPOS_API_URL || 'http://localhost:8080/api',
      apiKey: process.env.BINDERPOS_API_KEY || '',
      storeId: process.env.BINDERPOS_STORE_ID || '',
      timeout: parseInt(process.env.BINDERPOS_TIMEOUT || '30000'),
      retryAttempts: parseInt(process.env.BINDERPOS_RETRY_ATTEMPTS || '3')
    };
  }

  private setupClient(): void {
    this.client = axios.create({
      baseURL: this.config.apiUrl,
      timeout: this.config.timeout,
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
        'X-Store-ID': this.config.storeId
      }
    });

    // Add request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        console.log(`BinderPOS API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('BinderPOS API Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => {
        console.log(`BinderPOS API Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        console.error('BinderPOS API Response Error:', error.response?.data || error.message);
        return Promise.reject(error);
      }
    );
  }
}

interface BinderPOSConfig {
  apiUrl: string;
  apiKey: string;
  storeId: string;
  timeout: number;
  retryAttempts: number;
}

interface InventoryUpdate {
  sku: string;
  operation: 'increment' | 'decrement' | 'set';
  quantity: number;
  reason: string;
  reference: string;
}

interface SyncResult {
  success: boolean;
  syncedItems: number;
  conflicts: any[];
  timestamp: Date;
}

interface ReceiptData {
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

interface PrintJob {
  id: string;
  orderId: string;
  status: 'submitted' | 'printing' | 'completed' | 'failed';
  submittedAt: Date;
  printerName: string;
}

interface PrintJobStatus {
  id: string;
  status: string;
  completedAt?: Date;
  error?: string;
}
```

### Phase 2: Advanced Features (Weeks 2-4)

#### Step 5: Enhanced Frontend Components
```javascript
// frontend/js/automation-analytics.js
class AutomationAnalytics {
  constructor() {
    this.charts = new Map();
    this.metrics = {
      ordersProcessed: 0,
      averageProcessingTime: 0,
      successRate: 0,
      errorRate: 0
    };
  }

  renderAnalyticsDashboard() {
    return `
      <div class="analytics-dashboard">
        <div class="analytics-header">
          <h2>Automation Analytics</h2>
          <div class="time-range-selector">
            <select onchange="this.updateTimeRange(this.value)">
              <option value="1h">Last Hour</option>
              <option value="24h" selected>Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
          </div>
        </div>

        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-header">
              <h3>Orders Processed</h3>
              <i class="fas fa-shopping-cart"></i>
            </div>
            <div class="metric-value">${this.metrics.ordersProcessed}</div>
            <div class="metric-change positive">+12% from yesterday</div>
          </div>

          <div class="metric-card">
            <div class="metric-header">
              <h3>Avg Processing Time</h3>
              <i class="fas fa-clock"></i>
            </div>
            <div class="metric-value">${this.metrics.averageProcessingTime}s</div>
            <div class="metric-change negative">+0.5s from yesterday</div>
          </div>

          <div class="metric-card">
            <div class="metric-header">
              <h3>Success Rate</h3>
              <i class="fas fa-check-circle"></i>
            </div>
            <div class="metric-value">${this.metrics.successRate}%</div>
            <div class="metric-change positive">+2% from yesterday</div>
          </div>

          <div class="metric-card">
            <div class="metric-header">
              <h3>Error Rate</h3>
              <i class="fas fa-exclamation-triangle"></i>
            </div>
            <div class="metric-value">${this.metrics.errorRate}%</div>
            <div class="metric-change positive">-1% from yesterday</div>
          </div>
        </div>

        <div class="charts-grid">
          <div class="chart-container">
            <h3>Processing Time Trend</h3>
            <canvas id="processing-time-chart"></canvas>
          </div>

          <div class="chart-container">
            <h3>Order Volume</h3>
            <canvas id="order-volume-chart"></canvas>
          </div>

          <div class="chart-container">
            <h3>Error Distribution</h3>
            <canvas id="error-distribution-chart"></canvas>
          </div>

          <div class="chart-container">
            <h3>Stage Performance</h3>
            <canvas id="stage-performance-chart"></canvas>
          </div>
        </div>

        <div class="insights-section">
          <h3>Automation Insights</h3>
          <div class="insights-list">
            ${this.renderInsights()}
          </div>
        </div>
      </div>
    `;
  }

  renderInsights() {
    const insights = [
      {
        type: 'optimization',
        title: 'BinderPOS Sync Optimization',
        description: 'Consider batching inventory updates to reduce API calls by 30%',
        impact: 'high'
      },
      {
        type: 'warning',
        title: 'Print Queue Backup',
        description: 'Receipt printing is taking longer than usual during peak hours',
        impact: 'medium'
      },
      {
        type: 'success',
        title: 'Improved Success Rate',
        description: 'Automation success rate has improved by 5% this week',
        impact: 'positive'
      }
    ];

    return insights.map(insight => `
      <div class="insight-item ${insight.type}">
        <div class="insight-icon">
          <i class="fas fa-${this.getInsightIcon(insight.type)}"></i>
        </div>
        <div class="insight-content">
          <h4>${insight.title}</h4>
          <p>${insight.description}</p>
        </div>
        <div class="insight-impact ${insight.impact}">
          ${insight.impact.toUpperCase()}
        </div>
      </div>
    `).join('');
  }

  async loadAnalyticsData(timeRange = '24h') {
    try {
      const response = await api.get(`/automation/analytics?range=${timeRange}`);
      this.updateMetrics(response.data);
      this.updateCharts(response.data);
    } catch (error) {
      console.error('Failed to load analytics data:', error);
    }
  }

  updateCharts(data) {
    this.updateProcessingTimeChart(data.processingTimes);
    this.updateOrderVolumeChart(data.orderVolume);
    this.updateErrorDistributionChart(data.errors);
    this.updateStagePerformanceChart(data.stagePerformance);
  }

  updateProcessingTimeChart(data) {
    const ctx = document.getElementById('processing-time-chart').getContext('2d');
    
    if (this.