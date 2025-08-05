import { Request } from 'express';

export interface User {
  id: string;
  email: string;
  name: string;
  tenantId: string;
  role: "owner" | "manager" | "staff" | "fulfillment";
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
}

export interface AuthenticatedRequest extends Request {
  user?: User;
  tenantId?: string;
  userId?: string;
  context?: RequestContext;
}

export interface RequestContext {
  user: User;
  tenantId: string;
  ipAddress: string;
  userAgent: string;
  userId?: string;
  userRole?: string;
  correlationId?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface FilterParams {
  startDate?: string;
  endDate?: string;
  category?: string;
  status?: string;
}

export interface SortParams {
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface QueryParams extends PaginationParams, FilterParams, SortParams {
  search?: string;
}

// JWT and Auth types
export interface JWTPayload {
  userId: string;
  tenantId: string;
  role: string;
  roles?: string[];
  iat?: number;
  exp?: number;
}

// Product types
export interface Product {
  id: string;
  title: string;
  description?: string;
  category?: string;
  vendor?: string;
  productType?: string;
  tags: string;
  status: string;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductVariant {
  id: string;
  productId: string;
  title: string;
  sku: string;
  price: number;
  compareAtPrice?: number;
  weight?: number;
  weightUnit?: string;
  inventoryTracked: boolean;
  inventoryPolicy: string;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProductRequest {
  title: string;
  description?: string;
  category?: string;
  vendor?: string;
  productType?: string;
  tags?: string[];
  variants: CreateVariantRequest[];
}

export interface UpdateProductRequest {
  title?: string;
  description?: string;
  category?: string;
  vendor?: string;
  productType?: string;
  tags?: string[];
}

export interface CreateVariantRequest {
  title: string;
  sku: string;
  price: number;
  compareAtPrice?: number;
  weight?: number;
  weightUnit?: string;
  inventoryTracked?: boolean;
  inventoryPolicy?: string;
}

export interface UpdateVariantRequest {
  title?: string;
  sku?: string;
  price?: number;
  compareAtPrice?: number;
  weight?: number;
  weightUnit?: string;
  inventoryTracked?: boolean;
  inventoryPolicy?: string;
}

export interface ProductSearchQuery {
  search?: string;
  category?: string;
  vendor?: string;
  status?: string;
  tags?: string[];
  priceMin?: number;
  priceMax?: number;
  page?: number;
  limit?: number;
}

export interface ProductSearchResult {
  products: Product[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface TCGAttributes {
  set?: string;
  rarity?: string;
  condition?: string;
  language?: string;
  foil?: boolean;
}

export interface BulkUpdateResult {
  updated: number;
  failed: number;
  errors: string[];
}

// Order types
export interface Order {
  id: string;
  orderNumber: string;
  customerId?: string;
  status: OrderStatus;
  financialStatus: FinancialStatus;
  fulfillmentStatus: FulfillmentStatus;
  source: OrderSource;
  subtotalPrice: number;
  totalTax: number;
  totalShipping: number;
  totalPrice: number;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderLineItem {
  id: string;
  orderId: string;
  variantId: string;
  quantity: number;
  price: number;
  totalPrice: number;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateOrderRequest {
  customerId?: string;
  source: OrderSource;
  lineItems: CreateOrderLineItemRequest[];
  shippingAddress?: Address;
  billingAddress?: Address;
  notes?: string;
}

export interface CreateOrderLineItemRequest {
  variantId: string;
  quantity: number;
  price?: number;
}

export interface OrderSearchQuery {
  search?: string;
  status?: OrderStatus;
  financialStatus?: FinancialStatus;
  fulfillmentStatus?: FulfillmentStatus;
  source?: OrderSource;
  customerId?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

export interface OrderSearchResult {
  orders: Order[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
export type FinancialStatus = 'pending' | 'authorized' | 'paid' | 'partially_paid' | 'refunded' | 'partially_refunded';
export type FulfillmentStatus = 'unfulfilled' | 'partial' | 'fulfilled' | 'shipped' | 'delivered';
export type OrderSource = 'online' | 'pos' | 'shopify' | 'ebay' | 'tcgplayer' | 'manual';

// Inventory types
export interface InventoryUpdate {
  variantId: string;
  locationId: string;
  quantity: number;
  reason?: string;
}

export interface InventoryReservation {
  id: string;
  variantId: string;
  locationId: string;
  quantity: number;
  orderId?: string;
  expiresAt: Date;
  tenantId: string;
  createdAt: Date;
}

export interface ReservationResult {
  success: boolean;
  reservationId?: string;
  availableQuantity?: number;
  error?: string;
}

// Address type
export interface Address {
  firstName: string;
  lastName: string;
  company?: string;
  address1: string;
  address2?: string;
  city: string;
  province: string;
  country: string;
  zip: string;
  phone?: string;
}

// Tenant type
export interface Tenant {
  id: string;
  name: string;
  subdomain: string;
  settings: any;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Alias for compatibility
export type APIResponse<T = any> = ApiResponse<T>;