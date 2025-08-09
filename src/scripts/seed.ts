import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

async function main() {
    logger.info('🌱 Starting database seeding...');

    // Create test users
    const testUsers = [
        {
            email: 'admin@odinvault.com',
            password: 'admin123456',
            name: 'Admin User',
        },
        {
            email: 'user@odinvault.com',
            password: 'user123456',
            name: 'Test User',
        },
        {
            email: 'googleuser@odinvault.com',
            name: 'Google Test User',
            googleId: 'google-test-id-123',
            googleEmail: 'googleuser@odinvault.com',
            avatar: 'https://via.placeholder.com/150',
            emailVerified: true,
        },
    ];

    for (const userData of testUsers) {
        const existingUser = await prisma.user.findUnique({
            where: { email: userData.email },
        });

        if (!existingUser) {
            if (userData.password) {
                const hashedPassword = await bcrypt.hash(userData.password, 12);

                await prisma.user.create({
                    data: {
                        email: userData.email,
                        password: hashedPassword,
                        name: userData.name,
                        emailVerified: false,
                    },
                });
            } else {
                // Google OAuth user
                await prisma.user.create({
                    data: {
                        email: userData.email,
                        name: userData.name,
                        googleId: userData.googleId,
                        googleEmail: userData.googleEmail,
                        avatar: userData.avatar,
                        emailVerified: userData.emailVerified,
                    },
                });
            }

            logger.info(`✅ Created user: ${userData.email}`);
        } else {
            logger.info(`⏭️  User already exists: ${userData.email}`);
        }
    }

    // Create test files (metadata only - no actual files)
    const adminUser = await prisma.user.findUnique({
        where: { email: 'admin@odinvault.com' },
    });

    if (adminUser) {
        const testFiles = [
            {
                name: 'sample-document.pdf',
                originalName: 'sample-document.pdf',
                size: 1024000,
                mimeType: 'application/pdf',
                storageKey: 'files/test/sample-document.pdf',
                tags: ['document', 'pdf'],
                folder: 'documents',
            },
            {
                name: 'profile-image.jpg',
                originalName: 'profile-image.jpg',
                size: 512000,
                mimeType: 'image/jpeg',
                storageKey: 'files/test/profile-image.jpg',
                previewKey: 'files/test/profile-image.jpg_preview.jpg',
                tags: ['image', 'profile'],
                folder: 'images',
            },
            {
                name: 'presentation.pptx',
                originalName: 'presentation.pptx',
                size: 2048000,
                mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                storageKey: 'files/test/presentation.pptx',
                tags: ['presentation', 'work'],
                folder: 'work',
            },
        ];

        for (const fileData of testFiles) {
            const existingFile = await prisma.file.findFirst({
                where: {
                    originalName: fileData.originalName,
                    ownerId: adminUser.id,
                },
            });

            if (!existingFile) {
                await prisma.file.create({
                    data: {
                        ...fileData,
                        ownerId: adminUser.id,
                    },
                });

                logger.info(`✅ Created test file: ${fileData.originalName}`);
            } else {
                logger.info(`⏭️  Test file already exists: ${fileData.originalName}`);
            }
        }

        // Create test shares
        const testFile = await prisma.file.findFirst({
            where: {
                originalName: 'sample-document.pdf',
                ownerId: adminUser.id,
            },
        });

        if (testFile) {
            const existingShare = await prisma.share.findFirst({
                where: {
                    fileId: testFile.id,
                    createdById: adminUser.id,
                },
            });

            if (!existingShare) {
                await prisma.share.create({
                    data: {
                        token: 'test-share-token-123',
                        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
                        fileId: testFile.id,
                        createdById: adminUser.id,
                    },
                });

                logger.info(`✅ Created test share for: ${testFile.originalName}`);
            } else {
                logger.info(`⏭️  Test share already exists for: ${testFile.originalName}`);
            }
        }
    }

    // Create test tags
    const testTags = [
        { name: 'work', color: '#3B82F6' },
        { name: 'personal', color: '#10B981' },
        { name: 'important', color: '#EF4444' },
        { name: 'archive', color: '#6B7280' },
    ];

    for (const tagData of testTags) {
        if (adminUser) {
            const existingTag = await prisma.tag.findFirst({
                where: {
                    name: tagData.name,
                    userId: adminUser.id,
                },
            });

            if (!existingTag) {
                await prisma.tag.create({
                    data: {
                        ...tagData,
                        userId: adminUser.id,
                    },
                });

                logger.info(`✅ Created tag: ${tagData.name}`);
            } else {
                logger.info(`⏭️  Tag already exists: ${tagData.name}`);
            }
        }
    }

    logger.info('🎉 Database seeding completed successfully!');
    logger.info('');
    logger.info('📋 Test Credentials:');
    logger.info('Admin: admin@odinvault.com / admin123456');
    logger.info('User: user@odinvault.com / user123456');
    logger.info('Google User: googleuser@odinvault.com (OAuth only)');
    logger.info('');
    logger.info('🔗 Test Share Link: http://localhost:3000/api/shares/test-share-token-123');
    logger.info('');
    logger.info('🔐 Google OAuth:');
    logger.info('POST /api/auth/google - Authenticate with Google ID token');
    logger.info('GET /api/auth/google/url - Get Google OAuth URL');
}

main()
    .catch((e) => {
        logger.error('❌ Seeding failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
