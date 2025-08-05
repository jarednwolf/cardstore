// Core domain types based on the technical design specification

export interface APIResponse<T> {
  data: T;
  meta?: {
    pagination?: PaginationMeta;
    total?: number;
  };
}

export interface APIError {
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
    timestamp: string;
    requestId: string;
  };
}

export interface PaginationMeta {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor?: string | undefined;
  endCursor?: string | undefined;
  totalCount?: number;
}

// TCG-specific types
export interface TCGAttributes {
  language?: string;
  set?: string;
  setCode?: string;
  rarity?: string;
  condition?: string;
  foil?: boolean;
  grading?: GradingInfo;
  serialNumber?: string;
  artist?: string;
  cardNumber?: string;
  manaCost?: string;
  cardType?: string;
  subType?: string;
  power?: string;
  toughness?: string;
  loyalty?: string;
  cmc?: number;
  colorIdentity?: string[];
  legalities?: Record<string, string>;
  printings?: string[];
  tcgplayerId?: number;
  scryfallId?: string;
}

export interface GradingInfo {
  company: string;
  grade: string;
  certNumber: string;
  gradedAt: Date;
  authenticator?: string;
}

// Order types
export type OrderSource = 'shopify' | 'binderpos' | 'tcgplayer' | 'ebay' | 'amazon' | 'google' | 'manual';
export type OrderStatus = 'pending' | 'processing' | 'fulfilled' | 'cancelled' | 'refunded';
export type FinancialStatus = 'pending' | 'authorized' | 'paid' | 'partially_paid' | 'refunded' | 'partially_refunded' | 'voided';
export type FulfillmentStatus = 'unfulfilled' | 'partial' | 'fulfilled';

// Inventory types
export type LocationType = 'warehouse' | 'store' | 'virtual' | 'consignment';
export type StockMovementType = 'in' | 'out' | 'transfer' | 'adjustment';
export type StockMovementReason = 'sale' | 'restock' | 'adjustment' | 'return' | 'damage' | 'transfer';

// Address type
export interface Address {
  firstName?: string;
  lastName?: string;
  company?: string;
  address1: string;
  address2?: string;
  city: string;
  province: string;
  country: string;
  zip: string;
  phone?: string;
}

// Webhook types
export interface WebhookPayload {
  id: string;
  topic: string;
  shop_domain: string;
  created_at: string;
  updated_at: string;
  api_version: string;
}

export interface ShopifyWebhookPayload extends WebhookPayload {
  payload: any;
}

// Service interfaces
export interface InventoryUpdate {
  variantId: string;
  locationId: string;
  quantityChange: number;
  reason: StockMovementReason;
  reference?: string;
}

export interface InventoryReservation {
  variantId: string;
  locationId: string;
  quantity: number;
  orderId?: string;
  expiresAt?: Date;
}

export interface ReservationResult {
  success: boolean;
  reservationId?: string;
  availableQuantity?: number;
  error?: string;
}

export interface StockMovement {
  id: string;
  variantId: string;
  locationId: string;
  type: StockMovementType;
  quantity: number;
  reason: string;
  reference?: string;
  referenceType?: string;
  unitCost?: number;
  totalCost?: number;
  createdAt: Date;
  createdBy: string;
  batchId?: string;
  notes?: string;
}

// Fulfillment types
export type BatchStatus = 'created' | 'picking' | 'picked' | 'packing' | 'shipped' | 'completed' | 'cancelled';

export interface FulfillmentBatch {
  id: string;
  batchNumber: string;
  status: BatchStatus;
  orderIds: string[];
  assignedTo?: string;
  locationId?: string;
  totalOrders: number;
  totalItems: number;
  estimatedPickTime?: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface PickList {
  id: string;
  batchId: string;
  items: PickListItem[];
  optimizedRoute?: LocationRoute[];
  estimatedTime?: number;
}

export interface PickListItem {
  variantId: string;
  sku: string;
  title: string;
  quantity: number;
  location: string;
  binLocation?: string;
  orderIds: string[];
}

export interface LocationRoute {
  locationCode: string;
  items: PickListItem[];
  sequence: number;
}

// Pricing types
export interface Price {
  variantId: string;
  channel: string;
  price: number;
  compareAtPrice?: number;
  currency: string;
  updatedAt: Date;
}

export interface PricingRule {
  id: string;
  name: string;
  channel: string;
  type: 'percentage' | 'fixed' | 'market_based';
  value: number;
  conditions: PricingCondition[];
  isActive: boolean;
}

export interface PricingCondition {
  field: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than';
  value: any;
}

export interface MarketPrice {
  variantId: string;
  source: string;
  price: number;
  currency: string;
  updatedAt: Date;
}

// Event types
export interface DomainEvent {
  eventId: string;
  eventType: string;
  aggregateId: string;
  aggregateType: string;
  eventVersion: number;
  timestamp: Date;
  tenantId: string;
  causationId?: string;
  correlationId?: string;
  metadata?: Record<string, any>;
}

export interface InventoryChangedEvent extends DomainEvent {
  eventType: 'InventoryChanged';
  eventData: {
    variantId: string;
    locationId: string;
    previousQuantity: number;
    newQuantity: number;
    changeType: StockMovementReason;
    reason?: string;
    reference?: string;
  };
}

export interface OrderCreatedEvent extends DomainEvent {
  eventType: 'OrderCreated';
  eventData: {
    orderId: string;
    source: OrderSource;
    customerId?: string;
    lineItems: Array<{
      variantId: string;
      quantity: number;
      price: number;
    }>;
    totalPrice: number;
    currency: string;
  };
}

export interface ProductUpdatedEvent extends DomainEvent {
  eventType: 'ProductUpdated';
  eventData: {
    productId: string;
    shopifyProductId?: string;
    changes: Record<string, any>;
    variants?: Array<{
      variantId: string;
      changes: Record<string, any>;
    }>;
  };
}

// Search and filter types
export interface ProductSearchQuery {
  query?: string;
  category?: string;
  vendor?: string;
  tags?: string[];
  status?: string;
  tcgAttributes?: Partial<TCGAttributes>;
  priceRange?: {
    min?: number;
    max?: number;
  };
  limit?: number;
  cursor?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface OrderSearchQuery {
  status?: OrderStatus;
  source?: OrderSource;
  customerId?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  limit?: number;
  cursor?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Bulk operation types
export interface BulkUpdateResult {
  success: number;
  failed: number;
  errors: BulkError[];
}

export interface BulkError {
  row: number;
  field?: string;
  message: string;
  data?: any;
}

export interface CSVImportResult extends BulkUpdateResult {
  fileName: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  warnings: Array<{
    row: number;
    message: string;
  }>;
}

// =============================================================================
// ENTITY TYPES (matching database schema)
// =============================================================================

export interface Tenant {
  id: string;
  name: string;
  subdomain: string;
  settings: Record<string, any>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  tenantId: string;
  email: string;
  name?: string;
  role: 'owner' | 'manager' | 'staff' | 'fulfillment';
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Product {
  id: string;
  tenantId: string;
  shopifyProductId?: string;
  title: string;
  description?: string;
  vendor?: string;
  productType?: string;
  category?: string;
  tags: string[];
  status: string;
  createdAt: Date;
  updatedAt: Date;
  variants?: ProductVariant[];
}

export interface ProductVariant {
  id: string;
  tenantId: string;
  productId: string;
  shopifyVariantId?: string;
  sku: string;
  barcode?: string;
  title: string;
  price: number;
  compareAtPrice?: number;
  weight?: number;
  weightUnit: string;
  requiresShipping: boolean;
  taxable: boolean;
  tcgAttributes: TCGAttributes;
  createdAt: Date;
  updatedAt: Date;
  product?: Product;
  inventoryItems?: InventoryItem[];
  channelPrices?: ChannelPrice[];
}

export interface InventoryLocation {
  id: string;
  tenantId: string;
  shopifyLocationId?: string;
  name: string;
  type: LocationType;
  address?: Address;
  isActive: boolean;
  createdAt: Date;
}

export interface InventoryItem {
  id: string;
  tenantId: string;
  variantId: string;
  locationId: string;
  onHand: number;
  reserved: number;
  available: number; // calculated: onHand - reserved
  safetyStock: number;
  channelBuffers: Record<string, number>;
  lastCountedAt?: Date;
  updatedAt: Date;
  variant?: ProductVariant;
  location?: InventoryLocation;
}

export interface Order {
  id: string;
  tenantId: string;
  shopifyOrderId?: string;
  externalOrderId?: string;
  orderNumber: string;
  source: OrderSource;
  customerId?: string;
  status: OrderStatus;
  financialStatus: FinancialStatus;
  fulfillmentStatus: FulfillmentStatus;
  subtotalPrice: number;
  totalTax: number;
  totalShipping: number;
  totalPrice: number;
  currency: string;
  shippingAddress?: Address;
  billingAddress?: Address;
  tags: string[];
  notes?: string;
  channelData: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  lineItems?: OrderLineItem[];
}

export interface OrderLineItem {
  id: string;
  orderId: string;
  variantId: string;
  quantity: number;
  price: number;
  totalDiscount: number;
  fulfilledQuantity: number;
  title: string;
  sku: string;
  variantTitle?: string;
  createdAt: Date;
  order?: Order;
  variant?: ProductVariant;
}

export interface ChannelPrice {
  id: string;
  variantId: string;
  channel: string;
  price: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  variant?: ProductVariant;
}

export interface WebhookLog {
  id: string;
  source: string;
  topic: string;
  payload: Record<string, any>;
  processed: boolean;
  error?: string;
  createdAt: Date;
}

// Legacy authentication types for compatibility
export interface Role {
  id: string;
  name: string;
  permissions: Permission[];
}

export interface Permission {
  resource: string;
  actions: string[];
}

export interface JWTPayload {
  userId: string;
  tenantId: string;
  roles: string[];
  iat: number;
  exp: number;
}

// HTTP types
export interface RequestContext {
  userId: string;
  tenantId: string;
  userRole: string;
  correlationId: string;
  userAgent?: string | undefined;
  ipAddress?: string | undefined;
  timestamp: Date;
}

// Configuration types
export interface ServiceConfig {
  name: string;
  version: string;
  port: number;
  environment: string;
  database: {
    url: string;
    maxConnections: number;
  };
  redis: {
    url: string;
    keyPrefix: string;
  };
  nats: {
    url: string;
    clusterId: string;
  };
  rateLimiting: {
    windowMs: number;
    maxRequests: number;
  };
}
// =============================================================================
// REQUEST/RESPONSE TYPES
// =============================================================================

export interface CreateProductRequest {
  shopifyProductId?: string;
  title: string;
  description?: string;
  vendor?: string;
  productType?: string;
  category?: string;
  tags?: string[];
  variants?: CreateVariantRequest[];
}

export interface UpdateProductRequest {
  title?: string;
  description?: string;
  vendor?: string;
  productType?: string;
  category?: string;
  tags?: string[];
  status?: string;
}

export interface CreateVariantRequest {
  sku: string;
  barcode?: string;
  title: string;
  price: number;
  compareAtPrice?: number;
  weight?: number;
  weightUnit?: string;
  requiresShipping?: boolean;
  taxable?: boolean;
  tcgAttributes?: TCGAttributes;
}

export interface UpdateVariantRequest {
  sku?: string;
  barcode?: string;
  title?: string;
  price?: number;
  compareAtPrice?: number;
  weight?: number;
  weightUnit?: string;
  requiresShipping?: boolean;
  taxable?: boolean;
  tcgAttributes?: TCGAttributes;
}

export interface CreateOrderRequest {
  externalOrderId?: string;
  source: OrderSource;
  customerId?: string;
  lineItems: CreateOrderLineItemRequest[];
  shippingAddress?: Address;
  billingAddress?: Address;
  notes?: string;
  channelData?: Record<string, any>;
}

export interface CreateOrderLineItemRequest {
  variantId: string;
  quantity: number;
  price: number;
}

export interface ProductSearchResult {
  products: Product[];
  pagination: PaginationMeta;
}

export interface OrderSearchResult {
  orders: Order[];
  pagination: PaginationMeta;
}

