/**
 * Onboarding Wizard Module
 * Handles the step-by-step setup process for CardStore Operations Layer
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
                description: 'Welcome to CardStore Operations Layer setup',
                handler: this.handleWelcomeStep.bind(this)
            },
            {
                id: 'prerequisites',
                title: 'Prerequisites',
                description: 'Check system requirements',
                handler: this.handlePrerequisitesStep.bind(this)
            },
            {
                id: 'environment',
                title: 'Environment',
                description: 'Configure environment settings',
                handler: this.handleEnvironmentStep.bind(this)
            },
            {
                id: 'database',
                title: 'Database',
                description: 'Setup database and services',
                handler: this.handleDatabaseStep.bind(this)
            },
            {
                id: 'complete',
                title: 'Complete',
                description: 'Setup completed successfully',
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
            nextBtn.innerHTML = '<i class="fas fa-check"></i> Finish';
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
        const step = this.steps[this.currentStep];
        
        switch (step.id) {
            case 'prerequisites':
                return this.validatePrerequisites();
            case 'environment':
                return this.validateEnvironment();
            case 'database':
                return this.validateDatabase();
            default:
                return true;
        }
    }

    // Step Handlers
    async handleWelcomeStep() {
        return `
            <div class="wizard-step active">
                <div class="step-content">
                    <h3>Welcome to CardStore Operations Layer</h3>
                    <p>This setup wizard will guide you through configuring your CardStore Operations Layer for optimal performance. We'll check your system requirements, configure your environment, and set up all necessary services.</p>
                    
                    <div class="welcome-features">
                        <div class="feature-grid">
                            <div class="feature-item">
                                <i class="fas fa-rocket"></i>
                                <h4>Quick Setup</h4>
                                <p>Automated configuration and dependency installation</p>
                            </div>
                            <div class="feature-item">
                                <i class="fas fa-shield-alt"></i>
                                <h4>Secure Configuration</h4>
                                <p>Best practices for security and performance</p>
                            </div>
                            <div class="feature-item">
                                <i class="fas fa-cogs"></i>
                                <h4>Service Management</h4>
                                <p>Docker-based service orchestration</p>
                            </div>
                            <div class="feature-item">
                                <i class="fas fa-chart-line"></i>
                                <h4>Monitoring Ready</h4>
                                <p>Built-in health checks and monitoring</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="setup-time">
                        <i class="fas fa-clock"></i>
                        <span>Estimated setup time: 5-10 minutes</span>
                    </div>
                </div>
            </div>
        `;
    }

    async handlePrerequisitesStep() {
        this.setProcessing(true);
        
        try {
            const result = await window.api.safeRequest(() => window.api.checkPrerequisites());
            
            let prerequisitesHtml = '';
            if (result.success) {
                prerequisitesHtml = this.renderPrerequisites(result.data);
            } else {
                prerequisitesHtml = this.renderPrerequisitesError(result.error);
            }
            
            return `
                <div class="wizard-step active">
                    <div class="step-content">
                        <h3>System Prerequisites</h3>
                        <p>We're checking if your system meets the requirements for running CardStore Operations Layer.</p>
                        
                        ${prerequisitesHtml}
                        
                        <div class="prerequisites-help">
                            <h4>Need Help?</h4>
                            <p>If any prerequisites are missing, please install them before continuing:</p>
                            <ul>
                                <li><strong>Node.js 18+:</strong> <a href="https://nodejs.org" target="_blank">Download from nodejs.org</a></li>
                                <li><strong>Docker:</strong> <a href="https://docs.docker.com/get-docker/" target="_blank">Get Docker</a></li>
                                <li><strong>Git:</strong> <a href="https://git-scm.com/downloads" target="_blank">Download Git</a></li>
                            </ul>
                        </div>
                    </div>
                </div>
            `;
        } finally {
            this.setProcessing(false);
        }
    }

    async handleEnvironmentStep() {
        return `
            <div class="wizard-step active">
                <div class="step-content">
                    <h3>Environment Configuration</h3>
                    <p>Configure your environment variables and application settings.</p>
                    
                    <form id="environment-form" class="env-form">
                        <div class="form-group">
                            <label class="form-label">Database Configuration</label>
                            <div class="checkbox-group">
                                <input type="checkbox" id="use-docker" checked>
                                <label for="use-docker">Use Docker for databases (Recommended)</label>
                            </div>
                            <div class="form-help">Docker will automatically set up PostgreSQL and Redis for you.</div>
                        </div>
                        
                        <div id="manual-db-config" class="hidden">
                            <div class="form-group">
                                <label class="form-label" for="database-url">PostgreSQL Connection URL</label>
                                <input type="text" id="database-url" class="form-input" 
                                       placeholder="postgresql://user:password@localhost:5432/cardstore">
                                <div class="form-help">Connection string for your PostgreSQL database</div>
                            </div>
                            
                            <div class="form-group">
                                <label class="form-label" for="redis-url">Redis Connection URL</label>
                                <input type="text" id="redis-url" class="form-input" 
                                       placeholder="redis://localhost:6379">
                                <div class="form-help">Connection string for your Redis instance</div>
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label" for="jwt-secret">JWT Secret</label>
                            <input type="password" id="jwt-secret" class="form-input" 
                                   placeholder="Leave empty to auto-generate">
                            <div class="form-help">Secret key for JWT token signing (will be auto-generated if empty)</div>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">Shopify Integration (Optional)</label>
                            <div class="checkbox-group">
                                <input type="checkbox" id="configure-shopify">
                                <label for="configure-shopify">Configure Shopify integration now</label>
                            </div>
                        </div>
                        
                        <div id="shopify-config" class="hidden">
                            <div class="form-group">
                                <label class="form-label" for="shopify-api-key">Shopify API Key</label>
                                <input type="text" id="shopify-api-key" class="form-input">
                            </div>
                            
                            <div class="form-group">
                                <label class="form-label" for="shopify-api-secret">Shopify API Secret</label>
                                <input type="password" id="shopify-api-secret" class="form-input">
                            </div>
                            
                            <div class="form-group">
                                <label class="form-label" for="shopify-webhook-secret">Shopify Webhook Secret</label>
                                <input type="password" id="shopify-webhook-secret" class="form-input">
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        `;
    }

    async handleDatabaseStep() {
        this.setProcessing(true);
        
        try {
            // Get environment configuration from previous step
            const envConfig = this.getEnvironmentConfig();
            
            // Setup database
            const result = await window.api.safeRequest(() => window.api.setupDatabase(envConfig));
            
            let statusHtml = '';
            if (result.success) {
                statusHtml = this.renderDatabaseSuccess(result.data);
            } else {
                statusHtml = this.renderDatabaseError(result.error);
            }
            
            return `
                <div class="wizard-step active">
                    <div class="step-content">
                        <h3>Database Setup</h3>
                        <p>Setting up your database and running initial migrations.</p>
                        
                        ${statusHtml}
                        
                        <div class="setup-progress" id="setup-progress">
                            <div class="progress-item">
                                <i class="fas fa-database"></i>
                                <span>Starting database services...</span>
                                <div class="spinner"></div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } finally {
            this.setProcessing(false);
        }
    }

    async handleCompleteStep() {
        return `
            <div class="wizard-step active">
                <div class="step-content">
                    <div class="completion-content">
                        <div class="success-icon">
                            <i class="fas fa-check-circle"></i>
                        </div>
                        
                        <h3>Setup Complete!</h3>
                        <p>Your CardStore Operations Layer is now ready to use. All services have been configured and are running.</p>
                        
                        <div class="next-steps">
                            <h4>What's Next?</h4>
                            <div class="next-step-grid">
                                <div class="next-step-item">
                                    <i class="fas fa-tachometer-alt"></i>
                                    <h5>Dashboard</h5>
                                    <p>Monitor your system status and health</p>
                                    <button class="btn secondary" onclick="showView('dashboard')">Go to Dashboard</button>
                                </div>
                                
                                <div class="next-step-item">
                                    <i class="fas fa-heart-pulse"></i>
                                    <h5>Health Check</h5>
                                    <p>Run comprehensive system diagnostics</p>
                                    <button class="btn secondary" onclick="showView('health')">Run Health Check</button>
                                </div>
                                
                                <div class="next-step-item">
                                    <i class="fas fa-cogs"></i>
                                    <h5>Management</h5>
                                    <p>Manage services and configuration</p>
                                    <button class="btn secondary" onclick="showView('management')">System Management</button>
                                </div>
                            </div>
                        </div>
                        
                        <div class="useful-links">
                            <h4>Useful Links</h4>
                            <ul>
                                <li><a href="http://localhost:3000/health" target="_blank">Application Health Check</a></li>
                                <li><a href="http://localhost:3001" target="_blank">Grafana Dashboard (admin/admin)</a></li>
                                <li><a href="http://localhost:9090" target="_blank">Prometheus Metrics</a></li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // Helper Methods
    renderPrerequisites(data) {
        if (!data || !data.checks) {
            return '<div class="error-message">Unable to check prerequisites</div>';
        }

        let html = '<div class="prerequisite-list">';
        
        data.checks.forEach(check => {
            const status = check.status === 'healthy' ? 'success' : 'error';
            const icon = check.status === 'healthy' ? 'fa-check' : 'fa-times';
            
            html += `
                <div class="prerequisite-item ${status}">
                    <i class="fas ${icon} prerequisite-icon ${status}"></i>
                    <div class="prerequisite-details">
                        <div class="prerequisite-name">${check.name}</div>
                        <div class="prerequisite-message">${check.message}</div>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        return html;
    }

    renderPrerequisitesError(error) {
        return `
            <div class="error-message">
                <i class="fas fa-exclamation-triangle"></i>
                <h4>Unable to Check Prerequisites</h4>
                <p>${error}</p>
                <p>Please ensure the backend server is running and try again.</p>
            </div>
        `;
    }

    renderDatabaseSuccess(data) {
        return `
            <div class="success-message">
                <i class="fas fa-check-circle"></i>
                <h4>Database Setup Complete</h4>
                <p>All database services are running and migrations have been applied successfully.</p>
            </div>
        `;
    }

    renderDatabaseError(error) {
        return `
            <div class="error-message">
                <i class="fas fa-exclamation-triangle"></i>
                <h4>Database Setup Failed</h4>
                <p>${error}</p>
                <p>Please check your configuration and try again.</p>
            </div>
        `;
    }

    getEnvironmentConfig() {
        const form = document.getElementById('environment-form');
        if (!form) return {};

        return {
            useDocker: document.getElementById('use-docker')?.checked || false,
            databaseUrl: document.getElementById('database-url')?.value || '',
            redisUrl: document.getElementById('redis-url')?.value || '',
            jwtSecret: document.getElementById('jwt-secret')?.value || '',
            configureShopify: document.getElementById('configure-shopify')?.checked || false,
            shopifyApiKey: document.getElementById('shopify-api-key')?.value || '',
            shopifyApiSecret: document.getElementById('shopify-api-secret')?.value || '',
            shopifyWebhookSecret: document.getElementById('shopify-webhook-secret')?.value || ''
        };
    }

    validatePrerequisites() {
        // Check if all required prerequisites are met
        const prerequisites = document.querySelectorAll('.prerequisite-item.error');
        if (prerequisites.length > 0) {
            this.showError('Please resolve all prerequisite issues before continuing.');
            return false;
        }
        return true;
    }

    validateEnvironment() {
        const config = this.getEnvironmentConfig();
        
        if (!config.useDocker) {
            if (!config.databaseUrl) {
                this.showError('Please provide a PostgreSQL connection URL.');
                return false;
            }
            if (!config.redisUrl) {
                this.showError('Please provide a Redis connection URL.');
                return false;
            }
        }
        
        this.stepData.environment = config;
        return true;
    }

    validateDatabase() {
        // Database validation is handled in the step handler
        return true;
    }

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
        this.setProcessing(true);
        
        try {
            const result = await window.api.safeRequest(() => window.api.finalizeSetup());
            
            if (result.success) {
                window.activityLogger.log('Onboarding completed successfully', 'success');
                showView('dashboard');
            } else {
                this.showError('Failed to complete setup: ' + result.error);
            }
        } finally {
            this.setProcessing(false);
        }
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
    
    // Add event listeners for form interactions
    document.addEventListener('change', (event) => {
        if (event.target.id === 'use-docker') {
            const manualConfig = document.getElementById('manual-db-config');
            if (manualConfig) {
                manualConfig.classList.toggle('hidden', event.target.checked);
            }
        }
        
        if (event.target.id === 'configure-shopify') {
            const shopifyConfig = document.getElementById('shopify-config');
            if (shopifyConfig) {
                shopifyConfig.classList.toggle('hidden', !event.target.checked);
            }
        }
    });
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