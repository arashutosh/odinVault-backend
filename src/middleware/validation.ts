import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import { CustomError } from './errorHandler';

export const validateRequest = (schema: z.ZodSchema) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        try {
            schema.parse({
                body: req.body,
                query: req.query,
                params: req.params,
            });
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                const validationErrors = error.errors.map(err => ({
                    field: err.path.join('.'),
                    message: err.message,
                }));

                next(new CustomError('Validation failed', 400));
            } else {
                next(error);
            }
        }
    };
};

// Common validation schemas
export const authSchemas = {
    register: z.object({
        body: z.object({
            email: z.string().email('Invalid email format'),
            password: z.string().min(6, 'Password must be at least 6 characters'),
            name: z.string().optional(),
        }),
    }),

    login: z.object({
        body: z.object({
            email: z.string().email('Invalid email format'),
            password: z.string().min(1, 'Password is required'),
        }),
    }),

    googleAuth: z.object({
        body: z.object({
            idToken: z.string().min(1, 'Google ID token is required'),
        }),
    }),
};

export const fileSchemas = {
    upload: z.object({
        body: z.object({
            name: z.string().min(1).max(255).optional(),
            folder: z.string().optional(),
            tags: z.array(z.string()).optional(),
        }),
    }),

    search: z.object({
        query: z.object({
            q: z.string().optional(),
            type: z.string().optional(),
            tags: z.string().optional(),
            folder: z.string().optional(),
            page: z.string().transform(Number).pipe(z.number().min(1)).optional(),
            limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).optional(),
        }),
    }),

    share: z.object({
        body: z.object({
            expiresAt: z.string().datetime().optional(),
        }),
        params: z.object({
            id: z.string().min(1, 'File ID is required'),
        }),
    }),
};
