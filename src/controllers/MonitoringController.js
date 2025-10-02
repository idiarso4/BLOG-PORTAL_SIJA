const { performanceMonitor, errorTracker, logger } = require('../config/monitoring');
const os = require('os');
const mongoose = require('mongoose');

/**
 * Monitoring Controller
 */
class MonitoringController {
  
  /**
   * Get system health status
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getHealth(req, res) {
    try {
      const health = performanceMonitor.getHealthStatus();
      
      // Add database connection status
      health.database = {
        connected: mongoose.connection.readyState === 1,
        state: mongoose.connection.readyState
      };
      
      // Add system info
      health.system = {
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version,
        uptime: process.uptime(),
        loadAverage: os.loadavg(),
        totalMemory: Math.round(os.totalmem() / 1024 / 1024), // MB
        freeMemory: Math.round(os.freemem() / 1024 / 1024) // MB
      };
      
      const statusCode = health.status === 'healthy' ? 200 : 
                        health.status === 'warning' ? 200 : 503;
      
      res.status(statusCode).json({
        success: true,
        data: health
      });
      
    } catch (error) {
      logger.error('Health check error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'HEALTH_CHECK_ERROR',
          message: 'Failed to get health status'
        }
      });
    }
  }
  
  /**
   * Get performance metrics
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getMetrics(req, res) {
    try {
      const metrics = performanceMonitor.getMetrics();
      
      // Add additional system metrics
      metrics.system = {
        cpus: os.cpus().length,
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version,
        uptime: process.uptime(),
        loadAverage: os.loadavg(),
        networkInterfaces: Object.keys(os.networkInterfaces()).length
      };
      
      // Add database metrics
      if (mongoose.connection.readyState === 1) {
        metrics.database.connected = true;
        metrics.database.connections = mongoose.connections.length;
      } else {
        metrics.database.connected = false;
      }
      
      res.json({
        success: true,
        data: metrics
      });
      
    } catch (error) {
      logger.error('Get metrics error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'METRICS_ERROR',
          message: 'Failed to get performance metrics'
        }
      });
    }
  }
  
  /**
   * Get error statistics
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getErrorStats(req, res) {
    try {
      const errorStats = errorTracker.getErrorStats();
      
      res.json({
        success: true,
        data: errorStats
      });
      
    } catch (error) {
      logger.error('Get error stats error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'ERROR_STATS_ERROR',
          message: 'Failed to get error statistics'
        }
      });
    }
  }
  
  /**
   * Get recent errors (admin only)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getRecentErrors(req, res) {
    try {
      const { limit = 50 } = req.query;
      
      const recentErrors = errorTracker.getRecentErrors(parseInt(limit));
      
      res.json({
        success: true,
        data: {
          errors: recentErrors,
          total: recentErrors.length
        }
      });
      
    } catch (error) {
      logger.error('Get recent errors error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'RECENT_ERRORS_ERROR',
          message: 'Failed to get recent errors'
        }
      });
    }
  }
  
  /**
   * Get system information (admin only)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getSystemInfo(req, res) {
    try {
      const systemInfo = {
        // Operating System
        os: {
          platform: os.platform(),
          arch: os.arch(),
          release: os.release(),
          type: os.type(),
          hostname: os.hostname(),
          uptime: os.uptime(),
          loadAverage: os.loadavg(),
          totalMemory: os.totalmem(),
          freeMemory: os.freemem(),
          cpus: os.cpus()
        },
        
        // Node.js Process
        process: {
          version: process.version,
          platform: process.platform,
          arch: process.arch,
          uptime: process.uptime(),
          pid: process.pid,
          ppid: process.ppid,
          cwd: process.cwd(),
          execPath: process.execPath,
          memoryUsage: process.memoryUsage(),
          cpuUsage: process.cpuUsage(),
          env: {
            NODE_ENV: process.env.NODE_ENV,
            PORT: process.env.PORT,
            TZ: process.env.TZ
          }
        },
        
        // Database
        database: {
          connected: mongoose.connection.readyState === 1,
          readyState: mongoose.connection.readyState,
          host: mongoose.connection.host,
          port: mongoose.connection.port,
          name: mongoose.connection.name,
          collections: mongoose.connection.collections ? 
            Object.keys(mongoose.connection.collections).length : 0
        },
        
        // Application
        application: {
          name: process.env.APP_NAME || 'Blog Platform',
          version: process.env.npm_package_version || '1.0.0',
          environment: process.env.NODE_ENV || 'development',
          startTime: new Date(Date.now() - process.uptime() * 1000).toISOString()
        }
      };
      
      res.json({
        success: true,
        data: systemInfo
      });
      
    } catch (error) {
      logger.error('Get system info error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'SYSTEM_INFO_ERROR',
          message: 'Failed to get system information'
        }
      });
    }
  }
  
  /**
   * Clear error logs (admin only)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async clearErrorLogs(req, res) {
    try {
      // Clear error tracker
      errorTracker.errors = [];
      errorTracker.errorCounts.clear();
      
      logger.info('Error logs cleared by admin', {
        adminId: req.user._id,
        timestamp: new Date().toISOString()
      });
      
      res.json({
        success: true,
        message: 'Error logs cleared successfully'
      });
      
    } catch (error) {
      logger.error('Clear error logs error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'CLEAR_LOGS_ERROR',
          message: 'Failed to clear error logs'
        }
      });
    }
  }
  
  /**
   * Test error logging (admin only, development only)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async testError(req, res) {
    try {
      if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({
          success: false,
          error: {
            code: 'NOT_ALLOWED_IN_PRODUCTION',
            message: 'Error testing not allowed in production'
          }
        });
      }
      
      const { type = 'generic', message = 'Test error' } = req.body;
      
      let testError;
      
      switch (type) {
        case 'validation':
          testError = new Error(message);
          testError.name = 'ValidationError';
          testError.statusCode = 400;
          break;
        case 'auth':
          testError = new Error(message);
          testError.name = 'AuthenticationError';
          testError.statusCode = 401;
          break;
        case 'permission':
          testError = new Error(message);
          testError.name = 'PermissionError';
          testError.statusCode = 403;
          break;
        case 'notfound':
          testError = new Error(message);
          testError.name = 'NotFoundError';
          testError.statusCode = 404;
          break;
        default:
          testError = new Error(message);
          testError.name = 'TestError';
          testError.statusCode = 500;
      }
      
      // Track the test error
      const errorId = errorTracker.trackError(testError, {
        testError: true,
        adminId: req.user._id,
        type
      });
      
      res.json({
        success: true,
        message: 'Test error generated successfully',
        data: {
          errorId,
          type,
          message
        }
      });
      
    } catch (error) {
      logger.error('Test error generation failed:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'TEST_ERROR_FAILED',
          message: 'Failed to generate test error'
        }
      });
    }
  }
}

module.exports = MonitoringController;