import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../utils/database';
import { CustomError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

export interface CreateShareData {
    fileId: string;
    userId: string;
    expiresAt?: Date;
}

export interface ShareResponse {
    id: string;
    token: string;
    expiresAt: Date;
    isActive: boolean;
    createdAt: Date;
    file: {
        id: string;
        originalName: string;
        size: number;
        mimeType: string;
    };
}

export class ShareService {
    /**
     * Create a share link for a file
     */
    static async createShare(data: CreateShareData): Promise<ShareResponse> {
        try {
            // Verify file exists and user owns it
            const file = await prisma.file.findFirst({
                where: {
                    id: data.fileId,
                    ownerId: data.userId,
                    isDeleted: false,
                },
            });

            if (!file) {
                throw new CustomError('File not found', 404);
            }

            // Generate unique token
            const token = uuidv4();

            // Set expiry date (default 7 days)
            const expiresAt = data.expiresAt || new Date(
                Date.now() + (parseInt(process.env.DEFAULT_SHARE_EXPIRY_DAYS || '7') * 24 * 60 * 60 * 1000)
            );

            // Create share record
            const share = await prisma.share.create({
                data: {
                    token,
                    expiresAt,
                    fileId: data.fileId,
                    createdById: data.userId,
                },
                include: {
                    file: {
                        select: {
                            id: true,
                            originalName: true,
                            size: true,
                            mimeType: true,
                        },
                    },
                },
            });

            logger.info(`Share created for file ${data.fileId} by user ${data.userId}`);

            return this.mapShareToResponse(share);
        } catch (error) {
            logger.error('Create share failed:', error);
            throw error;
        }
    }

    /**
     * Get file by share token
     */
    static async getFileByToken(token: string): Promise<{
        file: any;
        share: any;
    }> {
        try {
            const share = await prisma.share.findFirst({
                where: {
                    token,
                    isActive: true,
                    expiresAt: {
                        gt: new Date(),
                    },
                },
            });

            if (!share) {
                throw new CustomError('Share link not found or expired', 404);
            }

            // Get the associated file
            const file = await prisma.file.findFirst({
                where: {
                    id: share.fileId,
                    isDeleted: false,
                },
            });

            if (!file) {
                throw new CustomError('File not found or has been deleted', 404);
            }

            return {
                file,
                share,
            };
        } catch (error) {
            logger.error('Get file by token failed:', error);
            throw error;
        }
    }

    /**
     * Get user's shares
     */
    static async getUserShares(userId: string): Promise<ShareResponse[]> {
        try {
            const shares = await prisma.share.findMany({
                where: {
                    createdById: userId,
                },
                include: {
                    file: {
                        select: {
                            id: true,
                            originalName: true,
                            size: true,
                            mimeType: true,
                        },
                    },
                },
                orderBy: {
                    createdAt: 'desc',
                },
            });

            return shares.map(this.mapShareToResponse);
        } catch (error) {
            logger.error('Get user shares failed:', error);
            throw error;
        }
    }

    /**
     * Deactivate a share
     */
    static async deactivateShare(shareId: string, userId: string): Promise<void> {
        try {
            const share = await prisma.share.findFirst({
                where: {
                    id: shareId,
                    createdById: userId,
                },
            });

            if (!share) {
                throw new CustomError('Share not found', 404);
            }

            await prisma.share.update({
                where: { id: shareId },
                data: { isActive: false },
            });

            logger.info(`Share deactivated: ${shareId} by user ${userId}`);
        } catch (error) {
            logger.error('Deactivate share failed:', error);
            throw error;
        }
    }

    /**
     * Clean up expired shares
     */
    static async cleanupExpiredShares(): Promise<number> {
        try {
            const result = await prisma.share.updateMany({
                where: {
                    expiresAt: {
                        lt: new Date(),
                    },
                    isActive: true,
                },
                data: {
                    isActive: false,
                },
            });

            logger.info(`Cleaned up ${result.count} expired shares`);
            return result.count;
        } catch (error) {
            logger.error('Cleanup expired shares failed:', error);
            throw error;
        }
    }

    /**
     * Map database share to response format
     */
    private static mapShareToResponse(share: any): ShareResponse {
        return {
            id: share.id,
            token: share.token,
            expiresAt: share.expiresAt,
            isActive: share.isActive,
            createdAt: share.createdAt,
            file: share.file,
        };
    }
}
