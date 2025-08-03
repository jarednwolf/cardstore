import { PrismaClient } from '@prisma/client';

// Simple console logger for database.ts to avoid circular imports
const dbLogger = {
  debug: (message: string, data?: any) => console.log(`[DEBUG] ${message}`, data || ''),
  info: (message: string, data?: any) => console.log(`[INFO] ${message}`, data || ''),
  warn: (message: string, data?: any) => console.warn(`[WARN] ${message}`, data || ''),
  error: (message: string, data?: any) => console.error(`[ERROR] ${message}`, data || ''),
};

// Prisma Client singleton
let prisma: PrismaClient;

declare global {
  var __prisma: PrismaClient | undefined;
}

if (process.env['NODE_ENV'] === 'production') {
  prisma = new PrismaClient({
    log: [
      { level: 'query', emit: 'event' },
      { level: 'error', emit: 'event' },
      { level: 'info', emit: 'event' },
      { level: 'warn', emit: 'event' },
    ],
  });
} else {
  if (!global.__prisma) {
    global.__prisma = new PrismaClient({
      log: [
        { level: 'query', emit: 'event' },
        { level: 'error', emit: 'event' },
        { level: 'info', emit: 'event' },
        { level: 'warn', emit: 'event' },
      ],
    });
  }
  prisma = global.__prisma;
}

// Log database queries in development
if (process.env['NODE_ENV'] !== 'production') {
  try {
    (prisma as any).$on('query', (e: any) => {
      dbLogger.debug('Database Query', {
        query: e.query,
        params: e.params,
        duration: `${e.duration}ms`,
      });
    });
  } catch (error) {
    // Ignore if event logging is not available
  }
}

try {
  (prisma as any).$on('error', (e: any) => {
    dbLogger.error('Database Error', { error: e });
  });

  (prisma as any).$on('info', (e: any) => {
    dbLogger.info('Database Info', { message: e.message });
  });

  (prisma as any).$on('warn', (e: any) => {
    dbLogger.warn('Database Warning', { message: e.message });
  });
} catch (error) {
  // Ignore if event logging is not available
}

// Test database connection with graceful handling
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    dbLogger.info('Database connection successful');
    return true;
  } catch (error: any) {
    if (error.code === 'P1010') {
      dbLogger.warn('Database does not exist - this is expected during initial setup');
      return false;
    }
    dbLogger.error('Database connection failed', { error: error.message });
    return false;
  }
}

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

export { prisma };
export default prisma;