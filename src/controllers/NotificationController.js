const NotificationService = require('../services/NotificationService');
const User = require('../models/User');
const Article = require('../models/Article');
const Comment = require('../models/Comment');
const { validationResult } = require('express-validator');
const logger = require('../config/logger');

/**
 * Notification Controller
 */
class NotificationController {
  
  /**
   * Send test email (admin only)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async sendTestEmail(req, res) {
    try {
      const { to, subject, message } = req.body;
      
      const result = await NotificationService.sendEmail({
        to,
        subject: subject || 'Test Email',
        html: `
          <h2>Test Email</h2>
          <p>${message || 'This is a test email from the notification system.'}</p>
          <p>Sent at: ${new Date().toISOString()}</p>
        `
      });
      
      res.json({
        success: true,
        message: 'Test email sent successfully',
        data: result
      });
      
    } catch (error) {
      logger.error('Send test email error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'SEND_TEST_EMAIL_ERROR',
          message: 'Failed to send test email'
        }
      });
    }
  }
  
  /**
   * Send welcome email to user
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async sendWelcomeEmail(req, res) {
    try {
      const { userId } = req.params;
      
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found'
          }
        });
      }
      
      const result = await NotificationService.sendWelcomeEmail(user);
      
      res.json({
        success: true,
        message: 'Welcome email sent successfully',
        data: result
      });
      
    } catch (error) {
      logger.error('Send welcome email error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'SEND_WELCOME_EMAIL_ERROR',
          message: 'Failed to send welcome email'
        }
      });
    }
  }
  
  /**
   * Send weekly digest to all users
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async sendWeeklyDigest(req, res) {
    try {
      const users = await User.find({ 
        isActive: true,
        'notifications.weeklyDigest': { $ne: false }
      });
      
      let sentCount = 0;
      let errorCount = 0;
      
      for (const user of users) {
        try {
          // Get user's articles from last week
          const lastWeek = new Date();
          lastWeek.setDate(lastWeek.getDate() - 7);
          
          const userArticles = await Article.find({
            author: user._id,
            createdAt: { $gte: lastWeek },
            status: 'published'
          }).populate('kategori');
          
          // Get popular articles from last week
          const popularArticles = await Article.find({
            createdAt: { $gte: lastWeek },
            status: 'published'
          })
          .sort({ views: -1 })
          .limit(5)
          .populate('author', 'username profile.nama')
          .populate('kategori');
          
          // Calculate user stats
          const stats = {
            articlesWritten: userArticles.length,
            totalViews: userArticles.reduce((sum, article) => sum + (article.views || 0), 0),
            commentsReceived: await Comment.countDocuments({
              article: { $in: userArticles.map(a => a._id) },
              createdAt: { $gte: lastWeek }
            }),
            likesReceived: 0 // TODO: Implement likes counting
          };
          
          await NotificationService.sendWeeklyDigest(user, popularArticles, stats);
          sentCount++;
          
        } catch (userError) {
          logger.error('Error sending weekly digest to user:', userError);
          errorCount++;
        }
      }
      
      res.json({
        success: true,
        message: 'Weekly digest sent',
        data: {
          totalUsers: users.length,
          sentCount,
          errorCount
        }
      });
      
    } catch (error) {
      logger.error('Send weekly digest error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'SEND_WEEKLY_DIGEST_ERROR',
          message: 'Failed to send weekly digest'
        }
      });
    }
  }
  
  /**
   * Update user notification preferences
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async updateNotificationPreferences(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid notification preferences',
            details: errors.array()
          }
        });
      }
      
      const {
        emailNotifications = true,
        commentNotifications = true,
        likeNotifications = true,
        weeklyDigest = true,
        marketingEmails = false
      } = req.body;
      
      const user = await User.findById(req.user._id);
      
      user.notifications = {
        email: emailNotifications,
        comments: commentNotifications,
        likes: likeNotifications,
        weeklyDigest,
        marketing: marketingEmails
      };
      
      await user.save();
      
      res.json({
        success: true,
        message: 'Notification preferences updated successfully',
        data: {
          notifications: user.notifications
        }
      });
      
    } catch (error) {
      logger.error('Update notification preferences error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'UPDATE_PREFERENCES_ERROR',
          message: 'Failed to update notification preferences'
        }
      });
    }
  }
  
  /**
   * Get user notification preferences
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getNotificationPreferences(req, res) {
    try {
      const user = await User.findById(req.user._id).select('notifications');
      
      res.json({
        success: true,
        data: {
          notifications: user.notifications || {
            email: true,
            comments: true,
            likes: true,
            weeklyDigest: true,
            marketing: false
          }
        }
      });
      
    } catch (error) {
      logger.error('Get notification preferences error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'GET_PREFERENCES_ERROR',
          message: 'Failed to get notification preferences'
        }
      });
    }
  }
  
  /**
   * Unsubscribe from all emails
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async unsubscribeAll(req, res) {
    try {
      const { token } = req.query;
      
      if (!token) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_TOKEN',
            message: 'Unsubscribe token is required'
          }
        });
      }
      
      // TODO: Implement token verification
      // For now, we'll use user ID from authenticated request
      const user = await User.findById(req.user._id);
      
      user.notifications = {
        email: false,
        comments: false,
        likes: false,
        weeklyDigest: false,
        marketing: false
      };
      
      await user.save();
      
      res.json({
        success: true,
        message: 'Successfully unsubscribed from all email notifications'
      });
      
    } catch (error) {
      logger.error('Unsubscribe all error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'UNSUBSCRIBE_ERROR',
          message: 'Failed to unsubscribe from notifications'
        }
      });
    }
  }
  
  /**
   * Get notification statistics (admin only)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getNotificationStats(req, res) {
    try {
      const stats = await User.aggregate([
        {
          $group: {
            _id: null,
            totalUsers: { $sum: 1 },
            emailEnabled: {
              $sum: { $cond: [{ $eq: ['$notifications.email', true] }, 1, 0] }
            },
            commentsEnabled: {
              $sum: { $cond: [{ $eq: ['$notifications.comments', true] }, 1, 0] }
            },
            likesEnabled: {
              $sum: { $cond: [{ $eq: ['$notifications.likes', true] }, 1, 0] }
            },
            weeklyDigestEnabled: {
              $sum: { $cond: [{ $eq: ['$notifications.weeklyDigest', true] }, 1, 0] }
            },
            marketingEnabled: {
              $sum: { $cond: [{ $eq: ['$notifications.marketing', true] }, 1, 0] }
            }
          }
        }
      ]);
      
      res.json({
        success: true,
        data: {
          stats: stats[0] || {
            totalUsers: 0,
            emailEnabled: 0,
            commentsEnabled: 0,
            likesEnabled: 0,
            weeklyDigestEnabled: 0,
            marketingEnabled: 0
          }
        }
      });
      
    } catch (error) {
      logger.error('Get notification stats error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'GET_STATS_ERROR',
          message: 'Failed to get notification statistics'
        }
      });
    }
  }
}

module.exports = NotificationController;