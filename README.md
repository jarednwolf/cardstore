# 🃏 DeckStack

**Stack the deck in your favor with automated card store operations**

A comprehensive multi-tenant operations platform designed specifically for trading card game (TCG) stores. DeckStack provides seamless integration between various sales channels, inventory management, and fulfillment operations - giving you the winning hand in card store automation.

## 🎯 Overview

DeckStack serves as the central nervous system for modern card stores, handling:

- **🛒 Multi-Channel Sales**: Shopify, eBay, Amazon, Google marketplace integration
- **📦 Inventory Management**: Real-time tracking across multiple locations
- **🚚 Shipping Automation**: One-click label creation and batch processing
- **🃏 TCG-Specific Features**: Enhanced product attributes for trading cards
- **🏢 Multi-Tenant Architecture**: Support for multiple store instances
- **⚡ Real-Time Sync**: Webhook-driven updates across all platforms

## 🚀 Quick Start

### 🎯 New User? Start Here! (Recommended)

We've created an **interactive setup wizard** that makes getting started super easy:

```bash
git clone <repository-url>
cd deckstack
npm run setup
```

The setup wizard will:
- ✅ Check all prerequisites automatically
- ✅ Install dependencies
- ✅ Configure your environment step-by-step
- ✅ Set up databases (Docker or manual)
- ✅ Verify everything works
- ✅ Show you exactly what to do next

**Perfect for non-technical users!** The wizard guides you through every step with clear instructions and helpful tips.

### 🔧 Manual Setup (Advanced Users)

If you prefer manual setup:

```bash
# 1. Install dependencies
npm install

# 2. Environment setup
cp .env.example .env
# Edit .env with your configuration

# 3. Database setup
npm run db:generate
npm run db:migrate

# 4. Start development server
npm run dev
```

### ✅ Verify Your Setup

Check if everything is working:

```bash
npm run health
```

DeckStack will be available at `http://localhost:3005`

### 🎮 Access DeckStack

- **Main Dashboard**: `http://localhost:3005`
- **Shipping & Labels**: `http://localhost:3005/shipping.html`
- **Health Check**: `http://localhost:3005/health`
- **API Documentation**: `http://localhost:3005/api/docs`

## 🃏 Features

### Core Operations
- **📊 Order Management**: Unified processing across all sales channels
- **📦 Inventory Control**: Multi-location tracking with channel buffers
- **🚚 Shipping Automation**: USPS, UPS, FedEx, DHL label creation
- **🔄 Real-Time Sync**: Instant updates between platforms
- **📱 Modern Interface**: Intuitive web-based management

### TCG-Specific Features
- **🃏 Card Attributes**: Set, rarity, condition, grading information
- **💎 High-Value Handling**: Special processing for expensive cards
- **📈 Market Integration**: TCGplayer and other marketplace connections
- **🏆 Condition Tracking**: Near Mint, Lightly Played, etc.

### Shipping & Fulfillment
- **🏷️ One-Click Labels**: Create shipping labels instantly
- **📋 Batch Processing**: Handle multiple orders simultaneously
- **📍 Package Tracking**: Real-time shipment monitoring
- **⚙️ Carrier Settings**: Configurable shipping preferences
- **💰 Cost Optimization**: Automatic rate shopping

### Integration Ecosystem
- **🛍️ Shopify**: Deep ecommerce integration
- **🏪 BinderPOS**: In-store point-of-sale connection
- **🌐 TCGplayer**: Marketplace synchronization
- **📦 eBay/Amazon**: Multi-channel selling
- **🔗 Webhooks**: Real-time event processing

## 🏗️ Architecture

DeckStack follows a modern, scalable architecture:

### Technology Stack
- **Runtime**: Node.js 18+ with TypeScript
- **Framework**: Express.js with OpenAPI documentation
- **Database**: SQLite (development) / PostgreSQL (production)
- **ORM**: Prisma for type-safe database access
- **Frontend**: Modern HTML5/CSS3/JavaScript
- **Authentication**: JWT with multi-tenant support
- **Containerization**: Docker with Kubernetes support

### Core Services
- **API Gateway**: Request routing, authentication, rate limiting
- **Catalog Service**: Product and variant management with TCG attributes
- **Inventory Service**: Multi-location inventory with channel buffers
- **Order Service**: Unified order management across channels
- **Shipping Service**: Label creation and tracking automation
- **Webhook Service**: External system integration and event processing

## 📋 Prerequisites

- Node.js 18+ and npm
- SQLite (included) or PostgreSQL 15+
- Docker and Docker Compose (optional, for containerized development)

## 🐳 Docker Development

### Start All Services

```bash
docker-compose up -d
```

This starts:
- **DeckStack Application**: `http://localhost:3005`
- **PostgreSQL**: `localhost:5432`
- **Redis**: `localhost:6379`

### View Logs

```bash
docker-compose logs -f app
```

### Stop Services

```bash
docker-compose down
```

## 📚 API Documentation

### Health Checks
- `GET /health` - Application health status
- `GET /health/ready` - Readiness check (Kubernetes)
- `GET /health/live` - Liveness check (Kubernetes)

### Orders (Protected)
- `GET /api/v1/orders` - List orders with filters
- `GET /api/v1/orders/:id` - Get order details
- `POST /api/v1/orders` - Create new order
- `PUT /api/v1/orders/:id` - Update order

### Shipping (Protected)
- `POST /api/v1/shipping/labels` - Create shipping label
- `POST /api/v1/shipping/labels/batch` - Create multiple labels
- `POST /api/v1/shipping/labels/print` - Print labels
- `GET /api/v1/shipping/track/:trackingNumber` - Track shipment
- `GET /api/v1/shipping/carriers` - List available carriers

### Products (Protected)
- `GET /api/v1/products` - List products with search/filters
- `GET /api/v1/products/:id` - Get product details
- `POST /api/v1/products` - Create new product
- `PUT /api/v1/products/:id` - Update product

### Inventory (Protected)
- `GET /api/v1/inventory` - List inventory items
- `GET /api/v1/inventory/:variantId` - Get variant inventory
- `PUT /api/v1/inventory/:variantId` - Update inventory
- `POST /api/v1/inventory/bulk` - Bulk inventory updates

## 🧪 Testing

### Run Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Test Structure

```
src/
├── __tests__/          # Integration tests
├── services/
│   └── __tests__/      # Service unit tests
├── controllers/
│   └── __tests__/      # Controller unit tests
└── middleware/
    └── __tests__/      # Middleware unit tests
```

## 🔧 Development

### 🚀 Getting Started Commands

```bash
# Interactive setup (recommended for new users)
npm run setup

# Check system health
npm run health

# Get health status as JSON
npm run health:json
```

### Code Quality

```bash
# Lint code
npm run lint

# Fix linting issues
npm run lint:fix
```

### Database Operations

```bash
# Generate Prisma client after schema changes
npm run db:generate

# Create and apply new migration
npm run db:migrate

# Reset database (development only)
npx prisma migrate reset

# Open Prisma Studio
npm run db:studio

# Seed test data
npm run db:seed
```

### Build for Production

```bash
# Build TypeScript
npm run build

# Start production server
npm start
```

## 🔐 Security

### Authentication
- JWT-based authentication with demo token support
- Role-based access control (RBAC)
- Multi-tenant isolation

### API Security
- Rate limiting
- CORS configuration
- Request validation
- HMAC webhook verification

### Data Protection
- Encryption at rest and in transit
- Audit logging for all data modifications
- Row-level security for multi-tenancy

## 🚀 Deployment

### Environment Variables

Required environment variables:
- `DATABASE_URL` - Database connection string
- `JWT_SECRET` - JWT signing secret
- `NODE_ENV` - Environment (development/production)

See `.env.example` for complete list.

### Production Deployment

```bash
# Build Docker image
docker build -t deckstack .

# Run container
docker run -p 3005:3005 \
  -e DATABASE_URL="your-db-url" \
  -e JWT_SECRET="your-jwt-secret" \
  deckstack
```

## 📖 Documentation

### Architecture Documentation
- [Product Requirements Document](docs/PRD.md)
- [Architecture Foundation](ARCHITECTURE_FOUNDATION.md)
- [Technical Design Specification](docs/TECHNICAL_DESIGN.md)
- [Database Schema Design](docs/DATABASE_SCHEMA.md)
- [Integration Patterns](docs/INTEGRATION_PATTERNS.md)
- [API Specifications](docs/API_SPECIFICATIONS.md)

### User Guides
- [Getting Started Guide](docs/GETTING_STARTED.md)
- [Browser Test Results](docs/BROWSER_TEST_RESULTS.md)
- [Troubleshooting Guide](docs/TROUBLESHOOTING.md)
- [Complete Documentation](docs/README.md)

## 🤝 Contributing

We welcome contributions to DeckStack! 

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow TypeScript best practices
- Write tests for new features
- Update documentation as needed
- Follow conventional commit messages

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

### 🔍 Self-Help Resources

- **[Getting Started Guide](docs/GETTING_STARTED.md)** - Comprehensive setup guide for beginners
- **[Troubleshooting Guide](docs/TROUBLESHOOTING.md)** - Solutions to common issues
- **[Health Check Tool](scripts/health-check.js)** - Diagnose system problems
- **[Complete Documentation](docs/README.md)** - Full documentation suite

### 🆘 Need More Help?

- **Engineering Team**: engineering@deckstack.com
- **Product Team**: product@deckstack.com
- **GitHub Issues**: Report bugs and request features

### 🔧 Before Contacting Support

1. Run the health check: `npm run health`
2. Check the [troubleshooting guide](docs/TROUBLESHOOTING.md)
3. Review recent logs: `docker-compose logs -f app`

## 🗺️ Roadmap

### Phase 1: Foundation ✅
- [x] Project structure and development environment
- [x] Core shipping and label automation
- [x] Order management system
- [x] Multi-tenant architecture
- [x] Professional web interface

### Phase 2: Enhanced Integration (In Progress)
- [ ] Advanced Shopify integration
- [ ] eBay marketplace connector
- [ ] Inventory synchronization
- [ ] Batch fulfillment workflows

### Phase 3: Advanced Features (Planned)
- [ ] TCGplayer marketplace integration
- [ ] Advanced reporting and analytics
- [ ] Mobile optimization
- [ ] API rate optimization

### Phase 4: Scale and Optimization (Future)
- [ ] Performance optimization
- [ ] Additional marketplace connectors
- [ ] Advanced pricing rules
- [ ] Machine learning insights

---

**🃏 DeckStack** - Stack the deck in your favor with automated card store operations

*Built with ❤️ by the DeckStack Engineering Team*