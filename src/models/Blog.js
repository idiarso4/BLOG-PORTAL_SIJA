const mongoose = require('mongoose');
const slugify = require('slugify');
const logger = require('../config/logger');

/**
 * Blog Schema - Enhanced version with SEO and metadata fields
 * Converted from Laravel BEEPOS Blog model
 */
const blogSchema = new mongoose.Schema({
  // Basic Information
  title: {
    type: String,
    required: [true, 'Blog title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters'],
    index: true
  },
  
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  },
  
  description: {
    type: String,
    required: [true, 'Blog description is required'],
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  
  content: {
    type: String,
    required: [true, 'Blog content is required']
  },
  
  excerpt: {
    type: String,
    maxlength: [300, 'Excerpt cannot exceed 300 characters']
  },
  
  // Media
  featuredImage: {
    type: String,
    validate: {
      validator: function(v) {
        return !v || /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i.test(v);
      },
      message: 'Featured image must be a valid image URL'
    }
  },
  
  gallery: [{
    url: {
      type: String,
      required: true
    },
    caption: {
      type: String,
      maxlength: [200, 'Caption cannot exceed 200 characters']
    },
    alt: {
      type: String,
      maxlength: [100, 'Alt text cannot exceed 100 characters']
    }
  }],
  
  // Relationships
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Author is required'],
    index: true
  },
  
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    index: true
  },
  
  tags: [{
    type: String,
    trim: true,
    lowercase: true,
    maxlength: [50, 'Tag cannot exceed 50 characters']
  }],
  
  // Status and Publishing
  status: {
    type: String,
    enum: {
      values: ['draft', 'published', 'scheduled', 'archived', 'private'],
      message: 'Status must be one of: draft, published, scheduled, archived, private'
    },
    default: 'draft',
    index: true
  },
  
  visibility: {
    type: String,
    enum: {
      values: ['public', 'private', 'password', 'members'],
      message: 'Visibility must be one of: public, private, password, members'
    },
    default: 'public',
    index: true
  },
  
  password: {
    type: String,
    select: false // Don't include in queries by default
  },
  
  publishedAt: {
    type: Date,
    index: true
  },
  
  scheduledAt: {
    type: Date,
    index: true
  },
  
  // SEO Fields
  seo: {
    metaTitle: {
      type: String,
      maxlength: [60, 'Meta title cannot exceed 60 characters']
    },
    
    metaDescription: {
      type: String,
      maxlength: [160, 'Meta description cannot exceed 160 characters']
    },
    
    metaKeywords: [{
      type: String,
      trim: true,
      lowercase: true
    }],
    
    canonicalUrl: {
      type: String,
      validate: {
        validator: function(v) {
          return !v || /^https?:\/\/.+/.test(v);
        },
        message: 'Canonical URL must be a valid URL'
      }
    },
    
    ogTitle: {
      type: String,
      maxlength: [60, 'OG title cannot exceed 60 characters']
    },
    
    ogDescription: {
      type: String,
      maxlength: [160, 'OG description cannot exceed 160 characters']
    },
    
    ogImage: {
      type: String,
      validate: {
        validator: function(v) {
          return !v || /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i.test(v);
        },
        message: 'OG image must be a valid image URL'
      }
    },
    
    twitterCard: {
      type: String,
      enum: ['summary', 'summary_large_image', 'app', 'player'],
      default: 'summary_large_image'
    },
    
    structuredData: {
      type: mongoose.Schema.Types.Mixed
    },
    
    focusKeyword: {
      type: String,
      trim: true,
      lowercase: true
    },
    
    seoScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    }
  },
  
  // Analytics and Engagement
  analytics: {
    views: {
      type: Number,
      default: 0,
      min: 0
    },
    
    uniqueViews: {
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
    
    readingTime: {
      type: Number, // in minutes
      default: 0
    },
    
    bounceRate: {
      type: Number, // percentage
      default: 0,
      min: 0,
      max: 100
    },
    
    avgTimeOnPage: {
      type: Number, // in seconds
      default: 0
    }
  },
  
  // Content Settings
  settings: {
    allowComments: {
      type: Boolean,
      default: true
    },
    
    allowPingbacks: {
      type: Boolean,
      default: true
    },
    
    allowTrackbacks: {
      type: Boolean,
      default: true
    },
    
    featured: {
      type: Boolean,
      default: false,
      index: true
    },
    
    sticky: {
      type: Boolean,
      default: false,
      index: true
    },
    
    template: {
      type: String,
      default: 'default'
    },
    
    customCSS: {
      type: String
    },
    
    customJS: {
      type: String
    }
  },
  
  // Monetization
  monetization: {
    isPremium: {
      type: Boolean,
      default: false,
      index: true
    },
    
    requiredPlan: {
      type: String,
      enum: ['free', 'basic', 'pro', 'enterprise'],
      default: 'free'
    },
    
    price: {
      type: Number,
      min: 0,
      default: 0
    },
    
    currency: {
      type: String,
      default: 'IDR',
      enum: ['IDR', 'USD', 'EUR']
    }
  },
  
  // AI Generated Content
  aiGenerated: {
    isAiGenerated: {
      type: Boolean,
      default: false,
      index: true
    },
    
    aiModel: {
      type: String,
      enum: ['gpt-3.5-turbo', 'gpt-4', 'claude', 'custom']
    },
    
    aiPrompt: {
      type: String
    },
    
    aiConfidence: {
      type: Number,
      min: 0,
      max: 1
    },
    
    humanEdited: {
      type: Boolean,
      default: false
    },
    
    editedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    
    editedAt: {
      type: Date
    }
  },
  
  // Localization
  language: {
    type: String,
    default: 'id',
    enum: ['id', 'en', 'es', 'fr', 'de', 'ja', 'ko', 'zh']
  },
  
  translations: [{
    language: {
      type: String,
      required: true
    },
    title: {
      type: String,
      required: true
    },
    content: {
      type: String,
      required: true
    },
    slug: {
      type: String,
      required: true
    }
  }],
  
  // Revision History
  revisions: [{
    version: {
      type: Number,
      required: true
    },
    title: String,
    content: String,
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
  
  // Metadata
  metadata: {
    source: {
      type: String,
      enum: ['web', 'api', 'import', 'ai'],
      default: 'web'
    },
    
    importId: String,
    
    externalId: String,
    
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
      delete ret.password;
      return ret;
    }
  },
  toObject: { virtuals: true }
});

// Indexes for performance
blogSchema.index({ author: 1, status: 1 });
blogSchema.index({ category: 1, status: 1 });
blogSchema.index({ tags: 1, status: 1 });
blogSchema.index({ publishedAt: -1, status: 1 });
blogSchema.index({ 'analytics.views': -1 });
blogSchema.index({ 'settings.featured': 1, publishedAt: -1 });
blogSchema.index({ 'settings.sticky': 1, publishedAt: -1 });
blogSchema.index({ 'monetization.isPremium': 1 });
blogSchema.index({ 'aiGenerated.isAiGenerated': 1 });
blogSchema.index({ language: 1 });

// Text search index
blogSchema.index({
  title: 'text',
  content: 'text',
  description: 'text',
  tags: 'text',
  'seo.metaKeywords': 'text'
}, {
  weights: {
    title: 10,
    description: 5,
    tags: 3,
    content: 1,
    'seo.metaKeywords': 2
  }
});

// Virtual for URL
blogSchema.virtual('url').get(function() {
  return `/blog/${this.slug}`;
});

// Virtual for reading time calculation
blogSchema.virtual('readingTime').get(function() {
  if (!this.content) return 0;
  const wordsPerMinute = 200;
  const wordCount = this.content.split(' ').length;
  return Math.ceil(wordCount / wordsPerMinute);
});

// Virtual for SEO title
blogSchema.virtual('seoTitle').get(function() {
  return this.seo?.metaTitle || this.title;
});

// Virtual for SEO description
blogSchema.virtual('seoDescription').get(function() {
  return this.seo?.metaDescription || this.description || this.excerpt;
});

// Pre-save middleware
blogSchema.pre('save', async function(next) {
  try {
    // Generate slug if not provided
    if (!this.slug || this.isModified('title')) {
      let baseSlug = slugify(this.title, {
        lower: true,
        strict: true,
        remove: /[*+~.()'"!:@]/g
      });
      
      let slug = baseSlug;
      let counter = 1;
      
      // Ensure unique slug
      while (await this.constructor.findOne({ 
        slug, 
        _id: { $ne: this._id } 
      })) {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }
      
      this.slug = slug;
    }
    
    // Set published date
    if (this.isModified('status') && this.status === 'published' && !this.publishedAt) {
      this.publishedAt = new Date();
    }
    
    // Calculate reading time
    if (this.isModified('content')) {
      this.analytics.readingTime = this.readingTime;
    }
    
    // Auto-generate SEO fields if not provided
    if (!this.seo.metaTitle) {
      this.seo.metaTitle = this.title.substring(0, 60);
    }
    
    if (!this.seo.metaDescription) {
      this.seo.metaDescription = (this.description || this.excerpt || '').substring(0, 160);
    }
    
    // Set OG fields
    if (!this.seo.ogTitle) {
      this.seo.ogTitle = this.seo.metaTitle;
    }
    
    if (!this.seo.ogDescription) {
      this.seo.ogDescription = this.seo.metaDescription;
    }
    
    if (!this.seo.ogImage && this.featuredImage) {
      this.seo.ogImage = this.featuredImage;
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Post-save middleware for analytics
blogSchema.post('save', function(doc) {
  if (doc.isModified('analytics.views')) {
    logger.info('Blog view recorded', {
      blogId: doc._id,
      title: doc.title,
      views: doc.analytics.views
    });
  }
});

// Static Methods

/**
 * Get published blogs with pagination
 */
blogSchema.statics.getPublished = function(options = {}) {
  const {
    page = 1,
    limit = 10,
    category = null,
    author = null,
    tags = [],
    featured = null,
    sort = '-publishedAt'
  } = options;
  
  const query = {
    status: 'published',
    visibility: 'public',
    publishedAt: { $lte: new Date() }
  };
  
  if (category) query.category = category;
  if (author) query.author = author;
  if (tags.length > 0) query.tags = { $in: tags };
  if (featured !== null) query['settings.featured'] = featured;
  
  return this.find(query)
    .populate('author', 'username profile.nama profile.avatar')
    .populate('category', 'nama slug')
    .sort(sort)
    .limit(limit)
    .skip((page - 1) * limit)
    .lean();
};

/**
 * Get featured blogs
 */
blogSchema.statics.getFeatured = function(limit = 5) {
  return this.find({
    status: 'published',
    visibility: 'public',
    'settings.featured': true,
    publishedAt: { $lte: new Date() }
  })
  .populate('author', 'username profile.nama profile.avatar')
  .populate('category', 'nama slug')
  .sort('-publishedAt')
  .limit(limit)
  .lean();
};

/**
 * Get popular blogs by views
 */
blogSchema.statics.getPopular = function(limit = 10, days = 30) {
  const dateLimit = new Date();
  dateLimit.setDate(dateLimit.getDate() - days);
  
  return this.find({
    status: 'published',
    visibility: 'public',
    publishedAt: { $gte: dateLimit }
  })
  .populate('author', 'username profile.nama profile.avatar')
  .populate('category', 'nama slug')
  .sort('-analytics.views')
  .limit(limit)
  .lean();
};

/**
 * Search blogs
 */
blogSchema.statics.search = function(query, options = {}) {
  const {
    page = 1,
    limit = 10,
    category = null,
    author = null
  } = options;
  
  const searchQuery = {
    $text: { $search: query },
    status: 'published',
    visibility: 'public'
  };
  
  if (category) searchQuery.category = category;
  if (author) searchQuery.author = author;
  
  return this.find(searchQuery, { score: { $meta: 'textScore' } })
    .populate('author', 'username profile.nama profile.avatar')
    .populate('category', 'nama slug')
    .sort({ score: { $meta: 'textScore' } })
    .limit(limit)
    .skip((page - 1) * limit)
    .lean();
};

/**
 * Get blog statistics
 */
blogSchema.statics.getStatistics = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        totalBlogs: { $sum: 1 },
        publishedBlogs: {
          $sum: { $cond: [{ $eq: ['$status', 'published'] }, 1, 0] }
        },
        draftBlogs: {
          $sum: { $cond: [{ $eq: ['$status', 'draft'] }, 1, 0] }
        },
        totalViews: { $sum: '$analytics.views' },
        totalLikes: { $sum: '$analytics.likes' },
        totalComments: { $sum: '$analytics.comments' },
        aiGeneratedBlogs: {
          $sum: { $cond: ['$aiGenerated.isAiGenerated', 1, 0] }
        },
        premiumBlogs: {
          $sum: { $cond: ['$monetization.isPremium', 1, 0] }
        }
      }
    }
  ]);
  
  return stats[0] || {
    totalBlogs: 0,
    publishedBlogs: 0,
    draftBlogs: 0,
    totalViews: 0,
    totalLikes: 0,
    totalComments: 0,
    aiGeneratedBlogs: 0,
    premiumBlogs: 0
  };
};

// Instance Methods

/**
 * Increment view count
 */
blogSchema.methods.incrementViews = async function(isUnique = false) {
  this.analytics.views += 1;
  if (isUnique) {
    this.analytics.uniqueViews += 1;
  }
  return this.save();
};

/**
 * Add revision
 */
blogSchema.methods.addRevision = function(author, changeLog = '') {
  const version = this.revisions.length + 1;
  
  this.revisions.push({
    version,
    title: this.title,
    content: this.content,
    author,
    changeLog,
    createdAt: new Date()
  });
  
  return this.save();
};

/**
 * Check if user can access blog
 */
blogSchema.methods.canAccess = function(user = null) {
  // Public blogs
  if (this.visibility === 'public' && this.status === 'published') {
    return true;
  }
  
  // Private blogs - only author and admins
  if (this.visibility === 'private') {
    return user && (
      user._id.toString() === this.author.toString() ||
      user.role === 'admin'
    );
  }
  
  // Password protected
  if (this.visibility === 'password') {
    return false; // Requires password verification
  }
  
  // Members only
  if (this.visibility === 'members') {
    return user && user.isActive;
  }
  
  return false;
};

const Blog = mongoose.model('Blog', blogSchema);

module.exports = Blog;