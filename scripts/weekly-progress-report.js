#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Weekly Progress Report Generator
 * Analyzes development progress and generates comprehensive reports
 */

async function generateWeeklyReport() {
  console.log('📊 Generating weekly progress report...');
  
  const report = {
    week: getWeekNumber(),
    timestamp: new Date().toISOString(),
    summary: await generateSummary(),
    features: await analyzeFeatureProgress(),
    codeQuality: await analyzeCodeQuality(),
    performance: await analyzePerformance(),
    testing: await analyzeTestMetrics(),
    customerFeedback: await analyzeCustomerFeedback(),
    risks: await identifyRisks(),
    recommendations: await generateRecommendations(),
    nextWeekPriorities: await generateNextWeekPriorities()
  };
  
  // Save detailed report
  const reportsDir = 'reports';
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  
  fs.writeFileSync(
    path.join(reportsDir, `weekly-progress-week-${report.week}.json`),
    JSON.stringify(report, null, 2)
  );
  
  fs.writeFileSync(
    path.join(reportsDir, 'weekly-progress.json'),
    JSON.stringify(report, null, 2)
  );
  
  // Generate markdown report
  const markdownReport = generateMarkdownReport(report);
  fs.writeFileSync(
    path.join(reportsDir, `weekly-progress-week-${report.week}.md`),
    markdownReport
  );
  
  // Print summary to console
  printReportSummary(report);
  
  // Send notifications if configured
  await sendNotifications(report);
  
  console.log(`✅ Weekly report generated for Week ${report.week}`);
  return report;
}

function getWeekNumber() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const diff = now - start;
  const oneWeek = 1000 * 60 * 60 * 24 * 7;
  return Math.ceil(diff / oneWeek);
}

async function generateSummary() {
  const gitStats = getGitStats();
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  
  return {
    version: packageJson.version,
    commits: gitStats.commits,
    linesAdded: gitStats.linesAdded,
    linesRemoved: gitStats.linesRemoved,
    filesChanged: gitStats.filesChanged,
    contributors: gitStats.contributors
  };
}

function getGitStats() {
  try {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const since = oneWeekAgo.toISOString().split('T')[0];
    
    const commits = execSync(`git rev-list --count --since="${since}" HEAD`, { encoding: 'utf8' }).trim();
    const stats = execSync(`git diff --shortstat --since="${since}"`, { encoding: 'utf8' }).trim();
    const contributors = execSync(`git shortlog --since="${since}" -sn`, { encoding: 'utf8' }).trim();
    
    // Parse stats (e.g., "5 files changed, 123 insertions(+), 45 deletions(-)")
    const statsMatch = stats.match(/(\d+) files? changed(?:, (\d+) insertions?\(\+\))?(?:, (\d+) deletions?\(-\))?/);
    
    return {
      commits: parseInt(commits) || 0,
      filesChanged: statsMatch ? parseInt(statsMatch[1]) : 0,
      linesAdded: statsMatch && statsMatch[2] ? parseInt(statsMatch[2]) : 0,
      linesRemoved: statsMatch && statsMatch[3] ? parseInt(statsMatch[3]) : 0,
      contributors: contributors.split('\n').length
    };
  } catch (error) {
    console.warn('Warning: Could not get git stats:', error.message);
    return {
      commits: 0,
      filesChanged: 0,
      linesAdded: 0,
      linesRemoved: 0,
      contributors: 0
    };
  }
}

async function analyzeFeatureProgress() {
  const features = {
    todoItems: await countTodoItems(),
    completedFeatures: await getCompletedFeatures(),
    inProgressFeatures: await getInProgressFeatures(),
    plannedFeatures: await getPlannedFeatures()
  };
  
  const totalFeatures = features.completedFeatures.length + features.inProgressFeatures.length + features.plannedFeatures.length;
  const completionRate = totalFeatures > 0 ? (features.completedFeatures.length / totalFeatures) * 100 : 0;
  
  return {
    ...features,
    totalFeatures,
    completionRate: Math.round(completionRate)
  };
}

async function countTodoItems() {
  try {
    const result = execSync('grep -r "TODO\\|FIXME" src/ --include="*.ts" | wc -l', { encoding: 'utf8' });
    return parseInt(result.trim()) || 0;
  } catch {
    return 0;
  }
}

async function getCompletedFeatures() {
  // This would integrate with your project management system
  // For now, we'll analyze git commits for feature completions
  try {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const since = oneWeekAgo.toISOString().split('T')[0];
    
    const commits = execSync(`git log --since="${since}" --grep="feat:" --oneline`, { encoding: 'utf8' });
    return commits.trim().split('\n').filter(line => line.trim()).map(line => {
      const match = line.match(/^[a-f0-9]+ (.+)$/);
      return match ? match[1] : line;
    });
  } catch {
    return [];
  }
}

async function getInProgressFeatures() {
  // Analyze current branch names and open PRs
  try {
    const branches = execSync('git branch -r --no-merged main', { encoding: 'utf8' });
    return branches.trim().split('\n')
      .filter(branch => branch.trim() && !branch.includes('HEAD'))
      .map(branch => branch.trim().replace('origin/', ''));
  } catch {
    return [];
  }
}

async function getPlannedFeatures() {
  // This would integrate with GitHub Issues or project management
  // For now, return empty array
  return [];
}

async function analyzeCodeQuality() {
  const quality = {
    eslintIssues: await getEslintIssues(),
    typeScriptErrors: await getTypeScriptErrors(),
    testCoverage: await getTestCoverage(),
    codeComplexity: await getCodeComplexity()
  };
  
  // Calculate overall quality score
  const maxScore = 100;
  let score = maxScore;
  
  // Deduct points for issues
  score -= Math.min(quality.eslintIssues * 2, 30);
  score -= Math.min(quality.typeScriptErrors * 5, 40);
  score -= Math.max(0, 80 - quality.testCoverage.lines);
  
  quality.overallScore = Math.max(0, Math.round(score));
  
  return quality;
}

async function getEslintIssues() {
  try {
    const result = execSync('npx eslint src/ --format json', { encoding: 'utf8' });
    const eslintResults = JSON.parse(result);
    return eslintResults.reduce((total, file) => total + file.errorCount + file.warningCount, 0);
  } catch {
    return 0;
  }
}

async function getTypeScriptErrors() {
  try {
    execSync('npx tsc --noEmit', { stdio: 'pipe' });
    return 0;
  } catch (error) {
    // Count TypeScript errors from output
    const output = error.stdout ? error.stdout.toString() : '';
    const errorMatches = output.match(/error TS\d+:/g);
    return errorMatches ? errorMatches.length : 0;
  }
}

async function getTestCoverage() {
  try {
    if (fs.existsSync('coverage/coverage-summary.json')) {
      const coverage = JSON.parse(fs.readFileSync('coverage/coverage-summary.json', 'utf8'));
      return {
        lines: Math.round(coverage.total.lines.pct),
        functions: Math.round(coverage.total.functions.pct),
        branches: Math.round(coverage.total.branches.pct),
        statements: Math.round(coverage.total.statements.pct)
      };
    }
  } catch {}
  
  return { lines: 0, functions: 0, branches: 0, statements: 0 };
}

async function getCodeComplexity() {
  // This would use a complexity analysis tool
  // For now, return a simple metric based on file count and size
  try {
    const fileCount = execSync('find src/ -name "*.ts" | wc -l', { encoding: 'utf8' });
    const lineCount = execSync('find src/ -name "*.ts" -exec wc -l {} + | tail -1', { encoding: 'utf8' });
    
    const files = parseInt(fileCount.trim());
    const lines = parseInt(lineCount.trim().split(' ')[0]);
    const avgLinesPerFile = files > 0 ? Math.round(lines / files) : 0;
    
    return {
      totalFiles: files,
      totalLines: lines,
      averageLinesPerFile: avgLinesPerFile,
      complexityScore: avgLinesPerFile > 200 ? 'high' : avgLinesPerFile > 100 ? 'medium' : 'low'
    };
  } catch {
    return {
      totalFiles: 0,
      totalLines: 0,
      averageLinesPerFile: 0,
      complexityScore: 'unknown'
    };
  }
}

async function analyzePerformance() {
  return {
    buildTime: await getBuildTime(),
    bundleSize: await getBundleSize(),
    apiResponseTime: await getApiResponseTime(),
    lastOptimization: await getLastOptimization()
  };
}

async function getBuildTime() {
  // This would be populated by CI/CD pipeline
  return 0;
}

async function getBundleSize() {
  try {
    if (fs.existsSync('dist')) {
      const result = execSync('du -sh dist/', { encoding: 'utf8' });
      const sizeMatch = result.match(/^(\d+(?:\.\d+)?[KMGT]?)\s/);
      return sizeMatch ? sizeMatch[1] : 'unknown';
    }
  } catch {}
  return 'unknown';
}

async function getApiResponseTime() {
  // This would integrate with monitoring tools
  return 0;
}

async function getLastOptimization() {
  try {
    const result = execSync('git log --grep="perf:" -1 --format="%cr"', { encoding: 'utf8' });
    return result.trim() || 'No recent optimizations';
  } catch {
    return 'No recent optimizations';
  }
}

async function analyzeTestMetrics() {
  const testFiles = await getTestFileCount();
  const coverage = await getTestCoverage();
  
  return {
    testFiles,
    coverage,
    testToCodeRatio: await getTestToCodeRatio(),
    recentTestAdditions: await getRecentTestAdditions()
  };
}

async function getTestFileCount() {
  try {
    const result = execSync('find src/ -name "*.test.ts" -o -name "*.spec.ts" | wc -l', { encoding: 'utf8' });
    return parseInt(result.trim()) || 0;
  } catch {
    return 0;
  }
}

async function getTestToCodeRatio() {
  try {
    const testLines = execSync('find src/ -name "*.test.ts" -o -name "*.spec.ts" -exec wc -l {} + | tail -1', { encoding: 'utf8' });
    const codeLines = execSync('find src/ -name "*.ts" ! -name "*.test.ts" ! -name "*.spec.ts" -exec wc -l {} + | tail -1', { encoding: 'utf8' });
    
    const testLineCount = parseInt(testLines.trim().split(' ')[0]) || 0;
    const codeLineCount = parseInt(codeLines.trim().split(' ')[0]) || 1;
    
    return Math.round((testLineCount / codeLineCount) * 100);
  } catch {
    return 0;
  }
}

async function getRecentTestAdditions() {
  try {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const since = oneWeekAgo.toISOString().split('T')[0];
    
    const result = execSync(`git log --since="${since}" --name-only --pretty=format: | grep -E "\.test\.ts$|\.spec\.ts$" | sort | uniq`, { encoding: 'utf8' });
    return result.trim().split('\n').filter(line => line.trim()).length;
  } catch {
    return 0;
  }
}

async function analyzeCustomerFeedback() {
  // This would integrate with customer feedback systems
  // For now, return placeholder data
  return {
    totalFeedback: 0,
    positiveRatio: 0,
    commonRequests: [],
    criticalIssues: []
  };
}

async function identifyRisks() {
  const risks = [];
  
  // Technical risks
  const todoCount = await countTodoItems();
  if (todoCount > 20) {
    risks.push({
      type: 'technical',
      severity: 'medium',
      description: `High number of TODO items (${todoCount})`,
      recommendation: 'Prioritize technical debt cleanup'
    });
  }
  
  const coverage = await getTestCoverage();
  if (coverage.lines < 70) {
    risks.push({
      type: 'quality',
      severity: 'high',
      description: `Low test coverage (${coverage.lines}%)`,
      recommendation: 'Increase test coverage before adding new features'
    });
  }
  
  const eslintIssues = await getEslintIssues();
  if (eslintIssues > 50) {
    risks.push({
      type: 'quality',
      severity: 'medium',
      description: `High number of linting issues (${eslintIssues})`,
      recommendation: 'Run lint fixes and establish stricter pre-commit hooks'
    });
  }
  
  return risks;
}

async function generateRecommendations() {
  const recommendations = [];
  
  const features = await analyzeFeatureProgress();
  if (features.completionRate < 50) {
    recommendations.push({
      category: 'development',
      priority: 'high',
      description: 'Focus on completing in-progress features before starting new ones',
      action: 'Review current sprint and remove scope creep'
    });
  }
  
  const quality = await analyzeCodeQuality();
  if (quality.overallScore < 80) {
    recommendations.push({
      category: 'quality',
      priority: 'high',
      description: 'Improve code quality metrics',
      action: 'Dedicate time to refactoring and technical debt'
    });
  }
  
  return recommendations;
}

async function generateNextWeekPriorities() {
  const priorities = [];
  
  // Based on current progress and risks
  const todoCount = await countTodoItems();
  if (todoCount > 15) {
    priorities.push('Reduce TODO items by 50%');
  }
  
  const coverage = await getTestCoverage();
  if (coverage.lines < 80) {
    priorities.push('Increase test coverage to 80%');
  }
  
  const features = await analyzeFeatureProgress();
  if (features.inProgressFeatures.length > 0) {
    priorities.push(`Complete in-progress features: ${features.inProgressFeatures.slice(0, 3).join(', ')}`);
  }
  
  return priorities;
}

function generateMarkdownReport(report) {
  return `# Weekly Progress Report - Week ${report.week}

*Generated on ${new Date(report.timestamp).toLocaleDateString()}*

## 📊 Summary

- **Commits this week:** ${report.summary.commits}
- **Lines added:** ${report.summary.linesAdded}
- **Lines removed:** ${report.summary.linesRemoved}
- **Files changed:** ${report.summary.filesChanged}
- **Contributors:** ${report.summary.contributors}

## 🎯 Feature Progress

- **Completion Rate:** ${report.features.completionRate}%
- **TODO Items:** ${report.features.todoItems}
- **Completed Features:** ${report.features.completedFeatures.length}
- **In Progress:** ${report.features.inProgressFeatures.length}

### Completed This Week
${report.features.completedFeatures.map(feature => `- ${feature}`).join('\n') || '- No features completed this week'}

### In Progress
${report.features.inProgressFeatures.map(feature => `- ${feature}`).join('\n') || '- No features in progress'}

## 🔍 Code Quality

- **Overall Score:** ${report.codeQuality.overallScore}/100
- **ESLint Issues:** ${report.codeQuality.eslintIssues}
- **TypeScript Errors:** ${report.codeQuality.typeScriptErrors}
- **Test Coverage:** ${report.codeQuality.testCoverage.lines}%

## 🧪 Testing

- **Test Files:** ${report.testing.testFiles}
- **Test Coverage:** ${report.testing.coverage.lines}%
- **Test to Code Ratio:** ${report.testing.testToCodeRatio}%
- **New Tests Added:** ${report.testing.recentTestAdditions}

## ⚠️ Risks Identified

${report.risks.length > 0 ? report.risks.map(risk => 
  `### ${risk.type.toUpperCase()} - ${risk.severity.toUpperCase()}
- **Issue:** ${risk.description}
- **Recommendation:** ${risk.recommendation}`
).join('\n\n') : 'No significant risks identified.'}

## 💡 Recommendations

${report.recommendations.map(rec => 
  `### ${rec.category.toUpperCase()} - ${rec.priority.toUpperCase()}
- **Description:** ${rec.description}
- **Action:** ${rec.action}`
).join('\n\n')}

## 🎯 Next Week Priorities

${report.nextWeekPriorities.map(priority => `- ${priority}`).join('\n')}

---

*This report was automatically generated by the DeckStack development automation system.*
`;
}

function printReportSummary(report) {
  console.log('\n📊 Weekly Progress Summary');
  console.log('═'.repeat(50));
  console.log(`Week: ${report.week}`);
  console.log(`Commits: ${report.summary.commits}`);
  console.log(`Feature Completion: ${report.features.completionRate}%`);
  console.log(`Code Quality Score: ${report.codeQuality.overallScore}/100`);
  console.log(`Test Coverage: ${report.codeQuality.testCoverage.lines}%`);
  console.log(`TODO Items: ${report.features.todoItems}`);
  
  if (report.risks.length > 0) {
    console.log('\n⚠️  Risks Identified:');
    report.risks.forEach(risk => {
      console.log(`  - ${risk.severity.toUpperCase()}: ${risk.description}`);
    });
  }
  
  if (report.nextWeekPriorities.length > 0) {
    console.log('\n🎯 Next Week Priorities:');
    report.nextWeekPriorities.forEach(priority => {
      console.log(`  - ${priority}`);
    });
  }
  
  console.log('\n' + '═'.repeat(50));
}

async function sendNotifications(report) {
  // Send Slack notification if webhook is configured
  const slackWebhook = process.env.SLACK_WEBHOOK_URL;
  if (slackWebhook) {
    try {
      const message = {
        text: `📊 Weekly Progress Report - Week ${report.week}`,
        attachments: [
          {
            color: report.codeQuality.overallScore > 80 ? 'good' : report.codeQuality.overallScore > 60 ? 'warning' : 'danger',
            fields: [
              { title: 'Commits', value: report.summary.commits, short: true },
              { title: 'Feature Completion', value: `${report.features.completionRate}%`, short: true },
              { title: 'Code Quality', value: `${report.codeQuality.overallScore}/100`, short: true },
              { title: 'Test Coverage', value: `${report.codeQuality.testCoverage.lines}%`, short: true }
            ]
          }
        ]
      };
      
      // Send to Slack (would require actual HTTP request)
      console.log('📱 Slack notification prepared (webhook not implemented in this script)');
    } catch (error) {
      console.warn('Warning: Could not send Slack notification:', error.message);
    }
  }
}

if (require.main === module) {
  generateWeeklyReport().catch(error => {
    console.error('❌ Weekly report generation failed:', error.message);
    process.exit(1);
  });
}

module.exports = { generateWeeklyReport };