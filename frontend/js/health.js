/**
 * Health Check Dashboard Module
 * Handles system health monitoring and diagnostics
 */

class HealthDashboard {
    constructor() {
        this.healthData = null;
        this.isRunning = false;
        this.autoRefresh = false;
        this.refreshInterval = null;
        this.refreshRate = 30000; // 30 seconds
        
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Listen for WebSocket health updates
        window.wsManager.on('healthUpdate', (data) => {
            this.updateHealthDisplay(data);
        });

        // Listen for real-time service status updates
        window.wsManager.on('serviceStatusUpdate', (data) => {
            this.updateServiceStatus(data);
        });
    }

    async runHealthCheck() {
        if (this.isRunning) {
            return;
        }

        this.isRunning = true;
        this.updateRunButton();
        
        window.activityLogger.log('Starting health check', 'info');
        
        try {
            // Show loading state
            this.showLoadingState();
            
            // Run comprehensive health check
            const result = await window.api.safeRequest(() => window.api.runHealthCheck());
            
            if (result.success) {
                this.healthData = result.data;
                this.updateHealthDisplay(result.data);
                window.activityLogger.log('Health check completed', 'success');
            } else {
                this.showErrorState(result.error);
                window.activityLogger.log(`Health check failed: ${result.error}`, 'error');
            }
        } catch (error) {
            this.showErrorState(error.message);
            window.activityLogger.log(`Health check error: ${error.message}`, 'error');
        } finally {
            this.isRunning = false;
            this.updateRunButton();
        }
    }

    async loadInitialHealth() {
        try {
            const result = await window.api.safeRequest(() => window.api.getHealthStatus());
            
            if (result.success) {
                this.healthData = result.data;
                this.updateHealthDisplay(result.data);
            } else {
                this.showErrorState(result.error);
            }
        } catch (error) {
            this.showErrorState(error.message);
        }
    }

    updateHealthDisplay(data) {
        this.updateHealthSummary(data);
        this.updateHealthCategories(data);
        this.updateServiceStatuses(data);
    }

    updateHealthSummary(data) {
        if (!data || !data.checks) {
            return;
        }

        const checks = Array.isArray(data.checks) ? data.checks : Object.values(data.checks).flat();
        const healthy = checks.filter(check => check.status === 'healthy').length;
        const warnings = checks.filter(check => check.status === 'warning').length;
        const errors = checks.filter(check => check.status === 'unhealthy' || check.status === 'error').length;
        const total = checks.length;

        const healthScore = total > 0 ? Math.round((healthy / total) * 100) : 0;

        // Update health score
        const scoreElement = document.getElementById('health-score');
        if (scoreElement) {
            scoreElement.textContent = `${healthScore}%`;
            
            // Update score circle color based on health
            const scoreCircle = scoreElement.closest('.score-circle');
            if (scoreCircle) {
                scoreCircle.style.setProperty('--score', healthScore);
                
                let color = 'var(--success-color)';
                if (healthScore < 60) {
                    color = 'var(--danger-color)';
                } else if (healthScore < 80) {
                    color = 'var(--warning-color)';
                }
                
                scoreCircle.style.background = `conic-gradient(${color} 0deg, ${color} ${healthScore * 3.6}deg, var(--gray-200) ${healthScore * 3.6}deg)`;
            }
        }

        // Update stats
        this.updateStatValue('healthy-count', healthy);
        this.updateStatValue('warning-count', warnings);
        this.updateStatValue('error-count', errors);
    }

    updateStatValue(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = value;
        }
    }

    updateHealthCategories(data) {
        const categoriesContainer = document.getElementById('health-categories');
        if (!categoriesContainer || !data) {
            return;
        }

        // Group checks by category
        const categories = this.groupChecksByCategory(data);
        
        categoriesContainer.innerHTML = '';
        
        Object.entries(categories).forEach(([categoryName, checks]) => {
            const categoryElement = this.createCategoryElement(categoryName, checks);
            categoriesContainer.appendChild(categoryElement);
        });
    }

    groupChecksByCategory(data) {
        const categories = {
            'Environment': [],
            'Prerequisites': [],
            'Project Structure': [],
            'Services': [],
            'Database': [],
            'System': []
        };

        if (data.checks) {
            const checks = Array.isArray(data.checks) ? data.checks : Object.values(data.checks).flat();
            
            checks.forEach(check => {
                let category = 'System';
                
                if (check.name.toLowerCase().includes('environment') || check.name.toLowerCase().includes('.env')) {
                    category = 'Environment';
                } else if (check.name.toLowerCase().includes('node') || check.name.toLowerCase().includes('npm') || check.name.toLowerCase().includes('docker')) {
                    category = 'Prerequisites';
                } else if (check.name.toLowerCase().includes('file') || check.name.toLowerCase().includes('package.json') || check.name.toLowerCase().includes('schema')) {
                    category = 'Project Structure';
                } else if (check.name.toLowerCase().includes('localhost') || check.name.toLowerCase().includes('service')) {
                    category = 'Services';
                } else if (check.name.toLowerCase().includes('database') || check.name.toLowerCase().includes('postgres') || check.name.toLowerCase().includes('redis')) {
                    category = 'Database';
                }
                
                categories[category].push(check);
            });
        }

        // Remove empty categories
        Object.keys(categories).forEach(key => {
            if (categories[key].length === 0) {
                delete categories[key];
            }
        });

        return categories;
    }

    createCategoryElement(categoryName, checks) {
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'health-category';
        
        const healthyCount = checks.filter(c => c.status === 'healthy').length;
        const totalCount = checks.length;
        const categoryStatus = healthyCount === totalCount ? 'healthy' : 
                             healthyCount > totalCount / 2 ? 'warning' : 'error';
        
        categoryDiv.innerHTML = `
            <div class="category-header">
                <h3>${categoryName} (${healthyCount}/${totalCount})</h3>
            </div>
            <div class="category-content">
                ${checks.map(check => this.createCheckElement(check)).join('')}
            </div>
        `;
        
        return categoryDiv;
    }

    createCheckElement(check) {
        const status = check.status === 'healthy' ? 'healthy' : 
                      check.status === 'warning' ? 'warning' : 'error';
        
        const icon = status === 'healthy' ? 'fa-check-circle' : 
                    status === 'warning' ? 'fa-exclamation-triangle' : 'fa-times-circle';
        
        return `
            <div class="health-check-item">
                <div class="check-info">
                    <i class="fas ${icon} check-icon ${status}"></i>
                    <div class="check-details">
                        <div class="check-name">${check.name}</div>
                        <div class="check-message">${check.message || 'No additional information'}</div>
                    </div>
                </div>
                <div class="check-status">
                    <span class="status-badge ${status}">${status.toUpperCase()}</span>
                </div>
            </div>
        `;
    }

    updateServiceStatuses(data) {
        // Update service status in dashboard if visible
        const serviceItems = document.querySelectorAll('.service-item');
        
        if (data && data.services) {
            serviceItems.forEach(item => {
                const serviceName = item.querySelector('span').textContent.toLowerCase();
                const statusBadge = item.querySelector('.status-badge');
                
                const serviceData = data.services.find(s => 
                    s.name.toLowerCase().includes(serviceName) || 
                    serviceName.includes(s.name.toLowerCase())
                );
                
                if (serviceData && statusBadge) {
                    const status = serviceData.status === 'healthy' ? 'healthy' : 'error';
                    statusBadge.className = `status-badge ${status}`;
                    statusBadge.textContent = status.toUpperCase();
                }
            });
        }
    }

    showLoadingState() {
        const categoriesContainer = document.getElementById('health-categories');
        if (categoriesContainer) {
            categoriesContainer.innerHTML = `
                <div class="loading-state">
                    <div class="spinner-large"></div>
                    <h3>Running Health Check</h3>
                    <p>Checking system components and services...</p>
                </div>
            `;
        }

        // Reset summary
        this.updateStatValue('health-score', '--');
        this.updateStatValue('healthy-count', '--');
        this.updateStatValue('warning-count', '--');
        this.updateStatValue('error-count', '--');
    }

    showErrorState(error) {
        const categoriesContainer = document.getElementById('health-categories');
        if (categoriesContainer) {
            categoriesContainer.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>Health Check Failed</h3>
                    <p>${error}</p>
                    <button class="btn primary" onclick="runHealthCheck()">
                        <i class="fas fa-sync"></i>
                        Try Again
                    </button>
                </div>
            `;
        }
    }

    updateRunButton() {
        const runButton = document.querySelector('.health-header .btn');
        if (runButton) {
            if (this.isRunning) {
                runButton.disabled = true;
                runButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Running...';
            } else {
                runButton.disabled = false;
                runButton.innerHTML = '<i class="fas fa-sync"></i> Run Health Check';
            }
        }
    }

    startAutoRefresh() {
        if (this.refreshInterval) {
            return;
        }

        this.autoRefresh = true;
        this.refreshInterval = setInterval(() => {
            if (!this.isRunning) {
                this.loadInitialHealth();
            }
        }, this.refreshRate);

        window.activityLogger.log('Auto-refresh enabled', 'info');
    }

    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }

        this.autoRefresh = false;
        window.activityLogger.log('Auto-refresh disabled', 'info');
    }

    toggleAutoRefresh() {
        if (this.autoRefresh) {
            this.stopAutoRefresh();
        } else {
            this.startAutoRefresh();
        }
    }

    exportHealthReport() {
        if (!this.healthData) {
            window.activityLogger.log('No health data to export', 'warning');
            return;
        }

        const report = {
            timestamp: new Date().toISOString(),
            healthData: this.healthData,
            summary: this.generateHealthSummary()
        };

        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `health-report-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
        window.activityLogger.log('Health report exported', 'success');
    }

    generateHealthSummary() {
        if (!this.healthData || !this.healthData.checks) {
            return null;
        }

        const checks = Array.isArray(this.healthData.checks) ? this.healthData.checks : Object.values(this.healthData.checks).flat();
        const healthy = checks.filter(check => check.status === 'healthy').length;
        const warnings = checks.filter(check => check.status === 'warning').length;
        const errors = checks.filter(check => check.status === 'unhealthy' || check.status === 'error').length;
        const total = checks.length;

        return {
            totalChecks: total,
            healthyChecks: healthy,
            warningChecks: warnings,
            errorChecks: errors,
            healthScore: total > 0 ? Math.round((healthy / total) * 100) : 0,
            overallStatus: errors > 0 ? 'unhealthy' : warnings > 0 ? 'warning' : 'healthy'
        };
    }

    // Real-time updates
    updateServiceStatus(serviceUpdate) {
        if (!serviceUpdate || !serviceUpdate.service) {
            return;
        }

        // Update service status in real-time
        const serviceItems = document.querySelectorAll('.service-item');
        serviceItems.forEach(item => {
            const serviceName = item.querySelector('span').textContent.toLowerCase();
            
            if (serviceName.includes(serviceUpdate.service.toLowerCase())) {
                const statusBadge = item.querySelector('.status-badge');
                if (statusBadge) {
                    const status = serviceUpdate.status === 'healthy' ? 'healthy' : 'error';
                    statusBadge.className = `status-badge ${status}`;
                    statusBadge.textContent = status.toUpperCase();
                }
            }
        });

        window.activityLogger.log(`Service ${serviceUpdate.service} status: ${serviceUpdate.status}`, 'info');
    }

    // Initialize dashboard when view becomes active
    initialize() {
        this.loadInitialHealth();
        
        // Start auto-refresh if not already running
        if (!this.autoRefresh) {
            this.startAutoRefresh();
        }
    }

    // Cleanup when leaving the view
    cleanup() {
        this.stopAutoRefresh();
    }
}

// Initialize health dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.healthDashboard = new HealthDashboard();
});

// Global functions
window.runHealthCheck = () => {
    if (window.healthDashboard) {
        window.healthDashboard.runHealthCheck();
    }
};

window.toggleAutoRefresh = () => {
    if (window.healthDashboard) {
        window.healthDashboard.toggleAutoRefresh();
    }
};

window.exportHealthReport = () => {
    if (window.healthDashboard) {
        window.healthDashboard.exportHealthReport();
    }
};