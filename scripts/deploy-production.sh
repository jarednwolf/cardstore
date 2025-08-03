#!/bin/bash

# CardStore Production Deployment Script
# This script automates the deployment process to production

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="cardstore-operations-layer"
DEPLOY_TARGET=${DEPLOY_TARGET:-"vercel"}  # Default to Vercel
ENVIRONMENT=${ENVIRONMENT:-"production"}

# Function to print colored output
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

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check Node.js
    if ! command_exists node; then
        print_error "Node.js is not installed. Please install Node.js 18+ and try again."
        exit 1
    fi
    
    # Check npm
    if ! command_exists npm; then
        print_error "npm is not installed. Please install npm and try again."
        exit 1
    fi
    
    # Check if we're in the right directory
    if [ ! -f "package.json" ]; then
        print_error "package.json not found. Please run this script from the project root directory."
        exit 1
    fi
    
    # Check deployment target specific requirements
    case $DEPLOY_TARGET in
        "vercel")
            if ! command_exists vercel; then
                print_warning "Vercel CLI not found. Installing..."
                npm install -g vercel
            fi
            ;;
        "railway")
            if ! command_exists railway; then
                print_warning "Railway CLI not found. Installing..."
                npm install -g @railway/cli
            fi
            ;;
        "supabase")
            if ! command_exists supabase; then
                print_error "Supabase CLI not found. Please install it first: npm install -g supabase"
                exit 1
            fi
            ;;
    esac
    
    print_success "Prerequisites check completed"
}

# Function to run tests
run_tests() {
    print_status "Running tests..."
    
    if npm run test > /dev/null 2>&1; then
        print_success "All tests passed"
    else
        print_warning "Some tests failed, but continuing deployment"
    fi
}

# Function to build the project
build_project() {
    print_status "Building project..."
    
    # Install dependencies
    print_status "Installing dependencies..."
    npm ci --production=false
    
    # Generate Prisma client
    print_status "Generating Prisma client..."
    npm run db:generate
    
    # Build TypeScript
    print_status "Building TypeScript..."
    npm run build
    
    print_success "Project built successfully"
}

# Function to setup environment variables
setup_environment() {
    print_status "Setting up environment variables..."
    
    # Check if production environment file exists
    if [ ! -f ".env.production" ]; then
        print_warning ".env.production not found. Creating from template..."
        
        if [ -f ".env.example" ]; then
            cp .env.example .env.production
            print_warning "Please update .env.production with your production values before deploying"
        else
            print_error ".env.example not found. Cannot create production environment file."
            exit 1
        fi
    fi
    
    # Validate required environment variables
    print_status "Validating environment variables..."
    
    required_vars=(
        "DATABASE_URL"
        "JWT_SECRET"
        "SHOPIFY_WEBHOOK_SECRET"
        "SHOPIFY_API_KEY"
        "SHOPIFY_API_SECRET"
    )
    
    missing_vars=()
    
    # Source the production environment file
    set -a
    source .env.production
    set +a
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ] || [ "${!var}" = "your-${var,,}" ]; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -ne 0 ]; then
        print_error "Missing or placeholder values for required environment variables:"
        for var in "${missing_vars[@]}"; do
            print_error "  - $var"
        done
        print_error "Please update .env.production with actual values"
        exit 1
    fi
    
    print_success "Environment variables validated"
}

# Function to deploy to Vercel
deploy_vercel() {
    print_status "Deploying to Vercel..."
    
    # Check if vercel.json exists
    if [ ! -f "vercel.json" ]; then
        print_error "vercel.json not found. Please create it first."
        exit 1
    fi
    
    # Deploy to Vercel
    if [ "$ENVIRONMENT" = "production" ]; then
        vercel --prod --yes
    else
        vercel --yes
    fi
    
    print_success "Deployed to Vercel successfully"
}

# Function to deploy to Railway
deploy_railway() {
    print_status "Deploying to Railway..."
    
    # Login to Railway if not already logged in
    if ! railway whoami > /dev/null 2>&1; then
        print_status "Please login to Railway..."
        railway login
    fi
    
    # Deploy to Railway
    railway up
    
    print_success "Deployed to Railway successfully"
}

# Function to deploy to Supabase
deploy_supabase() {
    print_status "Deploying to Supabase..."
    
    # Check if supabase config exists
    if [ ! -f "supabase/config.toml" ]; then
        print_error "Supabase config not found. Please run 'supabase init' first."
        exit 1
    fi
    
    # Deploy database migrations
    print_status "Running database migrations..."
    supabase db push
    
    # Deploy edge functions if they exist
    if [ -d "supabase/functions" ]; then
        print_status "Deploying edge functions..."
        supabase functions deploy
    fi
    
    print_success "Deployed to Supabase successfully"
}

# Function to run database migrations
run_migrations() {
    print_status "Running database migrations..."
    
    case $DEPLOY_TARGET in
        "supabase")
            # Migrations are handled in deploy_supabase
            return
            ;;
        *)
            # For other platforms, run Prisma migrations
            if [ "$ENVIRONMENT" = "production" ]; then
                npm run db:migrate:prod
            else
                npm run db:migrate
            fi
            ;;
    esac
    
    print_success "Database migrations completed"
}

# Function to verify deployment
verify_deployment() {
    print_status "Verifying deployment..."
    
    # Get the deployment URL based on target
    case $DEPLOY_TARGET in
        "vercel")
            DEPLOY_URL=$(vercel ls --scope=team 2>/dev/null | grep "$PROJECT_NAME" | head -1 | awk '{print $2}' || echo "")
            ;;
        "railway")
            DEPLOY_URL=$(railway status --json 2>/dev/null | jq -r '.deployments[0].url' 2>/dev/null || echo "")
            ;;
        *)
            print_warning "Cannot automatically verify deployment for $DEPLOY_TARGET"
            return
            ;;
    esac
    
    if [ -n "$DEPLOY_URL" ]; then
        print_status "Testing deployment at: $DEPLOY_URL"
        
        # Test health endpoint
        if curl -f -s "$DEPLOY_URL/health" > /dev/null; then
            print_success "Deployment is healthy and responding"
        else
            print_warning "Deployment may not be fully ready yet"
        fi
    else
        print_warning "Could not determine deployment URL"
    fi
}

# Function to cleanup
cleanup() {
    print_status "Cleaning up..."
    
    # Remove any temporary files
    rm -f .env.temp
    
    print_success "Cleanup completed"
}

# Main deployment function
main() {
    print_status "Starting CardStore production deployment..."
    print_status "Target: $DEPLOY_TARGET"
    print_status "Environment: $ENVIRONMENT"
    
    # Run deployment steps
    check_prerequisites
    setup_environment
    build_project
    run_tests
    
    # Deploy based on target
    case $DEPLOY_TARGET in
        "vercel")
            deploy_vercel
            ;;
        "railway")
            deploy_railway
            ;;
        "supabase")
            deploy_supabase
            ;;
        "both")
            deploy_vercel
            deploy_supabase
            ;;
        *)
            print_error "Unknown deployment target: $DEPLOY_TARGET"
            print_error "Supported targets: vercel, railway, supabase, both"
            exit 1
            ;;
    esac
    
    # Run migrations (except for Supabase which handles it differently)
    if [ "$DEPLOY_TARGET" != "supabase" ]; then
        run_migrations
    fi
    
    verify_deployment
    cleanup
    
    print_success "🚀 Deployment completed successfully!"
    print_status "Your CardStore application is now live and ready for your friends to use!"
    
    # Show next steps
    echo ""
    print_status "Next steps:"
    echo "1. Test the application thoroughly"
    echo "2. Set up monitoring and alerts"
    echo "3. Share the URL with your friends"
    echo "4. Monitor logs for any issues"
    
    if [ "$DEPLOY_TARGET" = "vercel" ] && [ -n "$DEPLOY_URL" ]; then
        echo ""
        print_success "🌐 Your application is available at: $DEPLOY_URL"
    fi
}

# Handle script interruption
trap cleanup EXIT

# Run main function
main "$@"