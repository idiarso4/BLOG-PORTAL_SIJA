const SubscriptionService = require('../services/SubscriptionService');
const User = require('../models/User');
const { validationResult } = require('express-validator');
const logger = require('../config/logger');

/**
 * Subscription Controller
 */
class SubscriptionController {
  
  /**
   * Get available subscription plans (public)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getPlans(req, res) {
    try {
      const plans = SubscriptionService.getAvailablePlans();
      
      res.json({
        success: true,
        data: {
          plans
        }
      });
      
    } catch (error) {
      logger.error('Get plans error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'GET_PLANS_ERROR',
          message: 'Terjadi kesalahan saat mengambil daftar paket'
        }
      });
    }
  }
  
  /**
   * Get current user subscription (authenticated)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getCurrentSubscription(req, res) {
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
      
      const plan = SubscriptionService.getPlan(user.subscription.plan);
      
      // Check if subscription is expired
      const now = new Date();
      let isExpired = false;
      
      if (user.subscription.expiryDate && user.subscription.expiryDate <= now) {
        isExpired = true;
      }
      
      res.json({
        success: true,
        data: {
          subscription: {
            ...user.subscription,
            isExpired,
            daysRemaining: user.subscription.expiryDate ? 
              Math.max(0, Math.ceil((user.subscription.expiryDate - now) / (1000 * 60 * 60 * 24))) : 
              null
          },
          plan,
          features: plan ? plan.features : [],
          limits: plan ? plan.limits : {}
        }
      });
      
    } catch (error) {
      logger.error('Get current subscription error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'GET_SUBSCRIPTION_ERROR',
          message: 'Terjadi kesalahan saat mengambil data langganan'
        }
      });
    }
  }
  
  /**
   * Upgrade subscription (authenticated)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async upgradeSubscription(req, res) {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Data tidak valid',
            details: errors.array()
          }
        });
      }
      
      const {
        planId,
        paymentMethod,
        transactionId,
        autoRenew = false
      } = req.body;
      
      // Validate plan
      const plan = SubscriptionService.getPlan(planId);
      if (!plan) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PLAN',
            message: 'Paket langganan tidak valid'
          }
        });
      }
      
      // Check if user is already on this plan
      const user = await User.findById(req.user._id);
      if (user.subscription.plan === planId && user.subscription.status === 'active') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'ALREADY_SUBSCRIBED',
            message: 'Anda sudah berlangganan paket ini'
          }
        });
      }
      
      // Process upgrade
      const result = await SubscriptionService.upgradeSubscription(
        req.user._id,
        planId,
        {
          paymentMethod,
          transactionId,
          autoRenew
        }
      );
      
      // Log subscription upgrade
      logger.info('Subscription upgraded', {
        userId: req.user._id,
        planId,
        paymentMethod,
        transactionId
      });
      
      res.json({
        success: true,
        message: `Berhasil upgrade ke paket ${plan.name}`,
        data: result
      });
      
    } catch (error) {
      logger.error('Upgrade subscription error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'UPGRADE_ERROR',
          message: error.message || 'Terjadi kesalahan saat upgrade langganan'
        }
      });
    }
  }
  
  /**
   * Cancel subscription (authenticated)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async cancelSubscription(req, res) {
    try {
      const { reason = '' } = req.body;
      
      const user = await User.findById(req.user._id);
      
      if (user.subscription.plan === 'free') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'FREE_PLAN',
            message: 'Anda tidak memiliki langganan aktif untuk dibatalkan'
          }
        });
      }
      
      if (user.subscription.status === 'cancelled') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'ALREADY_CANCELLED',
            message: 'Langganan sudah dibatalkan sebelumnya'
          }
        });
      }
      
      const result = await SubscriptionService.cancelSubscription(
        req.user._id,
        reason
      );
      
      // Log cancellation
      logger.info('Subscription cancelled', {
        userId: req.user._id,
        reason
      });
      
      res.json({
        success: true,
        message: 'Langganan berhasil dibatalkan',
        data: result
      });
      
    } catch (error) {
      logger.error('Cancel subscription error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'CANCEL_ERROR',
          message: error.message || 'Terjadi kesalahan saat membatalkan langganan'
        }
      });
    }
  }
  
  /**
   * Renew subscription (authenticated)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async renewSubscription(req, res) {
    try {
      const {
        paymentMethod,
        transactionId
      } = req.body;
      
      const user = await User.findById(req.user._id);
      
      if (user.subscription.plan === 'free') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'FREE_PLAN',
            message: 'Paket gratis tidak dapat diperpanjang'
          }
        });
      }
      
      const result = await SubscriptionService.renewSubscription(
        req.user._id,
        {
          paymentMethod,
          transactionId
        }
      );
      
      // Log renewal
      logger.info('Subscription renewed', {
        userId: req.user._id,
        paymentMethod,
        transactionId
      });
      
      res.json({
        success: true,
        message: 'Langganan berhasil diperpanjang',
        data: result
      });
      
    } catch (error) {
      logger.error('Renew subscription error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'RENEW_ERROR',
          message: error.message || 'Terjadi kesalahan saat memperpanjang langganan'
        }
      });
    }
  }
  
  /**
   * Check feature access (authenticated)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async checkFeatureAccess(req, res) {
    try {
      const { feature } = req.params;
      
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
      
      const hasAccess = SubscriptionService.hasFeatureAccess(user, feature);
      const plan = SubscriptionService.getPlan(user.subscription.plan);
      
      res.json({
        success: true,
        data: {
          feature,
          hasAccess,
          currentPlan: user.subscription.plan,
          planFeatures: plan ? plan.features : [],
          requiredPlans: this.getPlansWithFeature(feature)
        }
      });
      
    } catch (error) {
      logger.error('Check feature access error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'FEATURE_CHECK_ERROR',
          message: 'Terjadi kesalahan saat mengecek akses fitur'
        }
      });
    }
  }
  
  /**
   * Check usage limits (authenticated)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async checkUsageLimit(req, res) {
    try {
      const { limitType } = req.params;
      const { currentUsage = 0 } = req.query;
      
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
      
      const limitCheck = SubscriptionService.checkUsageLimit(
        user,
        limitType,
        parseInt(currentUsage)
      );
      
      res.json({
        success: true,
        data: {
          limitType,
          ...limitCheck,
          currentPlan: user.subscription.plan
        }
      });
      
    } catch (error) {
      logger.error('Check usage limit error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'USAGE_CHECK_ERROR',
          message: 'Terjadi kesalahan saat mengecek batas penggunaan'
        }
      });
    }
  }
  
  /**
   * Get subscription statistics (admin only)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getSubscriptionStats(req, res) {
    try {
      const stats = await SubscriptionService.getSubscriptionStats();
      
      res.json({
        success: true,
        data: stats
      });
      
    } catch (error) {
      logger.error('Get subscription stats error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'STATS_ERROR',
          message: 'Terjadi kesalahan saat mengambil statistik langganan'
        }
      });
    }
  }
  
  /**
   * Process expired subscriptions (admin only)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async processExpiredSubscriptions(req, res) {
    try {
      const result = await SubscriptionService.processExpiredSubscriptions();
      
      res.json({
        success: true,
        message: `Berhasil memproses ${result.processedCount} langganan yang kedaluwarsa`,
        data: result
      });
      
    } catch (error) {
      logger.error('Process expired subscriptions error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'PROCESS_EXPIRED_ERROR',
          message: 'Terjadi kesalahan saat memproses langganan kedaluwarsa'
        }
      });
    }
  }
  
  /**
   * Send subscription reminders (admin only)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async sendSubscriptionReminders(req, res) {
    try {
      const result = await SubscriptionService.sendSubscriptionReminders();
      
      res.json({
        success: true,
        message: `Berhasil mengirim ${result.sentCount} reminder langganan`,
        data: result
      });
      
    } catch (error) {
      logger.error('Send subscription reminders error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'SEND_REMINDERS_ERROR',
          message: 'Terjadi kesalahan saat mengirim reminder langganan'
        }
      });
    }
  }
  
  /**
   * Helper method to get plans that include a specific feature
   * @param {String} feature - Feature name
   * @returns {Array} Plans with the feature
   */
  static getPlansWithFeature(feature) {
    const plans = SubscriptionService.getAvailablePlans();
    const plansWithFeature = [];
    
    for (const [planId, plan] of Object.entries(plans)) {
      if (plan.features.includes(feature)) {
        plansWithFeature.push({
          id: planId,
          name: plan.name,
          price: plan.price
        });
      }
    }
    
    return plansWithFeature;
  }
}

module.exports = SubscriptionController;