const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AuthUtils = require('../utils/auth');
const logger = require('../config/logger');

/**
 * Authentication middleware untuk verify JWT token
 */
const authenticate = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.header('Authorization');
    const token = AuthUtils.extractTokenFromHeader(authHeader);
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'NO_TOKEN',
          message: 'Token akses diperlukan'
        }
      });
    }
    
    // Verify token
    const decoded = AuthUtils.verifyToken(token);
    
    // Get user from database
    const user = await User.findById(decoded.id).select('+emailVerified +isActive');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User tidak ditemukan'
        }
      });
    }
    
    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'USER_INACTIVE',
          message: 'Akun telah dinonaktifkan'
        }
      });
    }
    
    // Check if account is locked
    if (user.isLocked) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'ACCOUNT_LOCKED',
          message: 'Akun terkunci karena terlalu banyak percobaan login yang gagal'
        }
      });
    }
    
    // Add user to request object
    req.user = user;
    req.token = token;
    
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Token tidak valid'
        }
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Token telah kedaluwarsa'
        }
      });
    }
    
    return res.status(500).json({
      success: false,
      error: {
        code: 'AUTH_ERROR',
        message: 'Terjadi kesalahan saat verifikasi token'
      }
    });
  }
};

/**
 * Optional authentication middleware
 * Tidak akan error jika token tidak ada, tapi akan set req.user jika token valid
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    const token = AuthUtils.extractTokenFromHeader(authHeader);
    
    if (!token) {
      req.user = null;
      return next();
    }
    
    const decoded = AuthUtils.verifyToken(token);
    const user = await User.findById(decoded.id).select('+emailVerified +isActive');
    
    if (user && user.isActive && !user.isLocked) {
      req.user = user;
      req.token = token;
    } else {
      req.user = null;
    }
    
    next();
  } catch (error) {
    // Ignore token errors in optional auth
    req.user = null;
    next();
  }
};

/**
 * Role-based authorization middleware
 * @param {Array|String} roles - Required roles
 */
const authorize = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'NOT_AUTHENTICATED',
          message: 'Authentication diperlukan'
        }
      });
    }
    
    const allowedRoles = Array.isArray(roles) ? roles : [roles];
    
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Anda tidak memiliki izin untuk mengakses resource ini'
        }
      });
    }
    
    next();
  };
};

/**
 * Email verification middleware
 */
const requireEmailVerification = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'NOT_AUTHENTICATED',
        message: 'Authentication diperlukan'
      }
    });
  }
  
  if (!req.user.emailVerified) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Email belum diverifikasi. Silakan verifikasi email Anda terlebih dahulu.'
      }
    });
  }
  
  next();
};

/**
 * Subscription-based authorization middleware
 * @param {String} feature - Required feature
 */
const requireFeature = (feature) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'NOT_AUTHENTICATED',
          message: 'Authentication diperlukan'
        }
      });
    }
    
    if (!req.user.hasFeature(feature)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FEATURE_NOT_AVAILABLE',
          message: `Fitur ${feature} tidak tersedia dalam paket langganan Anda`
        }
      });
    }
    
    next();
  };
};

/**
 * Owner authorization middleware
 * Memastikan user hanya bisa mengakses resource miliknya sendiri
 * @param {String} paramName - Parameter name yang berisi user ID
 */
const requireOwnership = (paramName = 'userId') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'NOT_AUTHENTICATED',
          message: 'Authentication diperlukan'
        }
      });
    }
    
    const resourceUserId = req.params[paramName] || req.body[paramName];
    
    if (!resourceUserId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_USER_ID',
          message: 'User ID diperlukan'
        }
      });
    }
    
    // Admin dapat mengakses semua resource
    if (req.user.role === 'admin') {
      return next();
    }
    
    // User hanya bisa mengakses resource miliknya sendiri
    if (req.user._id.toString() !== resourceUserId.toString()) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCESS_DENIED',
          message: 'Anda hanya dapat mengakses resource milik Anda sendiri'
        }
      });
    }
    
    next();
  };
};

/**
 * Rate limiting middleware berdasarkan user
 * @param {Number} maxRequests - Maximum requests per window
 * @param {Number} windowMs - Time window in milliseconds
 */
const userRateLimit = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  const requests = new Map();
  
  return (req, res, next) => {
    if (!req.user) {
      return next(); // Skip rate limiting for unauthenticated users
    }
    
    const userId = req.user._id.toString();
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Get user's request history
    let userRequests = requests.get(userId) || [];
    
    // Remove old requests outside the window
    userRequests = userRequests.filter(timestamp => timestamp > windowStart);
    
    // Check if user exceeded the limit
    if (userRequests.length >= maxRequests) {
      return res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Terlalu banyak permintaan. Silakan coba lagi nanti.',
          retryAfter: Math.ceil((userRequests[0] + windowMs - now) / 1000)
        }
      });
    }
    
    // Add current request
    userRequests.push(now);
    requests.set(userId, userRequests);
    
    // Clean up old entries periodically
    if (Math.random() < 0.01) { // 1% chance
      for (const [key, timestamps] of requests.entries()) {
        const validTimestamps = timestamps.filter(timestamp => timestamp > windowStart);
        if (validTimestamps.length === 0) {
          requests.delete(key);
        } else {
          requests.set(key, validTimestamps);
        }
      }
    }
    
    next();
  };
};

/**
 * API key authentication middleware
 * Alternative authentication method using API keys
 */
const authenticateApiKey = async (req, res, next) => {
  try {
    const apiKey = req.header('X-API-Key');
    
    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'NO_API_KEY',
          message: 'API key diperlukan'
        }
      });
    }
    
    // Find user by API key (assuming API key is stored in user model)
    const user = await User.findOne({ 
      'apiKey': apiKey,
      isActive: true 
    });
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_API_KEY',
          message: 'API key tidak valid'
        }
      });
    }
    
    req.user = user;
    req.authMethod = 'api_key';
    
    next();
  } catch (error) {
    logger.error('API key authentication error:', error);
    
    return res.status(500).json({
      success: false,
      error: {
        code: 'API_AUTH_ERROR',
        message: 'Terjadi kesalahan saat verifikasi API key'
      }
    });
  }
};

/**
 * Middleware untuk log authentication events
 */
const logAuthEvents = (req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    // Log authentication events
    if (req.user) {
      logger.info('Authentication event', {
        userId: req.user._id,
        username: req.user.username,
        role: req.user.role,
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        authMethod: req.authMethod || 'jwt',
        timestamp: new Date().toISOString()
      });
    }
    
    originalSend.call(this, data);
  };
  
  next();
};

/**
 * Middleware untuk check subscription expiry
 */
const checkSubscriptionExpiry = (req, res, next) => {
  if (!req.user) {
    return next();
  }
  
  const subscriptionStatus = req.user.subscriptionStatus;
  
  if (subscriptionStatus === 'expired') {
    return res.status(402).json({
      success: false,
      error: {
        code: 'SUBSCRIPTION_EXPIRED',
        message: 'Langganan Anda telah berakhir. Silakan perpanjang untuk melanjutkan.'
      }
    });
  }
  
  next();
};

/**
 * Middleware kombinasi untuk authentication dan authorization
 * @param {Object} options - Configuration options
 */
const authGuard = (options = {}) => {
  const {
    roles = null,
    requireVerification = false,
    requireFeature = null,
    checkExpiry = false,
    optional = false
  } = options;
  
  const middlewares = [];
  
  // Add authentication middleware
  if (optional) {
    middlewares.push(optionalAuth);
  } else {
    middlewares.push(authenticate);
  }
  
  // Add email verification check
  if (requireVerification) {
    middlewares.push(requireEmailVerification);
  }
  
  // Add role authorization
  if (roles) {
    middlewares.push(authorize(roles));
  }
  
  // Add feature check
  if (requireFeature) {
    middlewares.push(requireFeature(requireFeature));
  }
  
  // Add subscription expiry check
  if (checkExpiry) {
    middlewares.push(checkSubscriptionExpiry);
  }
  
  // Add logging
  middlewares.push(logAuthEvents);
  
  return middlewares;
};

module.exports = {
  authenticate,
  optionalAuth,
  authorize,
  requireEmailVerification,
  requireFeature,
  requireOwnership,
  userRateLimit,
  authenticateApiKey,
  logAuthEvents,
  checkSubscriptionExpiry,
  authGuard
};