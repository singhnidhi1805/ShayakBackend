// src/config/config.js
require('dotenv').config();

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 3000,
  
  // Database
  mongodb: {
    url: process.env.MONGODB_URL || 'mongodb+srv://root:root@cluster0.p9mt5.mongodb.net/',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      useCreateIndex: true,
      useFindAndModify: false
    }
  },
  
  // JWT configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    issuer: process.env.JWT_ISSUER || 'support-app'
  },
  
  // AWS S3 configuration
  aws: {
    accessKey: process.env.AWS_ACCESS_KEY_ID,
    secretKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION || 'us-east-1',
    bucketName: process.env.AWS_BUCKET_NAME || 'support-app'
  },
  
  // Email configuration
  email: {
    from: process.env.EMAIL_FROM || 'noreply@support-app.com',
    service: process.env.EMAIL_SERVICE || 'smtp',
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT || 587,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  },
  
  // Support hours
  supportHours: {
    start: process.env.SUPPORT_HOURS_START || 9, // 9 AM
    end: process.env.SUPPORT_HOURS_END || 18,    // 6 PM
    timezone: process.env.SUPPORT_TIMEZONE || 'IST',
    workingDays: [1, 2, 3, 4, 5]  // Monday to Friday
  },
  
  // File upload limits
  fileUpload: {
    maxSize: process.env.MAX_FILE_SIZE || 5 * 1024 * 1024, // 5MB
    allowedTypes: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ]
  }
};