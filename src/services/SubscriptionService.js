const User = require('../models/User');
const logger = require('../config/logger');
const EmailService = require('./EmailService');

/**
 * Subscription Service untuk manajemen langganan
 */
class SubscriptionService {
  
  constructor() {
    this.plans = {
      free: {
        name: 'Free',
        price: 0,
        currency: 'IDR',
        interval: 'lifetime',
        features: [
          'basic_article_creation',
          'basic_comment_system',
          'basic_profile_management'
        ],
        limits: {
          articlesPerMonth: 5,
          storageGB: 1,
          aiRequestsPerMonth: 0,
          socialAccountsMax: 1
        }
      },
      premium: {
        name: 'Premium',
        price: 99000,
        currency: 'IDR',
        interval: 'monthly',
        features: [
          'unlimited_articles',
          'advanced_analytics',
          'ai_content_generation',
          'ai_content_improvement',
          'social_media_integration',
          'premium_templates',
          'priority_support'
        ],
        limits: {
          articlesPerMonth: -1, // unlimited
          storageGB: 10,
          aiRequestsPerMonth: 100,
          socialAccountsMax: 5
        }
      },
      pro: {
        name: 'Pro',
        price: 199000,
        currency: 'IDR',
        interval: 'monthly',
        features: [
          'unlimited_articles',
          'advanced_analytics',
          'ai_content_generation',
          'ai_content_improvement',
          'ai_image_generation',
          'ai_seo_optimization',
          'social_media_automation',
          'custom_branding',
          'api_access',
          'white_label',
          'dedicated_support'
        ],
        limits: {
          articlesPerMonth: -1, // unlimited
          storageGB: 50,
          aiRequestsPerMonth: 500,
          socialAccountsMax: 20
        }
      }
    };
  }
  
  /**
   * Get available subscription plans
   * @returns {Object} Available plans
   */
  getAvailablePlans() {
    return this.plans;
  }
  
  /**
   * Get plan details
   * @param {String} planId - Plan ID
   * @returns {Object} Plan details
   */
  getPlan(planId) {
    return this.plans[planId] || null;
  }
  
  /**
   * Check if user has feature access
   * @param {Object} user - User object
   * @param {String} feature - Feature name
   * @returns {Boolean} Has access
   */
  hasFeatureAccess(user, feature) {
    const plan = this.getPlan(user.subscription.plan);
    if (!plan) return false;
    
    return plan.features.includes(feature);
  }
  
  /**
   * Check usage limits
   * @param {Object} user - User object
   * @param {String} limitType - Limit type
   * @param {Number} currentUsage - Current usage
   * @returns {Object} Limit check result
   */
  checkUsageLimit(user, limitType, currentUsage = 0) {
    const plan = this.getPlan(user.subscription.plan);
    if (!plan) {
      return { allowed: false, limit: 0, remaining: 0 };
    }
    
    const limit = plan.limits[limitType];
    
    // -1 means unlimited
    if (limit === -1) {
      return { allowed: true, limit: -1, remaining: -1 };
    }
    
    const remaining = Math.max(0, limit - currentUsage);
    
    return {
      allowed: currentUsage < limit,
      limit,
      remaining,
      usage: currentUsage
    };
  }
  
  /**
   * Upgrade user subscription
   * @param {String} userId - User ID
   * @param {String} newPlan - New plan ID
   * @param {Object} paymentData - Payment information
   * @returns {Object} Upgrade result
   */
  async upgradeSubscription(userId, newPlan, paymentData = {}) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User tidak ditemukan');
      }
      
      const plan = this.getPlan(newPlan);
      if (!plan) {
        throw new Error('Plan tidak valid');
      }
      
      const currentPlan = this.getPlan(user.subscription.plan);
      
      // Calculate new expiry date
      let expiryDate = new Date();
      if (plan.interval === 'monthly') {
        expiryDate.setMonth(expiryDate.getMonth() + 1);
      } else if (plan.interval === 'yearly') {
        expiryDate.setFullYear(expiryDate.getFullYear() + 1);
      } else {
        expiryDate = null; // lifetime
      }
      
      // Update user subscription
      user.subscription = {
        plan: newPlan,
        status: 'active',
        startDate: new Date(),
        expiryDate,
        features: plan.features,
        autoRenew: paymentData.autoRenew || false,
        paymentMethod: paymentData.paymentMethod || null,
        lastPayment: {
          amount: plan.price,
          currency: plan.currency,
          date: new Date(),
          transactionId: paymentData.transactionId || null,
          method: paymentData.paymentMethod || null
        }
      };
      
      await user.save();
      
      // Log subscription change
      logger.info('Subscription upgraded', {
        userId,
        fromPlan: currentPlan?.name || 'None',
        toPlan: plan.name,
        amount: plan.price,
        expiryDate
      });
      
      // Send confirmation email
      try {
        await EmailService.sendSubscriptionConfirmation(
          user.email,
          user.profile.nama,
          plan,
          expiryDate
        );
      } catch (emailError) {
        logger.error('Failed to send subscription confirmation email:', emailError);
      }
      
      return {
        success: true,
        subscription: user.subscription,
        plan
      };
      
    } catch (error) {
      logger.error('Upgrade subscription error:', error);
      throw error;
    }
  }
  
  /**
   * Cancel user subscription
   * @param {String} userId - User ID
   * @param {String} reason - Cancellation reason
   * @returns {Object} Cancellation result
   */
  async cancelSubscription(userId, reason = '') {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User tidak ditemukan');
      }
      
      const currentPlan = this.getPlan(user.subscription.plan);
      
      // Update subscription status
      user.subscription.status = 'cancelled';
      user.subscription.cancelledAt = new Date();
      user.subscription.cancellationReason = reason;
      user.subscription.autoRenew = false;
      
      // Keep access until expiry date, then downgrade to free
      if (!user.subscription.expiryDate || user.subscription.expiryDate <= new Date()) {
        user.subscription.plan = 'free';
        user.subscription.features = this.plans.free.features;
      }
      
      await user.save();
      
      // Log cancellation
      logger.info('Subscription cancelled', {
        userId,
        plan: currentPlan?.name || 'Unknown',
        reason,
        expiryDate: user.subscription.expiryDate
      });
      
      // Send cancellation confirmation email
      try {
        await EmailService.sendSubscriptionCancellation(
          user.email,
          user.profile.nama,
          currentPlan,
          user.subscription.expiryDate
        );
      } catch (emailError) {
        logger.error('Failed to send cancellation email:', emailError);
      }
      
      return {
        success: true,
        message: 'Langganan berhasil dibatalkan',
        accessUntil: user.subscription.expiryDate
      };
      
    } catch (error) {
      logger.error('Cancel subscription error:', error);
      throw error;
    }
  }
  
  /**
   * Renew subscription
   * @param {String} userId - User ID
   * @param {Object} paymentData - Payment information
   * @returns {Object} Renewal result
   */
  async renewSubscription(userId, paymentData = {}) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User tidak ditemukan');
      }
      
      const plan = this.getPlan(user.subscription.plan);
      if (!plan || plan.interval === 'lifetime') {
        throw new Error('Plan tidak dapat diperpanjang');
      }
      
      // Calculate new expiry date
      let currentExpiry = user.subscription.expiryDate || new Date();
      let newExpiry = new Date(currentExpiry);
      
      if (plan.interval === 'monthly') {
        newExpiry.setMonth(newExpiry.getMonth() + 1);
      } else if (plan.interval === 'yearly') {
        newExpiry.setFullYear(newExpiry.getFullYear() + 1);
      }
      
      // Update subscription
      user.subscription.status = 'active';
      user.subscription.expiryDate = newExpiry;
      user.subscription.lastPayment = {
        amount: plan.price,
        currency: plan.currency,
        date: new Date(),
        transactionId: paymentData.transactionId || null,
        method: paymentData.paymentMethod || null
      };
      
      await user.save();
      
      // Log renewal
      logger.info('Subscription renewed', {
        userId,
        plan: plan.name,
        amount: plan.price,
        newExpiryDate: newExpiry
      });
      
      // Send renewal confirmation email
      try {
        await EmailService.sendSubscriptionRenewal(
          user.email,
          user.profile.nama,
          plan,
          newExpiry
        );
      } catch (emailError) {
        logger.error('Failed to send renewal email:', emailError);
      }
      
      return {
        success: true,
        subscription: user.subscription,
        plan
      };
      
    } catch (error) {
      logger.error('Renew subscription error:', error);
      throw error;
    }
  }
  
  /**
   * Check and process expired subscriptions
   * @returns {Object} Processing result
   */
  async processExpiredSubscriptions() {
    try {
      const now = new Date();
      
      // Find expired subscriptions
      const expiredUsers = await User.find({
        'subscription.status': 'active',
        'subscription.expiryDate': { $lte: now },
        'subscription.plan': { $ne: 'free' }
      });
      
      let processedCount = 0;
      
      for (const user of expiredUsers) {
        try {
          // Downgrade to free plan
          user.subscription.plan = 'free';
          user.subscription.status = 'expired';
          user.subscription.features = this.plans.free.features;
          user.subscription.expiredAt = now;
          
          await user.save();
          
          // Send expiry notification
          try {
            await EmailService.sendSubscriptionExpired(
              user.email,
              user.profile.nama
            );
          } catch (emailError) {
            logger.error('Failed to send expiry email:', emailError);
          }
          
          processedCount++;
          
          logger.info('Subscription expired and downgraded', {
            userId: user._id,
            email: user.email
          });
          
        } catch (userError) {
          logger.error('Error processing expired user:', userError);
        }
      }
      
      return {
        success: true,
        processedCount,
        totalExpired: expiredUsers.length
      };
      
    } catch (error) {
      logger.error('Process expired subscriptions error:', error);
      throw error;
    }
  }
  
  /**
   * Get subscription statistics
   * @returns {Object} Subscription statistics
   */
  async getSubscriptionStats() {
    try {
      const stats = await User.aggregate([
        {
          $group: {
            _id: '$subscription.plan',
            count: { $sum: 1 },
            active: {
              $sum: {
                $cond: [
                  { $eq: ['$subscription.status', 'active'] },
                  1,
                  0
                ]
              }
            }
          }
        }
      ]);
      
      const totalRevenue = await User.aggregate([
        {
          $match: {
            'subscription.lastPayment.amount': { $exists: true }
          }
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$subscription.lastPayment.amount' },
            totalPayments: { $sum: 1 }
          }
        }
      ]);
      
      return {
        planDistribution: stats,
        revenue: totalRevenue[0] || { totalRevenue: 0, totalPayments: 0 },
        generatedAt: new Date()
      };
      
    } catch (error) {
      logger.error('Get subscription stats error:', error);
      throw error;
    }
  }
  
  /**
   * Send subscription reminders
   * @returns {Object} Reminder result
   */
  async sendSubscriptionReminders() {
    try {
      const reminderDate = new Date();
      reminderDate.setDate(reminderDate.getDate() + 7); // 7 days before expiry
      
      const usersToRemind = await User.find({
        'subscription.status': 'active',
        'subscription.expiryDate': {
          $gte: new Date(),
          $lte: reminderDate
        },
        'subscription.plan': { $ne: 'free' }
      });
      
      let sentCount = 0;
      
      for (const user of usersToRemind) {
        try {
          const plan = this.getPlan(user.subscription.plan);
          
          await EmailService.sendSubscriptionReminder(
            user.email,
            user.profile.nama,
            plan,
            user.subscription.expiryDate
          );
          
          sentCount++;
          
        } catch (emailError) {
          logger.error('Failed to send reminder email:', emailError);
        }
      }
      
      return {
        success: true,
        sentCount,
        totalUsers: usersToRemind.length
      };
      
    } catch (error) {
      logger.error('Send subscription reminders error:', error);
      throw error;
    }
  }
}

// Create singleton instance
const subscriptionService = new SubscriptionService();

module.exports = subscriptionService;