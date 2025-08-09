import sharp from 'sharp';
import { StorageService } from './storage';
import { logger } from './logger';

export interface PreviewOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
}

export class PreviewService {
  private static readonly DEFAULT_OPTIONS: PreviewOptions = {
    width: 300,
    height: 300,
    quality: 80,
    format: 'jpeg'
  };

  /**
   * Generate a preview for an image file
   */
  static async generateImagePreview(
    fileBuffer: Buffer,
    options: PreviewOptions = {}
  ): Promise<Buffer> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    
    try {
      const preview = await sharp(fileBuffer)
        .resize(opts.width, opts.height, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality: opts.quality })
        .toBuffer();

      logger.info('Image preview generated successfully');
      return preview;
    } catch (error) {
      logger.error('Failed to generate image preview:', error);
      throw new Error('Failed to generate image preview');
    }
  }

  /**
   * Generate preview based on file type
   */
  static async generatePreview(
    fileBuffer: Buffer,
    mimeType: string,
    options: PreviewOptions = {}
  ): Promise<Buffer | null> {
    try {
      if (mimeType.startsWith('image/')) {
        return await this.generateImagePreview(fileBuffer, options);
      } else {
        logger.info(`No preview generation available for mime type: ${mimeType}`);
        return null;
      }
    } catch (error) {
      logger.error('Preview generation failed:', error);
      return null;
    }
  }

  /**
   * Upload preview to storage and return the key
   */
  static async uploadPreview(
    previewBuffer: Buffer,
    originalFileKey: string,
    mimeType: string
  ): Promise<string> {
    try {
      const previewKey = `${originalFileKey}_preview.jpg`;
      
      await StorageService.uploadFile(
        previewBuffer,
        previewKey,
        'image/jpeg',
        {
          originalFile: originalFileKey,
          generatedAt: new Date().toISOString()
        }
      );

      logger.info(`Preview uploaded successfully: ${previewKey}`);
      return previewKey;
    } catch (error) {
      logger.error('Failed to upload preview:', error);
      throw new Error('Failed to upload preview');
    }
  }
}
