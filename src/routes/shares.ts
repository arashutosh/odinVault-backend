import { Router, Request, Response, NextFunction } from 'express';
import { ShareService } from '../services/shareService';
import { validateRequest, fileSchemas } from '../middleware/validation';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { StorageService } from '../utils/storage';

const router = Router();

/**
 * @route POST /api/shares/:id
 * @desc Create a share link for a file
 * @access Private
 */
router.post('/:id',
    authenticateToken,
    validateRequest(fileSchemas.share),
    async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;
            const { expiresAt } = req.body;

            if (!id) {
                throw new Error('File ID is required');
            }

            const result = await ShareService.createShare({
                fileId: id,
                userId: req.user!.id,
                expiresAt: expiresAt ? new Date(expiresAt) : undefined,
            });

            res.status(201).json({
                success: true,
                data: result,
            });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @route GET /api/shares
 * @desc Get user's shares
 * @access Private
 */
router.get('/',
    authenticateToken,
    async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const result = await ShareService.getUserShares(req.user!.id);

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
 * @route GET /api/shares/:token
 * @desc Access shared file
 * @access Public
 */
router.get('/:token',
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { token } = req.params;

            if (!token) {
                throw new Error('Share token is required');
            }

            const { file, share } = await ShareService.getFileByToken(token);

            // Generate download URL
            const downloadUrl = await StorageService.getSignedDownloadUrl(file.storageKey);

            res.status(200).json({
                success: true,
                data: {
                    file: {
                        id: file.id,
                        originalName: file.originalName,
                        size: file.size,
                        mimeType: file.mimeType,
                    },
                    downloadUrl: downloadUrl.url,
                    expiresAt: share.expiresAt,
                },
            });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @route DELETE /api/shares/:id
 * @desc Deactivate a share
 * @access Private
 */
router.delete('/:id',
    authenticateToken,
    async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;

            if (!id) {
                throw new Error('Share ID is required');
            }

            await ShareService.deactivateShare(id, req.user!.id);

            res.status(200).json({
                success: true,
                message: 'Share deactivated successfully',
            });
        } catch (error) {
            next(error);
        }
    }
);

export { router as shareRoutes };
