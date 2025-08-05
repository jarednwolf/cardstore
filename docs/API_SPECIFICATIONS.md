# CardStore Operations Layer - API Specifications

## Document Information
- **Version**: 1.0
- **Date**: 2025-08-02
- **Status**: Draft
- **Owner**: Engineering Team
- **Related Documents**: [Technical Design](./TECHNICAL_DESIGN.md), [PRD](./PRD.md)

## Table of Contents
1. [API Overview](#api-overview)
2. [Authentication](#authentication)
3. [Common Patterns](#common-patterns)
4. [Catalog API](#catalog-api)
5. [Inventory API](#inventory-api)
6. [Order API](#order-api)
7. [Fulfillment API](#fulfillment-api)
8. [Pricing API](#pricing-api)
9. [Reporting API](#reporting-api)
10. [Webhook API](#webhook-api)
11. [Error Handling](#error-handling)

## API Overview

### Base URL
- **Production**: `https://api.cardstore.com/v1`
- **Staging**: `https://api-staging.cardstore.com/v1`
- **Development**: `http://localhost:3000/api/v1`

### API Design Principles
- **RESTful**: Resource-based URLs with standard HTTP methods
- **JSON First**: All requests and responses use JSON
- **Consistent**: Uniform response formats and error handling
- **Versioned**: URL path versioning (`/v1/`, `/v2/`)
- **Paginated**: Cursor-based pagination for large datasets
- **Filtered**: Query parameter-based filtering and sorting

### Content Types
- **Request**: `application/json`
- **Response**: `application/json`
- **File Upload**: `multipart/form-data`

## Authentication

### Bearer Token Authentication
```http
Authorization: Bearer <jwt_token>
```

### API Key Authentication (for service-to-service)
```http
X-API-Key: <api_key>
X-API-Secret: <api_secret>
```

### Authentication Endpoints
```yaml
POST /auth/login
POST /auth/refresh
POST /auth/logout
GET  /auth/me
```

#### Login Request
```json
POST /auth/login
{
  "email": "user@example.com",
  "password": "password123",
  "tenantId": "uuid"
}
```

#### Login Response
```json
{
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "refresh_token_here",
    "expiresIn": 3600,
    "user": {
      "id": "user-uuid",
      "email": "user@example.com",
      "roles": ["inventory_manager"],
      "tenantId": "tenant-uuid"
    }
  }
}
```

## Common Patterns

### Standard Response Format
```typescript
interface APIResponse<T> {
  data: T;
  meta?: {
    pagination?: PaginationMeta;
    total?: number;
    filters?: Record<string, any>;
  };
}

interface PaginationMeta {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor?: string;
  endCursor?: string;
  totalCount?: number;
}
```

### Error Response Format
```typescript
interface APIError {
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
    timestamp: string;
    requestId: string;
    path: string;
  };
}
```

### Query Parameters
```typescript
interface CommonQueryParams {
  // Pagination
  first?: number;        // Number of items to return (default: 20, max: 100)
  after?: string;        // Cursor for pagination
  
  // Sorting
  sort?: string;         // Field to sort by
  order?: 'asc' | 'desc'; // Sort order (default: asc)
  
  // Filtering
  filter?: string;       // JSON-encoded filter object
  search?: string;       // Full-text search query
  
  // Field selection
  fields?: string;       // Comma-separated list of fields to include
}
```

## Catalog API

### Products

#### List Products
```http
GET /products
```

**Query Parameters:**
```typescript
interface ProductListParams extends CommonQueryParams {
  status?: 'active' | 'draft' | 'archived';
  category?: string;
  vendor?: string;
  tags?: string;           // Comma-separated tags
  hasVariants?: boolean;
  createdAfter?: string;   // ISO 8601 date
  updatedAfter?: string;   // ISO 8601 date
}
```

**Response:**
```json
{
  "data": [
    {
      "id": "product-uuid",
      "shopifyProductId": 123456789,
      "title": "Black Lotus",
      "description": "The most powerful card in Magic",
      "vendor": "Wizards of the Coast",
      "category": "Magic: The Gathering",
      "status": "active",
      "tags": ["alpha", "power-nine", "rare"],
      "variantCount": 3,
      "createdAt": "2025-01-01T00:00:00Z",
      "updatedAt": "2025-01-15T12:00:00Z"
    }
  ],
  "meta": {
    "pagination": {
      "hasNextPage": true,
      "hasPreviousPage": false,
      "startCursor": "cursor1",
      "endCursor": "cursor2",
      "totalCount": 1500
    }
  }
}
```

#### Get Product
```http
GET /products/{id}
```

**Response:**
```json
{
  "data": {
    "id": "product-uuid",
    "shopifyProductId": 123456789,
    "title": "Black Lotus",
    "description": "The most powerful card in Magic",
    "vendor": "Wizards of the Coast",
    "category": "Magic: The Gathering",
    "status": "active",
    "tags": ["alpha", "power-nine", "rare"],
    "seoTitle": "Black Lotus - Alpha - Magic: The Gathering",
    "seoDescription": "Buy Black Lotus from Alpha set...",
    "variants": [
      {
        "id": "variant-uuid",
        "shopifyVariantId": 987654321,
        "sku": "MTG-ALP-BL-NM",
        "title": "Near Mint",
        "price": 25000.00,
        "compareAtPrice": 30000.00,
        "tcgAttributes": {
          "set": "Alpha",
          "condition": "Near Mint",
          "language": "English",
          "foil": false
        },
        "inventory": {
          "totalOnHand": 1,
          "totalReserved": 0,
          "totalAvailable": 1
        }
      }
    ],
    "createdAt": "2025-01-01T00:00:00Z",
    "updatedAt": "2025-01-15T12:00:00Z"
  }
}
```

#### Create Product
```http
POST /products
```

**Request:**
```json
{
  "title": "Lightning Bolt",
  "description": "Deal 3 damage to any target",
  "vendor": "Wizards of the Coast",
  "category": "Magic: The Gathering",
  "tags": ["instant", "red", "damage"],
  "variants": [
    {
      "sku": "MTG-LEB-LB-NM",
      "title": "Near Mint",
      "price": 150.00,
      "tcgAttributes": {
        "set": "Beta",
        "condition": "Near Mint",
        "language": "English"
      }
    }
  ]
}
```

#### Update Product
```http
PUT /products/{id}
```

#### Delete Product
```http
DELETE /products/{id}
```

### Product Variants

#### List Variants
```http
GET /variants
GET /products/{productId}/variants
```

**Query Parameters:**
```typescript
interface VariantListParams extends CommonQueryParams {
  productId?: string;
  sku?: string;
  barcode?: string;
  status?: 'active' | 'draft' | 'archived';
  priceMin?: number;
  priceMax?: number;
  hasInventory?: boolean;
  tcgSet?: string;
  tcgCondition?: string;
  tcgLanguage?: string;
}
```

#### Get Variant
```http
GET /variants/{id}
```

#### Update Variant
```http
PUT /variants/{id}
```

#### Update TCG Attributes
```http
PUT /variants/{id}/tcg-attributes
```

**Request:**
```json
{
  "language": "English",
  "set": "Alpha",
  "setCode": "LEA",
  "rarity": "Rare",
  "condition": "Near Mint",
  "foil": false,
  "grading": {
    "company": "PSA",
    "grade": "10",
    "certNumber": "12345678"
  },
  "serialNumber": "001/100"
}
```

#### Bulk Update Variants
```http
POST /variants/bulk
```

**Request:**
```json
{
  "updates": [
    {
      "id": "variant-uuid-1",
      "price": 100.00,
      "tcgAttributes": {
        "condition": "Lightly Played"
      }
    },
    {
      "id": "variant-uuid-2",
      "price": 200.00
    }
  ]
}
```

**Response:**
```json
{
  "data": {
    "processed": 2,
    "successful": 2,
    "failed": 0,
    "errors": []
  }
}
```

### Search

#### Search Products
```http
GET /search/products
```

**Query Parameters:**
```typescript
interface ProductSearchParams {
  q: string;              // Search query
  category?: string;
  vendor?: string;
  priceMin?: number;
  priceMax?: number;
  tcgSet?: string;
  tcgCondition?: string;
  tcgLanguage?: string;
  sort?: 'relevance' | 'price' | 'name' | 'created';
  order?: 'asc' | 'desc';
  first?: number;
  after?: string;
}
```

## Inventory API

### Inventory Items

#### Get Inventory
```http
GET /inventory
GET /inventory/{variantId}
```

**Query Parameters:**
```typescript
interface InventoryListParams extends CommonQueryParams {
  variantId?: string;
  locationId?: string;
  sku?: string;
  lowStock?: boolean;      // Items at or below safety stock
  negativeStock?: boolean; // Items with negative available quantity
  hasReservations?: boolean;
}
```

**Response:**
```json
{
  "data": [
    {
      "id": "inventory-uuid",
      "variantId": "variant-uuid",
      "locationId": "location-uuid",
      "variant": {
        "id": "variant-uuid",
        "sku": "MTG-ALP-BL-NM",
        "title": "Black Lotus - Near Mint"
      },
      "location": {
        "id": "location-uuid",
        "name": "Main Warehouse",
        "type": "warehouse"
      },
      "onHand": 5,
      "reserved": 2,
      "available": 3,
      "safetyStock": 1,
      "channelBuffers": {
        "ebay": 1,
        "amazon": 0
      },
      "averageCost": 20000.00,
      "lastCountedAt": "2025-01-15T10:00:00Z",
      "updatedAt": "2025-01-15T14:30:00Z"
    }
  ]
}
```

#### Update Inventory
```http
PUT /inventory/{variantId}
POST /inventory/bulk
```

**Single Update Request:**
```json
{
  "locationId": "location-uuid",
  "quantityChange": 10,
  "reason": "restock",
  "reference": "PO-12345",
  "unitCost": 15.00,
  "notes": "Received from distributor"
}
```

**Bulk Update Request:**
```json
{
  "updates": [
    {
      "variantId": "variant-uuid-1",
      "locationId": "location-uuid",
      "quantityChange": 5,
      "reason": "restock"
    },
    {
      "variantId": "variant-uuid-2",
      "locationId": "location-uuid",
      "quantityChange": -2,
      "reason": "sale"
    }
  ]
}
```

#### Reserve Inventory
```http
POST /inventory/reservations
```

**Request:**
```json
{
  "reservations": [
    {
      "variantId": "variant-uuid",
      "locationId": "location-uuid",
      "quantity": 2,
      "reason": "order",
      "reference": "order-uuid",
      "expiresAt": "2025-01-16T00:00:00Z"
    }
  ]
}
```

#### Release Reservation
```http
DELETE /inventory/reservations/{reservationId}
```

### Locations

#### List Locations
```http
GET /locations
```

#### Create Location
```http
POST /locations
```

**Request:**
```json
{
  "name": "Store Front",
  "type": "store",
  "address": {
    "street": "123 Main St",
    "city": "Anytown",
    "state": "CA",
    "postalCode": "12345",
    "country": "US"
  },
  "isActive": true,
  "fulfillsOnlineOrders": true
}
```

### Stock Movements

#### List Stock Movements
```http
GET /stock-movements
GET /variants/{variantId}/stock-movements
```

**Query Parameters:**
```typescript
interface StockMovementParams extends CommonQueryParams {
  variantId?: string;
  locationId?: string;
  type?: 'in' | 'out' | 'transfer' | 'adjustment';
  reason?: string;
  reference?: string;
  dateFrom?: string;
  dateTo?: string;
}
```

## Order API

### Orders

#### List Orders
```http
GET /orders
```

**Query Parameters:**
```typescript
interface OrderListParams extends CommonQueryParams {
  status?: 'pending' | 'processing' | 'fulfilled' | 'cancelled';
  source?: 'shopify' | 'binderpos' | 'tcgplayer' | 'ebay' | 'amazon';
  customerId?: string;
  fulfillmentStatus?: 'unfulfilled' | 'partial' | 'fulfilled';
  financialStatus?: 'pending' | 'paid' | 'refunded';
  createdAfter?: string;
  createdBefore?: string;
  tags?: string;
}
```

**Response:**
```json
{
  "data": [
    {
      "id": "order-uuid",
      "orderNumber": "1001",
      "shopifyOrderId": 123456789,
      "source": "shopify",
      "status": "processing",
      "financialStatus": "paid",
      "fulfillmentStatus": "unfulfilled",
      "customer": {
        "id": "customer-uuid",
        "email": "customer@example.com",
        "firstName": "John",
        "lastName": "Doe"
      },
      "lineItems": [
        {
          "id": "line-item-uuid",
          "variantId": "variant-uuid",
          "sku": "MTG-ALP-BL-NM",
          "title": "Black Lotus - Near Mint",
          "quantity": 1,
          "price": 25000.00,
          "fulfilledQuantity": 0
        }
      ],
      "subtotalPrice": 25000.00,
      "totalTax": 2000.00,
      "totalShipping": 10.00,
      "totalPrice": 27010.00,
      "currency": "USD",
      "shippingAddress": {
        "firstName": "John",
        "lastName": "Doe",
        "address1": "123 Main St",
        "city": "Anytown",
        "province": "CA",
        "zip": "12345",
        "country": "US"
      },
      "createdAt": "2025-01-15T10:00:00Z",
      "updatedAt": "2025-01-15T10:30:00Z"
    }
  ]
}
```

#### Get Order
```http
GET /orders/{id}
```

#### Create Order
```http
POST /orders
```

**Request:**
```json
{
  "source": "manual",
  "customerId": "customer-uuid",
  "customerEmail": "customer@example.com",
  "lineItems": [
    {
      "variantId": "variant-uuid",
      "quantity": 1,
      "price": 100.00
    }
  ],
  "shippingAddress": {
    "firstName": "John",
    "lastName": "Doe",
    "address1": "123 Main St",
    "city": "Anytown",
    "province": "CA",
    "zip": "12345",
    "country": "US"
  },
  "notes": "Rush order"
}
```

#### Update Order
```http
PUT /orders/{id}
```

#### Cancel Order
```http
POST /orders/{id}/cancel
```

**Request:**
```json
{
  "reason": "Customer requested cancellation",
  "notifyCustomer": true,
  "restockItems": true
}
```

### Order Processing

#### Process Order
```http
POST /orders/{id}/process
```

#### Fulfill Order
```http
POST /orders/{id}/fulfill
```

**Request:**
```json
{
  "lineItems": [
    {
      "lineItemId": "line-item-uuid",
      "quantity": 1,
      "locationId": "location-uuid"
    }
  ],
  "trackingNumber": "1Z999AA1234567890",
  "trackingCompany": "UPS",
  "notifyCustomer": true
}
```

## Fulfillment API

### Batches

#### List Batches
```http
GET /fulfillment/batches
```

#### Create Batch
```http
POST /fulfillment/batches
```

**Request:**
```json
{
  "orderIds": ["order-uuid-1", "order-uuid-2"],
  "locationId": "location-uuid",
  "assignedTo": "user-uuid"
}
```

#### Get Batch
```http
GET /fulfillment/batches/{id}
```

#### Generate Pick List
```http
POST /fulfillment/batches/{id}/pick-list
```

**Response:**
```json
{
  "data": {
    "id": "pick-list-uuid",
    "batchId": "batch-uuid",
    "items": [
      {
        "variantId": "variant-uuid",
        "sku": "MTG-ALP-BL-NM",
        "title": "Black Lotus - Near Mint",
        "quantity": 2,
        "location": "A1-B2-C3",
        "orderIds": ["order-uuid-1", "order-uuid-2"]
      }
    ],
    "optimizedRoute": [
      {
        "location": "A1-B2-C3",
        "items": ["variant-uuid"]
      }
    ],
    "estimatedTime": 15
  }
}
```

#### Record Pick
```http
POST /fulfillment/batches/{id}/picks
```

**Request:**
```json
{
  "picks": [
    {
      "variantId": "variant-uuid",
      "quantityPicked": 2,
      "locationId": "location-uuid",
      "notes": "Item found in overflow bin"
    }
  ]
}
```

### Shipping

#### Generate Label
```http
POST /fulfillment/orders/{orderId}/label
```

**Request:**
```json
{
  "service": "ups_ground",
  "packageType": "package",
  "weight": 0.5,
  "dimensions": {
    "length": 6,
    "width": 4,
    "height": 1
  },
  "insurance": 100.00
}
```

**Response:**
```json
{
  "data": {
    "labelId": "label-uuid",
    "trackingNumber": "1Z999AA1234567890",
    "labelUrl": "https://api.shipstation.com/labels/label-uuid.pdf",
    "cost": 8.50,
    "service": "UPS Ground"
  }
}
```

## Pricing API

### Prices

#### Get Prices
```http
GET /pricing/variants/{variantId}
GET /pricing/variants/{variantId}/channels/{channel}
```

**Response:**
```json
{
  "data": {
    "variantId": "variant-uuid",
    "basePrice": 100.00,
    "channels": {
      "shopify": {
        "price": 100.00,
        "compareAtPrice": 120.00
      },
      "ebay": {
        "price": 110.00,
        "ruleId": "rule-uuid"
      },
      "amazon": {
        "price": 105.00
      }
    },
    "marketPrice": {
      "source": "tcgplayer",
      "lowPrice": 95.00,
      "midPrice": 100.00,
      "highPrice": 110.00,
      "updatedAt": "2025-01-15T12:00:00Z"
    }
  }
}
```

#### Update Price
```http
PUT /pricing/variants/{variantId}/channels/{channel}
```

**Request:**
```json
{
  "price": 105.00,
  "compareAtPrice": 125.00
}
```

#### Bulk Update Prices
```http
POST /pricing/bulk
```

### Pricing Rules

#### List Pricing Rules
```http
GET /pricing/rules
```

#### Create Pricing Rule
```http
POST /pricing/rules
```

**Request:**
```json
{
  "name": "eBay Markup",
  "channel": "ebay",
  "type": "percentage",
  "value": 10,
  "conditions": [
    {
      "field": "category",
      "operator": "equals",
      "value": "Magic: The Gathering"
    }
  ],
  "isActive": true
}
```

## Reporting API

### Sales Reports

#### Sales Summary
```http
GET /reports/sales/summary
```

**Query Parameters:**
```typescript
interface SalesReportParams {
  dateFrom: string;       // ISO 8601 date
  dateTo: string;         // ISO 8601 date
  groupBy?: 'day' | 'week' | 'month';
  channel?: string;
  category?: string;
  vendor?: string;
}
```

**Response:**
```json
{
  "data": {
    "totalSales": 50000.00,
    "totalOrders": 125,
    "averageOrderValue": 400.00,
    "channels": [
      {
        "channel": "shopify",
        "sales": 30000.00,
        "orders": 75,
        "percentage": 60
      },
      {
        "channel": "ebay",
        "sales": 20000.00,
        "orders": 50,
        "percentage": 40
      }
    ],
    "timeline": [
      {
        "date": "2025-01-01",
        "sales": 2000.00,
        "orders": 5
      }
    ]
  }
}
```

### Inventory Reports

#### Inventory Valuation
```http
GET /reports/inventory/valuation
```

#### Low Stock Report
```http
GET /reports/inventory/low-stock
```

#### Inventory Aging
```http
GET /reports/inventory/aging
```

## Webhook API

### Webhook Endpoints

#### Shopify Webhooks
```http
POST /webhooks/shopify/products/create
POST /webhooks/shopify/products/update
POST /webhooks/shopify/orders/create
POST /webhooks/shopify/orders/update
POST /webhooks/shopify/inventory/update
```

#### eBay Webhooks
```http
POST /webhooks/ebay/orders/create
POST /webhooks/ebay/orders/update
```

### Webhook Management

#### List Webhook Logs
```http
GET /webhooks/logs
```

#### Retry Webhook
```http
POST /webhooks/logs/{id}/retry
```

## Phase 4 API Endpoints

### Marketplace Management

#### Initialize Marketplace Connector
```http
POST /api/v1/marketplace/connectors/{type}/initialize
Authorization: Bearer <token>
X-Tenant-ID: <tenant-id>
Content-Type: application/json

{
  "config": {
    "apiKey": "string",
    "secretKey": "string",
    "sellerId": "string"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "connectorId": "string",
    "type": "amazon|google_shopping",
    "status": "active",
    "lastSync": "2024-01-01T00:00:00.000Z"
  }
}
```

#### Test Marketplace Connector
```http
POST /api/v1/marketplace/connectors/{type}/test
Authorization: Bearer <token>
X-Tenant-ID: <tenant-id>
```

#### Sync Products to Marketplace
```http
POST /api/v1/marketplace/products/sync
Authorization: Bearer <token>
X-Tenant-ID: <tenant-id>
Content-Type: application/json

{
  "productIds": ["string"],
  "marketplaces": ["amazon", "google_shopping"]
}
```

### Advanced Pricing Management

#### Create Pricing Rule
```http
POST /api/v1/pricing/rules
Authorization: Bearer <token>
X-Tenant-ID: <tenant-id>
Content-Type: application/json

{
  "name": "Competitive Pricing Rule",
  "description": "Adjust prices based on competitor analysis",
  "priority": 100,
  "isActive": true,
  "conditions": [
    {
      "type": "competitor_price",
      "operator": "less_than",
      "value": "current_price",
      "marketplace": "amazon"
    }
  ],
  "actions": [
    {
      "type": "adjust_price",
      "value": -0.05,
      "unit": "percentage",
      "min_margin": 0.15
    }
  ]
}
```

#### Get Pricing Rules
```http
GET /api/v1/pricing/rules?isActive=true&page=1&limit=20
Authorization: Bearer <token>
X-Tenant-ID: <tenant-id>
```

#### Apply Pricing Rules to Product
```http
POST /api/v1/pricing/products/{productId}/apply-rules
Authorization: Bearer <token>
X-Tenant-ID: <tenant-id>
Content-Type: application/json

{
  "marketplaces": ["amazon", "google_shopping"]
}
```

#### Get Market Prices
```http
GET /api/v1/pricing/products/{productId}/market-prices
Authorization: Bearer <token>
X-Tenant-ID: <tenant-id>
```

#### Get Pricing Analytics
```http
GET /api/v1/pricing/analytics?startDate=2024-01-01&endDate=2024-01-31
Authorization: Bearer <token>
X-Tenant-ID: <tenant-id>
```

### Performance Monitoring

#### Get Performance Metrics
```http
GET /api/v1/performance/metrics
Authorization: Bearer <token>
X-Tenant-ID: <tenant-id>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "apiResponseTime": {
      "average": 150,
      "p95": 300,
      "p99": 500
    },
    "databasePerformance": {
      "queryTime": 50,
      "connectionPool": {
        "active": 5,
        "idle": 10,
        "total": 15
      }
    },
    "cachePerformance": {
      "hitRatio": 0.85,
      "missRatio": 0.15
    },
    "systemHealth": {
      "score": 95,
      "status": "healthy"
    }
  }
}
```

## Error Handling

### HTTP Status Codes
- `200` - OK
- `201` - Created
- `204` - No Content
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `422` - Unprocessable Entity
- `429` - Too Many Requests
- `500` - Internal Server Error
- `503` - Service Unavailable

### Error Response Examples

#### Validation Error (422)
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": {
      "fields": {
        "email": ["Email is required"],
        "price": ["Price must be greater than 0"]
      }
    },
    "timestamp": "2025-01-15T12:00:00Z",
    "requestId": "req-uuid",
    "path": "/products"
  }
}
```

#### Not Found Error (404)
```json
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Product not found",
    "details": {
      "resourceType": "Product",
      "resourceId": "invalid-uuid"
    },
    "timestamp": "2025-01-15T12:00:00Z",
    "requestId": "req-uuid",
    "path": "/products/invalid-uuid"
  }
}
```

#### Rate Limit Error (429)
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests",
    "details": {
      "limit": 100,
      "remaining": 0,
      "resetAt": "2025-01-15T13:00:00Z"
    },
    "timestamp": "2025-01-15T12:00:00Z",
    "requestId": "req-uuid",
    "path": "/products"
  }
}
```

### Error Codes Reference

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `VALIDATION_ERROR` | Request validation failed | 422 |
| `RESOURCE_NOT_FOUND` | Requested resource not found | 404 |
| `UNAUTHORIZED` | Authentication required | 401 |
| `FORBIDDEN` | Insufficient permissions | 403 |
| `CONFLICT` | Resource conflict (duplicate, etc.) | 409 |
| `RATE_LIMIT_EXCEEDED` | Too many requests | 429 |
| `EXTERNAL_SERVICE_ERROR` | External service unavailable | 503 |
| `INTERNAL_ERROR` | Internal server error | 500 |