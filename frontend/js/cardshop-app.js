/**
 * Card Shop Owner Focused Application
 * Simplified interface for non-technical users
 */

class CardShopApp {
    constructor() {
        this.currentView = 'welcome';
        this.setupProgress = {
            connect: false,
            inventory: false,
            selling: false
        };
        this.storeConnection = null;
        
        this.initializeApp();
    }

    async initializeApp() {
        try {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.init());
            } else {
                await this.init();
            }
        } catch (error) {
            console.error('Failed to initialize card shop app:', error);
            this.showError('Something went wrong. Please refresh the page and try again.');
        }
    }

    async init() {
        try {
            // Set up navigation and event listeners
            this.setupEventListeners();
            
            // Check if user has already completed setup
            await this.checkSetupStatus();
            
            // Update UI based on current state
            this.updateSetupSteps();
            
            console.log('Card shop app initialized successfully');
            
        } catch (error) {
            console.error('Initialization error:', error);
            this.showError('Failed to load your store information. Please try refreshing the page.');
        }
    }

    setupEventListeners() {
        // Global event listeners
        document.addEventListener('click', (e) => {
            // Handle dynamic button clicks
            if (e.target.matches('[onclick]')) {
                return; // Let onclick handlers work
            }
        });

        // Handle escape key to close modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideLoading();
            }
        });
    }

    async checkSetupStatus() {
        try {
            // Check if store is already connected
            const result = await window.api?.safeRequest(() => 
                window.api.getSetupStatus()
            );

            if (result?.success && result.data) {
                this.setupProgress = result.data;
                
                // If setup is complete, show success view
                if (this.setupProgress.connect && this.setupProgress.inventory) {
                    this.showView('success');
                }
            }
        } catch (error) {
            console.log('No previous setup found, starting fresh');
        }
    }

    showView(viewName) {
        // Hide all views
        const views = document.querySelectorAll('.view');
        views.forEach(view => view.classList.remove('active'));

        // Show target view
        const targetView = document.getElementById(`${viewName}-view`);
        if (targetView) {
            targetView.classList.add('active');
            this.currentView = viewName;
        }

        // Update browser URL without page reload
        const url = new URL(window.location);
        url.searchParams.set('view', viewName);
        history.pushState({ view: viewName }, '', url);
    }

    updateSetupSteps() {
        const steps = document.querySelectorAll('.setup-step');
        
        steps.forEach((step, index) => {
            const stepNumber = index + 1;
            const stepData = step.dataset.step;
            
            // Remove all status classes
            step.classList.remove('active', 'completed');
            
            // Update based on progress
            if (this.setupProgress.connect && stepNumber === 1) {
                step.classList.add('completed');
                step.querySelector('button').disabled = false;
            } else if (this.setupProgress.inventory && stepNumber === 2) {
                step.classList.add('completed');
                step.querySelector('button').disabled = false;
            } else if (this.setupProgress.selling && stepNumber === 3) {
                step.classList.add('completed');
            } else if (!this.setupProgress.connect && stepNumber === 1) {
                step.classList.add('active');
                step.querySelector('button').disabled = false;
            } else if (this.setupProgress.connect && !this.setupProgress.inventory && stepNumber === 2) {
                step.classList.add('active');
                step.querySelector('button').disabled = false;
            } else if (this.setupProgress.connect && this.setupProgress.inventory && !this.setupProgress.selling && stepNumber === 3) {
                step.classList.add('active');
                step.querySelector('button').disabled = false;
            }
        });
    }

    // Setup Flow Functions
    startSetup(type) {
        switch (type) {
            case 'connect':
                this.showView('connect');
                break;
            case 'inventory':
                this.startInventorySetup();
                break;
            case 'selling':
                this.startSellingSetup();
                break;
        }
    }

    connectShopify() {
        this.showView('shopify-connect');
    }

    async connectToShopify() {
        const storeUrl = document.getElementById('shopify-url')?.value;
        
        if (!storeUrl || storeUrl.trim() === '') {
            this.showError('Please enter your Shopify store name');
            return;
        }

        // Validate store URL format
        if (!/^[a-zA-Z0-9-]+$/.test(storeUrl)) {
            this.showError('Store name can only contain letters, numbers, and hyphens');
            return;
        }

        this.showLoading('Connecting to your Shopify store...', 'This may take a few moments while we verify your store.');

        try {
            // Simulate API call to connect Shopify
            const result = await this.simulateShopifyConnection(storeUrl);
            
            if (result.success) {
                this.setupProgress.connect = true;
                this.storeConnection = {
                    type: 'shopify',
                    url: `${storeUrl}.myshopify.com`,
                    connected: true
                };
                
                this.hideLoading();
                this.showView('success');
                this.updateSetupSteps();
            } else {
                this.hideLoading();
                this.showError(result.error || 'Failed to connect to your Shopify store. Please check your store name and try again.');
            }
        } catch (error) {
            this.hideLoading();
            this.showError('Connection failed. Please check your internet connection and try again.');
        }
    }

    async simulateShopifyConnection(storeUrl) {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Simulate success for demo purposes
        return {
            success: true,
            data: {
                store: storeUrl,
                products: 150,
                collections: 12
            }
        };
    }

    createNewStore() {
        this.showLoading('Setting up your new store...', 'We\'re creating everything you need to start selling online.');
        
        setTimeout(() => {
            this.setupProgress.connect = true;
            this.storeConnection = {
                type: 'new',
                url: 'your-new-store.cardstore.com',
                connected: true
            };
            
            this.hideLoading();
            this.showView('success');
            this.updateSetupSteps();
        }, 3000);
    }

    setupInventoryOnly() {
        this.showLoading('Setting up inventory tracking...', 'Preparing your inventory management system.');
        
        setTimeout(() => {
            this.setupProgress.connect = true;
            this.storeConnection = {
                type: 'inventory-only',
                connected: true
            };
            
            this.hideLoading();
            this.showView('success');
            this.updateSetupSteps();
        }, 2000);
    }

    startInventorySetup() {
        // This would typically open an inventory management interface
        this.showInfo('Inventory Setup', 'This feature will help you add and manage your card inventory. Coming soon!');
    }

    startSellingSetup() {
        // This would typically open selling configuration
        this.showInfo('Selling Setup', 'This feature will help you configure your selling channels. Coming soon!');
    }

    goToDashboard() {
        // This would typically redirect to the main dashboard
        this.showInfo('Dashboard', 'Your main dashboard is being prepared. This will show your sales, inventory, and performance metrics.');
    }

    addMoreCards() {
        // This would typically open the inventory addition interface
        this.showInfo('Add Cards', 'The card addition interface will help you quickly add new inventory to your store.');
    }

    // Utility Functions
    showLoading(title = 'Loading...', message = 'Please wait...') {
        const overlay = document.getElementById('loading-overlay');
        const titleElement = document.getElementById('loading-title');
        const messageElement = document.getElementById('loading-message');
        
        if (overlay) {
            if (titleElement) titleElement.textContent = title;
            if (messageElement) messageElement.textContent = message;
            overlay.classList.remove('hidden');
        }
    }

    hideLoading() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.classList.add('hidden');
        }
    }

    showError(message) {
        // Create a simple error notification
        this.showNotification(message, 'error');
    }

    showInfo(title, message) {
        // Create a simple info notification
        this.showNotification(`${title}: ${message}`, 'info');
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas ${type === 'error' ? 'fa-exclamation-triangle' : 'fa-info-circle'}"></i>
                <span>${message}</span>
                <button class="notification-close" onclick="this.parentElement.parentElement.remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        // Add to page
        document.body.appendChild(notification);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);

        // Add styles if not already present
        if (!document.querySelector('#notification-styles')) {
            const styles = document.createElement('style');
            styles.id = 'notification-styles';
            styles.textContent = `
                .notification {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 1001;
                    max-width: 400px;
                    background: white;
                    border-radius: 8px;
                    box-shadow: 0 10px 25px rgba(0,0,0,0.1);
                    border-left: 4px solid var(--info-color);
                    animation: slideIn 0.3s ease-out;
                }
                .notification-error {
                    border-left-color: var(--danger-color);
                }
                .notification-content {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 16px;
                }
                .notification-content i:first-child {
                    color: var(--info-color);
                    font-size: 1.25rem;
                }
                .notification-error .notification-content i:first-child {
                    color: var(--danger-color);
                }
                .notification-content span {
                    flex: 1;
                    color: var(--text-primary);
                }
                .notification-close {
                    background: none;
                    border: none;
                    color: var(--text-muted);
                    cursor: pointer;
                    padding: 4px;
                    border-radius: 4px;
                }
                .notification-close:hover {
                    background: var(--gray-100);
                }
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `;
            document.head.appendChild(styles);
        }
    }

    // Handle browser back/forward
    handlePopState(event) {
        if (event.state && event.state.view) {
            this.showView(event.state.view);
        }
    }
}

// Global functions for onclick handlers
window.startSetup = (type) => {
    if (window.cardShopApp) {
        window.cardShopApp.startSetup(type);
    }
};

window.showView = (viewName) => {
    if (window.cardShopApp) {
        window.cardShopApp.showView(viewName);
    }
};

window.connectShopify = () => {
    if (window.cardShopApp) {
        window.cardShopApp.connectShopify();
    }
};

window.connectToShopify = () => {
    if (window.cardShopApp) {
        window.cardShopApp.connectToShopify();
    }
};

window.createNewStore = () => {
    if (window.cardShopApp) {
        window.cardShopApp.createNewStore();
    }
};

window.setupInventoryOnly = () => {
    if (window.cardShopApp) {
        window.cardShopApp.setupInventoryOnly();
    }
};

window.goToDashboard = () => {
    if (window.cardShopApp) {
        window.cardShopApp.goToDashboard();
    }
};

window.addMoreCards = () => {
    if (window.cardShopApp) {
        window.cardShopApp.addMoreCards();
    }
};

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.cardShopApp = new CardShopApp();
});

// Handle browser navigation
window.addEventListener('popstate', (event) => {
    if (window.cardShopApp) {
        window.cardShopApp.handlePopState(event);
    }
});

// Handle page unload
window.addEventListener('beforeunload', () => {
    // Cleanup if needed
});

// Export for debugging
window.CardShopApp = CardShopApp;