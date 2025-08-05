/**
 * Phase 5 Integration Tests
 * Comprehensive testing suite for all Phase 5 features
 */

const request = require('supertest');
const { PrismaClient } = require('@prisma/client');

describe('Phase 5 Integration Tests', () => {
  let app;
  let prisma;
  let authToken;

  beforeAll(async () => {
    // Initialize test environment
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.TEST_DATABASE_URL || 'sqlite://./test.db'
        }
      }
    });

    // Setup test app
    app = require('../src/app');
    
    // Create test user and get auth token
    const testUser = await prisma.user.create({
      data: {
        email: 'test@phase5.com',
        password: 'hashedpassword',
        tenantId: 'test-tenant',
        role: 'admin'
      }
    });

    // Mock auth token
    authToken = 'test-jwt-token';
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.$disconnect();
  });

  describe('Mobile PWA Features', () => {
    test('should serve mobile interface', async () => {
      const response = await request(app)
        .get('/mobile')
        .expect(200);

      expect(response.text).toContain('DeckStack Mobile');
      expect(response.text).toContain('viewport');
    });

    test('should serve PWA manifest', async () => {
      const response = await request(app)
        .get('/manifest.json')
        .expect(200);

      expect(response.body.name).toBe('DeckStack');
      expect(response.body.display).toBe('standalone');
      expect(response.body.start_url).toBe('/mobile');
    });

    test('should serve service worker', async () => {
      const response = await request(app)
        .get('/sw.js')
        .expect(200);

      expect(response.text).toContain('CACHE_NAME');
      expect(response.text).toContain('install');
      expect(response.text).toContain('fetch');
    });

    test('should handle offline API requests', async () => {
      const response = await request(app)
        .get('/api/mobile/offline-queue')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('queue');
      expect(Array.isArray(response.body.queue)).toBe(true);
    });

    test('should support barcode scanning endpoint', async () => {
      const response = await request(app)
        .post('/api/mobile/scan')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ barcode: '123456789012' })
        .expect(200);

      expect(response.body).toHaveProperty('product');
    });
  });

  describe('Business Intelligence & Analytics', () => {
    test('should generate executive dashboard', async () => {
      const response = await request(app)
        .get('/api/analytics/dashboard/executive')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('revenue');
      expect(response.body).toHaveProperty('orders');
      expect(response.body).toHaveProperty('customers');
      expect(response.body).toHaveProperty('inventory');
    });

    test('should provide sales analytics', async () => {
      const response = await request(app)
        .get('/api/analytics/sales')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ period: '30d' })
        .expect(200);

      expect(response.body).toHaveProperty('totalRevenue');
      expect(response.body).toHaveProperty('orderCount');
      expect(response.body).toHaveProperty('trends');
    });

    test('should generate inventory forecasting', async () => {
      const response = await request(app)
        .get('/api/analytics/inventory/forecast')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ days: 30 })
        .expect(200);

      expect(response.body).toHaveProperty('forecasts');
      expect(Array.isArray(response.body.forecasts)).toBe(true);
    });

    test('should export analytics data', async () => {
      const response = await request(app)
        .get('/api/analytics/export')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ format: 'csv', type: 'sales' })
        .expect(200);

      expect(response.headers['content-type']).toContain('text/csv');
    });

    test('should provide real-time metrics', async () => {
      const response = await request(app)
        .get('/api/analytics/realtime')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('activeUsers');
      expect(response.body).toHaveProperty('currentRevenue');
      expect(response.body).toHaveProperty('systemHealth');
    });
  });

  describe('Batch Operations', () => {
    test('should create bulk inventory update job', async () => {
      const batchData = [
        { productId: 'prod1', quantity: 100 },
        { productId: 'prod2', quantity: 50 }
      ];

      const response = await request(app)
        .post('/api/batch/inventory/update')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ items: batchData })
        .expect(200);

      expect(response.body).toHaveProperty('jobId');
      expect(response.body).toHaveProperty('status', 'queued');
    });

    test('should track batch job progress', async () => {
      const response = await request(app)
        .get('/api/batch/jobs/test-job-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('progress');
    });

    test('should handle bulk price updates', async () => {
      const priceUpdates = [
        { productId: 'prod1', price: 29.99 },
        { productId: 'prod2', price: 19.99 }
      ];

      const response = await request(app)
        .post('/api/batch/pricing/update')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ updates: priceUpdates })
        .expect(200);

      expect(response.body).toHaveProperty('jobId');
    });

    test('should support bulk order fulfillment', async () => {
      const orders = ['order1', 'order2', 'order3'];

      const response = await request(app)
        .post('/api/batch/orders/fulfill')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ orderIds: orders })
        .expect(200);

      expect(response.body).toHaveProperty('jobId');
      expect(response.body).toHaveProperty('estimatedDuration');
    });
  });

  describe('Customer Success Metrics', () => {
    test('should calculate customer health scores', async () => {
      const response = await request(app)
        .get('/api/customer-success/health-scores')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('scores');
      expect(Array.isArray(response.body.scores)).toBe(true);
    });

    test('should predict customer churn', async () => {
      const response = await request(app)
        .get('/api/customer-success/churn-prediction')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('predictions');
      expect(response.body).toHaveProperty('riskFactors');
    });

    test('should track customer journey', async () => {
      const response = await request(app)
        .get('/api/customer-success/journey/customer123')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('stages');
      expect(response.body).toHaveProperty('currentStage');
      expect(response.body).toHaveProperty('timeline');
    });

    test('should generate retention campaigns', async () => {
      const response = await request(app)
        .post('/api/customer-success/campaigns/retention')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ segment: 'at-risk' })
        .expect(200);

      expect(response.body).toHaveProperty('campaignId');
      expect(response.body).toHaveProperty('targetCustomers');
    });
  });

  describe('Advanced Security', () => {
    test('should log security events', async () => {
      const securityEvent = {
        type: 'login_attempt',
        severity: 'medium',
        details: { success: true, method: 'password' }
      };

      const response = await request(app)
        .post('/api/security/events')
        .set('Authorization', `Bearer ${authToken}`)
        .send(securityEvent)
        .expect(200);

      expect(response.body).toHaveProperty('eventId');
    });

    test('should generate compliance reports', async () => {
      const response = await request(app)
        .get('/api/security/compliance/gdpr')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('score');
      expect(response.body).toHaveProperty('findings');
      expect(response.body).toHaveProperty('recommendations');
    });

    test('should validate access control', async () => {
      const response = await request(app)
        .post('/api/security/access/validate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          resource: 'products',
          action: 'read'
        })
        .expect(200);

      expect(response.body).toHaveProperty('allowed');
    });

    test('should detect anomalous activity', async () => {
      const response = await request(app)
        .get('/api/security/anomalies')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('anomalies');
      expect(Array.isArray(response.body.anomalies)).toBe(true);
    });
  });

  describe('Enterprise Scalability', () => {
    test('should provide load balancing status', async () => {
      const response = await request(app)
        .get('/api/scalability/load-balancer/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('servers');
      expect(response.body).toHaveProperty('strategy');
    });

    test('should return scaling metrics', async () => {
      const response = await request(app)
        .get('/api/scalability/metrics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('cpuUsage');
      expect(response.body).toHaveProperty('memoryUsage');
      expect(response.body).toHaveProperty('activeConnections');
    });

    test('should provide scaling recommendations', async () => {
      const response = await request(app)
        .get('/api/scalability/recommendations')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('recommendations');
      expect(response.body).toHaveProperty('urgency');
      expect(response.body).toHaveProperty('estimatedCost');
    });

    test('should handle resource allocation', async () => {
      const response = await request(app)
        .post('/api/scalability/resources/allocate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          resourceType: 'compute',
          amount: 100,
          duration: 3600000 // 1 hour
        })
        .expect(200);

      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('reservationId');
    });
  });

  describe('Performance Tests', () => {
    test('should handle concurrent mobile requests', async () => {
      const promises = Array(10).fill().map(() =>
        request(app)
          .get('/api/mobile/products')
          .set('Authorization', `Bearer ${authToken}`)
      );

      const responses = await Promise.all(promises);
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });

    test('should process analytics queries efficiently', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .get('/api/analytics/sales')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ period: '90d' })
        .expect(200);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    test('should handle large batch operations', async () => {
      const largeBatch = Array(1000).fill().map((_, i) => ({
        productId: `prod${i}`,
        quantity: Math.floor(Math.random() * 100)
      }));

      const response = await request(app)
        .post('/api/batch/inventory/update')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ items: largeBatch })
        .expect(200);

      expect(response.body).toHaveProperty('jobId');
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid mobile requests gracefully', async () => {
      const response = await request(app)
        .post('/api/mobile/scan')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ invalidData: true })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    test('should handle analytics errors gracefully', async () => {
      const response = await request(app)
        .get('/api/analytics/invalid-endpoint')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });

    test('should handle batch operation failures', async () => {
      const response = await request(app)
        .post('/api/batch/invalid-operation')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Security Tests', () => {
    test('should require authentication for protected endpoints', async () => {
      const response = await request(app)
        .get('/api/analytics/dashboard/executive')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    test('should validate input data', async () => {
      const response = await request(app)
        .post('/api/batch/inventory/update')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ maliciousData: '<script>alert("xss")</script>' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    test('should rate limit API requests', async () => {
      // Make many requests quickly
      const promises = Array(100).fill().map(() =>
        request(app)
          .get('/api/analytics/realtime')
          .set('Authorization', `Bearer ${authToken}`)
      );

      const responses = await Promise.all(promises);
      const rateLimited = responses.some(r => r.status === 429);
      
      // Should have some rate limited responses
      expect(rateLimited).toBe(true);
    });
  });
});

// Performance benchmarks
describe('Phase 5 Performance Benchmarks', () => {
  test('mobile interface load time', async () => {
    const startTime = Date.now();
    
    await request(app)
      .get('/mobile')
      .expect(200);
    
    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(1000); // Should load within 1 second
  });

  test('analytics query performance', async () => {
    const startTime = Date.now();
    
    await request(app)
      .get('/api/analytics/dashboard/executive')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);
    
    const queryTime = Date.now() - startTime;
    expect(queryTime).toBeLessThan(2000); // Should complete within 2 seconds
  });

  test('batch operation throughput', async () => {
    const batchSize = 100;
    const startTime = Date.now();
    
    const batchData = Array(batchSize).fill().map((_, i) => ({
      productId: `perf-test-${i}`,
      quantity: 10
    }));

    await request(app)
      .post('/api/batch/inventory/update')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ items: batchData })
      .expect(200);
    
    const processingTime = Date.now() - startTime;
    const throughput = batchSize / (processingTime / 1000); // items per second
    
    expect(throughput).toBeGreaterThan(10); // Should process at least 10 items/second
  });
});