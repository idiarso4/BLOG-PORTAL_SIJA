const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const redisClient = require('../config/redis');
const logger = require('../config/logger');

/**
 * JWT Service untuk handle semua operasi token
 */
class JwtService {
  
  /**
   * Generate access token
   * @param {Object} user - User object
   * @returns {String} Access token
   */
  static generateAccessToken(user) {
    const payload = {
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      emailVerified: user.emailVerified,
      subscriptionPlan: user.subscription.plan,
      type: 'access'
    };
    
    return jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRE || '15m',
      issuer: 'blog-express',
      audience: 'blog-express-users'
    });
  }
  
  /**
   * Generate refresh token
   * @param {Object} user - User object
   * @returns {String} Refresh token
   */
  static generateRefreshToken(user) {
    const payload = {
      id: user._id,
      type: 'refresh',
      tokenId: crypto.randomBytes(16).toString('hex')
    };
    
    return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
      expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d',
      issuer: 'blog-express',
      audience: 'blog-express-users'
    });
  }
  
  /**
   * Generate token pair (access + refresh)
   * @param {Object} user - User object
   * @returns {Object} Token pair
   */
  static generateTokenPair(user) {
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);
    
    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.getTokenExpiration(accessToken)
    };
  }
  
  /**
   * Verify access token
   * @param {String} token - Access token
   * @returns {Object} Decoded payload
   */
  static verifyAccessToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_SECRET, {
        issuer: 'blog-express',
        audience: 'blog-express-users'
      });
    } catch (error) {
      throw new Error(`Invalid access token: ${error.message}`);
    }
  }
  
  /**
   * Verify refresh token
   * @param {String} token - Refresh token
   * @returns {Object} Decoded payload
   */
  static verifyRefreshToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_REFRESH_SECRET, {
        issuer: 'blog-express',
        audience: 'blog-express-users'
      });
    } catch (error) {
      throw new Error(`Invalid refresh token: ${error.message}`);
    }
  }
  
  /**
   * Refresh access token using refresh token
   * @param {String} refreshToken - Refresh token
   * @returns {Object} New token pair
   */
  static async refreshAccessToken(refreshToken) {
    try {
      // Verify refresh token
      const decoded = this.verifyRefreshToken(refreshToken);
      
      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }
      
      // Check if refresh token is blacklisted
      const isBlacklisted = await this.isTokenBlacklisted(refreshToken);
      if (isBlacklisted) {
        throw new Error('Refresh token has been revoked');
      }
      
      // Get user from database
      const user = await User.findById(decoded.id);
      if (!user || !user.isActive) {
        throw new Error('User not found or inactive');
      }
      
      // Generate new token pair
      const tokenPair = this.generateTokenPair(user);
      
      // Blacklist old refresh token
      await this.blacklistToken(refreshToken);
      
      // Store new refresh token
      await this.storeRefreshToken(decoded.id, tokenPair.refreshToken);
      
      return tokenPair;
    } catch (error) {
      logger.error('Token refresh error:', error);
      throw error;
    }
  }
  
  /**
   * Revoke refresh token
   * @param {String} refreshToken - Refresh token to revoke
   */
  static async revokeRefreshToken(refreshToken) {
    try {
      const decoded = this.verifyRefreshToken(refreshToken);
      
      // Blacklist the token
      await this.blacklistToken(refreshToken);
      
      // Remove from user's active tokens
      await this.removeRefreshToken(decoded.id, refreshToken);
      
      logger.info(`Refresh token revoked for user ${decoded.id}`);
    } catch (error) {
      logger.error('Token revocation error:', error);
      throw error;
    }
  }
  
  /**
   * Revoke all refresh tokens for a user
   * @param {String} userId - User ID
   */
  static async revokeAllRefreshTokens(userId) {
    try {
      // Get all user's refresh tokens
      const tokens = await this.getUserRefreshTokens(userId);
      
      // Blacklist all tokens
      for (const token of tokens) {
        await this.blacklistToken(token);
      }
      
      // Clear user's token storage
      await this.clearUserRefreshTokens(userId);
      
      logger.info(`All refresh tokens revoked for user ${userId}`);
    } catch (error) {
      logger.error('Bulk token revocation error:', error);
      throw error;
    }
  }
  
  /**
   * Store refresh token in Redis
   * @param {String} userId - User ID
   * @param {String} refreshToken - Refresh token
   */
  static async storeRefreshToken(userId, refreshToken) {
    if (!redisClient.isClientConnected()) {
      return; // Skip if Redis is not available
    }
    
    try {
      const key = `refresh_tokens:${userId}`;
      const decoded = this.verifyRefreshToken(refreshToken);
      const expiry = decoded.exp - Math.floor(Date.now() / 1000);
      
      // Store token with expiration
      await redisClient.getClient().sadd(key, refreshToken);
      await redisClient.getClient().expire(key, expiry);
    } catch (error) {
      logger.error('Error storing refresh token:', error);
    }
  }
  
  /**
   * Remove refresh token from storage
   * @param {String} userId - User ID
   * @param {String} refreshToken - Refresh token
   */
  static async removeRefreshToken(userId, refreshToken) {
    if (!redisClient.isClientConnected()) {
      return;
    }
    
    try {
      const key = `refresh_tokens:${userId}`;
      await redisClient.getClient().srem(key, refreshToken);
    } catch (error) {
      logger.error('Error removing refresh token:', error);
    }
  }
  
  /**
   * Get all refresh tokens for a user
   * @param {String} userId - User ID
   * @returns {Array} Array of refresh tokens
   */
  static async getUserRefreshTokens(userId) {
    if (!redisClient.isClientConnected()) {
      return [];
    }
    
    try {
      const key = `refresh_tokens:${userId}`;
      return await redisClient.getClient().smembers(key);
    } catch (error) {
      logger.error('Error getting user refresh tokens:', error);
      return [];
    }
  }
  
  /**
   * Clear all refresh tokens for a user
   * @param {String} userId - User ID
   */
  static async clearUserRefreshTokens(userId) {
    if (!redisClient.isClientConnected()) {
      return;
    }
    
    try {
      const key = `refresh_tokens:${userId}`;
      await redisClient.getClient().del(key);
    } catch (error) {
      logger.error('Error clearing user refresh tokens:', error);
    }
  }
  
  /**
   * Blacklist a token
   * @param {String} token - Token to blacklist
   */
  static async blacklistToken(token) {
    if (!redisClient.isClientConnected()) {
      return;
    }
    
    try {
      const decoded = jwt.decode(token);
      if (!decoded || !decoded.exp) {
        return;
      }
      
      const key = `blacklist:${token}`;
      const expiry = decoded.exp - Math.floor(Date.now() / 1000);
      
      if (expiry > 0) {
        await redisClient.getClient().setex(key, expiry, '1');
      }
    } catch (error) {
      logger.error('Error blacklisting token:', error);
    }
  }
  
  /**
   * Check if token is blacklisted
   * @param {String} token - Token to check
   * @returns {Boolean} Is blacklisted
   */
  static async isTokenBlacklisted(token) {
    if (!redisClient.isClientConnected()) {
      return false;
    }
    
    try {
      const key = `blacklist:${token}`;
      const result = await redisClient.getClient().get(key);
      return result === '1';
    } catch (error) {
      logger.error('Error checking token blacklist:', error);
      return false;
    }
  }
  
  /**
   * Get token expiration time
   * @param {String} token - JWT token
   * @returns {Number} Expiration timestamp
   */
  static getTokenExpiration(token) {
    try {
      const decoded = jwt.decode(token);
      return decoded ? decoded.exp : null;
    } catch (error) {
      return null;
    }
  }
  
  /**
   * Check if token is expired
   * @param {String} token - JWT token
   * @returns {Boolean} Is expired
   */
  static isTokenExpired(token) {
    const exp = this.getTokenExpiration(token);
    if (!exp) return true;
    
    return Date.now() >= exp * 1000;
  }
  
  /**
   * Get token payload without verification
   * @param {String} token - JWT token
   * @returns {Object} Token payload
   */
  static decodeToken(token) {
    try {
      return jwt.decode(token);
    } catch (error) {
      return null;
    }
  }
  
  /**
   * Generate email verification token
   * @param {String} userId - User ID
   * @param {String} email - User email
   * @returns {String} Verification token
   */
  static generateEmailVerificationToken(userId, email) {
    const payload = {
      id: userId,
      email,
      type: 'email_verification',
      timestamp: Date.now()
    };
    
    return jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: '24h',
      issuer: 'blog-express',
      audience: 'blog-express-users'
    });
  }
  
  /**
   * Generate password reset token
   * @param {String} userId - User ID
   * @param {String} email - User email
   * @returns {String} Reset token
   */
  static generatePasswordResetToken(userId, email) {
    const payload = {
      id: userId,
      email,
      type: 'password_reset',
      timestamp: Date.now()
    };
    
    return jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: '1h',
      issuer: 'blog-express',
      audience: 'blog-express-users'
    });
  }
  
  /**
   * Verify email verification token
   * @param {String} token - Verification token
   * @returns {Object} Decoded payload
   */
  static verifyEmailVerificationToken(token) {
    try {
      const decoded = this.verifyAccessToken(token);
      
      if (decoded.type !== 'email_verification') {
        throw new Error('Invalid token type');
      }
      
      return decoded;
    } catch (error) {
      throw new Error(`Invalid email verification token: ${error.message}`);
    }
  }
  
  /**
   * Verify password reset token
   * @param {String} token - Reset token
   * @returns {Object} Decoded payload
   */
  static verifyPasswordResetToken(token) {
    try {
      const decoded = this.verifyAccessToken(token);
      
      if (decoded.type !== 'password_reset') {
        throw new Error('Invalid token type');
      }
      
      return decoded;
    } catch (error) {
      throw new Error(`Invalid password reset token: ${error.message}`);
    }
  }
  
  /**
   * Clean up expired tokens from Redis
   */
  static async cleanupExpiredTokens() {
    if (!redisClient.isClientConnected()) {
      return;
    }
    
    try {
      // This is handled automatically by Redis TTL
      // But we can implement additional cleanup logic here if needed
      logger.info('Token cleanup completed');
    } catch (error) {
      logger.error('Token cleanup error:', error);
    }
  }
  
  /**
   * Get token statistics
   * @returns {Object} Token statistics
   */
  static async getTokenStatistics() {
    if (!redisClient.isClientConnected()) {
      return {
        activeRefreshTokens: 0,
        blacklistedTokens: 0
      };
    }
    
    try {
      const client = redisClient.getClient();
      
      // Count refresh token keys
      const refreshTokenKeys = await client.keys('refresh_tokens:*');
      let activeRefreshTokens = 0;
      
      for (const key of refreshTokenKeys) {
        const count = await client.scard(key);
        activeRefreshTokens += count;
      }
      
      // Count blacklisted tokens
      const blacklistKeys = await client.keys('blacklist:*');
      const blacklistedTokens = blacklistKeys.length;
      
      return {
        activeRefreshTokens,
        blacklistedTokens,
        refreshTokenUsers: refreshTokenKeys.length
      };
    } catch (error) {
      logger.error('Error getting token statistics:', error);
      return {
        activeRefreshTokens: 0,
        blacklistedTokens: 0,
        refreshTokenUsers: 0
      };
    }
  }
}

module.exports = JwtService;