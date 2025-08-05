import winston from 'winston';

const logLevel = process.env['LOG_LEVEL'] || 'info';
const logFormat = process.env['LOG_FORMAT'] || 'json';

// Define log format
const customFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let metaStr = '';
    if (Object.keys(meta).length > 0) {
      metaStr = '\n' + JSON.stringify(meta, null, 2);
    }
    return `${timestamp} [${level}]: ${message}${metaStr}`;
  })
);

// Create logger instance
export const logger = winston.createLogger({
  level: logLevel,
  format: logFormat === 'json' ? customFormat : consoleFormat,
  defaultMeta: {
    service: 'deckstack',
    environment: process.env['NODE_ENV'] || 'development',
  },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: logFormat === 'json' ? customFormat : consoleFormat,
    }),
  ],
});

// Add file transport in production
if (process.env['NODE_ENV'] === 'production') {
  logger.add(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: customFormat,
    })
  );
  
  logger.add(
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: customFormat,
    })
  );
}

// Create a stream object for Morgan HTTP logging
export const loggerStream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};

export default logger;