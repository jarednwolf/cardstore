/**
 * System Management Module
 * Handles system administration, service management, and configuration
 */

class SystemManagement {
    constructor() {
        this.services = [];
        this.environmentConfig = null;
        this.isProcessing = false;
        this.logViewers = new Map();
        
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Listen for service status updates
        window.wsManager.on('serviceStatusUpdate', (data) => {
            this.updateServiceStatus(data);
        });

        // Listen for log updates
        window.wsManager.on('logUpdate', (data) => {
            this.updateLogViewer(data);
        });

        // Listen for system metrics updates
        window.wsManager.on('metricsUpdate', (data) => {
            this.updateMetrics(data);
        });
    }

    async initialize() {
        await this.loadSystemStatus();
        await this.loadEnvironmentConfig();
        window.activityLogger.log('System management initialized', 'info');
    }

    async loadSystemStatus() {
        try {
            const result = await window.api.safeRequest(() => window.api.getSystemStatus());
            
            if (result.success) {
                this.updateSystemStatusDisplay(result.data);
            } else {
                this.showError('Failed to load system status: ' + result.error);
            }
        } catch (error) {
            this.showError('Error loading system status: ' + error.message);
        }
    }

    async loadEnvironmentConfig() {
        try {
            const result = await window.api.safeRequest(() => window.api.getEnvironmentConfig());
            
            if (result.success) {
                this.environmentConfig = result.data;
                this.updateEnvironmentDisplay(result.data);
            } else {
                this.showError('Failed to load environment config: ' + result.error);
            }
        } catch (error) {
            this.showError('Error loading environment config: ' + error.message);
        }
    }

    // Database Management
    async runDatabaseMigration() {
        if (this.isProcessing) return;
        
        const confirmed = await this.showConfirmDialog(
            'Run Database Migration',
            'This will apply any pending database migrations. Are you sure you want to continue?'
        );
        
        if (!confirmed) return;
        
        this.setProcessing(true, 'Running database migrations...');
        
        try {
            const result = await window.api.safeRequest(() => window.api.runDatabaseMigration());
            
            if (result.success) {
                this.showSuccess('Database migrations completed successfully');
                window.activityLogger.log('Database migrations completed', 'success');
            } else {
                this.showError('Database migration failed: ' + result.error);
                window.activityLogger.log('Database migration failed: ' + result.error, 'error');
            }
        } finally {
            this.setProcessing(false);
        }
    }

    async openPrismaStudio() {
        try {
            // This would typically open Prisma Studio in a new tab
            const studioUrl = 'http://localhost:5555';
            window.open(studioUrl, '_blank');
            window.activityLogger.log('Opened Prisma Studio', 'info');
        } catch (error) {
            this.showError('Failed to open Prisma Studio: ' + error.message);
        }
    }

    // Environment Configuration Management
    async showEnvironmentConfig() {
        if (!this.environmentConfig) {
            await this.loadEnvironmentConfig();
        }

        const modalContent = this.generateEnvironmentConfigModal();
        this.showModal('Environment Configuration', modalContent, () => {
            this.saveEnvironmentConfig();
        });
    }

    generateEnvironmentConfigModal() {
        if (!this.environmentConfig) {
            return '<p>Unable to load environment configuration.</p>';
        }

        const envGroups = this.groupEnvironmentVariables(this.environmentConfig);
        
        let html = '<div class="env-config">';
        
        Object.entries(envGroups).forEach(([groupName, variables]) => {
            html += `
                <div class="env-group">
                    <h4>${groupName}</h4>
                    ${variables.map(variable => this.generateEnvVariableInput(variable)).join('')}
                </div>
            `;
        });
        
        html += '</div>';
        return html;
    }

    groupEnvironmentVariables(config) {
        const groups = {
            'Application': [],
            'Database': [],
            'Security': [],
            'Integrations': [],
            'Monitoring': [],
            'Other': []
        };

        Object.entries(config).forEach(([key, value]) => {
            let group = 'Other';
            
            if (key.includes('DATABASE') || key.includes('REDIS') || key.includes('DB_')) {
                group = 'Database';
            } else if (key.includes('JWT') || key.includes('SECRET') || key.includes('KEY')) {
                group = 'Security';
            } else if (key.includes('SHOPIFY') || key.includes('TCGPLAYER') || key.includes('BINDER')) {
                group = 'Integrations';
            } else if (key.includes('PROMETHEUS') || key.includes('GRAFANA') || key.includes('METRICS')) {
                group = 'Monitoring';
            } else if (key.includes('NODE_ENV') || key.includes('PORT') || key.includes('API_')) {
                group = 'Application';
            }
            
            groups[group].push({ key, value, isSet: value !== undefined && value !== '' });
        });

        // Remove empty groups
        Object.keys(groups).forEach(key => {
            if (groups[key].length === 0) {
                delete groups[key];
            }
        });

        return groups;
    }

    generateEnvVariableInput(variable) {
        const isSecret = variable.key.toLowerCase().includes('secret') || 
                        variable.key.toLowerCase().includes('password') ||
                        variable.key.toLowerCase().includes('key');
        
        const inputType = isSecret ? 'password' : 'text';
        const displayValue = isSecret && variable.value ? '••••••••' : variable.value || '';
        
        return `
            <div class="env-item">
                <div class="env-key">${variable.key}</div>
                <input type="${inputType}" 
                       class="form-input env-input" 
                       data-key="${variable.key}"
                       value="${displayValue}"
                       placeholder="Not set">
                <span class="env-status ${variable.isSet ? 'set' : 'missing'}">
                    ${variable.isSet ? 'SET' : 'MISSING'}
                </span>
            </div>
        `;
    }

    async saveEnvironmentConfig() {
        const envInputs = document.querySelectorAll('.env-input');
        const updates = {};
        
        envInputs.forEach(input => {
            const key = input.dataset.key;
            const value = input.value;
            
            // Only include changed values
            if (value !== '' && value !== '••••••••') {
                updates[key] = value;
            }
        });

        if (Object.keys(updates).length === 0) {
            this.closeModal();
            return;
        }

        this.setProcessing(true, 'Updating environment configuration...');
        
        try {
            const result = await window.api.safeRequest(() => window.api.updateEnvironmentConfig(updates));
            
            if (result.success) {
                this.showSuccess('Environment configuration updated successfully');
                this.environmentConfig = { ...this.environmentConfig, ...updates };
                window.activityLogger.log('Environment configuration updated', 'success');
                this.closeModal();
            } else {
                this.showError('Failed to update environment: ' + result.error);
            }
        } finally {
            this.setProcessing(false);
        }
    }

    async validateEnvironment() {
        this.setProcessing(true, 'Validating environment configuration...');
        
        try {
            const result = await window.api.safeRequest(() => window.api.validateEnvironment());
            
            if (result.success) {
                const validation = result.data;
                this.showValidationResults(validation);
                window.activityLogger.log('Environment validation completed', 'info');
            } else {
                this.showError('Environment validation failed: ' + result.error);
            }
        } finally {
            this.setProcessing(false);
        }
    }

    showValidationResults(validation) {
        const modalContent = `
            <div class="validation-results">
                <div class="validation-summary">
                    <h4>Validation Summary</h4>
                    <p>Valid: ${validation.valid ? 'Yes' : 'No'}</p>
                    <p>Issues Found: ${validation.issues ? validation.issues.length : 0}</p>
                </div>
                
                ${validation.issues && validation.issues.length > 0 ? `
                    <div class="validation-issues">
                        <h4>Issues</h4>
                        <ul>
                            ${validation.issues.map(issue => `<li>${issue}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
                
                ${validation.recommendations && validation.recommendations.length > 0 ? `
                    <div class="validation-recommendations">
                        <h4>Recommendations</h4>
                        <ul>
                            ${validation.recommendations.map(rec => `<li>${rec}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
            </div>
        `;
        
        this.showModal('Environment Validation Results', modalContent);
    }

    // Docker Services Management
    async startServices() {
        const confirmed = await this.showConfirmDialog(
            'Start Services',
            'This will start all Docker services. Continue?'
        );
        
        if (!confirmed) return;
        
        this.setProcessing(true, 'Starting services...');
        
        try {
            const result = await window.api.safeRequest(() => window.api.startServices());
            
            if (result.success) {
                this.showSuccess('Services started successfully');
                window.activityLogger.log('Services started', 'success');
                await this.loadSystemStatus();
            } else {
                this.showError('Failed to start services: ' + result.error);
            }
        } finally {
            this.setProcessing(false);
        }
    }

    async stopServices() {
        const confirmed = await this.showConfirmDialog(
            'Stop Services',
            'This will stop all Docker services. This may interrupt ongoing operations. Continue?'
        );
        
        if (!confirmed) return;
        
        this.setProcessing(true, 'Stopping services...');
        
        try {
            const result = await window.api.safeRequest(() => window.api.stopServices());
            
            if (result.success) {
                this.showSuccess('Services stopped successfully');
                window.activityLogger.log('Services stopped', 'success');
                await this.loadSystemStatus();
            } else {
                this.showError('Failed to stop services: ' + result.error);
            }
        } finally {
            this.setProcessing(false);
        }
    }

    async restartServices() {
        const confirmed = await this.showConfirmDialog(
            'Restart Services',
            'This will restart all Docker services. This may cause temporary downtime. Continue?'
        );
        
        if (!confirmed) return;
        
        this.setProcessing(true, 'Restarting services...');
        
        try {
            const result = await window.api.safeRequest(() => window.api.restartServices());
            
            if (result.success) {
                this.showSuccess('Services restarted successfully');
                window.activityLogger.log('Services restarted', 'success');
                await this.loadSystemStatus();
            } else {
                this.showError('Failed to restart services: ' + result.error);
            }
        } finally {
            this.setProcessing(false);
        }
    }

    // Monitoring and Logs
    async openGrafana() {
        try {
            const grafanaUrl = 'http://localhost:3001';
            window.open(grafanaUrl, '_blank');
            window.activityLogger.log('Opened Grafana dashboard', 'info');
        } catch (error) {
            this.showError('Failed to open Grafana: ' + error.message);
        }
    }

    async viewLogs(service = 'app') {
        try {
            const result = await window.api.safeRequest(() => window.api.getLogs(service, 100));
            
            if (result.success) {
                this.showLogViewer(service, result.data);
                window.activityLogger.log(`Viewing logs for ${service}`, 'info');
            } else {
                this.showError('Failed to load logs: ' + result.error);
            }
        } catch (error) {
            this.showError('Error loading logs: ' + error.message);
        }
    }

    showLogViewer(service, logs) {
        const logContent = Array.isArray(logs) ? logs.join('\n') : logs;
        const formattedLogs = this.formatLogs(logContent);
        
        const modalContent = `
            <div class="log-viewer-container">
                <div class="log-viewer-header">
                    <h4>Logs for ${service}</h4>
                    <div class="log-controls">
                        <button class="btn secondary" onclick="window.systemManagement.refreshLogs('${service}')">
                            <i class="fas fa-sync"></i> Refresh
                        </button>
                        <button class="btn secondary" onclick="window.systemManagement.downloadLogs('${service}')">
                            <i class="fas fa-download"></i> Download
                        </button>
                    </div>
                </div>
                <div class="log-viewer" id="log-viewer-${service}">
                    ${formattedLogs}
                </div>
            </div>
        `;
        
        this.showModal(`${service} Logs`, modalContent, null, 'large');
    }

    formatLogs(logs) {
        return logs.split('\n').map(line => {
            let className = 'log-line';
            
            if (line.toLowerCase().includes('error')) {
                className += ' error';
            } else if (line.toLowerCase().includes('warn')) {
                className += ' warning';
            } else if (line.toLowerCase().includes('info')) {
                className += ' info';
            } else if (line.toLowerCase().includes('success')) {
                className += ' success';
            }
            
            return `<div class="${className}">${this.escapeHtml(line)}</div>`;
        }).join('');
    }

    async refreshLogs(service) {
        const logViewer = document.getElementById(`log-viewer-${service}`);
        if (logViewer) {
            logViewer.innerHTML = '<div class="spinner"></div> Loading logs...';
            
            try {
                const result = await window.api.safeRequest(() => window.api.getLogs(service, 100));
                
                if (result.success) {
                    const logContent = Array.isArray(result.data) ? result.data.join('\n') : result.data;
                    logViewer.innerHTML = this.formatLogs(logContent);
                } else {
                    logViewer.innerHTML = `<div class="error">Failed to load logs: ${result.error}</div>`;
                }
            } catch (error) {
                logViewer.innerHTML = `<div class="error">Error loading logs: ${error.message}</div>`;
            }
        }
    }

    downloadLogs(service) {
        const logViewer = document.getElementById(`log-viewer-${service}`);
        if (logViewer) {
            const logText = logViewer.textContent;
            const blob = new Blob([logText], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `${service}-logs-${new Date().toISOString().split('T')[0]}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            URL.revokeObjectURL(url);
            window.activityLogger.log(`Downloaded logs for ${service}`, 'success');
        }
    }

    // UI Helper Methods
    updateSystemStatusDisplay(data) {
        // Update system status cards with real data
        if (data.services) {
            this.services = data.services;
            this.updateServiceCards(data.services);
        }
    }

    updateServiceCards(services) {
        // Update service status indicators in the management view
        services.forEach(service => {
            const serviceCard = document.querySelector(`[data-service="${service.name}"]`);
            if (serviceCard) {
                const statusIndicator = serviceCard.querySelector('.service-status');
                if (statusIndicator) {
                    statusIndicator.className = `service-status ${service.status}`;
                    statusIndicator.textContent = service.status.toUpperCase();
                }
            }
        });
    }

    updateEnvironmentDisplay(config) {
        // Update environment configuration display
        const envCards = document.querySelectorAll('.env-status-card');
        envCards.forEach(card => {
            const envKey = card.dataset.envKey;
            if (config[envKey]) {
                card.classList.add('configured');
                card.classList.remove('missing');
            } else {
                card.classList.add('missing');
                card.classList.remove('configured');
            }
        });
    }

    updateServiceStatus(serviceUpdate) {
        if (serviceUpdate && serviceUpdate.service) {
            const serviceCard = document.querySelector(`[data-service="${serviceUpdate.service}"]`);
            if (serviceCard) {
                const statusIndicator = serviceCard.querySelector('.service-status');
                if (statusIndicator) {
                    statusIndicator.className = `service-status ${serviceUpdate.status}`;
                    statusIndicator.textContent = serviceUpdate.status.toUpperCase();
                }
            }
        }
    }

    updateLogViewer(logUpdate) {
        if (logUpdate && logUpdate.service) {
            const logViewer = document.getElementById(`log-viewer-${logUpdate.service}`);
            if (logViewer) {
                const newLogLine = `<div class="log-line">${this.escapeHtml(logUpdate.message)}</div>`;
                logViewer.innerHTML += newLogLine;
                logViewer.scrollTop = logViewer.scrollHeight;
            }
        }
    }

    updateMetrics(metricsData) {
        // Update system metrics display
        if (metricsData) {
            // Update CPU, memory, disk usage, etc.
            console.log('Metrics update:', metricsData);
        }
    }

    // Utility Methods
    setProcessing(processing, message = 'Processing...') {
        this.isProcessing = processing;
        
        if (processing) {
            showLoading('Processing', message);
        } else {
            hideLoading();
        }
    }

    showSuccess(message) {
        // Show success notification
        console.log('Success:', message);
        // Implement toast notification
    }

    showError(message) {
        // Show error notification
        console.error('Error:', message);
        // Implement toast notification
    }

    async showConfirmDialog(title, message) {
        return new Promise((resolve) => {
            const modalContent = `
                <div class="confirm-dialog">
                    <p>${message}</p>
                </div>
            `;
            
            this.showModal(title, modalContent, () => {
                resolve(true);
            });
            
            // Add cancel handler
            const modal = document.getElementById('modal');
            const cancelBtn = modal.querySelector('.btn.secondary');
            if (cancelBtn) {
                cancelBtn.onclick = () => {
                    this.closeModal();
                    resolve(false);
                };
            }
        });
    }

    showModal(title, content, onConfirm = null, size = 'normal') {
        const modal = document.getElementById('modal');
        const modalTitle = document.getElementById('modal-title');
        const modalBody = document.getElementById('modal-body');
        const modalFooter = document.getElementById('modal-footer');
        const confirmBtn = document.getElementById('modal-confirm');
        
        modalTitle.textContent = title;
        modalBody.innerHTML = content;
        
        if (onConfirm) {
            confirmBtn.style.display = 'block';
            confirmBtn.onclick = onConfirm;
        } else {
            confirmBtn.style.display = 'none';
        }
        
        modal.classList.remove('hidden');
        
        if (size === 'large') {
            modal.querySelector('.modal-content').style.maxWidth = '90vw';
        }
    }

    closeModal() {
        const modal = document.getElementById('modal');
        modal.classList.add('hidden');
        
        // Reset modal size
        modal.querySelector('.modal-content').style.maxWidth = '';
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize system management when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.systemManagement = new SystemManagement();
});

// Global functions
window.runDatabaseMigration = () => {
    if (window.systemManagement) {
        window.systemManagement.runDatabaseMigration();
    }
};

window.openPrismaStudio = () => {
    if (window.systemManagement) {
        window.systemManagement.openPrismaStudio();
    }
};

window.showEnvironmentConfig = () => {
    if (window.systemManagement) {
        window.systemManagement.showEnvironmentConfig();
    }
};

window.validateEnvironment = () => {
    if (window.systemManagement) {
        window.systemManagement.validateEnvironment();
    }
};

window.startServices = () => {
    if (window.systemManagement) {
        window.systemManagement.startServices();
    }
};

window.stopServices = () => {
    if (window.systemManagement) {
        window.systemManagement.stopServices();
    }
};

window.restartServices = () => {
    if (window.systemManagement) {
        window.systemManagement.restartServices();
    }
};

window.openGrafana = () => {
    if (window.systemManagement) {
        window.systemManagement.openGrafana();
    }
};

window.viewLogs = (service = 'app') => {
    if (window.systemManagement) {
        window.systemManagement.viewLogs(service);
    }
};

window.closeModal = () => {
    if (window.systemManagement) {
        window.systemManagement.closeModal();
    }
};