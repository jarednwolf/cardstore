/**
 * API Module for CardStore Operations Layer Frontend
 * Handles all communication with the backend services
 */

class API {
    constructor() {
        this.baseURL = this.getBaseURL();
        this.timeout = 30000; // 30 seconds
    }

    getBaseURL() {
        // Determine the backend URL based on environment
        const protocol = window.location.protocol;
        const hostname = window.location.hostname;
        
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            // Use the same port as the current page (3005)
            const port = window.location.port || '3005';
            return `${protocol}//${hostname}:${port}`;
        }
        
        // For production, assume same origin
        return window.location.origin;
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            timeout: this.timeout,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer demo-token-for-testing',
                'X-Tenant-ID': 'test-tenant',
                ...options.headers
            },
            ...options
        };

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.timeout);
            
            config.signal = controller.signal;

            const response = await fetch(url, config);
            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            }
            
            return await response.text();
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('Request timeout');
            }
            throw error;
        }
    }

    // Health Check APIs
    async getHealthStatus() {
        return this.request('/health');
    }

    async getDetailedHealthCheck() {
        return this.request('/api/v1/health/detailed');
    }

    async runHealthCheck() {
        return this.request('/api/v1/health/run', { method: 'POST' });
    }

    // Onboarding APIs
    async checkPrerequisites() {
        return this.request('/api/v1/onboarding/prerequisites');
    }

    async installDependencies() {
        return this.request('/api/v1/onboarding/dependencies', { method: 'POST' });
    }

    async configureEnvironment(config) {
        return this.request('/api/v1/onboarding/environment', {
            method: 'POST',
            body: JSON.stringify(config)
        });
    }

    async setupDatabase(config) {
        return this.request('/api/v1/onboarding/database', {
            method: 'POST',
            body: JSON.stringify(config)
        });
    }

    async finalizeSetup() {
        return this.request('/api/v1/onboarding/finalize', { method: 'POST' });
    }

    async getOnboardingStatus() {
        return this.request('/api/v1/onboarding/status');
    }

    // Management APIs
    async getSystemStatus() {
        return this.request('/api/v1/system/status');
    }

    async getEnvironmentConfig() {
        return this.request('/api/v1/system/environment');
    }

    async updateEnvironmentConfig(config) {
        return this.request('/api/v1/system/environment', {
            method: 'PUT',
            body: JSON.stringify(config)
        });
    }

    async validateEnvironment() {
        return this.request('/api/v1/system/environment/validate');
    }

    async runDatabaseMigration() {
        return this.request('/api/v1/system/database/migrate', { method: 'POST' });
    }

    async startServices() {
        return this.request('/api/v1/system/services/start', { method: 'POST' });
    }

    async stopServices() {
        return this.request('/api/v1/system/services/stop', { method: 'POST' });
    }

    async restartServices() {
        return this.request('/api/v1/system/services/restart', { method: 'POST' });
    }

    async getServiceStatus() {
        return this.request('/api/v1/system/services/status');
    }

    async getLogs(service = 'app', lines = 100) {
        return this.request(`/api/v1/system/logs/${service}?lines=${lines}`);
    }

    async getMetrics() {
        return this.request('/api/v1/system/metrics');
    }

    // Orders APIs
    async getOrders(status = null) {
        const query = status ? `?status=${status}` : '';
        return this.request(`/api/v1/orders${query}`);
    }

    async getOrder(orderId) {
        return this.request(`/api/v1/orders/${orderId}`);
    }

    async updateOrder(orderId, data) {
        return this.request(`/api/v1/orders/${orderId}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    async createOrder(orderData) {
        return this.request('/api/v1/orders', {
            method: 'POST',
            body: JSON.stringify(orderData)
        });
    }

    // Shipping APIs
    async getShippingRates(orderId) {
        return this.request(`/api/v1/shipping/rates/${orderId}`);
    }

    async createShippingLabel(orderId, carrierData) {
        return this.request(`/api/v1/shipping/labels`, {
            method: 'POST',
            body: JSON.stringify({ orderId, ...carrierData })
        });
    }

    async getShippingLabel(labelId) {
        return this.request(`/api/v1/shipping/labels/${labelId}`);
    }

    async trackShipment(trackingNumber) {
        return this.request(`/api/v1/shipping/track/${trackingNumber}`);
    }

    async createBatchLabels(orderIds, carrierData) {
        return this.request('/api/v1/shipping/labels/batch', {
            method: 'POST',
            body: JSON.stringify({ orderIds, ...carrierData })
        });
    }

    async printLabels(labelIds) {
        return this.request('/api/v1/shipping/labels/print', {
            method: 'POST',
            body: JSON.stringify({ labelIds })
        });
    }

    async getCarriers() {
        return this.request('/api/v1/shipping/carriers');
    }

    async getShippingSettings() {
        return this.request('/api/v1/shipping/settings');
    }

    async updateShippingSettings(settings) {
        return this.request('/api/v1/shipping/settings', {
            method: 'PUT',
            body: JSON.stringify(settings)
        });
    }

    // Utility methods for handling responses
    handleError(error) {
        console.error('API Error:', error);
        
        if (error.message.includes('timeout')) {
            return {
                success: false,
                error: 'Request timed out. Please try again.',
                code: 'TIMEOUT'
            };
        }
        
        if (error.message.includes('Failed to fetch')) {
            return {
                success: false,
                error: 'Unable to connect to the server. Please check if the backend is running.',
                code: 'CONNECTION_ERROR'
            };
        }
        
        return {
            success: false,
            error: error.message,
            code: 'UNKNOWN_ERROR'
        };
    }

    async safeRequest(requestFn) {
        try {
            const result = await requestFn();
            return { success: true, data: result };
        } catch (error) {
            return this.handleError(error);
        }
    }
}

// WebSocket connection for real-time updates
class WebSocketManager {
    constructor() {
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        this.listeners = new Map();
    }

    connect() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const hostname = window.location.hostname;
        const port = hostname === 'localhost' || hostname === '127.0.0.1' ? `:${window.location.port || '3005'}` : '';
        const wsUrl = `${protocol}//${hostname}${port}/ws`;

        try {
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = () => {
                console.log('WebSocket connected');
                this.reconnectAttempts = 0;
                this.emit('connected');
            };

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.emit(data.type, data.payload);
                } catch (error) {
                    console.error('Failed to parse WebSocket message:', error);
                }
            };

            this.ws.onclose = () => {
                console.log('WebSocket disconnected');
                this.emit('disconnected');
                this.attemptReconnect();
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.emit('error', error);
            };
        } catch (error) {
            console.error('Failed to create WebSocket connection:', error);
        }
    }

    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
            
            setTimeout(() => {
                this.connect();
            }, this.reconnectDelay * this.reconnectAttempts);
        } else {
            console.log('Max reconnection attempts reached');
            this.emit('maxReconnectAttemptsReached');
        }
    }

    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    off(event, callback) {
        if (this.listeners.has(event)) {
            const callbacks = this.listeners.get(event);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    emit(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error('Error in WebSocket event listener:', error);
                }
            });
        }
    }

    send(type, payload) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type, payload }));
        } else {
            console.warn('WebSocket is not connected');
        }
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
}

// Activity Logger for tracking user actions
class ActivityLogger {
    constructor() {
        this.activities = [];
        this.maxActivities = 50;
    }

    log(message, type = 'info') {
        const activity = {
            id: Date.now(),
            message,
            type,
            timestamp: new Date().toISOString(),
            time: this.formatTime(new Date())
        };

        this.activities.unshift(activity);
        
        // Keep only the latest activities
        if (this.activities.length > this.maxActivities) {
            this.activities = this.activities.slice(0, this.maxActivities);
        }

        // Emit event for UI updates
        this.emit('activity', activity);
        
        return activity;
    }

    formatTime(date) {
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) { // Less than 1 minute
            return 'Just now';
        } else if (diff < 3600000) { // Less than 1 hour
            const minutes = Math.floor(diff / 60000);
            return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        } else if (diff < 86400000) { // Less than 1 day
            const hours = Math.floor(diff / 3600000);
            return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        } else {
            return date.toLocaleDateString();
        }
    }

    getActivities() {
        return this.activities;
    }

    clear() {
        this.activities = [];
        this.emit('cleared');
    }

    // Simple event emitter
    emit(event, data) {
        const customEvent = new CustomEvent(`activity:${event}`, { detail: data });
        document.dispatchEvent(customEvent);
    }
}

// Export instances
window.api = new API();
window.wsManager = new WebSocketManager();
window.activityLogger = new ActivityLogger();

// Auto-connect WebSocket when page loads
document.addEventListener('DOMContentLoaded', () => {
    // Try to connect WebSocket after a short delay
    setTimeout(() => {
        window.wsManager.connect();
    }, 1000);
});