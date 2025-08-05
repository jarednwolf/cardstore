# DeckStack Phase 4: Scale and Optimization Implementation Plan

## Document Information
- **Version**: 1.0
- **Date**: 2025-08-05
- **Status**: Implementation Ready
- **Owner**: Engineering Team
- **Timeline**: Weeks 18-24 (6 weeks)

## Executive Summary

Phase 4 focuses on scaling DeckStack from a production-ready application to an enterprise-grade platform capable of handling high-volume operations, advanced automation, and multiple marketplace integrations. This phase builds upon the solid foundation established in Phases 1-3.

**Key Objectives:**
- Performance optimization for high-volume operations
- Advanced marketplace connectors (Amazon/Google preparation)
- Intelligent pricing automation and rules engine
- Mobile-optimized interfaces
- Enterprise-grade monitoring and analytics
- Advanced inventory forecasting and automation
- Scalability enhancements for growth

## Phase 4 Scope Analysis

### From PRD Timeline (Weeks 18-24)
> **Phase 4: Scale and Optimization**
> - Performance optimization
> - Additional marketplace connectors (Amazon/Google)
> - Advanced pricing rules and automation
> - Mobile optimization

### Current State Assessment
✅ **Strengths (From Phase 3 Completion):**
- Multi-tenant architecture working perfectly
- Core business logic solid and tested
- API middleware comprehensive (43+ API calls tracked)
- Database performance excellent (<10ms queries)
- Order management workflow complete
- Inventory management advanced features working
- Billing system ready for scale

⚠️ **Areas for Phase 4 Enhancement:**
- Performance optimization for high-volume scenarios
- Advanced marketplace integration framework
- Intelligent pricing automation
- Mobile interface optimization
- Advanced analytics and forecasting
- Enterprise monitoring and alerting

## Phase 4 Implementation Roadmap

### Week 1: Performance Optimization Foundation
**Objective**: Optimize system performance for high-volume operations

#### Day 1-2: Database Performance Optimization
```sql
-- Advanced indexing strategy
CREATE INDEX CONCURRENTLY idx_orders_tenant_status_created 
ON orders(tenant_id, status, created_at) 
WHERE status IN ('pending', 'processing');

CREATE INDEX CONCURRENTLY idx_inventory_tenant_variant_location 
ON inventory_items(tenant_id, variant_id, location_id) 
INCLUDE (on_hand, reserved);

CREATE INDEX CONCURRENTLY idx_products_tenant_status_updated 
ON products(tenant_id, status, updated_at) 
WHERE status = 'active';

-- Partitioning for audit logs
CREATE TABLE audit_logs_2025_08 PARTITION OF audit_logs 
FOR VALUES FROM ('2025-08-01') TO ('2025-09-01');
```

#### Day 3-4: API Performance Enhancements
```typescript
// Implement advanced caching strategy
interface CacheStrategy {
  products: {
    ttl: 300; // 5 minutes
    tags: ['products', 'inventory'];
  };
  inventory: {
    ttl: 60; // 1 minute
    tags: ['inventory'];
  };
  orders: {
    ttl: 30; // 30 seconds
    tags: ['orders'];
  };
}

class PerformanceOptimizedService {
  private cache: Redis;
  
  async getProductsWithCache(
    tenantId: string,
    filters: ProductFilters
  ): Promise<Product[]> {
    const cacheKey = `products:${tenantId}:${JSON.stringify(filters)}`;
    
    // Try cache first
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
    
    // Fetch from database with optimized query
    const products = await this.prisma.product.findMany({
      where: {
        tenantId,
        ...filters,
        status: 'active'
      },
      include: {
        variants: {
          include: {
            inventory: {
              select: {
                onHand: true,
                reserved: true,
                locationId: true
              }
            }
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });
    
    // Cache result
    await this.cache.setex(cacheKey, 300, JSON.stringify(products));
    
    return products;
  }
}
```

#### Day 5: Connection Pooling and Load Balancing
```typescript
// Advanced database connection management
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  },
  log: ['query', 'info', 'warn', 'error'],
  errorFormat: 'pretty'
});

// Connection pool optimization
const connectionPool = {
  max: 20,
  min: 5,
  acquire: 30000,
  idle: 10000,
  evict: 1000
};
```

### Week 2: Advanced Marketplace Integration Framework
**Objective**: Create extensible marketplace connector architecture

#### Day 1-2: Marketplace Connector Architecture
```typescript
// Abstract marketplace connector interface
interface MarketplaceConnector {
  readonly name: string;
  readonly supportedFeatures: MarketplaceFeature[];
  
  // Product management
  listProducts(filters?: ProductFilters): Promise<MarketplaceProduct[]>;
  createListing(product: Product, options: ListingOptions): Promise<MarketplaceListing>;
  updateListing(listingId: string, updates: ListingUpdate): Promise<void>;
  deleteListing(listingId: string): Promise<void>;
  
  // Order management
  getOrders(filters?: OrderFilters): Promise<MarketplaceOrder[]>;
  updateOrderStatus(orderId: string, status: OrderStatus): Promise<void>;
  
  // Inventory sync
  updateInventory(listings: InventoryUpdate[]): Promise<void>;
  
  // Pricing
  updatePricing(listings: PriceUpdate[]): Promise<void>;
}

// Amazon marketplace connector preparation
class AmazonMarketplaceConnector implements MarketplaceConnector {
  readonly name = 'amazon';
  readonly supportedFeatures = [
    'product_listing',
    'inventory_sync',
    'order_management',
    'pricing_automation'
  ];
  
  private client: AmazonSPAPI;
  
  constructor(credentials: AmazonCredentials) {
    this.client = new AmazonSPAPI({
      region: credentials.region,
      refresh_token: credentials.refreshToken,
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret
    });
  }
  
  async createListing(
    product: Product, 
    options: AmazonListingOptions
  ): Promise<MarketplaceListing> {
    // Amazon-specific listing creation logic
    const listing = await this.client.catalog.createProduct({
      productType: 'TOYS_AND_GAMES',
      requirements: 'LISTING',
      attributes: {
        item_name: [{ value: product.title }],
        brand: [{ value: product.vendor }],
        manufacturer: [{ value: product.vendor }],
        item_type_keyword: [{ value: 'trading-cards' }],
        // TCG-specific attributes
        ...this.mapTCGAttributes(product.variants[0].tcgAttributes)
      }
    });
    
    return {
      id: listing.sku,
      marketplaceProductId: listing.asin,
      status: 'active',
      url: `https://amazon.com/dp/${listing.asin}`
    };
  }
}

// Google Shopping connector preparation
class GoogleShoppingConnector implements MarketplaceConnector {
  readonly name = 'google_shopping';
  readonly supportedFeatures = [
    'product_listing',
    'inventory_sync',
    'pricing_automation'
  ];
  
  private client: GoogleShoppingAPI;
  
  async createListing(
    product: Product,
    options: GoogleListingOptions
  ): Promise<MarketplaceListing> {
    // Google Shopping product feed creation
    const productData = {
      offerId: product.variants[0].sku,
      title: product.title,
      description: product.description,
      link: `${options.storeUrl}/products/${product.handle}`,
      imageLink: product.images?.[0]?.src,
      availability: 'in stock',
      price: {
        value: product.variants[0].price.toString(),
        currency: 'USD'
      },
      brand: product.vendor,
      condition: 'new',
      googleProductCategory: 'Toys & Games > Games > Card Games'
    };
    
    const result = await this.client.products.insert({
      merchantId: options.merchantId,
      requestBody: productData
    });
    
    return {
      id: result.data.offerId,
      marketplaceProductId: result.data.id,
      status: 'active'
    };
  }
}
```

#### Day 3-4: Marketplace Management Service
```typescript
class MarketplaceManagementService {
  private connectors: Map<string, MarketplaceConnector> = new Map();
  
  registerConnector(connector: MarketplaceConnector): void {
    this.connectors.set(connector.name, connector);
  }
  
  async syncProductToMarketplaces(
    productId: string,
    marketplaces: string[],
    context: RequestContext
  ): Promise<SyncResult[]> {
    const product = await this.getProductWithVariants(productId, context);
    const results: SyncResult[] = [];
    
    for (const marketplace of marketplaces) {
      const connector = this.connectors.get(marketplace);
      if (!connector) {
        results.push({
          marketplace,
          success: false,
          error: 'Connector not found'
        });
        continue;
      }
      
      try {
        const listing = await connector.createListing(product, {
          tenantId: context.tenantId,
          autoPublish: true
        });
        
        // Store marketplace listing reference
        await this.prisma.marketplaceListing.create({
          data: {
            tenantId: context.tenantId,
            productId: product.id,
            variantId: product.variants[0].id,
            marketplace,
            marketplaceListingId: listing.id,
            marketplaceProductId: listing.marketplaceProductId,
            status: listing.status,
            listingUrl: listing.url
          }
        });
        
        results.push({
          marketplace,
          success: true,
          listingId: listing.id
        });
      } catch (error) {
        results.push({
          marketplace,
          success: false,
          error: error.message
        });
      }
    }
    
    return results;
  }
}
```

#### Day 5: Marketplace Sync Automation
```typescript
// Automated marketplace synchronization
class MarketplaceSyncService {
  async scheduleInventorySync(): Promise<void> {
    // Run every 5 minutes
    setInterval(async () => {
      await this.syncInventoryToAllMarketplaces();
    }, 5 * 60 * 1000);
  }
  
  async syncInventoryToAllMarketplaces(): Promise<void> {
    const tenants = await this.prisma.tenant.findMany({
      where: { isActive: true }
    });
    
    for (const tenant of tenants) {
      await this.syncTenantInventory(tenant.id);
    }
  }
  
  private async syncTenantInventory(tenantId: string): Promise<void> {
    // Get all marketplace listings for tenant
    const listings = await this.prisma.marketplaceListing.findMany({
      where: { tenantId },
      include: {
        variant: {
          include: {
            inventory: true
          }
        }
      }
    });
    
    // Group by marketplace
    const listingsByMarketplace = this.groupBy(listings, 'marketplace');
    
    for (const [marketplace, marketplaceListings] of listingsByMarketplace) {
      const connector = this.marketplaceManager.getConnector(marketplace);
      if (!connector) continue;
      
      const inventoryUpdates = marketplaceListings.map(listing => ({
        listingId: listing.marketplaceListingId,
        quantity: this.calculateAvailableQuantity(listing.variant.inventory)
      }));
      
      try {
        await connector.updateInventory(inventoryUpdates);
        
        // Log successful sync
        await this.auditService.log({
          tenantId,
          action: 'inventory_sync',
          resource: 'marketplace',
          metadata: {
            marketplace,
            listingsUpdated: inventoryUpdates.length
          }
        });
      } catch (error) {
        // Log sync error
        await this.auditService.log({
          tenantId,
          action: 'inventory_sync_error',
          resource: 'marketplace',
          metadata: {
            marketplace,
            error: error.message
          }
        });
      }
    }
  }
}
```

### Week 3: Advanced Pricing Rules and Automation
**Objective**: Implement intelligent pricing automation system

#### Day 1-2: Pricing Rules Engine
```typescript
interface PricingRule {
  id: string;
  tenantId: string;
  name: string;
  priority: number;
  conditions: PricingCondition[];
  actions: PricingAction[];
  isActive: boolean;
  schedule?: PricingSchedule;
}

interface PricingCondition {
  type: 'product_category' | 'vendor' | 'inventory_level' | 'sales_velocity' | 'market_price' | 'competitor_price';
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'between';
  value: any;
}

interface PricingAction {
  type: 'set_price' | 'adjust_percentage' | 'adjust_fixed' | 'match_competitor' | 'set_margin';
  value: number;
  marketplace?: string;
}

class PricingRulesEngine {
  async evaluateAndApplyRules(
    variantId: string,
    context: RequestContext
  ): Promise<PricingResult> {
    const variant = await this.getVariantWithContext(variantId, context);
    const rules = await this.getActivePricingRules(context.tenantId);
    
    // Sort rules by priority
    const sortedRules = rules.sort((a, b) => b.priority - a.priority);
    
    const pricingResults: MarketplacePricing[] = [];
    
    for (const rule of sortedRules) {
      if (await this.evaluateConditions(rule.conditions, variant, context)) {
        const pricing = await this.applyActions(rule.actions, variant, context);
        pricingResults.push(...pricing);
      }
    }
    
    // Apply pricing updates
    for (const pricing of pricingResults) {
      await this.updateMarketplacePrice(
        variantId,
        pricing.marketplace,
        pricing.price,
        context
      );
    }
    
    return {
      variantId,
      rulesApplied: pricingResults.length,
      pricing: pricingResults
    };
  }
  
  private async evaluateConditions(
    conditions: PricingCondition[],
    variant: ProductVariant,
    context: RequestContext
  ): Promise<boolean> {
    for (const condition of conditions) {
      const result = await this.evaluateCondition(condition, variant, context);
      if (!result) return false;
    }
    return true;
  }
  
  private async evaluateCondition(
    condition: PricingCondition,
    variant: ProductVariant,
    context: RequestContext
  ): Promise<boolean> {
    switch (condition.type) {
      case 'product_category':
        return this.evaluateStringCondition(
          variant.product.category,
          condition.operator,
          condition.value
        );
        
      case 'inventory_level':
        const inventory = await this.getInventoryLevel(variant.id, context);
        return this.evaluateNumericCondition(
          inventory.available,
          condition.operator,
          condition.value
        );
        
      case 'sales_velocity':
        const velocity = await this.getSalesVelocity(variant.id, context);
        return this.evaluateNumericCondition(
          velocity,
          condition.operator,
          condition.value
        );
        
      case 'market_price':
        const marketPrice = await this.getMarketPrice(variant, context);
        return this.evaluateNumericCondition(
          marketPrice,
          condition.operator,
          condition.value
        );
        
      default:
        return false;
    }
  }
}
```

#### Day 3-4: Dynamic Pricing Strategies
```typescript
class DynamicPricingService {
  async implementCompetitorPricing(
    variantId: string,
    strategy: CompetitorPricingStrategy,
    context: RequestContext
  ): Promise<void> {
    const variant = await this.getVariant(variantId, context);
    const competitorPrices = await this.getCompetitorPrices(variant);
    
    let targetPrice: number;
    
    switch (strategy.type) {
      case 'match_lowest':
        targetPrice = Math.min(...competitorPrices.map(p => p.price));
        break;
        
      case 'undercut_by_percentage':
        const lowestPrice = Math.min(...competitorPrices.map(p => p.price));
        targetPrice = lowestPrice * (1 - strategy.percentage / 100);
        break;
        
      case 'match_average':
        const avgPrice = competitorPrices.reduce((sum, p) => sum + p.price, 0) / competitorPrices.length;
        targetPrice = avgPrice;
        break;
        
      case 'premium_positioning':
        const highestPrice = Math.max(...competitorPrices.map(p => p.price));
        targetPrice = highestPrice * (1 + strategy.premiumPercentage / 100);
        break;
    }
    
    // Apply minimum margin constraints
    const cost = await this.getProductCost(variant, context);
    const minimumPrice = cost * (1 + strategy.minimumMargin / 100);
    
    targetPrice = Math.max(targetPrice, minimumPrice);
    
    // Update pricing across all marketplaces
    await this.updateAllMarketplacePrices(variantId, targetPrice, context);
  }
  
  async implementVelocityBasedPricing(
    variantId: string,
    context: RequestContext
  ): Promise<void> {
    const salesData = await this.getSalesAnalytics(variantId, context);
    const currentPrice = await this.getCurrentPrice(variantId, context);
    
    let priceAdjustment = 0;
    
    if (salesData.velocity > salesData.targetVelocity * 1.5) {
      // High demand - increase price
      priceAdjustment = 0.05; // 5% increase
    } else if (salesData.velocity < salesData.targetVelocity * 0.5) {
      // Low demand - decrease price
      priceAdjustment = -0.05; // 5% decrease
    }
    
    if (priceAdjustment !== 0) {
      const newPrice = currentPrice * (1 + priceAdjustment);
      await this.updateAllMarketplacePrices(variantId, newPrice, context);
      
      // Log pricing decision
      await this.auditService.log({
        tenantId: context.tenantId,
        action: 'dynamic_pricing_adjustment',
        resource: 'variant',
        resourceId: variantId,
        metadata: {
          oldPrice: currentPrice,
          newPrice,
          adjustment: priceAdjustment,
          reason: 'velocity_based',
          salesVelocity: salesData.velocity
        }
      });
    }
  }
}
```

#### Day 5: Pricing Analytics and Optimization
```typescript
class PricingAnalyticsService {
  async generatePricingReport(
    tenantId: string,
    dateRange: DateRange
  ): Promise<PricingReport> {
    const priceChanges = await this.getPriceChanges(tenantId, dateRange);
    const salesImpact = await this.analyzeSalesImpact(priceChanges);
    const competitorAnalysis = await this.getCompetitorAnalysis(tenantId);
    
    return {
      summary: {
        totalPriceChanges: priceChanges.length,
        averagePriceChange: this.calculateAveragePriceChange(priceChanges),
        revenueImpact: salesImpact.revenueChange,
        marginImpact: salesImpact.marginChange
      },
      topPerformers: salesImpact.topPerformers,
      underperformers: salesImpact.underperformers,
      competitorInsights: competitorAnalysis,
      recommendations: await this.generatePricingRecommendations(tenantId)
    };
  }
  
  async generatePricingRecommendations(
    tenantId: string
  ): Promise<PricingRecommendation[]> {
    const recommendations: PricingRecommendation[] = [];
    
    // Analyze underpriced items
    const underpricedItems = await this.findUnderpricedItems(tenantId);
    for (const item of underpricedItems) {
      recommendations.push({
        type: 'increase_price',
        variantId: item.variantId,
        currentPrice: item.currentPrice,
        recommendedPrice: item.marketPrice * 0.95,
        reason: 'Priced below market average',
        expectedImpact: {
          revenueIncrease: item.estimatedRevenueIncrease,
          marginImprovement: item.estimatedMarginImprovement
        }
      });
    }
    
    // Analyze slow-moving inventory
    const slowMovingItems = await this.findSlowMovingItems(tenantId);
    for (const item of slowMovingItems) {
      recommendations.push({
        type: 'decrease_price',
        variantId: item.variantId,
        currentPrice: item.currentPrice,
        recommendedPrice: item.currentPrice * 0.9,
        reason: 'Slow inventory turnover',
        expectedImpact: {
          inventoryReduction: item.estimatedInventoryReduction,
          cashFlowImprovement: item.estimatedCashFlowImprovement
        }
      });
    }
    
    return recommendations;
  }
}
```

### Week 4: Mobile Optimization and Progressive Web App
**Objective**: Create mobile-optimized interfaces and PWA capabilities

#### Day 1-2: Mobile-First UI Components
```typescript
// Mobile-optimized inventory management
class MobileInventoryManager {
  private scanner: BarcodeScanner;
  
  async initializeMobileInterface(): Promise<void> {
    // Initialize barcode scanner
    this.scanner = new BarcodeScanner({
      formats: ['CODE_128', 'EAN_13', 'UPC_A'],
      camera: 'environment' // Use back camera
    });
    
    // Setup mobile-specific event handlers
    this.setupTouchGestures();
    this.setupOfflineCapabilities();
  }
  
  async scanAndUpdateInventory(): Promise<void> {
    try {
      const barcode = await this.scanner.scan();
      const variant = await this.findVariantByBarcode(barcode);
      
      if (variant) {
        await this.showInventoryUpdateModal(variant);
      } else {
        await this.showBarcodeNotFoundDialog(barcode);
      }
    } catch (error) {
      await this.showErrorDialog('Scanner error', error.message);
    }
  }
  
  private setupTouchGestures(): void {
    // Swipe gestures for navigation
    const hammer = new Hammer(document.body);
    
    hammer.get('swipe').set({ direction: Hammer.DIRECTION_ALL });
    
    hammer.on('swipeleft', () => {
      this.navigateToNext();
    });
    
    hammer.on('swiperight', () => {
      this.navigateToPrevious();
    });
  }
}
```

#### Day 3-4: Progressive Web App Implementation
```typescript
// Service Worker for offline capabilities
class OfflineManager {
  private cache: Cache;
  private syncQueue: SyncQueue;
  
  async initialize(): Promise<void> {
    // Register service worker
    if ('serviceWorker' in navigator) {
      await navigator.serviceWorker.register('/sw.js');
    }
    
    // Initialize cache
    this.cache = await caches.open('deckstack-v1');
    
    // Setup background sync
    this.syncQueue = new SyncQueue();
    
    // Cache essential resources
    await this.cacheEssentialResources();
  }
  
  async cacheEssentialResources(): Promise<void> {
    const essentialUrls = [
      '/',
      '/dashboard.html',
      '/inventory.html',
      '/orders.html',
      '/js/app.js',
      '/styles/main.css',
      '/api/v1/products',
      '/api/v1/inventory',
      '/api/v1/orders'
    ];
    
    await this.cache.addAll(essentialUrls);
  }
  
  async handleOfflineRequest(request: Request): Promise<Response> {
    // Try network first
    try {
      const response = await fetch(request);
      
      // Cache successful responses
      if (response.ok) {
        const responseClone = response.clone();
        await this.cache.put(request, responseClone);
      }
      
      return response;
    } catch (error) {
      // Fallback to cache
      const cachedResponse = await this.cache.match(request);
      
      if (cachedResponse) {
        return cachedResponse;
      }
      
      // Return offline page for navigation requests
      if (request.mode === 'navigate') {
        return await this.cache.match('/offline.html');
      }
      
      throw error;
    }
  }
}
```

#### Day 5: Mobile Performance Optimization
```css
/* Mobile-first responsive design */
@media (max-width: 768px) {
  .inventory-grid {
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }
  
  .product-card {
    padding: 0.75rem;
    border-radius: 8px;
  }
  
  .action-buttons {
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .data-table {
    font-size: 0.875rem;
  }
  
  .data-table th,
  .data-table td {
    padding: 0.5rem 0.25rem;
  }
}

/* Touch-friendly interface elements */
.touch-target {
  min-height: 44px;
  min-width: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mobile-fab {
  position: fixed;
  bottom: 1rem;
  right: 1rem;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--primary-color);
  color: white;
  border: none;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
}

/* Optimized loading states */
.skeleton-loader {
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: loading 1.5s infinite;
}

@keyframes loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

### Week 5: Enterprise Monitoring and Analytics
**Objective**: Implement comprehensive monitoring, alerting, and business intelligence

#### Day 1-2: Advanced Monitoring Infrastructure
```typescript
// Comprehensive metrics collection
class MetricsCollector {
  private prometheus: PrometheusRegistry;
  private counters: Map<string, Counter>;
  private histograms: Map<string, Histogram>;
  private gauges: Map<string, Gauge>;
  
  constructor() {
    this.prometheus = new PrometheusRegistry();
    this.initializeMetrics();
  }
  
  private initializeMetrics(): void {
    // API performance metrics
    this.histograms.set('api_request_duration', new Histogram({
      name: 'api_request_duration_seconds',
      help: 'API request duration in seconds',
      labelNames: ['method', 'route', 'status_code', 'tenant_id'],
      buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
    }));
    
    // Business metrics
    this.counters.set('orders_created', new Counter({
      name: 'orders_created_total',
      help: 'Total number of orders created',
      labelNames: ['tenant_id', 'source', 'status']
    }));
    
    this.gauges.set('inventory_value', new Gauge({
      name: 'inventory_value_dollars',
      help: 'Current inventory value in dollars',
      labelNames: ['tenant_id', 'location_id']
    }));
    
    // System health metrics
    this.gauges.set('database_connections', new Gauge({
      name: 'database_connections_active',
      help: 'Number of active database connections'
    }));
  }
  
  recordAPIRequest(
    method: string,
    route: string,
    statusCode: number,
    duration: number,
    tenantId: string
  ): void {
    this.histograms.get('api_request_duration')?.observe(
      { method, route, status_code: statusCode.toString(), tenant_id: tenantId },
      duration
    );
  }
  
  recordOrderCreated(tenantId: string, source: string, status: string): void {
    this.counters.get('orders_created')?.inc({
      tenant_id: tenantId,
      source,
      status
    });
  }
  
  updateInventoryValue(tenantId: string, locationId: string, value: number): void {
    this.gauges.get('inventory_value')?.set(
      { tenant_id: tenantId, location_id: locationId },
      value
    );
  }
}
```

#### Day 3-4: Business Intelligence Dashboard
```typescript
// Advanced analytics service
class BusinessIntelligenceService {
  async generateExecutiveDashboard(
    tenantId: string,
    timeframe: TimeFrame
  ): Promise<ExecutiveDashboard> {
    const [
      salesMetrics,
      inventoryMetrics,
      operationalMetrics,
      customerMetrics
    ] = await Promise.all([
      this.getSalesMetrics(tenantId, timeframe),
      this.getInventoryMetrics(tenantId, timeframe),
      this.getOperationalMetrics(tenantId, timeframe),
      this.getCustomerMetrics(tenant