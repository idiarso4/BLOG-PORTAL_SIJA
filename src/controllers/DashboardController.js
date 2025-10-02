const Analytics = require('../models/Analytics');
const Article = require('../models/Article');
const User = require('../models/User');
const Comment = require('../models/Comment');
const UserSubscription = require('../models/UserSubscription');
const logger = require('../config/logger');

/**
 * Dashboard Controller
 */
class DashboardController {
  
  /**
   * Get user dashboard data (authenticated)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getUserDashboard(req, res) {
    try {
      const userId = req.user._id;
      const { period = '30d' } = req.query;
      
      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      
      switch (period) {
        case '7d':
          startDate.setDate(endDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(endDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(endDate.getDate() - 90);
          break;
        case '1y':
          startDate.setFullYear(endDate.getFullYear() - 1);
          break;
        default:
          startDate.setDate(endDate.getDate() - 30);
      }
      
      // Get user articles
      const userArticles = await Article.find({ 
        author: userId,
        createdAt: { $gte: startDate, $lte: endDate }
      }).select('_id title createdAt status');
      
      const articleIds = userArticles.map(article => article._id);
      
      // Get analytics data
      const [
        totalViews,
        totalComments,
        totalLikes,
        viewsOverTime,
        topArticles,
        recentComments
      ] = await Promise.all([
        // Total views
        Analytics.aggregate([
          {
            $match: {
              entityType: 'article',
              entityId: { $in: articleIds },
              eventType: 'view',
              createdAt: { $gte: startDate, $lte: endDate }
            }
          },
          {
            $group: {
              _id: null,
              total: { $sum: 1 }
            }
          }
        ]),
        
        // Total comments
        Comment.countDocuments({
          article: { $in: articleIds },
          createdAt: { $gte: startDate, $lte: endDate }
        }),
        
        // Total likes
        Analytics.countDocuments({
          entityType: 'article',
          entityId: { $in: articleIds },
          eventType: 'like',
          createdAt: { $gte: startDate, $lte: endDate }
        }),
        
        // Views over time
        Analytics.aggregate([
          {
            $match: {
              entityType: 'article',
              entityId: { $in: articleIds },
              eventType: 'view',
              createdAt: { $gte: startDate, $lte: endDate }
            }
          },
          {
            $group: {
              _id: {
                year: { $year: '$createdAt' },
                month: { $month: '$createdAt' },
                day: { $dayOfMonth: '$createdAt' }
              },
              views: { $sum: 1 }
            }
          },
          {
            $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
          }
        ]),
        
        // Top articles by views
        Analytics.aggregate([
          {
            $match: {
              entityType: 'article',
              entityId: { $in: articleIds },
              eventType: 'view',
              createdAt: { $gte: startDate, $lte: endDate }
            }
          },
          {
            $group: {
              _id: '$entityId',
              views: { $sum: 1 }
            }
          },
          {
            $lookup: {
              from: 'articles',
              localField: '_id',
              foreignField: '_id',
              as: 'article'
            }
          },
          {
            $unwind: '$article'
          },
          {
            $project: {
              title: '$article.title',
              slug: '$article.slug',
              views: 1
            }
          },
          {
            $sort: { views: -1 }
          },
          {
            $limit: 5
          }
        ]),
        
        // Recent comments
        Comment.find({
          article: { $in: articleIds },
          createdAt: { $gte: startDate, $lte: endDate }
        })
        .populate('author', 'username profile.nama')
        .populate('article', 'title slug')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean()
      ]);
      
      // Format data
      const dashboardData = {
        summary: {
          totalArticles: userArticles.length,
          totalViews: totalViews[0]?.total || 0,
          totalComments,
          totalLikes,
          publishedArticles: userArticles.filter(a => a.status === 'published').length,
          draftArticles: userArticles.filter(a => a.status === 'draft').length
        },
        
        charts: {
          viewsOverTime: viewsOverTime.map(item => ({
            date: `${item._id.year}-${String(item._id.month).padStart(2, '0')}-${String(item._id.day).padStart(2, '0')}`,
            views: item.views
          }))
        },
        
        topArticles: topArticles || [],
        recentComments: recentComments || [],
        
        period: {
          startDate,
          endDate,
          period
        }
      };
      
      res.json({
        success: true,
        data: dashboardData
      });
      
    } catch (error) {
      logger.error('Get user dashboard error:', error);
      
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
   * Get admin dashboard data (admin only)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getAdminDashboard(req, res) {
    try {
      const { period = '30d' } = req.query;
      
      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      
      switch (period) {
        case '7d':
          startDate.setDate(endDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(endDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(endDate.getDate() - 90);
          break;
        case '1y':
          startDate.setFullYear(endDate.getFullYear() - 1);
          break;
        default:
          startDate.setDate(endDate.getDate() - 30);
      }
      
      // Get comprehensive analytics
      const [
        totalUsers,
        totalArticles,
        totalViews,
        totalComments,
        activeUsers,
        newUsers,
        publishedArticles,
        subscriptionStats,
        topAuthors,
        popularArticles,
        userGrowth,
        articleGrowth,
        viewsOverTime
      ] = await Promise.all([
        // Total users
        User.countDocuments(),
        
        // Total articles
        Article.countDocuments(),
        
        // Total views
        Analytics.countDocuments({
          eventType: 'view',
          createdAt: { $gte: startDate, $lte: endDate }
        }),
        
        // Total comments
        Comment.countDocuments({
          createdAt: { $gte: startDate, $lte: endDate }
        }),
        
        // Active users (users who logged in within period)
        Analytics.distinct('userId', {
          eventType: 'login',
          createdAt: { $gte: startDate, $lte: endDate }
        }).then(users => users.length),
        
        // New users
        User.countDocuments({
          createdAt: { $gte: startDate, $lte: endDate }
        }),
        
        // Published articles in period
        Article.countDocuments({
          status: 'published',
          createdAt: { $gte: startDate, $lte: endDate }
        }),
        
        // Subscription statistics
        UserSubscription.getStatistics({ startDate, endDate }),
        
        // Top authors by article count
        Article.aggregate([
          {
            $match: {
              status: 'published',
              createdAt: { $gte: startDate, $lte: endDate }
            }
          },
          {
            $group: {
              _id: '$author',
              articleCount: { $sum: 1 }
            }
          },
          {
            $lookup: {
              from: 'users',
              localField: '_id',
              foreignField: '_id',
              as: 'author'
            }
          },
          {
            $unwind: '$author'
          },
          {
            $project: {
              username: '$author.username',
              nama: '$author.profile.nama',
              articleCount: 1
            }
          },
          {
            $sort: { articleCount: -1 }
          },
          {
            $limit: 10
          }
        ]),
        
        // Popular articles by views
        Analytics.aggregate([
          {
            $match: {
              entityType: 'article',
              eventType: 'view',
              createdAt: { $gte: startDate, $lte: endDate }
            }
          },
          {
            $group: {
              _id: '$entityId',
              views: { $sum: 1 }
            }
          },
          {
            $lookup: {
              from: 'articles',
              localField: '_id',
              foreignField: '_id',
              as: 'article'
            }
          },
          {
            $unwind: '$article'
          },
          {
            $lookup: {
              from: 'users',
              localField: 'article.author',
              foreignField: '_id',
              as: 'author'
            }
          },
          {
            $unwind: '$author'
          },
          {
            $project: {
              title: '$article.title',
              slug: '$article.slug',
              author: '$author.username',
              views: 1
            }
          },
          {
            $sort: { views: -1 }
          },
          {
            $limit: 10
          }
        ]),
        
        // User growth over time
        User.aggregate([
          {
            $match: {
              createdAt: { $gte: startDate, $lte: endDate }
            }
          },
          {
            $group: {
              _id: {
                year: { $year: '$createdAt' },
                month: { $month: '$createdAt' },
                day: { $dayOfMonth: '$createdAt' }
              },
              newUsers: { $sum: 1 }
            }
          },
          {
            $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
          }
        ]),
        
        // Article growth over time
        Article.aggregate([
          {
            $match: {
              status: 'published',
              createdAt: { $gte: startDate, $lte: endDate }
            }
          },
          {
            $group: {
              _id: {
                year: { $year: '$createdAt' },
                month: { $month: '$createdAt' },
                day: { $dayOfMonth: '$createdAt' }
              },
              newArticles: { $sum: 1 }
            }
          },
          {
            $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
          }
        ]),
        
        // Views over time
        Analytics.aggregate([
          {
            $match: {
              eventType: 'view',
              createdAt: { $gte: startDate, $lte: endDate }
            }
          },
          {
            $group: {
              _id: {
                year: { $year: '$createdAt' },
                month: { $month: '$createdAt' },
                day: { $dayOfMonth: '$createdAt' }
              },
              views: { $sum: 1 }
            }
          },
          {
            $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
          }
        ])
      ]);
      
      // Format dashboard data
      const dashboardData = {
        summary: {
          totalUsers,
          totalArticles,
          totalViews,
          totalComments,
          activeUsers,
          newUsers,
          publishedArticles,
          subscriptions: {
            total: subscriptionStats.totalSubscriptions,
            active: subscriptionStats.activeSubscriptions,
            revenue: subscriptionStats.totalRevenue
          }
        },
        
        charts: {
          userGrowth: userGrowth.map(item => ({
            date: `${item._id.year}-${String(item._id.month).padStart(2, '0')}-${String(item._id.day).padStart(2, '0')}`,
            newUsers: item.newUsers
          })),
          
          articleGrowth: articleGrowth.map(item => ({
            date: `${item._id.year}-${String(item._id.month).padStart(2, '0')}-${String(item._id.day).padStart(2, '0')}`,
            newArticles: item.newArticles
          })),
          
          viewsOverTime: viewsOverTime.map(item => ({
            date: `${item._id.year}-${String(item._id.month).padStart(2, '0')}-${String(item._id.day).padStart(2, '0')}`,
            views: item.views
          }))
        },
        
        topAuthors: topAuthors || [],
        popularArticles: popularArticles || [],
        
        period: {
          startDate,
          endDate,
          period
        }
      };
      
      res.json({
        success: true,
        data: dashboardData
      });
      
    } catch (error) {
      logger.error('Get admin dashboard error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'ADMIN_DASHBOARD_ERROR',
          message: 'Terjadi kesalahan saat mengambil data admin dashboard'
        }
      });
    }
  }
  
  /**
   * Export analytics data (authenticated)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async exportAnalytics(req, res) {
    try {
      const { 
        format = 'json',
        period = '30d',
        type = 'user' // user or admin
      } = req.query;
      
      // Check admin access for admin exports
      if (type === 'admin' && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: 'Akses ditolak untuk export admin data'
          }
        });
      }
      
      // Get dashboard data
      const dashboardData = type === 'admin' 
        ? await DashboardController.getAdminDashboardData(req)
        : await DashboardController.getUserDashboardData(req);
      
      // Format based on export type
      if (format === 'csv') {
        const csv = DashboardController.formatAsCSV(dashboardData, type);
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="analytics-${type}-${period}-${Date.now()}.csv"`);
        res.send(csv);
        
      } else {
        // JSON format
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="analytics-${type}-${period}-${Date.now()}.json"`);
        res.json({
          success: true,
          exportedAt: new Date(),
          type,
          period,
          data: dashboardData
        });
      }
      
    } catch (error) {
      logger.error('Export analytics error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'EXPORT_ERROR',
          message: 'Terjadi kesalahan saat export data analytics'
        }
      });
    }
  }
  
  /**
   * Helper: Get user dashboard data (internal)
   */
  static async getUserDashboardData(req) {
    // Implementation similar to getUserDashboard but returns data instead of response
    // This is a simplified version for export functionality
    const userId = req.user._id;
    const { period = '30d' } = req.query;
    
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    
    switch (period) {
      case '7d':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(endDate.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
      default:
        startDate.setDate(endDate.getDate() - 30);
    }
    
    const userArticles = await Article.find({ 
      author: userId,
      createdAt: { $gte: startDate, $lte: endDate }
    }).select('_id title createdAt status');
    
    return {
      summary: {
        totalArticles: userArticles.length,
        publishedArticles: userArticles.filter(a => a.status === 'published').length,
        draftArticles: userArticles.filter(a => a.status === 'draft').length
      },
      period: { startDate, endDate, period }
    };
  }
  
  /**
   * Helper: Get admin dashboard data (internal)
   */
  static async getAdminDashboardData(req) {
    // Simplified version for export
    const totalUsers = await User.countDocuments();
    const totalArticles = await Article.countDocuments();
    
    return {
      summary: {
        totalUsers,
        totalArticles
      }
    };
  }
  
  /**
   * Helper: Format data as CSV
   */
  static formatAsCSV(data, type) {
    if (type === 'admin') {
      return `Metric,Value\nTotal Users,${data.summary.totalUsers}\nTotal Articles,${data.summary.totalArticles}`;
    } else {
      return `Metric,Value\nTotal Articles,${data.summary.totalArticles}\nPublished Articles,${data.summary.publishedArticles}\nDraft Articles,${data.summary.draftArticles}`;
    }
  }
}

module.exports = DashboardController;