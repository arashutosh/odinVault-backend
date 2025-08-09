import { OAuth2Client } from 'google-auth-library';
import { prisma } from '../utils/database';
import { CustomError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import jwt from 'jsonwebtoken';

export interface GoogleUserInfo {
    id: string;
    email: string;
    name: string;
    picture: string;
    verified_email: boolean;
}

export interface GoogleAuthResponse {
    user: {
        id: string;
        email: string;
        name?: string;
        avatar?: string;
        emailVerified: boolean;
    };
    token: string;
}

export class GoogleAuthService {
    private static client = new OAuth2Client(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET
    );

    /**
     * Verify Google ID token
     */
    static async verifyIdToken(idToken: string): Promise<GoogleUserInfo> {
        try {
            const ticket = await this.client.verifyIdToken({
                idToken,
                audience: process.env.GOOGLE_CLIENT_ID,
            });

            const payload = ticket.getPayload();
            if (!payload) {
                throw new CustomError('Invalid Google token', 401);
            }

            return {
                id: payload.sub,
                email: payload.email!,
                name: payload.name!,
                picture: payload.picture!,
                verified_email: payload.email_verified!,
            };
        } catch (error) {
            logger.error('Google token verification failed:', error);
            throw new CustomError('Invalid Google token', 401);
        }
    }

    /**
     * Authenticate or create user with Google
     */
    static async authenticateWithGoogle(idToken: string): Promise<GoogleAuthResponse> {
        try {
            const googleUser = await this.verifyIdToken(idToken);

            // Check if user exists by Google ID
            let user = await prisma.user.findUnique({
                where: { googleId: googleUser.id },
                select: {
                    id: true,
                    email: true,
                    name: true,
                    avatar: true,
                    emailVerified: true,
                },
            });

            if (!user) {
                // Check if user exists by email
                user = await prisma.user.findUnique({
                    where: { email: googleUser.email },
                    select: {
                        id: true,
                        email: true,
                        name: true,
                        avatar: true,
                        emailVerified: true,
                    },
                });

                if (user) {
                    // Link existing account with Google
                    await prisma.user.update({
                        where: { id: user.id },
                        data: {
                            googleId: googleUser.id,
                            googleEmail: googleUser.email,
                            avatar: googleUser.picture,
                            emailVerified: googleUser.verified_email,
                            name: googleUser.name,
                        },
                    });

                    // Update user object with new data
                    user = {
                        ...user,
                        avatar: googleUser.picture,
                        emailVerified: googleUser.verified_email,
                        name: googleUser.name,
                    };
                } else {
                    // Create new user
                    user = await prisma.user.create({
                        data: {
                            email: googleUser.email,
                            name: googleUser.name,
                            googleId: googleUser.id,
                            googleEmail: googleUser.email,
                            avatar: googleUser.picture,
                            emailVerified: googleUser.verified_email,
                        },
                        select: {
                            id: true,
                            email: true,
                            name: true,
                            avatar: true,
                            emailVerified: true,
                        },
                    });

                    logger.info(`New Google user created: ${user.email}`);
                }
            } else {
                // Update existing Google user info
                await prisma.user.update({
                    where: { id: user.id },
                    data: {
                        name: googleUser.name,
                        avatar: googleUser.picture,
                        emailVerified: googleUser.verified_email,
                    },
                });

                // Update user object
                user = {
                    ...user,
                    name: googleUser.name,
                    avatar: googleUser.picture,
                    emailVerified: googleUser.verified_email,
                };
            }

            // Generate JWT token
            const token = this.generateToken(user.id, user.email);

            logger.info(`Google user authenticated: ${user.email}`);

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
            logger.error('Google authentication failed:', error);
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
     * Get Google OAuth URL for frontend
     */
    static getGoogleAuthUrl(): string {
        const clientId = process.env.GOOGLE_CLIENT_ID;
        const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback';

        if (!clientId) {
            throw new Error('GOOGLE_CLIENT_ID environment variable is not set');
        }

        const scopes = [
            'https://www.googleapis.com/auth/userinfo.profile',
            'https://www.googleapis.com/auth/userinfo.email',
        ];

        return `https://accounts.google.com/o/oauth2/v2/auth?` +
            `client_id=${clientId}&` +
            `redirect_uri=${encodeURIComponent(redirectUri)}&` +
            `response_type=code&` +
            `scope=${encodeURIComponent(scopes.join(' '))}&` +
            `access_type=offline&` +
            `prompt=consent`;
    }
}
