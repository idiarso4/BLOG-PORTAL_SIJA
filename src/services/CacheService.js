const redis = require('redis');
const logger = require('../config/logger');

/**
 * Cache Service using Redis
 */
class CacheService {
  
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.defaultTTL = 3600; // 1 hour default TTL
    this.initialize();
  }
  
  /**
   * Initialize Redis client
   */
  async initialize() {
    try {
      this.client = redis.createClient({
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        db: process.env.REDIS_DB || 0,
        retryDelayOnFailover: 100,
        enableReadyCheck: true,
        maxRetriesPerRequest: 3
      });
      
      this.client.on('connect', () => {
        logger.info('Redis client connected');
        this.isConnected = true;
      });
      
      this.client.on('error', (err) => {
        logger.error('Redis client error:', err);
        this.isConnected = false;
      });
      
      this.client.on('end', () => {
        logger.warn('Redis client disconnected');
        this.isConnected = false;
      });
      
      await this.client.connect();
      
    } catch (error) {
      logger.error('Failed to initialize Redis client:', error);
      this.isConnected = false;
    }
  }
  
  /**
   * Check if cache is available
   * @returns {Boolean} Is cache available
   */
  isAvailable() {
    return this.isConnected && this.client;
  }
  
  /**
   * Generate cache key with prefix
   * @param {String} key - Cache key
   * @param {String} prefix - Key prefix
   * @returns {String} Formatted cache key
   */
  formatKey(key, prefix = 'blog') {
    return `${prefix}:${key}`;
  }
  
  /**
   * Set cache value
   * @param {String} key - Cache key
   * @param {*} value - Value to cache
   * @param {Number} ttl - Time to live in seconds
   * @returns {Promise<Boolean>} Success status
   */
  async set(key, value, ttl = this.defaultTTL) {
    if (!this.isAvailable()) {
      logger.warn('Cache not available for SET operation');
      return false;
    }
    
    try {
      const formattedKey = this.formatKey(key);
      const serializedValue = JSON.stringify(value);
      
      await this.client.setEx(formattedKey, ttl, serializedValue);
      
      logger.debug('Cache SET successful', { key: formattedKey, ttl });
      return true;
      
    } catch (error) {
      logger.error('Cache SET error:', error);
      return false;
    }
  }
  
  /**
   * Get cache value
   * @param {String} key - Cache key
   * @returns {Promise<*>} Cached value or null
   */
  async get(key) {
    if (!this.isAvailable()) {
      logger.warn('Cache not available for GET operation');
      return null;
    }
    
    try {
      const formattedKey = this.formatKey(key);
      const value = await this.client.get(formattedKey);
      
      if (value === null) {
        logger.debug('Cache MISS', { key: formattedKey });
        return null;
      }
      
      logger.debug('Cache HIT', { key: formattedKey });
      return JSON.parse(value);
      
    } catch (error) {
      logger.error('Cache GET error:', error);
      return null;
    }
  }
  
  /**
   * Delete cache value
   * @param {String} key - Cache key
   * @returns {Promise<Boolean>} Success status
   */
  async del(key) {
    if (!this.isAvailable()) {
      logger.warn('Cache not available for DEL operation');
      return false;
    }
    
    try {
      const formattedKey = this.formatKey(key);
      const result = await this.client.del(formattedKey);
      
      logger.debug('Cache DEL successful', { key: formattedKey, deleted: result });
      return result > 0;
      
    } catch (error) {
      logger.error('Cache DEL error:', error);
      return false;
    }
  }
  
  /**
   * Delete multiple cache keys by pattern
   * @param {String} pattern - Key pattern
   * @returns {Promise<Number>} Number of deleted keys
   */
  async delPattern(pattern) {
    if (!this.isAvailable()) {
      logger.warn('Cache not available for DEL pattern operation');
      return 0;
    }
    
    try {
      const formattedPattern = this.formatKey(pattern);
      const keys = await this.client.keys(formattedPattern);
      
      if (keys.length === 0) {
        return 0;
      }
      
      const result = await this.client.del(keys);
      
      logger.debug('Cache DEL pattern successful', { pattern: formattedPattern, deleted: result });
      return result;
      
    } catch (error) {
      logger.error('Cache DEL pattern error:', error);
      return 0;
    }
  }
  
  /**
   * Check if key exists
   * @param {String} key - Cache key
   * @returns {Promise<Boolean>} Key exists
   */
  async exists(key) {
    if (!this.isAvailable()) {
      return false;
    }
    
    try {
      const formattedKey = this.formatKey(key);
      const result = await this.client.exists(formattedKey);
      return result === 1;
      
    } catch (error) {
      logger.error('Cache EXISTS error:', error);
      return false;
    }
  }
  
  /**
   * Set cache expiration
   * @param {String} key - Cache key
   * @param {Number} ttl - Time to live in seconds
   * @returns {Promise<Boolean>} Success status
   */
  async expire(key, ttl) {
    if (!this.isAvailable()) {
      return false;
    }
    
    try {
      const formattedKey = this.formatKey(key);
      const result = await this.client.expire(formattedKey, ttl);
      return result === 1;
      
    } catch (error) {
      logger.error('Cache EXPIRE error:', error);
      return false;
    }
  }
  
  /**
   * Get or set cache value (cache-aside pattern)
   * @param {String} key - Cache key
   * @param {Function} fetchFunction - Function to fetch data if not cached
   * @param {Number} ttl - Time to live in seconds
   * @returns {Promise<*>} Cached or fetched value
   */
  async getOrSet(key, fetchFunction, ttl = this.defaultTTL) {
    // Try to get from cache first
    let value = await this.get(key);
    
    if (value !== null) {
      return value;
    }
    
    // If not in cache, fetch the data
    try {
      value = await fetchFunction();
      
      // Cache the result
      if (value !== null && value !== undefined) {
        await this.set(key, value, ttl);
      }
      
      return value;
      
    } catch (error) {
      logger.error('Cache getOrSet fetch error:', error);
      throw error;
    }
  }
  
  /**
   * Increment counter
   * @param {String} key - Counter key
   * @param {Number} increment - Increment value
   * @param {Number} ttl - Time to live in seconds
   * @returns {Promise<Number>} New counter value
   */
  async incr(key, increment = 1, ttl = null) {
    if (!this.isAvailable()) {
      return 0;
    }
    
    try {
      const formattedKey = this.formatKey(key);
      
      let result;
      if (increment === 1) {
        result = await this.client.incr(formattedKey);
      } else {
        result = await this.client.incrBy(formattedKey, increment);
      }
      
      // Set TTL if provided and this is the first increment
      if (ttl && result === increment) {
        await this.client.expire(formattedKey, ttl);
      }
      
      return result;
      
    } catch (error) {
      logger.error('Cache INCR error:', error);
      return 0;
    }
  }
  
  /**
   * Cache articles with pagination
   * @param {Object} query - Query parameters
   * @param {Array} articles - Articles data
   * @param {Object} pagination - Pagination info
   * @param {Number} ttl - Time to live in seconds
   */
  async cacheArticles(query, articles, pagination, ttl = 600) {
    const key = `articles:${JSON.stringify(query)}`;
    const data = { articles, pagination, cachedAt: new Date().toISOString() };
    await this.set(key, data, ttl);
  }
  
  /**
   * Get cached articles
   * @param {Object} query - Query parameters
   * @returns {Promise<Object|null>} Cached articles data
   */
  async getCachedArticles(query) {
    const key = `articles:${JSON.stringify(query)}`;
    return await this.get(key);
  }
  
  /**
   * Cache user data
   * @param {String} userId - User ID
   * @param {Object} userData - User data
   * @param {Number} ttl - Time to live in seconds
   */
  async cacheUser(userId, userData, ttl = 1800) {
    const key = `user:${userId}`;
    await this.set(key, userData, ttl);
  }
  
  /**
   * Get cached user data
   * @param {String} userId - User ID
   * @returns {Promise<Object|null>} Cached user data
   */
  async getCachedUser(userId) {
    const key = `user:${userId}`;
    return await this.get(key);
  }
  
  /**
   * Cache analytics data
   * @param {String} type - Analytics type
   * @param {Object} params - Parameters
   * @param {Object} data - Analytics data
   * @param {Number} ttl - Time to live in seconds
   */
  async cacheAnalytics(type, params, data, ttl = 300) {
    const key = `analytics:${type}:${JSON.stringify(params)}`;
    await this.set(key, data, ttl);
  }
  
  /**
   * Get cached analytics data
   * @param {String} type - Analytics type
   * @param {Object} params - Parameters
   * @returns {Promise<Object|null>} Cached analytics data
   */
  async getCachedAnalytics(type, params) {
    const key = `analytics:${type}:${JSON.stringify(params)}`;
    return await this.get(key);
  }
  
  /**
   * Invalidate related caches
   * @param {String} type - Cache type to invalidate
   * @param {String} id - Related ID
   */
  async invalidateRelated(type, id) {
    const patterns = [];
    
    switch (type) {
      case 'article':
        patterns.push(`articles:*`, `article:${id}:*`, `analytics:*`);
        break;
      case 'user':
        patterns.push(`user:${id}`, `articles:*`, `analytics:*`);
        break;
      case 'category':
        patterns.push(`articles:*`, `categories:*`);
        break;
      default:
        patterns.push(`${type}:*`);
    }
    
    for (const pattern of patterns) {
      await this.delPattern(pattern);
    }
    
    logger.debug('Cache invalidated', { type, id, patterns });
  }
  
  /**
   * Get cache statistics
   * @returns {Promise<Object>} Cache statistics
   */
  async getStats() {
    if (!this.isAvailable()) {
      return { available: false };
    }
    
    try {
      const info = await this.client.info('memory');
      const keyspace = await this.client.info('keyspace');
      
      return {
        available: true,
        memory: info,
        keyspace: keyspace,
        connected: this.isConnected
      };
      
    } catch (error) {
      logger.error('Cache stats error:', error);
      return { available: false, error: error.message };
    }
  }
  
  /**
   * Flush all cache
   * @returns {Promise<Boolean>} Success status
   */
  async flushAll() {
    if (!this.isAvailable()) {
      return false;
    }
    
    try {
      await this.client.flushAll();
      logger.info('Cache flushed successfully');
      return true;
      
    } catch (error) {
      logger.error('Cache flush error:', error);
      return false;
    }
  }
  
  /**
   * Close Redis connection
   */
  async close() {
    if (this.client) {
      await this.client.quit();
      this.isConnected = false;
      logger.info('Redis client connection closed');
    }
  }
}

// Create singleton instance
const cacheService = new CacheService();

module.exports = cacheService;