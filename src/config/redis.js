// src/config/redis.js
const Redis = require("ioredis");
const { logger } = require("../utils/logger");

let redis = null;

function getRedisClient() {
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) return null; // stop retrying
        return Math.min(times * 200, 1000);
      },
      lazyConnect: true,
    });

    redis.on("error", (err) => {
      logger.error("Redis error:", err.message);
    });

    redis.on("connect", () => {
      logger.info("✅ Redis client connected");
    });
  }
  return redis;
}

async function connectRedis() {
  const client = getRedisClient();
  await client.connect();
  return client;
}

// ── Cache helpers ────────────────────────────────
async function cacheGet(key) {
  try {
    const val = await getRedisClient().get(key);
    return val ? JSON.parse(val) : null;
  } catch {
    return null; // fail silently — cache miss
  }
}

async function cacheSet(key, value, ttlSeconds = 300) {
  try {
    await getRedisClient().setex(key, ttlSeconds, JSON.stringify(value));
  } catch {
    // fail silently
  }
}

async function cacheDel(key) {
  try {
    await getRedisClient().del(key);
  } catch {
    // fail silently
  }
}

async function cacheDelPattern(pattern) {
  try {
    const client = getRedisClient();
    const keys = await client.keys(pattern);
    if (keys.length > 0) {
      await client.del(...keys);
    }
  } catch (e) {
    console.error("cacheDelPattern error:", e);
  }
}

module.exports = {
  getRedisClient,
  connectRedis,
  cacheGet,
  cacheSet,
  cacheDel,
  cacheDelPattern,
};
