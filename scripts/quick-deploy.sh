#!/bin/bash

# CardStore Quick Production Deployment
# This script automates the deployment process as much as possible

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

print_header() {
    echo -e "${PURPLE}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                    CardStore Quick Deploy                    ║"
    echo "║              Production Deployment Automation               ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_step() {
    echo -e "${BLUE}[STEP $1]${NC} $2"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to wait for user confirmation
wait_for_confirmation() {
    echo
    read -p "Press Enter to continue or Ctrl+C to abort..."
    echo
}

# Main deployment function
main() {
    print_header
    
    echo "This script will help you deploy CardStore to production in about 30 minutes."
    echo "You'll need:"
    echo "  • A Supabase account (free)"
    echo "  • A Vercel account (free)"
    echo "  • About 30 minutes of time"
    echo
    
    wait_for_confirmation
    
    # Step 1: Check prerequisites
    print_step "1" "Checking prerequisites..."
    
    if ! command_exists node; then
        print_error "Node.js not found. Please install Node.js 18+ first."
        exit 1
    fi
    
    if ! command_exists npm; then
        print_error "npm not found. Please install npm first."
        exit 1
    fi
    
    print_success "Node.js and npm are installed"
    
    # Step 2: Install required CLIs
    print_step "2" "Installing required tools..."
    
    if ! command_exists supabase; then
        print_info "Installing Supabase CLI..."
        npm install -g supabase
    fi
    
    if ! command_exists vercel; then
        print_info "Installing Vercel CLI..."
        npm install -g vercel
    fi
    
    print_success "All tools are ready"
    
    # Step 3: Supabase setup
    print_step "3" "Setting up Supabase..."
    
    echo "🔗 Please complete these steps in your browser:"
    echo "1. Go to https://supabase.com and create an account"
    echo "2. Create a new project named 'cardstore-production'"
    echo "3. Choose a strong database password and save it"
    echo "4. Wait for the project to be created (2-3 minutes)"
    echo "5. Go to Settings → API and copy your project details"
    echo
    
    wait_for_confirmation
    
    # Step 4: Environment configuration
    print_step "4" "Configuring environment..."
    
    if [ ! -f ".env.production" ]; then
        print_info "Running environment setup..."
        ./scripts/setup-production-env.sh
    else
        print_warning ".env.production already exists. Using existing configuration."
    fi
    
    print_success "Environment configured"
    
    # Step 5: Supabase authentication
    print_step "5" "Connecting to Supabase..."
    
    print_info "Please login to Supabase CLI..."
    supabase login
    
    echo "Enter your Supabase project ID (from the URL: https://supabase.com/dashboard/project/[PROJECT-ID]):"
    read -p "Project ID: " PROJECT_ID
    
    if [ -n "$PROJECT_ID" ]; then
        print_info "Linking to Supabase project..."
        supabase link --project-ref "$PROJECT_ID"
        print_success "Connected to Supabase"
    else
        print_error "Project ID is required"
        exit 1
    fi
    
    # Step 6: Deploy database
    print_step "6" "Deploying database schema..."
    
    print_info "Pushing database migrations..."
    supabase db push
    
    print_success "Database schema deployed"
    
    # Step 7: Build project
    print_step "7" "Building project..."
    
    print_info "Installing dependencies..."
    npm ci
    
    print_info "Generating Prisma client..."
    npm run db:generate
    
    print_info "Building TypeScript..."
    npm run build
    
    print_success "Project built successfully"
    
    # Step 8: Deploy to Vercel
    print_step "8" "Deploying to Vercel..."
    
    print_info "Please login to Vercel CLI..."
    vercel login
    
    print_info "Deploying to Vercel..."
    vercel --prod
    
    print_success "Deployed to Vercel"
    
    # Step 9: Get deployment URL
    print_step "9" "Getting deployment information..."
    
    VERCEL_URL=$(vercel ls 2>/dev/null | grep "$PROJECT_NAME" | head -1 | awk '{print $2}' || echo "")
    
    if [ -z "$VERCEL_URL" ]; then
        echo "Enter your Vercel deployment URL (e.g., https://cardstore-abc123.vercel.app):"
        read -p "Deployment URL: " VERCEL_URL
    fi
    
    if [ -n "$VERCEL_URL" ]; then
        print_success "Deployment URL: $VERCEL_URL"
    fi
    
    # Step 10: Configure Supabase authentication
    print_step "10" "Final Supabase configuration..."
    
    echo "🔗 Please complete these final steps in Supabase dashboard:"
    echo "1. Go to https://supabase.com/dashboard/project/$PROJECT_ID"
    echo "2. Navigate to Authentication → Settings"
    echo "3. Set Site URL to: $VERCEL_URL"
    echo "4. Add Redirect URL: $VERCEL_URL"
    echo "5. Save the settings"
    echo
    
    wait_for_confirmation
    
    # Step 11: Test deployment
    print_step "11" "Testing deployment..."
    
    if [ -n "$VERCEL_URL" ]; then
        print_info "Testing health endpoint..."
        if curl -f -s "$VERCEL_URL/health" > /dev/null; then
            print_success "Health check passed"
        else
            print_warning "Health check failed - this might be normal if environment variables aren't set yet"
        fi
    fi
    
    # Final success message
    echo
    print_success "🎉 Deployment completed!"
    echo
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${GREEN}🚀 Your CardStore is now live!${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo
    if [ -n "$VERCEL_URL" ]; then
        echo -e "${BLUE}🌐 Application URL:${NC} $VERCEL_URL"
    fi
    echo -e "${BLUE}📊 Supabase Dashboard:${NC} https://supabase.com/dashboard/project/$PROJECT_ID"
    echo -e "${BLUE}🚀 Vercel Dashboard:${NC} https://vercel.com/dashboard"
    echo
    echo -e "${YELLOW}Next Steps:${NC}"
    echo "1. Visit your application URL and test user registration"
    echo "2. Create a test store to verify everything works"
    echo "3. Share the URL with your friends!"
    echo "4. Monitor the application using the dashboards above"
    echo
    echo -e "${BLUE}📚 Documentation:${NC}"
    echo "• User Guide: docs/USER_GUIDE.md"
    echo "• Production Guide: docs/PRODUCTION_READINESS_GUIDE.md"
    echo "• Deployment Checklist: DEPLOYMENT_CHECKLIST.md"
    echo
    echo -e "${GREEN}🎯 Your friends can now create their own card stores!${NC}"
    echo
}

# Handle script interruption
cleanup() {
    echo
    print_warning "Deployment interrupted. You can resume by running this script again."
    exit 1
}

trap cleanup INT

# Run main function
main "$@"