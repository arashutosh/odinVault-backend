import { PrismaClient } from '@prisma/client';
import { ShareService } from '../services/shareService';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

async function cleanup() {
    logger.info('🧹 Starting cleanup process...');

    try {
        // Clean up expired shares
        const expiredSharesCount = await ShareService.cleanupExpiredShares();
        logger.info(`✅ Cleaned up ${expiredSharesCount} expired shares`);

        // Clean up soft-deleted files older than configured days
        const trashPurgeDays = parseInt(process.env.TRASH_PURGE_DAYS || '30');
        const purgeDate = new Date();
        purgeDate.setDate(purgeDate.getDate() - trashPurgeDays);

        const deletedFiles = await prisma.file.findMany({
            where: {
                isDeleted: true,
                deletedAt: {
                    lt: purgeDate,
                },
            },
        });

        if (deletedFiles.length > 0) {
            // Note: In a real implementation, you would also delete the actual files from storage
            // For now, we'll just log what would be deleted
            logger.info(`🗑️  Found ${deletedFiles.length} files to permanently delete (older than ${trashPurgeDays} days)`);

            for (const file of deletedFiles) {
                logger.info(`  - ${file.originalName} (deleted on ${file.deletedAt})`);
            }
        }

        logger.info('🎉 Cleanup process completed successfully!');
    } catch (error) {
        logger.error('❌ Cleanup failed:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

// Run cleanup if this script is executed directly
if (require.main === module) {
    cleanup();
}

export { cleanup };
