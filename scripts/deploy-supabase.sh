#!/bin/bash

# Supabase Deployment Script for CardStore Operations Layer
# This script deploys your application to Supabase + Vercel

set -e

echo "🚀 Deploying CardStore to Supabase + Vercel"
echo "============================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

# Check if Supabase CLI is installed
check_supabase_cli() {
    print_status "Checking Supabase CLI..."
    
    if ! command -v supabase &> /dev/null; then
        print_warning "Supabase CLI not found. Installing..."
        npm install -g supabase
    fi
    
    print_success "Supabase CLI is available"
}

# Check if Vercel CLI is installed
check_vercel_cli() {
    print_status "Checking Vercel CLI..."
    
    if ! command -v vercel &> /dev/null; then
        print_warning "Vercel CLI not found. Installing..."
        npm install -g vercel
    fi
    
    print_success "Vercel CLI is available"
}

# Link to Supabase project
link_supabase_project() {
    print_status "Linking to Supabase project..."
    
    # Link to your specific project
    supabase link --project-ref iqkwlsrjgwvcbemvdqak
    
    print_success "Linked to Supabase project"
}

# Deploy database schema
deploy_database() {
    print_status "Deploying database schema..."
    
    # Push database changes
    supabase db push
    
    print_success "Database schema deployed"
}

# Deploy Edge Functions
deploy_edge_functions() {
    print_status "Deploying Edge Functions..."
    
    # Deploy health function
    supabase functions deploy health --no-verify-jwt
    
    # Deploy API function
    supabase functions deploy api --no-verify-jwt
    
    print_success "Edge Functions deployed"
}

# Set environment secrets
set_secrets() {
    print_status "Setting environment secrets..."
    
    # Check if .env.supabase exists
    if [[ ! -f ".env.supabase" ]]; then
        print_error ".env.supabase file not found. Please create it first."
        exit 1
    fi
    
    # Read JWT_SECRET from .env.supabase if set
    if grep -q "JWT_SECRET=" .env.supabase; then
        JWT_SECRET=$(grep "JWT_SECRET=" .env.supabase | cut -d'=' -f2 | tr -d '"')
        if [[ "$JWT_SECRET" != "[GENERATE-A-SECURE-32-CHARACTER-STRING]" ]]; then
            supabase secrets set JWT_SECRET="$JWT_SECRET"
            print_success "JWT_SECRET set"
        else
            print_warning "Please set a real JWT_SECRET in .env.supabase"
        fi
    fi
    
    print_success "Environment secrets configured"
}

# Deploy to Vercel
deploy_vercel() {
    print_status "Deploying frontend to Vercel..."
    
    # Deploy to production
    vercel --prod --yes
    
    print_success "Frontend deployed to Vercel"
}

# Test deployment
test_deployment() {
    print_status "Testing deployment..."
    
    # Test health endpoint
    print_status "Testing health endpoint..."
    if curl -f "https://iqkwlsrjgwvcbemvdqak.supabase.co/functions/v1/health" &> /dev/null; then
        print_success "Health endpoint is working"
    else
        print_warning "Health endpoint test failed - may need a few minutes to be ready"
    fi
    
    # Test API endpoint
    print_status "Testing API endpoint..."
    if curl -f "https://iqkwlsrjgwvcbemvdqak.supabase.co/functions/v1/api/onboarding/prerequisites" &> /dev/null; then
        print_success "API endpoint is working"
    else
        print_warning "API endpoint test failed - may need a few minutes to be ready"
    fi
    
    print_success "Deployment tests completed"
}

# Display final URLs
show_urls() {
    print_success "🎉 Deployment completed!"
    echo ""
    echo "Your CardStore application is now live at:"
    echo ""
    echo "📱 Frontend:  https://cardstore.vercel.app"
    echo "🔧 API:       https://iqkwlsrjgwvcbemvdqak.supabase.co/functions/v1"
    echo "💾 Database:  https://supabase.com/dashboard/project/iqkwlsrjgwvcbemvdqak"
    echo "📊 Logs:      https://supabase.com/dashboard/project/iqkwlsrjgwvcbemvdqak/logs"
    echo ""
    echo "Test your deployment:"
    echo "curl https://iqkwlsrjgwvcbemvdqak.supabase.co/functions/v1/health"
    echo ""
}

# Main deployment flow
main() {
    echo "Deployment started at $(date)"
    
    check_supabase_cli
    check_vercel_cli
    link_supabase_project
    deploy_database
    deploy_edge_functions
    set_secrets
    deploy_vercel
    test_deployment
    show_urls
    
    print_success "🎉 CardStore deployment completed successfully!"
    echo "============================================"
    echo "Deployment completed at $(date)"
}

# Run main function
main "$@"