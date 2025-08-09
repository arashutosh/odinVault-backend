import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../utils/database';
import { CustomError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

export interface RegisterData {
    email: string;
    password: string;
    name?: string;
}

export interface LoginData {
    email: string;
    password: string;
}

export interface AuthResponse {
    user: {
        id: string;
        email: string;
        name?: string;
        avatar?: string;
        emailVerified: boolean;
    };
    token: string;
}

export class AuthService {
    /**
     * Register a new user
     */
    static async register(data: RegisterData): Promise<AuthResponse> {
        try {
            // Check if user already exists
            const existingUser = await prisma.user.findUnique({
                where: { email: data.email }
            });

            if (existingUser) {
                throw new CustomError('User with this email already exists', 409);
            }

            // Hash password
            const saltRounds = 12;
            const hashedPassword = await bcrypt.hash(data.password, saltRounds);

            // Create user
            const user = await prisma.user.create({
                data: {
                    email: data.email,
                    password: hashedPassword,
                    name: data.name || null,
                    emailVerified: false,
                },
                select: {
                    id: true,
                    email: true,
                    name: true,
                    avatar: true,
                    emailVerified: true,
                }
            });

            // Generate JWT token
            const token = this.generateToken(user.id, user.email);

            logger.info(`New user registered: ${user.email}`);

            return {
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name || undefined,
                    avatar: user.avatar || undefined,
                    emailVerified: user.emailVerified,
                },
                token,
            };
        } catch (error) {
            logger.error('Registration failed:', error);
            throw error;
        }
    }

    /**
     * Login user
     */
    static async login(data: LoginData): Promise<AuthResponse> {
        try {
            // Find user by email
            const user = await prisma.user.findUnique({
                where: { email: data.email },
                select: {
                    id: true,
                    email: true,
                    name: true,
                    avatar: true,
                    emailVerified: true,
                    password: true,
                }
            });

            if (!user) {
                throw new CustomError('Invalid email or password', 401);
            }

            // Check if user has a password (not OAuth-only user)
            if (!user.password) {
                throw new CustomError('This account requires Google authentication', 401);
            }

            // Verify password
            const isPasswordValid = await bcrypt.compare(data.password, user.password);
            if (!isPasswordValid) {
                throw new CustomError('Invalid email or password', 401);
            }

            // Generate JWT token
            const token = this.generateToken(user.id, user.email);

            logger.info(`User logged in: ${user.email}`);

            return {
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name || undefined,
                    avatar: user.avatar || undefined,
                    emailVerified: user.emailVerified,
                },
                token,
            };
        } catch (error) {
            logger.error('Login failed:', error);
            throw error;
        }
    }

    /**
     * Generate JWT token
     */
    private static generateToken(userId: string, email: string): string {
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            throw new Error('JWT_SECRET environment variable is not set');
        }

        return jwt.sign(
            {
                id: userId,
                email: email,
            },
            secret,
            {
                expiresIn: process.env.JWT_EXPIRES_IN || '7d',
            } as jwt.SignOptions
        );
    }

    /**
     * Get user profile
     */
    static async getProfile(userId: string) {
        try {
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: {
                    id: true,
                    email: true,
                    name: true,
                    avatar: true,
                    emailVerified: true,
                    createdAt: true,
                    updatedAt: true,
                }
            });

            if (!user) {
                throw new CustomError('User not found', 404);
            }

            return {
                ...user,
                name: user.name || undefined,
                avatar: user.avatar || undefined,
            };
        } catch (error) {
            logger.error('Get profile failed:', error);
            throw error;
        }
    }
}
