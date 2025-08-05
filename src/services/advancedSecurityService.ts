/**
 * Advanced Security Service - Phase 5
 * Enhanced security features, audit improvements, and compliance tools
 */

import { PrismaClient } from '@prisma/client';
import { RequestContext } from '../types';
import * as crypto from 'crypto';

interface SecurityEvent {
  id: string;
  type: 'login_attempt' | 'permission_change' | 'data_access' | 'api_call' | 'suspicious_activity';
  severity: 'low' | 'medium' | 'high' | 'critical';
  userId?: string;
  tenantId: string;
  ipAddress: string;
  userAgent: string;
  details: any;
  timestamp: Date;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: Date;
}

interface AuditTrail {
  id: string;
  entityType: string;
  entityId: string;
  action: 'create' | 'read' | 'update' | 'delete';
  oldValues?: any;
  newValues?: any;
  userId: string;
  tenantId: string;
  timestamp: Date;
  ipAddress: string;
  userAgent: string;
  correlationId?: string;
}

interface SecurityPolicy {
  id: string;
  name: string;
  description: string;
  rules: SecurityRule[];
  enabled: boolean;
  tenantId: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

interface SecurityRule {
  id: string;
  type: 'rate_limit' | 'ip_whitelist' | 'password_policy' | 'session_timeout' | 'mfa_required';
  conditions: any;
  actions: string[];
  enabled: boolean;
}

interface ComplianceReport {
  tenantId: string;
  reportType: 'gdpr' | 'ccpa' | 'sox' | 'pci_dss';
  generatedAt: Date;
  period: { start: Date; end: Date };
  findings: ComplianceFinding[];
  score: number;
  recommendations: string[];
}

interface ComplianceFinding {
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  evidence: any;
  remediation: string;
}

interface DataRetentionPolicy {
  id: string;
  name: string;
  dataType: string;
  retentionPeriod: number; // days
  autoDelete: boolean;
  archiveBeforeDelete: boolean;
  tenantId: string;
  enabled: boolean;
}

interface EncryptionKey {
  id: string;
  keyId: string;
  algorithm: string;
  purpose: 'data_encryption' | 'token_signing' | 'api_authentication';
  status: 'active' | 'rotating' | 'deprecated';
  createdAt: Date;
  expiresAt?: Date;
  tenantId: string;
}

interface AccessControlMatrix {
  userId: string;
  tenantId: string;
  role: string;
  permissions: Permission[];
  restrictions: Restriction[];
  lastReviewed: Date;
  reviewedBy: string;
}

interface Permission {
  resource: string;
  actions: string[];
  conditions?: any;
}

interface Restriction {
  type: 'ip_range' | 'time_window' | 'location' | 'device';
  value: any;
  enabled: boolean;
}

export class AdvancedSecurityService {
  private encryptionKeys: Map<string, EncryptionKey> = new Map();
  private securityPolicies: Map<string, SecurityPolicy> = new Map();

  constructor(private prisma: PrismaClient) {
    this.initializeDefaultPolicies();
  }

  async logSecurityEvent(
    event: Omit<SecurityEvent, 'id' | 'timestamp' | 'resolved'>
  ): Promise<string> {
    const securityEvent: SecurityEvent = {
      id: this.generateEventId(),
      ...event,
      timestamp: new Date(),
      resolved: false
    };

    // Store in database
    await this.prisma.securityEvent.create({
      data: {
        id: securityEvent.id,
        type: securityEvent.type,
        severity: securityEvent.severity,
        userId: securityEvent.userId,
        tenantId: securityEvent.tenantId,
        ipAddress: securityEvent.ipAddress,
        userAgent: securityEvent.userAgent,
        details: JSON.stringify(securityEvent.details),
        timestamp: securityEvent.timestamp,
        resolved: securityEvent.resolved
      }
    });

    // Check for security policy violations
    await this.checkSecurityPolicies(securityEvent);

    // Auto-respond to critical events
    if (securityEvent.severity === 'critical') {
      await this.handleCriticalSecurityEvent(securityEvent);
    }

    return securityEvent.id;
  }

  async createAuditTrail(
    trail: Omit<AuditTrail, 'id' | 'timestamp'>
  ): Promise<string> {
    const auditTrail: AuditTrail = {
      id: this.generateAuditId(),
      ...trail,
      timestamp: new Date()
    };

    await this.prisma.auditTrail.create({
      data: {
        id: auditTrail.id,
        entityType: auditTrail.entityType,
        entityId: auditTrail.entityId,
        action: auditTrail.action,
        oldValues: JSON.stringify(auditTrail.oldValues),
        newValues: JSON.stringify(auditTrail.newValues),
        userId: auditTrail.userId,
        tenantId: auditTrail.tenantId,
        timestamp: auditTrail.timestamp,
        ipAddress: auditTrail.ipAddress,
        userAgent: auditTrail.userAgent,
        correlationId: auditTrail.correlationId
      }
    });

    return auditTrail.id;
  }

  async encryptSensitiveData(
    data: string,
    purpose: string,
    tenantId: string
  ): Promise<{ encrypted: string; keyId: string }> {
    const key = await this.getEncryptionKey(purpose, tenantId);
    const cipher = crypto.createCipher('aes-256-gcm', key.keyId);
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return {
      encrypted,
      keyId: key.id
    };
  }

  async decryptSensitiveData(
    encryptedData: string,
    keyId: string
  ): Promise<string> {
    const key = this.encryptionKeys.get(keyId);
    if (!key || key.status !== 'active') {
      throw new Error('Invalid or inactive encryption key');
    }

    const decipher = crypto.createDecipher('aes-256-gcm', key.keyId);
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  async validatePasswordPolicy(
    password: string,
    tenantId: string
  ): Promise<{ valid: boolean; violations: string[] }> {
    const policy = await this.getPasswordPolicy(tenantId);
    const violations: string[] = [];

    if (password.length < policy.minLength) {
      violations.push(`Password must be at least ${policy.minLength} characters`);
    }

    if (policy.requireUppercase && !/[A-Z]/.test(password)) {
      violations.push('Password must contain at least one uppercase letter');
    }

    if (policy.requireLowercase && !/[a-z]/.test(password)) {
      violations.push('Password must contain at least one lowercase letter');
    }

    if (policy.requireNumbers && !/\d/.test(password)) {
      violations.push('Password must contain at least one number');
    }

    if (policy.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      violations.push('Password must contain at least one special character');
    }

    // Check against common passwords
    if (await this.isCommonPassword(password)) {
      violations.push('Password is too common');
    }

    return {
      valid: violations.length === 0,
      violations
    };
  }

  async generateComplianceReport(
    tenantId: string,
    reportType: 'gdpr' | 'ccpa' | 'sox' | 'pci_dss',
    period: { start: Date; end: Date }
  ): Promise<ComplianceReport> {
    const findings: ComplianceFinding[] = [];

    switch (reportType) {
      case 'gdpr':
        findings.push(...await this.checkGDPRCompliance(tenantId, period));
        break;
      case 'ccpa':
        findings.push(...await this.checkCCPACompliance(tenantId, period));
        break;
      case 'sox':
        findings.push(...await this.checkSOXCompliance(tenantId, period));
        break;
      case 'pci_dss':
        findings.push(...await this.checkPCIDSSCompliance(tenantId, period));
        break;
    }

    const score = this.calculateComplianceScore(findings);
    const recommendations = this.generateComplianceRecommendations(findings);

    return {
      tenantId,
      reportType,
      generatedAt: new Date(),
      period,
      findings,
      score,
      recommendations
    };
  }

  async implementDataRetentionPolicy(
    policy: DataRetentionPolicy
  ): Promise<{ deletedRecords: number; archivedRecords: number }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - policy.retentionPeriod);

    let deletedRecords = 0;
    let archivedRecords = 0;

    switch (policy.dataType) {
      case 'audit_logs':
        const oldAuditLogs = await this.prisma.auditTrail.findMany({
          where: {
            tenantId: policy.tenantId,
            timestamp: { lt: cutoffDate }
          }
        });

        if (policy.archiveBeforeDelete) {
          await this.archiveAuditLogs(oldAuditLogs);
          archivedRecords = oldAuditLogs.length;
        }

        if (policy.autoDelete) {
          await this.prisma.auditTrail.deleteMany({
            where: {
              tenantId: policy.tenantId,
              timestamp: { lt: cutoffDate }
            }
          });
          deletedRecords = oldAuditLogs.length;
        }
        break;

      case 'security_events':
        const oldSecurityEvents = await this.prisma.securityEvent.findMany({
          where: {
            tenantId: policy.tenantId,
            timestamp: { lt: cutoffDate },
            resolved: true
          }
        });

        if (policy.archiveBeforeDelete) {
          await this.archiveSecurityEvents(oldSecurityEvents);
          archivedRecords = oldSecurityEvents.length;
        }

        if (policy.autoDelete) {
          await this.prisma.securityEvent.deleteMany({
            where: {
              tenantId: policy.tenantId,
              timestamp: { lt: cutoffDate },
              resolved: true
            }
          });
          deletedRecords = oldSecurityEvents.length;
        }
        break;
    }

    return { deletedRecords, archivedRecords };
  }

  async validateAccessControl(
    userId: string,
    tenantId: string,
    resource: string,
    action: string,
    context: any = {}
  ): Promise<{ allowed: boolean; reason?: string }> {
    const accessMatrix = await this.getAccessControlMatrix(userId, tenantId);
    
    if (!accessMatrix) {
      return { allowed: false, reason: 'No access control matrix found' };
    }

    // Check permissions
    const permission = accessMatrix.permissions.find(p => 
      p.resource === resource && p.actions.includes(action)
    );

    if (!permission) {
      return { allowed: false, reason: 'Permission not granted' };
    }

    // Check conditions
    if (permission.conditions) {
      const conditionsMet = await this.evaluatePermissionConditions(
        permission.conditions,
        context
      );
      
      if (!conditionsMet) {
        return { allowed: false, reason: 'Permission conditions not met' };
      }
    }

    // Check restrictions
    for (const restriction of accessMatrix.restrictions) {
      if (!restriction.enabled) continue;

      const restrictionViolated = await this.checkRestriction(restriction, context);
      if (restrictionViolated) {
        return { 
          allowed: false, 
          reason: `Access restricted: ${restriction.type}` 
        };
      }
    }

    return { allowed: true };
  }

  async rotateEncryptionKeys(tenantId: string): Promise<{ rotated: number }> {
    const activeKeys = Array.from(this.encryptionKeys.values())
      .filter(key => key.tenantId === tenantId && key.status === 'active');

    let rotated = 0;

    for (const key of activeKeys) {
      // Mark old key as rotating
      key.status = 'rotating';

      // Generate new key
      const newKey: EncryptionKey = {
        id: this.generateKeyId(),
        keyId: crypto.randomBytes(32).toString('hex'),
        algorithm: key.algorithm,
        purpose: key.purpose,
        status: 'active',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        tenantId
      };

      this.encryptionKeys.set(newKey.id, newKey);

      // Schedule old key deprecation
      setTimeout(() => {
        key.status = 'deprecated';
      }, 30 * 24 * 60 * 60 * 1000); // 30 days

      rotated++;
    }

    return { rotated };
  }

  async detectAnomalousActivity(
    tenantId: string,
    timeWindow: number = 24 // hours
  ): Promise<SecurityEvent[]> {
    const since = new Date(Date.now() - timeWindow * 60 * 60 * 1000);
    
    const recentEvents = await this.prisma.securityEvent.findMany({
      where: {
        tenantId,
        timestamp: { gte: since }
      },
      orderBy: { timestamp: 'desc' }
    });

    const anomalies: SecurityEvent[] = [];

    // Detect unusual login patterns
    const loginAttempts = recentEvents.filter(e => e.type === 'login_attempt');
    const failedLogins = loginAttempts.filter(e => 
      e.details && JSON.parse(e.details).success === false
    );

    if (failedLogins.length > 10) {
      anomalies.push({
        id: this.generateEventId(),
        type: 'suspicious_activity',
        severity: 'high',
        tenantId,
        ipAddress: 'multiple',
        userAgent: 'multiple',
        details: {
          anomalyType: 'excessive_failed_logins',
          count: failedLogins.length,
          timeWindow
        },
        timestamp: new Date(),
        resolved: false
      });
    }

    // Detect unusual API usage patterns
    const apiCalls = recentEvents.filter(e => e.type === 'api_call');
    const uniqueIPs = new Set(apiCalls.map(e => e.ipAddress));

    if (uniqueIPs.size > 50) {
      anomalies.push({
        id: this.generateEventId(),
        type: 'suspicious_activity',
        severity: 'medium',
        tenantId,
        ipAddress: 'multiple',
        userAgent: 'multiple',
        details: {
          anomalyType: 'unusual_ip_diversity',
          uniqueIPs: uniqueIPs.size,
          timeWindow
        },
        timestamp: new Date(),
        resolved: false
      });
    }

    return anomalies;
  }

  // Private helper methods
  private initializeDefaultPolicies(): void {
    // Initialize default security policies
    const defaultPolicy: SecurityPolicy = {
      id: 'default',
      name: 'Default Security Policy',
      description: 'Default security rules for all tenants',
      rules: [
        {
          id: 'rate_limit_api',
          type: 'rate_limit',
          conditions: { endpoint: '/api/*', limit: 1000, window: 3600 },
          actions: ['block', 'log'],
          enabled: true
        },
        {
          id: 'password_policy',
          type: 'password_policy',
          conditions: { 
            minLength: 8, 
            requireUppercase: true, 
            requireNumbers: true 
          },
          actions: ['enforce'],
          enabled: true
        }
      ],
      enabled: true,
      tenantId: 'default',
      createdBy: 'system',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.securityPolicies.set('default', defaultPolicy);
  }

  private async checkSecurityPolicies(event: SecurityEvent): Promise<void> {
    const policies = Array.from(this.securityPolicies.values())
      .filter(p => p.enabled && (p.tenantId === event.tenantId || p.tenantId === 'default'));

    for (const policy of policies) {
      for (const rule of policy.rules) {
        if (!rule.enabled) continue;

        const violation = await this.checkPolicyRule(rule, event);
        if (violation) {
          await this.handlePolicyViolation(rule, event);
        }
      }
    }
  }

  private async checkPolicyRule(rule: SecurityRule, event: SecurityEvent): Promise<boolean> {
    switch (rule.type) {
      case 'rate_limit':
        return await this.checkRateLimit(rule.conditions, event);
      default:
        return false;
    }
  }

  private async checkRateLimit(conditions: any, event: SecurityEvent): Promise<boolean> {
    const { limit, window } = conditions;
    const since = new Date(Date.now() - window * 1000);

    const recentEvents = await this.prisma.securityEvent.count({
      where: {
        tenantId: event.tenantId,
        ipAddress: event.ipAddress,
        timestamp: { gte: since }
      }
    });

    return recentEvents > limit;
  }

  private async handlePolicyViolation(rule: SecurityRule, event: SecurityEvent): Promise<void> {
    for (const action of rule.actions) {
      switch (action) {
        case 'block':
          // Implement IP blocking logic
          break;
        case 'log':
          await this.logSecurityEvent({
            type: 'suspicious_activity',
            severity: 'medium',
            tenantId: event.tenantId,
            ipAddress: event.ipAddress,
            userAgent: event.userAgent,
            details: {
              policyViolation: true,
              rule: rule.id,
              originalEvent: event.id
            }
          });
          break;
      }
    }
  }

  private async handleCriticalSecurityEvent(event: SecurityEvent): Promise<void> {
    // Implement critical event response
    console.log(`CRITICAL SECURITY EVENT: ${event.type} for tenant ${event.tenantId}`);
    
    // In production, integrate with alerting systems
    // - Send notifications to security team
    // - Trigger automated response procedures
    // - Escalate to incident management system
  }

  private async getEncryptionKey(purpose: string, tenantId: string): Promise<EncryptionKey> {
    const existingKey = Array.from(this.encryptionKeys.values())
      .find(key => 
        key.purpose === purpose && 
        key.tenantId === tenantId && 
        key.status === 'active'
      );

    if (existingKey) {
      return existingKey;
    }

    // Generate new key
    const newKey: EncryptionKey = {
      id: this.generateKeyId(),
      keyId: crypto.randomBytes(32).toString('hex'),
      algorithm: 'aes-256-gcm',
      purpose: purpose as any,
      status: 'active',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
      tenantId
    };

    this.encryptionKeys.set(newKey.id, newKey);
    return newKey;
  }

  private async getPasswordPolicy(tenantId: string): Promise<any> {
    // Return default password policy
    return {
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true
    };
  }

  private async isCommonPassword(password: string): Promise<boolean> {
    const commonPasswords = [
      'password', '123456', 'password123', 'admin', 'qwerty',
      'letmein', 'welcome', 'monkey', '1234567890'
    ];
    
    return commonPasswords.includes(password.toLowerCase());
  }

  private async checkGDPRCompliance(
    tenantId: string,
    period: { start: Date; end: Date }
  ): Promise<ComplianceFinding[]> {
    const findings: ComplianceFinding[] = [];

    // Check data retention policies
    const auditLogs = await this.prisma.auditTrail.count({
      where: {
        tenantId,
        timestamp: { lt: new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000) } // 2 years
      }
    });

    if (auditLogs > 0) {
      findings.push({
        category: 'Data Retention',
        severity: 'medium',
        description: `${auditLogs} audit logs older than 2 years found`,
        evidence: { count: auditLogs },
        remediation: 'Implement automated data retention policy'
      });
    }

    return findings;
  }

  private async checkCCPACompliance(
    tenantId: string,
    period: { start: Date; end: Date }
  ): Promise<ComplianceFinding[]> {
    // Implement CCPA compliance checks
    return [];
  }

  private async checkSOXCompliance(
    tenantId: string,
    period: { start: Date; end: Date }
  ): Promise<ComplianceFinding[]> {
    // Implement SOX compliance checks
    return [];
  }

  private async checkPCIDSSCompliance(
    tenantId: string,
    period: { start: Date; end: Date }
  ): Promise<ComplianceFinding[]> {
    // Implement PCI DSS compliance checks
    return [];
  }

  private calculateComplianceScore(findings: ComplianceFinding[]): number {
    if (findings.length === 0) return 100;

    const severityWeights = { low: 1, medium: 3, high: 5, critical: 10 };
    const totalWeight = findings.reduce((sum, f) => sum + severityWeights[f.severity], 0);
    const maxPossibleWeight = findings.length * 10; // All critical

    return Math.max(0, 100 - (totalWeight / maxPossibleWeight) * 100);
  }

  private generateComplianceRecommendations(findings: ComplianceFinding[]): string[] {
    const recommendations = new Set<string>();

    findings.forEach(finding => {
      recommendations.add(finding.remediation);
    });

    return Array.from(recommendations);
  }

  private async archiveAuditLogs(logs: any[]): Promise<void> {
    // In production, archive to long-term storage
    console.log(`Archiving ${logs.length} audit logs`);
  }

  private async archiveSecurityEvents(events: any[]): Promise<void> {
    // In production, archive to long-term storage
    console.log(`Archiving ${events.length} security events`);
  }

  private async getAccessControlMatrix(
    userId: string,
    tenantId: string
  ): Promise<AccessControlMatrix | null> {
    // In production, fetch from database
    return {
      userId,
      tenantId,
      role: 'admin',
      permissions: [
        {
          resource: '*',
          actions: ['*']
        }
      ],
      restrictions: [],
      lastReviewed: new Date(),
      reviewedBy: 'system'
    };
  }

  private async evaluatePermissionConditions(
    conditions: any,
    context: any
  ): Promise<boolean> {
    // Implement condition evaluation logic
    return true;
  }

  private async checkRestriction(
    restriction: Restriction,
    context: any
  ): Promise<boolean> {
    switch (restriction.type) {
      case 'ip_range':
        return !this.isIPInRange(context.ipAddress, restriction.value);
      case 'time_window':
        return !this.isInTimeWindow(new Date(), restriction.value);
      default:
        return false;
    }
  }

  private isIPInRange(ip: string, range: string): boolean {
    // Implement IP range checking
    return true;
  }

  private isInTimeWindow(time: Date, window: any): boolean {
    // Implement time window checking
    return true;
  }

  private generateEventId(): string {
    return `sec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateAuditId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateKeyId(): string {
    return `key_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}