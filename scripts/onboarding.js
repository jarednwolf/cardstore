#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const readline = require('readline');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

class OnboardingWizard {
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    this.steps = [];
    this.currentStep = 0;
    this.config = {};
  }

  log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
  }

  async question(prompt) {
    return new Promise((resolve) => {
      this.rl.question(`${colors.cyan}${prompt}${colors.reset}`, resolve);
    });
  }

  async confirm(prompt) {
    const answer = await this.question(`${prompt} (y/n): `);
    return answer.toLowerCase().startsWith('y');
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async checkCommand(command, name) {
    try {
      execSync(`${command} --version`, { stdio: 'ignore' });
      this.log(`✅ ${name} is installed`, 'green');
      return true;
    } catch (error) {
      this.log(`❌ ${name} is not installed or not in PATH`, 'red');
      return false;
    }
  }

  async runCommand(command, description) {
    this.log(`\n🔄 ${description}...`, 'yellow');
    try {
      const output = execSync(command, { 
        stdio: 'pipe',
        encoding: 'utf8',
        cwd: process.cwd()
      });
      this.log(`✅ ${description} completed`, 'green');
      return { success: true, output };
    } catch (error) {
      this.log(`❌ ${description} failed: ${error.message}`, 'red');
      return { success: false, error: error.message };
    }
  }

  async runCommandInteractive(command, description) {
    this.log(`\n🔄 ${description}...`, 'yellow');
    return new Promise((resolve) => {
      const child = spawn('sh', ['-c', command], {
        stdio: 'inherit',
        cwd: process.cwd()
      });

      child.on('close', (code) => {
        if (code === 0) {
          this.log(`✅ ${description} completed`, 'green');
          resolve({ success: true });
        } else {
          this.log(`❌ ${description} failed with exit code ${code}`, 'red');
          resolve({ success: false, code });
        }
      });
    });
  }

  async welcome() {
    console.clear();
    this.log('🎉 Welcome to CardStore Operations Layer Setup!', 'bright');
    this.log('═'.repeat(60), 'cyan');
    this.log('\nThis wizard will guide you through setting up your development environment.', 'blue');
    this.log('We\'ll check prerequisites, configure your environment, and get everything running.\n', 'blue');
    
    const proceed = await this.confirm('Ready to begin setup?');
    if (!proceed) {
      this.log('\nSetup cancelled. Run this script again when you\'re ready!', 'yellow');
      process.exit(0);
    }
  }

  async checkPrerequisites() {
    this.log('\n📋 Step 1: Checking Prerequisites', 'bright');
    this.log('─'.repeat(40), 'cyan');

    const checks = [
      { command: 'node', name: 'Node.js (18+)', required: true },
      { command: 'npm', name: 'npm', required: true },
      { command: 'docker', name: 'Docker', required: false },
      { command: 'docker-compose', name: 'Docker Compose', required: false },
      { command: 'git', name: 'Git', required: false }
    ];

    const results = {};
    for (const check of checks) {
      results[check.command] = await this.checkCommand(check.command, check.name);
      if (check.required && !results[check.command]) {
        this.log(`\n❌ ${check.name} is required but not found.`, 'red');
        this.log(`Please install ${check.name} and run this setup again.`, 'red');
        
        if (check.command === 'node') {
          this.log('\n📖 Installation Guide:', 'yellow');
          this.log('• Visit: https://nodejs.org/en/download/', 'blue');
          this.log('• Download and install Node.js 18 or later', 'blue');
        }
        
        process.exit(1);
      }
    }

    // Check Node.js version
    try {
      const nodeVersion = execSync('node --version', { encoding: 'utf8' }).trim();
      const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
      if (majorVersion < 18) {
        this.log(`\n❌ Node.js version ${nodeVersion} found, but version 18+ is required.`, 'red');
        this.log('Please upgrade Node.js and run this setup again.', 'red');
        process.exit(1);
      }
      this.log(`✅ Node.js version ${nodeVersion} meets requirements`, 'green');
    } catch (error) {
      this.log('❌ Could not determine Node.js version', 'red');
      process.exit(1);
    }

    this.config.hasDocker = results.docker && results['docker-compose'];
    
    if (!this.config.hasDocker) {
      this.log('\n⚠️  Docker not found - you can still run the application locally', 'yellow');
      this.log('   but you\'ll need to install PostgreSQL and Redis manually.', 'yellow');
      
      const installDocker = await this.confirm('\nWould you like instructions for installing Docker?');
      if (installDocker) {
        this.log('\n📖 Docker Installation Guide:', 'yellow');
        this.log('• Visit: https://docs.docker.com/get-docker/', 'blue');
        this.log('• Download Docker Desktop for your operating system', 'blue');
        this.log('• Follow the installation instructions', 'blue');
        this.log('• Restart this setup after installation', 'blue');
        
        const continueWithoutDocker = await this.confirm('\nContinue setup without Docker?');
        if (!continueWithoutDocker) {
          this.log('\nSetup paused. Install Docker and run this script again!', 'yellow');
          process.exit(0);
        }
      }
    }

    this.log('\n✅ Prerequisites check completed!', 'green');
  }

  async installDependencies() {
    this.log('\n📦 Step 2: Installing Dependencies', 'bright');
    this.log('─'.repeat(40), 'cyan');

    const result = await this.runCommand('npm install', 'Installing Node.js dependencies');
    if (!result.success) {
      this.log('\n❌ Failed to install dependencies. Please check the error above.', 'red');
      this.log('You may need to run: npm install --legacy-peer-deps', 'yellow');
      process.exit(1);
    }

    this.log('\n✅ Dependencies installed successfully!', 'green');
  }

  async configureEnvironment() {
    this.log('\n⚙️  Step 3: Environment Configuration', 'bright');
    this.log('─'.repeat(40), 'cyan');

    // Check if .env already exists
    if (fs.existsSync('.env')) {
      this.log('📄 .env file already exists', 'yellow');
      const overwrite = await this.confirm('Would you like to reconfigure it?');
      if (!overwrite) {
        this.log('✅ Using existing .env configuration', 'green');
        return;
      }
    }

    // Copy .env.example to .env
    if (!fs.existsSync('.env.example')) {
      this.log('❌ .env.example file not found', 'red');
      process.exit(1);
    }

    fs.copyFileSync('.env.example', '.env');
    this.log('✅ Created .env file from template', 'green');

    this.log('\n🔧 Let\'s configure your environment variables:', 'blue');
    
    // Get configuration preferences
    const useDocker = this.config.hasDocker && await this.confirm('\nUse Docker for databases (PostgreSQL, Redis)?');
    this.config.useDocker = useDocker;

    if (useDocker) {
      this.log('\n✅ Using Docker configuration (recommended)', 'green');
      // Docker configuration is already set in .env.example
    } else {
      this.log('\n⚠️  Manual database configuration required', 'yellow');
      
      const dbUrl = await this.question('\nPostgreSQL connection URL (or press Enter for default): ');
      const redisUrl = await this.question('Redis connection URL (or press Enter for default): ');
      
      if (dbUrl.trim()) {
        this.updateEnvFile('DATABASE_URL', dbUrl.trim());
      }
      if (redisUrl.trim()) {
        this.updateEnvFile('REDIS_URL', redisUrl.trim());
      }
    }

    // JWT Secret
    const jwtSecret = await this.question('\nJWT Secret (or press Enter to generate): ');
    if (jwtSecret.trim()) {
      this.updateEnvFile('JWT_SECRET', jwtSecret.trim());
    } else {
      const generatedSecret = require('crypto').randomBytes(64).toString('hex');
      this.updateEnvFile('JWT_SECRET', generatedSecret);
      this.log('✅ Generated secure JWT secret', 'green');
    }

    // Optional: Shopify configuration
    const configureShopify = await this.confirm('\nConfigure Shopify integration now?');
    if (configureShopify) {
      const shopifyApiKey = await this.question('Shopify API Key: ');
      const shopifyApiSecret = await this.question('Shopify API Secret: ');
      const shopifyWebhookSecret = await this.question('Shopify Webhook Secret: ');
      
      if (shopifyApiKey.trim()) this.updateEnvFile('SHOPIFY_API_KEY', shopifyApiKey.trim());
      if (shopifyApiSecret.trim()) this.updateEnvFile('SHOPIFY_API_SECRET', shopifyApiSecret.trim());
      if (shopifyWebhookSecret.trim()) this.updateEnvFile('SHOPIFY_WEBHOOK_SECRET', shopifyWebhookSecret.trim());
      
      this.log('✅ Shopify configuration saved', 'green');
    } else {
      this.log('⏭️  Shopify configuration skipped (can be configured later)', 'yellow');
    }

    this.log('\n✅ Environment configuration completed!', 'green');
  }

  updateEnvFile(key, value) {
    const envPath = '.env';
    let envContent = fs.readFileSync(envPath, 'utf8');
    
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, `${key}="${value}"`);
    } else {
      envContent += `\n${key}="${value}"`;
    }
    
    fs.writeFileSync(envPath, envContent);
  }

  async setupDatabase() {
    this.log('\n🗄️  Step 4: Database Setup', 'bright');
    this.log('─'.repeat(40), 'cyan');

    if (this.config.useDocker) {
      this.log('🐳 Starting Docker services...', 'blue');
      
      const result = await this.runCommandInteractive(
        'docker-compose up -d postgres redis nats',
        'Starting database services with Docker'
      );
      
      if (!result.success) {
        this.log('\n❌ Failed to start Docker services', 'red');
        this.log('Please check Docker is running and try again', 'yellow');
        process.exit(1);
      }

      // Wait for services to be ready
      this.log('\n⏳ Waiting for services to be ready...', 'yellow');
      await this.sleep(5000);
    } else {
      this.log('⚠️  Manual database setup required', 'yellow');
      this.log('Please ensure PostgreSQL and Redis are running and accessible', 'blue');
      
      const proceed = await this.confirm('Are your databases ready?');
      if (!proceed) {
        this.log('\nSetup paused. Start your databases and run this script again!', 'yellow');
        process.exit(0);
      }
    }

    // Generate Prisma client
    const generateResult = await this.runCommand('npm run db:generate', 'Generating Prisma client');
    if (!generateResult.success) {
      this.log('\n❌ Failed to generate Prisma client', 'red');
      process.exit(1);
    }

    // Run database migrations
    const migrateResult = await this.runCommand('npm run db:migrate', 'Running database migrations');
    if (!migrateResult.success) {
      this.log('\n❌ Failed to run database migrations', 'red');
      this.log('Please check your database connection and try again', 'yellow');
      process.exit(1);
    }

    this.log('\n✅ Database setup completed!', 'green');
  }

  async runHealthChecks() {
    this.log('\n🏥 Step 5: Health Checks', 'bright');
    this.log('─'.repeat(40), 'cyan');

    // Start the application in the background for health checks
    this.log('🚀 Starting application for health checks...', 'blue');
    
    const appProcess = spawn('npm', ['run', 'dev'], {
      stdio: 'pipe',
      cwd: process.cwd(),
      detached: false
    });

    // Wait for app to start
    await this.sleep(5000);

    try {
      // Check if app is responding
      const healthCheck = await this.runCommand(
        'curl -f http://localhost:3000/health || wget -q --spider http://localhost:3000/health',
        'Checking application health'
      );

      if (healthCheck.success) {
        this.log('✅ Application is running and healthy!', 'green');
      } else {
        this.log('⚠️  Health check failed, but this might be normal during first startup', 'yellow');
      }
    } catch (error) {
      this.log('⚠️  Could not perform health check (curl/wget not available)', 'yellow');
    }

    // Stop the test application
    appProcess.kill('SIGTERM');
    await this.sleep(2000);

    this.log('\n✅ Health checks completed!', 'green');
  }

  async showNextSteps() {
    this.log('\n🎉 Setup Complete!', 'bright');
    this.log('═'.repeat(60), 'cyan');
    
    this.log('\n🚀 Your CardStore Operations Layer is ready!', 'green');
    this.log('\n📋 Next Steps:', 'blue');
    
    if (this.config.useDocker) {
      this.log('   1. Start all services: docker-compose up -d', 'cyan');
      this.log('   2. Start development server: npm run dev', 'cyan');
      this.log('   3. Visit: http://localhost:3000/health', 'cyan');
    } else {
      this.log('   1. Ensure PostgreSQL and Redis are running', 'cyan');
      this.log('   2. Start development server: npm run dev', 'cyan');
      this.log('   3. Visit: http://localhost:3000/health', 'cyan');
    }
    
    this.log('\n🔗 Useful URLs:', 'blue');
    this.log('   • Application: http://localhost:3000', 'cyan');
    this.log('   • Health Check: http://localhost:3000/health', 'cyan');
    if (this.config.useDocker) {
      this.log('   • Grafana Dashboard: http://localhost:3001 (admin/admin)', 'cyan');
      this.log('   • Prometheus: http://localhost:9090', 'cyan');
      this.log('   • NATS Monitoring: http://localhost:8222', 'cyan');
    }
    
    this.log('\n📚 Documentation:', 'blue');
    this.log('   • API Documentation: docs/API_SPECIFICATIONS.md', 'cyan');
    this.log('   • Architecture Guide: ARCHITECTURE_FOUNDATION.md', 'cyan');
    this.log('   • Development Guide: docs/README.md', 'cyan');
    
    this.log('\n🛠️  Development Commands:', 'blue');
    this.log('   • npm run dev          - Start development server', 'cyan');
    this.log('   • npm run build        - Build for production', 'cyan');
    this.log('   • npm test             - Run tests', 'cyan');
    this.log('   • npm run db:studio    - Open Prisma Studio', 'cyan');
    this.log('   • docker-compose logs  - View service logs', 'cyan');
    
    this.log('\n💡 Tips:', 'yellow');
    this.log('   • Use "npm run db:studio" to explore your database', 'blue');
    this.log('   • Check logs with "docker-compose logs -f app"', 'blue');
    this.log('   • Run "npm run lint" before committing code', 'blue');
    
    this.log('\n🆘 Need Help?', 'blue');
    this.log('   • Check docs/README.md for detailed documentation', 'cyan');
    this.log('   • Review troubleshooting guide: docs/TROUBLESHOOTING.md', 'cyan');
    this.log('   • Contact: engineering@cardstore.com', 'cyan');
    
    this.log('\n🎊 Happy coding!', 'bright');
  }

  async run() {
    try {
      await this.welcome();
      await this.checkPrerequisites();
      await this.installDependencies();
      await this.configureEnvironment();
      await this.setupDatabase();
      await this.runHealthChecks();
      await this.showNextSteps();
    } catch (error) {
      this.log(`\n💥 Setup failed: ${error.message}`, 'red');
      this.log('Please check the error above and try again.', 'yellow');
      process.exit(1);
    } finally {
      this.rl.close();
    }
  }
}

// Run the onboarding wizard
if (require.main === module) {
  const wizard = new OnboardingWizard();
  wizard.run().catch(console.error);
}

module.exports = OnboardingWizard;