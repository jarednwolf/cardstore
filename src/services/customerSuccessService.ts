/**
 * Customer Success Service - Phase 5
 * Advanced customer success metrics, tracking, and engagement analytics
 */

import { PrismaClient } from '@prisma/client';
import { RequestContext } from '../types';

interface CustomerHealthScore {
  customerId: string;
  score: number; // 0-100
  factors: {
    orderFrequency: number;
    orderValue: number;
    engagement: number;
    satisfaction: number;
    retention: number;
  };
  risk: 'low' | 'medium' | 'high';
  lastActivity: Date;
  recommendations: string[];
}

interface CustomerJourney {
  customerId: string;
  stages: CustomerStage[];
  currentStage: string;
  timeInCurrentStage: number;
  totalJourneyTime: number;
  conversionEvents: ConversionEvent[];
}

interface CustomerStage {
  stage: 'prospect' | 'first_purchase' | 'repeat_customer' | 'loyal_customer' | 'champion' | 'at_risk' | 'churned';
  enteredAt: Date;
  exitedAt?: Date;
  duration?: number;
  triggers: string[];
}

interface ConversionEvent {
  event: string;
  timestamp: Date;
  value?: number;
  metadata?: any;
}

interface CustomerSegment {
  id: string;
  name: string;
  description: string;
  criteria: SegmentCriteria[];
  customerCount: number;
  averageValue: number;
  retentionRate: number;
  customers?: CustomerProfile[];
}

interface SegmentCriteria {
  field: string;
  operator: 'equals' | 'greater_than' | 'less_than' | 'between' | 'contains';
  value: any;
}

interface CustomerProfile {
  customerId: string;
  email?: string;
  name?: string;
  firstOrderDate: Date;
  lastOrderDate: Date;
  totalOrders: number;
  totalSpent: number;
  averageOrderValue: number;
  lifetimeValue: number;
  healthScore: number;
  segment: string;
  tags: string[];
  preferences: any;
}

interface EngagementMetrics {
  customerId: string;
  emailOpens: number;
  emailClicks: number;
  websiteVisits: number;
  productViews: number;
  cartAbandonment: number;
  supportTickets: number;
  reviewsLeft: number;
  referrals: number;
  socialShares: number;
}

interface ChurnPrediction {
  customerId: string;
  churnProbability: number; // 0-1
  riskFactors: string[];
  timeToChurn: number; // days
  preventionActions: string[];
  confidence: number;
}

interface CustomerSuccessMetrics {
  totalCustomers: number;
  activeCustomers: number;
  newCustomers: number;
  churnedCustomers: number;
  churnRate: number;
  retentionRate: number;
  averageLifetimeValue: number;
  averageHealthScore: number;
  segmentDistribution: Record<string, number>;
  riskDistribution: Record<string, number>;
}

export class CustomerSuccessService {
  constructor(private prisma: PrismaClient) {}

  async calculateCustomerHealthScore(
    customerId: string,
    context: RequestContext
  ): Promise<CustomerHealthScore> {
    const customer = await this.getCustomerProfile(customerId, context);
    const engagement = await this.getEngagementMetrics(customerId, context);
    
    // Calculate individual factor scores (0-100)
    const orderFrequency = this.calculateOrderFrequencyScore(customer);
    const orderValue = this.calculateOrderValueScore(customer);
    const engagementScore = this.calculateEngagementScore(engagement);
    const satisfactionScore = await this.calculateSatisfactionScore(customerId, context);
    const retentionScore = this.calculateRetentionScore(customer);

    // Weighted average for overall health score
    const weights = {
      orderFrequency: 0.25,
      orderValue: 0.20,
      engagement: 0.20,
      satisfaction: 0.20,
      retention: 0.15
    };

    const score = Math.round(
      orderFrequency * weights.orderFrequency +
      orderValue * weights.orderValue +
      engagementScore * weights.engagement +
      satisfactionScore * weights.satisfaction +
      retentionScore * weights.retention
    );

    const risk = score >= 70 ? 'low' : score >= 40 ? 'medium' : 'high';
    const recommendations = this.generateHealthRecommendations(score, {
      orderFrequency,
      orderValue,
      engagement: engagementScore,
      satisfaction: satisfactionScore,
      retention: retentionScore
    });

    return {
      customerId,
      score,
      factors: {
        orderFrequency,
        orderValue,
        engagement: engagementScore,
        satisfaction: satisfactionScore,
        retention: retentionScore
      },
      risk,
      lastActivity: customer.lastOrderDate,
      recommendations
    };
  }

  async trackCustomerJourney(
    customerId: string,
    context: RequestContext
  ): Promise<CustomerJourney> {
    const customer = await this.getCustomerProfile(customerId, context);
    const orders = await this.getCustomerOrders(customerId, context);
    
    const stages = this.calculateCustomerStages(customer, orders);
    const currentStage = stages[stages.length - 1];
    const timeInCurrentStage = currentStage?.exitedAt ?
      0 : Date.now() - (currentStage?.enteredAt.getTime() || Date.now());
    
    const totalJourneyTime = Date.now() - customer.firstOrderDate.getTime();
    const conversionEvents = this.extractConversionEvents(orders);

    return {
      customerId,
      stages,
      currentStage: currentStage?.stage || 'unknown',
      timeInCurrentStage,
      totalJourneyTime,
      conversionEvents
    };
  }

  async segmentCustomers(
    criteria: SegmentCriteria[],
    context: RequestContext
  ): Promise<CustomerSegment> {
    const customers = await this.getCustomerProfiles(context);
    const segmentedCustomers = customers.filter(customer => 
      this.matchesSegmentCriteria(customer, criteria)
    );

    const averageValue = segmentedCustomers.length > 0 ?
      segmentedCustomers.reduce((sum, c) => sum + c.lifetimeValue, 0) / segmentedCustomers.length : 0;

    // Calculate retention rate (simplified)
    const retentionRate = this.calculateSegmentRetentionRate(segmentedCustomers);

    return {
      id: this.generateSegmentId(criteria),
      name: this.generateSegmentName(criteria),
      description: this.generateSegmentDescription(criteria),
      criteria,
      customerCount: segmentedCustomers.length,
      averageValue,
      retentionRate,
      customers: segmentedCustomers
    };
  }

  async predictChurn(
    customerId: string,
    context: RequestContext
  ): Promise<ChurnPrediction> {
    const customer = await this.getCustomerProfile(customerId, context);
    const healthScore = await this.calculateCustomerHealthScore(customerId, context);
    const engagement = await this.getEngagementMetrics(customerId, context);

    // Simple churn prediction model (in production, use ML models)
    const riskFactors: string[] = [];
    let churnProbability = 0;

    // Factor 1: Time since last order
    const daysSinceLastOrder = (Date.now() - customer.lastOrderDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceLastOrder > 90) {
      riskFactors.push('No orders in 90+ days');
      churnProbability += 0.3;
    } else if (daysSinceLastOrder > 60) {
      riskFactors.push('No orders in 60+ days');
      churnProbability += 0.2;
    }

    // Factor 2: Declining order frequency
    const recentOrderFrequency = await this.getRecentOrderFrequency(customerId, context);
    const historicalOrderFrequency = await this.getHistoricalOrderFrequency(customerId, context);
    
    if (recentOrderFrequency < historicalOrderFrequency * 0.5) {
      riskFactors.push('Declining order frequency');
      churnProbability += 0.25;
    }

    // Factor 3: Low engagement
    if (engagement.websiteVisits < 5 && engagement.emailOpens < 2) {
      riskFactors.push('Low engagement');
      churnProbability += 0.2;
    }

    // Factor 4: Health score
    if (healthScore.score < 40) {
      riskFactors.push('Low health score');
      churnProbability += 0.25;
    }

    churnProbability = Math.min(churnProbability, 1);

    const timeToChurn = this.estimateTimeToChurn(churnProbability, customer);
    const preventionActions = this.generatePreventionActions(riskFactors, customer);
    const confidence = this.calculatePredictionConfidence(customer, engagement);

    return {
      customerId,
      churnProbability,
      riskFactors,
      timeToChurn,
      preventionActions,
      confidence
    };
  }

  async getCustomerSuccessMetrics(
    context: RequestContext,
    timeframe?: { start: Date; end: Date }
  ): Promise<CustomerSuccessMetrics> {
    const customers = await this.getCustomerProfiles(context);
    
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const activeCustomers = customers.filter(c => 
      c.lastOrderDate > thirtyDaysAgo
    ).length;

    const newCustomers = customers.filter(c => 
      c.firstOrderDate > thirtyDaysAgo
    ).length;

    const churnedCustomers = customers.filter(c => 
      c.lastOrderDate < ninetyDaysAgo && c.totalOrders > 1
    ).length;

    const churnRate = customers.length > 0 ? (churnedCustomers / customers.length) * 100 : 0;
    const retentionRate = 100 - churnRate;

    const averageLifetimeValue = customers.length > 0 ?
      customers.reduce((sum, c) => sum + c.lifetimeValue, 0) / customers.length : 0;

    // Calculate average health score
    const healthScores = await Promise.all(
      customers.slice(0, 100).map(c => // Limit for performance
        this.calculateCustomerHealthScore(c.customerId, context)
      )
    );
    const averageHealthScore = healthScores.length > 0 ?
      healthScores.reduce((sum, h) => sum + h.score, 0) / healthScores.length : 0;

    // Segment distribution
    const segments = await this.getDefaultSegments(context);
    const segmentDistribution: Record<string, number> = {};
    for (const segment of segments) {
      segmentDistribution[segment.name] = segment.customerCount;
    }

    // Risk distribution
    const riskDistribution = {
      low: healthScores.filter(h => h.risk === 'low').length,
      medium: healthScores.filter(h => h.risk === 'medium').length,
      high: healthScores.filter(h => h.risk === 'high').length
    };

    return {
      totalCustomers: customers.length,
      activeCustomers,
      newCustomers,
      churnedCustomers,
      churnRate,
      retentionRate,
      averageLifetimeValue,
      averageHealthScore,
      segmentDistribution,
      riskDistribution
    };
  }

  async createCustomerCampaign(
    segmentId: string,
    campaignType: 'retention' | 'winback' | 'upsell' | 'referral',
    context: RequestContext
  ): Promise<{ campaignId: string; targetCustomers: number }> {
    // Get customers in segment
    const segment = await this.getSegmentById(segmentId, context);
    const targetCustomers = segment.customers?.length || 0;

    // Create campaign record
    const campaignId = `campaign_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // In production, integrate with email/marketing automation platform
    console.log(`Created ${campaignType} campaign ${campaignId} targeting ${targetCustomers} customers`);

    return {
      campaignId,
      targetCustomers
    };
  }

  // Private helper methods
  private async getCustomerProfile(
    customerId: string,
    context: RequestContext
  ): Promise<CustomerProfile> {
    const orders = await this.prisma.order.findMany({
      where: {
        tenantId: context.tenantId,
        customerId
      },
      orderBy: { createdAt: 'asc' }
    });

    if (orders.length === 0) {
      throw new Error('Customer not found');
    }

    const totalSpent = orders.reduce((sum, order) => sum + order.totalPrice, 0);
    const averageOrderValue = totalSpent / orders.length;

    return {
      customerId,
      email: '', // Customer email not available in current schema
      name: '', // Customer name not available in current schema
      firstOrderDate: orders[0]?.createdAt || new Date(),
      lastOrderDate: orders[orders.length - 1]?.createdAt || new Date(),
      totalOrders: orders.length,
      totalSpent,
      averageOrderValue,
      lifetimeValue: totalSpent, // Simplified
      healthScore: 0, // Will be calculated separately
      segment: 'default',
      tags: [],
      preferences: {}
    };
  }

  private async getCustomerProfiles(context: RequestContext): Promise<CustomerProfile[]> {
    const customerOrders = await this.prisma.order.groupBy({
      by: ['customerId'],
      where: {
        tenantId: context.tenantId,
        customerId: { not: null }
      },
      _sum: { totalPrice: true },
      _count: { id: true },
      _min: { createdAt: true },
      _max: { createdAt: true }
    });

    return customerOrders.map(customer => ({
      customerId: customer.customerId || '',
      firstOrderDate: customer._min.createdAt || new Date(),
      lastOrderDate: customer._max.createdAt || new Date(),
      totalOrders: customer._count.id,
      totalSpent: customer._sum.totalPrice || 0,
      averageOrderValue: customer._count.id > 0 ? 
        (customer._sum.totalPrice || 0) / customer._count.id : 0,
      lifetimeValue: customer._sum.totalPrice || 0,
      healthScore: 0,
      segment: 'default',
      tags: [],
      preferences: {}
    }));
  }

  private async getCustomerOrders(customerId: string, context: RequestContext) {
    return await this.prisma.order.findMany({
      where: {
        tenantId: context.tenantId,
        customerId
      },
      orderBy: { createdAt: 'asc' }
    });
  }

  private async getEngagementMetrics(
    customerId: string,
    context: RequestContext
  ): Promise<EngagementMetrics> {
    // In production, integrate with analytics platforms
    return {
      customerId,
      emailOpens: Math.floor(Math.random() * 20),
      emailClicks: Math.floor(Math.random() * 10),
      websiteVisits: Math.floor(Math.random() * 50),
      productViews: Math.floor(Math.random() * 100),
      cartAbandonment: Math.floor(Math.random() * 5),
      supportTickets: Math.floor(Math.random() * 3),
      reviewsLeft: Math.floor(Math.random() * 5),
      referrals: Math.floor(Math.random() * 2),
      socialShares: Math.floor(Math.random() * 10)
    };
  }

  private calculateOrderFrequencyScore(customer: CustomerProfile): number {
    const daysSinceFirst = (Date.now() - customer.firstOrderDate.getTime()) / (1000 * 60 * 60 * 24);
    const frequency = customer.totalOrders / (daysSinceFirst / 30); // Orders per month
    
    if (frequency >= 2) return 100;
    if (frequency >= 1) return 80;
    if (frequency >= 0.5) return 60;
    if (frequency >= 0.25) return 40;
    return 20;
  }

  private calculateOrderValueScore(customer: CustomerProfile): number {
    const aov = customer.averageOrderValue;
    
    if (aov >= 200) return 100;
    if (aov >= 100) return 80;
    if (aov >= 50) return 60;
    if (aov >= 25) return 40;
    return 20;
  }

  private calculateEngagementScore(engagement: EngagementMetrics): number {
    let score = 0;
    
    score += Math.min(engagement.emailOpens * 2, 20);
    score += Math.min(engagement.emailClicks * 5, 20);
    score += Math.min(engagement.websiteVisits, 20);
    score += Math.min(engagement.productViews * 0.5, 20);
    score += Math.min(engagement.reviewsLeft * 10, 20);
    
    return Math.min(score, 100);
  }

  private async calculateSatisfactionScore(
    customerId: string,
    context: RequestContext
  ): Promise<number> {
    // In production, integrate with review/feedback systems
    return 75; // Placeholder
  }

  private calculateRetentionScore(customer: CustomerProfile): number {
    const daysSinceLastOrder = (Date.now() - customer.lastOrderDate.getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysSinceLastOrder <= 30) return 100;
    if (daysSinceLastOrder <= 60) return 80;
    if (daysSinceLastOrder <= 90) return 60;
    if (daysSinceLastOrder <= 180) return 40;
    return 20;
  }

  private generateHealthRecommendations(
    score: number,
    factors: any
  ): string[] {
    const recommendations: string[] = [];
    
    if (factors.orderFrequency < 50) {
      recommendations.push('Send targeted product recommendations to increase order frequency');
    }
    
    if (factors.orderValue < 50) {
      recommendations.push('Offer bundle deals or upsells to increase order value');
    }
    
    if (factors.engagement < 50) {
      recommendations.push('Re-engage with personalized email campaigns');
    }
    
    if (factors.retention < 50) {
      recommendations.push('Implement retention campaign with special offers');
    }
    
    if (score < 40) {
      recommendations.push('High-priority intervention needed - consider personal outreach');
    }
    
    return recommendations;
  }

  private calculateCustomerStages(
    customer: CustomerProfile,
    orders: any[]
  ): CustomerStage[] {
    const stages: CustomerStage[] = [];
    
    // First purchase stage
    stages.push({
      stage: 'first_purchase',
      enteredAt: customer.firstOrderDate,
      exitedAt: orders.length > 1 ? orders[1].createdAt : undefined,
      triggers: ['first_order']
    });
    
    // Determine current stage based on behavior
    if (customer.totalOrders >= 10) {
      stages.push({
        stage: 'champion',
        enteredAt: orders[9].createdAt,
        triggers: ['high_order_count']
      });
    } else if (customer.totalOrders >= 5) {
      stages.push({
        stage: 'loyal_customer',
        enteredAt: orders[4].createdAt,
        triggers: ['repeat_purchases']
      });
    } else if (customer.totalOrders >= 2) {
      stages.push({
        stage: 'repeat_customer',
        enteredAt: orders[1].createdAt,
        triggers: ['second_purchase']
      });
    }
    
    return stages;
  }

  private extractConversionEvents(orders: any[]): ConversionEvent[] {
    return orders.map((order, index) => ({
      event: index === 0 ? 'first_purchase' : 'repeat_purchase',
      timestamp: order.createdAt,
      value: order.totalPrice
    }));
  }

  private matchesSegmentCriteria(
    customer: CustomerProfile,
    criteria: SegmentCriteria[]
  ): boolean {
    return criteria.every(criterion => {
      const value = this.getCustomerFieldValue(customer, criterion.field);
      return this.evaluateCriterion(value, criterion.operator, criterion.value);
    });
  }

  private getCustomerFieldValue(customer: CustomerProfile, field: string): any {
    switch (field) {
      case 'totalOrders': return customer.totalOrders;
      case 'totalSpent': return customer.totalSpent;
      case 'averageOrderValue': return customer.averageOrderValue;
      case 'daysSinceLastOrder':
        return (Date.now() - customer.lastOrderDate.getTime()) / (1000 * 60 * 60 * 24);
      default: return null;
    }
  }

  private evaluateCriterion(value: any, operator: string, criterionValue: any): boolean {
    switch (operator) {
      case 'equals': return value === criterionValue;
      case 'greater_than': return value > criterionValue;
      case 'less_than': return value < criterionValue;
      case 'between': return value >= criterionValue[0] && value <= criterionValue[1];
      case 'contains': return String(value).includes(String(criterionValue));
      default: return false;
    }
  }

  private generateSegmentId(criteria: SegmentCriteria[]): string {
    return `segment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSegmentName(criteria: SegmentCriteria[]): string {
    return `Custom Segment - ${criteria.length} criteria`;
  }

  private generateSegmentDescription(criteria: SegmentCriteria[]): string {
    return criteria.map(c => `${c.field} ${c.operator} ${c.value}`).join(' AND ');
  }

  private calculateSegmentRetentionRate(customers: CustomerProfile[]): number {
    const activeCustomers = customers.filter(c => {
      const daysSinceLastOrder = (Date.now() - c.lastOrderDate.getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceLastOrder <= 90;
    }).length;
    
    return customers.length > 0 ? (activeCustomers / customers.length) * 100 : 0;
  }

  private async getRecentOrderFrequency(
    customerId: string,
    context: RequestContext
  ): Promise<number> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentOrders = await this.prisma.order.count({
      where: {
        tenantId: context.tenantId,
        customerId,
        createdAt: { gte: thirtyDaysAgo }
      }
    });
    
    return recentOrders;
  }

  private async getHistoricalOrderFrequency(
    customerId: string,
    context: RequestContext
  ): Promise<number> {
    const orders = await this.prisma.order.findMany({
      where: {
        tenantId: context.tenantId,
        customerId
      },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' }
    });
    
    if (orders.length < 2) return 0;
    
    const totalDays = orders.length > 1 ?
      ((orders[orders.length - 1]?.createdAt.getTime() || Date.now()) - (orders[0]?.createdAt.getTime() || Date.now())) / (1000 * 60 * 60 * 24) : 1;
    return orders.length / (totalDays / 30); // Orders per month
  }

  private estimateTimeToChurn(churnProbability: number, customer: CustomerProfile): number {
    // Simple estimation based on churn probability
    const baseTime = 90; // 90 days baseline
    return Math.round(baseTime * (1 - churnProbability));
  }

  private generatePreventionActions(
    riskFactors: string[],
    customer: CustomerProfile
  ): string[] {
    const actions: string[] = [];
    
    if (riskFactors.includes('No orders in 90+ days')) {
      actions.push('Send win-back campaign with special discount');
    }
    
    if (riskFactors.includes('Declining order frequency')) {
      actions.push('Personalized product recommendations based on purchase history');
    }
    
    if (riskFactors.includes('Low engagement')) {
      actions.push('Re-engagement email series with valuable content');
    }
    
    if (riskFactors.includes('Low health score')) {
      actions.push('Personal outreach from customer success team');
    }
    
    return actions;
  }

  private calculatePredictionConfidence(
    customer: CustomerProfile,
    engagement: EngagementMetrics
  ): number {
    let confidence = 0.5; // Base confidence
    
    // More data = higher confidence
    if (customer.totalOrders >= 5) confidence += 0.2;
    if (customer.totalOrders >= 10) confidence += 0.1;
    
    // Recent activity = higher confidence
    const daysSinceLastOrder = (Date.now() - customer.lastOrderDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceLastOrder <= 30) confidence += 0.2;
    
    return Math.min(confidence, 1);
  }

  private async getDefaultSegments(context: RequestContext): Promise<CustomerSegment[]> {
    // Define default customer segments
    const segments = [
      {
        name: 'High Value',
        criteria: [{ field: 'totalSpent', operator: 'greater_than' as const, value: 500 }]
      },
      {
        name: 'Frequent Buyers',
        criteria: [{ field: 'totalOrders', operator: 'greater_than' as const, value: 5 }]
      },
      {
        name: 'At Risk',
        criteria: [{ field: 'daysSinceLastOrder', operator: 'greater_than' as const, value: 60 }]
      }
    ];

    return Promise.all(
      segments.map(segment => this.segmentCustomers(segment.criteria, context))
    );
  }

  private async getSegmentById(segmentId: string, context: RequestContext): Promise<CustomerSegment> {
    // In production, store segments in database
    // For now, return a mock segment
    return {
      id: segmentId,
      name: 'Mock Segment',
      description: 'Mock segment for testing',
      criteria: [],
      customerCount: 0,
      averageValue: 0,
      retentionRate: 0,
      customers: []
    };
  }
}