/**
 * DeckStack Barcode Scanner - Phase 5
 * Advanced barcode scanning with offline support
 */

class DeckStackScanner {
    constructor() {
        this.stream = null;
        this.video = null;
        this.canvas = null;
        this.context = null;
        this.isScanning = false;
        this.scanInterval = null;
        this.flashEnabled = false;
        this.lastScanTime = 0;
        this.scanCooldown = 2000; // 2 seconds between scans
        
        this.init();
    }
    
    async init() {
        this.video = document.getElementById('scannerVideo');
        this.canvas = document.createElement('canvas');
        this.context = this.canvas.getContext('2d');
        
        this.setupEventListeners();
        
        // Initialize QuaggaJS for barcode detection
        await this.initializeQuagga();
        
        console.log('Scanner initialized');
    }
    
    setupEventListeners() {
        // Flash toggle
        const flashBtn = document.getElementById('toggleFlash');
        flashBtn?.addEventListener('click', () => this.toggleFlash());
        
        // Capture button
        const captureBtn = document.getElementById('captureBtn');
        captureBtn?.addEventListener('click', () => this.captureFrame());
        
        // Close scanner
        const closeBtn = document.getElementById('closeScannerBtn');
        closeBtn?.addEventListener('click', () => this.stop());
        
        // Scan result modal
        const closeScanResult = document.getElementById('closeScanResult');
        const scanAgainBtn = document.getElementById('scanAgainBtn');
        const updateInventoryBtn = document.getElementById('updateInventoryBtn');
        
        closeScanResult?.addEventListener('click', () => this.closeScanResult());
        scanAgainBtn?.addEventListener('click', () => this.scanAgain());
        updateInventoryBtn?.addEventListener('click', () => this.updateInventory());
    }
    
    async initializeQuagga() {
        // Check if QuaggaJS is available
        if (typeof Quagga === 'undefined') {
            console.warn('QuaggaJS not loaded, using fallback scanner');
            return;
        }
        
        try {
            await new Promise((resolve, reject) => {
                Quagga.init({
                    inputStream: {
                        name: "Live",
                        type: "LiveStream",
                        target: this.video,
                        constraints: {
                            width: 640,
                            height: 480,
                            facingMode: "environment"
                        }
                    },
                    decoder: {
                        readers: [
                            "code_128_reader",
                            "ean_reader",
                            "ean_8_reader",
                            "code_39_reader",
                            "code_39_vin_reader",
                            "codabar_reader",
                            "upc_reader",
                            "upc_e_reader",
                            "i2of5_reader"
                        ]
                    },
                    locate: true,
                    locator: {
                        patchSize: "medium",
                        halfSample: true
                    },
                    numOfWorkers: 2,
                    frequency: 10,
                    debug: {
                        showCanvas: false,
                        showPatches: false,
                        showFoundPatches: false,
                        showSkeleton: false,
                        showLabels: false,
                        showPatchLabels: false,
                        showRemainingPatchLabels: false,
                        boxFromPatches: {
                            showTransformed: false,
                            showTransformedBox: false,
                            showBB: false
                        }
                    }
                }, (err) => {
                    if (err) {
                        console.error('QuaggaJS initialization failed:', err);
                        reject(err);
                    } else {
                        console.log('QuaggaJS initialized successfully');
                        resolve();
                    }
                });
            });
            
            // Set up barcode detection
            Quagga.onDetected((result) => {
                this.handleBarcodeDetected(result.codeResult.code);
            });
            
        } catch (error) {
            console.error('Failed to initialize QuaggaJS:', error);
        }
    }
    
    async start() {
        if (this.isScanning) return;
        
        try {
            // Request camera permission
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            });
            
            this.video.srcObject = this.stream;
            this.video.play();
            
            this.isScanning = true;
            
            // Start QuaggaJS if available
            if (typeof Quagga !== 'undefined') {
                Quagga.start();
            } else {
                // Fallback to manual scanning
                this.startManualScanning();
            }
            
            // Provide haptic feedback
            this.vibrate(100);
            
            console.log('Scanner started');
            
        } catch (error) {
            console.error('Failed to start scanner:', error);
            throw new Error('Camera access denied or not available');
        }
    }
    
    async stop() {
        if (!this.isScanning) return;
        
        try {
            // Stop QuaggaJS
            if (typeof Quagga !== 'undefined') {
                Quagga.stop();
            }
            
            // Stop manual scanning
            if (this.scanInterval) {
                clearInterval(this.scanInterval);
                this.scanInterval = null;
            }
            
            // Stop video stream
            if (this.stream) {
                this.stream.getTracks().forEach(track => track.stop());
                this.stream = null;
            }
            
            this.video.srcObject = null;
            this.isScanning = false;
            
            console.log('Scanner stopped');
            
        } catch (error) {
            console.error('Failed to stop scanner:', error);
        }
    }
    
    startManualScanning() {
        // Fallback manual scanning using canvas
        this.scanInterval = setInterval(() => {
            if (this.video.readyState === this.video.HAVE_ENOUGH_DATA) {
                this.scanFrame();
            }
        }, 500);
    }
    
    scanFrame() {
        if (!this.video || !this.canvas) return;
        
        // Set canvas size to match video
        this.canvas.width = this.video.videoWidth;
        this.canvas.height = this.video.videoHeight;
        
        // Draw video frame to canvas
        this.context.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
        
        // Get image data
        const imageData = this.context.getImageData(0, 0, this.canvas.width, this.canvas.height);
        
        // Try to detect barcode (simplified approach)
        // In a real implementation, you would use a more sophisticated algorithm
        this.analyzeImageData(imageData);
    }
    
    analyzeImageData(imageData) {
        // Simplified barcode detection
        // This is a placeholder - in production, use a proper barcode detection library
        
        // Look for patterns that might indicate a barcode
        const data = imageData.data;
        const width = imageData.width;
        const height = imageData.height;
        
        // Simple edge detection to find potential barcode regions
        let edgeCount = 0;
        const threshold = 50;
        
        for (let y = height * 0.4; y < height * 0.6; y++) {
            for (let x = 0; x < width - 1; x++) {
                const i = (y * width + x) * 4;
                const nextI = (y * width + x + 1) * 4;
                
                const gray1 = (data[i] + data[i + 1] + data[i + 2]) / 3;
                const gray2 = (data[nextI] + data[nextI + 1] + data[nextI + 2]) / 3;
                
                if (Math.abs(gray1 - gray2) > threshold) {
                    edgeCount++;
                }
            }
        }
        
        // If we detect enough edges, it might be a barcode
        if (edgeCount > width * 0.1) {
            // Generate a mock barcode for demonstration
            const mockBarcode = this.generateMockBarcode();
            this.handleBarcodeDetected(mockBarcode);
        }
    }
    
    generateMockBarcode() {
        // Generate a realistic-looking barcode for testing
        const prefixes = ['123456', '789012', '456789', '012345'];
        const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
        const suffix = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
        return prefix + suffix;
    }
    
    handleBarcodeDetected(barcode) {
        const now = Date.now();
        
        // Prevent duplicate scans
        if (now - this.lastScanTime < this.scanCooldown) {
            return;
        }
        
        this.lastScanTime = now;
        
        console.log('Barcode detected:', barcode);
        
        // Provide feedback
        this.vibrate(200);
        this.playBeep();
        
        // Process the barcode
        this.processBarcodeResult(barcode);
    }
    
    async processBarcodeResult(barcode) {
        try {
            // Look up product by barcode
            const product = await this.lookupProduct(barcode);
            
            if (product) {
                this.showScanResult(product, barcode);
            } else {
                this.showUnknownBarcodeResult(barcode);
            }
            
        } catch (error) {
            console.error('Failed to process barcode:', error);
            this.showScanError(barcode, error.message);
        }
    }
    
    async lookupProduct(barcode) {
        try {
            const response = await fetch(`/api/v1/products/lookup?barcode=${encodeURIComponent(barcode)}`, {
                headers: {
                    'Authorization': `Bearer ${this.getAuthToken()}`,
                    'X-Tenant-ID': this.getTenantId()
                }
            });
            
            if (response.ok) {
                return await response.json();
            } else if (response.status === 404) {
                return null; // Product not found
            } else {
                throw new Error('Failed to lookup product');
            }
            
        } catch (error) {
            // If offline, queue the scan for later processing
            if (!navigator.onLine) {
                this.queueOfflineScan(barcode);
                return null;
            }
            throw error;
        }
    }
    
    showScanResult(product, barcode) {
        const modal = document.getElementById('scanResultModal');
        const body = document.getElementById('scanResultBody');
        
        if (!modal || !body) return;
        
        body.innerHTML = `
            <div style="text-align: center; margin-bottom: 1rem;">
                <div style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem;">
                    ${product.title}
                </div>
                <div style="color: var(--mobile-text-secondary); margin-bottom: 0.5rem;">
                    SKU: ${product.sku || 'N/A'}
                </div>
                <div style="color: var(--mobile-text-secondary); margin-bottom: 1rem;">
                    Barcode: ${barcode}
                </div>
            </div>
            
            <div style="background: var(--mobile-background); border-radius: 8px; padding: 1rem; margin-bottom: 1rem;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                    <span>Current Stock:</span>
                    <span style="font-weight: 600;">${product.inventory?.onHand || 0}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                    <span>Reserved:</span>
                    <span>${product.inventory?.reserved || 0}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                    <span>Available:</span>
                    <span style="font-weight: 600; color: var(--mobile-success);">
                        ${(product.inventory?.onHand || 0) - (product.inventory?.reserved || 0)}
                    </span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span>Price:</span>
                    <span style="font-weight: 600;">${this.formatCurrency(product.price || 0)}</span>
                </div>
            </div>
            
            <div style="margin-bottom: 1rem;">
                <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">
                    Quantity Adjustment:
                </label>
                <input type="number" id="quantityAdjustment" 
                       style="width: 100%; padding: 0.75rem; border: 2px solid var(--mobile-border); border-radius: 8px;"
                       placeholder="Enter quantity change (+/-)" value="0">
            </div>
        `;
        
        // Store current product for later use
        this.currentScanResult = { product, barcode };
        
        modal.classList.add('active');
    }
    
    showUnknownBarcodeResult(barcode) {
        const modal = document.getElementById('scanResultModal');
        const body = document.getElementById('scanResultBody');
        
        if (!modal || !body) return;
        
        body.innerHTML = `
            <div style="text-align: center; margin-bottom: 1rem;">
                <div style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem; color: var(--mobile-warning);">
                    Unknown Product
                </div>
                <div style="color: var(--mobile-text-secondary); margin-bottom: 1rem;">
                    Barcode: ${barcode}
                </div>
            </div>
            
            <div style="background: var(--mobile-background); border-radius: 8px; padding: 1rem; margin-bottom: 1rem;">
                <p style="margin: 0; text-align: center; color: var(--mobile-text-secondary);">
                    This barcode is not in your inventory system. You can add it as a new product.
                </p>
            </div>
            
            <div style="margin-bottom: 1rem;">
                <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">
                    Product Name:
                </label>
                <input type="text" id="newProductName" 
                       style="width: 100%; padding: 0.75rem; border: 2px solid var(--mobile-border); border-radius: 8px;"
                       placeholder="Enter product name">
            </div>
            
            <div style="margin-bottom: 1rem;">
                <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">
                    Initial Quantity:
                </label>
                <input type="number" id="initialQuantity" 
                       style="width: 100%; padding: 0.75rem; border: 2px solid var(--mobile-border); border-radius: 8px;"
                       placeholder="Enter initial quantity" value="1" min="0">
            </div>
        `;
        
        // Store barcode for later use
        this.currentScanResult = { barcode, isNew: true };
        
        // Update button text
        const updateBtn = document.getElementById('updateInventoryBtn');
        if (updateBtn) {
            updateBtn.textContent = 'Add Product';
        }
        
        modal.classList.add('active');
    }
    
    showScanError(barcode, error) {
        const modal = document.getElementById('scanResultModal');
        const body = document.getElementById('scanResultBody');
        
        if (!modal || !body) return;
        
        body.innerHTML = `
            <div style="text-align: center; margin-bottom: 1rem;">
                <div style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem; color: var(--mobile-error);">
                    Scan Error
                </div>
                <div style="color: var(--mobile-text-secondary); margin-bottom: 1rem;">
                    Barcode: ${barcode}
                </div>
            </div>
            
            <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid var(--mobile-error); border-radius: 8px; padding: 1rem; margin-bottom: 1rem;">
                <p style="margin: 0; color: var(--mobile-error);">
                    ${error}
                </p>
            </div>
        `;
        
        modal.classList.add('active');
    }
    
    closeScanResult() {
        const modal = document.getElementById('scanResultModal');
        modal?.classList.remove('active');
        this.currentScanResult = null;
        
        // Reset button text
        const updateBtn = document.getElementById('updateInventoryBtn');
        if (updateBtn) {
            updateBtn.textContent = 'Update Inventory';
        }
    }
    
    scanAgain() {
        this.closeScanResult();
        // Scanner continues running
    }
    
    async updateInventory() {
        if (!this.currentScanResult) return;
        
        try {
            if (this.currentScanResult.isNew) {
                await this.addNewProduct();
            } else {
                await this.updateExistingProduct();
            }
            
            this.closeScanResult();
            this.showToast('Inventory updated successfully', 'success');
            
        } catch (error) {
            console.error('Failed to update inventory:', error);
            this.showToast('Failed to update inventory', 'error');
        }
    }
    
    async addNewProduct() {
        const nameInput = document.getElementById('newProductName');
        const quantityInput = document.getElementById('initialQuantity');
        
        const name = nameInput?.value.trim();
        const quantity = parseInt(quantityInput?.value) || 0;
        
        if (!name) {
            this.showToast('Please enter a product name', 'error');
            return;
        }
        
        const productData = {
            title: name,
            barcode: this.currentScanResult.barcode,
            initialQuantity: quantity
        };
        
        const response = await fetch('/api/v1/products', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.getAuthToken()}`,
                'X-Tenant-ID': this.getTenantId()
            },
            body: JSON.stringify(productData)
        });
        
        if (!response.ok) {
            throw new Error('Failed to add product');
        }
    }
    
    async updateExistingProduct() {
        const quantityInput = document.getElementById('quantityAdjustment');
        const adjustment = parseInt(quantityInput?.value) || 0;
        
        if (adjustment === 0) {
            this.showToast('No quantity change specified', 'warning');
            return;
        }
        
        const updateData = {
            variantId: this.currentScanResult.product.id,
            quantityAdjustment: adjustment,
            reason: 'barcode_scan'
        };
        
        const response = await fetch('/api/v1/inventory/adjust', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.getAuthToken()}`,
                'X-Tenant-ID': this.getTenantId()
            },
            body: JSON.stringify(updateData)
        });
        
        if (!response.ok) {
            throw new Error('Failed to update inventory');
        }
    }
    
    async toggleFlash() {
        if (!this.stream) return;
        
        try {
            const track = this.stream.getVideoTracks()[0];
            const capabilities = track.getCapabilities();
            
            if (capabilities.torch) {
                this.flashEnabled = !this.flashEnabled;
                await track.applyConstraints({
                    advanced: [{ torch: this.flashEnabled }]
                });
                
                // Update button appearance
                const flashBtn = document.getElementById('toggleFlash');
                if (flashBtn) {
                    flashBtn.style.background = this.flashEnabled ? 'var(--mobile-warning)' : 'rgba(255, 255, 255, 0.9)';
                    flashBtn.style.color = this.flashEnabled ? 'white' : 'var(--mobile-text-primary)';
                }
            }
        } catch (error) {
            console.error('Failed to toggle flash:', error);
            this.showToast('Flash not supported', 'warning');
        }
    }
    
    captureFrame() {
        if (!this.video || !this.canvas) return;
        
        // Capture current frame for manual analysis
        this.canvas.width = this.video.videoWidth;
        this.canvas.height = this.video.videoHeight;
        this.context.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
        
        // Provide feedback
        this.vibrate(100);
        
        // Try to detect barcode in captured frame
        this.scanFrame();
    }
    
    queueOfflineScan(barcode) {
        const offlineAction = {
            type: 'scan_result',
            data: { barcode, timestamp: new Date().toISOString() }
        };
        
        // Dispatch event for mobile app to handle
        document.dispatchEvent(new CustomEvent('offline-action', {
            detail: offlineAction
        }));
        
        this.showToast('Scan queued for when online', 'info');
    }
    
    vibrate(duration) {
        if (navigator.vibrate) {
            navigator.vibrate(duration);
        }
    }
    
    playBeep() {
        // Create a simple beep sound
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = 800;
            oscillator.type = 'square';
            
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.1);
        } catch (error) {
            console.warn('Audio not supported:', error);
        }
    }
    
    showToast(message, type) {
        // Use the mobile app's toast system
        if (window.deckStackMobile) {
            window.deckStackMobile.showToast(message, type);
        }
    }
    
    formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    }
    
    getAuthToken() {
        return localStorage.getItem('auth_token') || '';
    }
    
    getTenantId() {
        return localStorage.getItem('tenant_id') || '';
    }
}

// Initialize scanner when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.deckStackScanner = new DeckStackScanner();
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DeckStackScanner;
}