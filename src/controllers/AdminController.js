const User = require('../models/User');
const Article = require('../models/Article');
const Comment = require('../models/Comment');
const Category = require('../models/Category');
const JwtService = require('../services/JwtService');
const EmailService = require('../services/EmailService');
const { validationResult } = require('express-validator');
const logger = require('../config/logger');

/**
 * Admin Controller
 */
class AdminController {
  
  /**
   * Get all users (admin only)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getUsers(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        role,
        status,
        search,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;
      
      const options = {
        page: parseInt(page),
        limit: Math.min(parseInt(limit), 100),
        sort: {}
      };
      
      options.sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
      
      // Build query
      let query = {};
      
      if (role) query.role = role;
      if (status === 'active') query.isActive = true;
      if (status === 'inactive') query.isActive = false;
      if (status === 'locked') query.isLocked = true;
      
      if (search) {
        query.$or = [
          { username: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { 'profile.nama': { $regex: search, $options: 'i' } }
        ];
      }
      
      const users = await User.find(query)
        .select('-password')
        .limit(options.limit)
        .skip((options.page - 1) * options.limit)
        .sort(options.sort);
      
      const total = await User.countDocuments(query);
      
      // Get additional stats for each user
      const usersWithStats = await Promise.all(
        users.map(async (user) => {
          const [articleCount, commentCount] = await Promise.all([
            Article.countDocuments({ penulis: user._id }),
            Comment.countDocuments({ penulis: user._id, status: 'approved' })
          ]);
          
          return {
            ...user.toObject(),
            stats: {
              articlesCount: articleCount,
              commentsCount: commentCount
            }
          };
        })
      );
      
      res.json({
        success: true,
        data: {
          users: usersWithStats,
          pagination: {
            page: options.page,
            limit: options.limit,
            total,
            pages: Math.ceil(total / options.limit)
          }
        }
      });
      
    } catch (error) {
      logger.error('Get users error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'GET_USERS_ERROR',
          message: 'Terjadi kesalahan saat mengambil data pengguna'
        }
      });
    }
  }
  
  /**
   * Get single user details (admin only)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getUser(req, res) {
    try {
      const { id } = req.params;
      
      const user = await User.findById(id)
        .select('-password')
        .populate('referredBy', 'username profile.nama');
      
      if (!user) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'Pengguna tidak ditemukan'
          }
        });
      }
      
      // Get comprehensive statistics
      const [
        articleStats,
        commentStats,
        totalViews,
        recentArticles,
        recentComments,
        referralCount
      ] = await Promise.all([
        Article.aggregate([
          { $match: { penulis: user._id } },
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 }
            }
          }
        ]),
        Comment.aggregate([
          { $match: { penulis: user._id } },
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 }
            }
          }
        ]),
        Article.aggregate([
          { $match: { penulis: user._id } },
          { $group: { _id: null, total: { $sum: '$metadata.views' } } }
        ]),
        Article.find({ penulis: user._id })
          .sort({ createdAt: -1 })
          .limit(5)
          .select('judul slug status createdAt publishedAt'),
        Comment.find({ penulis: user._id })
          .populate('artikel', 'judul slug')
          .sort({ createdAt: -1 })
          .limit(5)
          .select('konten artikel status createdAt'),
        User.countDocuments({ referredBy: user._id })
      ]);
      
      // Format statistics
      const stats = {
        articles: {
          total: articleStats.reduce((sum, stat) => sum + stat.count, 0),
          published: articleStats.find(s => s._id === 'published')?.count || 0,
          draft: articleStats.find(s => s._id === 'draft')?.count || 0,
          archived: articleStats.find(s => s._id === 'archived')?.count || 0
        },
        comments: {
          total: commentStats.reduce((sum, stat) => sum + stat.count, 0),
          approved: commentStats.find(s => s._id === 'approved')?.count || 0,
          pending: commentStats.find(s => s._id === 'pending')?.count || 0,
          rejected: commentStats.find(s => s._id === 'rejected')?.count || 0
        },
        engagement: {
          totalViews: totalViews[0]?.total || 0,
          referrals: referralCount
        },
        recentActivity: {
          articles: recentArticles,
          comments: recentComments
        }
      };
      
      res.json({
        success: true,
        data: {
          user: {
            ...user.toObject(),
            stats
          }
        }
      });
      
    } catch (error) {
      logger.error('Get user error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'GET_USER_ERROR',
          message: 'Terjadi kesalahan saat mengambil data pengguna'
        }
      });
    }
  }
  
  /**
   * Update user role (admin only)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async updateUserRole(req, res) {
    try {
      const { id } = req.params;
      const { role } = req.body;
      
      if (!['admin', 'penulis', 'pembaca'].includes(role)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_ROLE',
            message: 'Role harus salah satu dari: admin, penulis, pembaca'
          }
        });
      }
      
      const user = await User.findById(id);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'Pengguna tidak ditemukan'
          }
        });
      }
      
      // Prevent self-demotion from admin
      if (user._id.toString() === req.user._id.toString() && role !== 'admin') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'CANNOT_DEMOTE_SELF',
            message: 'Tidak dapat mengubah role diri sendiri'
          }
        });
      }
      
      const oldRole = user.role;
      user.role = role;
      await user.save();
      
      // Revoke all refresh tokens to force re-login with new role
      await JwtService.revokeAllRefreshTokens(user._id);
      
      // Log role change
      logger.info('User role updated', {
        userId: user._id,
        adminId: req.user._id,
        oldRole,
        newRole: role
      });
      
      // Send notification email
      try {
        await EmailService.sendRoleChangeNotification(
          user.email,
          user.profile.nama,
          oldRole,
          role
        );
      } catch (emailError) {
        logger.error('Failed to send role change notification:', emailError);
      }
      
      res.json({
        success: true,
        message: 'Role pengguna berhasil diperbarui',
        data: {
          user: {
            id: user._id,
            username: user.username,
            role: user.role
          }
        }
      });
      
    } catch (error) {
      logger.error('Update user role error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'UPDATE_ROLE_ERROR',
          message: 'Terjadi kesalahan saat memperbarui role pengguna'
        }
      });
    }
  }
  
  /**
   * Block/unblock user (admin only)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async toggleUserStatus(req, res) {
    try {
      const { id } = req.params;
      const { action, reason = '' } = req.body;
      
      if (!['block', 'unblock', 'activate', 'deactivate'].includes(action)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_ACTION',
            message: 'Action harus salah satu dari: block, unblock, activate, deactivate'
          }
        });
      }
      
      const user = await User.findById(id);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'Pengguna tidak ditemukan'
          }
        });
      }
      
      // Prevent action on self
      if (user._id.toString() === req.user._id.toString()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'CANNOT_ACTION_SELF',
            message: 'Tidak dapat melakukan aksi pada diri sendiri'
          }
        });
      }
      
      // Prevent action on other admins
      if (user.role === 'admin' && req.user.role === 'admin') {
        return res.status(403).json({
          success: false,
          error: {
            code: 'CANNOT_ACTION_ADMIN',
            message: 'Tidak dapat melakukan aksi pada admin lain'
          }
        });
      }
      
      let message;
      
      switch (action) {
        case 'block':
          user.isLocked = true;
          user.lockUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
          message = 'Pengguna berhasil diblokir';
          break;
        case 'unblock':
          user.isLocked = false;
          user.lockUntil = undefined;
          user.loginAttempts = 0;
          message = 'Pengguna berhasil dibuka blokirnya';
          break;
        case 'activate':
          user.isActive = true;
          message = 'Pengguna berhasil diaktifkan';
          break;
        case 'deactivate':
          user.isActive = false;
          message = 'Pengguna berhasil dinonaktifkan';
          break;
      }
      
      // Add admin action log
      if (!user.adminActions) user.adminActions = [];
      user.adminActions.push({
        action,
        reason,
        performedBy: req.user._id,
        performedAt: new Date()
      });
      
      await user.save();
      
      // Revoke all refresh tokens
      await JwtService.revokeAllRefreshTokens(user._id);
      
      // Log admin action
      logger.info('User status changed', {
        userId: user._id,
        adminId: req.user._id,
        action,
        reason
      });
      
      // Send notification email
      try {
        await EmailService.sendAccountStatusNotification(
          user.email,
          user.profile.nama,
          action,
          reason
        );
      } catch (emailError) {
        logger.error('Failed to send status change notification:', emailError);
      }
      
      res.json({
        success: true,
        message,
        data: {
          user: {
            id: user._id,
            username: user.username,
            isActive: user.isActive,
            isLocked: user.isLocked
          }
        }
      });
      
    } catch (error) {
      logger.error('Toggle user status error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'TOGGLE_STATUS_ERROR',
          message: 'Terjadi kesalahan saat mengubah status pengguna'
        }
      });
    }
  }
  
  /**
   * Delete user account (admin only)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async deleteUser(req, res) {
    try {
      const { id } = req.params;
      const { transferContent = false, targetUserId = null } = req.body;
      
      const user = await User.findById(id);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'Pengguna tidak ditemukan'
          }
        });
      }
      
      // Prevent deletion of self
      if (user._id.toString() === req.user._id.toString()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'CANNOT_DELETE_SELF',
            message: 'Tidak dapat menghapus akun diri sendiri'
          }
        });
      }
      
      // Prevent deletion of other admins
      if (user.role === 'admin') {
        return res.status(403).json({
          success: false,
          error: {
            code: 'CANNOT_DELETE_ADMIN',
            message: 'Tidak dapat menghapus akun admin'
          }
        });
      }
      
      // Handle content transfer
      if (transferContent && targetUserId) {
        const targetUser = await User.findById(targetUserId);
        if (!targetUser) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'TARGET_USER_NOT_FOUND',
              message: 'Target user untuk transfer konten tidak ditemukan'
            }
          });
        }
        
        // Transfer articles
        await Article.updateMany(
          { penulis: user._id },
          { penulis: targetUserId }
        );
        
        // Transfer comments
        await Comment.updateMany(
          { penulis: user._id },
          { penulis: targetUserId }
        );
      } else {
        // Delete user's content
        await Article.deleteMany({ penulis: user._id });
        await Comment.deleteMany({ penulis: user._id });
      }
      
      // Revoke all refresh tokens
      await JwtService.revokeAllRefreshTokens(user._id);
      
      // Delete user
      await User.findByIdAndDelete(id);
      
      // Log user deletion
      logger.info('User deleted', {
        deletedUserId: user._id,
        adminId: req.user._id,
        transferContent,
        targetUserId
      });
      
      res.json({
        success: true,
        message: 'Pengguna berhasil dihapus'
      });
      
    } catch (error) {
      logger.error('Delete user error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'DELETE_USER_ERROR',
          message: 'Terjadi kesalahan saat menghapus pengguna'
        }
      });
    }
  }
  
  /**
   * Get admin dashboard statistics
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getDashboardStats(req, res) {
    try {
      const { period = '30' } = req.query; // days
      
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(period));
      
      // Get comprehensive statistics
      const [
        userStats,
        articleStats,
        commentStats,
        categoryStats,
        recentUsers,
        recentArticles,
        topAuthors,
        systemHealth
      ] = await Promise.all([
        // User statistics
        User.aggregate([
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              active: { $sum: { $cond: ['$isActive', 1, 0] } },
              locked: { $sum: { $cond: ['$isLocked', 1, 0] } },
              admins: { $sum: { $cond: [{ $eq: ['$role', 'admin'] }, 1, 0] } },
              authors: { $sum: { $cond: [{ $eq: ['$role', 'penulis'] }, 1, 0] } },
              readers: { $sum: { $cond: [{ $eq: ['$role', 'pembaca'] }, 1, 0] } },
              newThisPeriod: {
                $sum: {
                  $cond: [{ $gte: ['$createdAt', startDate] }, 1, 0]
                }
              }
            }
          }
        ]),
        
        // Article statistics
        Article.getStatistics(),
        
        // Comment statistics
        Comment.getStatistics(),
        
        // Category statistics
        Category.getStatistics(),
        
        // Recent users
        User.find({ createdAt: { $gte: startDate } })
          .sort({ createdAt: -1 })
          .limit(10)
          .select('username profile.nama role createdAt'),
        
        // Recent articles
        Article.find({ createdAt: { $gte: startDate } })
          .populate('penulis', 'username profile.nama')
          .sort({ createdAt: -1 })
          .limit(10)
          .select('judul status createdAt penulis'),
        
        // Top authors by article count
        Article.aggregate([
          { $match: { status: 'published' } },
          { $group: { _id: '$penulis', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 5 },
          {
            $lookup: {
              from: 'users',
              localField: '_id',
              foreignField: '_id',
              as: 'author'
            }
          }
        ]),
        
        // System health metrics
        {
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage(),
          nodeVersion: process.version
        }
      ]);
      
      const stats = {
        users: userStats[0] || {
          total: 0,
          active: 0,
          locked: 0,
          admins: 0,
          authors: 0,
          readers: 0,
          newThisPeriod: 0
        },
        articles: articleStats,
        comments: commentStats,
        categories: categoryStats,
        recentActivity: {
          users: recentUsers,
          articles: recentArticles
        },
        topAuthors: topAuthors.map(author => ({
          user: author.author[0],
          articleCount: author.count
        })),
        system: systemHealth,
        period: parseInt(period)
      };
      
      res.json({
        success: true,
        data: {
          stats
        }
      });
      
    } catch (error) {
      logger.error('Get dashboard stats error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'GET_DASHBOARD_STATS_ERROR',
          message: 'Terjadi kesalahan saat mengambil statistik dashboard'
        }
      });
    }
  }
  
  /**
   * Bulk user actions (admin only)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async bulkUserActions(req, res) {
    try {
      const { userIds, action, reason = '' } = req.body;
      
      if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_USER_IDS',
            message: 'User IDs harus berupa array yang tidak kosong'
          }
        });
      }
      
      if (!['activate', 'deactivate', 'block', 'unblock'].includes(action)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_ACTION',
            message: 'Action harus salah satu dari: activate, deactivate, block, unblock'
          }
        });
      }
      
      // Prevent action on self
      if (userIds.includes(req.user._id.toString())) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'CANNOT_ACTION_SELF',
            message: 'Tidak dapat melakukan bulk action pada diri sendiri'
          }
        });
      }
      
      // Get users and check for admins
      const users = await User.find({ _id: { $in: userIds } });
      const adminUsers = users.filter(user => user.role === 'admin');
      
      if (adminUsers.length > 0) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'CANNOT_ACTION_ADMINS',
            message: 'Tidak dapat melakukan bulk action pada admin'
          }
        });
      }
      
      // Prepare update data
      let updateData = {};
      
      switch (action) {
        case 'activate':
          updateData.isActive = true;
          break;
        case 'deactivate':
          updateData.isActive = false;
          break;
        case 'block':
          updateData.isLocked = true;
          updateData.lockUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
          break;
        case 'unblock':
          updateData.isLocked = false;
          updateData.$unset = { lockUntil: 1 };
          updateData.loginAttempts = 0;
          break;
      }
      
      // Perform bulk update
      const result = await User.updateMany(
        { _id: { $in: userIds } },
        updateData
      );
      
      // Revoke refresh tokens for affected users
      for (const userId of userIds) {
        await JwtService.revokeAllRefreshTokens(userId);
      }
      
      // Log bulk action
      logger.info('Bulk user action performed', {
        adminId: req.user._id,
        action,
        userIds,
        reason,
        modifiedCount: result.modifiedCount
      });
      
      res.json({
        success: true,
        message: `${result.modifiedCount} pengguna berhasil di-${action}`,
        data: {
          modifiedCount: result.modifiedCount,
          totalRequested: userIds.length
        }
      });
      
    } catch (error) {
      logger.error('Bulk user actions error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'BULK_ACTIONS_ERROR',
          message: 'Terjadi kesalahan saat melakukan bulk action'
        }
      });
    }
  }
  
  /**
   * Get user activity logs (admin only)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getUserActivityLogs(req, res) {
    try {
      const { id } = req.params;
      const {
        page = 1,
        limit = 20,
        type = 'all' // all, articles, comments, login
      } = req.query;
      
      const user = await User.findById(id);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'Pengguna tidak ditemukan'
          }
        });
      }
      
      const activities = [];
      
      // Get articles activity
      if (type === 'all' || type === 'articles') {
        const articles = await Article.find({ penulis: id })
          .sort({ createdAt: -1 })
          .limit(parseInt(limit))
          .select('judul slug status createdAt publishedAt');
        
        articles.forEach(article => {
          activities.push({
            type: 'article',
            action: 'created',
            data: article,
            timestamp: article.createdAt
          });
          
          if (article.publishedAt) {
            activities.push({
              type: 'article',
              action: 'published',
              data: article,
              timestamp: article.publishedAt
            });
          }
        });
      }
      
      // Get comments activity
      if (type === 'all' || type === 'comments') {
        const comments = await Comment.find({ penulis: id })
          .populate('artikel', 'judul slug')
          .sort({ createdAt: -1 })
          .limit(parseInt(limit))
          .select('konten artikel status createdAt');
        
        comments.forEach(comment => {
          activities.push({
            type: 'comment',
            action: 'created',
            data: comment,
            timestamp: comment.createdAt
          });
        });
      }
      
      // Sort activities by timestamp
      activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      // Paginate
      const startIndex = (parseInt(page) - 1) * parseInt(limit);
      const paginatedActivities = activities.slice(startIndex, startIndex + parseInt(limit));
      
      res.json({
        success: true,
        data: {
          user: {
            id: user._id,
            username: user.username,
            profile: user.profile
          },
          activities: paginatedActivities,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: activities.length,
            pages: Math.ceil(activities.length / parseInt(limit))
          }
        }
      });
      
    } catch (error) {
      logger.error('Get user activity logs error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'GET_ACTIVITY_LOGS_ERROR',
          message: 'Terjadi kesalahan saat mengambil log aktivitas pengguna'
        }
      });
    }
  }
}

module.exports = AdminController;