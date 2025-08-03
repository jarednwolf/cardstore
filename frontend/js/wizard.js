/**
 * DeckStack Onboarding Wizard
 * Guides card store employees through the shipping workflow
 */

class OnboardingWizard {
    constructor() {
        this.currentStep = 0;
        this.totalSteps = 5;
        this.stepData = {};
        this.isProcessing = false;
        
        this.steps = [
            {
                id: 'welcome',
                title: 'Welcome',
                description: 'Welcome to DeckStack setup',
                handler: this.handleWelcomeStep.bind(this)
            },
            {
                id: 'account',
                title: 'Account Setup',
                description: 'Create your DeckStack account',
                handler: this.handleAccountStep.bind(this)
            },
            {
                id: 'integrations',
                title: 'Store Integration',
                description: 'Connect your e-commerce platform',
                handler: this.handleIntegrationsStep.bind(this)
            },
            {
                id: 'shipping',
                title: 'Shipping Carriers',
                description: 'Configure shipping providers',
                handler: this.handleShippingStep.bind(this)
            },
            {
                id: 'complete',
                title: 'Setup Complete',
                description: 'Your account is ready to use',
                handler: this.handleCompleteStep.bind(this)
            }
        ];

        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Listen for activity updates
        document.addEventListener('activity:activity', (event) => {
            this.updateActivityLog(event.detail);
        });
    }

    async start() {
        this.currentStep = 0;
        await this.showStep(this.currentStep);
        this.updateProgress();
        this.updateStepIndicators();
        
        window.activityLogger.log('Started onboarding wizard', 'info');
    }

    async showStep(stepIndex) {
        if (stepIndex < 0 || stepIndex >= this.steps.length) {
            return;
        }

        const step = this.steps[stepIndex];
        const content = await step.handler();
        
        // Update wizard content
        const wizardContent = document.getElementById('wizard-content');
        wizardContent.innerHTML = content;
        
        // Update navigation buttons
        this.updateNavigationButtons();
        
        window.activityLogger.log(`Viewing step: ${step.title}`, 'info');
    }

    updateProgress() {
        const progressFill = document.getElementById('wizard-progress');
        const percentage = ((this.currentStep + 1) / this.totalSteps) * 100;
        progressFill.style.width = `${percentage}%`;
    }

    updateStepIndicators() {
        const indicators = document.querySelectorAll('.step');
        indicators.forEach((indicator, index) => {
            indicator.classList.remove('active', 'completed');
            
            if (index < this.currentStep) {
                indicator.classList.add('completed');
            } else if (index === this.currentStep) {
                indicator.classList.add('active');
            }
        });
    }

    updateNavigationButtons() {
        const prevBtn = document.getElementById('prev-btn');
        const nextBtn = document.getElementById('next-btn');
        
        prevBtn.disabled = this.currentStep === 0 || this.isProcessing;
        
        if (this.currentStep === this.totalSteps - 1) {
            nextBtn.innerHTML = '<i class="fas fa-rocket"></i> Start Shipping!';
        } else {
            nextBtn.innerHTML = 'Next <i class="fas fa-arrow-right"></i>';
        }
        
        nextBtn.disabled = this.isProcessing;
    }

    async nextStep() {
        if (this.isProcessing) return;
        
        // Validate current step before proceeding
        const isValid = await this.validateCurrentStep();
        if (!isValid) return;
        
        if (this.currentStep < this.totalSteps - 1) {
            this.currentStep++;
            await this.showStep(this.currentStep);
            this.updateProgress();
            this.updateStepIndicators();
        } else {
            // Finish wizard
            await this.finishWizard();
        }
    }

    async previousStep() {
        if (this.isProcessing || this.currentStep === 0) return;
        
        this.currentStep--;
        await this.showStep(this.currentStep);
        this.updateProgress();
        this.updateStepIndicators();
    }

    async validateCurrentStep() {
        // All tutorial steps are always valid - no technical validation needed
        return true;
    }

    // Step Handlers
    async handleWelcomeStep() {
        return `
            <div class="wizard-step active">
                <div class="step-content">
                    <div class="welcome-hero">
                        <div class="hero-icon">
                            <svg class="w-16 h-16 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
                            </svg>
                        </div>
                        <h3>Welcome to DeckStack</h3>
                        <p class="hero-tagline">Professional shipping automation for your business</p>
                    </div>
                    
                    <div class="welcome-intro">
                        <p>This setup wizard will guide you through configuring DeckStack for your business. We'll connect your store, set up shipping preferences, and get you ready to automate your fulfillment process.</p>
                    </div>
                    
                    <div class="welcome-features">
                        <div class="feature-grid">
                            <div class="feature-item">
                                <svg class="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.121 2.122"/>
                                </svg>
                                <h4>Automated Processing</h4>
                                <p>Process orders automatically with intelligent routing</p>
                            </div>
                            <div class="feature-item">
                                <svg class="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                                </svg>
                                <h4>Secure & Reliable</h4>
                                <p>Enterprise-grade security with 99.9% uptime</p>
                            </div>
                            <div class="feature-item">
                                <svg class="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
                                </svg>
                                <h4>Multi-Carrier Support</h4>
                                <p>Integrate with USPS, UPS, FedEx, and DHL</p>
                            </div>
                            <div class="feature-item">
                                <svg class="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 00-2-2z"/>
                                </svg>
                                <h4>Analytics & Insights</h4>
                                <p>Track performance with detailed reporting</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="setup-time">
                        <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                        <span>Setup time: 5-10 minutes</span>
                    </div>
                </div>
            </div>
        `;
    }

    async handleAccountStep() {
        return `
            <div class="wizard-step active">
                <div class="step-content">
                    <h3>Create Your Account</h3>
                    <p>Set up your DeckStack account to get started with automated shipping.</p>
                    
                    <form id="account-form" class="setup-form">
                        <div class="form-group">
                            <label class="form-label" for="company-name">Company Name</label>
                            <input type="text" id="company-name" class="form-input"
                                   placeholder="Your Business Name" required>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label" for="admin-email">Admin Email</label>
                            <input type="email" id="admin-email" class="form-input"
                                   placeholder="admin@yourbusiness.com" required>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label" for="admin-password">Password</label>
                            <input type="password" id="admin-password" class="form-input"
                                   placeholder="Create a secure password" required>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label" for="business-type">Business Type</label>
                            <select id="business-type" class="form-select" required>
                                <option value="">Select your business type</option>
                                <option value="ecommerce">E-commerce Store</option>
                                <option value="retail">Retail Store</option>
                                <option value="marketplace">Marketplace Seller</option>
                                <option value="dropship">Dropshipping</option>
                                <option value="other">Other</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label" for="monthly-volume">Monthly Shipping Volume</label>
                            <select id="monthly-volume" class="form-select" required>
                                <option value="">Select volume range</option>
                                <option value="1-50">1-50 packages</option>
                                <option value="51-200">51-200 packages</option>
                                <option value="201-500">201-500 packages</option>
                                <option value="501-1000">501-1000 packages</option>
                                <option value="1000+">1000+ packages</option>
                            </select>
                        </div>
                    </form>
                </div>
            </div>
        `;
    }

    async handleIntegrationsStep() {
        return `
            <div class="wizard-step active">
                <div class="step-content">
                    <h3>Connect Your Store</h3>
                    <p>Connect your e-commerce platform to automatically import orders and customer data.</p>
                    
                    <div class="integration-options">
                        <div class="integration-card">
                            <div class="integration-header">
                                <svg class="w-12 h-12 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                                </svg>
                                <h4>Shopify</h4>
                            </div>
                            <p>Connect your Shopify store to automatically sync orders and customer information.</p>
                            <button class="btn primary integration-btn" data-platform="shopify">
                                Connect Shopify Store
                            </button>
                        </div>
                        
                        <div class="integration-card">
                            <div class="integration-header">
                                <svg class="w-12 h-12 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                                </svg>
                                <h4>WooCommerce</h4>
                            </div>
                            <p>Integrate with your WordPress WooCommerce store for seamless order management.</p>
                            <button class="btn secondary integration-btn" data-platform="woocommerce">
                                Connect WooCommerce
                            </button>
                        </div>
                        
                        <div class="integration-card">
                            <div class="integration-header">
                                <svg class="w-12 h-12 text-orange-600" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                                </svg>
                                <h4>BigCommerce</h4>
                            </div>
                            <p>Link your BigCommerce store to streamline your fulfillment process.</p>
                            <button class="btn secondary integration-btn" data-platform="bigcommerce">
                                Connect BigCommerce
                            </button>
                        </div>
                        
                        <div class="integration-card">
                            <div class="integration-header">
                                <svg class="w-12 h-12 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                                </svg>
                                <h4>Custom API</h4>
                            </div>
                            <p>Use our REST API to integrate with custom or other e-commerce platforms.</p>
                            <button class="btn secondary integration-btn" data-platform="api">
                                View API Documentation
                            </button>
                        </div>
                    </div>
                    
                    <div class="skip-option">
                        <p class="text-center text-gray-600">
                            <button class="btn-link" onclick="window.onboardingWizard.nextStep()">
                                Skip for now - I'll set this up later
                            </button>
                        </p>
                    </div>
                </div>
            </div>
        `;
    }

    async handleShippingStep() {
        return `
            <div class="wizard-step active">
                <div class="step-content">
                    <h3>Configure Shipping Carriers</h3>
                    <p>Connect your shipping carrier accounts to enable label printing and tracking.</p>
                    
                    <div class="carrier-setup">
                        <div class="carrier-card">
                            <div class="carrier-header">
                                <svg class="w-8 h-8 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                                </svg>
                                <h4>USPS</h4>
                                <span class="recommended-badge">Recommended</span>
                            </div>
                            <p>Connect your USPS account for domestic and international shipping.</p>
                            <form class="carrier-form">
                                <div class="form-group">
                                    <label class="form-label" for="usps-username">USPS Username</label>
                                    <input type="text" id="usps-username" class="form-input" placeholder="Your USPS username">
                                </div>
                                <div class="form-group">
                                    <label class="form-label" for="usps-password">USPS Password</label>
                                    <input type="password" id="usps-password" class="form-input" placeholder="Your USPS password">
                                </div>
                                <button type="button" class="btn primary carrier-connect-btn" data-carrier="usps">
                                    Connect USPS Account
                                </button>
                            </form>
                        </div>
                        
                        <div class="carrier-card">
                            <div class="carrier-header">
                                <svg class="w-8 h-8 text-brown-600" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                                </svg>
                                <h4>UPS</h4>
                            </div>
                            <p>Integrate with UPS for reliable ground and express shipping options.</p>
                            <form class="carrier-form">
                                <div class="form-group">
                                    <label class="form-label" for="ups-account">UPS Account Number</label>
                                    <input type="text" id="ups-account" class="form-input" placeholder="Your UPS account number">
                                </div>
                                <div class="form-group">
                                    <label class="form-label" for="ups-api-key">UPS API Key</label>
                                    <input type="text" id="ups-api-key" class="form-input" placeholder="Your UPS API key">
                                </div>
                                <button type="button" class="btn secondary carrier-connect-btn" data-carrier="ups">
                                    Connect UPS Account
                                </button>
                            </form>
                        </div>
                        
                        <div class="carrier-card">
                            <div class="carrier-header">
                                <svg class="w-8 h-8 text-purple-600" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                                </svg>
                                <h4>FedEx</h4>
                            </div>
                            <p>Connect FedEx for premium shipping services and overnight delivery.</p>
                            <form class="carrier-form">
                                <div class="form-group">
                                    <label class="form-label" for="fedex-account">FedEx Account Number</label>
                                    <input type="text" id="fedex-account" class="form-input" placeholder="Your FedEx account number">
                                </div>
                                <div class="form-group">
                                    <label class="form-label" for="fedex-meter">FedEx Meter Number</label>
                                    <input type="text" id="fedex-meter" class="form-input" placeholder="Your FedEx meter number">
                                </div>
                                <button type="button" class="btn secondary carrier-connect-btn" data-carrier="fedex">
                                    Connect FedEx Account
                                </button>
                            </form>
                        </div>
                    </div>
                    
                    <div class="shipping-preferences">
                        <h4>Shipping Preferences</h4>
                        <div class="preferences-grid">
                            <div class="form-group">
                                <label class="form-label" for="default-service">Default Service Level</label>
                                <select id="default-service" class="form-select">
                                    <option value="ground">Ground/Standard</option>
                                    <option value="priority">Priority/Express</option>
                                    <option value="overnight">Overnight/Next Day</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label" for="insurance-threshold">Auto-Insurance Threshold</label>
                                <input type="number" id="insurance-threshold" class="form-input"
                                       placeholder="100" value="100">
                                <div class="form-help">Orders above this value get automatic insurance</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="skip-option">
                        <p class="text-center text-gray-600">
                            <button class="btn-link" onclick="window.onboardingWizard.nextStep()">
                                Skip carrier setup - I'll configure this later
                            </button>
                        </p>
                    </div>
                </div>
            </div>
        `;
    }

    async handleCompleteStep() {
        return `
            <div class="wizard-step active">
                <div class="step-content">
                    <div class="completion-content">
                        <div class="success-icon">
                            🎉
                        </div>
                        
                        <h3>You're Ready to Ship!</h3>
                        <p>Congratulations! You now know how to use DeckStack to automate your card store shipping. You'll save time, reduce errors, and keep customers happy.</p>
                        
                        <div class="completion-summary">
                            <h4>🃏 What You Learned:</h4>
                            <ul>
                                <li>✅ How orders flow through DeckStack automatically</li>
                                <li>✅ One-click label creation saves 5+ minutes per order</li>
                                <li>✅ High-value items get special protection automatically</li>
                                <li>✅ Customers get tracking info without extra work</li>
                            </ul>
                        </div>
                        
                        <div class="next-steps">
                            <h4>🚀 Ready to Start Shipping?</h4>
                            <div class="next-step-grid">
                                <div class="next-step-item primary">
                                    <i class="fas fa-shipping-fast"></i>
                                    <h5>Try Shipping Now</h5>
                                    <p>Practice with real sample orders</p>
                                    <button class="btn primary" onclick="window.open('shipping.html', '_blank')">
                                        Start Shipping →
                                    </button>
                                </div>
                                
                                <div class="next-step-item">
                                    <i class="fas fa-tachometer-alt"></i>
                                    <h5>Dashboard</h5>
                                    <p>Monitor system status</p>
                                    <button class="btn secondary" onclick="showView('dashboard')">View Dashboard</button>
                                </div>
                                
                                <div class="next-step-item">
                                    <i class="fas fa-question-circle"></i>
                                    <h5>Need Help?</h5>
                                    <p>Run this tutorial again anytime</p>
                                    <button class="btn secondary" onclick="window.onboardingWizard.start()">Restart Tutorial</button>
                                </div>
                            </div>
                        </div>
                        
                        <div class="success-message">
                            <i class="fas fa-trophy"></i>
                            <strong>Welcome to the DeckStack family!</strong> You're now equipped to handle shipping like a pro.
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // Helper Methods - Simplified for tutorial mode

    setProcessing(processing) {
        this.isProcessing = processing;
        this.updateNavigationButtons();
        
        if (processing) {
            showLoading('Processing...', 'Please wait while we complete the setup.');
        } else {
            hideLoading();
        }
    }

    showError(message) {
        // Show error message to user
        console.error(message);
        // You could implement a toast notification here
    }

    async finishWizard() {
        // Tutorial completed - no technical setup needed
        window.activityLogger.log('DeckStack tutorial completed successfully', 'success');
        showView('dashboard');
    }

    updateActivityLog(activity) {
        // Update activity log in the UI if visible
        const activityLog = document.getElementById('activity-log');
        if (activityLog) {
            const activityItem = document.createElement('div');
            activityItem.className = 'activity-item';
            activityItem.innerHTML = `
                <span class="activity-time">${activity.time}</span>
                <span class="activity-text">${activity.message}</span>
            `;
            
            activityLog.insertBefore(activityItem, activityLog.firstChild);
            
            // Keep only the latest 10 activities in the UI
            while (activityLog.children.length > 10) {
                activityLog.removeChild(activityLog.lastChild);
            }
        }
    }
}

// Initialize wizard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.onboardingWizard = new OnboardingWizard();
});

// Global functions for navigation
window.nextStep = () => {
    if (window.onboardingWizard) {
        window.onboardingWizard.nextStep();
    }
};

window.previousStep = () => {
    if (window.onboardingWizard) {
        window.onboardingWizard.previousStep();
    }
};