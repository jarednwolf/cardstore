/**
 * DeckStack Billing Management
 * Handles subscription plans, payments, and billing portal
 */

class BillingManager {
    constructor() {
        this.stripe = null;
        this.currentSubscription = null;
        this.plans = [];
        this.baseURL = this.getBaseURL();
        
        this.initializeStripe();
        this.loadBillingData();
    }

    getBaseURL() {
        const protocol = window.location.protocol;
        const hostname = window.location.hostname;
        
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            const port = window.location.port || '3005';
            return `${protocol}//${hostname}:${port}`;
        }
        
        return window.location.origin;
    }

    async initializeStripe() {
        try {
            // Load Stripe.js
            if (typeof Stripe === 'undefined') {
                console.warn('Stripe.js not loaded');
                return;
            }
            
            // Initialize with publishable key (you'll need to set this)
            const publishableKey = window.STRIPE_PUBLISHABLE_KEY || 'pk_test_...'; // Replace with your key
            this.stripe = Stripe(publishableKey);
        } catch (error) {
            console.error('Failed to initialize Stripe:', error);
        }
    }

    async loadBillingData() {
        try {
            const response = await this.apiRequest('/api/v1/billing/subscription');
            
            if (response.data) {
                this.currentSubscription = response.data.subscription;
                this.plans = response.data.plans;
                this.updateBillingUI();
            }
        } catch (error) {
            console.error('Failed to load billing data:', error);
            this.showError('Failed to load billing information');
        }
    }

    async subscribeToPlan(planId) {
        if (!this.stripe) {
            this.showError('Payment system not available');
            return;
        }

        try {
            this.showLoading('Creating subscription...');
            
            const response = await this.apiRequest('/api/v1/billing/subscribe', {
                method: 'POST',
                body: JSON.stringify({ planId })
            });

            if (response.data && response.data.clientSecret) {
                // Redirect to Stripe Checkout or handle payment
                const { error } = await this.stripe.confirmPayment({
                    clientSecret: response.data.clientSecret,
                    confirmParams: {
                        return_url: `${window.location.origin}/dashboard.html?payment=success`,
                    },
                });

                if (error) {
                    this.showError(`Payment failed: ${error.message}`);
                } else {
                    this.showSuccess('Subscription created successfully!');
                    await this.loadBillingData();
                }
            } else {
                this.showError('Failed to create subscription');
            }
        } catch (error) {
            console.error('Subscription error:', error);
            this.showError('Failed to create subscription');
        } finally {
            this.hideLoading();
        }
    }

    async updateSubscription(planId) {
        try {
            this.showLoading('Updating subscription...');
            
            const response = await this.apiRequest('/api/v1/billing/subscription', {
                method: 'PUT',
                body: JSON.stringify({ planId })
            });

            if (response.data) {
                this.showSuccess('Subscription updated successfully!');
                await this.loadBillingData();
            }
        } catch (error) {
            console.error('Update subscription error:', error);
            this.showError('Failed to update subscription');
        } finally {
            this.hideLoading();
        }
    }

    async cancelSubscription() {
        if (!confirm('Are you sure you want to cancel your subscription? You will lose access to premium features at the end of your billing period.')) {
            return;
        }

        try {
            this.showLoading('Canceling subscription...');
            
            const response = await this.apiRequest('/api/v1/billing/subscription', {
                method: 'DELETE'
            });

            if (response.data) {
                this.showSuccess('Subscription canceled. You will retain access until the end of your billing period.');
                await this.loadBillingData();
            }
        } catch (error) {
            console.error('Cancel subscription error:', error);
            this.showError('Failed to cancel subscription');
        } finally {
            this.hideLoading();
        }
    }

    async openBillingPortal() {
        try {
            this.showLoading('Opening billing portal...');
            
            const response = await this.apiRequest('/api/v1/billing/portal', {
                method: 'POST'
            });

            if (response.data && response.data.url) {
                window.location.href = response.data.url;
            }
        } catch (error) {
            console.error('Billing portal error:', error);
            this.showError('Failed to open billing portal');
        } finally {
            this.hideLoading();
        }
    }

    updateBillingUI() {
        this.renderPricingCards();
        this.renderCurrentSubscription();
        this.renderUsageStats();
    }

    renderPricingCards() {
        const container = document.getElementById('pricing-cards');
        if (!container) return;

        container.innerHTML = this.plans.map(plan => `
            <div class="pricing-card ${this.currentSubscription?.planId === plan.id ? 'current' : ''}">
                <div class="plan-header">
                    <h3>${plan.name}</h3>
                    <div class="price">
                        $${(plan.price / 100).toFixed(0)}
                        <span class="period">/${plan.interval}</span>
                    </div>
                    ${plan.name.includes('Beta') ? '<div class="beta-badge">50% OFF Beta Pricing</div>' : ''}
                </div>
                
                <ul class="features-list">
                    ${plan.features.map(feature => `<li><i class="fas fa-check"></i> ${feature}</li>`).join('')}
                </ul>
                
                <div class="plan-actions">
                    ${this.renderPlanButton(plan)}
                </div>
            </div>
        `).join('');
    }

    renderPlanButton(plan) {
        if (!this.currentSubscription || !this.currentSubscription.stripeSubscriptionId) {
            return `<button class="btn btn-primary" onclick="billingManager.subscribeToPlan('${plan.id}')">
                Start Free Trial
            </button>`;
        }

        if (this.currentSubscription.planId === plan.id) {
            return `<button class="btn btn-secondary" disabled>Current Plan</button>`;
        }

        const currentPlan = this.plans.find(p => p.id === this.currentSubscription.planId);
        const isUpgrade = plan.price > (currentPlan?.price || 0);
        
        return `<button class="btn ${isUpgrade ? 'btn-primary' : 'btn-outline'}" 
                        onclick="billingManager.updateSubscription('${plan.id}')">
            ${isUpgrade ? 'Upgrade' : 'Downgrade'}
        </button>`;
    }

    renderCurrentSubscription() {
        const container = document.getElementById('current-subscription');
        if (!container) return;

        if (!this.currentSubscription || !this.currentSubscription.stripeSubscriptionId) {
            container.innerHTML = `
                <div class="subscription-status">
                    <h3>No Active Subscription</h3>
                    <p>Choose a plan to get started with DeckStack's premium features.</p>
                </div>
            `;
            return;
        }

        const plan = this.plans.find(p => p.id === this.currentSubscription.planId);
        const status = this.currentSubscription.subscriptionStatus || 'unknown';
        
        container.innerHTML = `
            <div class="subscription-status">
                <h3>Current Subscription</h3>
                <div class="subscription-details">
                    <div class="plan-info">
                        <h4>${plan?.name || 'Unknown Plan'}</h4>
                        <p class="price">$${plan ? (plan.price / 100).toFixed(0) : '0'}/month</p>
                        <span class="status status-${status}">${status.charAt(0).toUpperCase() + status.slice(1)}</span>
                    </div>
                    
                    ${this.currentSubscription.currentPeriodEnd ? `
                        <div class="billing-info">
                            <p><strong>Next billing date:</strong> ${new Date(this.currentSubscription.currentPeriodEnd).toLocaleDateString()}</p>
                        </div>
                    ` : ''}
                    
                    ${this.currentSubscription.cancelAtPeriodEnd ? `
                        <div class="cancellation-notice">
                            <i class="fas fa-exclamation-triangle"></i>
                            Your subscription will be canceled at the end of the current billing period.
                        </div>
                    ` : ''}
                </div>
                
                <div class="subscription-actions">
                    <button class="btn btn-outline" onclick="billingManager.openBillingPortal()">
                        <i class="fas fa-credit-card"></i> Manage Billing
                    </button>
                    ${!this.currentSubscription.cancelAtPeriodEnd ? `
                        <button class="btn btn-danger-outline" onclick="billingManager.cancelSubscription()">
                            <i class="fas fa-times"></i> Cancel Subscription
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }

    renderUsageStats() {
        const container = document.getElementById('usage-stats');
        if (!container) return;

        // This would be populated with actual usage data
        const usage = {
            users: 0,
            products: 0,
            orders: 0,
            apiCalls: 0
        };

        container.innerHTML = `
            <div class="usage-stats">
                <h3>Usage This Month</h3>
                <div class="stats-grid">
                    <div class="stat-item">
                        <div class="stat-value">${usage.users}</div>
                        <div class="stat-label">Team Members</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${usage.products}</div>
                        <div class="stat-label">Products</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${usage.orders}</div>
                        <div class="stat-label">Orders</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${usage.apiCalls}</div>
                        <div class="stat-label">API Calls</div>
                    </div>
                </div>
            </div>
        `;
    }

    async apiRequest(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('deckstack_token')}`,
                ...options.headers
            },
            ...options
        };

        const response = await fetch(url, config);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error?.message || `HTTP ${response.status}: ${response.statusText}`);
        }

        return data;
    }

    showLoading(message = 'Processing...') {
        const overlay = document.getElementById('loading-overlay');
        const messageEl = document.getElementById('loading-message');
        
        if (overlay) {
            if (messageEl) messageEl.textContent = message;
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
        this.showNotification(message, 'error');
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showNotification(message, type = 'info') {
        // Remove existing notifications
        const existing = document.querySelector('.notification');
        if (existing) {
            existing.remove();
        }

        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas ${type === 'error' ? 'fa-exclamation-circle' : type === 'success' ? 'fa-check-circle' : 'fa-info-circle'}"></i>
                <span>${message}</span>
                <button class="notification-close" onclick="this.parentElement.parentElement.remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        // Add styles
        notification.style.cssText = `
            position: fixed;
            top: 2rem;
            right: 2rem;
            background: ${type === 'error' ? '#fee2e2' : type === 'success' ? '#d1fae5' : '#dbeafe'};
            color: ${type === 'error' ? '#dc2626' : type === 'success' ? '#059669' : '#2563eb'};
            border: 1px solid ${type === 'error' ? '#fecaca' : type === 'success' ? '#a7f3d0' : '#93c5fd'};
            border-radius: 0.5rem;
            padding: 1rem;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
            z-index: 1000;
            max-width: 400px;
            animation: slideIn 0.3s ease-out;
        `;

        document.body.appendChild(notification);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }
}

// Initialize billing manager when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.billingManager = new BillingManager();
});

// Handle payment success redirect
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('payment') === 'success') {
        window.billingManager?.showSuccess('Payment successful! Your subscription is now active.');
        
        // Clean up URL
        const url = new URL(window.location);
        url.searchParams.delete('payment');
        window.history.replaceState({}, document.title, url);
    }
});