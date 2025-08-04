import { PrismaClient } from '@prisma/client';
import { logger } from '../config/logger';

/**
 * Get the currency setting for a tenant
 */
export async function getTenantCurrency(prisma: PrismaClient, tenantId: string): Promise<string> {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true }
    });

    if (!tenant?.settings) {
      return 'USD'; // Default fallback
    }

    const settings = JSON.parse(tenant.settings);
    return settings.currency || settings.billing?.currency || 'USD';
  } catch (error) {
    logger.warn('Failed to get tenant currency, using USD default', { 
      tenantId, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    return 'USD';
  }
}

/**
 * Get currency from tenant settings object (when already parsed)
 */
export function getCurrencyFromSettings(settings: any): string {
  if (!settings) return 'USD';
  return settings.currency || settings.billing?.currency || 'USD';
}