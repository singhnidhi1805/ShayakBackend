const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const createError = require('http-errors');
const logger = require('../config/logger');

// Configure AWS S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const bucketName = process.env.AWS_S3_BUCKET_NAME;

/**
 * Upload file to S3 (private)
 * @param {Buffer} buffer - File buffer
 * @param {String} key - File key (path in S3)
 * @param {String} contentType - MIME type of the file
 * @returns {Promise<Object>} - Object containing key and s3Key
 */
const uploadToS3 = async (buffer, key, contentType) => {
  try {
    // Validate inputs
    if (!buffer || !key || !contentType) {
      throw new Error('Missing required parameters');
    }

    if (!bucketName) {
      throw new Error('S3 bucket name not configured');
    }

    const params = {
      Bucket: bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      // No ACL - files are private by default
    };

    const command = new PutObjectCommand(params);
    await s3Client.send(command);
    
    logger.info(`File uploaded successfully: ${key}`);
    
    // Return the S3 key for storage in database
    return {
      s3Key: key,
      fileName: key.split('/').pop(),
      contentType: contentType
    };
  } catch (error) {
    logger.error('S3 upload error:', error);
    throw createError(500, 'Failed to upload file: ' + error.message);
  }
};

/**
 * Generate pre-signed URL for private S3 object
 * @param {String} key - File key in S3
 * @param {Number} expiresIn - URL expiration time in seconds (default: 1 hour)
 * @returns {Promise<String>} - Pre-signed URL
 */
const getPresignedUrl = async (key, expiresIn = 3600) => {
  try {
    if (!key || !bucketName) {
      throw new Error('Invalid S3 key or bucket not configured');
    }

    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });
    
    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn });
    logger.info(`Pre-signed URL generated for: ${key}`);
    return signedUrl;
  } catch (error) {
    logger.error('Error generating pre-signed URL:', error);
    throw createError(500, 'Failed to generate access URL: ' + error.message);
  }
};

/**
 * Extract S3 key from URL or return key if already a key
 * @param {String} fileUrlOrKey - Full S3 URL or S3 key
 * @returns {String} - S3 key
 */
const extractS3Key = (fileUrlOrKey) => {
  if (!fileUrlOrKey) return null;
  
  // If it's already a key (doesn't start with http), return as-is
  if (!fileUrlOrKey.startsWith('http')) {
    return fileUrlOrKey;
  }
  
  // Extract key from URL
  try {
    const url = new URL(fileUrlOrKey);
    // Remove leading slash
    return url.pathname.substring(1);
  } catch (error) {
    // Fallback: split by domain and take everything after
    return fileUrlOrKey.split('/').slice(3).join('/');
  }
};

/**
 * Delete file from S3
 * @param {String} fileUrlOrKey - Full URL or S3 key of the file to delete
 * @returns {Promise<void>}
 */
const deleteFromS3 = async (fileUrlOrKey) => {
  try {
    const key = extractS3Key(fileUrlOrKey);
    
    if (!key || !bucketName) {
      throw new Error('Invalid file URL/key or bucket not configured');
    }
    
    const params = {
      Bucket: bucketName,
      Key: key
    };
    
    const command = new DeleteObjectCommand(params);
    await s3Client.send(command);
    
    logger.info(`File deleted successfully: ${key}`);
  } catch (error) {
    logger.error('S3 delete error:', error);
    throw createError(500, 'Failed to delete file: ' + error.message);
  }
};

/**
 * Generate pre-signed URLs for multiple documents
 * @param {Array} documents - Array of document objects with s3Key property
 * @param {Number} expiresIn - URL expiration time in seconds
 * @returns {Promise<Array>} - Array of documents with fileUrl populated
 */
const generatePresignedUrls = async (documents, expiresIn = 3600) => {
  try {
    if (!documents || !Array.isArray(documents)) {
      return [];
    }

    const documentsWithUrls = await Promise.all(
      documents.map(async (doc) => {
        try {
          if (doc.s3Key) {
            const presignedUrl = await getPresignedUrl(doc.s3Key, expiresIn);
            return {
              ...doc,
              fileUrl: presignedUrl
            };
          }
          return doc;
        } catch (error) {
          logger.error(`Error generating URL for document ${doc._id}:`, error);
          return doc;
        }
      })
    );

    return documentsWithUrls;
  } catch (error) {
    logger.error('Error generating pre-signed URLs:', error);
    throw error;
  }
};

module.exports = {
  uploadToS3,
  deleteFromS3,
  getPresignedUrl,
  extractS3Key,
  generatePresignedUrls
};