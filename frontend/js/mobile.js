/**
 * DeckStack Mobile Application - Phase 5
 * Mobile-optimized interface with PWA capabilities
 */

class DeckStackMobile {
    constructor() {
        this.currentView = 'dashboard';
        this.isOnline = navigator.onLine;
        this.offlineQueue = [];
        this.scanner = null;
        this.websocket = null;
        this.realTimeData = {};
        
        this.init();
    }
    
    async init() {
        this.setupEventListeners();
        this.setupNetworkMonitoring();
        this.setupServiceWorker();
        this.setupWebSocket();
        this.loadInitialData();
        this.startRealTimeUpdates();
        
        // Initialize scanner if supported
        if (this.isScannerSupported()) {
            await this.initializeScanner();
        }
        
        // Setup offline capabilities
        this.setupOfflineSupport();
        
        console.log('DeckStack Mobile initialized');
    }
    
    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.mobile-nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const view = item.dataset.view;
                this.navigateToView(view);
            });
        });
        
        // Drawer navigation
        document.querySelectorAll('.mobile-drawer-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const href = item.getAttribute('href');
                if (href && href.startsWith('#')) {
                    const view = href.substring(1);
                    this.navigateToView(view);
                    this.closeDrawer();
                }
            });
        });
        
        // Menu toggle
        const menuBtn = document.getElementById('mobileMenuBtn');
        const drawer = document.getElementById('mobileDrawer');
        const drawerClose = document.getElementById('drawerCloseBtn');
        
        menuBtn?.addEventListener('click', () => this.toggleDrawer());
        drawerClose?.addEventListener('click', () => this.closeDrawer());
        
        // Close drawer on backdrop click
        drawer?.addEventListener('click', (e) => {
            if (e.target === drawer) {
                this.closeDrawer();
            }
        });
        
        // Search functionality
        const searchBtn = document.getElementById('mobileSearchBtn');
        searchBtn?.addEventListener('click', () => this.showSearch());
        
        // Quick actions
        document.querySelectorAll('.quick-action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = btn.dataset.action;
                this.handleQuickAction(action);
            });
        });
        
        // Scanner controls
        const scannerBtn = document.querySelector('[data-view="scanner"]');
        const closeScannerBtn = document.getElementById('closeScannerBtn');
        
        scannerBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            this.startScanner();
        });
        
        closeScannerBtn?.addEventListener('click', () => this.stopScanner());
        
        // Refresh button
        const refreshBtn = document.getElementById('refreshDashboard');
        refreshBtn?.addEventListener('click', () => this.refreshDashboard());
        
        // FAB button
        const fab = document.getElementById('mobileFab');
        fab?.addEventListener('click', () => this.showQuickActions());
        
        // Pull to refresh
        this.setupPullToRefresh();
        
        // Touch gestures
        this.setupTouchGestures();
    }
    
    setupNetworkMonitoring() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.updateConnectionStatus();
            this.syncOfflineData();
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.updateConnectionStatus();
        });
        
        this.updateConnectionStatus();
    }
    
    updateConnectionStatus() {
        const statusIndicator = document.getElementById('statusIndicator');
        const statusText = document.getElementById('statusText');
        const connectionStatus = document.getElementById('connectionStatus');
        
        if (this.isOnline) {
            statusIndicator?.classList.remove('offline');
            statusIndicator?.classList.add('online');
            statusText.textContent = 'Online';
            connectionStatus?.classList.remove('offline');
        } else {
            statusIndicator?.classList.remove('online');
            statusIndicator?.classList.add('offline');
            statusText.textContent = 'Offline';
            connectionStatus?.classList.add('offline');
        }
    }
    
    async setupServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('/sw.js');
                console.log('Service Worker registered:', registration);
                
                // Listen for updates
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            this.showToast('App updated! Refresh to use the latest version.', 'info');
                        }
                    });
                });
            } catch (error) {
                console.error('Service Worker registration failed:', error);
            }
        }
    }
    
    setupWebSocket() {
        if (!this.isOnline) return;
        
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/analytics`;
        
        try {
            this.websocket = new WebSocket(wsUrl);
            
            this.websocket.onopen = () => {
                console.log('WebSocket connected');
            };
            
            this.websocket.onmessage = (event) => {
                const data = JSON.parse(event.data);
                this.handleRealTimeUpdate(data);
            };
            
            this.websocket.onclose = () => {
                console.log('WebSocket disconnected');
                // Attempt to reconnect after 5 seconds
                setTimeout(() => this.setupWebSocket(), 5000);
            };
            
            this.websocket.onerror = (error) => {
                console.error('WebSocket error:', error);
            };
        } catch (error) {
            console.error('WebSocket setup failed:', error);
        }
    }
    
    handleRealTimeUpdate(data) {
        switch (data.type) {
            case 'analytics_update':
                this.updateDashboardMetrics(data.data);
                break;
            case 'inventory_update':
                this.updateInventoryData(data.data);
                break;
            case 'order_update':
                this.updateOrderData(data.data);
                break;
            case 'initial_dashboard':
                this.loadDashboardData(data.data);
                break;
        }
    }
    
    async loadInitialData() {
        this.showLoading();
        
        try {
            // Load dashboard data
            if (this.currentView === 'dashboard') {
                await this.loadDashboardData();
            }
            
            // Load user preferences
            await this.loadUserPreferences();
            
        } catch (error) {
            console.error('Failed to load initial data:', error);
            this.showToast('Failed to load data. Please try again.', 'error');
        } finally {
            this.hideLoading();
        }
    }
    
    async loadDashboardData(data = null) {
        try {
            const dashboardData = data || await this.fetchDashboardData();
            
            // Update stats
            this.updateElement('todayOrders', dashboardData.liveMetrics?.ordersToday || 0);
            this.updateElement('todayRevenue', this.formatCurrency(dashboardData.liveMetrics?.revenueToday || 0));
            this.updateElement('lowStockItems', dashboardData.alerts?.length || 0);
            this.updateElement('activeUsers', dashboardData.liveMetrics?.activeUsers || 0);
            
            // Update recent activity
            this.updateRecentActivity(dashboardData.recentActivity || []);
            
        } catch (error) {
            console.error('Failed to load dashboard data:', error);
            if (this.isOnline) {
                this.showToast('Failed to load dashboard data', 'error');
            }
        }
    }
    
    async fetchDashboardData() {
        const response = await fetch('/api/v1/analytics/dashboard', {
            headers: {
                'Authorization': `Bearer ${this.getAuthToken()}`,
                'X-Tenant-ID': this.getTenantId()
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch dashboard data');
        }
        
        return response.json();
    }
    
    updateDashboardMetrics(metrics) {
        if (metrics.ordersToday !== undefined) {
            this.updateElement('todayOrders', metrics.ordersToday);
        }
        if (metrics.revenueToday !== undefined) {
            this.updateElement('todayRevenue', this.formatCurrency(metrics.revenueToday));
        }
        if (metrics.activeUsers !== undefined) {
            this.updateElement('activeUsers', metrics.activeUsers);
        }
    }
    
    updateRecentActivity(activities) {
        const container = document.getElementById('recentActivity');
        if (!container) return;
        
        container.innerHTML = '';
        
        activities.slice(0, 5).forEach(activity => {
            const item = document.createElement('div');
            item.className = 'activity-item';
            item.innerHTML = `
                <div class="activity-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <circle cx="12" cy="12" r="3"/>
                    </svg>
                </div>
                <div class="activity-content">
                    <div class="activity-title">${activity.title}</div>
                    <div class="activity-time">${this.formatTimeAgo(activity.timestamp)}</div>
                </div>
            `;
            container.appendChild(item);
        });
    }
    
    navigateToView(viewName) {
        // Hide all views
        document.querySelectorAll('.mobile-view').forEach(view => {
            view.classList.remove('active');
        });
        
        // Show target view
        const targetView = document.getElementById(`${viewName}View`);
        if (targetView) {
            targetView.classList.add('active');
            this.currentView = viewName;
            
            // Update navigation
            document.querySelectorAll('.mobile-nav-item').forEach(item => {
                item.classList.remove('active');
            });
            
            const activeNavItem = document.querySelector(`[data-view="${viewName}"]`);
            if (activeNavItem) {
                activeNavItem.classList.add('active');
            }
            
            // Load view-specific data
            this.loadViewData(viewName);
        }
    }
    
    async loadViewData(viewName) {
        switch (viewName) {
            case 'dashboard':
                await this.loadDashboardData();
                break;
            case 'inventory':
                await this.loadInventoryData();
                break;
            case 'orders':
                await this.loadOrdersData();
                break;
            case 'analytics':
                await this.loadAnalyticsData();
                break;
        }
    }
    
    async loadInventoryData() {
        try {
            const response = await fetch('/api/v1/inventory?limit=20', {
                headers: {
                    'Authorization': `Bearer ${this.getAuthToken()}`,
                    'X-Tenant-ID': this.getTenantId()
                }
            });
            
            if (!response.ok) throw new Error('Failed to fetch inventory');
            
            const data = await response.json();
            this.renderInventoryList(data.items || []);
            
        } catch (error) {
            console.error('Failed to load inventory:', error);
            this.showToast('Failed to load inventory', 'error');
        }
    }
    
    renderInventoryList(items) {
        const container = document.getElementById('inventoryList');
        if (!container) return;
        
        container.innerHTML = '';
        
        items.forEach(item => {
            const element = document.createElement('div');
            element.className = 'mobile-card';
            element.innerHTML = `
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <div style="flex: 1;">
                        <div style="font-weight: 600; margin-bottom: 0.25rem;">${item.variant?.title || 'Unknown Product'}</div>
                        <div style="font-size: 0.875rem; color: var(--mobile-text-secondary);">
                            SKU: ${item.variant?.sku || 'N/A'}
                        </div>
                        <div style="font-size: 0.875rem; color: var(--mobile-text-secondary);">
                            On Hand: ${item.onHand || 0} | Available: ${(item.onHand || 0) - (item.reserved || 0)}
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-weight: 600;">${this.formatCurrency(item.variant?.price || 0)}</div>
                        <div style="font-size: 0.875rem; color: ${(item.onHand || 0) <= (item.safetyStock || 0) ? 'var(--mobile-error)' : 'var(--mobile-success)'};">
                            ${(item.onHand || 0) <= (item.safetyStock || 0) ? 'Low Stock' : 'In Stock'}
                        </div>
                    </div>
                </div>
            `;
            
            element.addEventListener('click', () => this.showInventoryDetails(item));
            container.appendChild(element);
        });
    }
    
    async loadOrdersData() {
        try {
            const response = await fetch('/api/v1/orders?limit=20&status=pending,processing', {
                headers: {
                    'Authorization': `Bearer ${this.getAuthToken()}`,
                    'X-Tenant-ID': this.getTenantId()
                }
            });
            
            if (!response.ok) throw new Error('Failed to fetch orders');
            
            const data = await response.json();
            this.renderOrdersList(data.orders || []);
            
        } catch (error) {
            console.error('Failed to load orders:', error);
            this.showToast('Failed to load orders', 'error');
        }
    }
    
    renderOrdersList(orders) {
        const container = document.getElementById('ordersList');
        if (!container) return;
        
        container.innerHTML = '';
        
        orders.forEach(order => {
            const element = document.createElement('div');
            element.className = 'mobile-card';
            element.innerHTML = `
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <div style="flex: 1;">
                        <div style="font-weight: 600; margin-bottom: 0.25rem;">Order #${order.orderNumber}</div>
                        <div style="font-size: 0.875rem; color: var(--mobile-text-secondary);">
                            ${order.customer?.name || 'Guest'} • ${this.formatTimeAgo(order.createdAt)}
                        </div>
                        <div style="font-size: 0.875rem; color: var(--mobile-text-secondary);">
                            ${order.lineItems?.length || 0} items
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-weight: 600;">${this.formatCurrency(order.totalPrice || 0)}</div>
                        <div style="font-size: 0.875rem; padding: 0.25rem 0.5rem; border-radius: 4px; background: ${this.getStatusColor(order.status)}; color: white;">
                            ${order.status || 'Unknown'}
                        </div>
                    </div>
                </div>
            `;
            
            element.addEventListener('click', () => this.showOrderDetails(order));
            container.appendChild(element);
        });
    }
    
    toggleDrawer() {
        const drawer = document.getElementById('mobileDrawer');
        drawer?.classList.toggle('open');
    }
    
    closeDrawer() {
        const drawer = document.getElementById('mobileDrawer');
        drawer?.classList.remove('open');
    }
    
    showSearch() {
        // Implement search functionality
        this.showToast('Search functionality coming soon!', 'info');
    }
    
    handleQuickAction(action) {
        switch (action) {
            case 'scan':
                this.startScanner();
                break;
            case 'add-inventory':
                this.showAddInventoryModal();
                break;
            case 'process-orders':
                this.navigateToView('orders');
                break;
            case 'view-analytics':
                this.navigateToView('analytics');
                break;
            default:
                this.showToast(`${action} functionality coming soon!`, 'info');
        }
    }
    
    async startScanner() {
        if (!this.isScannerSupported()) {
            this.showToast('Camera not supported on this device', 'error');
            return;
        }
        
        try {
            const scannerContainer = document.getElementById('scannerContainer');
            scannerContainer?.classList.add('active');
            
            if (this.scanner) {
                await this.scanner.start();
            }
            
        } catch (error) {
            console.error('Failed to start scanner:', error);
            this.showToast('Failed to start camera', 'error');
        }
    }
    
    async stopScanner() {
        try {
            const scannerContainer = document.getElementById('scannerContainer');
            scannerContainer?.classList.remove('active');
            
            if (this.scanner) {
                await this.scanner.stop();
            }
            
        } catch (error) {
            console.error('Failed to stop scanner:', error);
        }
    }
    
    async initializeScanner() {
        try {
            // Scanner will be initialized by scanner.js
            console.log('Scanner initialization delegated to scanner.js');
        } catch (error) {
            console.error('Failed to initialize scanner:', error);
        }
    }
    
    isScannerSupported() {
        return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    }
    
    setupPullToRefresh() {
        let startY = 0;
        let currentY = 0;
        let isPulling = false;
        
        document.addEventListener('touchstart', (e) => {
            if (window.scrollY === 0) {
                startY = e.touches[0].clientY;
                isPulling = true;
            }
        });
        
        document.addEventListener('touchmove', (e) => {
            if (!isPulling) return;
            
            currentY = e.touches[0].clientY;
            const pullDistance = currentY - startY;
            
            if (pullDistance > 100) {
                // Show pull to refresh indicator
                this.showPullToRefreshIndicator();
            }
        });
        
        document.addEventListener('touchend', () => {
            if (isPulling && currentY - startY > 100) {
                this.refreshCurrentView();
            }
            isPulling = false;
            this.hidePullToRefreshIndicator();
        });
    }
    
    setupTouchGestures() {
        // Implement swipe gestures for navigation
        let startX = 0;
        let startY = 0;
        
        document.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        });
        
        document.addEventListener('touchend', (e) => {
            const endX = e.changedTouches[0].clientX;
            const endY = e.changedTouches[0].clientY;
            
            const deltaX = endX - startX;
            const deltaY = endY - startY;
            
            // Horizontal swipe
            if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
                if (deltaX > 0) {
                    // Swipe right - open drawer
                    if (startX < 50) {
                        this.toggleDrawer();
                    }
                } else {
                    // Swipe left - close drawer
                    this.closeDrawer();
                }
            }
        });
    }
    
    setupOfflineSupport() {
        // Listen for offline actions
        document.addEventListener('offline-action', (e) => {
            this.queueOfflineAction(e.detail);
        });
    }
    
    queueOfflineAction(action) {
        this.offlineQueue.push({
            ...action,
            timestamp: new Date().toISOString()
        });
        
        // Store in localStorage
        localStorage.setItem('deckstack_offline_queue', JSON.stringify(this.offlineQueue));
    }
    
    async syncOfflineData() {
        if (!this.isOnline || this.offlineQueue.length === 0) return;
        
        const queue = [...this.offlineQueue];
        this.offlineQueue = [];
        
        for (const action of queue) {
            try {
                await this.processOfflineAction(action);
            } catch (error) {
                console.error('Failed to sync offline action:', error);
                // Re-queue failed actions
                this.offlineQueue.push(action);
            }
        }
        
        // Update localStorage
        localStorage.setItem('deckstack_offline_queue', JSON.stringify(this.offlineQueue));
        
        if (queue.length > 0) {
            this.showToast(`Synced ${queue.length} offline actions`, 'success');
        }
    }
    
    async processOfflineAction(action) {
        switch (action.type) {
            case 'inventory_update':
                await this.syncInventoryUpdate(action.data);
                break;
            case 'scan_result':
                await this.syncScanResult(action.data);
                break;
            default:
                console.warn('Unknown offline action type:', action.type);
        }
    }
    
    startRealTimeUpdates() {
        // Update dashboard every 30 seconds
        setInterval(() => {
            if (this.isOnline && this.currentView === 'dashboard') {
                this.loadDashboardData();
            }
        }, 30000);
    }
    
    async refreshCurrentView() {
        await this.loadViewData(this.currentView);
        this.showToast('Refreshed', 'success');
    }
    
    async refreshDashboard() {
        await this.loadDashboardData();
        this.showToast('Dashboard refreshed', 'success');
    }
    
    showLoading() {
        const overlay = document.getElementById('loadingOverlay');
        overlay?.classList.add('active');
    }
    
    hideLoading() {
        const overlay = document.getElementById('loadingOverlay');
        overlay?.classList.remove('active');
    }
    
    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        if (!container) return;
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        container.appendChild(toast);
        
        // Trigger animation
        setTimeout(() => toast.classList.add('show'), 100);
        
        // Remove after 3 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => container.removeChild(toast), 300);
        }, 3000);
    }
    
    showPullToRefreshIndicator() {
        // Implement pull to refresh visual indicator
    }
    
    hidePullToRefreshIndicator() {
        // Hide pull to refresh visual indicator
    }
    
    showQuickActions() {
        // Show quick action menu
        this.showToast('Quick actions menu coming soon!', 'info');
    }
    
    showInventoryDetails(item) {
        // Show inventory item details modal
        this.showToast(`Viewing ${item.variant?.title || 'item'}`, 'info');
    }
    
    showOrderDetails(order) {
        // Show order details modal
        this.showToast(`Viewing order #${order.orderNumber}`, 'info');
    }
    
    showAddInventoryModal() {
        // Show add inventory modal
        this.showToast('Add inventory modal coming soon!', 'info');
    }
    
    // Utility methods
    updateElement(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }
    
    formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    }
    
    formatTimeAgo(timestamp) {
        const now = new Date();
        const time = new Date(timestamp);
        const diffInSeconds = Math.floor((now - time) / 1000);
        
        if (diffInSeconds < 60) return 'Just now';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
        return `${Math.floor(diffInSeconds / 86400)}d ago`;
    }
    
    getStatusColor(status) {
        const colors = {
            pending: '#f59e0b',
            processing: '#2563eb',
            fulfilled: '#10b981',
            cancelled: '#ef4444'
        };
        return colors[status] || '#6b7280';
    }
    
    getAuthToken() {
        return localStorage.getItem('auth_token') || '';
    }
    
    getTenantId() {
        return localStorage.getItem('tenant_id') || '';
    }
    
    async loadUserPreferences() {
        try {
            const prefs = localStorage.getItem('user_preferences');
            if (prefs) {
                this.userPreferences = JSON.parse(prefs);
            }
        } catch (error) {
            console.error('Failed to load user preferences:', error);
        }
    }
    
    async loadAnalyticsData() {
        // Implement analytics data loading
        this.showToast('Analytics view coming soon!', 'info');
    }
}

// Initialize mobile app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.deckStackMobile = new DeckStackMobile();
});

// Handle app installation prompt
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    
    // Show install button or banner
    console.log('App can be installed');
});

// Handle successful app installation
window.addEventListener('appinstalled', () => {
    console.log('App installed successfully');
    deferredPrompt = null;
});