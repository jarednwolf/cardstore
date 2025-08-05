/**
 * Automation Dashboard - Real-time monitoring and control of order automation
 */
class AutomationDashboard {
  constructor() {
    this.isAutomationEnabled = false;
    this.binderPOSStatus = 'disconnected';
    this.socket = null;
    this.currentOrderId = null;
    this.refreshInterval = null;
    
    // Metrics data
    this.metrics = {
      ordersProcessed: 0,
      averageProcessingTime: 0,
      successRate: 100,
      errorCount: 0
    };
    
    // Order pipeline data
    this.orderPipeline = {
      received: [],
      validated: [],
      synced: [],
      printed: [],
      complete: [],
      failed: []
    };
    
    // Settings
    this.settings = {
      autoPrintReceipts: true,
      autoSyncInventory: true,
      maxRetryAttempts: 3,
      refreshInterval: 30000
    };
  }

  async initialize() {
    try {
      console.log('Initializing automation dashboard...');
      
      // Load initial data
      await this.loadAutomationStatus();
      await this.loadSettings();
      
      // Setup WebSocket connection
      this.setupWebSocketConnection();
      
      // Render the dashboard
      this.renderDashboard();
      
      // Start periodic updates
      this.startPeriodicUpdates();
      
      console.log('Automation dashboard initialized successfully');
    } catch (error) {
      console.error('Failed to initialize automation dashboard:', error);
      showNotification('Failed to initialize automation dashboard', 'error');
    }
  }

  setupWebSocketConnection() {
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}`;
      
      this.socket = io(wsUrl, {
        transports: ['websocket', 'polling'],
        timeout: 5000,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
      });
      
      this.socket.on('connect', () => {
        console.log('Connected to automation WebSocket');
        this.updateConnectionStatus('websocket', 'connected');
        showNotification('Connected to real-time updates', 'success');
      });

      this.socket.on('disconnect', () => {
        console.log('Disconnected from automation WebSocket');
        this.updateConnectionStatus('websocket', 'disconnected');
        showNotification('Lost connection to real-time updates', 'warning');
      });

      this.socket.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error);
        this.updateConnectionStatus('websocket', 'error');
      });

      // New WebSocket event handlers for our automation system
      this.socket.on('automation:event', (event) => {
        console.log('Automation event received:', event);
        this.handleAutomationEvent(event);
      });

      this.socket.on('automation:status', (status) => {
        console.log('Automation status updated:', status);
        this.isAutomationEnabled = status.enabled;
        this.updateStatusBanner();
        this.updateControlPanel();
      });

      this.socket.on('orders:status_update', (status) => {
        console.log('Order status updated:', status);
        this.handleOrderStatusUpdate(status);
      });

      this.socket.on('orders:initial_statuses', (statuses) => {
        console.log('Initial order statuses received:', statuses);
        statuses.forEach(status => this.handleOrderStatusUpdate(status));
      });

      this.socket.on('notification', (notification) => {
        showNotification(notification.message, notification.type);
      });

      this.socket.on('system:metrics', (metrics) => {
        this.updateMetrics(metrics);
      });

      // Connection health check
      this.socket.on('pong', () => {
        // Connection is healthy
      });

      // Send periodic ping
      setInterval(() => {
        if (this.socket && this.socket.connected) {
          this.socket.emit('ping');
        }
      }, 30000);

    } catch (error) {
      console.error('Failed to setup WebSocket connection:', error);
      this.updateConnectionStatus('websocket', 'error');
    }
  }

  handleAutomationEvent(event) {
    // Update order in pipeline based on event type
    const statusMap = {
      'order_received': 'received',
      'order_validated': 'validated',
      'inventory_synced': 'synced',
      'receipt_printed': 'printed',
      'order_complete': 'complete',
      'error': 'failed'
    };

    const stage = statusMap[event.type] || 'received';
    
    // Update order pipeline
    this.updateOrderInPipeline({
      orderId: event.orderId,
      stage: stage,
      timestamp: event.timestamp,
      data: event.data,
      error: event.error
    });

    // Show notification for important events
    const messages = {
      'order_received': `Order ${event.orderId.slice(-6)} received`,
      'order_validated': `Order ${event.orderId.slice(-6)} validated`,
      'inventory_synced': `Inventory synced for order ${event.orderId.slice(-6)}`,
      'receipt_printed': `Receipt printed for order ${event.orderId.slice(-6)}`,
      'order_complete': `Order ${event.orderId.slice(-6)} completed`,
      'error': `Error processing order ${event.orderId.slice(-6)}: ${event.error}`
    };
    
    const message = messages[event.type] || `Order ${event.orderId.slice(-6)} updated`;
    const type = event.type === 'error' ? 'error' : 'info';
    
    showNotification(message, type);
    this.addActivityItem(message, this.getEventIcon(event.type));
  }

  handleOrderStatusUpdate(status) {
    // Update order in the appropriate pipeline stage
    this.updateOrderInPipeline({
      orderId: status.orderId,
      stage: status.status,
      timestamp: status.timestamp,
      data: { details: status.details },
      error: status.error
    });
  }

  getEventIcon(eventType) {
    const icons = {
      'order_received': 'fas fa-shopping-cart',
      'order_validated': 'fas fa-check-circle',
      'inventory_synced': 'fas fa-sync',
      'receipt_printed': 'fas fa-print',
      'order_complete': 'fas fa-package',
      'error': 'fas fa-exclamation-triangle'
    };
    return icons[eventType] || 'fas fa-info-circle';
  }

  updateMetrics(metrics) {
    this.metrics = { ...this.metrics, ...metrics };
    this.updateMetricsDisplay();
  }

  renderDashboard() {
    const dashboardHTML = `
      <div class="automation-dashboard">
        <!-- Main Pipeline View -->
        <div class="pipeline-container">
          ${this.renderOrderPipeline()}
        </div>

        <!-- Control Panel and Metrics Row -->
        <div class="dashboard-row">
          <div class="control-panel">
            ${this.renderControlPanel()}
          </div>
          
          <div class="metrics-panel">
            ${this.renderMetrics()}
          </div>
        </div>

        <!-- Recent Activity -->
        <div class="activity-section">
          ${this.renderActivityFeed()}
        </div>
      </div>
    `;

    document.getElementById('automation-view').innerHTML = dashboardHTML;
    this.attachEventListeners();
    this.updateLastUpdateTime();
  }

  renderOrderPipeline() {
    const stages = [
      { id: 'received', name: 'Order Received', icon: 'shopping-cart', color: '#17a2b8' },
      { id: 'validated', name: 'Inventory Validated', icon: 'check-circle', color: '#28a745' },
      { id: 'synced', name: 'BinderPOS Updated', icon: 'sync', color: '#ffc107' },
      { id: 'printed', name: 'Receipt Printed', icon: 'print', color: '#fd7e14' },
      { id: 'complete', name: 'Ready for Picking', icon: 'package', color: '#6f42c1' },
      { id: 'failed', name: 'Failed', icon: 'exclamation-triangle', color: '#dc3545' }
    ];

    return `
      <div class="order-pipeline">
        <div class="pipeline-header">
          <h3><i class="fas fa-stream"></i> Live Order Processing Pipeline</h3>
          <div class="pipeline-stats">
            <span class="stat">
              <i class="fas fa-clock"></i>
              Active: ${this.getTotalActiveOrders()}
            </span>
            <span class="stat">
              <i class="fas fa-chart-line"></i>
              Success Rate: ${this.metrics.successRate}%
            </span>
          </div>
        </div>
        
        <div class="pipeline-stages">
          ${stages.map(stage => `
            <div class="stage" data-stage="${stage.id}">
              <div class="stage-header" style="border-color: ${stage.color}">
                <div class="stage-icon" style="color: ${stage.color}">
                  <i class="fas fa-${stage.icon}"></i>
                </div>
                <div class="stage-info">
                  <span class="stage-name">${stage.name}</span>
                  <span class="stage-count" style="background-color: ${stage.color}">
                    ${this.orderPipeline[stage.id]?.length || 0}
                  </span>
                </div>
              </div>
              <div class="stage-content" id="orders-${stage.id}">
                ${this.renderStageOrders(this.orderPipeline[stage.id] || [], stage.id)}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  renderStageOrders(orders, stage) {
    if (orders.length === 0) {
      return `<div class="no-orders">
        <i class="fas fa-inbox"></i>
        <span>No orders in this stage</span>
      </div>`;
    }

    return orders.map(order => `
      <div class="order-card" data-order-id="${order.orderId}" onclick="automationDashboard.showOrderDetails('${order.orderId}')">
        <div class="order-header">
          <span class="order-id">#${order.orderId.slice(-6)}</span>
          <span class="order-time">${this.formatTime(order.startTime)}</span>
        </div>
        <div class="order-details">
          ${order.attempts > 0 ? `
            <span class="attempts ${order.attempts > 1 ? 'warning' : ''}">
              <i class="fas fa-redo"></i> ${order.attempts}
            </span>
          ` : ''}
          ${order.lastUpdate ? `
            <span class="last-update">
              <i class="fas fa-clock"></i> ${this.formatTime(order.lastUpdate)}
            </span>
          ` : ''}
        </div>
        ${stage === 'failed' || order.attempts > 0 ? `
          <div class="order-actions" onclick="event.stopPropagation()">
            <button onclick="automationDashboard.retryOrder('${order.orderId}')" 
                    class="btn-sm btn-warning" title="Retry Order">
              <i class="fas fa-redo"></i>
            </button>
          </div>
        ` : ''}
      </div>
    `).join('');
  }

  renderControlPanel() {
    return `
      <div class="automation-controls">
        <h3><i class="fas fa-sliders-h"></i> Automation Controls</h3>
        
        <div class="control-group">
          <div class="control-header">
            <label>Automation Status</label>
            <div class="automation-toggle">
              <input type="checkbox" id="automation-toggle-switch" 
                     ${this.isAutomationEnabled ? 'checked' : ''} 
                     onchange="automationDashboard.toggleAutomation()">
              <label for="automation-toggle-switch" class="toggle-switch">
                <span class="toggle-slider"></span>
              </label>
              <span class="toggle-text">${this.isAutomationEnabled ? 'ON' : 'OFF'}</span>
            </div>
          </div>
        </div>

        <div class="control-group">
          <div class="control-header">
            <label>BinderPOS Connection</label>
            <button onclick="automationDashboard.testBinderPOSConnection()" 
                    class="btn-sm btn-secondary">
              <i class="fas fa-plug"></i> Test
            </button>
          </div>
          <div class="connection-status ${this.binderPOSStatus}">
            <span class="status-dot"></span>
            <span class="status-text">${this.binderPOSStatus.toUpperCase()}</span>
          </div>
        </div>

        <div class="control-actions">
          <button onclick="automationDashboard.pauseAutomation()" 
                  class="btn btn-warning" ${!this.isAutomationEnabled ? 'disabled' : ''}>
            <i class="fas fa-pause"></i> Pause
          </button>
          <button onclick="automationDashboard.emergencyStop()" 
                  class="btn btn-danger">
            <i class="fas fa-stop"></i> Emergency Stop
          </button>
        </div>

        <div class="manual-controls">
          <h4>Manual Operations</h4>
          <div class="manual-buttons">
            <button onclick="automationDashboard.manualSync()" class="btn btn-secondary">
              <i class="fas fa-sync"></i> Manual Sync
            </button>
            <button onclick="automationDashboard.retryFailedOrders()" class="btn btn-info">
              <i class="fas fa-redo"></i> Retry Failed
            </button>
            <button onclick="automationDashboard.printMissedReceipts()" class="btn btn-outline">
              <i class="fas fa-print"></i> Print Missed
            </button>
          </div>
        </div>
      </div>
    `;
  }

  renderMetrics() {
    return `
      <div class="automation-metrics">
        <h3><i class="fas fa-chart-bar"></i> Performance Metrics</h3>
        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-icon">
              <i class="fas fa-shopping-cart"></i>
            </div>
            <div class="metric-content">
              <div class="metric-value">${this.metrics.ordersProcessed}</div>
              <div class="metric-label">Orders Today</div>
            </div>
          </div>
          
          <div class="metric-card">
            <div class="metric-icon">
              <i class="fas fa-stopwatch"></i>
            </div>
            <div class="metric-content">
              <div class="metric-value">${this.metrics.averageProcessingTime}s</div>
              <div class="metric-label">Avg Time</div>
            </div>
          </div>
          
          <div class="metric-card success">
            <div class="metric-icon">
              <i class="fas fa-check-circle"></i>
            </div>
            <div class="metric-content">
              <div class="metric-value">${this.metrics.successRate}%</div>
              <div class="metric-label">Success Rate</div>
            </div>
          </div>
          
          <div class="metric-card ${this.metrics.errorCount > 0 ? 'error' : ''}">
            <div class="metric-icon">
              <i class="fas fa-exclamation-triangle"></i>
            </div>
            <div class="metric-content">
              <div class="metric-value">${this.metrics.errorCount}</div>
              <div class="metric-label">Errors Today</div>
            </div>
          </div>
        </div>
        
        <div class="metrics-actions">
          <button onclick="automationDashboard.showAnalytics()" class="btn btn-outline">
            <i class="fas fa-chart-line"></i> View Analytics
          </button>
        </div>
      </div>
    `;
  }

  renderActivityFeed() {
    return `
      <div class="activity-feed">
        <div class="activity-header">
          <h3><i class="fas fa-history"></i> Recent Activity</h3>
          <button onclick="automationDashboard.clearActivity()" class="btn-sm btn-outline">
            <i class="fas fa-trash"></i> Clear
          </button>
        </div>
        <div class="activity-list" id="activity-list">
          <div class="activity-item">
            <div class="activity-icon">
              <i class="fas fa-info-circle"></i>
            </div>
            <div class="activity-content">
              <span class="activity-message">Automation dashboard initialized</span>
              <span class="activity-time">${this.formatTime(new Date())}</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // API Methods
  async loadAutomationStatus() {
    try {
      const response = await api.get('/automation/status');
      if (response.success) {
        this.isAutomationEnabled = response.data.automation.enabled;
        this.binderPOSStatus = response.data.binderpos.connected ? 'connected' : 'disconnected';
        this.updateStatusBanner();
      }
    } catch (error) {
      console.error('Failed to load automation status:', error);
      showNotification('Failed to load automation status', 'error');
    }
  }

  async loadOrderPipeline() {
    try {
      const response = await api.get('/automation/orders/pipeline');
      if (response.success) {
        this.orderPipeline = response.data;
        this.updatePipelineDisplay();
      }
    } catch (error) {
      console.error('Failed to load order pipeline:', error);
    }
  }

  async loadMetrics() {
    try {
      const response = await api.get('/automation/analytics/performance?timeRange=24h');
      if (response.success) {
        this.metrics = response.data;
        this.updateMetricsDisplay();
      }
    } catch (error) {
      console.error('Failed to load metrics:', error);
    }
  }

  async toggleAutomation() {
    try {
      if (this.socket && this.socket.connected) {
        // Use WebSocket for real-time response
        const action = this.isAutomationEnabled ? 'automation:stop' : 'automation:start';
        this.socket.emit(action);
        
        const message = this.isAutomationEnabled ? 'Stopping automation...' : 'Starting automation...';
        showNotification(message, 'info');
        this.addActivityItem(message, 'fas fa-power-off');
      } else {
        // Fallback to HTTP API
        const endpoint = this.isAutomationEnabled ? '/automation/stop' : '/automation/start';
        const response = await api.post(endpoint);
        
        if (response.success) {
          this.isAutomationEnabled = !this.isAutomationEnabled;
          this.updateStatusBanner();
          this.updateControlPanel();
          
          const message = this.isAutomationEnabled ? 'Automation started' : 'Automation stopped';
          showNotification(message, 'success');
          this.addActivityItem(message, 'fas fa-power-off');
        }
      }
    } catch (error) {
      console.error('Failed to toggle automation:', error);
      showNotification('Failed to toggle automation', 'error');
    }
  }

  async testBinderPOSConnection() {
    try {
      showNotification('Testing BinderPOS connection...', 'info');
      
      const response = await api.post('/automation/binderpos/test-connection');
      
      if (response.success) {
        this.binderPOSStatus = response.connected ? 'connected' : 'disconnected';
        this.updateConnectionStatus('binderpos', this.binderPOSStatus);
        this.updateControlPanel();
        
        const message = response.connected 
          ? 'BinderPOS connection successful' 
          : 'BinderPOS connection failed';
        const type = response.connected ? 'success' : 'error';
        
        showNotification(message, type);
        this.addActivityItem(message, 'fas fa-plug');
      }
    } catch (error) {
      console.error('Failed to test BinderPOS connection:', error);
      this.binderPOSStatus = 'error';
      this.updateConnectionStatus('binderpos', 'error');
      showNotification('Failed to test BinderPOS connection', 'error');
    }
  }

  async retryOrder(orderId) {
    try {
      showNotification(`Retrying order ${orderId.slice(-6)}...`, 'info');
      
      const response = await api.post(`/automation/orders/${orderId}/retry`);
      
      if (response.success) {
        showNotification('Order retry initiated', 'success');
        this.addActivityItem(`Retrying order #${orderId.slice(-6)}`, 'fas fa-redo');
        await this.loadOrderPipeline();
      }
    } catch (error) {
      console.error('Failed to retry order:', error);
      showNotification('Failed to retry order', 'error');
    }
  }

  async pauseAutomation() {
    if (confirm('Are you sure you want to pause automation? New orders will not be processed automatically.')) {
      await this.toggleAutomation();
    }
  }

  async emergencyStop() {
    if (confirm('EMERGENCY STOP: This will immediately halt all automation processing. Are you sure?')) {
      try {
        await api.post('/automation/stop');
        this.isAutomationEnabled = false;
        this.updateStatusBanner();
        this.updateControlPanel();
        showNotification('EMERGENCY STOP ACTIVATED', 'error');
        this.addActivityItem('Emergency stop activated', 'fas fa-exclamation-triangle');
      } catch (error) {
        console.error('Failed to emergency stop:', error);
        showNotification('Failed to emergency stop', 'error');
      }
    }
  }

  // Utility Methods
  updateStatusBanner() {
    const banner = document.getElementById('automation-status-banner');
    const toggle = document.getElementById('automation-toggle');
    
    if (banner) {
      banner.className = `status-banner ${this.isAutomationEnabled ? 'active' : 'inactive'}`;
      
      const statusText = banner.querySelector('.status-message');
      const statusIcon = banner.querySelector('.status-indicator i');
      
      if (statusText) {
        statusText.textContent = this.isAutomationEnabled 
          ? 'Automation is running - orders are being processed automatically'
          : 'Automation is stopped - orders require manual processing';
      }
      
      if (statusIcon) {
        statusIcon.className = this.isAutomationEnabled ? 'fas fa-circle' : 'fas fa-circle';
      }
    }
    
    if (toggle) {
      toggle.innerHTML = this.isAutomationEnabled 
        ? '<i class="fas fa-pause"></i> Stop'
        : '<i class="fas fa-play"></i> Start';
      toggle.className = this.isAutomationEnabled ? 'btn btn-warning' : 'btn btn-primary';
    }
  }

  updateConnectionStatus(service, status) {
    const statusElement = document.getElementById(`${service}-status`);
    if (statusElement) {
      statusElement.className = `connection-status ${status}`;
      statusElement.innerHTML = `<i class="fas fa-circle"></i> ${status.charAt(0).toUpperCase() + status.slice(1)}`;
    }
  }

  updateLastUpdateTime() {
    const lastUpdateElement = document.getElementById('last-update');
    if (lastUpdateElement) {
      lastUpdateElement.textContent = this.formatTime(new Date());
    }
  }

  formatTime(date) {
    if (!date) return 'Never';
    const now = new Date();
    const diff = now - new Date(date);
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(date).toLocaleDateString();
  }

  getTotalActiveOrders() {
    return Object.values(this.orderPipeline)
      .filter(stage => Array.isArray(stage))
      .reduce((total, stage) => total + stage.length, 0);
  }

  addActivityItem(message, icon = 'fas fa-info-circle') {
    const activityList = document.getElementById('activity-list');
    if (activityList) {
      const activityItem = document.createElement('div');
      activityItem.className = 'activity-item';
      activityItem.innerHTML = `
        <div class="activity-icon">
          <i class="${icon}"></i>
        </div>
        <div class="activity-content">
          <span class="activity-message">${message}</span>
          <span class="activity-time">${this.formatTime(new Date())}</span>
        </div>
      `;
      activityList.insertBefore(activityItem, activityList.firstChild);
      
      // Keep only last 10 items
      while (activityList.children.length > 10) {
        activityList.removeChild(activityList.lastChild);
      }
    }
  }

  // Event Handlers
  updateOrderInPipeline(data) {
    // Remove order from all stages
    Object.keys(this.orderPipeline).forEach(stage => {
      if (Array.isArray(this.orderPipeline[stage])) {
        this.orderPipeline[stage] = this.orderPipeline[stage].filter(
          order => order.orderId !== data.orderId
        );
      }
    });

    // Add order to new stage
    if (this.orderPipeline[data.stage] && Array.isArray(this.orderPipeline[data.stage])) {
      this.orderPipeline[data.stage].push({
        orderId: data.orderId,
        startTime: data.timestamp,
        lastUpdate: data.timestamp,
        attempts: 0
      });
    }

    // Update pipeline display
    this.updatePipelineDisplay();
    this.addActivityItem(`Order #${data.orderId.slice(-6)} moved to ${data.stage}`, 'fas fa-arrow-right');
  }

  updatePipelineDisplay() {
    // Re-render pipeline stages
    const stages = ['received', 'validated', 'synced', 'printed', 'complete', 'failed'];
    stages.forEach(stage => {
      const stageElement = document.getElementById(`orders-${stage}`);
      if (stageElement) {
        stageElement.innerHTML = this.renderStageOrders(this.orderPipeline[stage] || [], stage);
      }
      
      // Update stage count
      const countElement = document.querySelector(`[data-stage="${stage}"] .stage-count`);
      if (countElement) {
        countElement.textContent = this.orderPipeline[stage]?.length || 0;
      }
    });
  }

  updateControlPanel() {
    const controlPanel = document.querySelector('.automation-controls');
    if (controlPanel) {
      controlPanel.innerHTML = this.renderControlPanel().replace('<div class="automation-controls">', '').replace('</div>', '');
    }
  }

  updateMetricsDisplay() {
    const metricsPanel = document.querySelector('.automation-metrics .metrics-grid');
    if (metricsPanel) {
      metricsPanel.innerHTML = this.renderMetrics()
        .match(/<div class="metrics-grid">(.*?)<\/div>/s)[1];
    }
  }

  attachEventListeners() {
    // Attach any additional event listeners here
    this.updateLastUpdateTime();
  }

  startPeriodicUpdates() {
    // Refresh data every 30 seconds
    this.refreshInterval = setInterval(() => {
      this.refreshMetrics();
    }, this.settings.refreshInterval);
  }

  async refreshMetrics() {
    try {
      await Promise.all([
        this.loadOrderPipeline(),
        this.loadMetrics()
      ]);
      this.updateLastUpdateTime();
    } catch (error) {
      console.error('Failed to refresh metrics:', error);
    }
  }

  async refresh() {
    try {
      await Promise.all([
        this.loadAutomationStatus(),
        this.loadOrderPipeline(),
        this.loadMetrics()
      ]);
      this.renderDashboard();
      showNotification('Dashboard refreshed', 'success');
    } catch (error) {
      console.error('Failed to refresh dashboard:', error);
      showNotification('Failed to refresh dashboard', 'error');
    }
  }

  // Settings and Configuration
  showSettings() {
    document.getElementById('settings-modal').style.display = 'block';
  }

  async saveSettings() {
    // Implementation for saving settings
    showNotification('Settings saved', 'success');
    closeModal('settings-modal');
  }

  loadSettings() {
    // Load settings from localStorage or API
    const savedSettings = localStorage.getItem('automationSettings');
    if (savedSettings) {
      this.settings = { ...this.settings, ...JSON.parse(savedSettings) };
    }
  }

  // Test automation method
  async testAutomation() {
    try {
      if (this.socket && this.socket.connected) {
        // Use WebSocket for real-time test
        this.socket.emit('automation:test');
        showNotification('Test automation triggered - watch the pipeline for updates', 'info');
        this.addActivityItem('Test automation triggered', 'fas fa-flask');
      } else {
        // Fallback to HTTP API
        const response = await api.post('/automation/test');
        if (response.success) {
          showNotification('Test automation triggered', 'info');
          this.addActivityItem('Test automation triggered', 'fas fa-flask');
        }
      }
    } catch (error) {
      console.error('Failed to test automation:', error);
      showNotification('Failed to trigger test automation', 'error');
    }
  }

  // Placeholder methods for future implementation
  async manualSync() {
    showNotification('Manual sync initiated...', 'info');
    this.addActivityItem('Manual sync initiated', 'fas fa-sync');
  }

  async retryFailedOrders() {
    const failedOrders = this.orderPipeline.failed || [];
    if (failedOrders.length === 0) {
      showNotification('No failed orders to retry', 'info');
      return;
    }
    
    showNotification(`Retrying ${failedOrders.length} failed orders...`, 'info');
    this.addActivityItem(`Retrying ${failedOrders.length} failed orders`, 'fas fa-redo');
  }

  async printMissedReceipts() {
    showNotification('Printing missed receipts...', 'info');
    this.addActivityItem('Printing missed receipts', 'fas fa-print');
  }

  showOrderDetails(orderId) {
    this.currentOrderId = orderId;
    // Implementation for showing order details modal
    document.getElementById('order-details-modal').style.display = 'block';
  }

  showAnalytics() {
    // Implementation for showing analytics view
    showNotification('Analytics view coming soon...', 'info');
  }

  clearActivity() {
    const activityList = document.getElementById('activity-list');
    if (activityList) {
      activityList.innerHTML = '';
    }
  }

  // Cleanup
  destroy() {
    if (this.socket) {
      this.socket.disconnect();
    }
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }
}

// Global utility functions
function closeModal(modalId) {
  document.getElementById(modalId).style.display = 'none';
}

// Export for global access
window.AutomationDashboard = AutomationDashboard;

// Create global instance for immediate use
window.automationDashboard = null;