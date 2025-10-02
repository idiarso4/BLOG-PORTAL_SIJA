const winston = require('winston');
const path = require('path');

/**
 * Monitoring and Logging Configuration
 */

// Create logs directory if it doesn't exist
const logsDir = path.join(process.cwd(), 'logs');
require('fs').mkdirSync(logsDir, { recursive: true });

// Custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss'
  }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    
    if (Object.keys(meta).length > 0) {
      msg += `\n${JSON.stringify(meta, null, 2)}`;
    }
    
    return msg;
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: {
    service: 'blog-platform',
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0'
  },
  transports: [
    // Error log file
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    }),
    
    // Combined log file
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    }),
    
    // Access log file
    new winston.transports.File({
      filename: path.join(logsDir, 'access.log'),
      level: 'http',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    })
  ],
  
  // Handle exceptions and rejections
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'exceptions.log'),
      maxsize: 5242880,
      maxFiles: 3
    })
  ],
  
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'rejections.log'),
      maxsize: 5242880,
      maxFiles: 3
    })
  ]
});

// Add console transport for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat,
    level: 'debug'
  }));
}

// Performance monitoring
class PerformanceMonitor {
  constructor() {
    this.metrics = {
      requests: {
        total: 0,
        success: 0,
        errors: 0,
        averageResponseTime: 0
      },
      memory: {
        used: 0,
        free: 0,
        total: 0
      },
      cpu: {
        usage: 0
      },
      database: {
        connections: 0,
        queries: 0,
        slowQueries: 0
      }
    };
    
    this.responseTimes = [];
    this.startTime = Date.now();
    
    // Start monitoring intervals
    this.startMemoryMonitoring();
    this.startCpuMonitoring();
  }
  
  /**
   * Record request metrics
   */
  recordRequest(responseTime, statusCode) {
    this.metrics.requests.total++;
    
    if (statusCode >= 200 && statusCode < 400) {
      this.metrics.requests.success++;
    } else {
      this.metrics.requests.errors++;
    }
    
    // Track response times (keep last 1000)
    this.responseTimes.push(responseTime);
    if (this.responseTimes.length > 1000) {
      this.responseTimes.shift();
    }
    
    // Calculate average response time
    this.metrics.requests.averageResponseTime = 
      this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length;
    
    // Log slow requests
    if (responseTime > 5000) {
      logger.warn('Slow request detected', {
        responseTime,
        statusCode,
        threshold: 5000
      });
    }
  }
  
  /**
   * Start memory monitoring
   */
  startMemoryMonitoring() {
    setInterval(() => {
      const memUsage = process.memoryUsage();
      
      this.metrics.memory = {
        used: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
        free: Math.round((memUsage.heapTotal - memUsage.heapUsed) / 1024 / 1024), // MB
        total: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
        rss: Math.round(memUsage.rss / 1024 / 1024), // MB
        external: Math.round(memUsage.external / 1024 / 1024) // MB
      };
      
      // Alert on high memory usage
      const memoryUsagePercent = (this.metrics.memory.used / this.metrics.memory.total) * 100;
      if (memoryUsagePercent > 90) {
        logger.warn('High memory usage detected', {
          usagePercent: memoryUsagePercent,
          memoryMB: this.metrics.memory.used
        });
      }
      
    }, 30000); // Every 30 seconds
  }
  
  /**
   * Start CPU monitoring
   */
  startCpuMonitoring() {
    let lastCpuUsage = process.cpuUsage();
    
    setInterval(() => {
      const currentCpuUsage = process.cpuUsage(lastCpuUsage);
      const totalUsage = currentCpuUsage.user + currentCpuUsage.system;
      
      // Calculate CPU percentage (rough estimate)
      this.metrics.cpu.usage = Math.round((totalUsage / 1000000) * 100) / 100;
      
      lastCpuUsage = process.cpuUsage();
      
      // Alert on high CPU usage
      if (this.metrics.cpu.usage > 80) {
        logger.warn('High CPU usage detected', {
          cpuUsage: this.metrics.cpu.usage
        });
      }
      
    }, 30000); // Every 30 seconds
  }
  
  /**
   * Record database query
   */
  recordDatabaseQuery(queryTime, query) {
    this.metrics.database.queries++;
    
    // Log slow queries
    if (queryTime > 1000) {
      this.metrics.database.slowQueries++;
      logger.warn('Slow database query detected', {
        queryTime,
        query: query.substring(0, 200) + (query.length > 200 ? '...' : ''),
        threshold: 1000
      });
    }
  }
  
  /**
   * Get current metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      uptime: Math.round((Date.now() - this.startTime) / 1000), // seconds
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * Get health status
   */
  getHealthStatus() {
    const metrics = this.getMetrics();
    const memoryUsagePercent = (metrics.memory.used / metrics.memory.total) * 100;
    
    let status = 'healthy';
    let issues = [];
    
    // Check memory usage
    if (memoryUsagePercent > 90) {
      status = 'unhealthy';
      issues.push('High memory usage');
    } else if (memoryUsagePercent > 75) {
      status = 'warning';
      issues.push('Elevated memory usage');
    }
    
    // Check CPU usage
    if (metrics.cpu.usage > 80) {
      status = 'unhealthy';
      issues.push('High CPU usage');
    } else if (metrics.cpu.usage > 60) {
      status = 'warning';
      issues.push('Elevated CPU usage');
    }
    
    // Check error rate
    const errorRate = metrics.requests.total > 0 ? 
      (metrics.requests.errors / metrics.requests.total) * 100 : 0;
    
    if (errorRate > 10) {
      status = 'unhealthy';
      issues.push('High error rate');
    } else if (errorRate > 5) {
      status = 'warning';
      issues.push('Elevated error rate');
    }
    
    // Check average response time
    if (metrics.requests.averageResponseTime > 5000) {
      status = 'unhealthy';
      issues.push('High response time');
    } else if (metrics.requests.averageResponseTime > 2000) {
      status = 'warning';
      issues.push('Elevated response time');
    }
    
    return {
      status,
      issues,
      metrics,
      timestamp: new Date().toISOString()
    };
  }
}

// Error tracking
class ErrorTracker {
  constructor() {
    this.errors = [];
    this.errorCounts = new Map();
  }
  
  /**
   * Track error
   */
  trackError(error, context = {}) {
    const errorInfo = {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
      context,
      timestamp: new Date().toISOString(),
      id: this.generateErrorId()
    };
    
    // Store error (keep last 1000)
    this.errors.push(errorInfo);
    if (this.errors.length > 1000) {
      this.errors.shift();
    }
    
    // Count error occurrences
    const errorKey = `${error.name}:${error.message}`;
    this.errorCounts.set(errorKey, (this.errorCounts.get(errorKey) || 0) + 1);
    
    // Log error
    logger.error('Application error tracked', errorInfo);
    
    return errorInfo.id;
  }
  
  /**
   * Generate unique error ID
   */
  generateErrorId() {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Get error statistics
   */
  getErrorStats() {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    const oneDayAgo = now - (24 * 60 * 60 * 1000);
    
    const recentErrors = this.errors.filter(err => 
      new Date(err.timestamp).getTime() > oneHourAgo
    );
    
    const dailyErrors = this.errors.filter(err => 
      new Date(err.timestamp).getTime() > oneDayAgo
    );
    
    // Get top error types
    const topErrors = Array.from(this.errorCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([error, count]) => ({ error, count }));
    
    return {
      total: this.errors.length,
      lastHour: recentErrors.length,
      lastDay: dailyErrors.length,
      topErrors,
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * Get recent errors
   */
  getRecentErrors(limit = 50) {
    return this.errors
      .slice(-limit)
      .reverse();
  }
}

// Create instances
const performanceMonitor = new PerformanceMonitor();
const errorTracker = new ErrorTracker();

// Express middleware for request logging
const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  
  // Log request
  logger.http('Incoming request', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user ? req.user._id : null
  });
  
  // Override res.end to capture response
  const originalEnd = res.end;
  res.end = function(chunk, encoding) {
    const responseTime = Date.now() - startTime;
    
    // Record metrics
    performanceMonitor.recordRequest(responseTime, res.statusCode);
    
    // Log response
    logger.http('Request completed', {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      contentLength: res.get('Content-Length'),
      userId: req.user ? req.user._id : null
    });
    
    originalEnd.call(this, chunk, encoding);
  };
  
  next();
};

// Error handling middleware
const errorHandler = (err, req, res, next) => {
  // Track error
  const errorId = errorTracker.trackError(err, {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user ? req.user._id : null,
    body: req.body,
    params: req.params,
    query: req.query
  });
  
  // Log error with context
  logger.error('Request error', {
    errorId,
    message: err.message,
    stack: err.stack,
    method: req.method,
    url: req.originalUrl,
    statusCode: err.statusCode || 500
  });
  
  // Send error response
  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : err.message;
  
  res.status(statusCode).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message,
      errorId: process.env.NODE_ENV !== 'production' ? errorId : undefined
    }
  });
};

module.exports = {
  logger,
  performanceMonitor,
  errorTracker,
  requestLogger,
  errorHandler
};