/**
 * DeckStack Authentication System
 * Handles login, signup, and user authentication flows
 */

class AuthSystem {
    constructor() {
        this.currentSection = 'landing';
        this.isProcessing = false;
        this.baseURL = this.getBaseURL();
        
        this.initializeEventListeners();
        this.initializeFormValidation();
    }

    getBaseURL() {
        // Determine the backend URL based on environment
        const protocol = window.location.protocol;
        const hostname = window.location.hostname;
        
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            const port = window.location.port || '3005';
            return `${protocol}//${hostname}:${port}`;
        }
        
        return window.location.origin;
    }

    initializeEventListeners() {
        // Form submissions
        const loginForm = document.getElementById('login-form');
        const signupForm = document.getElementById('signup-form');

        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }

        if (signupForm) {
            signupForm.addEventListener('submit', (e) => this.handleSignup(e));
        }

        // Social auth buttons
        document.querySelectorAll('.btn.social').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleSocialAuth(e));
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.showLanding();
            }
        });
    }

    initializeFormValidation() {
        // Real-time validation for email fields
        const emailInputs = document.querySelectorAll('input[type="email"]');
        emailInputs.forEach(input => {
            input.addEventListener('blur', () => this.validateEmail(input));
            input.addEventListener('input', () => this.clearError(input));
        });

        // Password strength validation
        const passwordInputs = document.querySelectorAll('input[type="password"]');
        passwordInputs.forEach(input => {
            input.addEventListener('input', () => this.validatePassword(input));
        });

        // Company name validation for signup
        const companyInput = document.getElementById('signup-company');
        if (companyInput) {
            companyInput.addEventListener('blur', () => this.validateCompany(companyInput));
        }
    }

    // Section Navigation
    showLanding() {
        this.showSection('landing');
    }

    showLogin() {
        this.showSection('login');
        // Focus on email input
        setTimeout(() => {
            const emailInput = document.getElementById('login-email');
            if (emailInput) emailInput.focus();
        }, 100);
    }

    showSignup() {
        this.showSection('signup');
        // Focus on first name input
        setTimeout(() => {
            const firstNameInput = document.getElementById('signup-first-name');
            if (firstNameInput) firstNameInput.focus();
        }, 100);
    }

    showSection(sectionName) {
        // Hide all sections
        document.querySelectorAll('.auth-section').forEach(section => {
            section.classList.remove('active');
        });

        // Show target section
        const targetSection = document.getElementById(`${sectionName}-section`);
        if (targetSection) {
            targetSection.classList.add('active');
            this.currentSection = sectionName;
        }

        // Update URL without page reload
        const url = new URL(window.location);
        if (sectionName === 'landing') {
            url.searchParams.delete('view');
        } else {
            url.searchParams.set('view', sectionName);
        }
        history.pushState({ view: sectionName }, '', url);
    }

    // Form Handlers
    async handleLogin(event) {
        event.preventDefault();
        
        if (this.isProcessing) return;

        const form = event.target;
        const formData = new FormData(form);
        
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        // Validate form
        if (!this.validateLoginForm(email, password)) {
            return;
        }

        this.setProcessing(true, 'Signing you in...');

        try {
            const response = await this.apiRequest('/api/auth/login', {
                method: 'POST',
                body: JSON.stringify({
                    email: email,
                    password: password
                })
            });

            if (response.data && response.data.user) {
                this.handleAuthSuccess(response.data.user, response.data.session);
            } else {
                this.showError(response.error?.message || 'Invalid email or password. Please try again.');
            }

        } catch (error) {
            console.error('Login error:', error);
            this.showError('Unable to sign in. Please check your connection and try again.');
        } finally {
            this.setProcessing(false);
        }
    }

    async handleSignup(event) {
        event.preventDefault();
        
        if (this.isProcessing) return;

        const firstName = document.getElementById('signup-first-name').value;
        const lastName = document.getElementById('signup-last-name').value;
        const email = document.getElementById('signup-email').value;
        const company = document.getElementById('signup-company').value;
        const password = document.getElementById('signup-password').value;
        const volume = document.getElementById('signup-volume').value;
        const termsAgreed = document.getElementById('terms-agreement').checked;

        // Validate form
        if (!this.validateSignupForm(firstName, lastName, email, company, password, volume, termsAgreed)) {
            return;
        }

        this.setProcessing(true, 'Creating your account...');

        try {
            const response = await this.apiRequest('/api/auth/signup', {
                method: 'POST',
                body: JSON.stringify({
                    email: email,
                    password: password,
                    fullName: `${firstName} ${lastName}`,
                    tenantName: company,
                    tenantSubdomain: this.generateSubdomain(company),
                    metadata: {
                        firstName,
                        lastName,
                        company,
                        monthlyVolume: volume
                    }
                })
            });

            if (response.data && response.data.user) {
                this.handleAuthSuccess(response.data.user, response.data.session);
            } else {
                this.showError(response.error?.message || 'Unable to create account. Please try again.');
            }

        } catch (error) {
            console.error('Signup error:', error);
            this.showError('Unable to create account. Please check your connection and try again.');
        } finally {
            this.setProcessing(false);
        }
    }

    async handleSocialAuth(event) {
        event.preventDefault();
        const provider = event.currentTarget.classList.contains('google') ? 'google' : 'microsoft';
        
        this.showError(`${provider.charAt(0).toUpperCase() + provider.slice(1)} authentication will be available soon. Please use email signup for now.`);
    }

    // Validation Methods
    validateLoginForm(email, password) {
        let isValid = true;

        if (!this.isValidEmail(email)) {
            this.showFieldError('login-email', 'Please enter a valid email address');
            isValid = false;
        }

        if (!password || password.length < 1) {
            this.showFieldError('login-password', 'Password is required');
            isValid = false;
        }

        return isValid;
    }

    validateSignupForm(firstName, lastName, email, company, password, volume, termsAgreed) {
        let isValid = true;

        if (!firstName || firstName.length < 2) {
            this.showFieldError('signup-first-name', 'First name must be at least 2 characters');
            isValid = false;
        }

        if (!lastName || lastName.length < 2) {
            this.showFieldError('signup-last-name', 'Last name must be at least 2 characters');
            isValid = false;
        }

        if (!this.isValidEmail(email)) {
            this.showFieldError('signup-email', 'Please enter a valid work email address');
            isValid = false;
        }

        if (!company || company.length < 2) {
            this.showFieldError('signup-company', 'Company name is required');
            isValid = false;
        }

        if (!this.isValidPassword(password)) {
            this.showFieldError('signup-password', 'Password must be at least 8 characters with letters and numbers');
            isValid = false;
        }

        if (!volume) {
            this.showFieldError('signup-volume', 'Please select your monthly shipping volume');
            isValid = false;
        }

        if (!termsAgreed) {
            this.showFieldError('terms-agreement', 'You must agree to the Terms of Service');
            isValid = false;
        }

        return isValid;
    }

    validateEmail(input) {
        const email = input.value;
        if (email && !this.isValidEmail(email)) {
            this.showFieldError(input.id, 'Please enter a valid email address');
            return false;
        }
        this.clearError(input);
        return true;
    }

    validatePassword(input) {
        const password = input.value;
        if (input.id === 'signup-password' && password) {
            if (!this.isValidPassword(password)) {
                this.showFieldError(input.id, 'Password must be at least 8 characters with letters and numbers');
                return false;
            }
        }
        this.clearError(input);
        return true;
    }

    validateCompany(input) {
        const company = input.value;
        if (company && company.length < 2) {
            this.showFieldError(input.id, 'Company name must be at least 2 characters');
            return false;
        }
        this.clearError(input);
        return true;
    }

    // Utility Methods
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    isValidPassword(password) {
        // At least 8 characters, contains letters and numbers
        return password.length >= 8 && /[a-zA-Z]/.test(password) && /[0-9]/.test(password);
    }

    generateSubdomain(companyName) {
        return companyName
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '')
            .substring(0, 20);
    }

    // API Methods
    async apiRequest(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        const response = await fetch(url, config);
        const data = await response.json();
        
        if (!response.ok) {
            // Handle API error responses
            throw new Error(data.error?.message || `HTTP ${response.status}: ${response.statusText}`);
        }

        return data;
    }

    // Success Handler
    handleAuthSuccess(user, session) {
        // Store authentication data
        if (session && session.access_token) {
            localStorage.setItem('deckstack_token', session.access_token);
            localStorage.setItem('deckstack_refresh_token', session.refresh_token);
        }
        localStorage.setItem('deckstack_user', JSON.stringify(user));

        // Determine redirect based on context
        const isSignup = this.currentSection === 'signup';
        
        if (isSignup) {
            // Show success message for new accounts
            this.showSuccess('Account created successfully! Setting up your store...');
            
            // Redirect to onboarding flow for new users
            setTimeout(() => {
                window.location.href = '/dashboard.html?view=onboarding&step=welcome';
            }, 2000);
        } else {
            // Show success message for login
            this.showSuccess('Welcome back! Redirecting to your dashboard...');
            
            // Redirect to main dashboard for existing users
            setTimeout(() => {
                window.location.href = '/dashboard.html';
            }, 2000);
        }
    }

    // UI Helper Methods
    setProcessing(processing, message = 'Processing...') {
        this.isProcessing = processing;
        
        const submitButtons = document.querySelectorAll('button[type="submit"]');
        submitButtons.forEach(btn => {
            btn.disabled = processing;
            if (processing) {
                btn.classList.add('loading');
            } else {
                btn.classList.remove('loading');
            }
        });

        if (processing) {
            this.showLoading(message);
        } else {
            this.hideLoading();
        }
    }

    showLoading(message = 'Processing...') {
        const overlay = document.getElementById('loading-overlay');
        const title = document.getElementById('loading-title');
        const messageEl = document.getElementById('loading-message');
        
        if (overlay) {
            if (title) title.textContent = 'Processing...';
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
        // Create or update error notification
        this.showNotification(message, 'error');
    }

    showSuccess(message) {
        // Create or update success notification
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

        // Add animation styles
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            .notification-content {
                display: flex;
                align-items: center;
                gap: 0.75rem;
            }
            .notification-close {
                background: none;
                border: none;
                cursor: pointer;
                padding: 0.25rem;
                margin-left: auto;
                opacity: 0.7;
            }
            .notification-close:hover {
                opacity: 1;
            }
        `;
        document.head.appendChild(style);

        document.body.appendChild(notification);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }

    showFieldError(fieldId, message) {
        const field = document.getElementById(fieldId);
        if (!field) return;

        // Add error class
        field.classList.add('error');

        // Remove existing error message
        const existingError = field.parentElement.querySelector('.form-error');
        if (existingError) {
            existingError.remove();
        }

        // Add error message
        const errorElement = document.createElement('span');
        errorElement.className = 'form-error';
        errorElement.textContent = message;
        field.parentElement.appendChild(errorElement);
    }

    clearError(field) {
        field.classList.remove('error');
        const errorElement = field.parentElement.querySelector('.form-error');
        if (errorElement) {
            errorElement.remove();
        }
    }
}

// Global functions for navigation
window.showLanding = () => {
    if (window.authSystem) {
        window.authSystem.showLanding();
    }
};

window.showLogin = () => {
    if (window.authSystem) {
        window.authSystem.showLogin();
    }
};

window.showSignup = () => {
    if (window.authSystem) {
        window.authSystem.showSignup();
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.authSystem = new AuthSystem();

    // Handle browser back/forward
    window.addEventListener('popstate', (e) => {
        const urlParams = new URLSearchParams(window.location.search);
        const view = urlParams.get('view') || 'landing';
        
        if (window.authSystem) {
            window.authSystem.showSection(view);
        }
    });

    // Check for initial view from URL
    const urlParams = new URLSearchParams(window.location.search);
    const initialView = urlParams.get('view');
    if (initialView && ['login', 'signup'].includes(initialView)) {
        window.authSystem.showSection(initialView);
    }
});