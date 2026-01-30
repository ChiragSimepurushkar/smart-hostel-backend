import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD,
  tls: {}, 
  connectTimeout: 5000, // Reduced timeout
  maxRetriesPerRequest: 0, // IMPORTANT: Prevents ioredis from hanging on failed commands
  retryStrategy: (times) => {
    if (times > 3) {
      console.error('⚠️ Redis connection failed. Proceeding without Cache.');
      return null; // Stop retrying quickly
    }
    return 1000;
  },
});

redis.on('error', (err) => {
  // Just log it, don't crash
  console.error('❌ Redis Status:', err.message);
});

export default redis;