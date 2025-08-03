# Troubleshooting Guide

This guide helps you resolve common issues when setting up and running the CardStore Operations Layer.

## 🔍 Quick Diagnosis

Before diving into specific issues, run our health check to identify problems:

```bash
node scripts/health-check.js
```

This will show you exactly what's working and what needs attention.

## 🚨 Common Issues

### 1. Port Already in Use

**Error**: `EADDRINUSE: address already in use :::3000`

**Cause**: Another application is using port 3000.

**Solutions**:

```bash
# Option 1: Find and stop the process using port 3000
lsof -ti:3000 | xargs kill -9

# Option 2: Use a different port
echo "PORT=3001" >> .env
npm run dev

# Option 3: Check what's using the port
lsof -i :3000
```

### 2. Database Connection Failed

**Error**: `Error: connect ECONNREFUSED 127.0.0.1:5432`

**Cause**: PostgreSQL is not running or connection details are incorrect.

**Solutions**:

#### If using Docker:
```bash
# Check if PostgreSQL container is running
docker-compose ps

# Start PostgreSQL if not running
docker-compose up -d postgres

# Check logs for errors
docker-compose logs postgres
```

#### If using local PostgreSQL:
```bash
# Check if PostgreSQL is running (macOS)
brew services list | grep postgresql

# Start PostgreSQL (macOS)
brew services start postgresql@15

# Check if PostgreSQL is running (Linux)
sudo systemctl status postgresql

# Start PostgreSQL (Linux)
sudo systemctl start postgresql
```

#### Check connection details:
```bash
# Verify your DATABASE_URL in .env
cat .env | grep DATABASE_URL

# Test connection manually
psql "postgresql://username:password@localhost:5432/cardstore_operations"
```

### 3. Redis Connection Failed

**Error**: `Error: connect ECONNREFUSED 127.0.0.1:6379`

**Cause**: Redis is not running.

**Solutions**:

#### If using Docker:
```bash
# Start Redis container
docker-compose up -d redis

# Check Redis logs
docker-compose logs redis
```

#### If using local Redis:
```bash
# Start Redis (macOS)
brew services start redis

# Start Redis (Linux)
sudo systemctl start redis-server

# Test Redis connection
redis-cli ping
```

### 4. Docker Issues

**Error**: `Cannot connect to the Docker daemon`

**Cause**: Docker Desktop is not running.

**Solutions**:

```bash
# Start Docker Desktop (varies by OS)
# On macOS: Open Docker Desktop from Applications
# On Windows: Open Docker Desktop from Start Menu
# On Linux: sudo systemctl start docker

# Verify Docker is running
docker --version
docker-compose --version

# Test Docker
docker run hello-world
```

### 5. Node.js Version Issues

**Error**: `Error: Node.js version 16.x.x is not supported`

**Cause**: You're using an older version of Node.js.

**Solutions**:

```bash
# Check your Node.js version
node --version

# Install Node.js 18+ from https://nodejs.org/
# Or use a version manager like nvm:

# Install nvm (macOS/Linux)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Install and use Node.js 18
nvm install 18
nvm use 18
```

### 6. npm Install Failures

**Error**: `npm ERR! peer dep missing`

**Cause**: Dependency conflicts or network issues.

**Solutions**:

```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and package-lock.json
rm -rf node_modules package-lock.json

# Reinstall dependencies
npm install

# If still failing, try legacy peer deps
npm install --legacy-peer-deps
```

### 7. Prisma Migration Errors

**Error**: `Migration failed to apply cleanly to the shadow database`

**Cause**: Database schema conflicts or permissions.

**Solutions**:

```bash
# Reset the database (development only!)
npx prisma migrate reset

# Generate Prisma client
npm run db:generate

# Apply migrations
npm run db:migrate

# If permissions issue, check database user permissions
```

### 8. Environment Variables Not Loading

**Error**: `JWT_SECRET is required`

**Cause**: Environment variables are not being loaded.

**Solutions**:

```bash
# Check if .env file exists
ls -la .env

# Copy from example if missing
cp .env.example .env

# Verify .env content
cat .env

# Check for syntax errors in .env (no spaces around =)
# Correct: JWT_SECRET="value"
# Incorrect: JWT_SECRET = "value"
```

### 9. Webhook Verification Failed

**Error**: `Webhook signature verification failed`

**Cause**: Incorrect webhook secret or signature mismatch.

**Solutions**:

```bash
# Check your Shopify webhook secret
cat .env | grep SHOPIFY_WEBHOOK_SECRET

# Verify webhook URL in Shopify admin
# Should be: https://your-domain.com/webhooks/shopify/...

# Test webhook locally with ngrok
npm install -g ngrok
ngrok http 3000
# Use the ngrok URL for webhook endpoints
```

### 10. Memory Issues

**Error**: `JavaScript heap out of memory`

**Cause**: Insufficient memory allocation for Node.js.

**Solutions**:

```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"
npm run dev

# Or add to package.json scripts:
"dev": "NODE_OPTIONS='--max-old-space-size=4096' tsx watch src/index.ts"
```

## 🐳 Docker-Specific Issues

### Container Won't Start

```bash
# Check container status
docker-compose ps

# View container logs
docker-compose logs [service-name]

# Restart specific service
docker-compose restart [service-name]

# Rebuild containers
docker-compose build --no-cache
docker-compose up -d
```

### Volume Permission Issues

```bash
# Fix volume permissions (Linux/macOS)
sudo chown -R $USER:$USER ./logs
sudo chown -R $USER:$USER ./uploads

# Or run with proper user
docker-compose down
docker-compose up -d --user $(id -u):$(id -g)
```

### Network Issues

```bash
# Recreate Docker network
docker-compose down
docker network prune
docker-compose up -d
```

## 🔧 Development Issues

### Hot Reload Not Working

```bash
# Check if tsx is installed
npm list tsx

# Reinstall development dependencies
npm install --only=dev

# Use nodemon as alternative
npm install -g nodemon
nodemon --exec tsx src/index.ts
```

### TypeScript Compilation Errors

```bash
# Check TypeScript version
npx tsc --version

# Clean build
rm -rf dist
npm run build

# Check tsconfig.json for errors
npx tsc --noEmit
```

### ESLint/Prettier Issues

```bash
# Fix linting issues
npm run lint:fix

# Check for conflicting rules
npx eslint --print-config src/index.ts
```

## 🌐 Production Issues

### Application Won't Start

```bash
# Check environment variables
printenv | grep -E "(DATABASE_URL|JWT_SECRET|NODE_ENV)"

# Check application logs
tail -f logs/app.log

# Verify build artifacts
ls -la dist/
```

### Database Connection Pool Exhausted

```bash
# Check active connections
SELECT count(*) FROM pg_stat_activity WHERE state = 'active';

# Increase connection pool size in DATABASE_URL
DATABASE_URL="postgresql://user:pass@host:5432/db?connection_limit=20"
```

### High Memory Usage

```bash
# Monitor memory usage
docker stats

# Check for memory leaks
node --inspect src/index.ts
# Open chrome://inspect in Chrome
```

## 📊 Monitoring and Debugging

### Enable Debug Logging

```bash
# Set debug log level
echo "LOG_LEVEL=debug" >> .env

# View logs in real-time
tail -f logs/app.log

# Or with Docker
docker-compose logs -f app
```

### Health Check Endpoints

```bash
# Basic health check
curl http://localhost:3000/health

# Detailed health check
curl http://localhost:3000/health/detailed

# Database connectivity
curl http://localhost:3000/health/db
```

### Performance Monitoring

```bash
# Check Prometheus metrics
curl http://localhost:9090/metrics

# View Grafana dashboards
open http://localhost:3001
# Login: admin/admin
```

## 🔍 Diagnostic Commands

### System Information

```bash
# Check system resources
df -h          # Disk space
free -h        # Memory usage
top            # CPU usage

# Check network connectivity
ping google.com
nslookup localhost
```

### Application Diagnostics

```bash
# Check process status
ps aux | grep node

# Check open files
lsof -p $(pgrep -f "node.*src/index")

# Check network connections
netstat -tulpn | grep :3000
```

### Database Diagnostics

```bash
# Connect to database
psql $DATABASE_URL

# Check database size
\l+

# Check table sizes
\dt+

# Check active connections
SELECT * FROM pg_stat_activity;
```

## 🆘 Getting Help

### Before Asking for Help

1. **Run the health check**: `node scripts/health-check.js`
2. **Check the logs**: `docker-compose logs -f` or `tail -f logs/app.log`
3. **Search this guide**: Use Ctrl+F to search for your error message
4. **Check GitHub issues**: Look for similar problems in the repository

### Information to Include

When reporting issues, please include:

```bash
# System information
node --version
npm --version
docker --version
docker-compose --version

# Health check results
node scripts/health-check.js --json

# Recent logs
docker-compose logs --tail=50 app

# Environment (remove sensitive data)
cat .env | sed 's/=.*/=***/'
```

### Contact Support

- **GitHub Issues**: Create an issue in the repository
- **Email**: engineering@cardstore.com
- **Documentation**: Check [docs/README.md](./README.md)

## 📚 Additional Resources

- **[Getting Started Guide](./GETTING_STARTED.md)** - Initial setup instructions
- **[API Documentation](./API_SPECIFICATIONS.md)** - Complete API reference
- **[Architecture Guide](../ARCHITECTURE_FOUNDATION.md)** - System design overview
- **[Integration Patterns](./INTEGRATION_PATTERNS.md)** - External system connections

## 🔄 Recovery Procedures

### Complete Reset (Development)

```bash
# Stop all services
docker-compose down -v

# Remove all data
docker volume prune
rm -rf node_modules
rm -rf dist
rm .env

# Start fresh
cp .env.example .env
npm install
docker-compose up -d
npm run db:migrate
```

### Backup and Restore

```bash
# Backup database
pg_dump $DATABASE_URL > backup.sql

# Restore database
psql $DATABASE_URL < backup.sql

# Backup with Docker
docker-compose exec postgres pg_dump -U cardstore cardstore_operations > backup.sql
```

---

**Remember**: Most issues can be resolved by carefully reading error messages and checking the basics (services running, environment configured, network connectivity). When in doubt, start with the health check script!