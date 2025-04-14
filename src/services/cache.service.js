const redis = require('../config/redis');
const logger = require('../config/logger');

class CacheService {
  static async get(key) {
    try {
      const data = await redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error('Cache get error:', error);
      return null;
    }
  }

  static async set(key, value, expirySeconds = 3600) {
    try {
      await redis.set(key, JSON.stringify(value), 'EX', expirySeconds);
      return true;
    } catch (error) {
      logger.error('Cache set error:', error);
      return false;
    }
  }

  static async delete(key) {
    try {
      await redis.del(key);
      return true;
    } catch (error) {
      logger.error('Cache delete error:', error);
      return false;
    }
  }
}


module.exports = {
    backupDatabase,
    EmailService,
    CacheService,
    AnalyticsService,
    Encryption,
    Validators,
    GeocodingService
  };