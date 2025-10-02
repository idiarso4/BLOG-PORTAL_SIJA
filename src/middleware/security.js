const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');
const logger = require('../config/logger');

/**
 * CORS configuration
 */
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = process.env.NODE_ENV === 'production' 
      ? (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean)
      : ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:3001'];
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-API-Key',
    'X-CSRF-Token'
  ],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
  maxAge: 86400 // 24 hours
};

/**
 * Helmet security configuration
 */
const helmetOptions = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://cdn.jsdelivr.net",
        "https://cdnjs.cloudflare.com",
        "https://fonts.googleapis.com"
      ],
      scriptSrc: [
        "'self'",
        "https://cdn.jsdelivr.net",
        "https://cdnjs.cloudflare.com",
        "https://www.google.com",
        "https://www.gstatic.com"
      ],
      imgSrc: [
        "'self'",
        "data:",
        "https:",
        "http:"
      ],
      fontSrc: [
        "'self'",
        "https://cdn.jsdelivr.net",
        "https://cdnjs.cloudflare.com",
        "https://fonts.gstatic.com"
      ],
      connectSrc: [
        "'self'",
        "https://api.openai.com"
      ],
      frameSrc: [
        "'self'",
        "https://www.google.com"
      ]
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
};

/**
 * Rate limiting configurations
 */
const rateLimitConfigs = {
  // General API rate limit
  general: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
    message: {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Terlalu banyak permintaan dari IP ini, coba lagi nanti.'
      }
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Terlalu banyak permintaan dari IP ini, coba lagi nanti.'
        }
      });
    }
  }),
  
  // Strict rate limit for authentication endpoints
  auth: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
    message: {
      success: false,
      error: {
        code: 'AUTH_RATE_LIMIT_EXCEEDED',
        message: 'Terlalu banyak percobaan login. Coba lagi dalam 15 menit.'
      }
    },
    skipSuccessfulRequests: true,
    handler: (req, res) => {
      logger.warn(`Auth rate limit exceeded for IP: ${req.ip}`);
      res.status(429).json({
        success: false,
        error: {
          code: 'AUTH_RATE_LIMIT_EXCEEDED',
          message: 'Terlalu banyak percobaan login. Coba lagi dalam 15 menit.'
        }
      });
    }
  }),
  
  // Rate limit for password reset
  passwordReset: rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 attempts per hour
    message: {
      success: false,
      error: {
        code: 'PASSWORD_RESET_RATE_LIMIT',
        message: 'Terlalu banyak permintaan reset password. Coba lagi dalam 1 jam.'
      }
    }
  }),
  
  // Rate limit for email verification
  emailVerification: rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // 5 attempts per hour
    message: {
      success: false,
      error: {
        code: 'EMAIL_VERIFICATION_RATE_LIMIT',
        message: 'Terlalu banyak permintaan verifikasi email. Coba lagi dalam 1 jam.'
      }
    }
  }),
  
  // Rate limit for file uploads
  upload: rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 50, // 50 uploads per hour
    message: {
      success: false,
      error: {
        code: 'UPLOAD_RATE_LIMIT',
        message: 'Terlalu banyak upload file. Coba lagi dalam 1 jam.'
      }
    }
  }),
  
  // Rate limit for API endpoints
  api: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // 1000 requests per window for API
    message: {
      success: false,
      error: {
        code: 'API_RATE_LIMIT_EXCEEDED',
        message: 'API rate limit exceeded. Please try again later.'
      }
    }
  }),
  
  // Rate limit for comments
  comment: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 comments per window
    message: {
      success: false,
      error: {
        code: 'COMMENT_RATE_LIMIT_EXCEEDED',
        message: 'Terlalu banyak komentar. Coba lagi dalam 15 menit.'
      }
    },
    handler: (req, res) => {
      logger.warn(`Comment rate limit exceeded for IP: ${req.ip}`);
      res.status(429).json({
        success: false,
        error: {
          code: 'COMMENT_RATE_LIMIT_EXCEEDED',
          message: 'Terlalu banyak komentar. Coba lagi dalam 15 menit.'
        }
      });
    }
  }),
  
  // Rate limit for AI operations
  ai: rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20, // 20 AI requests per hour
    message: {
      success: false,
      error: {
        code: 'AI_RATE_LIMIT_EXCEEDED',
        message: 'Terlalu banyak permintaan AI. Coba lagi dalam 1 jam.'
      }
    },
    handler: (req, res) => {
      logger.warn(`AI rate limit exceeded for IP: ${req.ip}`);
      res.status(429).json({
        success: false,
        error: {
          code: 'AI_RATE_LIMIT_EXCEEDED',
          message: 'Terlalu banyak permintaan AI. Coba lagi dalam 1 jam.'
        }
      });
    }
  })
};

/**
 * IP whitelist middleware
 */
const ipWhitelist = (whitelist = []) => {
  return (req, res, next) => {
    if (whitelist.length === 0) {
      return next(); // No whitelist configured
    }
    
    const clientIP = req.ip || req.connection.remoteAddress;
    
    if (whitelist.includes(clientIP)) {
      next();
    } else {
      logger.warn(`IP not whitelisted: ${clientIP}`);
      res.status(403).json({
        success: false,
        error: {
          code: 'IP_NOT_ALLOWED',
          message: 'Your IP address is not allowed to access this resource.'
        }
      });
    }
  };
};

/**
 * Request logging middleware
 */
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  // Log request
  logger.info('Incoming request', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });
  
  // Log response
  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - start;
    
    logger.info('Request completed', {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      timestamp: new Date().toISOString()
    });
    
    originalSend.call(this, data);
  };
  
  next();
};

/**
 * Error handling for security middleware
 */
const securityErrorHandler = (err, req, res, next) => {
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      success: false,
      error: {
        code: 'CORS_ERROR',
        message: 'Cross-origin request not allowed'
      }
    });
  }
  
  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({
      success: false,
      error: {
        code: 'CSRF_ERROR',
        message: 'Invalid CSRF token'
      }
    });
  }
  
  next(err);
};

/**
 * Content type validation middleware
 */
const validateContentType = (allowedTypes = ['application/json']) => {
  return (req, res, next) => {
    if (req.method === 'GET' || req.method === 'DELETE') {
      return next(); // Skip for GET and DELETE requests
    }
    
    const contentType = req.get('Content-Type');
    
    if (!contentType) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_CONTENT_TYPE',
          message: 'Content-Type header is required'
        }
      });
    }
    
    const isAllowed = allowedTypes.some(type => 
      contentType.toLowerCase().includes(type.toLowerCase())
    );
    
    if (!isAllowed) {
      return res.status(415).json({
        success: false,
        error: {
          code: 'UNSUPPORTED_MEDIA_TYPE',
          message: `Content-Type must be one of: ${allowedTypes.join(', ')}`
        }
      });
    }
    
    next();
  };
};

/**
 * Request size limit middleware
 */
const requestSizeLimit = (maxSize = '10mb') => {
  return (req, res, next) => {
    const contentLength = req.get('Content-Length');
    
    if (contentLength) {
      const sizeInBytes = parseInt(contentLength);
      const maxSizeInBytes = parseSize(maxSize);
      
      if (sizeInBytes > maxSizeInBytes) {
        return res.status(413).json({
          success: false,
          error: {
            code: 'REQUEST_TOO_LARGE',
            message: `Request size exceeds maximum allowed size of ${maxSize}`
          }
        });
      }
    }
    
    next();
  };
};

/**
 * Parse size string to bytes
 */
const parseSize = (size) => {
  const units = {
    'b': 1,
    'kb': 1024,
    'mb': 1024 * 1024,
    'gb': 1024 * 1024 * 1024
  };
  
  const match = size.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/);
  
  if (!match) {
    throw new Error('Invalid size format');
  }
  
  const value = parseFloat(match[1]);
  const unit = match[2] || 'b';
  
  return Math.floor(value * units[unit]);
};

/**
 * Security headers middleware
 */
const securityHeaders = (req, res, next) => {
  // Remove server header
  res.removeHeader('X-Powered-By');
  
  // Add custom security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // Add cache control for API responses
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  
  next();
};

module.exports = {
  corsOptions,
  helmetOptions,
  rateLimitConfigs,
  ipWhitelist,
  requestLogger,
  securityErrorHandler,
  validateContentType,
  requestSizeLimit,
  securityHeaders,
  
  // Export configured middleware
  cors: cors(corsOptions),
  helmet: helmet(helmetOptions),
  generalRateLimit: rateLimitConfigs.general,
  authRateLimit: rateLimitConfigs.auth,
  passwordResetRateLimit: rateLimitConfigs.passwordReset,
  emailVerificationRateLimit: rateLimitConfigs.emailVerification,
  uploadRateLimit: rateLimitConfigs.upload,
  apiRateLimit: rateLimitConfigs.api,
  commentRateLimit: rateLimitConfigs.comment,
  aiRateLimit: rateLimitConfigs.ai
};/**

 * Input sanitization middleware
 */
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');

/**
 * Sanitize input to prevent NoSQL injection
 */
const sanitizeNoSQL = mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ req, key }) => {
    logger.warn('NoSQL injection attempt detected', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      key,
      url: req.originalUrl,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Sanitize input to prevent XSS attacks
 */
const sanitizeXSS = xss();

/**
 * Prevent HTTP Parameter Pollution
 */
const preventHPP = hpp({
  whitelist: ['tags', 'categories', 'sort', 'fields', 'page', 'limit']
});

/**
 * Advanced request validation middleware
 */
const validateRequest = (req, res, next) => {
  // Check for suspicious patterns in URL
  const suspiciousPatterns = [
    /\.\./,           // Directory traversal
    /<script/i,       // Script injection
    /javascript:/i,   // JavaScript protocol
    /vbscript:/i,     // VBScript protocol
    /onload=/i,       // Event handlers
    /onerror=/i,
    /onclick=/i,
    /eval\(/i,        // Eval function
    /expression\(/i,  // CSS expression
    /import\s/i,      // ES6 imports
    /require\(/i      // Node.js require
  ];
  
  const url = req.originalUrl;
  const userAgent = req.get('User-Agent') || '';
  
  // Check URL for suspicious patterns
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(url)) {
      logger.warn('Suspicious URL pattern detected', {
        ip: req.ip,
        userAgent,
        url,
        pattern: pattern.toString(),
        timestamp: new Date().toISOString()
      });
      
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Request contains invalid characters'
        }
      });
    }
  }
  
  // Check User-Agent for suspicious patterns
  const suspiciousUserAgents = [
    /sqlmap/i,
    /nikto/i,
    /nessus/i,
    /burp/i,
    /nmap/i,
    /masscan/i,
    /zap/i
  ];
  
  for (const pattern of suspiciousUserAgents) {
    if (pattern.test(userAgent)) {
      logger.warn('Suspicious User-Agent detected', {
        ip: req.ip,
        userAgent,
        url,
        timestamp: new Date().toISOString()
      });
      
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied'
        }
      });
    }
  }
  
  next();
};

/**
 * Brute force protection middleware
 */
const bruteForceProtection = (maxAttempts = 5, windowMs = 15 * 60 * 1000) => {
  const attempts = new Map();
  
  return (req, res, next) => {
    const key = `${req.ip}:${req.originalUrl}`;
    const now = Date.now();
    
    // Clean old entries
    for (const [k, v] of attempts.entries()) {
      if (now - v.firstAttempt > windowMs) {
        attempts.delete(k);
      }
    }
    
    const userAttempts = attempts.get(key);
    
    if (!userAttempts) {
      attempts.set(key, {
        count: 1,
        firstAttempt: now
      });
      return next();
    }
    
    if (userAttempts.count >= maxAttempts) {
      logger.warn('Brute force attempt detected', {
        ip: req.ip,
        url: req.originalUrl,
        attempts: userAttempts.count,
        timestamp: new Date().toISOString()
      });
      
      return res.status(429).json({
        success: false,
        error: {
          code: 'TOO_MANY_ATTEMPTS',
          message: 'Too many failed attempts. Please try again later.'
        }
      });
    }
    
    userAttempts.count++;
    next();
  };
};

/**
 * API key validation middleware
 */
const validateApiKey = (req, res, next) => {
  const apiKey = req.get('X-API-Key');
  const validApiKeys = process.env.API_KEYS ? process.env.API_KEYS.split(',') : [];
  
  if (validApiKeys.length === 0) {
    return next(); // No API key validation if not configured
  }
  
  if (!apiKey || !validApiKeys.includes(apiKey)) {
    logger.warn('Invalid API key attempt', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      url: req.originalUrl,
      providedKey: apiKey ? 'PROVIDED' : 'MISSING',
      timestamp: new Date().toISOString()
    });
    
    return res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_API_KEY',
        message: 'Invalid or missing API key'
      }
    });
  }
  
  next();
};

/**
 * Comprehensive security middleware stack
 */
const securityMiddlewareStack = [
  securityHeaders,
  helmet(helmetOptions),
  cors(corsOptions),
  validateRequest,
  sanitizeNoSQL,
  sanitizeXSS,
  preventHPP,
  requestLogger,
  securityErrorHandler
];

/**
 * Admin security middleware stack
 */
const adminSecurityStack = [
  ...securityMiddlewareStack,
  ipWhitelist(process.env.ADMIN_ALLOWED_IPS ? process.env.ADMIN_ALLOWED_IPS.split(',') : []),
  bruteForceProtection(3, 30 * 60 * 1000) // 3 attempts per 30 minutes for admin
];

module.exports = {
  // ... existing exports
  corsOptions,
  helmetOptions,
  rateLimitConfigs,
  ipWhitelist,
  requestLogger,
  securityErrorHandler,
  validateContentType,
  requestSizeLimit,
  securityHeaders,
  
  // New security features
  sanitizeNoSQL,
  sanitizeXSS,
  preventHPP,
  validateRequest,
  bruteForceProtection,
  validateApiKey,
  securityMiddlewareStack,
  adminSecurityStack,
  
  // Export configured middleware
  cors: cors(corsOptions),
  helmet: helmet(helmetOptions),
  generalRateLimit: rateLimitConfigs.general,
  authRateLimit: rateLimitConfigs.auth,
  passwordResetRateLimit: rateLimitConfigs.passwordReset,
  emailVerificationRateLimit: rateLimitConfigs.emailVerification,
  uploadRateLimit: rateLimitConfigs.upload,
  apiRateLimit: rateLimitConfigs.api,
  commentRateLimit: rateLimitConfigs.comment,
  aiRateLimit: rateLimitConfigs.ai
};