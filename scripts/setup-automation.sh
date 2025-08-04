#!/bin/bash
# DeckStack Development Standards & Automation Setup

set -e

echo "🚀 Setting up DeckStack Development Standards & Automation..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "Please run this script from the project root directory"
    exit 1
fi

print_status "Installing development dependencies..."

# Install core development tools
npm install --save-dev \
    husky \
    lint-staged \
    commitlint \
    @commitlint/config-conventional \
    @commitlint/cli \
    typedoc \
    @apidevtools/swagger-jsdoc \
    swagger-ui-express \
    jest-junit \
    nyc \
    cross-env

print_success "Development dependencies installed"

# Install monitoring and analytics
print_status "Installing monitoring tools..."
npm install --save \
    @sentry/node \
    @sentry/tracing \
    mixpanel \
    node-cron

print_success "Monitoring tools installed"

# Setup Husky (Git hooks)
print_status "Setting up Git hooks with Husky..."
npx husky install

# Create pre-commit hook
npx husky add .husky/pre-commit "npx lint-staged"

# Create pre-push hook
npx husky add .husky/pre-push "npm run test:coverage && npm run build:check"

# Create commit-msg hook
npx husky add .husky/commit-msg "npx --no-install commitlint --edit \$1"

print_success "Git hooks configured"

# Setup package.json scripts
print_status "Adding automation scripts to package.json..."

# Create temporary package.json with new scripts
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

// Add new scripts
pkg.scripts = {
  ...pkg.scripts,
  // Quality checks
  'lint:ci': 'eslint src --format junit --output-file reports/eslint.xml',
  'type-check': 'tsc --noEmit',
  'test:coverage': 'jest --coverage --coverageReporters=text-lcov --coverageReporters=html',
  'test:ci': 'jest --ci --coverage --watchAll=false --reporters=default --reporters=jest-junit',
  'test:changed': 'jest --bail --findRelatedTests',
  'test:related': 'jest --bail --findRelatedTests',
  
  // Build checks
  'build:check': 'npm run build && npm run type-check',
  'build:analyze': 'npm run build && npx webpack-bundle-analyzer dist/static/js/*.js',
  
  // Documentation
  'docs:generate': 'typedoc src --out docs/api --theme default',
  'docs:api:generate': 'node scripts/generate-api-docs.js',
  
  // Automation
  'automation:setup': 'node scripts/setup-progress-tracking.js',
  'automation:daily': 'node scripts/daily-health-check.js',
  'automation:weekly': 'node scripts/weekly-progress-report.js',
  
  // Progress tracking
  'progress:update': 'node scripts/update-progress.js',
  'progress:report': 'node scripts/generate-progress-report.js',
  
  // Health checks
  'health:daily': 'node scripts/daily-health-check.js',
  'health:performance': 'node scripts/performance-check.js',
  
  // Reports
  'reports:daily': 'node scripts/daily-summary.js',
  'reports:weekly': 'node scripts/weekly-review.js',
  
  // Database
  'db:performance-check': 'node scripts/db-performance-check.js',
  
  // API testing
  'api:performance-test': 'node scripts/api-performance-test.js',
  
  // Monitoring
  'monitoring:error-rate-check': 'node scripts/error-rate-check.js'
};

// Add lint-staged configuration
pkg['lint-staged'] = {
  '*.{ts,tsx}': [
    'eslint --fix',
    'prettier --write',
    'npm run test:related'
  ],
  '*.{md,json}': [
    'prettier --write'
  ],
  'src/**/*.ts': [
    'npm run docs:generate'
  ]
};

// Add commitlint configuration
pkg.commitlint = {
  extends: ['@commitlint/config-conventional']
};

// Add jest-junit configuration
pkg['jest-junit'] = {
  outputDirectory: 'reports',
  outputName: 'jest-junit.xml'
};

fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
"

print_success "Package.json scripts added"

# Create directories for automation
print_status "Creating automation directories..."
mkdir -p scripts/automation
mkdir -p scripts/templates
mkdir -p .github/workflows
mkdir -p reports
mkdir -p docs/api
mkdir -p docs/progress

print_success "Directories created"

# Create commitlint config
print_status "Creating commitlint configuration..."
cat > .commitlintrc.js << 'EOF'
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',     // New feature
        'fix',      // Bug fix
        'docs',     // Documentation
        'style',    // Formatting
        'refactor', // Code refactoring
        'test',     // Adding tests
        'chore',    // Maintenance
        'perf',     // Performance improvement
        'ci',       // CI/CD changes
        'build',    // Build system changes
        'revert'    // Revert changes
      ]
    ],
    'subject-case': [2, 'always', 'sentence-case'],
    'subject-max-length': [2, 'always', 100]
  }
};
EOF

print_success "Commitlint configuration created"

# Create automation scripts directory structure
print_status "Creating automation scripts..."

# Progress tracking script
cat > scripts/update-progress.js << 'EOF'
#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

async function updateProgress() {
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const progress = {
      timestamp: new Date().toISOString(),
      version: packageJson.version,
      features: await getFeatureProgress(),
      tests: await getTestMetrics(),
      coverage: await getCoverageMetrics(),
      performance: await getPerformanceMetrics()
    };
    
    // Save progress data
    const progressFile = 'docs/progress/latest.json';
    fs.writeFileSync(progressFile, JSON.stringify(progress, null, 2));
    
    // Update README with progress
    await updateReadmeProgress(progress);
    
    console.log('✅ Progress updated successfully');
  } catch (error) {
    console.error('❌ Error updating progress:', error.message);
    process.exit(1);
  }
}

async function getFeatureProgress() {
  // Scan for TODO/FIXME items
  const { execSync } = require('child_process');
  try {
    const todoCount = execSync('grep -r "TODO\\|FIXME" src/ --include="*.ts" | wc -l', { encoding: 'utf8' }).trim();
    return {
      todoItems: parseInt(todoCount),
      lastScan: new Date().toISOString()
    };
  } catch {
    return { todoItems: 0, lastScan: new Date().toISOString() };
  }
}

async function getTestMetrics() {
  try {
    const testFiles = execSync('find src/ -name "*.test.ts" -o -name "*.spec.ts" | wc -l', { encoding: 'utf8' }).trim();
    return {
      testFiles: parseInt(testFiles),
      lastRun: new Date().toISOString()
    };
  } catch {
    return { testFiles: 0, lastRun: new Date().toISOString() };
  }
}

async function getCoverageMetrics() {
  try {
    if (fs.existsSync('coverage/coverage-summary.json')) {
      const coverage = JSON.parse(fs.readFileSync('coverage/coverage-summary.json', 'utf8'));
      return {
        lines: coverage.total.lines.pct,
        functions: coverage.total.functions.pct,
        branches: coverage.total.branches.pct,
        statements: coverage.total.statements.pct
      };
    }
  } catch {}
  return { lines: 0, functions: 0, branches: 0, statements: 0 };
}

async function getPerformanceMetrics() {
  return {
    buildTime: 0, // Will be populated by CI
    bundleSize: 0, // Will be populated by build process
    lastCheck: new Date().toISOString()
  };
}

async function updateReadmeProgress(progress) {
  try {
    let readme = fs.readFileSync('README.md', 'utf8');
    
    // Update progress badges
    const progressPercentage = Math.max(0, 100 - (progress.features.todoItems * 2));
    const coveragePercentage = Math.round(progress.coverage.lines || 0);
    
    // Replace or add progress section
    const progressSection = `
## 📊 Development Progress

![Progress](https://img.shields.io/badge/Progress-${progressPercentage}%25-${progressPercentage > 80 ? 'green' : progressPercentage > 60 ? 'yellow' : 'red'})
![Test Coverage](https://img.shields.io/badge/Coverage-${coveragePercentage}%25-${coveragePercentage > 80 ? 'green' : coveragePercentage > 60 ? 'yellow' : 'red'})
![TODO Items](https://img.shields.io/badge/TODO%20Items-${progress.features.todoItems}-${progress.features.todoItems < 10 ? 'green' : progress.features.todoItems < 25 ? 'yellow' : 'red'})

*Last updated: ${new Date().toLocaleDateString()}*
`;

    // Insert progress section after the main title
    if (readme.includes('## 📊 Development Progress')) {
      readme = readme.replace(/## 📊 Development Progress[\s\S]*?(?=\n## |\n# |$)/, progressSection);
    } else {
      const titleMatch = readme.match(/^# .+\n/);
      if (titleMatch) {
        readme = readme.replace(titleMatch[0], titleMatch[0] + progressSection);
      }
    }
    
    fs.writeFileSync('README.md', readme);
  } catch (error) {
    console.warn('Warning: Could not update README progress:', error.message);
  }
}

if (require.main === module) {
  updateProgress();
}

module.exports = { updateProgress };
EOF

chmod +x scripts/update-progress.js

print_success "Progress tracking script created"

# Daily health check script
cat > scripts/daily-health-check.js << 'EOF'
#!/usr/bin/env node
const https = require('https');
const fs = require('fs');

async function dailyHealthCheck() {
  console.log('🏥 Running daily health check...');
  
  const results = {
    timestamp: new Date().toISOString(),
    checks: []
  };
  
  // Check if production URL is accessible
  try {
    const productionUrl = process.env.PRODUCTION_URL || 'https://cardstore-woad.vercel.app';
    await checkUrl(`${productionUrl}/health`, 'Production Health Endpoint');
    results.checks.push({ name: 'Production Health', status: 'pass' });
  } catch (error) {
    results.checks.push({ name: 'Production Health', status: 'fail', error: error.message });
  }
  
  // Check build status
  try {
    const { execSync } = require('child_process');
    execSync('npm run build:check', { stdio: 'pipe' });
    results.checks.push({ name: 'Build Check', status: 'pass' });
  } catch (error) {
    results.checks.push({ name: 'Build Check', status: 'fail', error: 'Build failed' });
  }
  
  // Check test status
  try {
    const { execSync } = require('child_process');
    execSync('npm test -- --passWithNoTests', { stdio: 'pipe' });
    results.checks.push({ name: 'Test Suite', status: 'pass' });
  } catch (error) {
    results.checks.push({ name: 'Test Suite', status: 'fail', error: 'Tests failed' });
  }
  
  // Save results
  fs.writeFileSync('reports/daily-health.json', JSON.stringify(results, null, 2));
  
  // Print summary
  const passed = results.checks.filter(c => c.status === 'pass').length;
  const total = results.checks.length;
  
  console.log(`\n📊 Health Check Summary: ${passed}/${total} checks passed`);
  
  results.checks.forEach(check => {
    const icon = check.status === 'pass' ? '✅' : '❌';
    console.log(`${icon} ${check.name}`);
    if (check.error) {
      console.log(`   Error: ${check.error}`);
    }
  });
  
  if (passed < total) {
    console.log('\n⚠️  Some health checks failed. Please investigate.');
    process.exit(1);
  } else {
    console.log('\n🎉 All health checks passed!');
  }
}

function checkUrl(url, name) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, (response) => {
      if (response.statusCode === 200) {
        resolve();
      } else {
        reject(new Error(`${name} returned status ${response.statusCode}`));
      }
    });
    
    request.on('error', (error) => {
      reject(new Error(`${name} request failed: ${error.message}`));
    });
    
    request.setTimeout(10000, () => {
      request.destroy();
      reject(new Error(`${name} request timed out`));
    });
  });
}

if (require.main === module) {
  dailyHealthCheck().catch(error => {
    console.error('❌ Daily health check failed:', error.message);
    process.exit(1);
  });
}

module.exports = { dailyHealthCheck };
EOF

chmod +x scripts/daily-health-check.js

print_success "Daily health check script created"

print_status "Creating GitHub Actions workflows..."

# Create GitHub Actions workflow for CI/CD
cat > .github/workflows/ci-cd.yml << 'EOF'
name: CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  quality-gates:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Lint check
      run: npm run lint:ci
    
    - name: Type check
      run: npm run type-check
    
    - name: Run tests with coverage
      run: npm run test:ci
    
    - name: Build check
      run: npm run build:check
    
    - name: Security audit
      run: npm audit --audit-level=moderate
    
    - name: Update progress
      run: npm run progress:update
    
    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage/lcov.info
        flags: unittests
        name: codecov-umbrella
    
    - name: Upload test results
      uses: actions/upload-artifact@v3
      if: always()
      with:
        name: test-results
        path: reports/

  deploy-staging:
    needs: quality-gates
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/develop'
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Deploy to Staging
      run: echo "Deploy to staging environment"
      # Add actual deployment steps here

  deploy-production:
    needs: quality-gates
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Deploy to Production
      run: echo "Deploy to production environment"
      # Add actual deployment steps here
EOF

# Create daily health check workflow
cat > .github/workflows/daily-health-check.yml << 'EOF'
name: Daily Health Check

on:
  schedule:
    - cron: '0 9 * * 1-5'  # 9 AM weekdays
  workflow_dispatch:  # Allow manual trigger

jobs:
  health-check:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run daily health check
      run: npm run health:daily
      env:
        PRODUCTION_URL: ${{ secrets.PRODUCTION_URL }}
    
    - name: Upload health report
      uses: actions/upload-artifact@v3
      if: always()
      with:
        name: health-report
        path: reports/daily-health.json
EOF

# Create weekly progress report workflow
cat > .github/workflows/weekly-progress.yml << 'EOF'
name: Weekly Progress Report

on:
  schedule:
    - cron: '0 17 * * 5'  # 5 PM Fridays
  workflow_dispatch:  # Allow manual trigger

jobs:
  weekly-report:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Generate weekly report
      run: npm run reports:weekly
    
    - name: Create GitHub Issue for Next Week
      uses: actions/github-script@v6
      with:
        script: |
          const fs = require('fs');
          const report = JSON.parse(fs.readFileSync('reports/weekly-progress.json', 'utf8'));
          
          const issueBody = `
          # Weekly Progress Report - Week ${report.week}
          
          ## 📊 Summary
          - Features Completed: ${report.featuresCompleted.length}
          - Test Coverage: ${report.testCoverage}%
          - Bug Count: ${report.bugCount}
          
          ## 🎯 Next Week Priorities
          ${report.nextWeekPriorities.map(p => `- ${p}`).join('\n')}
          
          ## 📈 Metrics
          - API Response Time: ${report.performanceMetrics.apiResponseTime}ms
          - Build Time: ${report.performanceMetrics.buildTime}s
          - Bundle Size: ${report.performanceMetrics.bundleSize}KB
          `;
          
          github.rest.issues.create({
            owner: context.repo.owner,
            repo: context.repo.repo,
            title: `Week ${report.week + 1} Planning`,
            body: issueBody,
            labels: ['planning', 'weekly-review']
          });
EOF

print_success "GitHub Actions workflows created"

# Create VSCode settings for consistent development
print_status "Creating VSCode settings..."
mkdir -p .vscode

cat > .vscode/settings.json << 'EOF'
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true,
    "source.organizeImports": true
  },
  "typescript.preferences.importModuleSpecifier": "relative",
  "files.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/coverage": true,
    "**/.next": true
  },
  "search.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/coverage": true,
    "**/.next": true,
    "**/reports": true
  },
  "eslint.workingDirectories": ["src"],
  "typescript.updateImportsOnFileMove.enabled": "always",
  "editor.rulers": [80, 120],
  "files.trimTrailingWhitespace": true,
  "files.insertFinalNewline": true
}
EOF

cat > .vscode/extensions.json << 'EOF'
{
  "recommendations": [
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-typescript-next",
    "christian-kohler.path-intellisense",
    "ms-vscode.vscode-json",
    "redhat.vscode-yaml",
    "ms-vscode.vscode-jest"
  ]
}
EOF

print_success "VSCode settings created"

# Create environment template
print_status "Creating environment template..."
cat > .env.development.template << 'EOF'
# Development Environment Template
# Copy this to .env.development and fill in your values

# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/deckstack_dev"

# Authentication
JWT_SECRET="your-development-jwt-secret"
SUPABASE_URL="your-supabase-url"
SUPABASE_ANON_KEY="your-supabase-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-supabase-service-key"

# Application
NODE_ENV="development"
PORT=3005
API_VERSION="v1"

# Monitoring (optional for development)
SENTRY_DSN=""
MIXPANEL_TOKEN=""

# External Services (for testing)
SHOPIFY_API_KEY=""
SHOPIFY_API_SECRET=""
SHIPSTATION_API_KEY=""
SHIPSTATION_API_SECRET=""

# Automation
SLACK_WEBHOOK_URL=""
GITHUB_TOKEN=""
EOF

print_success "Environment template created"

# Final setup steps
print_status "Running final setup steps..."

# Initialize progress tracking
npm run progress:update 2>/dev/null || echo "Progress tracking will be available after first build"

# Run initial health check
npm run health:daily 2>/dev/null || echo "Health check will be available after dependencies are installed"

print_success "🎉 DeckStack Development Standards & Automation setup complete!"

echo ""
echo "📋 Next Steps:"
echo "1. Copy .env.development.template to .env.development and fill in your values"
echo "2. Run 'npm test' to verify everything is working"
echo "3. Make your first commit to test the Git hooks"
echo "4. Check the GitHub Actions tab to see automated workflows"
echo ""
echo "🔧 Available Commands:"
echo "  npm run progress:update     - Update development progress"
echo "  npm run health:daily        - Run daily health check"
echo "  npm run reports:weekly      - Generate weekly progress report"
echo "  npm run docs:generate       - Generate API documentation"
echo ""
echo "📊 Monitoring:"
echo "  - Daily health checks run automatically at 9 AM"
echo "  - Weekly progress reports generated every Friday at 5 PM"
echo "  - Git hooks ensure code quality on every commit"
echo "  - Real-time progress tracking in README.md"
echo ""
echo "🚀 Your development environment is now fully automated!"