import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { CustomError } from './errorHandler';
import { prisma } from '../utils/database';

export interface AuthRequest extends Request {
    user?: {
        id: string;
        email: string;
        name?: string | null;
        avatar?: string | null;
        emailVerified: boolean;
    };
}

export const authenticateToken = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            throw new CustomError('Access token required', 401);
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
            id: string;
            email: string;
        };

        // Verify user still exists in database
        const user = await prisma.user.findUnique({
            where: { id: decoded.id },
            select: {
                id: true,
                email: true,
                name: true,
                avatar: true,
                emailVerified: true
            }
        });

        if (!user) {
            throw new CustomError('User not found', 401);
        }

        req.user = user;
        next();
    } catch (error) {
        if (error instanceof jwt.JsonWebTokenError) {
            next(new CustomError('Invalid token', 401));
        } else if (error instanceof jwt.TokenExpiredError) {
            next(new CustomError('Token expired', 401));
        } else {
            next(error);
        }
    }
};

export const optionalAuth = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];

        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
                id: string;
                email: string;
            };

            const user = await prisma.user.findUnique({
                where: { id: decoded.id },
                select: {
                    id: true,
                    email: true,
                    name: true,
                    avatar: true,
                    emailVerified: true
                }
            });

            if (user) {
                req.user = user;
            }
        }

        next();
    } catch (error) {
        // Continue without authentication for optional routes
        next();
    }
};
