#!/bin/bash

# Production Database Migration Script
# Safely handles database migrations in production environment

set -e

echo "🗄️ CardStore Operations Layer - Production Database Migration"
echo "============================================================="

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

# Check if DATABASE_URL is set
check_database_url() {
    if [[ -z "$DATABASE_URL" ]]; then
        print_error "DATABASE_URL environment variable is not set"
        exit 1
    fi
    print_success "DATABASE_URL is configured"
}

# Test database connectivity
test_connectivity() {
    print_status "Testing database connectivity..."
    
    if npx prisma db execute --stdin <<< "SELECT 1;" &> /dev/null; then
        print_success "Database connection successful"
    else
        print_error "Cannot connect to database"
        exit 1
    fi
}

# Create backup before migration
create_backup() {
    print_status "Creating database backup..."
    
    timestamp=$(date +"%Y%m%d_%H%M%S")
    backup_file="backup_${timestamp}.sql"
    
    # Extract database details from DATABASE_URL
    if [[ $DATABASE_URL =~ postgresql://([^:]+):([^@]+)@([^:]+):([0-9]+)/([^?]+) ]]; then
        username="${BASH_REMATCH[1]}"
        password="${BASH_REMATCH[2]}"
        host="${BASH_REMATCH[3]}"
        port="${BASH_REMATCH[4]}"
        database="${BASH_REMATCH[5]}"
        
        export PGPASSWORD="$password"
        
        if pg_dump -h "$host" -p "$port" -U "$username" -d "$database" > "$backup_file"; then
            print_success "Backup created: $backup_file"
            echo "Backup file: $(pwd)/$backup_file"
        else
            print_error "Failed to create backup"
            exit 1
        fi
    else
        print_warning "Could not parse DATABASE_URL for backup. Proceeding without backup."
    fi
}

# Check migration status
check_migration_status() {
    print_status "Checking current migration status..."
    
    npx prisma migrate status
}

# Run migrations
run_migrations() {
    print_status "Running database migrations..."
    
    # Deploy migrations
    npx prisma migrate deploy
    
    print_success "Migrations completed successfully"
}

# Generate Prisma client
generate_client() {
    print_status "Generating Prisma client..."
    
    npx prisma generate
    
    print_success "Prisma client generated successfully"
}

# Verify migration
verify_migration() {
    print_status "Verifying migration..."
    
    # Run a simple query to verify database is working
    if npx prisma db execute --stdin <<< "SELECT COUNT(*) FROM _prisma_migrations;" &> /dev/null; then
        print_success "Migration verification successful"
    else
        print_error "Migration verification failed"
        exit 1
    fi
}

# Main migration process
main() {
    echo "Migration started at $(date)"
    
    check_database_url
    test_connectivity
    
    # Ask for confirmation in production
    if [[ "$NODE_ENV" == "production" ]]; then
        print_warning "You are about to run migrations in PRODUCTION environment"
        read -p "Are you sure you want to continue? (yes/no): " confirm
        
        if [[ $confirm != "yes" ]]; then
            print_status "Migration cancelled by user"
            exit 0
        fi
        
        create_backup
    fi
    
    check_migration_status
    run_migrations
    generate_client
    verify_migration
    
    print_success "🎉 Database migration completed successfully!"
    echo "============================================================="
    echo "Migration completed at $(date)"
}

# Run main function
main "$@"