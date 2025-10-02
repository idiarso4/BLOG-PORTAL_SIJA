const mongoose = require('mongoose');
const slugify = require('slugify');

const articleSchema = new mongoose.Schema({
  judul: {
    type: String,
    required: [true, 'Judul artikel wajib diisi'],
    trim: true,
    minlength: [10, 'Judul minimal 10 karakter'],
    maxlength: [200, 'Judul maksimal 200 karakter']
  },
  
  slug: {
    type: String,
    unique: true,
    lowercase: true,
    index: true
  },
  
  konten: {
    type: String,
    required: [true, 'Konten artikel wajib diisi'],
    minlength: [100, 'Konten minimal 100 karakter']
  },
  
  ringkasan: {
    type: String,
    maxlength: [500, 'Ringkasan maksimal 500 karakter'],
    trim: true
  },
  
  thumbnail: {
    type: String,
    default: null
  },
  
  kategori: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Kategori artikel wajib dipilih'],
    index: true
  },
  
  tags: [{
    type: String,
    trim: true,
    lowercase: true,
    maxlength: [50, 'Tag maksimal 50 karakter']
  }],
  
  penulis: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Penulis artikel wajib diisi'],
    index: true
  },
  
  status: {
    type: String,
    enum: {
      values: ['draft', 'published', 'archived', 'scheduled'],
      message: 'Status harus salah satu dari: draft, published, archived, scheduled'
    },
    default: 'draft',
    index: true
  },
  
  featured: {
    type: Boolean,
    default: false,
    index: true
  },
  
  premium: {
    type: Boolean,
    default: false,
    index: true
  },
  
  // Content metadata
  metadata: {
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
    
    readTime: {
      type: Number, // in minutes
      default: 0,
      min: 0
    },
    
    wordCount: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  
  // SEO optimization
  seo: {
    metaTitle: {
      type: String,
      maxlength: [60, 'Meta title maksimal 60 karakter'],
      trim: true
    },
    
    metaDescription: {
      type: String,
      maxlength: [160, 'Meta description maksimal 160 karakter'],
      trim: true
    },
    
    keywords: [{
      type: String,
      trim: true,
      lowercase: true
    }],
    
    canonicalUrl: {
      type: String,
      trim: true
    },
    
    ogImage: {
      type: String,
      trim: true
    },
    
    structuredData: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  
  // Social media integration
  socialMedia: {
    autoPost: {
      type: Boolean,
      default: false
    },
    
    platforms: [{
      type: String,
      enum: ['facebook', 'twitter', 'instagram', 'linkedin', 'tiktok']
    }],
    
    customMessage: {
      type: String,
      maxlength: [280, 'Custom message maksimal 280 karakter'],
      trim: true
    },
    
    hashtags: [{
      type: String,
      trim: true,
      match: [/^#[a-zA-Z0-9_]+$/, 'Hashtag harus dimulai dengan # dan hanya mengandung huruf, angka, underscore']
    }],
    
    postHistory: [{
      platform: {
        type: String,
        enum: ['facebook', 'twitter', 'instagram', 'linkedin', 'tiktok']
      },
      postId: String,
      postedAt: {
        type: Date,
        default: Date.now
      },
      status: {
        type: String,
        enum: ['success', 'failed', 'pending'],
        default: 'pending'
      },
      error: String
    }]
  },
  
  // Content versioning
  version: {
    type: Number,
    default: 1,
    min: 1
  },
  
  previousVersions: [{
    version: Number,
    konten: String,
    updatedAt: Date,
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    changeNote: String
  }],
  
  // Publishing schedule
  publishedAt: {
    type: Date,
    default: null,
    index: true
  },
  
  scheduledAt: {
    type: Date,
    default: null,
    index: true
  },
  
  // Content flags
  flags: {
    isAiGenerated: {
      type: Boolean,
      default: false
    },
    
    aiModel: {
      type: String,
      default: null
    },
    
    aiPrompt: {
      type: String,
      default: null
    },
    
    needsReview: {
      type: Boolean,
      default: false
    },
    
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    
    reviewedAt: {
      type: Date,
      default: null
    }
  },
  
  // Analytics tracking
  analytics: {
    dailyViews: [{
      date: {
        type: Date,
        required: true
      },
      views: {
        type: Number,
        default: 0,
        min: 0
      }
    }],
    
    referrers: [{
      source: String,
      visits: {
        type: Number,
        default: 0,
        min: 0
      }
    }],
    
    countries: [{
      country: String,
      visits: {
        type: Number,
        default: 0,
        min: 0
      }
    }],
    
    devices: [{
      device: {
        type: String,
        enum: ['desktop', 'mobile', 'tablet']
      },
      visits: {
        type: Number,
        default: 0,
        min: 0
      }
    }]
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
articleSchema.index({ slug: 1 });
articleSchema.index({ status: 1, publishedAt: -1 });
articleSchema.index({ kategori: 1, status: 1 });
articleSchema.index({ penulis: 1, status: 1 });
articleSchema.index({ tags: 1 });
articleSchema.index({ featured: 1, status: 1 });
articleSchema.index({ premium: 1, status: 1 });
articleSchema.index({ 'metadata.views': -1 });
articleSchema.index({ createdAt: -1 });
articleSchema.index({ publishedAt: -1 });

// Text search index
articleSchema.index({
  judul: 'text',
  konten: 'text',
  ringkasan: 'text',
  tags: 'text'
}, {
  weights: {
    judul: 10,
    ringkasan: 5,
    tags: 3,
    konten: 1
  }
});

// Virtual for article URL
articleSchema.virtual('url').get(function() {
  return `/artikel/${this.slug}`;
});

// Virtual for reading time in readable format
articleSchema.virtual('readingTime').get(function() {
  const minutes = this.metadata.readTime;
  if (minutes < 1) return 'Kurang dari 1 menit';
  if (minutes === 1) return '1 menit';
  return `${minutes} menit`;
});

// Virtual for published status
articleSchema.virtual('isPublished').get(function() {
  return this.status === 'published' && this.publishedAt && this.publishedAt <= new Date();
});

// Virtual for scheduled status
articleSchema.virtual('isScheduled').get(function() {
  return this.status === 'scheduled' && this.scheduledAt && this.scheduledAt > new Date();
});

// Virtual for engagement rate
articleSchema.virtual('engagementRate').get(function() {
  const { views, likes, shares, comments } = this.metadata;
  if (views === 0) return 0;
  return ((likes + shares + comments) / views * 100).toFixed(2);
});

// Pre-save middleware untuk generate slug
articleSchema.pre('save', function(next) {
  if (this.isModified('judul') || this.isNew) {
    this.slug = this.generateUniqueSlug(this.judul);
  }
  next();
});

// Pre-save middleware untuk calculate reading time dan word count
articleSchema.pre('save', function(next) {
  if (this.isModified('konten')) {
    this.calculateReadingTime();
    this.calculateWordCount();
  }
  next();
});

// Pre-save middleware untuk auto-generate SEO fields
articleSchema.pre('save', function(next) {
  if (this.isModified('judul') || this.isModified('ringkasan')) {
    this.generateSEOFields();
  }
  next();
});

// Pre-save middleware untuk handle publishing
articleSchema.pre('save', function(next) {
  if (this.isModified('status')) {
    if (this.status === 'published' && !this.publishedAt) {
      this.publishedAt = new Date();
    }
  }
  next();
});

// Method untuk generate unique slug
articleSchema.methods.generateUniqueSlug = function(title) {
  const baseSlug = slugify(title, {
    lower: true,
    strict: true,
    locale: 'id'
  });
  
  // Add timestamp to ensure uniqueness
  const timestamp = Date.now().toString().slice(-6);
  return `${baseSlug}-${timestamp}`;
};

// Method untuk calculate reading time
articleSchema.methods.calculateReadingTime = function() {
  const wordsPerMinute = 200; // Average reading speed
  const wordCount = this.konten.split(/\s+/).length;
  this.metadata.readTime = Math.ceil(wordCount / wordsPerMinute);
};

// Method untuk calculate word count
articleSchema.methods.calculateWordCount = function() {
  this.metadata.wordCount = this.konten.split(/\s+/).length;
};

// Method untuk generate SEO fields
articleSchema.methods.generateSEOFields = function() {
  if (!this.seo.metaTitle) {
    this.seo.metaTitle = this.judul.substring(0, 60);
  }
  
  if (!this.seo.metaDescription) {
    this.seo.metaDescription = this.ringkasan || 
      this.konten.replace(/<[^>]*>/g, '').substring(0, 160);
  }
  
  // Generate structured data
  this.seo.structuredData = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": this.judul,
    "description": this.seo.metaDescription,
    "image": this.thumbnail,
    "datePublished": this.publishedAt,
    "dateModified": this.updatedAt,
    "wordCount": this.metadata.wordCount,
    "timeRequired": `PT${this.metadata.readTime}M`
  };
};

// Method untuk increment view count
articleSchema.methods.incrementViews = async function(country = null, device = null, referrer = null) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Increment total views
  this.metadata.views += 1;
  
  // Update daily views
  const dailyView = this.analytics.dailyViews.find(dv => 
    dv.date.getTime() === today.getTime()
  );
  
  if (dailyView) {
    dailyView.views += 1;
  } else {
    this.analytics.dailyViews.push({
      date: today,
      views: 1
    });
  }
  
  // Update country stats
  if (country) {
    const countryStats = this.analytics.countries.find(c => c.country === country);
    if (countryStats) {
      countryStats.visits += 1;
    } else {
      this.analytics.countries.push({ country, visits: 1 });
    }
  }
  
  // Update device stats
  if (device) {
    const deviceStats = this.analytics.devices.find(d => d.device === device);
    if (deviceStats) {
      deviceStats.visits += 1;
    } else {
      this.analytics.devices.push({ device, visits: 1 });
    }
  }
  
  // Update referrer stats
  if (referrer) {
    const referrerStats = this.analytics.referrers.find(r => r.source === referrer);
    if (referrerStats) {
      referrerStats.visits += 1;
    } else {
      this.analytics.referrers.push({ source: referrer, visits: 1 });
    }
  }
  
  await this.save();
};

// Method untuk increment engagement metrics
articleSchema.methods.incrementEngagement = async function(type) {
  const validTypes = ['likes', 'shares', 'comments'];
  if (!validTypes.includes(type)) {
    throw new Error('Invalid engagement type');
  }
  
  this.metadata[type] += 1;
  await this.save();
};

// Method untuk create new version
articleSchema.methods.createVersion = function(updatedBy, changeNote = '') {
  this.previousVersions.push({
    version: this.version,
    konten: this.konten,
    updatedAt: new Date(),
    updatedBy,
    changeNote
  });
  
  this.version += 1;
};

// Method untuk publish article
articleSchema.methods.publish = async function() {
  this.status = 'published';
  this.publishedAt = new Date();
  await this.save();
};

// Method untuk schedule article
articleSchema.methods.schedule = async function(scheduledDate) {
  this.status = 'scheduled';
  this.scheduledAt = new Date(scheduledDate);
  await this.save();
};

// Method untuk archive article
articleSchema.methods.archive = async function() {
  this.status = 'archived';
  await this.save();
};

// Static method untuk find published articles
articleSchema.statics.findPublished = function(options = {}) {
  const query = {
    status: 'published',
    publishedAt: { $lte: new Date() }
  };
  
  if (options.kategori) query.kategori = options.kategori;
  if (options.penulis) query.penulis = options.penulis;
  if (options.featured !== undefined) query.featured = options.featured;
  if (options.premium !== undefined) query.premium = options.premium;
  if (options.tags) query.tags = { $in: options.tags };
  
  return this.find(query)
    .populate('penulis', 'username profile.nama profile.foto')
    .populate('kategori', 'nama slug')
    .sort({ publishedAt: -1 });
};

// Static method untuk search articles
articleSchema.statics.searchArticles = function(searchTerm, options = {}) {
  const query = {
    $text: { $search: searchTerm },
    status: 'published',
    publishedAt: { $lte: new Date() }
  };
  
  if (options.kategori) query.kategori = options.kategori;
  if (options.penulis) query.penulis = options.penulis;
  
  return this.find(query, { score: { $meta: 'textScore' } })
    .populate('penulis', 'username profile.nama profile.foto')
    .populate('kategori', 'nama slug')
    .sort({ score: { $meta: 'textScore' } });
};

// Static method untuk get trending articles
articleSchema.statics.getTrending = function(days = 7, limit = 10) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.aggregate([
    {
      $match: {
        status: 'published',
        publishedAt: { $gte: startDate }
      }
    },
    {
      $addFields: {
        trendingScore: {
          $add: [
            { $multiply: ['$metadata.views', 1] },
            { $multiply: ['$metadata.likes', 5] },
            { $multiply: ['$metadata.shares', 10] },
            { $multiply: ['$metadata.comments', 15] }
          ]
        }
      }
    },
    {
      $sort: { trendingScore: -1 }
    },
    {
      $limit: limit
    },
    {
      $lookup: {
        from: 'users',
        localField: 'penulis',
        foreignField: '_id',
        as: 'penulis'
      }
    },
    {
      $lookup: {
        from: 'categories',
        localField: 'kategori',
        foreignField: '_id',
        as: 'kategori'
      }
    }
  ]);
};

// Static method untuk get article statistics
articleSchema.statics.getStatistics = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        totalArticles: { $sum: 1 },
        publishedArticles: { $sum: { $cond: ['$isPublished', 1, 0] } },
        draftArticles: { $sum: { $cond: [{ $eq: ['$status', 'draft'] }, 1, 0] } },
        featuredArticles: { $sum: { $cond: ['$featured', 1, 0] } },
        premiumArticles: { $sum: { $cond: ['$premium', 1, 0] } },
        totalViews: { $sum: '$metadata.views' },
        totalLikes: { $sum: '$metadata.likes' },
        totalShares: { $sum: '$metadata.shares' },
        totalComments: { $sum: '$metadata.comments' },
        avgReadTime: { $avg: '$metadata.readTime' }
      }
    }
  ]);
  
  return stats[0] || {
    totalArticles: 0,
    publishedArticles: 0,
    draftArticles: 0,
    featuredArticles: 0,
    premiumArticles: 0,
    totalViews: 0,
    totalLikes: 0,
    totalShares: 0,
    totalComments: 0,
    avgReadTime: 0
  };
};

module.exports = mongoose.model('Article', articleSchema);