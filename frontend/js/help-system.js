/**
 * Contextual Help System for Card Shop Owners
 * Provides tooltips, guided tours, and contextual assistance
 */

class HelpSystem {
    constructor() {
        this.tooltips = new Map();
        this.isTooltipVisible = false;
        this.currentTooltip = null;
        this.helpData = this.getHelpData();
        
        this.init();
    }

    init() {
        this.createHelpStyles();
        this.setupTooltips();
        this.setupHelpButton();
        this.setupKeyboardShortcuts();
    }

    getHelpData() {
        return {
            'connect-store': {
                title: 'Why Connect Your Store?',
                content: 'Connecting your store lets us automatically sync your inventory, so when you sell a card, it\'s immediately updated everywhere. No more overselling or manual updates!',
                position: 'bottom'
            },
            'shopify-recommended': {
                title: 'Why Shopify is Recommended',
                content: 'Shopify is the most popular platform for card shops because it handles payments, shipping, and customer service automatically. Plus, it integrates perfectly with our system.',
                position: 'top'
            },
            'inventory-only': {
                title: 'Perfect for In-Store Sales',
                content: 'If you only sell in person or at events, this option helps you track what you have, what\'s selling well, and what to reorder.',
                position: 'top'
            },
            'security-note': {
                title: 'Your Data is Safe',
                content: 'We only read your inventory data - we can\'t access your customer information, payments, or make changes to your store without permission.',
                position: 'top'
            },
            'setup-steps': {
                title: 'Simple 3-Step Process',
                content: 'We\'ve made this as simple as possible. Each step builds on the previous one, and you can always go back if you need to change something.',
                position: 'right'
            },
            'value-props': {
                title: 'What This Means for Your Business',
                content: 'These aren\'t just features - they\'re time-savers that let you focus on what you love: finding great cards and serving customers.',
                position: 'bottom'
            }
        };
    }

    createHelpStyles() {
        if (document.querySelector('#help-system-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'help-system-styles';
        styles.textContent = `
            /* Help Button */
            .help-button {
                position: fixed;
                bottom: 20px;
                right: 20px;
                width: 60px;
                height: 60px;
                background: var(--primary-color);
                color: white;
                border: none;
                border-radius: 50%;
                font-size: 1.5rem;
                cursor: pointer;
                box-shadow: var(--shadow-lg);
                transition: all var(--transition-normal);
                z-index: 999;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .help-button:hover {
                background: var(--primary-dark);
                transform: scale(1.1);
            }

            .help-button.pulse {
                animation: helpPulse 2s infinite;
            }

            @keyframes helpPulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.05); }
            }

            /* Tooltips */
            .tooltip {
                position: absolute;
                background: var(--gray-900);
                color: white;
                padding: var(--spacing-md);
                border-radius: var(--radius-md);
                font-size: 0.875rem;
                line-height: 1.4;
                max-width: 300px;
                z-index: 1000;
                opacity: 0;
                transform: translateY(10px);
                transition: all var(--transition-normal);
                pointer-events: none;
                box-shadow: var(--shadow-xl);
            }

            .tooltip.visible {
                opacity: 1;
                transform: translateY(0);
                pointer-events: auto;
            }

            .tooltip::before {
                content: '';
                position: absolute;
                width: 0;
                height: 0;
                border: 8px solid transparent;
            }

            .tooltip.top::before {
                bottom: -16px;
                left: 50%;
                transform: translateX(-50%);
                border-top-color: var(--gray-900);
            }

            .tooltip.bottom::before {
                top: -16px;
                left: 50%;
                transform: translateX(-50%);
                border-bottom-color: var(--gray-900);
            }

            .tooltip.left::before {
                right: -16px;
                top: 50%;
                transform: translateY(-50%);
                border-left-color: var(--gray-900);
            }

            .tooltip.right::before {
                left: -16px;
                top: 50%;
                transform: translateY(-50%);
                border-right-color: var(--gray-900);
            }

            .tooltip-title {
                font-weight: 600;
                margin-bottom: var(--spacing-xs);
                color: white;
            }

            .tooltip-content {
                color: rgba(255, 255, 255, 0.9);
            }

            .tooltip-close {
                position: absolute;
                top: 8px;
                right: 8px;
                background: none;
                border: none;
                color: rgba(255, 255, 255, 0.7);
                cursor: pointer;
                font-size: 0.875rem;
                padding: 2px;
                border-radius: 2px;
            }

            .tooltip-close:hover {
                color: white;
                background: rgba(255, 255, 255, 0.1);
            }

            /* Help Indicators */
            .help-indicator {
                position: relative;
                cursor: help;
            }

            .help-indicator::after {
                content: '?';
                position: absolute;
                top: -8px;
                right: -8px;
                width: 18px;
                height: 18px;
                background: var(--info-color);
                color: white;
                border-radius: 50%;
                font-size: 0.75rem;
                font-weight: 600;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0.8;
                transition: opacity var(--transition-fast);
            }

            .help-indicator:hover::after {
                opacity: 1;
            }

            /* Help Modal */
            .help-modal {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 1001;
                opacity: 0;
                visibility: hidden;
                transition: all var(--transition-normal);
            }

            .help-modal.visible {
                opacity: 1;
                visibility: visible;
            }

            .help-modal-content {
                background: white;
                border-radius: var(--radius-lg);
                padding: var(--spacing-2xl);
                max-width: 500px;
                width: 90%;
                max-height: 80vh;
                overflow-y: auto;
                position: relative;
            }

            .help-modal-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: var(--spacing-lg);
            }

            .help-modal-title {
                font-size: 1.25rem;
                font-weight: 600;
                color: var(--text-primary);
            }

            .help-modal-close {
                background: none;
                border: none;
                font-size: 1.5rem;
                color: var(--text-muted);
                cursor: pointer;
                padding: var(--spacing-xs);
                border-radius: var(--radius-sm);
            }

            .help-modal-close:hover {
                background: var(--gray-100);
                color: var(--text-primary);
            }

            .help-section {
                margin-bottom: var(--spacing-lg);
            }

            .help-section h3 {
                font-size: 1.125rem;
                font-weight: 600;
                color: var(--text-primary);
                margin-bottom: var(--spacing-sm);
            }

            .help-section p {
                color: var(--text-secondary);
                line-height: 1.6;
                margin-bottom: var(--spacing-sm);
            }

            .help-section ul {
                list-style: none;
                padding: 0;
            }

            .help-section li {
                display: flex;
                align-items: flex-start;
                gap: var(--spacing-sm);
                margin-bottom: var(--spacing-sm);
                color: var(--text-secondary);
            }

            .help-section li i {
                color: var(--success-color);
                margin-top: 2px;
                flex-shrink: 0;
            }

            /* Guided Tour */
            .tour-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.7);
                z-index: 1002;
                opacity: 0;
                visibility: hidden;
                transition: all var(--transition-normal);
            }

            .tour-overlay.visible {
                opacity: 1;
                visibility: visible;
            }

            .tour-spotlight {
                position: absolute;
                border: 3px solid var(--primary-color);
                border-radius: var(--radius-md);
                box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.7);
                transition: all var(--transition-normal);
            }

            .tour-popup {
                position: absolute;
                background: white;
                border-radius: var(--radius-lg);
                padding: var(--spacing-lg);
                max-width: 300px;
                box-shadow: var(--shadow-xl);
                z-index: 1003;
            }

            .tour-popup h4 {
                font-size: 1.125rem;
                font-weight: 600;
                color: var(--text-primary);
                margin-bottom: var(--spacing-sm);
            }

            .tour-popup p {
                color: var(--text-secondary);
                margin-bottom: var(--spacing-md);
                line-height: 1.5;
            }

            .tour-actions {
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .tour-progress {
                font-size: 0.875rem;
                color: var(--text-muted);
            }

            .tour-buttons {
                display: flex;
                gap: var(--spacing-sm);
            }

            .tour-btn {
                padding: var(--spacing-xs) var(--spacing-sm);
                border: 1px solid var(--gray-300);
                background: white;
                color: var(--text-primary);
                border-radius: var(--radius-sm);
                cursor: pointer;
                font-size: 0.875rem;
                transition: all var(--transition-fast);
            }

            .tour-btn:hover {
                background: var(--gray-50);
            }

            .tour-btn.primary {
                background: var(--primary-color);
                color: white;
                border-color: var(--primary-color);
            }

            .tour-btn.primary:hover {
                background: var(--primary-dark);
            }
        `;
        document.head.appendChild(styles);
    }

    setupTooltips() {
        // Add help indicators to key elements
        this.addHelpIndicator('.connection-option.recommended', 'shopify-recommended');
        this.addHelpIndicator('.connection-option:last-child', 'inventory-only');
        this.addHelpIndicator('.security-note', 'security-note');
        this.addHelpIndicator('.setup-steps', 'setup-steps');
        this.addHelpIndicator('.value-props', 'value-props');
    }

    addHelpIndicator(selector, helpKey) {
        const element = document.querySelector(selector);
        if (!element) return;

        element.classList.add('help-indicator');
        element.addEventListener('mouseenter', (e) => this.showTooltip(e.target, helpKey));
        element.addEventListener('mouseleave', () => this.hideTooltip());
        element.addEventListener('click', (e) => {
            e.preventDefault();
            this.showTooltip(e.target, helpKey, true);
        });
    }

    showTooltip(element, helpKey, persistent = false) {
        const helpData = this.helpData[helpKey];
        if (!helpData) return;

        this.hideTooltip();

        const tooltip = document.createElement('div');
        tooltip.className = `tooltip ${helpData.position}`;
        tooltip.innerHTML = `
            ${persistent ? '<button class="tooltip-close" onclick="window.helpSystem.hideTooltip()">&times;</button>' : ''}
            <div class="tooltip-title">${helpData.title}</div>
            <div class="tooltip-content">${helpData.content}</div>
        `;

        document.body.appendChild(tooltip);
        this.currentTooltip = tooltip;

        // Position tooltip
        this.positionTooltip(tooltip, element, helpData.position);

        // Show tooltip
        setTimeout(() => {
            tooltip.classList.add('visible');
        }, 10);

        if (!persistent) {
            // Auto-hide after 5 seconds
            setTimeout(() => {
                if (this.currentTooltip === tooltip) {
                    this.hideTooltip();
                }
            }, 5000);
        }
    }

    positionTooltip(tooltip, element, position) {
        const rect = element.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();

        let top, left;

        switch (position) {
            case 'top':
                top = rect.top - tooltipRect.height - 16;
                left = rect.left + (rect.width - tooltipRect.width) / 2;
                break;
            case 'bottom':
                top = rect.bottom + 16;
                left = rect.left + (rect.width - tooltipRect.width) / 2;
                break;
            case 'left':
                top = rect.top + (rect.height - tooltipRect.height) / 2;
                left = rect.left - tooltipRect.width - 16;
                break;
            case 'right':
                top = rect.top + (rect.height - tooltipRect.height) / 2;
                left = rect.right + 16;
                break;
        }

        // Keep tooltip on screen
        top = Math.max(10, Math.min(top, window.innerHeight - tooltipRect.height - 10));
        left = Math.max(10, Math.min(left, window.innerWidth - tooltipRect.width - 10));

        tooltip.style.top = `${top}px`;
        tooltip.style.left = `${left}px`;
    }

    hideTooltip() {
        if (this.currentTooltip) {
            this.currentTooltip.classList.remove('visible');
            setTimeout(() => {
                if (this.currentTooltip && this.currentTooltip.parentElement) {
                    this.currentTooltip.remove();
                }
                this.currentTooltip = null;
            }, 250);
        }
    }

    setupHelpButton() {
        const helpButton = document.createElement('button');
        helpButton.className = 'help-button';
        helpButton.innerHTML = '<i class="fas fa-question"></i>';
        helpButton.title = 'Need help? Click here!';
        helpButton.addEventListener('click', () => this.showHelpModal());

        document.body.appendChild(helpButton);

        // Make help button pulse on first visit
        if (!localStorage.getItem('cardstore-help-seen')) {
            helpButton.classList.add('pulse');
            setTimeout(() => {
                helpButton.classList.remove('pulse');
                localStorage.setItem('cardstore-help-seen', 'true');
            }, 10000);
        }
    }

    showHelpModal() {
        const modal = document.createElement('div');
        modal.className = 'help-modal';
        modal.innerHTML = `
            <div class="help-modal-content">
                <div class="help-modal-header">
                    <h2 class="help-modal-title">How to Get Started</h2>
                    <button class="help-modal-close" onclick="window.helpSystem.hideHelpModal()">&times;</button>
                </div>
                
                <div class="help-section">
                    <h3>What is CardStore?</h3>
                    <p>CardStore helps you manage your trading card inventory and sales across multiple platforms. Think of it as your digital assistant that never forgets a card and never oversells.</p>
                </div>

                <div class="help-section">
                    <h3>Getting Started is Easy</h3>
                    <ul>
                        <li><i class="fas fa-check"></i> Connect your existing store (like Shopify) or start fresh</li>
                        <li><i class="fas fa-check"></i> Add your card inventory (we can import from many sources)</li>
                        <li><i class="fas fa-check"></i> Start selling - your inventory syncs automatically!</li>
                    </ul>
                </div>

                <div class="help-section">
                    <h3>Why Card Shop Owners Love Us</h3>
                    <ul>
                        <li><i class="fas fa-check"></i> <strong>No more overselling:</strong> When a card sells, it's immediately removed from all platforms</li>
                        <li><i class="fas fa-check"></i> <strong>Save hours daily:</strong> No manual inventory updates across multiple sites</li>
                        <li><i class="fas fa-check"></i> <strong>Grow your business:</strong> Sell on more platforms without extra work</li>
                        <li><i class="fas fa-check"></i> <strong>Professional tools:</strong> Track what's selling, what to reorder, and your profits</li>
                    </ul>
                </div>

                <div class="help-section">
                    <h3>Need Personal Help?</h3>
                    <p>Our team includes card shop owners who understand your business. We're here to help you succeed!</p>
                    <ul>
                        <li><i class="fas fa-check"></i> Live chat support during business hours</li>
                        <li><i class="fas fa-check"></i> Free setup assistance</li>
                        <li><i class="fas fa-check"></i> Video tutorials for everything</li>
                    </ul>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        this.currentModal = modal;

        setTimeout(() => {
            modal.classList.add('visible');
        }, 10);

        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.hideHelpModal();
            }
        });
    }

    hideHelpModal() {
        if (this.currentModal) {
            this.currentModal.classList.remove('visible');
            setTimeout(() => {
                if (this.currentModal && this.currentModal.parentElement) {
                    this.currentModal.remove();
                }
                this.currentModal = null;
            }, 250);
        }
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // F1 or ? to show help
            if (e.key === 'F1' || (e.key === '?' && !e.target.matches('input, textarea'))) {
                e.preventDefault();
                this.showHelpModal();
            }
            
            // Escape to close help
            if (e.key === 'Escape') {
                this.hideTooltip();
                this.hideHelpModal();
            }
        });
    }

    // Public methods for integration
    showContextualHelp(context) {
        const contextHelp = {
            'first-visit': () => this.showWelcomeTour(),
            'setup-stuck': () => this.showSetupHelp(),
            'connection-failed': () => this.showConnectionHelp()
        };

        if (contextHelp[context]) {
            contextHelp[context]();
        }
    }

    showWelcomeTour() {
        // This would implement a guided tour for first-time users
        this.showHelpModal();
    }

    showSetupHelp() {
        // Show specific help for setup issues
        this.showTooltip(document.querySelector('.setup-steps'), 'setup-steps', true);
    }

    showConnectionHelp() {
        // Show help for connection problems
        this.showTooltip(document.querySelector('.security-note'), 'security-note', true);
    }
}

// Initialize help system when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.helpSystem = new HelpSystem();
});

// Export for use by other modules
window.HelpSystem = HelpSystem;