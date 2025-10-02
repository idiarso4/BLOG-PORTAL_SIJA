const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  artikel: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Article',
    required: [true, 'Artikel wajib diisi'],
    index: true
  },
  
  penulis: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Penulis komentar wajib diisi'],
    index: true
  },
  
  konten: {
    type: String,
    required: [true, 'Konten komentar wajib diisi'],
    trim: true,
    minlength: [1, 'Komentar minimal 1 karakter'],
    maxlength: [1000, 'Komentar maksimal 1000 karakter']
  },
  
  // Nested comments support
  parent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment',
    default: null,
    index: true
  },
  
  // Comment status
  status: {
    type: String,
    enum: {
      values: ['pending', 'approved', 'rejected', 'spam'],
      message: 'Status harus salah satu dari: pending, approved, rejected, spam'
    },
    default: 'pending',
    index: true
  },
  
  // Engagement metrics
  likes: {
    type: Number,
    default: 0,
    min: 0
  },
  
  dislikes: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // User interactions tracking
  likedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  dislikedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  // Moderation fields
  moderatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  
  moderatedAt: {
    type: Date,
    default: null
  },
  
  moderationNote: {
    type: String,
    maxlength: [500, 'Catatan moderasi maksimal 500 karakter'],
    trim: true
  },
  
  // Spam detection
  spamScore: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  
  // User info (for guest comments if implemented)
  guestInfo: {
    nama: {
      type: String,
      trim: true,
      maxlength: [100, 'Nama maksimal 100 karakter']
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Format email tidak valid']
    },
    website: {
      type: String,
      trim: true,
      match: [/^https?:\/\/.+/, 'Format website tidak valid']
    }
  },
  
  // Technical metadata
  metadata: {
    ipAddress: {
      type: String,
      default: null
    },
    
    userAgent: {
      type: String,
      default: null
    },
    
    edited: {
      type: Boolean,
      default: false
    },
    
    editedAt: {
      type: Date,
      default: null
    },
    
    editHistory: [{
      konten: String,
      editedAt: {
        type: Date,
        default: Date.now
      },
      reason: String
    }]
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
commentSchema.index({ artikel: 1, status: 1, createdAt: -1 });
commentSchema.index({ penulis: 1, status: 1 });
commentSchema.index({ parent: 1, status: 1 });
commentSchema.index({ status: 1, createdAt: -1 });
commentSchema.index({ spamScore: -1 });
commentSchema.index({ createdAt: -1 });

// Virtual for comment depth/level
commentSchema.virtual('level').get(function() {
  return this._level || 0;
});

// Virtual for has replies
commentSchema.virtual('hasReplies').get(function() {
  return this._repliesCount > 0;
});

// Virtual for net likes (likes - dislikes)
commentSchema.virtual('netLikes').get(function() {
  return this.likes - this.dislikes;
});

// Virtual for is approved
commentSchema.virtual('isApproved').get(function() {
  return this.status === 'approved';
});

// Virtual for is guest comment
commentSchema.virtual('isGuest').get(function() {
  return !this.penulis && this.guestInfo && this.guestInfo.nama;
});

// Pre-save middleware untuk spam detection
commentSchema.pre('save', function(next) {
  if (this.isModified('konten')) {
    this.calculateSpamScore();
  }
  next();
});

// Method untuk calculate spam score (simple implementation)
commentSchema.methods.calculateSpamScore = function() {
  let score = 0;
  const content = this.konten.toLowerCase();
  
  // Check for spam indicators
  const spamKeywords = ['viagra', 'casino', 'lottery', 'winner', 'congratulations', 'click here', 'free money'];
  const urlPattern = /https?:\/\/[^\s]+/g;
  const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  
  // Keyword spam
  spamKeywords.forEach(keyword => {
    if (content.includes(keyword)) {
      score += 20;
    }
  });
  
  // URL spam
  const urls = content.match(urlPattern) || [];
  if (urls.length > 2) {
    score += 30;
  } else if (urls.length > 0) {
    score += 10;
  }
  
  // Email spam
  const emails = content.match(emailPattern) || [];
  if (emails.length > 1) {
    score += 25;
  } else if (emails.length > 0) {
    score += 10;
  }
  
  // Excessive caps
  const capsRatio = (content.match(/[A-Z]/g) || []).length / content.length;
  if (capsRatio > 0.5) {
    score += 15;
  }
  
  // Repetitive characters
  if (/(.)\1{4,}/.test(content)) {
    score += 10;
  }
  
  // Very short or very long comments
  if (content.length < 10) {
    score += 5;
  } else if (content.length > 500) {
    score += 10;
  }
  
  this.spamScore = Math.min(score, 100);
  
  // Auto-mark as spam if score is too high
  if (this.spamScore >= 70) {
    this.status = 'spam';
  }
};

// Method untuk like comment
commentSchema.methods.likeComment = async function(userId) {
  // Remove from dislikes if exists
  this.dislikedBy = this.dislikedBy.filter(id => !id.equals(userId));
  
  // Add to likes if not already liked
  if (!this.likedBy.some(id => id.equals(userId))) {
    this.likedBy.push(userId);
  }
  
  // Update counts
  this.likes = this.likedBy.length;
  this.dislikes = this.dislikedBy.length;
  
  await this.save();
};

// Method untuk dislike comment
commentSchema.methods.dislikeComment = async function(userId) {
  // Remove from likes if exists
  this.likedBy = this.likedBy.filter(id => !id.equals(userId));
  
  // Add to dislikes if not already disliked
  if (!this.dislikedBy.some(id => id.equals(userId))) {
    this.dislikedBy.push(userId);
  }
  
  // Update counts
  this.likes = this.likedBy.length;
  this.dislikes = this.dislikedBy.length;
  
  await this.save();
};

// Method untuk remove like/dislike
commentSchema.methods.removeLikeDislike = async function(userId) {
  this.likedBy = this.likedBy.filter(id => !id.equals(userId));
  this.dislikedBy = this.dislikedBy.filter(id => !id.equals(userId));
  
  this.likes = this.likedBy.length;
  this.dislikes = this.dislikedBy.length;
  
  await this.save();
};

// Method untuk approve comment
commentSchema.methods.approve = async function(moderatorId, note = '') {
  this.status = 'approved';
  this.moderatedBy = moderatorId;
  this.moderatedAt = new Date();
  this.moderationNote = note;
  
  await this.save();
};

// Method untuk reject comment
commentSchema.methods.reject = async function(moderatorId, note = '') {
  this.status = 'rejected';
  this.moderatedBy = moderatorId;
  this.moderatedAt = new Date();
  this.moderationNote = note;
  
  await this.save();
};

// Method untuk mark as spam
commentSchema.methods.markAsSpam = async function(moderatorId, note = '') {
  this.status = 'spam';
  this.moderatedBy = moderatorId;
  this.moderatedAt = new Date();
  this.moderationNote = note;
  
  await this.save();
};

// Method untuk edit comment
commentSchema.methods.editComment = async function(newContent, reason = '') {
  // Save to edit history
  this.metadata.editHistory.push({
    konten: this.konten,
    editedAt: new Date(),
    reason
  });
  
  // Update content
  this.konten = newContent;
  this.metadata.edited = true;
  this.metadata.editedAt = new Date();
  
  // Recalculate spam score
  this.calculateSpamScore();
  
  await this.save();
};

// Method untuk get replies
commentSchema.methods.getReplies = function(status = 'approved') {
  const query = { parent: this._id };
  if (status) {
    query.status = status;
  }
  
  return this.constructor.find(query)
    .populate('penulis', 'username profile.nama profile.foto')
    .sort({ createdAt: 1 });
};

// Method untuk get all descendants (nested replies)
commentSchema.methods.getAllReplies = async function(status = 'approved') {
  const replies = [];
  const directReplies = await this.getReplies(status);
  
  for (const reply of directReplies) {
    replies.push(reply);
    const nestedReplies = await reply.getAllReplies(status);
    replies.push(...nestedReplies);
  }
  
  return replies;
};

// Static method untuk get comments for article
commentSchema.statics.getArticleComments = function(articleId, options = {}) {
  const {
    status = 'approved',
    page = 1,
    limit = 20,
    sortBy = 'createdAt',
    sortOrder = 1
  } = options;
  
  const query = {
    artikel: articleId,
    parent: null // Only root comments
  };
  
  if (status) {
    query.status = status;
  }
  
  const sort = {};
  sort[sortBy] = sortOrder;
  
  return this.find(query)
    .populate('penulis', 'username profile.nama profile.foto')
    .sort(sort)
    .limit(limit * 1)
    .skip((page - 1) * limit);
};

// Static method untuk get comment tree
commentSchema.statics.getCommentTree = async function(articleId, status = 'approved') {
  const rootComments = await this.getArticleComments(articleId, { status });
  const tree = [];
  
  for (const comment of rootComments) {
    const commentData = comment.toObject();
    commentData.replies = await this.buildCommentTree(comment._id, status);
    tree.push(commentData);
  }
  
  return tree;
};

// Static method untuk build comment tree recursively
commentSchema.statics.buildCommentTree = async function(parentId, status = 'approved', level = 1) {
  const query = { parent: parentId };
  if (status) {
    query.status = status;
  }
  
  const comments = await this.find(query)
    .populate('penulis', 'username profile.nama profile.foto')
    .sort({ createdAt: 1 });
  
  const tree = [];
  
  for (const comment of comments) {
    const commentData = comment.toObject();
    commentData.level = level;
    commentData.replies = await this.buildCommentTree(comment._id, status, level + 1);
    tree.push(commentData);
  }
  
  return tree;
};

// Static method untuk get pending comments for moderation
commentSchema.statics.getPendingComments = function(options = {}) {
  const {
    page = 1,
    limit = 20,
    sortBy = 'createdAt',
    sortOrder = -1
  } = options;
  
  const sort = {};
  sort[sortBy] = sortOrder;
  
  return this.find({ status: 'pending' })
    .populate('penulis', 'username profile.nama profile.foto')
    .populate('artikel', 'judul slug')
    .sort(sort)
    .limit(limit * 1)
    .skip((page - 1) * limit);
};

// Static method untuk get spam comments
commentSchema.statics.getSpamComments = function(options = {}) {
  const {
    page = 1,
    limit = 20,
    minSpamScore = 50
  } = options;
  
  return this.find({
    $or: [
      { status: 'spam' },
      { spamScore: { $gte: minSpamScore } }
    ]
  })
    .populate('penulis', 'username profile.nama profile.foto')
    .populate('artikel', 'judul slug')
    .sort({ spamScore: -1, createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);
};

// Static method untuk get comment statistics
commentSchema.statics.getStatistics = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        totalComments: { $sum: 1 },
        approvedComments: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } },
        pendingComments: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
        rejectedComments: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } },
        spamComments: { $sum: { $cond: [{ $eq: ['$status', 'spam'] }, 1, 0] } },
        totalLikes: { $sum: '$likes' },
        totalDislikes: { $sum: '$dislikes' },
        avgSpamScore: { $avg: '$spamScore' }
      }
    }
  ]);
  
  return stats[0] || {
    totalComments: 0,
    approvedComments: 0,
    pendingComments: 0,
    rejectedComments: 0,
    spamComments: 0,
    totalLikes: 0,
    totalDislikes: 0,
    avgSpamScore: 0
  };
};

// Static method untuk bulk moderate comments
commentSchema.statics.bulkModerate = async function(commentIds, action, moderatorId, note = '') {
  const validActions = ['approve', 'reject', 'spam'];
  if (!validActions.includes(action)) {
    throw new Error('Invalid moderation action');
  }
  
  const updateData = {
    status: action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'spam',
    moderatedBy: moderatorId,
    moderatedAt: new Date(),
    moderationNote: note
  };
  
  return this.updateMany(
    { _id: { $in: commentIds } },
    { $set: updateData }
  );
};

module.exports = mongoose.model('Comment', commentSchema);