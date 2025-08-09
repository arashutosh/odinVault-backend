import 'dotenv/config';
import AWS from 'aws-sdk';
import { logger } from './logger';

// Configure AWS SDK
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
const region = process.env.AWS_REGION || 'us-east-1';

if (!accessKeyId || !secretAccessKey) {
  throw new Error('AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables are required');
}

AWS.config.update({
  accessKeyId,
  secretAccessKey,
  region,
});

const s3 = new AWS.S3();
const bucketName = process.env.AWS_S3_BUCKET;

if (!bucketName) {
  throw new Error('AWS_S3_BUCKET environment variable is required');
}

// Ensure bucketName is treated as a string
const S3_BUCKET = bucketName as string;

export interface UploadResult {
  key: string;
  url: string;
  etag: string;
}

export interface SignedUrlResult {
  url: string;
  expires: number;
}

export class StorageService {
  /**
   * Check if the configured bucket is reachable
   */
  static async checkHealth(): Promise<{ ok: boolean; bucket: string; region: string; error?: string }> {
    try {
      await s3.headBucket({ Bucket: S3_BUCKET }).promise();
      return { ok: true, bucket: S3_BUCKET, region } as any;
    } catch (error) {
      const message = (error as any)?.message || String(error);
      logger.error('S3 health check failed:', error);
      return { ok: false, bucket: S3_BUCKET, region, error: message } as any;
    }
  }
  /**
   * Upload a file to S3/B2
   */
  static async uploadFile(
    fileBuffer: Buffer,
    key: string,
    contentType: string,
    metadata?: Record<string, string>
  ): Promise<UploadResult> {
    try {
      const params: AWS.S3.PutObjectRequest = {
        Bucket: S3_BUCKET,
        Key: key,
        Body: fileBuffer,
        ContentType: contentType,
        Metadata: metadata,
      };

      const result = await s3.upload(params).promise();

      logger.info(`File uploaded successfully: ${key}`);

      return {
        key: result.Key,
        url: result.Location,
        etag: result.ETag?.replace(/"/g, '') || '',
      };
    } catch (error) {
      logger.error('File upload failed:', error);
      const message = (error as any)?.message || String(error);
      throw new Error(`Failed to upload file to storage: ${message}`);
    }
  }

  /**
   * Generate a signed URL for file download
   */
  static async getSignedDownloadUrl(key: string, expiresIn: number = 3600): Promise<SignedUrlResult> {
    try {
      const params: AWS.S3.GetObjectRequest = {
        Bucket: S3_BUCKET,
        Key: key,
      };

      const url = await s3.getSignedUrlPromise('getObject', {
        ...params,
        Expires: expiresIn,
      });

      return {
        url,
        expires: Date.now() + (expiresIn * 1000),
      };
    } catch (error) {
      logger.error('Failed to generate signed download URL:', error);
      const message = (error as any)?.message || String(error);
      throw new Error(`Failed to generate download URL: ${message}`);
    }
  }

  /**
   * Generate a signed URL for file upload
   */
  static async getSignedUploadUrl(
    key: string,
    contentType: string,
    expiresIn: number = 3600
  ): Promise<SignedUrlResult> {
    try {
      const params: AWS.S3.PutObjectRequest = {
        Bucket: S3_BUCKET,
        Key: key,
        ContentType: contentType,
      };

      const url = await s3.getSignedUrlPromise('putObject', {
        ...params,
        Expires: expiresIn,
      });

      return {
        url,
        expires: Date.now() + (expiresIn * 1000),
      };
    } catch (error) {
      logger.error('Failed to generate signed upload URL:', error);
      const message = (error as any)?.message || String(error);
      throw new Error(`Failed to generate upload URL: ${message}`);
    }
  }

  /**
   * Delete a file from storage
   */
  static async deleteFile(key: string): Promise<void> {
    try {
      const params: AWS.S3.DeleteObjectRequest = {
        Bucket: S3_BUCKET,
        Key: key,
      };

      await s3.deleteObject(params).promise();
      logger.info(`File deleted successfully: ${key}`);
    } catch (error) {
      logger.error('File deletion failed:', error);
      const message = (error as any)?.message || String(error);
      throw new Error(`Failed to delete file from storage: ${message}`);
    }
  }

  /**
   * Check if a file exists in storage
   */
  static async fileExists(key: string): Promise<boolean> {
    try {
      const params: AWS.S3.HeadObjectRequest = {
        Bucket: S3_BUCKET,
        Key: key,
      };

      await s3.headObject(params).promise();
      return true;
    } catch (error) {
      if ((error as AWS.AWSError).code === 'NotFound') {
        return false;
      }
      logger.error('HeadObject failed:', error);
      const message = (error as any)?.message || String(error);
      throw new Error(`Failed to check if file exists: ${message}`);
    }
  }

  /**
   * Get file metadata
   */
  static async getFileMetadata(key: string): Promise<AWS.S3.HeadObjectOutput> {
    try {
      const params: AWS.S3.HeadObjectRequest = {
        Bucket: S3_BUCKET,
        Key: key,
      };

      return await s3.headObject(params).promise();
    } catch (error) {
      logger.error('Failed to get file metadata:', error);
      const message = (error as any)?.message || String(error);
      throw new Error(`Failed to get file metadata: ${message}`);
    }
  }
}
