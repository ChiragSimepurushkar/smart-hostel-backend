import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import redis from '../config/redis.js';

// Helper function to determine which store to use
const getStore = (prefix) => {
  // Only use RedisStore if redis is actually connected
  if (redis.status === 'ready') {
    return new RedisStore({
      sendCommand: (...args) => redis.call(...args),
      prefix: prefix,
    });
  }
  // Fallback to undefined (MemoryStore) if Redis is down
  console.warn(`⚠️ Redis not ready. Using MemoryStore for ${prefix}`);
  return undefined; 
};

// General API rate limiter
export const rateLimiter = rateLimit({
  store: getStore('rate_limit:'),
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    message: 'Too many requests, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict limiter for auth routes (Login/Register)
export const authLimiter = rateLimit({
  store: getStore('rate_limit_auth:'),
  windowMs: 15 * 60 * 1000,
  max: 20, // Increased slightly for development/testing
  skipSuccessfulRequests: true,
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.',
  },
});

// File upload limiter
export const uploadLimiter = rateLimit({
  store: getStore('rate_limit_upload:'),
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: {
    success: false,
    message: 'Upload limit exceeded, please try again later.',
  },
});