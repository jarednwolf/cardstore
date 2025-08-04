# DeckStack - Enterprise Shipping Automation Platform

**Stack the deck in your favor** with DeckStack's comprehensive shipping automation and multi-tenant user management system.

## 🚀 Overview

DeckStack is a professional SaaS shipping automation platform designed for e-commerce businesses, with specialized features for trading card game (TCG) retailers. Built with enterprise-grade multi-tenancy, DeckStack enables service providers to serve multiple customers with complete data isolation and comprehensive user management.

## ✨ Key Features

### 🏢 **Enterprise Multi-Tenancy**
- **Complete Data Isolation** - Each tenant's data is completely separated
- **User Management** - Full user lifecycle with roles and permissions
- **Audit Logging** - Comprehensive activity tracking for compliance
- **Tenant Administration** - Complete tenant lifecycle management

### 📦 **Shipping Automation**
- **Multi-Carrier Support** - USPS, UPS, FedEx, DHL integration
- **One-Click Label Creation** - Streamlined shipping workflow
- **Batch Processing** - Handle multiple orders efficiently
- **Real-Time Tracking** - Package tracking and delivery notifications

### 🎯 **TCG Optimization**
- **High-Value Order Handling** - Specialized for trading card shipments
- **Condition Tracking** - Card condition and grading support
- **Set Management** - Organize by TCG sets and rarities
- **Marketplace Integration** - Connect with TCG marketplaces

### 🔐 **Security & Compliance**
- **Role-Based Access Control** - Granular permission system
- **Data Encryption** - Secure data at rest and in transit
- **Audit Trails** - Complete activity logging
- **GDPR Compliance** - Data export and retention policies

## 🏗️ Architecture

DeckStack implements a **shared database, shared schema** multi-tenancy model:

```
┌─────────────────────────────────────────────────────────────┐
│                    DeckStack Platform                       │
├─────────────────────────────────────────────────────────────┤
│  Tenant A          │  Tenant B          │  Tenant C        │
│  ┌─────────────┐   │  ┌─────────────┐   │  ┌─────────────┐ │
│  │ Users       │   │  │ Users       │   │  │ Users       │ │
│  │ Products    │   │  │ Products    │   │  │ Products    │ │
│  │ Orders      │   │  │ Orders      │   │  │ Orders      │ │
│  │ Shipping    │   │  │ Shipping    │   │  │ Shipping    │ │
│  └─────────────┘   │  └─────────────┘   │  └─────────────┘ │
├─────────────────────────────────────────────────────────────┤
│                   Shared Database Layer                     │
└─────────────────────────────────────────────────────────────┘
```

## 🛠️ Technology Stack

- **Backend**: Node.js, TypeScript, Express.js
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: Supabase Auth with JWT tokens
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Deployment**: Vercel, Docker support
- **Testing**: Jest with comprehensive test suites

## 📚 Documentation

### Core Documentation
- **[Getting Started](./GETTING_STARTED.md)** - Quick setup and installation
- **[Technical Design](./TECHNICAL_DESIGN.md)** - System architecture and design
- **[Database Schema](./DATABASE_SCHEMA.md)** - Complete database documentation
- **[API Specifications](./API_SPECIFICATIONS.md)** - REST API reference

### Enterprise Features
- **[Enterprise Features](./ENTERPRISE_FEATURES.md)** - Multi-tenant system overview
- **[Multi-Tenant Architecture](./MULTI_TENANT_ARCHITECTURE.md)** - Architecture deep dive
- **[User Guide](./USER_GUIDE.md)** - End-user documentation
- **[Troubleshooting](./TROUBLESHOOTING.md)** - Common issues and solutions

### Development
- **[Integration Patterns](./INTEGRATION_PATTERNS.md)** - Integration guidelines
- **[Onboarding System](./ONBOARDING_SYSTEM.md)** - User onboarding flow

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- PostgreSQL database
- Supabase account (optional, for enhanced auth)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/deckstack.git
   cd deckstack
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Initialize database**
   ```bash
   npx prisma migrate deploy
   npm run seed
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

6. **Access the application**
   - Frontend: http://localhost:3005
   - API: http://localhost:3005/api/v1
   - Health Check: http://localhost:3005/health

## 👥 User Roles

| Role | Description | Permissions |
|------|-------------|-------------|
| **Owner** | Tenant administrator | Full access to all resources and settings |
| **Manager** | Business operations | Manage products, orders, inventory, reports |
| **Staff** | Daily operations | Manage inventory and orders, view products |
| **Fulfillment** | Warehouse operations | Update orders and inventory for shipping |

## 🔧 Configuration

### Environment Variables
```bash
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/deckstack"

# Authentication
JWT_SECRET="your-secure-jwt-secret"
SUPABASE_URL="your-supabase-url"
SUPABASE_ANON_KEY="your-supabase-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-supabase-service-key"

# Application
NODE_ENV="development"
PORT=3005
API_VERSION="v1"

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### Tenant Configuration
```javascript
// Example tenant settings
{
  "features": {
    "multiLocation": true,
    "advancedReporting": true,
    "apiAccess": true,
    "customBranding": false
  },
  "security": {
    "requireMFA": false,
    "sessionTimeout": 480,
    "auditLogging": true
  },
  "billing": {
    "plan": "professional",
    "billingCycle": "monthly"
  }
}
```

## 📊 API Overview

### Authentication
```http
POST /api/v1/auth/login
POST /api/v1/auth/signup
POST /api/v1/auth/refresh
```

### Tenant Management
```http
GET    /api/v1/tenants/current
PUT    /api/v1/tenants/{id}/settings
GET    /api/v1/tenants/{id}/stats
```

### User Management
```http
GET    /api/v1/users
POST   /api/v1/users
PUT    /api/v1/users/{id}
POST   /api/v1/users/invite
GET    /api/v1/users/profile
```

### Products & Inventory
```http
GET    /api/v1/products
POST   /api/v1/products
GET    /api/v1/inventory
PUT    /api/v1/inventory/{id}
```

### Orders & Shipping
```http
GET    /api/v1/orders
POST   /api/v1/orders
GET    /api/v1/shipping/rates
POST   /api/v1/shipping/labels
```

## 🧪 Testing

### Run Tests
```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# Multi-tenant security tests
npm run test:security

# Coverage report
npm run test:coverage
```

### Test Categories
- **Unit Tests** - Individual component testing
- **Integration Tests** - API endpoint testing
- **Security Tests** - Multi-tenant isolation validation
- **Performance Tests** - Load and stress testing

## 🚀 Deployment

### Production Deployment
```bash
# Build application
npm run build

# Run database migrations
npx prisma migrate deploy

# Start production server
npm start
```

### Docker Deployment
```bash
# Build Docker image
docker build -t deckstack .

# Run container
docker run -p 3005:3005 deckstack
```

### Vercel Deployment
```bash
# Deploy to Vercel
vercel --prod
```

## 📈 Monitoring

### Health Checks
- **Application Health**: `/health`
- **Database Health**: `/health/db`
- **API Health**: `/api/v1/health`

### Metrics
- Active tenants and users
- API response times
- Database query performance
- Security events and audit logs

## 🔒 Security

### Security Features
- **Multi-Factor Authentication** (optional)
- **Role-Based Access Control**
- **Data Encryption** at rest and in transit
- **Rate Limiting** and DDoS protection
- **SQL Injection Prevention**
- **XSS Protection**
- **CSRF Protection**

### Compliance
- **GDPR** - Data export and deletion
- **SOC 2** - Security controls and audit trails
- **PCI DSS** - Payment data security (when applicable)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](../LICENSE) file for details.

## 🆘 Support

- **Documentation**: [docs/](./docs/)
- **Issues**: [GitHub Issues](https://github.com/your-org/deckstack/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/deckstack/discussions)
- **Email**: support@deckstack.com

## 🎯 Roadmap

### Current Version (v1.0)
✅ Multi-tenant architecture
✅ User management system
✅ Basic shipping automation
✅ TCG-specific features

### Upcoming Features (v1.1)
- [ ] Advanced analytics dashboard
- [ ] Real-time notifications
- [ ] Mobile application
- [ ] Advanced reporting tools
- [ ] Marketplace integrations

### Future Enhancements (v2.0)
- [ ] AI-powered shipping optimization
- [ ] Advanced inventory forecasting
- [ ] Custom workflow automation
- [ ] Third-party app marketplace

---

**DeckStack** - Professional shipping automation for the modern e-commerce business.
*Stack the deck in your favor.*