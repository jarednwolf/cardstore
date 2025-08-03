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
                description: 'Welcome to DeckStack - your shipping automation partner',
                handler: this.handleWelcomeStep.bind(this)
            },
            {
                id: 'overview',
                title: 'How It Works',
                description: 'Learn the DeckStack shipping workflow',
                handler: this.handleOverviewStep.bind(this)
            },
            {
                id: 'orders',
                title: 'Managing Orders',
                description: 'See how orders flow through the system',
                handler: this.handleOrdersStep.bind(this)
            },
            {
                id: 'shipping',
                title: 'Creating Labels',
                description: 'Learn to create and print shipping labels',
                handler: this.handleShippingStep.bind(this)
            },
            {
                id: 'complete',
                title: 'Ready to Ship!',
                description: 'You\'re ready to use DeckStack',
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
                        <div class="hero-icon">🃏</div>
                        <h3>Welcome to DeckStack!</h3>
                        <p class="hero-tagline">Stack the deck in your favor with automated shipping</p>
                    </div>
                    
                    <div class="welcome-intro">
                        <p>Hi there! This quick tutorial will show you how DeckStack makes shipping trading cards fast, easy, and error-free. Perfect for card store employees who want to focus on customers, not paperwork.</p>
                    </div>
                    
                    <div class="welcome-features">
                        <div class="feature-grid">
                            <div class="feature-item">
                                <i class="fas fa-mouse-pointer"></i>
                                <h4>One-Click Labels</h4>
                                <p>Create shipping labels instantly with a single click</p>
                            </div>
                            <div class="feature-item">
                                <i class="fas fa-shield-alt"></i>
                                <h4>High-Value Safe</h4>
                                <p>Special handling for expensive cards like Black Lotus</p>
                            </div>
                            <div class="feature-item">
                                <i class="fas fa-print"></i>
                                <h4>Print & Ship</h4>
                                <p>Print labels and get tracking numbers automatically</p>
                            </div>
                            <div class="feature-item">
                                <i class="fas fa-chart-line"></i>
                                <h4>Track Everything</h4>
                                <p>Monitor all shipments in real-time</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="tutorial-time">
                        <i class="fas fa-clock"></i>
                        <span>Tutorial time: 3 minutes</span>
                    </div>
                </div>
            </div>
        `;
    }

    async handleOverviewStep() {
        return `
            <div class="wizard-step active">
                <div class="step-content">
                    <h3>🚀 How DeckStack Works</h3>
                    <p>DeckStack automates your entire shipping process. Here's how simple it is:</p>
                    
                    <div class="workflow-steps">
                        <div class="workflow-step">
                            <div class="step-number">1</div>
                            <div class="step-details">
                                <h4>📦 Orders Come In</h4>
                                <p>Customer orders appear automatically in your dashboard. No manual entry needed!</p>
                            </div>
                        </div>
                        
                        <div class="workflow-step">
                            <div class="step-number">2</div>
                            <div class="step-details">
                                <h4>🏷️ Create Labels</h4>
                                <p>Click "Create Label" and DeckStack handles everything - addresses, postage, tracking numbers.</p>
                            </div>
                        </div>
                        
                        <div class="workflow-step">
                            <div class="step-number">3</div>
                            <div class="step-details">
                                <h4>🖨️ Print & Ship</h4>
                                <p>Print the label, stick it on the package, and drop it off. Customer gets tracking automatically!</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="workflow-benefits">
                        <div class="benefit-highlight">
                            <i class="fas fa-stopwatch"></i>
                            <strong>Save 5+ minutes per order</strong> - No more manual address entry or postage calculations
                        </div>
                        <div class="benefit-highlight">
                            <i class="fas fa-shield-check"></i>
                            <strong>Zero shipping errors</strong> - Addresses and postage are always correct
                        </div>
                        <div class="benefit-highlight">
                            <i class="fas fa-smile"></i>
                            <strong>Happy customers</strong> - Instant tracking and professional labels
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async handleOrdersStep() {
        return `
            <div class="wizard-step active">
                <div class="step-content">
                    <h3>📋 Managing Your Orders</h3>
                    <p>Let's look at how orders appear in DeckStack and what information you'll see:</p>
                    
                    <div class="demo-order-card">
                        <div class="order-header">
                            <div class="order-id">#ORD-001</div>
                            <div class="order-status pending">Ready to Ship</div>
                        </div>
                        <div class="order-details">
                            <div class="customer-info">
                                <h4>📍 Ship To:</h4>
                                <p><strong>Jane Smith</strong><br>
                                123 Main Street<br>
                                New York, NY 10001</p>
                            </div>
                            <div class="order-items">
                                <h4>🃏 Items:</h4>
                                <div class="item">
                                    <span class="item-name">Black Lotus (Alpha)</span>
                                    <span class="item-value">$27,009.95</span>
                                </div>
                                <div class="total">
                                    <strong>Total: $27,009.95</strong>
                                </div>
                            </div>
                        </div>
                        <div class="order-actions">
                            <button class="btn primary demo-btn">
                                <i class="fas fa-shipping-fast"></i>
                                Create Shipping Label
                            </button>
                        </div>
                    </div>
                    
                    <div class="order-tips">
                        <h4>💡 What You'll Notice:</h4>
                        <ul>
                            <li><strong>High-Value Alert:</strong> Expensive cards (like this $27K Black Lotus) get special attention</li>
                            <li><strong>Complete Info:</strong> Customer address and item details are already filled in</li>
                            <li><strong>One-Click Action:</strong> Just click "Create Shipping Label" to start</li>
                            <li><strong>Smart Defaults:</strong> DeckStack picks the best shipping method automatically</li>
                        </ul>
                    </div>
                </div>
            </div>
        `;
    }

    async handleShippingStep() {
        return `
            <div class="wizard-step active">
                <div class="step-content">
                    <h3>🏷️ Creating Shipping Labels</h3>
                    <p>This is where the magic happens! Let's see what happens when you create a label:</p>
                    
                    <div class="shipping-demo">
                        <div class="demo-step">
                            <div class="step-icon">1️⃣</div>
                            <div class="step-content">
                                <h4>Click "Create Label"</h4>
                                <p>DeckStack instantly calculates the best shipping method and cost</p>
                            </div>
                        </div>
                        
                        <div class="demo-step">
                            <div class="step-icon">2️⃣</div>
                            <div class="step-content">
                                <h4>Label Generated</h4>
                                <p>Professional USPS label with tracking number: <code>9400517512016093</code></p>
                            </div>
                        </div>
                        
                        <div class="demo-step">
                            <div class="step-icon">3️⃣</div>
                            <div class="step-content">
                                <h4>Ready to Print</h4>
                                <p>Download PDF or send directly to your printer</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="shipping-features">
                        <div class="feature-box">
                            <i class="fas fa-magic"></i>
                            <h4>Smart Shipping</h4>
                            <p>Automatically selects Priority Mail for high-value items, First-Class for regular cards</p>
                        </div>
                        
                        <div class="feature-box">
                            <i class="fas fa-shield-alt"></i>
                            <h4>Insurance Included</h4>
                            <p>High-value orders get automatic insurance and signature confirmation</p>
                        </div>
                        
                        <div class="feature-box">
                            <i class="fas fa-mobile-alt"></i>
                            <h4>Customer Updates</h4>
                            <p>Customers get tracking info automatically - no extra work for you!</p>
                        </div>
                    </div>
                    
                    <div class="try-it-note">
                        <i class="fas fa-lightbulb"></i>
                        <strong>Ready to try it?</strong> After this tutorial, click "Shipping & Labels" to see the real system with sample orders!
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