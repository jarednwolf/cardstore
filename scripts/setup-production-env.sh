#!/bin/bash

# CardStore Production Environment Setup Script
# This script helps configure production environment variables

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to generate secure random string
generate_secret() {
    openssl rand -base64 32 | tr -d "=+/" | cut -c1-32
}

# Function to prompt for input with default
prompt_with_default() {
    local prompt="$1"
    local default="$2"
    local var_name="$3"
    
    if [ -n "$default" ]; then
        read -p "$prompt [$default]: " input
        eval "$var_name=\"\${input:-$default}\""
    else
        read -p "$prompt: " input
        eval "$var_name=\"$input\""
    fi
}

# Function to prompt for secure input (hidden)
prompt_secure() {
    local prompt="$1"
    local var_name="$2"
    
    read -s -p "$prompt: " input
    echo
    eval "$var_name=\"$input\""
}

# Main setup function
setup_production_env() {
    print_status "Setting up CardStore production environment..."
    
    # Check if .env.production already exists
    if [ -f ".env.production" ]; then
        print_warning ".env.production already exists."
        read -p "Do you want to overwrite it? (y/N): " overwrite
        if [[ ! $overwrite =~ ^[Yy]$ ]]; then
            print_status "Keeping existing .env.production file"
            return
        fi
    fi
    
    print_status "We'll help you configure your production environment variables."
    echo
    
    # Application Configuration
    print_status "=== Application Configuration ==="
    prompt_with_default "Environment" "production" "NODE_ENV"
    prompt_with_default "Port" "3000" "PORT"
    prompt_with_default "API Version" "v1" "API_VERSION"
    echo
    
    # Database Configuration
    print_status "=== Database Configuration ==="
    print_status "For production, we recommend using Supabase PostgreSQL"
    prompt_with_default "Database URL" "postgresql://postgres:[PASSWORD]@db.[PROJECT-ID].supabase.co:5432/postgres" "DATABASE_URL"
    echo
    
    # Supabase Configuration
    print_status "=== Supabase Configuration ==="
    print_status "Get these values from your Supabase dashboard > Settings > API"
    prompt_with_default "Supabase URL" "https://[PROJECT-ID].supabase.co" "SUPABASE_URL"
    prompt_with_default "Supabase Anon Key" "" "SUPABASE_ANON_KEY"
    prompt_secure "Supabase Service Role Key" "SUPABASE_SERVICE_ROLE_KEY"
    echo
    
    # JWT Configuration
    print_status "=== JWT Configuration ==="
    print_status "Generating secure JWT secret..."
    JWT_SECRET=$(generate_secret)
    print_success "Generated secure JWT secret"
    prompt_with_default "JWT Expires In" "24h" "JWT_EXPIRES_IN"
    echo
    
    # Shopify Configuration
    print_status "=== Shopify Configuration ==="
    print_status "Get these from your Shopify Partner Dashboard"
    prompt_with_default "Shopify Webhook Secret" "" "SHOPIFY_WEBHOOK_SECRET"
    prompt_with_default "Shopify API Key" "" "SHOPIFY_API_KEY"
    prompt_secure "Shopify API Secret" "SHOPIFY_API_SECRET"
    prompt_with_default "Shopify Scopes" "read_products,write_products,read_orders,write_orders,read_inventory,write_inventory,read_customers,write_customers" "SHOPIFY_SCOPES"
    echo
    
    # External API Configuration (Optional)
    print_status "=== External APIs (Optional) ==="
    print_status "These are optional but recommended for enhanced functionality"
    prompt_with_default "TCGPlayer API Key (optional)" "" "TCGPLAYER_API_KEY"
    prompt_with_default "TCGPlayer API Secret (optional)" "" "TCGPLAYER_API_SECRET"
    prompt_with_default "BinderPOS API URL (optional)" "" "BINDERPOS_API_URL"
    prompt_with_default "BinderPOS API Key (optional)" "" "BINDERPOS_API_KEY"
    echo
    
    # eBay Configuration (Optional)
    print_status "=== eBay Configuration (Optional) ==="
    prompt_with_default "eBay Client ID (optional)" "" "EBAY_CLIENT_ID"
    prompt_with_default "eBay Client Secret (optional)" "" "EBAY_CLIENT_SECRET"
    prompt_with_default "eBay Sandbox Mode" "false" "EBAY_SANDBOX"
    echo
    
    # ShipStation Configuration (Optional)
    print_status "=== ShipStation Configuration (Optional) ==="
    prompt_with_default "ShipStation API Key (optional)" "" "SHIPSTATION_API_KEY"
    prompt_with_default "ShipStation API Secret (optional)" "" "SHIPSTATION_API_SECRET"
    echo
    
    # Security Configuration
    print_status "=== Security Configuration ==="
    prompt_with_default "Trust Proxy" "true" "TRUST_PROXY"
    prompt_with_default "CORS Origin" "https://your-domain.com" "CORS_ORIGIN"
    echo
    
    # Logging Configuration
    print_status "=== Logging Configuration ==="
    prompt_with_default "Log Level" "info" "LOG_LEVEL"
    prompt_with_default "Log Format" "json" "LOG_FORMAT"
    echo
    
    # Rate Limiting
    print_status "=== Rate Limiting ==="
    prompt_with_default "Rate Limit Window (ms)" "900000" "RATE_LIMIT_WINDOW_MS"
    prompt_with_default "Rate Limit Max Requests" "1000" "RATE_LIMIT_MAX_REQUESTS"
    echo
    
    # File Upload
    print_status "=== File Upload ==="
    prompt_with_default "Max File Size (MB)" "50" "MAX_FILE_SIZE_MB"
    prompt_with_default "Upload Path" "./uploads" "UPLOAD_PATH"
    echo
    
    # Multi-tenancy
    print_status "=== Multi-tenancy ==="
    prompt_with_default "Default Tenant ID" "default" "DEFAULT_TENANT_ID"
    echo
    
    # Monitoring (Optional)
    print_status "=== Monitoring (Optional) ==="
    prompt_with_default "Health Check Interval (ms)" "30000" "HEALTH_CHECK_INTERVAL"
    prompt_with_default "Sentry DSN (optional)" "" "SENTRY_DSN"
    prompt_with_default "New Relic License Key (optional)" "" "NEW_RELIC_LICENSE_KEY"
    echo
    
    # Create .env.production file
    print_status "Creating .env.production file..."
    
    cat > .env.production << EOF
# CardStore Operations Layer - Production Environment
# Generated on $(date)

# Application Configuration
NODE_ENV=$NODE_ENV
PORT=$PORT
API_VERSION=$API_VERSION

# Database Configuration
DATABASE_URL="$DATABASE_URL"

# Supabase Configuration
SUPABASE_URL="$SUPABASE_URL"
SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY"
SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY"

# JWT Configuration
JWT_SECRET="$JWT_SECRET"
JWT_EXPIRES_IN="$JWT_EXPIRES_IN"

# Security Configuration
TRUST_PROXY=$TRUST_PROXY
CORS_ORIGIN="$CORS_ORIGIN"

# Shopify Configuration
SHOPIFY_WEBHOOK_SECRET="$SHOPIFY_WEBHOOK_SECRET"
SHOPIFY_API_KEY="$SHOPIFY_API_KEY"
SHOPIFY_API_SECRET="$SHOPIFY_API_SECRET"
SHOPIFY_SCOPES="$SHOPIFY_SCOPES"

# External API Configuration
TCGPLAYER_API_KEY="$TCGPLAYER_API_KEY"
TCGPLAYER_API_SECRET="$TCGPLAYER_API_SECRET"
BINDERPOS_API_URL="$BINDERPOS_API_URL"
BINDERPOS_API_KEY="$BINDERPOS_API_KEY"

# eBay Configuration
EBAY_CLIENT_ID="$EBAY_CLIENT_ID"
EBAY_CLIENT_SECRET="$EBAY_CLIENT_SECRET"
EBAY_SANDBOX=$EBAY_SANDBOX

# ShipStation Configuration
SHIPSTATION_API_KEY="$SHIPSTATION_API_KEY"
SHIPSTATION_API_SECRET="$SHIPSTATION_API_SECRET"

# Logging Configuration
LOG_LEVEL="$LOG_LEVEL"
LOG_FORMAT="$LOG_FORMAT"

# Rate Limiting
RATE_LIMIT_WINDOW_MS=$RATE_LIMIT_WINDOW_MS
RATE_LIMIT_MAX_REQUESTS=$RATE_LIMIT_MAX_REQUESTS

# File Upload Configuration
MAX_FILE_SIZE_MB=$MAX_FILE_SIZE_MB
UPLOAD_PATH="$UPLOAD_PATH"

# Multi-tenancy
DEFAULT_TENANT_ID="$DEFAULT_TENANT_ID"

# Monitoring
HEALTH_CHECK_INTERVAL=$HEALTH_CHECK_INTERVAL
SENTRY_DSN="$SENTRY_DSN"
SENTRY_ENVIRONMENT="production"
NEW_RELIC_LICENSE_KEY="$NEW_RELIC_LICENSE_KEY"
NEW_RELIC_APP_NAME="CardStore Operations Layer"
EOF
    
    print_success ".env.production file created successfully!"
    echo
    
    print_status "=== Security Recommendations ==="
    echo "1. Never commit .env.production to version control"
    echo "2. Store sensitive values in your deployment platform's environment variables"
    echo "3. Regularly rotate your JWT secret and API keys"
    echo "4. Use strong, unique passwords for all services"
    echo "5. Enable 2FA on all external service accounts"
    echo
    
    print_status "=== Next Steps ==="
    echo "1. Review and update the generated .env.production file"
    echo "2. Set up your Supabase project and database"
    echo "3. Configure your Shopify app (if using Shopify integration)"
    echo "4. Run the deployment script: ./scripts/deploy-production.sh"
    echo "5. Test your production deployment thoroughly"
    echo
    
    print_success "Production environment setup completed!"
}

# Run the setup
setup_production_env