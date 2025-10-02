const AnalyticsService = require('../services/AnalyticsService');
const { validationResult } = require('express-validator');
const logger = require('../config/logger');

/**
 * Analytics Controller
 */
class AnalyticsController {
  
  /**
   * Track page view (public endpoint)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async trackView(req, res) {
    try {
      const { articleId, referrer } = req.body;
      
      // Extract visitor information
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent') || '';
      const country = req.get('CF-IPCountry') || req.get('X-Country') || null;
      
      // Determine device type
      const device = userAgent.includes('Mobile') ? 'mobile' : 
                    userAgent.includes('Tablet') ? 'tablet' : 'desktop';
      
      // Track the view
      await AnalyticsService.trackPageView({
        articleId,
        userId: req.user?._id || null,
        ipAddress,
        userAgent,
        referrer: referrer || 'direct',
        country,
        device
      });
      
      res.json({
        success: true,
        message: 'View tracked successfully'
      });
      
    } catch (error) {
      logger.error('Track view error:', error);
      
      // Don't fail the request for tracking errors
      res.json({
        success: false,
        message: 'Tracking failed'
      });
    }
  }
  
  /**
   * Track engagement (authenticated)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async trackEngagement(req, res) {
    try {
      const { type, articleId, value = 1 } = req.body;
      
      if (!['like', 'share', 'comment', 'bookmark'].includes(type)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_ENGAGEMENT_TYPE',
            message: 'Tipe engagement tidak valid'
          }
        });
      }
      
      await AnalyticsService.trackEngagement({
        type,
        articleId,
        userId: req.user._id,
        value
      });
      
      res.json({
        success: true,
        message: 'Engagement tracked successfully'
      });
      
    } catch (error) {
      logger.error('Track engagement error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'TRACK_ENGAGEMENT_ERROR',
          message: 'Terjadi kesalahan saat tracking engagement'
        }
      });
    }
  }
  
  /**
   * Get real-time statistics (admin only)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getRealTimeStats(req, res) {
    try {
      const stats = await AnalyticsService.getRealTimeStats();
      
      res.json({
        success: true,
        data: stats
      });
      
    } catch (error) {
      logger.error('Get real-time stats error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'REALTIME_STATS_ERROR',
          message: 'Terjadi kesalahan saat mengambil statistik real-time'
        }
      });
    }
  }
  
  /**
   * Get analytics dashboard (admin/author)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getDashboard(req, res) {
    try {
      const {
        startDate,
        endDate,
        period = '30d'
      } = req.query;
      
      let start, end;
      
      if (startDate && endDate) {
        start = new Date(startDate);
        end = new Date(endDate);
      } else {
        // Parse period
        const days = parseInt(period.replace('d', '')) || 30;
        end = new Date();
        start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      }
      
      // For non-admin users, filter by their content only
      const userId = req.user.role === 'admin' ? null : req.user._id;
      
      const dashboardData = await AnalyticsService.getDashboardData({
        startDate: start,
        endDate: end,
        userId
      });
      
      res.json({
        success: true,
        data: dashboardData
      });
      
    } catch (error) {
      logger.error('Get dashboard error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'DASHBOARD_ERROR',
          message: 'Terjadi kesalahan saat mengambil data dashboard'
        }
      });
    }
  }
  
  /**
   * Get user analytics (authenticated)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getUserAnalytics(req, res) {
    try {
      const {
        startDate,
        endDate,
        period = '30d'
      } = req.query;
      
      let start, end;
      
      if (startDate && endDate) {
        start = new Date(startDate);
        end = new Date(endDate);
      } else {
        const days = parseInt(period.replace('d', '')) || 30;
        end = new Date();
        start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      }
      
      const analytics = await AnalyticsService.getUserAnalytics(req.user._id, {
        startDate: start,
        endDate: end
      });
      
      res.json({
        success: true,
        data: analytics
      });
      
    } catch (error) {
      logger.error('Get user analytics error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'USER_ANALYTICS_ERROR',
          message: 'Terjadi kesalahan saat mengambil analytics pengguna'
        }
      });
    }
  }
  
  /**
   * Get article analytics (author/admin)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getArticleAnalytics(req, res) {
    try {
      const { articleId } = req.params;
      const {
        startDate,
        endDate,
        period = '30d'
      } = req.query;
      
      // Verify article access
      const Article = require('../models/Article');
      const article = await Article.findById(articleId);
      
      if (!article) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'ARTICLE_NOT_FOUND',
            message: 'Artikel tidak ditemukan'
          }
        });
      }
      
      // Check ownership (author or admin)
      if (article.penulis.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: 'Anda tidak memiliki akses ke analytics artikel ini'
          }
        });
      }
      
      let start, end;
      
      if (startDate && endDate) {
        start = new Date(startDate);
        end = new Date(endDate);
      } else {
        const days = parseInt(period.replace('d', '')) || 30;
        end = new Date();
        start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      }
      
      // Get article-specific analytics
      const analytics = {
        article: {
          id: article._id,
          title: article.judul,
          slug: article.slug,
          publishedAt: article.publishedAt,
          status: article.status
        },
        metrics: {
          views: article.metadata.views,
          likes: article.metadata.likes,
          shares: article.metadata.shares,
          comments: article.metadata.comments,
          readTime: article.metadata.readTime,
          wordCount: article.metadata.wordCount,
          engagementRate: article.engagementRate
        },
        analytics: {
          dailyViews: article.analytics.dailyViews.filter(dv => 
            dv.date >= start && dv.date <= end
          ),
          referrers: article.analytics.referrers,
          countries: article.analytics.countries,
          devices: article.analytics.devices
        },
        period: { startDate: start, endDate: end },
        generatedAt: new Date()
      };
      
      res.json({
        success: true,
        data: analytics
      });
      
    } catch (error) {
      logger.error('Get article analytics error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'ARTICLE_ANALYTICS_ERROR',
          message: 'Terjadi kesalahan saat mengambil analytics artikel'
        }
      });
    }
  }
  
  /**
   * Export analytics data (admin/author)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async exportAnalytics(req, res) {
    try {
      const {
        format = 'json',
        startDate,
        endDate,
        type = 'dashboard'
      } = req.query;
      
      if (!['json', 'csv'].includes(format)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_FORMAT',
            message: 'Format harus json atau csv'
          }
        });
      }
      
      let start, end;
      
      if (startDate && endDate) {
        start = new Date(startDate);
        end = new Date(endDate);
      } else {
        end = new Date();
        start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      }
      
      const userId = req.user.role === 'admin' ? null : req.user._id;
      
      let data;
      
      switch (type) {
        case 'dashboard':
          data = await AnalyticsService.getDashboardData({
            startDate: start,
            endDate: end,
            userId
          });
          break;
          
        case 'user':
          data = await AnalyticsService.getUserAnalytics(req.user._id, {
            startDate: start,
            endDate: end
          });
          break;
          
        default:
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_TYPE',
              message: 'Tipe export tidak valid'
            }
          });
      }
      
      if (format === 'csv') {
        // Convert to CSV format
        const csv = this.convertToCSV(data);
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="analytics-${type}-${start.toISOString().split('T')[0]}-${end.toISOString().split('T')[0]}.csv"`);
        res.send(csv);
      } else {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="analytics-${type}-${start.toISOString().split('T')[0]}-${end.toISOString().split('T')[0]}.json"`);
        res.json(data);
      }
      
    } catch (error) {
      logger.error('Export analytics error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'EXPORT_ERROR',
          message: 'Terjadi kesalahan saat export analytics'
        }
      });
    }
  }
  
  /**
   * Convert analytics data to CSV format
   * @param {Object} data - Analytics data
   * @returns {String} CSV string
   */
  static convertToCSV(data) {
    // Simple CSV conversion for trends data
    if (data.trends && Array.isArray(data.trends)) {
      const headers = ['Date', 'Views', 'Likes', 'Shares', 'Comments', 'Articles', 'Engagement'];
      const rows = data.trends.map(trend => [
        trend.date,
        trend.views,
        trend.likes,
        trend.shares,
        trend.comments,
        trend.articles,
        trend.engagement
      ]);
      
      return [headers, ...rows]
        .map(row => row.join(','))
        .join('\n');
    }
    
    // Fallback to JSON string
    return JSON.stringify(data, null, 2);
  }
}

module.exports = AnalyticsController;