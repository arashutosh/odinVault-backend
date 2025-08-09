import winston from 'winston';
import fs from 'fs';
import path from 'path';

const logLevel = process.env.NODE_ENV === 'production' ? 'info' : 'debug';

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
    try {
        fs.mkdirSync(logsDir, { recursive: true });
    } catch (error) {
        console.warn('Could not create logs directory:', error);
    }
}

export const logger = winston.createLogger({
    level: logLevel,
    format: winston.format.combine(
        winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'odin-vault-backend' },
    transports: [
        // Only add file transports if logs directory exists and is writable
        ...(fs.existsSync(logsDir) ? [
            new winston.transports.File({
                filename: path.join(logsDir, 'error.log'),
                level: 'error'
            }),
            new winston.transports.File({
                filename: path.join(logsDir, 'combined.log')
            })
        ] : [])
    ]
});

// If we're not in production, log to the console as well
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
        )
    }));
}

// Handle uncaught exceptions
logger.exceptions.handle(
    new winston.transports.File({
        filename: path.join(logsDir, 'exceptions.log')
    })
);

// Handle unhandled promise rejections
logger.rejections.handle(
    new winston.transports.File({
        filename: path.join(logsDir, 'rejections.log')
    })
);
