const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

/**
 * Authentication utility functions
 */
class AuthUtils {
  
  /**
   * Generate JWT token
   * @param {Object} payload - Token payload
   * @param {String} secret - JWT secret
   * @param {String} expiresIn - Token expiration
   * @returns {String} JWT token
   */
  static generateToken(payload, secret = process.env.JWT_SECRET, expiresIn = process.env.JWT_EXPIRE) {
    return jwt.sign(payload, secret, { expiresIn });
  }
  
  /**
   * Verify JWT token
   * @param {String} token - JWT token
   * @param {String} secret - JWT secret
   * @returns {Object} Decoded token payload
   */
  static verifyToken(token, secret = process.env.JWT_SECRET) {
    try {
      return jwt.verify(token, secret);
    } catch (error) {
      throw new Error('Token tidak valid atau telah kedaluwarsa');
    }
  }
  
  /**
   * Generate refresh token
   * @param {String} userId - User ID
   * @returns {String} Refresh token
   */
  static generateRefreshToken(userId) {
    const payload = {
      id: userId,
      type: 'refresh',
      timestamp: Date.now()
    };
    
    return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
      expiresIn: process.env.JWT_REFRESH_EXPIRE || '30d'
    });
  }
  
  /**
   * Generate random token for email verification, password reset, etc.
   * @param {Number} length - Token length
   * @returns {String} Random token
   */
  static generateRandomToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }
  
  /**
   * Generate OTP (One Time Password)
   * @param {Number} length - OTP length
   * @returns {String} OTP
   */
  static generateOTP(length = 6) {
    const digits = '0123456789';
    let otp = '';
    
    for (let i = 0; i < length; i++) {
      otp += digits[Math.floor(Math.random() * digits.length)];
    }
    
    return otp;
  }
  
  /**
   * Hash password
   * @param {String} password - Plain password
   * @param {Number} saltRounds - Salt rounds for bcrypt
   * @returns {String} Hashed password
   */
  static async hashPassword(password, saltRounds = 12) {
    try {
      return await bcrypt.hash(password, saltRounds);
    } catch (error) {
      throw new Error('Error hashing password');
    }
  }
  
  /**
   * Compare password with hash
   * @param {String} password - Plain password
   * @param {String} hash - Hashed password
   * @returns {Boolean} Password match result
   */
  static async comparePassword(password, hash) {
    try {
      return await bcrypt.compare(password, hash);
    } catch (error) {
      throw new Error('Error comparing password');
    }
  }
  
  /**
   * Generate secure session ID
   * @returns {String} Session ID
   */
  static generateSessionId() {
    return crypto.randomBytes(32).toString('hex');
  }
  
  /**
   * Create password reset token with expiration
   * @param {String} userId - User ID
   * @returns {Object} Token and expiration
   */
  static createPasswordResetToken(userId) {
    const token = this.generateRandomToken();
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    
    return { token, expires };
  }
  
  /**
   * Create email verification token with expiration
   * @param {String} userId - User ID
   * @returns {Object} Token and expiration
   */
  static createEmailVerificationToken(userId) {
    const token = this.generateRandomToken();
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    
    return { token, expires };
  }
  
  /**
   * Extract token from Authorization header
   * @param {String} authHeader - Authorization header
   * @returns {String|null} Token
   */
  static extractTokenFromHeader(authHeader) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    
    return authHeader.substring(7); // Remove 'Bearer ' prefix
  }
  
  /**
   * Generate API key
   * @param {String} prefix - API key prefix
   * @returns {String} API key
   */
  static generateApiKey(prefix = 'blog_') {
    const randomPart = crypto.randomBytes(24).toString('hex');
    return `${prefix}${randomPart}`;
  }
  
  /**
   * Validate password strength
   * @param {String} password - Password to validate
   * @returns {Object} Validation result
   */
  static validatePasswordStrength(password) {
    const minLength = 6;
    const hasLowerCase = /[a-z]/.test(password);
    const hasUpperCase = /[A-Z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    const score = [
      password.length >= minLength,
      hasLowerCase,
      hasUpperCase,
      hasNumbers,
      hasSpecialChar
    ].filter(Boolean).length;
    
    let strength = 'weak';
    if (score >= 4) strength = 'strong';
    else if (score >= 3) strength = 'medium';
    
    return {
      isValid: score >= 3, // Minimal medium strength
      strength,
      score,
      checks: {
        minLength: password.length >= minLength,
        hasLowerCase,
        hasUpperCase,
        hasNumbers,
        hasSpecialChar
      },
      suggestions: this.getPasswordSuggestions({
        minLength: password.length >= minLength,
        hasLowerCase,
        hasUpperCase,
        hasNumbers,
        hasSpecialChar
      })
    };
  }
  
  /**
   * Get password improvement suggestions
   * @param {Object} checks - Password checks result
   * @returns {Array} Suggestions
   */
  static getPasswordSuggestions(checks) {
    const suggestions = [];
    
    if (!checks.minLength) {
      suggestions.push('Password minimal 6 karakter');
    }
    if (!checks.hasLowerCase) {
      suggestions.push('Tambahkan huruf kecil');
    }
    if (!checks.hasUpperCase) {
      suggestions.push('Tambahkan huruf besar');
    }
    if (!checks.hasNumbers) {
      suggestions.push('Tambahkan angka');
    }
    if (!checks.hasSpecialChar) {
      suggestions.push('Tambahkan karakter khusus (!@#$%^&*)');
    }
    
    return suggestions;
  }
  
  /**
   * Generate secure random string
   * @param {Number} length - String length
   * @param {String} charset - Character set
   * @returns {String} Random string
   */
  static generateSecureRandomString(length = 16, charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789') {
    let result = '';
    const bytes = crypto.randomBytes(length);
    
    for (let i = 0; i < length; i++) {
      result += charset[bytes[i] % charset.length];
    }
    
    return result;
  }
  
  /**
   * Create JWT payload for user
   * @param {Object} user - User object
   * @returns {Object} JWT payload
   */
  static createUserPayload(user) {
    return {
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      emailVerified: user.emailVerified,
      subscriptionPlan: user.subscription.plan
    };
  }
  
  /**
   * Check if token is expired
   * @param {Number} exp - Token expiration timestamp
   * @returns {Boolean} Is expired
   */
  static isTokenExpired(exp) {
    return Date.now() >= exp * 1000;
  }
  
  /**
   * Get token expiration time in readable format
   * @param {String} token - JWT token
   * @returns {String} Expiration time
   */
  static getTokenExpiration(token) {
    try {
      const decoded = jwt.decode(token);
      if (!decoded || !decoded.exp) return null;
      
      return new Date(decoded.exp * 1000).toISOString();
    } catch (error) {
      return null;
    }
  }
}

module.exports = AuthUtils;