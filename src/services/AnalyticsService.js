const Article = require('../models/Article');
const User = require('../models/User');
const Comment = require('../models/Comment');
const Category = require('../models/Category');
const redisClient = require('../config/redis');
const logger = require('../config/logger');

/**
 * Analytics Service untuk tracking dan reporting
 */
class AnalyticsService {
  
  /**
   * Track page view
   * @param {Object} data - View tracking data
   */
  static async trackPageView(data) {
    try {
      const {
        articleId,
        userId = null,
        ipAddress,
        userAgent,
        referrer = 'direct',
        country = null,
        device = 'desktop'
      } = data;
      
      // Track in real-time using Redis
      if (redisClient.isClientConnected()) {
        const today = new Date().toISOString().split('T')[0];
        const hour = new Date().getHours();
        
        // Increment counters
        await Promise.all([
          // Daily views
          redisClient.getClient().incr(`views:daily:${today}`),
          // Hourly views
          redisClient.getClient().incr(`views:hourly:${today}:${hour}`),
          // Article views
          articleId && redisClient.getClient().incr(`views:article:${articleId}`),
          // User views (if logged in)
          userId && redisClient.getClient().incr(`views:user:${userId}`),
          // Referrer tracking
          redisClient.getClient().incr(`views:referrer:${referrer}`),
          // Country tracking
          country && redisClient.getClient().incr(`views:country:${country}`),
          // Device tracking
          redisClient.getClient().incr(`views:device:${device}`)
        ]);
        
        // Set expiry for daily counters (30 days)
        await redisClient.getClient().expire(`views:daily:${today}`, 30 * 24 * 60 * 60);
        await redisClient.getClient().expire(`views:hourly:${today}:${hour}`, 7 * 24 * 60 * 60);
      }
      
      // Update article view count in database
      if (articleId) {
        const article = await Article.findById(articleId);
        if (article) {
          await article.incrementViews(country, device, referrer);
        }
      }
      
    } catch (error) {
      logger.error('Track page view error:', error);
    }
  }
  
  /**
   * Track user engagement
   * @param {Object} data - Engagement tracking data
   */
  static async trackEngagement(data) {
    try {
      const {
        type, // like, share, comment, bookmark
        articleId,
        userId,
        value = 1
      } = data;
      
      if (redisClient.isClientConnected()) {
        const today = new Date().toISOString().split('T')[0];
        
        await Promise.all([
          // Daily engagement
          redisClient.getClient().incrby(`engagement:daily:${today}:${type}`, value),
          // Article engagement
          articleId && redisClient.getClient().incrby(`engagement:article:${articleId}:${type}`, value),
          // User engagement
          userId && redisClient.getClient().incrby(`engagement:user:${userId}:${type}`, value)
        ]);
        
        // Set expiry
        await redisClient.getClient().expire(`engagement:daily:${today}:${type}`, 30 * 24 * 60 * 60);
      }
      
      // Update article engagement in database
      if (articleId && ['likes', 'shares', 'comments'].includes(type)) {
        const article = await Article.findById(articleId);
        if (article) {
          await article.incrementEngagement(type, value);
        }
      }
      
    } catch (error) {
      logger.error('Track engagement error:', error);
    }
  }
  
  /**
   * Get real-time statistics
   * @returns {Object} Real-time stats
   */
  static async getRealTimeStats() {
    try {
      if (!redisClient.isClientConnected()) {
        return this.getFallbackStats();
      }
      
      const today = new Date().toISOString().split('T')[0];
      const currentHour = new Date().getHours();
      
      const [
        dailyViews,
        hourlyViews,
        dailyLikes,
        dailyShares,
        dailyComments
      ] = await Promise.all([
        redisClient.getClient().get(`views:daily:${today}`),
        redisClient.getClient().get(`views:hourly:${today}:${currentHour}`),
        redisClient.getClient().get(`engagement:daily:${today}:likes`),
        redisClient.getClient().get(`engagement:daily:${today}:shares`),
        redisClient.getClient().get(`engagement:daily:${today}:comments`)
      ]);
      
      return {
        today: {
          views: parseInt(dailyViews) || 0,
          likes: parseInt(dailyLikes) || 0,
          shares: parseInt(dailyShares) || 0,
          comments: parseInt(dailyComments) || 0
        },
        currentHour: {
          views: parseInt(hourlyViews) || 0
        },
        timestamp: new Date()
      };
      
    } catch (error) {
      logger.error('Get real-time stats error:', error);
      return this.getFallbackStats();
    }
  }
  
  /**
   * Get analytics dashboard data
   * @param {Object} options - Query options
   * @returns {Object} Dashboard data
   */
  static async getDashboardData(options = {}) {
    try {
      const {
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate = new Date(),
        userId = null
      } = options;
      
      // Get comprehensive statistics
      const [
        articleStats,
        userStats,
        commentStats,
        categoryStats,
        topArticles,
        topCategories,
        recentActivity,
        engagementTrends
      ] = await Promise.all([
        this.getArticleStats(startDate, endDate, userId),
        this.getUserStats(startDate, endDate),
        this.getCommentStats(startDate, endDate),
        this.getCategoryStats(startDate, endDate),
        this.getTopArticles(startDate, endDate, userId),
        this.getTopCategories(startDate, endDate),
        this.getRecentActivity(userId),
        this.getEngagementTrends(startDate, endDate, userId)
      ]);
      
      return {
        overview: {
          articles: articleStats,
          users: userStats,
          comments: commentStats,
          categories: categoryStats
        },
        topContent: {
          articles: topArticles,
          categories: topCategories
        },
        trends: engagementTrends,
        recentActivity,
        period: {
          startDate,
          endDate
        },
        generatedAt: new Date()
      };
      
    } catch (error) {
      logger.error('Get dashboard data error:', error);
      throw error;
    }
  }
  
  /**
   * Get article statistics
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {String} userId - User ID filter
   * @returns {Object} Article stats
   */
  static async getArticleStats(startDate, endDate, userId = null) {
    const matchQuery = {
      createdAt: { $gte: startDate, $lte: endDate }
    };
    
    if (userId) {
      matchQuery.penulis = userId;
    }
    
    const stats = await Article.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          published: { $sum: { $cond: [{ $eq: ['$status', 'published'] }, 1, 0] } },
          draft: { $sum: { $cond: [{ $eq: ['$status', 'draft'] }, 1, 0] } },
          totalViews: { $sum: '$metadata.views' },
          totalLikes: { $sum: '$metadata.likes' },
          totalShares: { $sum: '$metadata.shares' },
          totalComments: { $sum: '$metadata.comments' },
          avgViews: { $avg: '$metadata.views' },
          avgReadTime: { $avg: '$metadata.readTime' }
        }
      }
    ]);
    
    return stats[0] || {
      total: 0,
      published: 0,
      draft: 0,
      totalViews: 0,
      totalLikes: 0,
      totalShares: 0,
      totalComments: 0,
      avgViews: 0,
      avgReadTime: 0
    };
  }
  
  /**
   * Get user statistics
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Object} User stats
   */
  static async getUserStats(startDate, endDate) {
    const stats = await User.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: { $sum: { $cond: ['$isActive', 1, 0] } },
          newUsers: {
            $sum: {
              $cond: [
                { $and: [
                  { $gte: ['$createdAt', startDate] },
                  { $lte: ['$createdAt', endDate] }
                ]},
                1,
                0
              ]
            }
          },
          admins: { $sum: { $cond: [{ $eq: ['$role', 'admin'] }, 1, 0] } },
          authors: { $sum: { $cond: [{ $eq: ['$role', 'penulis'] }, 1, 0] } },
          readers: { $sum: { $cond: [{ $eq: ['$role', 'pembaca'] }, 1, 0] } }
        }
      }
    ]);
    
    return stats[0] || {
      total: 0,
      active: 0,
      newUsers: 0,
      admins: 0,
      authors: 0,
      readers: 0
    };
  }
  
  /**
   * Get comment statistics
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Object} Comment stats
   */
  static async getCommentStats(startDate, endDate) {
    const stats = await Comment.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          approved: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } },
          pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
          newComments: {
            $sum: {
              $cond: [
                { $and: [
                  { $gte: ['$createdAt', startDate] },
                  { $lte: ['$createdAt', endDate] }
                ]},
                1,
                0
              ]
            }
          }
        }
      }
    ]);
    
    return stats[0] || {
      total: 0,
      approved: 0,
      pending: 0,
      newComments: 0
    };
  }
  
  /**
   * Get category statistics
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Object} Category stats
   */
  static async getCategoryStats(startDate, endDate) {
    const stats = await Category.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: { $sum: { $cond: ['$isActive', 1, 0] } },
          totalArticles: { $sum: '$stats.articleCount' },
          totalViews: { $sum: '$stats.totalViews' }
        }
      }
    ]);
    
    return stats[0] || {
      total: 0,
      active: 0,
      totalArticles: 0,
      totalViews: 0
    };
  }
  
  /**
   * Get top articles
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {String} userId - User ID filter
   * @returns {Array} Top articles
   */
  static async getTopArticles(startDate, endDate, userId = null, limit = 10) {
    const matchQuery = {
      status: 'published',
      publishedAt: { $gte: startDate, $lte: endDate }
    };
    
    if (userId) {
      matchQuery.penulis = userId;
    }
    
    return await Article.find(matchQuery)
      .populate('penulis', 'username profile.nama')
      .populate('kategori', 'nama slug')
      .sort({ 'metadata.views': -1 })
      .limit(limit)
      .select('judul slug metadata publishedAt');
  }
  
  /**
   * Get top categories
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Array} Top categories
   */
  static async getTopCategories(startDate, endDate, limit = 10) {
    return await Category.find({ isActive: true })
      .sort({ 'stats.articleCount': -1, 'stats.totalViews': -1 })
      .limit(limit)
      .select('nama slug stats');
  }
  
  /**
   * Get recent activity
   * @param {String} userId - User ID filter
   * @returns {Array} Recent activities
   */
  static async getRecentActivity(userId = null, limit = 20) {
    const activities = [];
    
    // Get recent articles
    const articleQuery = userId ? { penulis: userId } : {};
    const recentArticles = await Article.find(articleQuery)
      .populate('penulis', 'username profile.nama')
      .sort({ createdAt: -1 })
      .limit(limit / 2)
      .select('judul slug status createdAt publishedAt penulis');
    
    recentArticles.forEach(article => {
      activities.push({
        type: 'article',
        action: article.status === 'published' ? 'published' : 'created',
        data: article,
        timestamp: article.publishedAt || article.createdAt,
        user: article.penulis
      });
    });
    
    // Get recent comments
    const commentQuery = userId ? { penulis: userId } : {};
    const recentComments = await Comment.find(commentQuery)
      .populate('penulis', 'username profile.nama')
      .populate('artikel', 'judul slug')
      .sort({ createdAt: -1 })
      .limit(limit / 2)
      .select('konten artikel status createdAt penulis');
    
    recentComments.forEach(comment => {
      activities.push({
        type: 'comment',
        action: 'commented',
        data: comment,
        timestamp: comment.createdAt,
        user: comment.penulis
      });
    });
    
    // Sort by timestamp and limit
    return activities
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }
  
  /**
   * Get engagement trends
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {String} userId - User ID filter
   * @returns {Array} Engagement trends
   */
  static async getEngagementTrends(startDate, endDate, userId = null) {
    const matchQuery = {
      publishedAt: { $gte: startDate, $lte: endDate }
    };
    
    if (userId) {
      matchQuery.penulis = userId;
    }
    
    const trends = await Article.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$publishedAt'
            }
          },
          views: { $sum: '$metadata.views' },
          likes: { $sum: '$metadata.likes' },
          shares: { $sum: '$metadata.shares' },
          comments: { $sum: '$metadata.comments' },
          articles: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    return trends.map(trend => ({
      date: trend._id,
      views: trend.views,
      likes: trend.likes,
      shares: trend.shares,
      comments: trend.comments,
      articles: trend.articles,
      engagement: trend.likes + trend.shares + trend.comments
    }));
  }
  
  /**
   * Get fallback statistics when Redis is unavailable
   * @returns {Object} Fallback stats
   */
  static getFallbackStats() {
    return {
      today: {
        views: 0,
        likes: 0,
        shares: 0,
        comments: 0
      },
      currentHour: {
        views: 0
      },
      timestamp: new Date()
    };
  }
  
  /**
   * Get user analytics summary
   * @param {String} userId - User ID
   * @param {Object} options - Query options
   * @returns {Object} User analytics
   */
  static async getUserAnalytics(userId, options = {}) {
    const {
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate = new Date()
    } = options;
    
    const [
      articleStats,
      topArticles,
      engagementTrends,
      recentActivity
    ] = await Promise.all([
      this.getArticleStats(startDate, endDate, userId),
      this.getTopArticles(startDate, endDate, userId, 5),
      this.getEngagementTrends(startDate, endDate, userId),
      this.getRecentActivity(userId, 10)
    ]);
    
    return {
      overview: articleStats,
      topArticles,
      trends: engagementTrends,
      recentActivity,
      period: { startDate, endDate },
      generatedAt: new Date()
    };
  }
}

module.exports = AnalyticsService;