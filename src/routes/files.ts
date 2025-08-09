import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { FileService } from '../services/fileService';
import { StorageService } from '../utils/storage';
import { validateRequest, fileSchemas } from '../middleware/validation';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { CustomError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const router = Router();
/**
 * @route GET /api/files
 * @desc List user's files
 * @access Private
 */
router.get('/',
    authenticateToken,
    async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const includeDeleted = (req.query.deleted as string) === 'true';
            const files = await FileService.listFiles(req.user!.id, includeDeleted);
            res.status(200).json({ success: true, data: files });
        } catch (error) {
            next(error);
        }
    }
);


// Configure multer for memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE || '104857600'), // 100MB default
    },
    fileFilter: (req, file, cb) => {
        // Check file type
        const allowedTypes = process.env.ALLOWED_FILE_TYPES?.split(',') || [
            'image/*',
            'video/*',
            'application/pdf',
            'text/*',
            'application/json',
            'application/xml'
        ];

        const isAllowed = allowedTypes.some(type => {
            if (type.endsWith('/*')) {
                return file.mimetype.startsWith(type.slice(0, -2));
            }
            return file.mimetype === type;
        });

        if (isAllowed) {
            cb(null, true);
        } else {
            cb(new CustomError('File type not allowed', 400));
        }
    },
});

/**
 * @route POST /api/files/upload
 * @desc Upload a file
 * @access Private
 */
router.post('/upload',
    authenticateToken,
    upload.single('file'),
    validateRequest(fileSchemas.upload),
    async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            if (!req.file) {
                throw new CustomError('No file uploaded', 400);
            }

            const { folder, tags, name } = req.body;

            // Debug log for incoming file
            logger.info('Uploading file', {
                name: req.file.originalname,
                size: req.file.size,
                mimetype: req.file.mimetype,
                userId: req.user!.id,
            });

            const result = await FileService.uploadFile({
                originalname: req.file.originalname,
                buffer: req.file.buffer,
                mimetype: req.file.mimetype,
                size: req.file.size,
                name: name || undefined,
                folder: folder || undefined,
                tags: tags ? JSON.parse(tags) : undefined,
                userId: req.user!.id,
            });

            res.status(201).json({
                success: true,
                data: result,
            });
        } catch (error: any) {
            logger.error('Upload failed', {
                error: error?.message || String(error),
                stack: error?.stack,
            });
            next(error);
        }
    }
);

/**
 * @route GET /api/files/search
 * @desc Search files
 * @access Private
 */
router.get('/search',
    authenticateToken,
    validateRequest(fileSchemas.search),
    async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const { q, type, tags, folder, page, limit } = req.query;

            const result = await FileService.searchFiles({
                userId: req.user!.id,
                query: q as string | undefined,
                type: type as string | undefined,
                tags: tags ? (tags as string).split(',') : undefined,
                folder: folder as string | undefined,
                page: page ? parseInt(page as string) : undefined,
                limit: limit ? parseInt(limit as string) : undefined,
            });

            res.status(200).json({
                success: true,
                data: result,
            });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @route GET /api/files/:id
 * @desc Get file details
 * @access Private
 */
router.get('/:id',
    authenticateToken,
    async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;

            if (!id) {
                throw new CustomError('File ID is required', 400);
            }

            const result = await FileService.getFileById(id, req.user!.id);

            res.status(200).json({
                success: true,
                data: result,
            });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @route GET /api/files/:id/download
 * @desc Get file download URL
 * @access Private
 */
router.get('/:id/download',
    authenticateToken,
    async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;

            if (!id) {
                throw new CustomError('File ID is required', 400);
            }

            const includeDeleted = (req.query.deleted as string) === 'true';
            const downloadUrl = await FileService.getDownloadUrl(id, req.user!.id, includeDeleted);

            res.status(200).json({
                success: true,
                data: {
                    downloadUrl,
                    expiresIn: 3600, // 1 hour
                },
            });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @route GET /api/files/:id/preview
 * @desc Get file preview URL
 * @access Private
 */
router.get('/:id/preview',
    authenticateToken,
    async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;

            if (!id) {
                throw new CustomError('File ID is required', 400);
            }

            const includeDeleted = (req.query.deleted as string) === 'true';
            const previewUrl = await FileService.getPreviewUrl(id, req.user!.id, includeDeleted);

            res.status(200).json({
                success: true,
                data: {
                    previewUrl,
                    hasPreview: !!previewUrl,
                },
            });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @route DELETE /api/files/:id
 * @desc Delete file (soft delete)
 * @access Private
 */
router.delete('/:id',
    authenticateToken,
    async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;

            if (!id) {
                throw new CustomError('File ID is required', 400);
            }

            await FileService.deleteFile(id, req.user!.id);

            res.status(200).json({
                success: true,
                message: 'File deleted successfully',
            });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @route PATCH /api/files/:id/restore
 * @desc Restore soft-deleted file
 * @access Private
 */
router.patch('/:id/restore',
    authenticateToken,
    async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;

            if (!id) {
                throw new CustomError('File ID is required', 400);
            }

            await FileService.restoreFile(id, req.user!.id);

            res.status(200).json({
                success: true,
                message: 'File restored successfully',
            });
        } catch (error) {
            next(error);
        }
    }
);

export { router as fileRoutes };

/**
 * @route GET /api/files/storage/health
 * @desc Check storage connectivity
 * @access Private
 */
router.get('/storage/health', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const status = await StorageService.checkHealth();
        res.status(status.ok ? 200 : 500).json({ success: status.ok, data: status });
    } catch (error) {
        next(error);
    }
});

/**
 * @route POST /api/files/trash/hide
 * @desc Hide selected deleted files from Trash
 * @access Private
 */
router.post('/trash/hide',
    authenticateToken,
    async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const { fileIds } = req.body as { fileIds?: string[] };
            if (!Array.isArray(fileIds) || fileIds.length === 0) {
                throw new CustomError('fileIds array is required', 400);
            }

            const count = await FileService.hideDeletedFiles(req.user!.id, fileIds);
            res.status(200).json({ success: true, data: { hidden: count } });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @route POST /api/files/trash/delete
 * @desc Permanently delete selected trashed files (DB + S3)
 * @access Private
 */
router.post('/trash/delete',
    authenticateToken,
    async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const { fileIds } = req.body as { fileIds?: string[] };
            if (!Array.isArray(fileIds) || fileIds.length === 0) {
                throw new CustomError('fileIds array is required', 400);
            }

            const count = await FileService.permanentlyDeleteFiles(req.user!.id, fileIds);
            res.status(200).json({ success: true, data: { deleted: count } });
        } catch (error) {
            next(error);
        }
    }
);
