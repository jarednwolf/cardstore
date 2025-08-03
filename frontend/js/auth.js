/**
 * Authentication Module for CardStore
 * Handles user registration, login, and session management
 */

class AuthManager {
    constructor() {
        this.currentUser = null;
        this.authToken = null;
        this.refreshToken = null;
        this.apiBaseUrl = '/api';
        
        this.initializeAuth();
    }

    async initializeAuth() {
        // Check for existing session
        this.loadStoredAuth();
        
        // Verify token if exists
        if (this.authToken) {
            const isValid = await this.verifyToken();
            if (!isValid) {
                this.clearAuth();
            }
        }
        
        // Set up auth UI
        this.setupAuthUI();
    }

    loadStoredAuth() {
        try {
            this.authToken = localStorage.getItem('cardstore_auth_token');
            this.refreshToken = localStorage.getItem('cardstore_refresh_token');
            const userData = localStorage.getItem('cardstore_user');
            if (userData) {
                this.currentUser = JSON.parse(userData);
            }
        } catch (error) {
            console.error('Error loading stored auth:', error);
            this.clearAuth();
        }
    }

    saveAuth(authData) {
        try {
            if (authData.session?.access_token) {
                this.authToken = authData.session.access_token;
                localStorage.setItem('cardstore_auth_token', this.authToken);
            }
            
            if (authData.session?.refresh_token) {
                this.refreshToken = authData.session.refresh_token;
                localStorage.setItem('cardstore_refresh_token', this.refreshToken);
            }
            
            if (authData.user) {
                this.currentUser = authData.user;
                localStorage.setItem('cardstore_user', JSON.stringify(authData.user));
            }
        } catch (error) {
            console.error('Error saving auth:', error);
        }
    }

    clearAuth() {
        this.currentUser = null;
        this.authToken = null;
        this.refreshToken = null;
        
        localStorage.removeItem('cardstore_auth_token');
        localStorage.removeItem('cardstore_refresh_token');
        localStorage.removeItem('cardstore_user');
    }

    async verifyToken() {
        if (!this.authToken) return false;
        
        try {
            const response = await fetch(`${this.apiBaseUrl}/auth/me`, {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const result = await response.json();
                if (result.data?.user) {
                    this.currentUser = result.data.user;
                    localStorage.setItem('cardstore_user', JSON.stringify(this.currentUser));
                    return true;
                }
            }
            
            return false;
        } catch (error) {
            console.error('Token verification failed:', error);
            return false;
        }
    }

    async signUp(userData) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/auth/signup`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(userData)
            });
            
            const result = await response.json();
            
            if (response.ok && result.data) {
                this.saveAuth(result.data);
                this.updateAuthUI();
                return { success: true, data: result.data };
            } else {
                return { 
                    success: false, 
                    error: result.error?.message || 'Sign up failed' 
                };
            }
        } catch (error) {
            console.error('Sign up error:', error);
            return { 
                success: false, 
                error: 'Network error. Please check your connection and try again.' 
            };
        }
    }

    async signIn(credentials) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(credentials)
            });
            
            const result = await response.json();
            
            if (response.ok && result.data) {
                this.saveAuth(result.data);
                this.updateAuthUI();
                return { success: true, data: result.data };
            } else {
                return { 
                    success: false, 
                    error: result.error?.message || 'Sign in failed' 
                };
            }
        } catch (error) {
            console.error('Sign in error:', error);
            return { 
                success: false, 
                error: 'Network error. Please check your connection and try again.' 
            };
        }
    }

    async signOut() {
        try {
            if (this.authToken) {
                await fetch(`${this.apiBaseUrl}/auth/logout`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.authToken}`,
                        'Content-Type': 'application/json'
                    }
                });
            }
        } catch (error) {
            console.error('Sign out error:', error);
        } finally {
            this.clearAuth();
            this.updateAuthUI();
            // Redirect to login
            this.showAuthModal('signin');
        }
    }

    async createTenant(tenantData) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/v1/onboarding/create-tenant`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(tenantData)
            });
            
            const result = await response.json();
            
            if (response.ok && result.data) {
                this.saveAuth(result.data);
                this.updateAuthUI();
                return { success: true, data: result.data };
            } else {
                return { 
                    success: false, 
                    error: result.error?.message || 'Store creation failed' 
                };
            }
        } catch (error) {
            console.error('Tenant creation error:', error);
            return { 
                success: false, 
                error: 'Network error. Please check your connection and try again.' 
            };
        }
    }

    async checkSubdomainAvailability(subdomain) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/v1/onboarding/check-subdomain/${subdomain}`);
            const result = await response.json();
            
            if (response.ok && result.data) {
                return { success: true, data: result.data };
            } else {
                return { 
                    success: false, 
                    error: result.error?.message || 'Failed to check subdomain' 
                };
            }
        } catch (error) {
            console.error('Subdomain check error:', error);
            return { 
                success: false, 
                error: 'Network error. Please try again.' 
            };
        }
    }

    setupAuthUI() {
        // Check if user is authenticated
        if (this.isAuthenticated()) {
            this.updateAuthUI();
        } else {
            // Show auth modal if not authenticated
            this.showAuthModal('signin');
        }
    }

    updateAuthUI() {
        // Update header with user info
        const storeStatus = document.getElementById('store-status');
        if (storeStatus && this.currentUser) {
            storeStatus.innerHTML = `
                <div class="user-info">
                    <div class="user-avatar">
                        <i class="fas fa-user"></i>
                    </div>
                    <div class="user-details">
                        <span class="user-name">${this.currentUser.email}</span>
                        <span class="user-role">Store Owner</span>
                    </div>
                    <div class="user-menu">
                        <button class="btn-icon" onclick="window.authManager.showUserMenu()">
                            <i class="fas fa-chevron-down"></i>
                        </button>
                    </div>
                </div>
            `;
        }
    }

    showAuthModal(mode = 'signin') {
        // Remove existing modal
        const existingModal = document.getElementById('auth-modal');
        if (existingModal) {
            existingModal.remove();
        }

        // Create auth modal
        const modal = document.createElement('div');
        modal.id = 'auth-modal';
        modal.className = 'auth-modal';
        modal.innerHTML = this.getAuthModalHTML(mode);
        
        document.body.appendChild(modal);
        
        // Set up event listeners
        this.setupAuthModalEvents(modal, mode);
        
        // Show modal
        setTimeout(() => modal.classList.add('show'), 10);
    }

    getAuthModalHTML(mode) {
        if (mode === 'create-store') {
            return `
                <div class="auth-modal-overlay">
                    <div class="auth-modal-content">
                        <div class="auth-header">
                            <h2>Create Your Card Store</h2>
                            <p>Set up your store and start managing your inventory</p>
                        </div>
                        <form id="create-store-form" class="auth-form">
                            <div class="form-group">
                                <label>Your Email</label>
                                <input type="email" name="email" required placeholder="you@example.com">
                            </div>
                            <div class="form-group">
                                <label>Password</label>
                                <input type="password" name="password" required placeholder="Choose a secure password">
                                <small>At least 8 characters</small>
                            </div>
                            <div class="form-group">
                                <label>Your Full Name</label>
                                <input type="text" name="fullName" required placeholder="John Doe">
                            </div>
                            <div class="form-group">
                                <label>Store Name</label>
                                <input type="text" name="tenantName" required placeholder="My Card Shop">
                            </div>
                            <div class="form-group">
                                <label>Store URL</label>
                                <div class="url-input">
                                    <input type="text" name="tenantSubdomain" required placeholder="mystore">
                                    <span>.cardstore.com</span>
                                </div>
                                <small class="subdomain-status"></small>
                            </div>
                            <button type="submit" class="btn primary large">
                                <i class="fas fa-store"></i>
                                Create My Store
                            </button>
                        </form>
                        <div class="auth-footer">
                            <p>Already have an account? <a href="#" onclick="window.authManager.showAuthModal('signin')">Sign In</a></p>
                        </div>
                    </div>
                </div>
            `;
        } else if (mode === 'signup') {
            return `
                <div class="auth-modal-overlay">
                    <div class="auth-modal-content">
                        <div class="auth-header">
                            <h2>Create Account</h2>
                            <p>Join CardStore to manage your inventory</p>
                        </div>
                        <form id="signup-form" class="auth-form">
                            <div class="form-group">
                                <label>Email</label>
                                <input type="email" name="email" required placeholder="you@example.com">
                            </div>
                            <div class="form-group">
                                <label>Password</label>
                                <input type="password" name="password" required placeholder="Choose a secure password">
                                <small>At least 8 characters</small>
                            </div>
                            <div class="form-group">
                                <label>Full Name</label>
                                <input type="text" name="fullName" required placeholder="John Doe">
                            </div>
                            <button type="submit" class="btn primary large">
                                <i class="fas fa-user-plus"></i>
                                Create Account
                            </button>
                        </form>
                        <div class="auth-footer">
                            <p>Already have an account? <a href="#" onclick="window.authManager.showAuthModal('signin')">Sign In</a></p>
                            <p>Want to create a store? <a href="#" onclick="window.authManager.showAuthModal('create-store')">Create Store</a></p>
                        </div>
                    </div>
                </div>
            `;
        } else {
            return `
                <div class="auth-modal-overlay">
                    <div class="auth-modal-content">
                        <div class="auth-header">
                            <h2>Welcome Back</h2>
                            <p>Sign in to your CardStore account</p>
                        </div>
                        <form id="signin-form" class="auth-form">
                            <div class="form-group">
                                <label>Email</label>
                                <input type="email" name="email" required placeholder="you@example.com">
                            </div>
                            <div class="form-group">
                                <label>Password</label>
                                <input type="password" name="password" required placeholder="Your password">
                            </div>
                            <button type="submit" class="btn primary large">
                                <i class="fas fa-sign-in-alt"></i>
                                Sign In
                            </button>
                        </form>
                        <div class="auth-footer">
                            <p>Don't have an account? <a href="#" onclick="window.authManager.showAuthModal('signup')">Sign Up</a></p>
                            <p>Want to create a store? <a href="#" onclick="window.authManager.showAuthModal('create-store')">Create Store</a></p>
                        </div>
                    </div>
                </div>
            `;
        }
    }

    setupAuthModalEvents(modal, mode) {
        const form = modal.querySelector('.auth-form');
        if (!form) return;

        // Handle form submission
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());
            
            // Show loading state
            const submitBtn = form.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Please wait...';
            submitBtn.disabled = true;
            
            try {
                let result;
                
                if (mode === 'create-store') {
                    result = await this.createTenant(data);
                } else if (mode === 'signup') {
                    result = await this.signUp(data);
                } else {
                    result = await this.signIn(data);
                }
                
                if (result.success) {
                    modal.remove();
                    this.showSuccessMessage(mode === 'create-store' ? 'Store created successfully!' : 'Welcome to CardStore!');
                } else {
                    this.showError(result.error);
                }
            } catch (error) {
                this.showError('Something went wrong. Please try again.');
            } finally {
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            }
        });

        // Handle subdomain checking for create-store mode
        if (mode === 'create-store') {
            const subdomainInput = form.querySelector('input[name="tenantSubdomain"]');
            const statusElement = form.querySelector('.subdomain-status');
            
            if (subdomainInput && statusElement) {
                let checkTimeout;
                subdomainInput.addEventListener('input', (e) => {
                    clearTimeout(checkTimeout);
                    const subdomain = e.target.value.trim();
                    
                    if (subdomain.length >= 3) {
                        checkTimeout = setTimeout(async () => {
                            const result = await this.checkSubdomainAvailability(subdomain);
                            if (result.success && result.data) {
                                if (result.data.available) {
                                    statusElement.innerHTML = '<i class="fas fa-check text-success"></i> Available';
                                    statusElement.className = 'subdomain-status available';
                                } else {
                                    statusElement.innerHTML = '<i class="fas fa-times text-danger"></i> Not available';
                                    statusElement.className = 'subdomain-status unavailable';
                                }
                            }
                        }, 500);
                    } else {
                        statusElement.innerHTML = '';
                        statusElement.className = 'subdomain-status';
                    }
                });
            }
        }

        // Handle modal close
        modal.addEventListener('click', (e) => {
            if (e.target === modal || e.target.classList.contains('auth-modal-overlay')) {
                // Don't allow closing if not authenticated
                if (!this.isAuthenticated()) {
                    this.showError('Please sign in to continue');
                    return;
                }
                modal.remove();
            }
        });
    }

    showUserMenu() {
        // Create user menu dropdown
        const menu = document.createElement('div');
        menu.className = 'user-menu-dropdown';
        menu.innerHTML = `
            <div class="menu-item" onclick="window.authManager.showProfile()">
                <i class="fas fa-user"></i>
                Profile
            </div>
            <div class="menu-item" onclick="window.authManager.showSettings()">
                <i class="fas fa-cog"></i>
                Settings
            </div>
            <div class="menu-divider"></div>
            <div class="menu-item" onclick="window.authManager.signOut()">
                <i class="fas fa-sign-out-alt"></i>
                Sign Out
            </div>
        `;
        
        document.body.appendChild(menu);
        
        // Position menu
        const userInfo = document.querySelector('.user-info');
        if (userInfo) {
            const rect = userInfo.getBoundingClientRect();
            menu.style.position = 'fixed';
            menu.style.top = `${rect.bottom + 5}px`;
            menu.style.right = '20px';
        }
        
        // Close menu when clicking outside
        setTimeout(() => {
            document.addEventListener('click', function closeMenu(e) {
                if (!menu.contains(e.target)) {
                    menu.remove();
                    document.removeEventListener('click', closeMenu);
                }
            });
        }, 10);
    }

    showProfile() {
        this.showInfo('Profile', 'Profile management coming soon!');
    }

    showSettings() {
        this.showInfo('Settings', 'Store settings coming soon!');
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showSuccessMessage(message) {
        this.showNotification(message, 'success');
    }

    showInfo(title, message) {
        this.showNotification(`${title}: ${message}`, 'info');
    }

    showNotification(message, type = 'info') {
        // Use existing notification system from cardshop-app.js
        if (window.cardShopApp && window.cardShopApp.showNotification) {
            window.cardShopApp.showNotification(message, type);
        } else {
            alert(message); // Fallback
        }
    }

    isAuthenticated() {
        return !!(this.authToken && this.currentUser);
    }

    getAuthHeaders() {
        return this.authToken ? {
            'Authorization': `Bearer ${this.authToken}`,
            'Content-Type': 'application/json'
        } : {
            'Content-Type': 'application/json'
        };
    }
}

// Initialize auth manager
window.authManager = new AuthManager();

// Add auth styles
const authStyles = document.createElement('style');
authStyles.textContent = `
    .auth-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 1000;
        opacity: 0;
        visibility: hidden;
        transition: all 0.3s ease;
    }
    
    .auth-modal.show {
        opacity: 1;
        visibility: visible;
    }
    
    .auth-modal-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
    }
    
    .auth-modal-content {
        background: white;
        border-radius: 12px;
        padding: 32px;
        max-width: 400px;
        width: 100%;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
    }
    
    .auth-header {
        text-align: center;
        margin-bottom: 24px;
    }
    
    .auth-header h2 {
        margin: 0 0 8px 0;
        color: var(--text-primary);
    }
    
    .auth-header p {
        margin: 0;
        color: var(--text-muted);
    }
    
    .auth-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
    }
    
    .form-group {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }
    
    .form-group label {
        font-weight: 500;
        color: var(--text-primary);
    }
    
    .form-group input {
        padding: 12px;
        border: 1px solid var(--border-color);
        border-radius: 6px;
        font-size: 14px;
    }
    
    .form-group input:focus {
        outline: none;
        border-color: var(--primary-color);
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }
    
    .form-group small {
        color: var(--text-muted);
        font-size: 12px;
    }
    
    .url-input {
        display: flex;
        align-items: center;
        border: 1px solid var(--border-color);
        border-radius: 6px;
        overflow: hidden;
    }
    
    .url-input input {
        border: none;
        flex: 1;
        padding: 12px;
    }
    
    .url-input span {
        background: var(--gray-50);
        padding: 12px;
        color: var(--text-muted);
        font-size: 14px;
    }
    
    .subdomain-status {
        font-size: 12px;
        margin-top: 4px;
    }
    
    .subdomain-status.available {
        color: var(--success-color);
    }
    
    .subdomain-status.unavailable {
        color: var(--danger-color);
    }
    
    .auth-footer {
        text-align: center;
        margin-top: 24px;
        padding-top: 24px;
        border-top: 1px solid var(--border-color);
    }
    
    .auth-footer p {
        margin: 8px 0;
        color: var(--text-muted);
    }
    
    .auth-footer a {
        color: var(--primary-color);
        text-decoration: none;
    }
    
    .auth-footer a:hover {
        text-decoration: underline;
    }
    
    .user-info {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 8px 12px;
        background: var(--gray-50);
        border-radius: 8px;
    }
    
    .user-avatar {
        width: 32px;
        height: 32px;
        background: var(--primary-color);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
    }
    
    .user-details {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }
    
    .user-name {
        font-weight: 500;
        font-size: 14px;
        color: var(--text-primary);
    }
    
    .user-role {
        font-size: 12px;
        color: var(--text-muted);
    }
    
    .user-menu-dropdown {
        background: white;
        border-radius: 8px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
        border: 1px solid var(--border-color);
        min-width: 160px;
        z-index: 1001;
    }
    
    .menu-item {
        padding: 12px 16px;
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        color: var(--text-primary);
        font-size: 14px;
    }
    
    .menu-item:hover {
        background: var(--gray-50);
    }
    
    .menu-divider {
        height: 1px;
        background: var(--border-color);
        margin: 4px 0;
    }
    
    .text-success {
        color: var(--success-color);
    }
    
    .text-danger {
        color: var(--danger-color);
    }
`;

document.head.appendChild(authStyles);