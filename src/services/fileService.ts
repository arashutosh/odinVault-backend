import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import { StorageService } from '../utils/storage';
import { PreviewService } from '../utils/preview';
import { prisma } from '../utils/database';
import { CustomError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import mime from 'mime-types';

export interface FileUploadData {
    originalname: string;
    buffer: Buffer;
    mimetype: string;
    size: number;
    name?: string; // desired storage/display name
    folder?: string;
    tags?: string[];
    userId: string;
}

export interface FileSearchParams {
    userId: string;
    query?: string;
    type?: string;
    tags?: string[];
    folder?: string;
    page?: number;
    limit?: number;
}

export interface FileResponse {
    id: string;
    name: string;
    originalName: string;
    size: number;
    mimeType: string;
    storageKey: string;
    previewKey?: string;
    tags: string[];
    folder?: string;
    createdAt: Date;
    updatedAt: Date;
}

export class FileService {
    /**
     * Upload a file
     */
    static async uploadFile(data: FileUploadData): Promise<FileResponse> {
        try {
            // Generate storage key under /{userId}/{image|video|files}/...
            const fileId = uuidv4();
            const extension = mime.extension(data.mimetype) || '';
            const category = data.mimetype.startsWith('image/')
                ? 'image'
                : data.mimetype.startsWith('video/')
                    ? 'video'
                    : 'files';

            // Determine base name to use: provided name or original file name without path
            const providedName = (data.name || data.originalname || '').trim();
            // Ensure extension is present and normalized
            const sanitizedBase = providedName
                ? providedName.replace(/\s+/g, ' ').replace(/[\\/]/g, '-')
                : (data.originalname || `file-${fileId}`);

            const hasExt = /\.[A-Za-z0-9]{1,10}$/.test(sanitizedBase);
            const finalName = hasExt
                ? sanitizedBase
                : (extension ? `${sanitizedBase}.${extension}` : sanitizedBase);

            const storageKey = `${data.userId}/${category}/${finalName}`;

            // Check for name conflict
            const exists = await StorageService.fileExists(storageKey).catch(() => false);
            if (exists) {
                throw new CustomError('A file with this name already exists', 409);
            }

            // Upload file to storage
            await StorageService.uploadFile(
                data.buffer,
                storageKey,
                data.mimetype,
                {
                    originalName: data.originalname,
                    uploadedBy: data.userId,
                    uploadedAt: new Date().toISOString(),
                }
            );

            // Generate preview if supported
            let previewKey: string | undefined;
            const previewBuffer = await PreviewService.generatePreview(
                data.buffer,
                data.mimetype
            );

            if (previewBuffer) {
                previewKey = await PreviewService.uploadPreview(
                    previewBuffer,
                    storageKey,
                    data.mimetype
                );
            }

            // Save file metadata to database
            const file = await prisma.file.create({
                data: {
                    name: finalName,
                    originalName: data.originalname,
                    size: data.size,
                    mimeType: data.mimetype,
                    storageKey,
                    previewKey: previewKey || null,
                    tags: data.tags || [],
                    folder: data.folder || null,
                    ownerId: data.userId,
                },
            });

            logger.info(`File uploaded successfully: ${file.id} by user ${data.userId}`);

            return this.mapFileToResponse(file);
        } catch (error) {
            logger.error('File upload failed:', error);
            throw error;
        }
    }

    /**
     * Get file by ID
     */
    static async getFileById(fileId: string, userId: string, includeDeleted: boolean = false): Promise<FileResponse> {
        try {
            const file = await prisma.file.findFirst({
                where: {
                    id: fileId,
                    ownerId: userId,
                    ...(includeDeleted ? {} : { isDeleted: false }),
                },
            });

            if (!file) {
                throw new CustomError('File not found', 404);
            }

            return this.mapFileToResponse(file);
        } catch (error) {
            logger.error('Get file failed:', error);
            throw error;
        }
    }

    /**
     * List files for a user, optionally including deleted items
     */
    static async listFiles(userId: string, includeDeleted: boolean = false): Promise<FileResponse[]> {
        try {
            const where: any = {
                ownerId: userId,
                isDeleted: includeDeleted ? true : false,
            };

            // When showing trash, exclude hidden-from-trash items but include null folders explicitly
            if (includeDeleted) {
                where.AND = [
                    {
                        OR: [
                            { folder: null },
                            { folder: { not: '__hidden_trash' } },
                        ],
                    },
                ];
            }

            const files = await prisma.file.findMany({
                where,
                orderBy: { createdAt: 'desc' },
            });

            return files.map(this.mapFileToResponse);
        } catch (error) {
            logger.error('List files failed:', error);
            throw error;
        }
    }

    /**
     * Hide soft-deleted files from trash (kept in DB but not visible)
     */
    static async hideDeletedFiles(userId: string, fileIds: string[]): Promise<number> {
        try {
            const result = await prisma.file.updateMany({
                where: {
                    ownerId: userId,
                    id: { in: fileIds },
                    isDeleted: true,
                },
                data: {
                    folder: '__hidden_trash',
                },
            });

            logger.info(`Hidden ${result.count} deleted files for user ${userId}`);
            return result.count;
        } catch (error) {
            logger.error('Hide deleted files failed:', error);
            throw error;
        }
    }

    /**
     * Search files
     */
    static async searchFiles(params: FileSearchParams): Promise<{
        files: FileResponse[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }> {
        try {
            const page = params.page || 1;
            const limit = params.limit || 20;
            const skip = (page - 1) * limit;

            // Build search conditions
            const where: any = {
                ownerId: params.userId,
                isDeleted: false,
            };

            if (params.query) {
                where.OR = [
                    { originalName: { contains: params.query, mode: 'insensitive' } },
                    { tags: { hasSome: [params.query] } },
                ];
            }

            if (params.type) {
                where.mimeType = { startsWith: params.type };
            }

            if (params.tags && params.tags.length > 0) {
                where.tags = { hasSome: params.tags };
            }

            if (params.folder) {
                where.folder = params.folder;
            }

            // Get files with pagination
            const [files, total] = await Promise.all([
                prisma.file.findMany({
                    where,
                    skip,
                    take: limit,
                    orderBy: { createdAt: 'desc' },
                }),
                prisma.file.count({ where }),
            ]);

            const totalPages = Math.ceil(total / limit);

            return {
                files: files.map(this.mapFileToResponse),
                total,
                page,
                limit,
                totalPages,
            };
        } catch (error) {
            logger.error('File search failed:', error);
            throw error;
        }
    }

    /**
     * Delete file (soft delete)
     */
    static async deleteFile(fileId: string, userId: string): Promise<void> {
        try {
            const file = await prisma.file.findFirst({
                where: {
                    id: fileId,
                    ownerId: userId,
                    isDeleted: false,
                },
            });

            if (!file) {
                throw new CustomError('File not found', 404);
            }

            await prisma.file.update({
                where: { id: fileId },
                data: {
                    isDeleted: true,
                    deletedAt: new Date(),
                },
            });

            logger.info(`File soft deleted: ${fileId} by user ${userId}`);
        } catch (error) {
            logger.error('File deletion failed:', error);
            throw error;
        }
    }

    /**
     * Permanently delete files from trash (DB + S3)
     */
    static async permanentlyDeleteFiles(userId: string, fileIds: string[]): Promise<number> {
        try {
            if (!Array.isArray(fileIds) || fileIds.length === 0) {
                throw new CustomError('fileIds array is required', 400);
            }

            // Fetch files to delete (must be soft-deleted and belong to user)
            const files = await prisma.file.findMany({
                where: {
                    ownerId: userId,
                    id: { in: fileIds },
                    isDeleted: true,
                },
            });

            // Delete from storage (ignore missing objects)
            for (const f of files) {
                try {
                    await StorageService.deleteFile(f.storageKey);
                } catch { }
                if (f.previewKey) {
                    try { await StorageService.deleteFile(f.previewKey); } catch { }
                }
            }

            // Remove DB records
            const result = await prisma.file.deleteMany({
                where: {
                    ownerId: userId,
                    id: { in: files.map(f => f.id) },
                    isDeleted: true,
                },
            });

            logger.info(`Permanently deleted ${result.count} files for user ${userId}`);
            return result.count;
        } catch (error) {
            logger.error('Permanent delete failed:', error);
            throw error;
        }
    }
    /**
     * Restore file (from soft delete)
     */
    static async restoreFile(fileId: string, userId: string): Promise<void> {
        try {
            const file = await prisma.file.findFirst({
                where: {
                    id: fileId,
                    ownerId: userId,
                    isDeleted: true,
                },
            });

            if (!file) {
                throw new CustomError('File not found in trash', 404);
            }

            await prisma.file.update({
                where: { id: fileId },
                data: {
                    isDeleted: false,
                    deletedAt: null,
                },
            });

            logger.info(`File restored: ${fileId} by user ${userId}`);
        } catch (error) {
            logger.error('File restore failed:', error);
            throw error;
        }
    }

    /**
     * Get download URL
     */
    static async getDownloadUrl(fileId: string, userId: string, includeDeleted: boolean = false): Promise<string> {
        try {
            const file = await this.getFileById(fileId, userId, includeDeleted);
            const signedUrl = await StorageService.getSignedDownloadUrl(file.storageKey);
            return signedUrl.url;
        } catch (error) {
            logger.error('Get download URL failed:', error);
            throw error;
        }
    }

    /**
     * Get preview URL
     */
    static async getPreviewUrl(fileId: string, userId: string, includeDeleted: boolean = false): Promise<string | null> {
        try {
            const file = await this.getFileById(fileId, userId, includeDeleted);

            if (!file.previewKey) {
                return null;
            }

            const signedUrl = await StorageService.getSignedDownloadUrl(file.previewKey);
            return signedUrl.url;
        } catch (error) {
            logger.error('Get preview URL failed:', error);
            throw error;
        }
    }

    /**
     * Map database file to response format
     */
    private static mapFileToResponse(file: any): FileResponse {
        return {
            id: file.id,
            name: file.name,
            originalName: file.originalName,
            size: file.size,
            mimeType: file.mimeType,
            storageKey: file.storageKey,
            previewKey: file.previewKey || undefined,
            tags: file.tags,
            folder: file.folder || undefined,
            createdAt: file.createdAt,
            updatedAt: file.updatedAt,
        };
    }
}
