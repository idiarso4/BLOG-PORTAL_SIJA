const mongoose = require('mongoose');

const ScheduledPostSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  platforms: [{
    type: String,
    enum: ['facebook', 'twitter', 'instagram', 'linkedin', 'tiktok', 'youtube'],
    required: true
  }],
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  imageUrl: {
    type: String,
    default: null
  },
  link: {
    type: String,
    default: null
  },
  hashtags: [{ type: String }],
  article: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Article',
    default: null
  },
  scheduledAt: {
    type: Date,
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'queued', 'posted', 'failed', 'canceled'],
    default: 'pending',
    index: true
  },
  attempts: {
    type: Number,
    default: 0,
    min: 0
  },
  maxRetries: {
    type: Number,
    default: 3,
    min: 0,
    max: 10
  },
  lastError: {
    type: String,
    default: null
  },
  results: [{
    platform: { type: String },
    postId: { type: String, default: null },
    postedAt: { type: Date, default: null },
    status: { type: String, enum: ['success', 'failed', 'pending'], default: 'pending' },
    error: { type: String, default: null }
  }]
}, {
  timestamps: true
});

ScheduledPostSchema.index({ status: 1, scheduledAt: 1 });

module.exports = mongoose.model('ScheduledPost', ScheduledPostSchema);
