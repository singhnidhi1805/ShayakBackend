const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const redis = require('../config/redis');

const createRateLimiter = (options = {}) => {
  return rateLimit({
    store: new RedisStore({
      client: redis,
      prefix: 'rate-limit:'
    }),
    windowMs: options.windowMs || 15 * 60 * 1000, // 15 minutes default
    max: options.max || 100, // Limit each IP to 100 requests per windowMs
    message: options.message || 'Too many requests, please try again later.',
    standardHeaders: true,
    legacyHeaders: false
  });
};

module.exports = createRateLimiter;
