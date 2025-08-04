# DeckStack - Enterprise Shipping Automation Platform

**Stack the deck in your favor** with DeckStack's comprehensive shipping automation and multi-tenant user management system.

[![Production Ready](https://img.shields.io/badge/Status-Production%20Ready-green.svg)](https://cardstore-woad.vercel.app)
[![Multi-Tenant](https://img.shields.io/badge/Architecture-Multi--Tenant-blue.svg)](#)
[![Enterprise Grade](https://img.shields.io/badge/Grade-Enterprise-purple.svg)](#)

## 🚀 Live Demo

**Production Deployment**: [https://cardstore-woad.vercel.app](https://cardstore-woad.vercel.app)

## ✨ What is DeckStack?

DeckStack is a professional SaaS shipping automation platform designed for e-commerce businesses, with specialized features for trading card game (TCG) retailers. Built with enterprise-grade multi-tenancy, DeckStack enables service providers to serve multiple customers with complete data isolation and comprehensive user management.

### 🎯 Perfect For
- **E-commerce Businesses** - Streamline shipping operations
- **TCG Retailers** - Specialized trading card handling
- **SaaS Providers** - Multi-tenant shipping services
- **Enterprise Teams** - Role-based user management

## 🏆 Key Features

### 🏢 **Enterprise Multi-Tenancy**
- ✅ **Complete Data Isolation** - Each tenant's data is completely separated
- ✅ **User Management** - Full user lifecycle with roles and permissions
- ✅ **Audit Logging** - Comprehensive activity tracking for compliance
- ✅ **Tenant Administration** - Complete tenant lifecycle management

### 📦 **Shipping Automation**
- ✅ **Multi-Carrier Support** - USPS, UPS, FedEx, DHL integration
- ✅ **One-Click Label Creation** - Streamlined shipping workflow
- ✅ **Batch Processing** - Handle multiple orders efficiently
- ✅ **Real-Time Tracking** - Package tracking and delivery notifications

### 🎯 **TCG Optimization**
- ✅ **High-Value Order Handling** - Specialized for trading card shipments
- ✅ **Condition Tracking** - Card condition and grading support
- ✅ **Set Management** - Organize by TCG sets and rarities
- ✅ **Marketplace Integration** - Connect with TCG marketplaces

### 🔐 **Security & Compliance**
- ✅ **Role-Based Access Control** - Granular permission system
- ✅ **Data Encryption** - Secure data at rest and in transit
- ✅ **Audit Trails** - Complete activity logging
- ✅ **GDPR Compliance** - Data export and retention policies

## 🚀 Quick Start

### 🔧 Prerequisites
- Node.js 18+ and npm
- PostgreSQL database
- Supabase account (optional, for enhanced auth)

### ⚡ Installation

```bash
# 1. Clone the repository
git clone https://github.com/your-org/deckstack.git
cd deckstack

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# 4. Initialize database
npx prisma migrate deploy
npm run seed

# 5. Start development server
npm run dev

# 6. Access the application
# Frontend: http://localhost:3005
# API: http://localhost:3005/api/v1
# Health: http://localhost:3005/health
```

## 👥 User Roles & Permissions

| Role | Description | Key Permissions |
|------|-------------|-----------------|
| **Owner** | Tenant administrator | Full access to all resources and settings |
| **Manager** | Business operations | Manage products, orders, inventory, reports |
| **Staff** | Daily operations | Manage inventory and orders, view products |
| **Fulfillment** | Warehouse operations | Update orders and inventory for shipping |

## 🛠️ Technology Stack

- **Backend**: Node.js, TypeScript, Express.js
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: Supabase Auth with JWT tokens
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Deployment**: Vercel, Docker support
- **Testing**: Jest with comprehensive test suites

## 📚 Documentation

### 📖 **Core Documentation**
- **[Getting Started](./docs/GETTING_STARTED.md)** - Quick setup and installation guide
- **[User Guide](./docs/USER_GUIDE.md)** - End-user documentation and tutorials
- **[API Specifications](./docs/API_SPECIFICATIONS.md)** - Complete REST API reference
- **[Troubleshooting](./docs/TROUBLESHOOTING.md)** - Common issues and solutions

### 🏗️ **Architecture & Development**
- **[Technical Design](./docs/TECHNICAL_DESIGN.md)** - System architecture and design patterns
- **[Database Schema](./docs/DATABASE_SCHEMA.md)** - Complete database documentation
- **[Integration Patterns](./docs/INTEGRATION_PATTERNS.md)** - Integration guidelines and patterns

### 🏢 **Enterprise Features**
- **[Enterprise Features](./docs/ENTERPRISE_FEATURES.md)** - Multi-tenant system overview
- **[Multi-Tenant Architecture](./docs/MULTI_TENANT_ARCHITECTURE.md)** - Architecture deep dive
- **[Onboarding System](./docs/ONBOARDING_SYSTEM.md)** - User onboarding and invitation flow

## 🔧 Configuration

### Environment Variables
```bash
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/deckstack"

# Authentication
JWT_SECRET="your-secure-jwt-secret"
SUPABASE_URL="your-supabase-url"
SUPABASE_ANON_KEY="your-supabase-anon-key"

# Application
NODE_ENV="development"
PORT=3005
API_VERSION="v1"
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Multi-tenant security tests
npm run test:security

# Integration tests
npm run test:integration

# Coverage report
npm run test:coverage
```

## 🚀 Deployment

### Production Deployment
```bash
# Build and deploy
npm run build
npm start
```

### Docker Deployment
```bash
docker build -t deckstack .
docker run -p 3005:3005 deckstack
```

### Vercel Deployment
```bash
vercel --prod
```

## 📊 API Overview

### Core Endpoints
```http
# Authentication
POST /api/v1/auth/login
POST /api/v1/auth/signup

# User Management
GET  /api/v1/users
POST /api/v1/users
POST /api/v1/users/invite

# Tenant Management
GET  /api/v1/tenants/current
PUT  /api/v1/tenants/{id}/settings

# Shipping Operations
GET  /api/v1/orders
POST /api/v1/shipping/labels
GET  /api/v1/shipping/rates
```

## 🔒 Security Features

- **Multi-Factor Authentication** (optional)
- **Role-Based Access Control** with granular permissions
- **Data Encryption** at rest and in transit
- **Rate Limiting** and DDoS protection
- **SQL Injection Prevention** with parameterized queries
- **XSS Protection** with input sanitization
- **Audit Logging** for compliance and security monitoring

## 📈 System Status

### Current Version: v1.0 - Production Ready ✅

**✅ Completed Features:**
- Multi-tenant architecture with complete data isolation
- Enterprise user management with RBAC
- Shipping automation with multi-carrier support
- TCG-specific features and optimizations
- Comprehensive audit logging and security
- Beautiful, responsive user interface
- Production deployment and monitoring

**🔄 In Development:**
- Advanced analytics dashboard
- Real-time notifications system
- Mobile application support

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## 🆘 Support

- **Documentation**: [docs/](./docs/)
- **Issues**: [GitHub Issues](https://github.com/your-org/deckstack/issues)
- **Live Demo**: [https://cardstore-woad.vercel.app](https://cardstore-woad.vercel.app)

---

**DeckStack** - Professional shipping automation for the modern e-commerce business.

*Stack the deck in your favor.* 🃏