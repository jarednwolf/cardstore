# Getting Started with CardStore Operations Layer

Welcome to the CardStore Operations Layer! This guide will help you get up and running quickly, whether you're a developer, store owner, or system administrator.

## 🎯 What is CardStore Operations Layer?

The CardStore Operations Layer is a comprehensive platform that connects your existing systems (Shopify, BinderPOS, TCGplayer) to provide:

- **Advanced Inventory Management** across multiple locations
- **Multi-Channel Sales** on eBay, Amazon, and other marketplaces  
- **Unified Order Processing** from all your sales channels
- **Automated Fulfillment** workflows
- **Real-time Synchronization** between all systems

## 🚀 Quick Start (5 Minutes)

### Option 1: Automated Setup (Recommended)

The easiest way to get started is with our interactive setup wizard:

```bash
# Clone the repository
git clone <repository-url>
cd cardstore-operations-layer

# Run the setup wizard
node scripts/onboarding.js
```

The wizard will:
- ✅ Check all prerequisites
- ✅ Install dependencies
- ✅ Configure your environment
- ✅ Set up databases
- ✅ Verify everything works

### Option 2: Manual Setup

If you prefer to set things up manually, follow the [Manual Setup Guide](#manual-setup) below.

## 📋 Prerequisites

Before you begin, make sure you have:

### Required
- **Node.js 18+** - [Download here](https://nodejs.org/)
- **npm** (comes with Node.js)

### Recommended
- **Docker Desktop** - [Download here](https://docs.docker.com/get-docker/)
- **Git** - [Download here](https://git-scm.com/)

### Optional (for manual database setup)
- **PostgreSQL 15+** - [Download here](https://www.postgresql.org/download/)
- **Redis 7+** - [Download here](https://redis.io/download)

## 🐳 Docker Setup (Recommended)

Docker makes setup incredibly easy by handling all the database and service configuration for you.

### 1. Install Docker Desktop

Visit [Docker's website](https://docs.docker.com/get-docker/) and download Docker Desktop for your operating system:

- **Windows**: Docker Desktop for Windows
- **macOS**: Docker Desktop for Mac  
- **Linux**: Docker Engine

### 2. Verify Docker Installation

```bash
docker --version
docker-compose --version
```

You should see version numbers for both commands.

### 3. Start All Services

```bash
# Start all services in the background
docker-compose up -d

# View logs (optional)
docker-compose logs -f
```

This starts:
- **PostgreSQL** database on port 5432
- **Redis** cache on port 6379
- **NATS** message queue on port 4222
- **Prometheus** monitoring on port 9090
- **Grafana** dashboards on port 3001

## 🔧 Manual Setup

If you can't use Docker, you can set up the services manually.

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment

```bash
# Copy the example environment file
cp .env.example .env

# Edit the .env file with your settings
nano .env  # or use your preferred editor
```

### 3. Install and Configure PostgreSQL

#### On macOS (using Homebrew):
```bash
brew install postgresql@15
brew services start postgresql@15
createdb cardstore_operations
```

#### On Ubuntu/Debian:
```bash
sudo apt update
sudo apt install postgresql-15
sudo systemctl start postgresql
sudo -u postgres createdb cardstore_operations
```

#### On Windows:
1. Download PostgreSQL from [postgresql.org](https://www.postgresql.org/download/windows/)
2. Run the installer
3. Create a database named `cardstore_operations`

### 4. Install and Configure Redis

#### On macOS (using Homebrew):
```bash
brew install redis
brew services start redis
```

#### On Ubuntu/Debian:
```bash
sudo apt update
sudo apt install redis-server
sudo systemctl start redis-server
```

#### On Windows:
1. Download Redis from [redis.io](https://redis.io/download)
2. Follow the installation instructions
3. Start the Redis server

### 5. Configure Database Connection

Update your `.env` file with your database connection details:

```env
DATABASE_URL="postgresql://username:password@localhost:5432/cardstore_operations"
REDIS_URL="redis://localhost:6379"
```

### 6. Set Up Database Schema

```bash
# Generate Prisma client
npm run db:generate

# Run database migrations
npm run db:migrate

# (Optional) Seed with sample data
npm run db:seed
```

## 🏃‍♂️ Running the Application

### Development Mode

```bash
# Start the development server with hot reload
npm run dev
```

The application will be available at: http://localhost:3000

### Production Mode

```bash
# Build the application
npm run build

# Start the production server
npm start
```

## ✅ Verify Your Setup

### Quick Health Check

Visit http://localhost:3000/health in your browser. You should see:

```json
{
  "status": "healthy",
  "timestamp": "2025-08-02T15:41:31.848Z",
  "services": {
    "database": "connected",
    "redis": "connected"
  }
}
```

### Comprehensive Health Check

Run our health check script:

```bash
node scripts/health-check.js
```

This will verify:
- ✅ All prerequisites are installed
- ✅ Environment is configured correctly
- ✅ Services are running
- ✅ Database connections work

## 🔗 Important URLs

Once everything is running, you can access:

| Service | URL | Description |
|---------|-----|-------------|
| **Application** | http://localhost:3000 | Main API server |
| **Health Check** | http://localhost:3000/health | System status |
| **API Documentation** | http://localhost:3000/api/docs | Interactive API docs |
| **Grafana** | http://localhost:3001 | Monitoring dashboards (admin/admin) |
| **Prometheus** | http://localhost:9090 | Metrics collection |
| **NATS Monitor** | http://localhost:8222 | Message queue status |
| **Prisma Studio** | Run `npm run db:studio` | Database browser |

## 🛠️ Development Commands

Here are the most common commands you'll use:

```bash
# Development
npm run dev              # Start development server with hot reload
npm run build            # Build for production
npm start                # Start production server

# Database
npm run db:generate      # Generate Prisma client after schema changes
npm run db:migrate       # Run database migrations
npm run db:studio        # Open database browser
npm run db:seed          # Seed database with sample data

# Testing
npm test                 # Run all tests
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Run tests with coverage report

# Code Quality
npm run lint             # Check code style
npm run lint:fix         # Fix code style issues

# Docker
docker-compose up -d     # Start all services
docker-compose down      # Stop all services
docker-compose logs -f   # View logs
```

## 🔐 Configuration

### Environment Variables

The most important environment variables to configure:

```env
# Database (required)
DATABASE_URL="postgresql://username:password@localhost:5432/cardstore_operations"
REDIS_URL="redis://localhost:6379"

# Security (required)
JWT_SECRET="your-super-secret-jwt-key-change-in-production"

# Application (optional)
NODE_ENV="development"
PORT=3000

# Shopify Integration (when ready)
SHOPIFY_API_KEY="your-shopify-api-key"
SHOPIFY_API_SECRET="your-shopify-api-secret"
SHOPIFY_WEBHOOK_SECRET="your-shopify-webhook-secret"
```

### Shopify Integration

To connect your Shopify store:

1. **Create a Shopify App**:
   - Go to your Shopify admin → Apps → Develop apps
   - Create a new app
   - Configure API scopes: `read_products,write_products,read_orders,write_orders,read_inventory,write_inventory`

2. **Get API Credentials**:
   - Copy the API key and secret
   - Add them to your `.env` file

3. **Set Up Webhooks**:
   - Configure webhooks in your Shopify app
   - Point them to: `https://your-domain.com/webhooks/shopify/`

### TCGplayer Integration

To connect TCGplayer:

1. **Get API Access**:
   - Apply for TCGplayer API access
   - Get your API key and secret

2. **Configure Environment**:
   ```env
   TCGPLAYER_API_KEY="your-tcgplayer-api-key"
   TCGPLAYER_API_SECRET="your-tcgplayer-api-secret"
   ```

## 🎯 Next Steps

Now that you have the system running:

1. **Explore the API**: Visit http://localhost:3000/api/docs
2. **Connect Shopify**: Follow the [Shopify Integration Guide](./INTEGRATION_PATTERNS.md#shopify)
3. **Set Up Monitoring**: Check out Grafana at http://localhost:3001
4. **Read the Documentation**: Browse the [docs/](.) folder
5. **Join the Community**: Contact engineering@cardstore.com

## 🆘 Need Help?

### Common Issues

- **Port already in use**: Change the PORT in your `.env` file
- **Database connection failed**: Check your DATABASE_URL and ensure PostgreSQL is running
- **Docker issues**: Make sure Docker Desktop is running

### Getting Support

1. **Check the troubleshooting guide**: [docs/TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
2. **Run the health check**: `node scripts/health-check.js`
3. **Check the logs**: `docker-compose logs -f app`
4. **Contact support**: engineering@cardstore.com

### Documentation

- **[API Reference](./API_SPECIFICATIONS.md)** - Complete API documentation
- **[Architecture Guide](../ARCHITECTURE_FOUNDATION.md)** - System design overview
- **[Integration Patterns](./INTEGRATION_PATTERNS.md)** - External system connections
- **[Database Schema](./DATABASE_SCHEMA.md)** - Data model reference

## 🎉 Welcome to CardStore!

You're now ready to start building with the CardStore Operations Layer. The system is designed to grow with your business, from a single store to a multi-location, multi-channel operation.

Happy coding! 🚀

---

**Built with ❤️ by the CardStore Engineering Team**