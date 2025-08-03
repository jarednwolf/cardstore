#!/usr/bin/env node

const http = require('http');
const { execSync } = require('child_process');
const fs = require('fs');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

class HealthChecker {
  constructor() {
    this.checks = [];
    this.results = [];
  }

  log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
  }

  async checkService(name, host, port, path = '/') {
    return new Promise((resolve) => {
      const options = {
        hostname: host,
        port: port,
        path: path,
        method: 'GET',
        timeout: 5000
      };

      const req = http.request(options, (res) => {
        resolve({
          name,
          status: res.statusCode >= 200 && res.statusCode < 400 ? 'healthy' : 'unhealthy',
          statusCode: res.statusCode,
          message: `HTTP ${res.statusCode}`
        });
      });

      req.on('error', (error) => {
        resolve({
          name,
          status: 'unhealthy',
          message: error.message
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          name,
          status: 'unhealthy',
          message: 'Connection timeout'
        });
      });

      req.end();
    });
  }

  async checkCommand(name, command) {
    try {
      const output = execSync(command, { 
        stdio: 'pipe', 
        encoding: 'utf8',
        timeout: 10000
      });
      return {
        name,
        status: 'healthy',
        message: 'Command executed successfully'
      };
    } catch (error) {
      return {
        name,
        status: 'unhealthy',
        message: error.message
      };
    }
  }

  async checkFile(name, filePath, required = true) {
    try {
      const exists = fs.existsSync(filePath);
      if (!exists && required) {
        return {
          name,
          status: 'unhealthy',
          message: 'Required file not found'
        };
      }
      
      if (!exists && !required) {
        return {
          name,
          status: 'warning',
          message: 'Optional file not found'
        };
      }

      const stats = fs.statSync(filePath);
      return {
        name,
        status: 'healthy',
        message: `File exists (${stats.size} bytes)`
      };
    } catch (error) {
      return {
        name,
        status: 'unhealthy',
        message: error.message
      };
    }
  }

  async checkEnvironment() {
    const envFile = '.env';
    const envExample = '.env.example';
    
    const results = [];
    
    // Check if .env exists
    results.push(await this.checkFile('.env file', envFile, true));
    
    // Check if .env.example exists
    results.push(await this.checkFile('.env.example file', envExample, true));
    
    // Check required environment variables
    if (fs.existsSync(envFile)) {
      const envContent = fs.readFileSync(envFile, 'utf8');
      const requiredVars = [
        'DATABASE_URL',
        'JWT_SECRET',
        'NODE_ENV',
        'PORT'
      ];
      
      for (const varName of requiredVars) {
        const hasVar = envContent.includes(`${varName}=`);
        results.push({
          name: `Environment variable: ${varName}`,
          status: hasVar ? 'healthy' : 'unhealthy',
          message: hasVar ? 'Variable is set' : 'Variable is missing'
        });
      }
    }
    
    return results;
  }

  async runAllChecks() {
    this.log('🏥 CardStore Operations Layer - Health Check', 'bright');
    this.log('═'.repeat(60), 'cyan');
    
    const allResults = [];
    
    // Environment checks
    this.log('\n📋 Environment Configuration', 'blue');
    this.log('─'.repeat(30), 'cyan');
    const envResults = await this.checkEnvironment();
    allResults.push(...envResults);
    this.displayResults(envResults);
    
    // Prerequisites checks
    this.log('\n🔧 Prerequisites', 'blue');
    this.log('─'.repeat(30), 'cyan');
    const prereqResults = await Promise.all([
      this.checkCommand('Node.js', 'node --version'),
      this.checkCommand('npm', 'npm --version'),
      this.checkCommand('Docker', 'docker --version'),
      this.checkCommand('Docker Compose', 'docker-compose --version')
    ]);
    allResults.push(...prereqResults);
    this.displayResults(prereqResults);
    
    // File structure checks
    this.log('\n📁 Project Structure', 'blue');
    this.log('─'.repeat(30), 'cyan');
    const fileResults = await Promise.all([
      this.checkFile('package.json', 'package.json', true),
      this.checkFile('tsconfig.json', 'tsconfig.json', true),
      this.checkFile('Prisma schema', 'prisma/schema.prisma', true),
      this.checkFile('Docker Compose', 'docker-compose.yml', false),
      this.checkFile('Dockerfile', 'Dockerfile', false)
    ]);
    allResults.push(...fileResults);
    this.displayResults(fileResults);
    
    // Service checks (if running)
    this.log('\n🌐 Services', 'blue');
    this.log('─'.repeat(30), 'cyan');
    const serviceResults = await Promise.all([
      this.checkService('Application', 'localhost', 3000, '/health'),
      this.checkService('PostgreSQL', 'localhost', 5432),
      this.checkService('Redis', 'localhost', 6379),
      this.checkService('NATS', 'localhost', 4222),
      this.checkService('Prometheus', 'localhost', 9090),
      this.checkService('Grafana', 'localhost', 3001)
    ]);
    allResults.push(...serviceResults);
    this.displayResults(serviceResults);
    
    // Summary
    this.displaySummary(allResults);
    
    return allResults;
  }

  displayResults(results) {
    for (const result of results) {
      const icon = result.status === 'healthy' ? '✅' : 
                   result.status === 'warning' ? '⚠️' : '❌';
      const color = result.status === 'healthy' ? 'green' : 
                    result.status === 'warning' ? 'yellow' : 'red';
      
      this.log(`${icon} ${result.name}: ${result.message}`, color);
    }
  }

  displaySummary(allResults) {
    this.log('\n📊 Summary', 'bright');
    this.log('═'.repeat(60), 'cyan');
    
    const healthy = allResults.filter(r => r.status === 'healthy').length;
    const warnings = allResults.filter(r => r.status === 'warning').length;
    const unhealthy = allResults.filter(r => r.status === 'unhealthy').length;
    const total = allResults.length;
    
    this.log(`\n✅ Healthy: ${healthy}/${total}`, 'green');
    if (warnings > 0) {
      this.log(`⚠️  Warnings: ${warnings}/${total}`, 'yellow');
    }
    if (unhealthy > 0) {
      this.log(`❌ Issues: ${unhealthy}/${total}`, 'red');
    }
    
    const healthPercentage = Math.round((healthy / total) * 100);
    this.log(`\n🎯 Overall Health: ${healthPercentage}%`, 
      healthPercentage >= 80 ? 'green' : healthPercentage >= 60 ? 'yellow' : 'red');
    
    if (unhealthy > 0) {
      this.log('\n🔧 Recommendations:', 'yellow');
      
      const failedServices = allResults.filter(r => 
        r.status === 'unhealthy' && r.name.includes('localhost')
      );
      
      if (failedServices.length > 0) {
        this.log('• Start services with: docker-compose up -d', 'cyan');
        this.log('• Or start application with: npm run dev', 'cyan');
      }
      
      const missingFiles = allResults.filter(r => 
        r.status === 'unhealthy' && r.message.includes('not found')
      );
      
      if (missingFiles.length > 0) {
        this.log('• Run setup script: node scripts/onboarding.js', 'cyan');
        this.log('• Check project structure and missing files', 'cyan');
      }
      
      const missingEnvVars = allResults.filter(r => 
        r.status === 'unhealthy' && r.name.includes('Environment variable')
      );
      
      if (missingEnvVars.length > 0) {
        this.log('• Configure environment: cp .env.example .env', 'cyan');
        this.log('• Edit .env file with your settings', 'cyan');
      }
    } else if (warnings === 0) {
      this.log('\n🎉 Everything looks great! Your system is ready.', 'green');
    }
    
    this.log('\n📚 For more help, check:', 'blue');
    this.log('• README.md - Quick start guide', 'cyan');
    this.log('• docs/README.md - Detailed documentation', 'cyan');
    this.log('• docs/TROUBLESHOOTING.md - Common issues', 'cyan');
  }
}

// CLI interface
if (require.main === module) {
  const checker = new HealthChecker();
  
  const args = process.argv.slice(2);
  const isQuiet = args.includes('--quiet') || args.includes('-q');
  const isJson = args.includes('--json');
  
  checker.runAllChecks().then(results => {
    if (isJson) {
      console.log(JSON.stringify(results, null, 2));
    }
    
    const unhealthy = results.filter(r => r.status === 'unhealthy').length;
    process.exit(unhealthy > 0 ? 1 : 0);
  }).catch(error => {
    console.error('Health check failed:', error.message);
    process.exit(1);
  });
}

module.exports = HealthChecker;