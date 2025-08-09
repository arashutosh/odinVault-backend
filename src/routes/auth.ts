import { Router, Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/authService';
import { GoogleAuthService } from '../services/googleAuthService';
import { validateRequest, authSchemas } from '../middleware/validation';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

/**
 * @route POST /api/auth/register
 * @desc Register a new user
 * @access Public
 */
router.post('/register',
    validateRequest(authSchemas.register),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { email, password, name } = req.body;

            const result = await AuthService.register({
                email,
                password,
                name,
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
 * @route POST /api/auth/login
 * @desc Login user
 * @access Public
 */
router.post('/login',
    validateRequest(authSchemas.login),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { email, password } = req.body;

            const result = await AuthService.login({
                email,
                password,
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
 * @route POST /api/auth/google
 * @desc Authenticate with Google
 * @access Public
 */
router.post('/google',
    validateRequest(authSchemas.googleAuth),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { idToken } = req.body;

            const result = await GoogleAuthService.authenticateWithGoogle(idToken);

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
 * @route GET /api/auth/google/url
 * @desc Get Google OAuth URL
 * @access Public
 */
router.get('/google/url',
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const authUrl = GoogleAuthService.getGoogleAuthUrl();

            res.status(200).json({
                success: true,
                data: {
                    authUrl,
                },
            });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @route GET /api/auth/profile
 * @desc Get user profile
 * @access Private
 */
router.get('/profile',
    authenticateToken,
    async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const profile = await AuthService.getProfile(req.user!.id);

            res.status(200).json({
                success: true,
                data: profile,
            });
        } catch (error) {
            next(error);
        }
    }
);

export { router as authRoutes };
