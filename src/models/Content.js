const mongoose = require('mongoose');
const logger = require('../config/logger');

/**
 * Content Schema - For AI-generated and template content
 * Converted from Laravel BEEPOS Content model
 */
const contentSchema = new mongoose.Schema({
  // Basic Information
  title: {
    type: String,
    required: [true, 'Content title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters'],
    index: true
  },
  
  type: {
    type: String,
    required: [true, 'Content type is required'],
    enum: {
      values: [
        'article', 'blog_post', 'social_post', 'email', 'landing_page',
        'product_description', 'ad_copy', 'press_release', 'newsletter',
        'seo_content', 'meta_description', 'title_tag', 'template'
      ],
      message: 'Invalid content type'
    },
    index: true
  },
  
  category: {
    type: String,
    required: [true, 'Content category is required'],
    enum: {
      values: [
        'technology', 'business', 'lifestyle', 'health', 'education',
        'entertainment', 'sports', 'travel', 'food', 'fashion',
        'finance', 'marketing', 'general'
      ],
      message: 'Invalid content category'
    },
    index: true
  },
  
  content: {
    type: String,
    required: [true, 'Content body is required']
  },
  
  summary: {
    type: String,
    maxlength: [500, 'Summary cannot exceed 500 characters']
  },
  
  // AI Generation Details
  aiGeneration: {
    isAiGenerated: {
      type: Boolean,
      default: false,
      index: true
    },
    
    model: {
      type: String,
      enum: ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo', 'claude-3', 'custom'],
      required: function() {
        return this.aiGeneration.isAiGenerated;
      }
    },
    
    prompt: {
      type: String,
      required: function() {
        return this.aiGeneration.isAiGenerated;
      }
    },
    
    parameters: {
      temperature: {
        type: Number,
        min: 0,
        max: 2,
        default: 0.7
      },
      maxTokens: {
        type: Number,
        min: 1,
        max: 4000,
        default: 1000
      },
      topP: {
        type: Number,
        min: 0,
        max: 1,
        default: 1
      },
      frequencyPenalty: {
        type: Number,
        min: -2,
        max: 2,
        default: 0
      },
      presencePenalty: {
        type: Number,
        min: -2,
        max: 2,
        default: 0
      }
    },
    
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 0
    },
    
    tokensUsed: {
      type: Number,
      min: 0,
      default: 0
    },
    
    cost: {
      type: Number,
      min: 0,
      default: 0
    },
    
    generatedAt: {
      type: Date,
      default: Date.now
    },
    
    generationTime: {
      type: Number, // in milliseconds
      min: 0
    }
  },
  
  // Template Information
  template: {
    isTemplate: {
      type: Boolean,
      default: false,
      index: true
    },
    
    templateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ContentTemplate'
    },
    
    variables: {
      type: Map,
      of: String
    },
    
    placeholders: [{
      key: {
        type: String,
        required: true
      },
      value: {
        type: String,
        required: true
      },
      type: {
        type: String,
        enum: ['text', 'number', 'date', 'url', 'email'],
        default: 'text'
      }
    }]
  },
  
  // Content Metadata
  metadata: {
    language: {
      type: String,
      default: 'id',
      enum: ['id', 'en', 'es', 'fr', 'de', 'ja', 'ko', 'zh'],
      index: true
    },
    
    wordCount: {
      type: Number,
      min: 0,
      default: 0
    },
    
    characterCount: {
      type: Number,
      min: 0,
      default: 0
    },
    
    readingTime: {
      type: Number, // in minutes
      min: 0,
      default: 0
    },
    
    tone: {
      type: String,
      enum: [
        'professional', 'casual', 'friendly', 'formal', 'conversational',
        'persuasive', 'informative', 'entertaining', 'authoritative'
      ],
      default: 'professional'
    },
    
    targetAudience: {
      type: String,
      enum: [
        'general', 'business', 'technical', 'academic', 'marketing',
        'sales', 'customer_service', 'social_media', 'seo'
      ],
      default: 'general'
    },
    
    keywords: [{
      type: String,
      trim: true,
      lowercase: true
    }],
    
    tags: [{
      type: String,
      trim: true,
      lowercase: true
    }]
  },
  
  // Quality and Performance
  quality: {
    score: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    
    readabilityScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    
    seoScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    
    grammarScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    
    originalityScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    
    engagementPrediction: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    }
  },
  
  // Usage and Performance Tracking
  usage: {
    timesUsed: {
      type: Number,
      min: 0,
      default: 0
    },
    
    lastUsed: {
      type: Date
    },
    
    successRate: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    
    averageRating: {
      type: Number,
      min: 0,
      max: 5,
      default: 0
    },
    
    totalRatings: {
      type: Number,
      min: 0,
      default: 0
    }
  },
  
  // Ownership and Access
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Content owner is required'],
    index: true
  },
  
  visibility: {
    type: String,
    enum: ['private', 'public', 'shared', 'team'],
    default: 'private',
    index: true
  },
  
  sharedWith: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    permissions: {
      type: String,
      enum: ['read', 'edit', 'admin'],
      default: 'read'
    },
    sharedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Status and Workflow
  status: {
    type: String,
    enum: ['draft', 'review', 'approved', 'published', 'archived'],
    default: 'draft',
    index: true
  },
  
  workflow: {
    currentStep: {
      type: String,
      enum: ['creation', 'review', 'editing', 'approval', 'publishing'],
      default: 'creation'
    },
    
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    
    dueDate: {
      type: Date
    },
    
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium'
    }
  },
  
  // Versioning
  version: {
    type: Number,
    default: 1,
    min: 1
  },
  
  parentContent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Content'
  },
  
  versions: [{
    version: {
      type: Number,
      required: true
    },
    content: {
      type: String,
      required: true
    },
    summary: String,
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    changeLog: String
  }],
  
  // External Integration
  integration: {
    publishedTo: [{
      platform: {
        type: String,
        enum: ['wordpress', 'medium', 'linkedin', 'facebook', 'twitter', 'instagram']
      },
      postId: String,
      url: String,
      publishedAt: Date,
      status: {
        type: String,
        enum: ['pending', 'published', 'failed'],
        default: 'pending'
      }
    }],
    
    syncEnabled: {
      type: Boolean,
      default: false
    },
    
    lastSync: {
      type: Date
    }
  },
  
  // Analytics
  analytics: {
    views: {
      type: Number,
      default: 0,
      min: 0
    },
    
    downloads: {
      type: Number,
      default: 0,
      min: 0
    },
    
    shares: {
      type: Number,
      default: 0,
      min: 0
    },
    
    likes: {
      type: Number,
      default: 0,
      min: 0
    },
    
    comments: {
      type: Number,
      default: 0,
      min: 0
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
contentSchema.index({ owner: 1, type: 1 });
contentSchema.index({ owner: 1, status: 1 });
contentSchema.index({ 'aiGeneration.isAiGenerated': 1, createdAt: -1 });
contentSchema.index({ 'template.isTemplate': 1 });
contentSchema.index({ 'metadata.language': 1, category: 1 });
contentSchema.index({ 'usage.timesUsed': -1 });
contentSchema.index({ 'quality.score': -1 });

// Text search index
contentSchema.index({
  title: 'text',
  content: 'text',
  summary: 'text',
  'metadata.keywords': 'text',
  'metadata.tags': 'text'
}, {
  weights: {
    title: 10,
    summary: 5,
    'metadata.keywords': 3,
    'metadata.tags': 2,
    content: 1
  }
});

// Virtual for content preview
contentSchema.virtual('preview').get(function() {
  return this.content.substring(0, 200) + (this.content.length > 200 ? '...' : '');
});

// Pre-save middleware
contentSchema.pre('save', function(next) {
  // Calculate metadata
  if (this.isModified('content')) {
    this.metadata.wordCount = this.content.split(/\s+/).length;
    this.metadata.characterCount = this.content.length;
    this.metadata.readingTime = Math.ceil(this.metadata.wordCount / 200); // 200 WPM
  }
  
  // Auto-generate summary if not provided
  if (!this.summary && this.content) {
    this.summary = this.content.substring(0, 200) + (this.content.length > 200 ? '...' : '');
  }
  
  next();
});

// Static Methods

/**
 * Get content by type and owner
 */
contentSchema.statics.getByTypeAndOwner = function(type, owner, options = {}) {
  const {
    page = 1,
    limit = 10,
    status = null,
    sort = '-createdAt'
  } = options;
  
  const query = { type, owner };
  if (status) query.status = status;
  
  return this.find(query)
    .sort(sort)
    .limit(limit)
    .skip((page - 1) * limit)
    .lean();
};

/**
 * Get AI-generated content statistics
 */
contentSchema.statics.getAiStats = async function(owner = null) {
  const matchStage = { 'aiGeneration.isAiGenerated': true };
  if (owner) matchStage.owner = owner;
  
  const stats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalContent: { $sum: 1 },
        totalTokens: { $sum: '$aiGeneration.tokensUsed' },
        totalCost: { $sum: '$aiGeneration.cost' },
        averageConfidence: { $avg: '$aiGeneration.confidence' },
        averageQuality: { $avg: '$quality.score' },
        modelUsage: {
          $push: '$aiGeneration.model'
        }
      }
    }
  ]);
  
  return stats[0] || {
    totalContent: 0,
    totalTokens: 0,
    totalCost: 0,
    averageConfidence: 0,
    averageQuality: 0,
    modelUsage: []
  };
};

/**
 * Get popular templates
 */
contentSchema.statics.getPopularTemplates = function(limit = 10) {
  return this.find({
    'template.isTemplate': true,
    visibility: { $in: ['public', 'shared'] }
  })
  .sort('-usage.timesUsed')
  .limit(limit)
  .lean();
};

/**
 * Search content
 */
contentSchema.statics.searchContent = function(query, owner, options = {}) {
  const {
    type = null,
    category = null,
    page = 1,
    limit = 10
  } = options;
  
  const searchQuery = {
    $text: { $search: query },
    owner
  };
  
  if (type) searchQuery.type = type;
  if (category) searchQuery.category = category;
  
  return this.find(searchQuery, { score: { $meta: 'textScore' } })
    .sort({ score: { $meta: 'textScore' } })
    .limit(limit)
    .skip((page - 1) * limit)
    .lean();
};

// Instance Methods

/**
 * Create new version
 */
contentSchema.methods.createVersion = function(author, changeLog = '') {
  const newVersion = this.version + 1;
  
  this.versions.push({
    version: this.version,
    content: this.content,
    summary: this.summary,
    author,
    changeLog,
    createdAt: new Date()
  });
  
  this.version = newVersion;
  return this.save();
};

/**
 * Rate content
 */
contentSchema.methods.addRating = function(rating) {
  const totalRatings = this.usage.totalRatings;
  const currentAverage = this.usage.averageRating;
  
  this.usage.totalRatings += 1;
  this.usage.averageRating = ((currentAverage * totalRatings) + rating) / this.usage.totalRatings;
  
  return this.save();
};

/**
 * Increment usage
 */
contentSchema.methods.incrementUsage = function() {
  this.usage.timesUsed += 1;
  this.usage.lastUsed = new Date();
  return this.save();
};

/**
 * Check if user can access content
 */
contentSchema.methods.canAccess = function(user) {
  // Owner can always access
  if (this.owner.toString() === user._id.toString()) {
    return true;
  }
  
  // Public content
  if (this.visibility === 'public') {
    return true;
  }
  
  // Shared content
  if (this.visibility === 'shared') {
    return this.sharedWith.some(share => 
      share.user.toString() === user._id.toString()
    );
  }
  
  // Team content (same organization/team)
  if (this.visibility === 'team') {
    // TODO: Implement team/organization logic
    return false;
  }
  
  return false;
};

/**
 * Check if user can edit content
 */
contentSchema.methods.canEdit = function(user) {
  // Owner can always edit
  if (this.owner.toString() === user._id.toString()) {
    return true;
  }
  
  // Check shared permissions
  const sharedPermission = this.sharedWith.find(share => 
    share.user.toString() === user._id.toString()
  );
  
  return sharedPermission && ['edit', 'admin'].includes(sharedPermission.permissions);
};

const Content = mongoose.model('Content', contentSchema);

module.exports = Content;