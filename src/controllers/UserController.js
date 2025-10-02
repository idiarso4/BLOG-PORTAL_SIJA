const User = require('../models/User');
const Article = require('../models/Article');
const Comment = require('../models/Comment');
const { validationResult } = require('express-validator');
const logger = require('../config/logger');
const path = require('path');
const fs = require('fs').promises;

/**
 * User Controller
 */
class UserController {
  
  /**
   * Get user profile (authenticated)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getProfile(req, res) {
    try {
      const user = await User.findById(req.user._id)
        .populate('referredBy', 'username profile.nama');
      
      if (!user) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User tidak ditemukan'
          }
        });
      }
      
      // Get user statistics
      const [articleCount, commentCount, totalViews] = await Promise.all([
        Article.countDocuments({ penulis: user._id }),
        Comment.countDocuments({ penulis: user._id, status: 'approved' }),
        Article.aggregate([
          { $match: { penulis: user._id } },
          { $group: { _id: null, totalViews: { $sum: '$metadata.views' } } }
        ])
      ]);
      
      const userStats = {
        articlesPublished: articleCount,
        commentsApproved: commentCount,
        totalViews: totalViews[0]?.totalViews || 0,
        joinedDate: user.createdAt,
        lastActive: user.lastLogin
      };
      
      res.json({
        success: true,
        data: {
          user: {
            id: user._id,
            username: user.username,
            email: user.email,
            role: user.role,
            emailVerified: user.emailVerified,
            profile: user.profile,
            subscription: user.subscription,
            preferences: user.preferences,
            socialAccounts: user.socialAccounts,
            stats: userStats,
            referredBy: user.referredBy,
            referralCode: user.referralCode,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
          }
        }
      });
      
    } catch (error) {
      logger.error('Get profile error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'GET_PROFILE_ERROR',
          message: 'Terjadi kesalahan saat mengambil profil'
        }
      });
    }
  }
  
  /**
   * Update user profile (authenticated)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async updateProfile(req, res) {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Data profil tidak valid',
            details: errors.array()
          }
        });
      }
      
      const {
        profile,
        preferences,
        socialLinks
      } = req.body;
      
      const user = await User.findById(req.user._id);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User tidak ditemukan'
          }
        });
      }
      
      // Update profile fields
      if (profile) {
        if (profile.nama) user.profile.nama = profile.nama;
        if (profile.bio !== undefined) user.profile.bio = profile.bio;
        if (profile.website !== undefined) user.profile.website = profile.website;
        if (profile.location !== undefined) user.profile.location = profile.location;
        if (profile.birthDate !== undefined) user.profile.birthDate = profile.birthDate;
        if (profile.gender !== undefined) user.profile.gender = profile.gender;
        if (profile.phone !== undefined) user.profile.phone = profile.phone;
      }
      
      // Update social links
      if (socialLinks) {
        user.profile.socialLinks = {
          ...user.profile.socialLinks,
          ...socialLinks
        };
      }
      
      // Update preferences
      if (preferences) {
        if (preferences.language) user.preferences.language = preferences.language;
        if (preferences.timezone) user.preferences.timezone = preferences.timezone;
        if (preferences.notifications) {
          user.preferences.notifications = {
            ...user.preferences.notifications,
            ...preferences.notifications
          };
        }
        if (preferences.privacy) {
          user.preferences.privacy = {
            ...user.preferences.privacy,
            ...preferences.privacy
          };
        }
      }
      
      // Handle avatar upload
      if (req.file) {
        // Delete old avatar if exists
        if (user.profile.foto && user.profile.foto !== '/images/default-avatar.png') {
          try {
            const oldAvatarPath = path.join(process.cwd(), 'public', user.profile.foto);
            await fs.unlink(oldAvatarPath);
          } catch (unlinkError) {
            logger.warn('Failed to delete old avatar:', unlinkError);
          }
        }
        
        user.profile.foto = `/uploads/${req.file.filename}`;
      }
      
      await user.save();
      
      // Log profile update
      logger.info('Profile updated', {
        userId: user._id,
        updatedFields: Object.keys(req.body)
      });
      
      res.json({
        success: true,
        message: 'Profil berhasil diperbarui',
        data: {
          user: {
            id: user._id,
            username: user.username,
            email: user.email,
            role: user.role,
            profile: user.profile,
            preferences: user.preferences,
            updatedAt: user.updatedAt
          }
        }
      });
      
    } catch (error) {
      logger.error('Update profile error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'UPDATE_PROFILE_ERROR',
          message: 'Terjadi kesalahan saat memperbarui profil'
        }
      });
    }
  }
  
  /**
   * Upload avatar (authenticated)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async uploadAvatar(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'NO_FILE_UPLOADED',
            message: 'File avatar wajib diupload'
          }
        });
      }
      
      const user = await User.findById(req.user._id);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User tidak ditemukan'
          }
        });
      }
      
      // Delete old avatar if exists
      if (user.profile.foto && user.profile.foto !== '/images/default-avatar.png') {
        try {
          const oldAvatarPath = path.join(process.cwd(), 'public', user.profile.foto);
          await fs.unlink(oldAvatarPath);
        } catch (unlinkError) {
          logger.warn('Failed to delete old avatar:', unlinkError);
        }
      }
      
      // Update avatar
      user.profile.foto = `/uploads/${req.file.filename}`;
      await user.save();
      
      // Log avatar upload
      logger.info('Avatar uploaded', {
        userId: user._id,
        filename: req.file.filename
      });
      
      res.json({
        success: true,
        message: 'Avatar berhasil diupload',
        data: {
          avatarUrl: user.profile.foto
        }
      });
      
    } catch (error) {
      logger.error('Upload avatar error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'UPLOAD_AVATAR_ERROR',
          message: 'Terjadi kesalahan saat upload avatar'
        }
      });
    }
  }
  
  /**
   * Delete avatar (authenticated)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async deleteAvatar(req, res) {
    try {
      const user = await User.findById(req.user._id);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User tidak ditemukan'
          }
        });
      }
      
      // Delete avatar file if exists
      if (user.profile.foto && user.profile.foto !== '/images/default-avatar.png') {
        try {
          const avatarPath = path.join(process.cwd(), 'public', user.profile.foto);
          await fs.unlink(avatarPath);
        } catch (unlinkError) {
          logger.warn('Failed to delete avatar file:', unlinkError);
        }
      }
      
      // Reset to default avatar
      user.profile.foto = '/images/default-avatar.png';
      await user.save();
      
      // Log avatar deletion
      logger.info('Avatar deleted', {
        userId: user._id
      });
      
      res.json({
        success: true,
        message: 'Avatar berhasil dihapus',
        data: {
          avatarUrl: user.profile.foto
        }
      });
      
    } catch (error) {
      logger.error('Delete avatar error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'DELETE_AVATAR_ERROR',
          message: 'Terjadi kesalahan saat menghapus avatar'
        }
      });
    }
  }
  
  /**
   * Get public user profile
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getPublicProfile(req, res) {
    try {
      const { username } = req.params;
      
      const user = await User.findOne({ username, isActive: true })
        .select('username profile createdAt');
      
      if (!user) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User tidak ditemukan'
          }
        });
      }
      
      // Check privacy settings
      if (user.preferences?.privacy?.profileVisibility === 'private') {
        return res.status(403).json({
          success: false,
          error: {
            code: 'PROFILE_PRIVATE',
            message: 'Profil ini bersifat privat'
          }
        });
      }
      
      // Get public statistics
      const [articleCount, totalViews, recentArticles] = await Promise.all([
        Article.countDocuments({ 
          penulis: user._id, 
          status: 'published' 
        }),
        Article.aggregate([
          { $match: { penulis: user._id, status: 'published' } },
          { $group: { _id: null, totalViews: { $sum: '$metadata.views' } } }
        ]),
        Article.findPublished({ penulis: user._id })
          .limit(5)
          .sort({ publishedAt: -1 })
          .select('judul slug thumbnail publishedAt metadata.views')
      ]);
      
      const publicProfile = {
        username: user.username,
        profile: {
          nama: user.profile.nama,
          foto: user.profile.foto,
          bio: user.profile.bio,
          website: user.profile.website,
          location: user.profile.location,
          socialLinks: user.profile.socialLinks
        },
        stats: {
          articlesPublished: articleCount,
          totalViews: totalViews[0]?.totalViews || 0,
          memberSince: user.createdAt
        },
        recentArticles
      };
      
      res.json({
        success: true,
        data: {
          user: publicProfile
        }
      });
      
    } catch (error) {
      logger.error('Get public profile error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'GET_PUBLIC_PROFILE_ERROR',
          message: 'Terjadi kesalahan saat mengambil profil publik'
        }
      });
    }
  }
  
  /**
   * Get user dashboard statistics (authenticated)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getDashboardStats(req, res) {
    try {
      const userId = req.user._id;
      const { period = '30' } = req.query; // days
      
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(period));
      
      // Get comprehensive statistics
      const [
        totalArticles,
        publishedArticles,
        draftArticles,
        totalComments,
        totalViews,
        totalLikes,
        recentViews,
        topArticles,
        recentComments
      ] = await Promise.all([
        Article.countDocuments({ penulis: userId }),
        Article.countDocuments({ penulis: userId, status: 'published' }),
        Article.countDocuments({ penulis: userId, status: 'draft' }),
        Comment.countDocuments({ penulis: userId, status: 'approved' }),
        Article.aggregate([
          { $match: { penulis: userId } },
          { $group: { _id: null, total: { $sum: '$metadata.views' } } }
        ]),
        Article.aggregate([
          { $match: { penulis: userId } },
          { $group: { _id: null, total: { $sum: '$metadata.likes' } } }
        ]),
        Article.aggregate([
          { $match: { penulis: userId, publishedAt: { $gte: startDate } } },
          { $group: { _id: null, total: { $sum: '$metadata.views' } } }
        ]),
        Article.find({ penulis: userId, status: 'published' })
          .sort({ 'metadata.views': -1 })
          .limit(5)
          .select('judul slug metadata.views publishedAt'),
        Comment.find({ penulis: userId, status: 'approved' })
          .populate('artikel', 'judul slug')
          .sort({ createdAt: -1 })
          .limit(5)
          .select('konten artikel createdAt')
      ]);
      
      const stats = {
        articles: {
          total: totalArticles,
          published: publishedArticles,
          draft: draftArticles
        },
        engagement: {
          totalViews: totalViews[0]?.total || 0,
          totalLikes: totalLikes[0]?.total || 0,
          totalComments: totalComments,
          recentViews: recentViews[0]?.total || 0
        },
        topArticles,
        recentComments
      };
      
      res.json({
        success: true,
        data: {
          stats,
          period: parseInt(period)
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
   * Update user preferences (authenticated)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async updatePreferences(req, res) {
    try {
      const { preferences } = req.body;
      
      if (!preferences || typeof preferences !== 'object') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PREFERENCES',
            message: 'Data preferences tidak valid'
          }
        });
      }
      
      const user = await User.findById(req.user._id);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User tidak ditemukan'
          }
        });
      }
      
      // Update preferences
      user.preferences = {
        ...user.preferences,
        ...preferences
      };
      
      await user.save();
      
      // Log preferences update
      logger.info('Preferences updated', {
        userId: user._id,
        updatedPreferences: Object.keys(preferences)
      });
      
      res.json({
        success: true,
        message: 'Preferensi berhasil diperbarui',
        data: {
          preferences: user.preferences
        }
      });
      
    } catch (error) {
      logger.error('Update preferences error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'UPDATE_PREFERENCES_ERROR',
          message: 'Terjadi kesalahan saat memperbarui preferensi'
        }
      });
    }
  }
  
  /**
   * Deactivate user account (authenticated)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async deactivateAccount(req, res) {
    try {
      const { password, reason = '' } = req.body;
      
      if (!password) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'PASSWORD_REQUIRED',
            message: 'Password diperlukan untuk deaktivasi akun'
          }
        });
      }
      
      const user = await User.findById(req.user._id).select('+password');
      
      if (!user) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User tidak ditemukan'
          }
        });
      }
      
      // Verify password
      const isPasswordValid = await user.comparePassword(password);
      
      if (!isPasswordValid) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PASSWORD',
            message: 'Password salah'
          }
        });
      }
      
      // Deactivate account
      user.isActive = false;
      user.deactivatedAt = new Date();
      user.deactivationReason = reason;
      await user.save();
      
      // Log account deactivation
      logger.info('Account deactivated', {
        userId: user._id,
        reason
      });
      
      res.json({
        success: true,
        message: 'Akun berhasil dinonaktifkan'
      });
      
    } catch (error) {
      logger.error('Deactivate account error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'DEACTIVATE_ACCOUNT_ERROR',
          message: 'Terjadi kesalahan saat menonaktifkan akun'
        }
      });
    }
  }
  
  /**
   * Get user activity feed (authenticated)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getActivityFeed(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        type = 'all' // all, articles, comments
      } = req.query;
      
      const userId = req.user._id;
      const activities = [];
      
      // Get recent articles
      if (type === 'all' || type === 'articles') {
        const recentArticles = await Article.find({ penulis: userId })
          .sort({ createdAt: -1 })
          .limit(parseInt(limit))
          .select('judul slug status createdAt publishedAt');
        
        recentArticles.forEach(article => {
          activities.push({
            type: 'article',
            action: article.status === 'published' ? 'published' : 'created',
            data: article,
            timestamp: article.publishedAt || article.createdAt
          });
        });
      }
      
      // Get recent comments
      if (type === 'all' || type === 'comments') {
        const recentComments = await Comment.find({ penulis: userId })
          .populate('artikel', 'judul slug')
          .sort({ createdAt: -1 })
          .limit(parseInt(limit))
          .select('konten artikel status createdAt');
        
        recentComments.forEach(comment => {
          activities.push({
            type: 'comment',
            action: 'commented',
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
      logger.error('Get activity feed error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'GET_ACTIVITY_FEED_ERROR',
          message: 'Terjadi kesalahan saat mengambil activity feed'
        }
      });
    }
  }
}

module.exports = UserController;