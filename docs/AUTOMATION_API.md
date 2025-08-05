# Automation System API Documentation

## Overview

The CardStore Automation System provides a comprehensive REST API for managing automated order processing workflows. This API enables real-time control, monitoring, and configuration of the automation system that handles the complete pipeline from Shopify orders to ready-for-picking status.

## Base URL

```
http://localhost:3000/api/automation
```

## Authentication

All automation endpoints require authentication. Include the authentication token in the request headers:

```http
Authorization: Bearer <your-auth-token>
```

## Response Format

All API responses follow a consistent format:

```typescript
interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}
```

### Success Response
```json
{
  "success": true,
  "data": { /* response data */ },
  "message": "Operation completed successfully",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error description",
  "message": "Operation failed",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Automation Control Endpoints

### Start Automation System

Start the automation system to begin processing orders automatically.

```http
POST /api/automation/start
```

**Request Body:**
```typescript
{
  config?: {
    maxRetries?: number;      // Maximum retry attempts (default: 3)
    retryDelay?: number;      // Retry delay in milliseconds (default: 5000)
    batchSize?: number;       // Batch processing size (default: 10)
    mockMode?: boolean;       // Enable mock mode (default: false)
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "running",
    "startedAt": "2024-01-15T10:30:00.000Z",
    "config": {
      "maxRetries": 3,
      "retryDelay": 5000,
      "batchSize": 10,
      "mockMode": false
    }
  },
  "message": "Automation system started successfully"
}
```

### Stop Automation System

Stop the automation system and halt order processing.

```http
POST /api/automation/stop
```

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "stopped",
    "stoppedAt": "2024-01-15T10:35:00.000Z",
    "processedOrders": 15,
    "uptime": "00:05:00"
  },
  "message": "Automation system stopped successfully"
}
```

### Test Automation Workflow

Test the complete automation workflow with a mock order.

```http
POST /api/automation/test
```

**Request Body:**
```typescript
{
  mockOrder?: {
    id: string;
    items: Array<{
      sku: string;
      quantity: number;
      price: number;
    }>;
    customer?: {
      name: string;
      email: string;
    };
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "testId": "test-12345",
    "status": "completed",
    "stages": {
      "received": { "status": "success", "duration": 50 },
      "validated": { "status": "success", "duration": 120 },
      "synced": { "status": "success", "duration": 800 },
      "printed": { "status": "success", "duration": 300 },
      "complete": { "status": "success", "duration": 25 }
    },
    "totalDuration": 1295
  },
  "message": "Automation test completed successfully"
}
```

### Get Automation Status

Retrieve the current status and configuration of the automation system.

```http
GET /api/automation/status
```

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "running",
    "startedAt": "2024-01-15T10:30:00.000Z",
    "uptime": "00:15:30",
    "config": {
      "maxRetries": 3,
      "retryDelay": 5000,
      "batchSize": 10,
      "mockMode": false
    },
    "stats": {
      "ordersProcessed": 25,
      "ordersInProgress": 3,
      "ordersFailed": 1,
      "successRate": 96.0
    },
    "health": {
      "binderpos": "connected",
      "websocket": "active",
      "database": "connected"
    }
  }
}
```

### Get Performance Metrics

Retrieve detailed performance metrics for the automation system.

```http
GET /api/automation/metrics
```

**Query Parameters:**
- `timeframe` (optional): Time period for metrics (`1h`, `24h`, `7d`, `30d`)
- `granularity` (optional): Data granularity (`minute`, `hour`, `day`)

**Response:**
```json
{
  "success": true,
  "data": {
    "timeframe": "24h",
    "summary": {
      "ordersProcessed": 150,
      "averageProcessingTime": 2500,
      "successRate": 98.7,
      "errorRate": 1.3,
      "throughput": 6.25
    },
    "stages": {
      "received": { "averageTime": 45, "successRate": 100 },
      "validated": { "averageTime": 120, "successRate": 99.3 },
      "synced": { "averageTime": 850, "successRate": 98.7 },
      "printed": { "averageTime": 320, "successRate": 99.1 },
      "complete": { "averageTime": 30, "successRate": 100 }
    },
    "trends": [
      { "timestamp": "2024-01-15T10:00:00.000Z", "ordersPerHour": 8 },
      { "timestamp": "2024-01-15T11:00:00.000Z", "ordersPerHour": 12 }
    ]
  }
}
```

## BinderPOS Integration Endpoints

### Test BinderPOS Connection

Test the connection to the BinderPOS system.

```http
POST /api/automation/binderpos/test
```

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "connected",
    "responseTime": 245,
    "version": "2.1.0",
    "storeId": "store-123",
    "lastSync": "2024-01-15T10:25:00.000Z",
    "circuitBreaker": "closed"
  },
  "message": "BinderPOS connection test successful"
}
```

### Manual Inventory Sync

Trigger a manual inventory synchronization with BinderPOS.

```http
POST /api/automation/binderpos/sync
```

**Request Body:**
```typescript
{
  items?: string[];           // Specific SKUs to sync (optional)
  forceSync?: boolean;        // Force sync even if recently synced
  dryRun?: boolean;          // Preview changes without applying
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "syncId": "sync-67890",
    "status": "completed",
    "itemsProcessed": 45,
    "itemsUpdated": 12,
    "conflicts": 2,
    "duration": 3200,
    "changes": [
      {
        "sku": "CARD-001",
        "action": "updated",
        "oldQuantity": 10,
        "newQuantity": 8
      }
    ]
  },
  "message": "Inventory sync completed successfully"
}
```

### Manual Receipt Print

Print a receipt for a specific order through BinderPOS.

```http
POST /api/automation/binderpos/print
```

**Request Body:**
```typescript
{
  orderId: string;            // Order ID to print receipt for
  copies?: number;            // Number of copies (default: 1)
  printer?: string;           // Specific printer name (optional)
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "printJobId": "print-54321",
    "status": "completed",
    "orderId": "order-123",
    "copies": 1,
    "printer": "Receipt-Printer-01",
    "printedAt": "2024-01-15T10:40:00.000Z"
  },
  "message": "Receipt printed successfully"
}
```

### Get BinderPOS Status

Retrieve the current status of the BinderPOS integration.

```http
GET /api/automation/binderpos/status
```

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "connected",
    "lastCheck": "2024-01-15T10:39:00.000Z",
    "responseTime": 180,
    "circuitBreaker": {
      "state": "closed",
      "failureCount": 0,
      "lastFailure": null,
      "nextAttempt": null
    },
    "stats": {
      "totalRequests": 1250,
      "successfulRequests": 1235,
      "failedRequests": 15,
      "averageResponseTime": 220
    },
    "capabilities": {
      "inventorySync": true,
      "receiptPrinting": true,
      "orderManagement": true
    }
  }
}
```

## Order Pipeline Endpoints

### Get Order Pipeline Status

Retrieve the current status of all orders in the automation pipeline.

```http
GET /api/automation/orders
```

**Query Parameters:**
- `status` (optional): Filter by order status (`received`, `validated`, `synced`, `printed`, `complete`, `error`)
- `limit` (optional): Maximum number of orders to return (default: 50)
- `offset` (optional): Number of orders to skip (default: 0)

**Response:**
```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "id": "order-123",
        "status": "synced",
        "stage": "printing",
        "progress": 75,
        "createdAt": "2024-01-15T10:35:00.000Z",
        "updatedAt": "2024-01-15T10:38:00.000Z",
        "customer": "John Doe",
        "itemCount": 3,
        "totalValue": 45.99,
        "retryCount": 0
      }
    ],
    "pagination": {
      "total": 25,
      "limit": 50,
      "offset": 0,
      "hasMore": false
    },
    "summary": {
      "received": 2,
      "validated": 3,
      "synced": 5,
      "printed": 8,
      "complete": 15,
      "error": 1
    }
  }
}
```

### Get Specific Order Status

Retrieve detailed status information for a specific order.

```http
GET /api/automation/orders/:orderId
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "order-123",
    "status": "synced",
    "stage": "printing",
    "progress": 75,
    "createdAt": "2024-01-15T10:35:00.000Z",
    "updatedAt": "2024-01-15T10:38:00.000Z",
    "timeline": [
      {
        "stage": "received",
        "status": "completed",
        "timestamp": "2024-01-15T10:35:00.000Z",
        "duration": 50
      },
      {
        "stage": "validated",
        "status": "completed",
        "timestamp": "2024-01-15T10:35:15.000Z",
        "duration": 120
      },
      {
        "stage": "synced",
        "status": "completed",
        "timestamp": "2024-01-15T10:37:00.000Z",
        "duration": 800
      },
      {
        "stage": "printing",
        "status": "in_progress",
        "timestamp": "2024-01-15T10:38:00.000Z",
        "duration": null
      }
    ],
    "details": {
      "customer": {
        "name": "John Doe",
        "email": "john@example.com"
      },
      "items": [
        {
          "sku": "CARD-001",
          "name": "Pokemon Card Pack",
          "quantity": 2,
          "price": 15.99
        }
      ],
      "totalValue": 31.98,
      "retryCount": 0,
      "lastError": null
    }
  }
}
```

### Retry Failed Order

Retry processing for a failed order.

```http
POST /api/automation/orders/:orderId/retry
```

**Request Body:**
```typescript
{
  fromStage?: string;         // Stage to retry from (optional)
  resetRetryCount?: boolean;  // Reset retry counter (default: false)
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "orderId": "order-123",
    "status": "retrying",
    "fromStage": "synced",
    "retryCount": 2,
    "scheduledAt": "2024-01-15T10:45:00.000Z"
  },
  "message": "Order retry initiated successfully"
}
```

## WebSocket Events

The automation system provides real-time updates through WebSocket connections. Connect to:

```
ws://localhost:3000/socket.io/
```

### Client Events (Send to Server)

#### Start Automation
```typescript
socket.emit('automation:start', {
  config?: AutomationConfig
});
```

#### Stop Automation
```typescript
socket.emit('automation:stop');
```

#### Test Automation
```typescript
socket.emit('automation:test', {
  mockOrder?: MockOrder
});
```

#### Test BinderPOS Connection
```typescript
socket.emit('binderpos:test');
```

#### Retry Order
```typescript
socket.emit('order:retry', {
  orderId: string,
  fromStage?: string
});
```

### Server Events (Receive from Server)

#### Automation Status Update
```typescript
socket.on('automation:status', (data: {
  status: 'running' | 'stopped' | 'error';
  config: AutomationConfig;
  stats: AutomationStats;
}) => {
  // Handle automation status update
});
```

#### Order Status Updates
```typescript
socket.on('order:received', (order: OrderStatus) => {
  // New order received
});

socket.on('order:validated', (order: OrderStatus) => {
  // Order inventory validated
});

socket.on('order:synced', (order: OrderStatus) => {
  // BinderPOS sync completed
});

socket.on('order:printed', (order: OrderStatus) => {
  // Receipt printed
});

socket.on('order:complete', (order: OrderStatus) => {
  // Order processing complete
});

socket.on('order:error', (order: OrderStatus & { error: string }) => {
  // Order processing error
});
```

#### BinderPOS Status Updates
```typescript
socket.on('binderpos:status', (data: {
  status: 'connected' | 'disconnected' | 'error';
  responseTime?: number;
  circuitBreaker: CircuitBreakerState;
}) => {
  // Handle BinderPOS status update
});
```

#### Performance Metrics Updates
```typescript
socket.on('metrics:update', (metrics: PerformanceMetrics) => {
  // Handle metrics update
});
```

#### System Notifications
```typescript
socket.on('notification', (notification: {
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  timestamp: string;
}) => {
  // Handle system notification
});
```

## Error Codes

| Code | Description | Resolution |
|------|-------------|------------|
| `AUTOMATION_NOT_RUNNING` | Automation system is not active | Start the automation system |
| `AUTOMATION_ALREADY_RUNNING` | Automation system is already active | Stop before restarting |
| `BINDERPOS_CONNECTION_FAILED` | Cannot connect to BinderPOS | Check BinderPOS configuration |
| `BINDERPOS_CIRCUIT_OPEN` | BinderPOS circuit breaker is open | Wait for circuit breaker reset |
| `ORDER_NOT_FOUND` | Specified order does not exist | Verify order ID |
| `ORDER_ALREADY_COMPLETE` | Order has already been processed | No action needed |
| `INVENTORY_VALIDATION_FAILED` | Insufficient inventory for order | Check inventory levels |
| `PRINT_JOB_FAILED` | Receipt printing failed | Check printer status |
| `INVALID_CONFIGURATION` | Invalid automation configuration | Review configuration parameters |
| `RATE_LIMIT_EXCEEDED` | Too many requests | Reduce request frequency |

## Rate Limiting

API endpoints are rate-limited to prevent abuse:

- **Control endpoints** (`/start`, `/stop`, `/test`): 10 requests per minute
- **Status endpoints** (`/status`, `/metrics`): 60 requests per minute
- **Order endpoints**: 100 requests per minute
- **BinderPOS endpoints**: 30 requests per minute

Rate limit headers are included in responses:

```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1642248000
```

## SDK Examples

### JavaScript/TypeScript
```typescript
import axios from 'axios';

const automationAPI = axios.create({
  baseURL: 'http://localhost:3000/api/automation',
  headers: {
    'Authorization': 'Bearer your-auth-token'
  }
});

// Start automation
const startAutomation = async () => {
  try {
    const response = await automationAPI.post('/start', {
      config: {
        maxRetries: 3,
        batchSize: 10
      }
    });
    console.log('Automation started:', response.data);
  } catch (error) {
    console.error('Failed to start automation:', error.response.data);
  }
};

// Get order status
const getOrderStatus = async (orderId: string) => {
  try {
    const response = await automationAPI.get(`/orders/${orderId}`);
    return response.data.data;
  } catch (error) {
    console.error('Failed to get order status:', error.response.data);
    throw error;
  }
};
```

### Python
```python
import requests

class AutomationAPI:
    def __init__(self, base_url, auth_token):
        self.base_url = base_url
        self.headers = {'Authorization': f'Bearer {auth_token}'}
    
    def start_automation(self, config=None):
        response = requests.post(
            f'{self.base_url}/start',
            json={'config': config} if config else {},
            headers=self.headers
        )
        return response.json()
    
    def get_metrics(self, timeframe='24h'):
        response = requests.get(
            f'{self.base_url}/metrics',
            params={'timeframe': timeframe},
            headers=self.headers
        )
        return response.json()

# Usage
api = AutomationAPI('http://localhost:3000/api/automation', 'your-auth-token')
result = api.start_automation({'maxRetries': 3})
```

---

For additional API support or questions, refer to the main automation system documentation or contact the development team.