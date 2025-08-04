/**
 * Main Application Module
 * Coordinates all frontend modules and handles navigation
 */

class CardStoreApp {
    constructor() {
        this.currentView = 'dashboard';
        this.isInitialized = false;
        this.modules = {};
        
        this.initializeApp();
    }

    async initializeApp() {
        try {
            // Wait for DOM to be ready
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.init());
            } else {
                await this.init();
            }
        } catch (error) {
            console.error('Failed to initialize application:', error);
            this.showCriticalError('Application failed to initialize. Please refresh the page.');
        }
    }

    async init() {
        try {
            // Initialize modules
            this.initializeModules();
            
            // Set up navigation
            this.setupNavigation();
            
            // Set up global event listeners
            this.setupEventListeners();
            
            // Load initial data
            await this.loadInitialData();
            
            // Show initial view
            this.showView('dashboard');
            
            this.isInitialized = true;
            window.activityLogger.log('Application initialized successfully', 'success');
            
        } catch (error) {
            console.error('Initialization error:', error);
            this.showCriticalError('Failed to initialize application components.');
        }
    }

    initializeModules() {
        // Store references to modules
        this.modules = {
            wizard: window.onboardingWizard,
            health: window.healthDashboard,
            management: window.systemManagement,
            api: window.api,
            wsManager: window.wsManager,
            activityLogger: window.activityLogger
        };
    }

    setupNavigation() {
        // Set up navigation button handlers
        const navButtons = document.querySelectorAll('.nav-btn');
        navButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const view = button.dataset.view;
                if (view) {
                    this.showView(view);
                }
            });
        });
    }

    setupEventListeners() {
        // Global keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + R for refresh
            if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
                e.preventDefault();
                this.refreshCurrentView();
            }
            
            // Escape to close modals
            if (e.key === 'Escape') {
                this.closeAllModals();
            }
        });

        // Handle browser back/forward
        window.addEventListener('popstate', (e) => {
            if (e.state && e.state.view) {
                this.showView(e.state.view, false);
            }
        });

        // Handle WebSocket connection status
        this.modules.wsManager.on('connected', () => {
            this.updateConnectionStatus(true);
            window.activityLogger.log('Real-time connection established', 'success');
        });

        this.modules.wsManager.on('disconnected', () => {
            this.updateConnectionStatus(false);
            window.activityLogger.log('Real-time connection lost', 'warning');
        });

        this.modules.wsManager.on('error', (error) => {
            console.error('WebSocket error:', error);
            window.activityLogger.log('Real-time connection error', 'error');
        });

        // Handle activity log updates
        document.addEventListener('activity:activity', (event) => {
            this.updateActivityDisplay(event.detail);
        });

        // Handle window resize
        window.addEventListener('resize', () => {
            this.handleResize();
        });

        // Handle visibility change (tab switching)
        document.addEventListener('visibilitychange', () => {
            this.handleVisibilityChange();
        });
    }

    async loadInitialData() {
        try {
            // Load system status for dashboard
            await this.loadDashboardData();
            
        } catch (error) {
            console.error('Failed to load initial data:', error);
            window.activityLogger.log('Failed to load initial data', 'error');
        }
    }

    async loadDashboardData() {
        try {
            // Load basic health status
            const healthResult = await this.modules.api.safeRequest(() => 
                this.modules.api.getHealthStatus()
            );

            if (healthResult.success) {
                this.updateSystemStatus(healthResult.data);
            }

            // Load service status
            const serviceResult = await this.modules.api.safeRequest(() => 
                this.modules.api.getServiceStatus()
            );

            if (serviceResult.success) {
                this.updateServiceStatus(serviceResult.data);
            }

        } catch (error) {
            console.error('Failed to load dashboard data:', error);
        }
    }

    showView(viewName, updateHistory = true) {
        if (!this.isValidView(viewName)) {
            console.error('Invalid view:', viewName);
            return;
        }

        // Hide all views
        const views = document.querySelectorAll('.view');
        views.forEach(view => view.classList.remove('active'));

        // Show target view
        const targetView = document.getElementById(`${viewName}-view`);
        if (targetView) {
            targetView.classList.add('active');
        }

        // Update navigation
        this.updateNavigation(viewName);

        // Update browser history
        if (updateHistory) {
            const url = new URL(window.location);
            url.searchParams.set('view', viewName);
            history.pushState({ view: viewName }, '', url);
        }

        // Initialize view-specific functionality
        this.initializeView(viewName);

        this.currentView = viewName;
        window.activityLogger.log(`Switched to ${viewName} view`, 'info');
    }

    isValidView(viewName) {
        const validViews = ['dashboard', 'onboarding', 'health', 'management', 'shipping', 'users'];
        return validViews.includes(viewName);
    }

    updateNavigation(activeView) {
        const navButtons = document.querySelectorAll('.nav-btn');
        navButtons.forEach(button => {
            button.classList.remove('active');
            if (button.dataset.view === activeView) {
                button.classList.add('active');
            }
        });
    }

    async initializeView(viewName) {
        switch (viewName) {
            case 'dashboard':
                await this.initializeDashboard();
                break;
            case 'onboarding':
                await this.initializeOnboarding();
                break;
            case 'health':
                await this.initializeHealth();
                break;
            case 'management':
                await this.initializeManagement();
                break;
            case 'shipping':
                await this.initializeShipping();
                break;
            case 'users':
                await this.initializeUsers();
                break;
        }
    }

    async initializeDashboard() {
        // Refresh dashboard data
        await this.loadDashboardData();
        
        // Start periodic updates
        this.startDashboardUpdates();
    }

    async initializeOnboarding() {
        if (this.modules.wizard) {
            await this.modules.wizard.start();
        }
    }

    async initializeHealth() {
        if (this.modules.health) {
            await this.modules.health.initialize();
        }
    }

    async initializeManagement() {
        if (this.modules.management) {
            await this.modules.management.initialize();
        }
    }

    async initializeShipping() {
        try {
            // Load orders for shipping
            const ordersResult = await this.modules.api.safeRequest(() =>
                this.modules.api.getOrders('processing')
            );

            if (ordersResult.success) {
                this.updateOrdersList(ordersResult.data);
            } else {
                this.showOrdersError('Failed to load orders');
            }
        } catch (error) {
            console.error('Failed to initialize shipping view:', error);
            this.showOrdersError('Error loading shipping data');
        }
    }

    async initializeUsers() {
        // Initialize user management if userManager is available
        if (window.userManager) {
            // User manager will handle its own initialization
            return;
        }
        
        // Fallback: show loading message
        const usersTableBody = document.getElementById('usersTableBody');
        if (usersTableBody) {
            usersTableBody.innerHTML = '<div class="loading">Loading users...</div>';
        }
    }

    updateOrdersList(orders) {
        const ordersList = document.getElementById('orders-list');
        if (!ordersList) return;

        if (!orders || orders.length === 0) {
            ordersList.innerHTML = `
                <div class="empty-state">
                    <h3>No orders to process</h3>
                    <p>All orders have been processed or there are no pending orders.</p>
                </div>
            `;
            return;
        }

        ordersList.innerHTML = orders.map(order => `
            <div class="order-card">
                <div class="order-header">
                    <h4>Order ${order.orderNumber || order.id}</h4>
                    <span class="order-status ${order.status}">${order.status}</span>
                </div>
                <div class="order-details">
                    <p><strong>Total:</strong> $${order.totalPrice}</p>
                    <p><strong>Customer:</strong> ${order.channelData ? JSON.parse(order.channelData).customerName : 'N/A'}</p>
                    <p><strong>Created:</strong> ${new Date(order.createdAt).toLocaleDateString()}</p>
                </div>
                <div class="order-actions">
                    <button class="btn primary" onclick="createShippingLabel('${order.id}')">
                        <i class="fas fa-shipping-fast"></i>
                        Create Label
                    </button>
                    <button class="btn secondary" onclick="viewOrderDetails('${order.id}')">
                        <i class="fas fa-eye"></i>
                        View Details
                    </button>
                </div>
            </div>
        `).join('');
    }

    showOrdersError(message) {
        const ordersList = document.getElementById('orders-list');
        if (ordersList) {
            ordersList.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>Error Loading Orders</h3>
                    <p>${message}</p>
                    <button class="btn primary" onclick="window.cardStoreApp.initializeShipping()">
                        <i class="fas fa-sync"></i>
                        Retry
                    </button>
                </div>
            `;
        }
    }

    startDashboardUpdates() {
        // Update dashboard every 30 seconds
        if (this.dashboardInterval) {
            clearInterval(this.dashboardInterval);
        }

        this.dashboardInterval = setInterval(() => {
            if (this.currentView === 'dashboard' && !document.hidden) {
                this.loadDashboardData();
            }
        }, 30000);
    }

    stopDashboardUpdates() {
        if (this.dashboardInterval) {
            clearInterval(this.dashboardInterval);
            this.dashboardInterval = null;
        }
    }

    updateSystemStatus(healthData) {
        const systemStatusCard = document.getElementById('system-status');
        if (!systemStatusCard) return;

        const statusContent = systemStatusCard.querySelector('.status-content');
        if (!statusContent) return;

        let status = 'healthy';
        let message = 'All systems operational';

        if (healthData.status === 'unhealthy') {
            status = 'error';
            message = 'System issues detected';
        } else if (healthData.checks && Object.values(healthData.checks).some(check => 
            Array.isArray(check) ? check.some(c => c.status === 'warning') : check.status === 'warning'
        )) {
            status = 'warning';
            message = 'Some warnings detected';
        }

        statusContent.innerHTML = `
            <div class="status-indicator ${status}">
                <i class="fas ${status === 'healthy' ? 'fa-check-circle' : 
                              status === 'warning' ? 'fa-exclamation-triangle' : 'fa-times-circle'}"></i>
                ${message}
            </div>
        `;
    }

    updateServiceStatus(serviceData) {
        const servicesCard = document.getElementById('services-status');
        if (!servicesCard || !serviceData) return;

        const serviceList = servicesCard.querySelector('.service-list');
        if (!serviceList) return;

        const services = ['Application', 'Database', 'Redis'];
        
        serviceList.innerHTML = services.map(service => {
            const serviceInfo = serviceData.find(s => 
                s.name.toLowerCase().includes(service.toLowerCase()) ||
                service.toLowerCase().includes(s.name.toLowerCase())
            );
            
            const status = serviceInfo ? serviceInfo.status : 'error';
            const statusText = status === 'healthy' ? 'Online' : 'Offline';
            
            return `
                <div class="service-item">
                    <span>${service}</span>
                    <span class="status-badge ${status}">${statusText}</span>
                </div>
            `;
        }).join('');
    }

    updateActivityDisplay(activity) {
        const activityLog = document.getElementById('activity-log');
        if (!activityLog) return;

        const activityItem = document.createElement('div');
        activityItem.className = 'activity-item';
        activityItem.innerHTML = `
            <span class="activity-time">${activity.time}</span>
            <span class="activity-text">${activity.message}</span>
        `;

        // Add to top of list
        activityLog.insertBefore(activityItem, activityLog.firstChild);

        // Keep only latest 10 items
        while (activityLog.children.length > 10) {
            activityLog.removeChild(activityLog.lastChild);
        }
    }

    updateConnectionStatus(connected) {
        // Update connection indicator in UI
        const connectionIndicator = document.querySelector('.connection-status');
        if (connectionIndicator) {
            connectionIndicator.classList.toggle('connected', connected);
            connectionIndicator.classList.toggle('disconnected', !connected);
        }
    }

    refreshCurrentView() {
        window.activityLogger.log(`Refreshing ${this.currentView} view`, 'info');
        this.initializeView(this.currentView);
    }

    closeAllModals() {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            modal.classList.add('hidden');
        });

        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.classList.add('hidden');
        }
    }

    handleResize() {
        // Handle responsive layout changes
        const isMobile = window.innerWidth < 768;
        document.body.classList.toggle('mobile', isMobile);
    }

    handleVisibilityChange() {
        if (document.hidden) {
            // Page is hidden, pause updates
            this.stopDashboardUpdates();
        } else {
            // Page is visible, resume updates
            if (this.currentView === 'dashboard') {
                this.startDashboardUpdates();
                this.loadDashboardData();
            }
        }
    }

    showCriticalError(message) {
        const errorOverlay = document.createElement('div');
        errorOverlay.className = 'critical-error-overlay';
        errorOverlay.innerHTML = `
            <div class="critical-error-content">
                <i class="fas fa-exclamation-triangle"></i>
                <h2>Application Error</h2>
                <p>${message}</p>
                <button class="btn primary" onclick="window.location.reload()">
                    <i class="fas fa-sync"></i>
                    Reload Application
                </button>
            </div>
        `;
        
        document.body.appendChild(errorOverlay);
    }

    // Cleanup when page unloads
    cleanup() {
        this.stopDashboardUpdates();
        
        if (this.modules.wsManager) {
            this.modules.wsManager.disconnect();
        }
        
        if (this.modules.health) {
            this.modules.health.cleanup();
        }
    }
}

// Global utility functions
window.showView = (viewName) => {
    if (window.cardStoreApp) {
        window.cardStoreApp.showView(viewName);
    }
};

window.showLoading = (title = 'Loading...', message = 'Please wait...') => {
    const overlay = document.getElementById('loading-overlay');
    const titleElement = document.getElementById('loading-title');
    const messageElement = document.getElementById('loading-message');
    
    if (overlay) {
        if (titleElement) titleElement.textContent = title;
        if (messageElement) messageElement.textContent = message;
        overlay.classList.remove('hidden');
    }
};

window.hideLoading = () => {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.classList.add('hidden');
    }
};

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.cardStoreApp = new CardStoreApp();
});

// Handle page unload
window.addEventListener('beforeunload', () => {
    if (window.cardStoreApp) {
        window.cardStoreApp.cleanup();
    }
});

// Handle uncaught errors
window.addEventListener('error', (event) => {
    console.error('Uncaught error:', event.error);
    window.activityLogger.log(`Application error: ${event.error.message}`, 'error');
});

// Handle unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    window.activityLogger.log(`Promise rejection: ${event.reason}`, 'error');
});

// Export for debugging
window.CardStoreApp = CardStoreApp;