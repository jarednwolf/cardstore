# CardStore Automation System Documentation

## Overview

The CardStore Automation System is a comprehensive, real-time automation infrastructure that transforms manual order processing into a fully automated workflow. The system handles the complete pipeline from Shopify order receipt to ready-for-picking status with real-time monitoring and control capabilities.

## System Architecture

### Core Workflow
```
Shopify Order → Inventory Validation → BinderPOS Sync → Receipt Print → Ready for Picking
```

### Key Components

#### 1. Automation Service (`src/services/automationService.ts`)
The central orchestration engine that manages the complete automation workflow.

**Features:**
- Event-driven architecture using EventEmitter pattern
- Multi-stage order processing with status tracking
- Automatic retry logic with exponential backoff
- WebSocket integration for real-time updates
- Comprehensive error handling and recovery

**Order Processing Stages:**
1. **Received**: Order received from Shopify
2. **Validated**: Inventory availability confirmed
3. **Synced**: BinderPOS inventory synchronized
4. **Printed**: Receipt printed successfully
5. **Complete**: Ready for picking

#### 2. BinderPOS Integration (`src/services/binderPOSService.ts`)
Handles all interactions with the BinderPOS system for inventory management and receipt printing.

**Features:**
- Circuit breaker pattern for reliable API calls
- Connection health monitoring
- Inventory synchronization with conflict resolution
- Receipt printing with job tracking
- Mock mode for development
- Comprehensive retry logic

#### 3. WebSocket Service (`src/services/websocketService.ts`)
Provides real-time communication between the backend and frontend dashboard.

**Features:**
- Socket.IO integration with full event handling
- Real-time order pipeline updates
- Automation control via WebSocket
- Connection health monitoring with ping/pong
- Order status tracking with persistence
- Notification broadcasting system

#### 4. Automation Dashboard (`frontend/automation.html`)
Professional web interface for monitoring and controlling the automation system.

**Features:**
- Real-time order pipeline visualization
- Automation controls (start/stop/test)
- BinderPOS connection testing and monitoring
- Performance metrics display
- Activity feed with real-time notifications
- Responsive design with mobile support

## API Endpoints

### Automation Control
```typescript
POST /api/automation/start    // Start automation system
POST /api/automation/stop     // Stop automation system
POST /api/automation/test     // Test automation workflow
GET  /api/automation/status   // Get current status
GET  /api/automation/metrics  // Get performance metrics
```

### BinderPOS Integration
```typescript
POST /api/automation/binderpos/test       // Test BinderPOS connection
POST /api/automation/binderpos/sync       // Manual inventory sync
POST /api/automation/binderpos/print      // Manual receipt print
GET  /api/automation/binderpos/status     // Get connection status
```

### Order Pipeline
```typescript
GET  /api/automation/orders               // Get order pipeline status
GET  /api/automation/orders/:id          // Get specific order status
POST /api/automation/orders/:id/retry    // Retry failed order
```

## WebSocket Events

### Client → Server Events
```typescript
'automation:start'    // Start automation
'automation:stop'     // Stop automation
'automation:test'     // Test automation
'binderpos:test'      // Test BinderPOS connection
'order:retry'         // Retry failed order
```

### Server → Client Events
```typescript
'automation:status'        // Automation status update
'order:received'          // New order received
'order:validated'         // Order inventory validated
'order:synced'           // BinderPOS sync complete
'order:printed'          // Receipt printed
'order:complete'         // Order processing complete
'order:error'            // Order processing error
'binderpos:status'       // BinderPOS connection status
'metrics:update'         // Performance metrics update
'notification'           // System notification
```

## Configuration

### Environment Variables
```bash
# Automation Configuration
AUTOMATION_ENABLED="true"
AUTOMATION_MAX_RETRIES="3"
AUTOMATION_RETRY_DELAY="5000"
AUTOMATION_BATCH_SIZE="10"

# BinderPOS Configuration
BINDERPOS_API_URL="your-binderpos-api-url"
BINDERPOS_API_KEY="your-binderpos-api-key"
BINDERPOS_STORE_ID="your-store-id"
BINDERPOS_TIMEOUT="30000"
BINDERPOS_RETRY_ATTEMPTS="3"

# WebSocket Configuration
WEBSOCKET_ENABLED="true"
WEBSOCKET_CORS_ORIGIN="http://localhost:3000,http://localhost:3001,http://localhost:3005"
FRONTEND_URL="http://localhost:3000"
```

### Automation Settings
```typescript
interface AutomationConfig {
  enabled: boolean;
  maxRetries: number;
  retryDelay: number;
  batchSize: number;
  mockMode: boolean;
}
```

## Error Handling

### Circuit Breaker Pattern
The BinderPOS integration uses a circuit breaker pattern to handle external API failures:

```typescript
- CLOSED: Normal operation, requests pass through
- OPEN: Failures detected, requests fail fast
- HALF_OPEN: Testing if service has recovered
```

### Retry Logic
Automatic retry with exponential backoff for transient failures:

```typescript
- Initial delay: 1 second
- Maximum retries: 3 (configurable)
- Backoff multiplier: 2x
- Maximum delay: 30 seconds
```

### Error Recovery
- Automatic retry for transient failures
- Manual retry capability for failed orders
- Graceful degradation when services are unavailable
- Comprehensive error logging and monitoring

## Monitoring & Metrics

### Performance Metrics
- Order processing rate (orders/minute)
- Success/failure rates
- Average processing time
- BinderPOS response times
- WebSocket connection health

### System Health
- Memory usage monitoring
- CPU utilization tracking
- Database connection status
- Cache performance metrics
- Error rate tracking

### Alerting
- Performance threshold alerts
- Connection failure notifications
- Error rate warnings
- System health alerts

## Development Guide

### Running in Development Mode
```bash
# Start the development server
npm run dev

# The automation system will run in mock mode
# BinderPOS calls will be simulated
# WebSocket dashboard available at http://localhost:3005/automation.html
```

### Testing
```bash
# Run all tests
npm test

# Run automation-specific tests
npm test -- --testPathPattern=automation

# Test WebSocket functionality
npm test -- --testPathPattern=websocket
```

### Mock Mode
When `BINDERPOS_API_KEY` is not configured or set to a placeholder value, the system automatically runs in mock mode:

- BinderPOS calls are simulated with realistic delays
- Receipt printing returns mock job IDs
- Inventory sync operations are logged but not executed
- All automation workflows function normally for testing

## Production Deployment

### Prerequisites
- Node.js 18+ environment
- Redis server for caching
- PostgreSQL database (optional, system works without)
- BinderPOS API credentials
- SSL certificates for HTTPS

### Deployment Steps
1. Configure environment variables
2. Set up Redis and database connections
3. Configure BinderPOS API credentials
4. Set up SSL certificates
5. Start the application with PM2 or similar process manager

### Health Checks
```bash
# System health endpoint
GET /api/health

# Automation system status
GET /api/automation/status

# BinderPOS connection test
POST /api/automation/binderpos/test
```

## Troubleshooting

### Common Issues

#### Automation Not Starting
- Check `AUTOMATION_ENABLED` environment variable
- Verify BinderPOS configuration
- Check system logs for initialization errors

#### BinderPOS Connection Failures
- Verify API credentials and URL
- Check network connectivity
- Review circuit breaker status
- Test connection manually via dashboard

#### WebSocket Connection Issues
- Check CORS configuration
- Verify WebSocket port accessibility
- Review browser console for connection errors
- Check server logs for WebSocket events

#### Order Processing Failures
- Review order validation logic
- Check inventory availability
- Verify BinderPOS sync status
- Use manual retry for failed orders

### Logging
The system provides comprehensive logging at multiple levels:

```typescript
- ERROR: Critical failures requiring attention
- WARN: Warnings and recoverable issues
- INFO: General operational information
- DEBUG: Detailed debugging information
```

### Performance Optimization
- Enable Redis caching for improved performance
- Configure appropriate retry delays
- Monitor memory usage and optimize as needed
- Use connection pooling for database operations

## Security Considerations

### API Security
- All automation endpoints require authentication
- Rate limiting applied to prevent abuse
- Input validation on all parameters
- CORS protection for WebSocket connections

### Data Protection
- Sensitive configuration stored in environment variables
- API keys encrypted in transit
- Order data handled securely
- Audit logging for all automation actions

### Network Security
- HTTPS required for production deployment
- WebSocket connections secured with WSS
- Firewall rules for BinderPOS API access
- VPN recommended for external integrations

## Future Enhancements

### Phase 2 Features
- Advanced automation configuration interface
- Enhanced error handling and recovery mechanisms
- Comprehensive analytics and reporting dashboards
- Mobile-responsive automation controls
- Advanced WebSocket event system

### Planned Improvements
- Machine learning for demand forecasting
- Advanced inventory optimization
- Multi-location automation support
- Integration with additional POS systems
- Advanced reporting and analytics

---

For additional support or questions, refer to the technical documentation or contact the development team.