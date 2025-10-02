const mongoose = require('mongoose');
const logger = require('../config/logger');

/**
 * Social Account Schema - For platform integrations
 * Converted from Laravel BEEPOS SocialAccount model
 */
const socialAccountSchema = new mongoose.Schema({
  // User Reference
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User is required'],
    index: true
  },
  
  // Platform Information
  platform: {
    type: String,
    required: [true, 'Platform is required'],
    enum: {
      values: [
        'facebook', 'twitter', 'instagram', 'linkedin', 'youtube',
        'tiktok', 'pinterest', 'reddit', 'medium', 'wordpress',
        'telegram', 'whatsapp', 'discord', 'slack'
      ],
      message: 'Invalid social media platform'
    },
    index: true
  },
  
  // Account Details
  platformUserId: {
    type: String,
    required: [true, 'Platform user ID is required'],
    index: true
  },
  
  username: {
    type: String,
    required: [true, 'Username is required'],
    trim: true,
    index: true
  },
  
  displayName: {
    type: String,
    trim: true
  },
  
  email: {
    type: String,
    trim: true,
    lowercase: true,
    validate: {
      validator: function(v) {
        return !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: 'Invalid email format'
    }
  },
  
  profileUrl: {
    type: String,
    validate: {
      validator: function(v) {
        return !v || /^https?:\/\/.+/.test(v);
      },
      message: 'Profile URL must be a valid URL'
    }
  },
  
  avatarUrl: {
    type: String,
    validate: {
      validator: function(v) {
        return !v || /^https?:\/\/.+/.test(v);
      },
      message: 'Avatar URL must be a valid URL'
    }
  },
  
  // Authentication & Tokens
  accessToken: {
    type: String,
    required: [true, 'Access token is required'],
    select: false // Don't include in queries by default
  },
  
  refreshToken: {
    type: String,
    select: false
  },
  
  tokenType: {
    type: String,
    default: 'Bearer'
  },
  
  expiresAt: {
    type: Date,
    index: true
  },
  
  scope: [{
    type: String,
    trim: true
  }],
  
  // Account Status
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  
  isVerified: {
    type: Boolean,
    default: false
  },
  
  status: {
    type: String,
    enum: ['connected', 'disconnected', 'expired', 'revoked', 'error'],
    default: 'connected',
    index: true
  },
  
  // Platform-specific Data
  platformData: {
    // Facebook/Instagram
    pageId: String,
    pageName: String,
    pageAccessToken: String,
    
    // Twitter
    screenName: String,
    followersCount: Number,
    friendsCount: Number,
    
    // LinkedIn
    companyId: String,
    companyName: String,
    
    // YouTube
    channelId: String,
    channelTitle: String,
    subscriberCount: Number,
    
    // TikTok
    openId: String,
    unionId: String,
    
    // Generic fields
    bio: String,
    location: String,
    website: String,
    verified: Boolean,
    publicMetrics: {
      followersCount: Number,
      followingCount: Number,
      postsCount: Number,
      likesCount: Number
    }
  },
  
  // Permissions & Capabilities
  permissions: {
    canPost: {
      type: Boolean,
      default: false
    },
    
    canRead: {
      type: Boolean,
      default: true
    },
    
    canManage: {
      type: Boolean,
      default: false
    },
    
    canAnalytics: {
      type: Boolean,
      default: false
    },
    
    canMessage: {
      type: Boolean,
      default: false
    }
  },
  
  // Auto-posting Settings
  autoPosting: {
    enabled: {
      type: Boolean,
      default: false
    },
    
    postTypes: [{
      type: String,
      enum: ['article', 'blog_post', 'announcement', 'promotion']
    }],
    
    schedule: {
      timezone: {
        type: String,
        default: 'Asia/Jakarta'
      },
      
      days: [{
        type: String,
        enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
      }],
      
      times: [{
        hour: {
          type: Number,
          min: 0,
          max: 23
        },
        minute: {
          type: Number,
          min: 0,
          max: 59
        }
      }]
    },
    
    template: {
      type: String,
      default: '{{title}}\n\n{{excerpt}}\n\n{{url}}'
    },
    
    hashtags: [{
      type: String,
      trim: true
    }],
    
    mentions: [{
      type: String,
      trim: true
    }]
  },
  
  // Analytics & Performance
  analytics: {
    totalPosts: {
      type: Number,
      default: 0,
      min: 0
    },
    
    successfulPosts: {
      type: Number,
      default: 0,
      min: 0
    },
    
    failedPosts: {
      type: Number,
      default: 0,
      min: 0
    },
    
    totalReach: {
      type: Number,
      default: 0,
      min: 0
    },
    
    totalEngagement: {
      type: Number,
      default: 0,
      min: 0
    },
    
    averageEngagementRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    
    lastPostDate: {
      type: Date
    },
    
    lastSyncDate: {
      type: Date
    }
  },
  
  // Error Tracking
  lastError: {
    code: String,
    message: String,
    timestamp: Date,
    details: mongoose.Schema.Types.Mixed
  },
  
  errorCount: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Connection History
  connectionHistory: [{
    action: {
      type: String,
      enum: ['connected', 'disconnected', 'token_refreshed', 'error', 'reauthorized'],
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    details: String,
    ipAddress: String,
    userAgent: String
  }],
  
  // Metadata
  metadata: {
    source: {
      type: String,
      enum: ['oauth', 'manual', 'api', 'import'],
      default: 'oauth'
    },
    
    version: {
      type: String,
      default: '1.0'
    },
    
    customFields: {
      type: Map,
      of: mongoose.Schema.Types.Mixed
    }
  }
}, {
  timestamps: true,
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.accessToken;
      delete ret.refreshToken;
      return ret;
    }
  },
  toObject: { virtuals: true }
});

// Indexes
socialAccountSchema.index({ user: 1, platform: 1 }, { unique: true });
socialAccountSchema.index({ platformUserId: 1, platform: 1 });
socialAccountSchema.index({ username: 1, platform: 1 });
socialAccountSchema.index({ isActive: 1, status: 1 });
socialAccountSchema.index({ expiresAt: 1 });
socialAccountSchema.index({ 'autoPosting.enabled': 1 });

// Virtual for connection status
socialAccountSchema.virtual('isConnected').get(function() {
  return this.status === 'connected' && this.isActive;
});

// Virtual for token expiry status
socialAccountSchema.virtual('isTokenExpired').get(function() {
  return this.expiresAt && new Date() > this.expiresAt;
});

// Virtual for success rate
socialAccountSchema.virtual('successRate').get(function() {
  const total = this.analytics.totalPosts;
  return total > 0 ? (this.analytics.successfulPosts / total) * 100 : 0;
});

// Pre-save middleware
socialAccountSchema.pre('save', function(next) {
  // Check token expiry
  if (this.isTokenExpired && this.status === 'connected') {
    this.status = 'expired';
  }
  
  // Update connection history
  if (this.isModified('status')) {
    this.connectionHistory.push({
      action: this.status,
      timestamp: new Date(),
      details: `Status changed to ${this.status}`
    });
    
    // Keep only last 50 history entries
    if (this.connectionHistory.length > 50) {
      this.connectionHistory = this.connectionHistory.slice(-50);
    }
  }
  
  next();
});

// Static Methods

/**
 * Get active accounts for user
 */
socialAccountSchema.statics.getActiveAccounts = function(userId, platform = null) {
  const query = {
    user: userId,
    isActive: true,
    status: 'connected'
  };
  
  if (platform) query.platform = platform;
  
  return this.find(query).lean();
};

/**
 * Get accounts by platform
 */
socialAccountSchema.statics.getByPlatform = function(platform, options = {}) {
  const {
    isActive = true,
    status = 'connected',
    limit = 100
  } = options;
  
  return this.find({
    platform,
    isActive,
    status
  })
  .populate('user', 'username email profile.nama')
  .limit(limit)
  .lean();
};

/**
 * Get expiring tokens
 */
socialAccountSchema.statics.getExpiringTokens = function(hours = 24) {
  const expiryDate = new Date();
  expiryDate.setHours(expiryDate.getHours() + hours);
  
  return this.find({
    status: 'connected',
    expiresAt: {
      $lte: expiryDate,
      $gte: new Date()
    }
  })
  .populate('user', 'email profile.nama')
  .lean();
};

/**
 * Get platform statistics
 */
socialAccountSchema.statics.getPlatformStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: '$platform',
        totalAccounts: { $sum: 1 },
        activeAccounts: {
          $sum: { $cond: [{ $eq: ['$status', 'connected'] }, 1, 0] }
        },
        autoPostingEnabled: {
          $sum: { $cond: ['$autoPosting.enabled', 1, 0] }
        },
        totalPosts: { $sum: '$analytics.totalPosts' },
        successfulPosts: { $sum: '$analytics.successfulPosts' },
        totalReach: { $sum: '$analytics.totalReach' }
      }
    },
    {
      $sort: { totalAccounts: -1 }
    }
  ]);
  
  return stats;
};

// Instance Methods

/**
 * Refresh access token
 */
socialAccountSchema.methods.refreshAccessToken = async function() {
  // This would integrate with platform-specific OAuth refresh logic
  // Implementation depends on each platform's API
  
  try {
    // Platform-specific token refresh logic would go here
    // For now, we'll just update the timestamp
    
    this.connectionHistory.push({
      action: 'token_refreshed',
      timestamp: new Date(),
      details: 'Access token refreshed successfully'
    });
    
    this.analytics.lastSyncDate = new Date();
    
    return await this.save();
    
  } catch (error) {
    this.lastError = {
      code: 'TOKEN_REFRESH_FAILED',
      message: error.message,
      timestamp: new Date(),
      details: error
    };
    
    this.errorCount += 1;
    this.status = 'error';
    
    await this.save();
    throw error;
  }
};

/**
 * Update analytics
 */
socialAccountSchema.methods.updateAnalytics = async function(data) {
  try {
    Object.keys(data).forEach(key => {
      if (this.analytics[key] !== undefined) {
        this.analytics[key] = data[key];
      }
    });
    
    // Calculate engagement rate
    if (data.totalReach && data.totalEngagement) {
      this.analytics.averageEngagementRate = 
        (data.totalEngagement / data.totalReach) * 100;
    }
    
    this.analytics.lastSyncDate = new Date();
    
    return await this.save();
    
  } catch (error) {
    logger.error('Error updating social account analytics:', error);
    throw error;
  }
};

/**
 * Record post attempt
 */
socialAccountSchema.methods.recordPost = async function(success = true, details = null) {
  this.analytics.totalPosts += 1;
  
  if (success) {
    this.analytics.successfulPosts += 1;
  } else {
    this.analytics.failedPosts += 1;
    
    if (details) {
      this.lastError = {
        code: 'POST_FAILED',
        message: details.message || 'Post failed',
        timestamp: new Date(),
        details
      };
      this.errorCount += 1;
    }
  }
  
  this.analytics.lastPostDate = new Date();
  
  return await this.save();
};

/**
 * Disconnect account
 */
socialAccountSchema.methods.disconnect = async function(reason = 'user_request') {
  this.status = 'disconnected';
  this.isActive = false;
  
  this.connectionHistory.push({
    action: 'disconnected',
    timestamp: new Date(),
    details: `Disconnected: ${reason}`
  });
  
  return await this.save();
};

const SocialAccount = mongoose.model('SocialAccount', socialAccountSchema);

module.exports = SocialAccount;