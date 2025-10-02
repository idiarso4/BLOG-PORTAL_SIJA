const mongoose = require('mongoose');
const logger = require('../config/logger');

/**
 * Social Post Schema - For scheduling and tracking social media posts
 * Converted from Laravel BEEPOS SocialPost model
 */
const socialPostSchema = new mongoose.Schema({
  // User and Account References
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User is required'],
    index: true
  },
  
  socialAccount: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SocialAccount',
    required: [true, 'Social account is required'],
    index: true
  },
  
  // Content References
  sourceContent: {
    contentType: {
      type: String,
      enum: ['article', 'blog', 'content', 'custom'],
      required: true
    },
    contentId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'sourceContent.contentType'
    }
  },
  
  // Post Content
  content: {
    text: {
      type: String,
      required: [true, 'Post text is required'],
      maxlength: [2200, 'Post text cannot exceed 2200 characters'] // Twitter's limit
    },
    
    hashtags: [{
      type: String,
      trim: true,
      validate: {
        validator: function(v) {
          return /^#[a-zA-Z0-9_]+$/.test(v);
        },
        message: 'Invalid hashtag format'
      }
    }],
    
    mentions: [{
      type: String,
      trim: true,
      validate: {
        validator: function(v) {
          return /^@[a-zA-Z0-9_]+$/.test(v);
        },
        message: 'Invalid mention format'
      }
    }],
    
    urls: [{
      original: {
        type: String,
        required: true
      },
      shortened: String,
      title: String,
      description: String
    }]
  },
  
  // Media Attachments
  media: [{
    type: {
      type: String,
      enum: ['image', 'video', 'gif', 'document'],
      required: true
    },
    url: {
      type: String,
      required: true,
      validate: {
        validator: function(v) {
          return /^https?:\/\/.+/.test(v);
        },
        message: 'Media URL must be a valid URL'
      }
    },
    thumbnailUrl: String,
    altText: {
      type: String,
      maxlength: [200, 'Alt text cannot exceed 200 characters']
    },
    size: Number, // in bytes
    duration: Number, // for videos, in seconds
    dimensions: {
      width: Number,
      height: Number
    }
  }],
  
  // Scheduling
  scheduling: {
    status: {
      type: String,
      enum: ['draft', 'scheduled', 'published', 'failed', 'cancelled'],
      default: 'draft',
      index: true
    },
    
    scheduledAt: {
      type: Date,
      index: true
    },
    
    publishedAt: {
      type: Date,
      index: true
    },
    
    timezone: {
      type: String,
      default: 'Asia/Jakarta'
    },
    
    isRecurring: {
      type: Boolean,
      default: false
    },
    
    recurringPattern: {
      frequency: {
        type: String,
        enum: ['daily', 'weekly', 'monthly'],
        required: function() {
          return this.scheduling.isRecurring;
        }
      },
      interval: {
        type: Number,
        min: 1,
        default: 1
      },
      daysOfWeek: [{
        type: Number,
        min: 0,
        max: 6 // 0 = Sunday, 6 = Saturday
      }],
      endDate: Date,
      maxOccurrences: Number
    }
  },
  
  // Platform-specific Settings
  platformSettings: {
    // Twitter/X specific
    twitter: {
      isThread: {
        type: Boolean,
        default: false
      },
      threadPosition: Number,
      parentTweetId: String,
      replyToTweetId: String,
      quoteTweetId: String
    },
    
    // Facebook specific
    facebook: {
      targetAudience: {
        type: String,
        enum: ['public', 'friends', 'custom'],
        default: 'public'
      },
      allowComments: {
        type: Boolean,
        default: true
      },
      allowShares: {
        type: Boolean,
        default: true
      }
    },
    
    // Instagram specific
    instagram: {
      isStory: {
        type: Boolean,
        default: false
      },
      isReel: {
        type: Boolean,
        default: false
      },
      location: {
        name: String,
        id: String,
        latitude: Number,
        longitude: Number
      },
      userTags: [{
        username: String,
        x: Number, // position percentage
        y: Number  // position percentage
      }]
    },
    
    // LinkedIn specific
    linkedin: {
      visibility: {
        type: String,
        enum: ['public', 'connections', 'logged-in'],
        default: 'public'
      },
      isArticle: {
        type: Boolean,
        default: false
      }
    },
    
    // YouTube specific
    youtube: {
      title: String,
      description: String,
      tags: [String],
      categoryId: String,
      privacy: {
        type: String,
        enum: ['public', 'unlisted', 'private'],
        default: 'public'
      },
      thumbnail: String
    }
  },
  
  // Publishing Results
  publishResult: {
    success: {
      type: Boolean,
      default: false
    },
    
    platformPostId: String,
    platformUrl: String,
    
    error: {
      code: String,
      message: String,
      details: mongoose.Schema.Types.Mixed
    },
    
    attempts: {
      type: Number,
      default: 0,
      min: 0
    },
    
    lastAttemptAt: Date,
    
    retryAfter: Date
  },
  
  // Analytics and Performance
  analytics: {
    views: {
      type: Number,
      default: 0,
      min: 0
    },
    
    likes: {
      type: Number,
      default: 0,
      min: 0
    },
    
    shares: {
      type: Number,
      default: 0,
      min: 0
    },
    
    comments: {
      type: Number,
      default: 0,
      min: 0
    },
    
    clicks: {
      type: Number,
      default: 0,
      min: 0
    },
    
    reach: {
      type: Number,
      default: 0,
      min: 0
    },
    
    impressions: {
      type: Number,
      default: 0,
      min: 0
    },
    
    engagementRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    
    clickThroughRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    
    lastUpdated: Date
  },
  
  // Approval Workflow
  approval: {
    required: {
      type: Boolean,
      default: false
    },
    
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'not_required'],
      default: 'not_required'
    },
    
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    
    approvedAt: Date,
    
    rejectionReason: String,
    
    comments: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      comment: String,
      timestamp: {
        type: Date,
        default: Date.now
      }
    }]
  },
  
  // Metadata
  metadata: {
    source: {
      type: String,
      enum: ['manual', 'auto', 'api', 'bulk'],
      default: 'manual'
    },
    
    campaign: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Campaign'
    },
    
    tags: [{
      type: String,
      trim: true
    }],
    
    notes: String,
    
    customFields: {
      type: Map,
      of: mongoose.Schema.Types.Mixed
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
socialPostSchema.index({ user: 1, 'scheduling.status': 1 });
socialPostSchema.index({ socialAccount: 1, 'scheduling.publishedAt': -1 });
socialPostSchema.index({ 'scheduling.scheduledAt': 1, 'scheduling.status': 1 });
socialPostSchema.index({ 'sourceContent.contentId': 1, 'sourceContent.contentType': 1 });
socialPostSchema.index({ 'publishResult.platformPostId': 1 });
socialPostSchema.index({ 'metadata.campaign': 1 });

// Virtual for engagement rate calculation
socialPostSchema.virtual('calculatedEngagementRate').get(function() {
  const { views, likes, shares, comments } = this.analytics;
  const totalEngagement = likes + shares + comments;
  return views > 0 ? (totalEngagement / views) * 100 : 0;
});

// Virtual for total engagement
socialPostSchema.virtual('totalEngagement').get(function() {
  const { likes, shares, comments } = this.analytics;
  return likes + shares + comments;
});

// Virtual for post performance score
socialPostSchema.virtual('performanceScore').get(function() {
  const { engagementRate, clickThroughRate, reach, impressions } = this.analytics;
  
  // Simple scoring algorithm (can be enhanced)
  let score = 0;
  score += engagementRate * 0.4;
  score += clickThroughRate * 0.3;
  score += (reach / Math.max(impressions, 1)) * 100 * 0.3;
  
  return Math.min(100, Math.max(0, score));
});

// Pre-save middleware
socialPostSchema.pre('save', function(next) {
  // Update engagement rate
  if (this.isModified('analytics')) {
    this.analytics.engagementRate = this.calculatedEngagementRate;
    this.analytics.lastUpdated = new Date();
  }
  
  // Set published date when status changes to published
  if (this.isModified('scheduling.status') && this.scheduling.status === 'published') {
    if (!this.scheduling.publishedAt) {
      this.scheduling.publishedAt = new Date();
    }
  }
  
  // Validate scheduled date
  if (this.scheduling.scheduledAt && this.scheduling.scheduledAt <= new Date()) {
    if (this.scheduling.status === 'scheduled') {
      this.scheduling.status = 'draft';
    }
  }
  
  next();
});

// Static Methods

/**
 * Get scheduled posts ready for publishing
 */
socialPostSchema.statics.getReadyForPublishing = function(limit = 50) {
  return this.find({
    'scheduling.status': 'scheduled',
    'scheduling.scheduledAt': { $lte: new Date() },
    'approval.status': { $in: ['approved', 'not_required'] }
  })
  .populate('socialAccount')
  .populate('user', 'username email')
  .limit(limit)
  .sort({ 'scheduling.scheduledAt': 1 });
};

/**
 * Get posts by status
 */
socialPostSchema.statics.getByStatus = function(status, userId = null, options = {}) {
  const {
    page = 1,
    limit = 20,
    sortBy = '-createdAt'
  } = options;
  
  const query = { 'scheduling.status': status };
  if (userId) query.user = userId;
  
  return this.find(query)
    .populate('socialAccount', 'platform username displayName')
    .populate('user', 'username profile.nama')
    .sort(sortBy)
    .limit(limit)
    .skip((page - 1) * limit);
};

/**
 * Get posts analytics summary
 */
socialPostSchema.statics.getAnalyticsSummary = async function(userId = null, dateRange = {}) {
  const matchStage = {
    'scheduling.status': 'published'
  };
  
  if (userId) matchStage.user = userId;
  
  if (dateRange.startDate || dateRange.endDate) {
    matchStage['scheduling.publishedAt'] = {};
    if (dateRange.startDate) matchStage['scheduling.publishedAt'].$gte = new Date(dateRange.startDate);
    if (dateRange.endDate) matchStage['scheduling.publishedAt'].$lte = new Date(dateRange.endDate);
  }
  
  const stats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalPosts: { $sum: 1 },
        totalViews: { $sum: '$analytics.views' },
        totalLikes: { $sum: '$analytics.likes' },
        totalShares: { $sum: '$analytics.shares' },
        totalComments: { $sum: '$analytics.comments' },
        totalClicks: { $sum: '$analytics.clicks' },
        totalReach: { $sum: '$analytics.reach' },
        totalImpressions: { $sum: '$analytics.impressions' },
        averageEngagementRate: { $avg: '$analytics.engagementRate' }
      }
    }
  ]);
  
  return stats[0] || {
    totalPosts: 0,
    totalViews: 0,
    totalLikes: 0,
    totalShares: 0,
    totalComments: 0,
    totalClicks: 0,
    totalReach: 0,
    totalImpressions: 0,
    averageEngagementRate: 0
  };
};

/**
 * Get top performing posts
 */
socialPostSchema.statics.getTopPerforming = function(limit = 10, metric = 'engagementRate') {
  return this.find({
    'scheduling.status': 'published',
    [`analytics.${metric}`]: { $gt: 0 }
  })
  .populate('socialAccount', 'platform username')
  .sort({ [`analytics.${metric}`]: -1 })
  .limit(limit)
  .lean();
};

// Instance Methods

/**
 * Schedule post for publishing
 */
socialPostSchema.methods.schedule = async function(scheduledAt, timezone = 'Asia/Jakarta') {
  this.scheduling.status = 'scheduled';
  this.scheduling.scheduledAt = scheduledAt;
  this.scheduling.timezone = timezone;
  
  return await this.save();
};

/**
 * Publish post immediately
 */
socialPostSchema.methods.publish = async function() {
  this.scheduling.status = 'published';
  this.scheduling.publishedAt = new Date();
  this.publishResult.success = true;
  
  return await this.save();
};

/**
 * Mark post as failed
 */
socialPostSchema.methods.markAsFailed = async function(error) {
  this.scheduling.status = 'failed';
  this.publishResult.success = false;
  this.publishResult.error = {
    code: error.code || 'PUBLISH_FAILED',
    message: error.message,
    details: error
  };
  this.publishResult.attempts += 1;
  this.publishResult.lastAttemptAt = new Date();
  
  return await this.save();
};

/**
 * Update analytics data
 */
socialPostSchema.methods.updateAnalytics = async function(analyticsData) {
  Object.keys(analyticsData).forEach(key => {
    if (this.analytics[key] !== undefined) {
      this.analytics[key] = analyticsData[key];
    }
  });
  
  this.analytics.lastUpdated = new Date();
  
  return await this.save();
};

/**
 * Add approval comment
 */
socialPostSchema.methods.addApprovalComment = async function(userId, comment) {
  this.approval.comments.push({
    user: userId,
    comment,
    timestamp: new Date()
  });
  
  return await this.save();
};

/**
 * Approve post
 */
socialPostSchema.methods.approve = async function(approvedBy) {
  this.approval.status = 'approved';
  this.approval.approvedBy = approvedBy;
  this.approval.approvedAt = new Date();
  
  return await this.save();
};

/**
 * Reject post
 */
socialPostSchema.methods.reject = async function(reason) {
  this.approval.status = 'rejected';
  this.approval.rejectionReason = reason;
  
  return await this.save();
};

const SocialPost = mongoose.model('SocialPost', socialPostSchema);

module.exports = SocialPost;