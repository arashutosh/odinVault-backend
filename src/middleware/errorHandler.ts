import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export interface AppError extends Error {
    statusCode?: number;
    isOperational?: boolean;
}

export class CustomError extends Error implements AppError {
    public statusCode: number;
    public isOperational: boolean;

    constructor(message: string, statusCode: number = 500) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

export const errorHandler = (
    error: AppError,
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    let { statusCode = 500, message } = error;

    logger.error('Error occurred:', {
        error: error.message,
        url: req.url,
        method: req.method,
    });

    if (process.env.NODE_ENV === 'production' && statusCode === 500) {
        message = 'Internal server error';
    }

    res.status(statusCode).json({
        error: {
            message,
            statusCode,
        },
    });
};

export const notFoundHandler = (req: Request, res: Response): void => {
    res.status(404).json({
        error: {
            message: 'Route not found',
            statusCode: 404,
            path: req.originalUrl,
        },
    });
};
