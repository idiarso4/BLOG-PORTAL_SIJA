const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username wajib diisi'],
    unique: true,
    trim: true,
    minlength: [3, 'Username minimal 3 karakter'],
    maxlength: [30, 'Username maksimal 30 karakter'],
    match: [/^[a-zA-Z0-9_]+$/, 'Username hanya boleh mengandung huruf, angka, dan underscore']
  },
  
  email: {
    type: String,
    required: [true, 'Email wajib diisi'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      'Format email tidak valid'
    ]
  },
  
  password: {
    type: String,
    required: [true, 'Password wajib diisi'],
    minlength: [6, 'Password minimal 6 karakter'],
    select: false // Tidak akan di-return secara default
  },
  
  role: {
    type: String,
    enum: {
      values: ['admin', 'penulis', 'pembaca'],
      message: 'Role harus salah satu dari: admin, penulis, pembaca'
    },
    default: 'pembaca'
  },
  
  profile: {
    nama: {
      type: String,
      required: [true, 'Nama lengkap wajib diisi'],
      trim: true,
      maxlength: [100, 'Nama maksimal 100 karakter']
    },
    
    foto: {
      type: String,
      default: '/images/default-avatar.png'
    },
    
    bio: {
      type: String,
      maxlength: [500, 'Bio maksimal 500 karakter'],
      trim: true
    },
    
    socialLinks: {
      facebook: {
        type: String,
        match: [/^https?:\/\/(www\.)?facebook\.com\/.*/, 'URL Facebook tidak valid']
      },
      twitter: {
        type: String,
        match: [/^https?:\/\/(www\.)?twitter\.com\/.*/, 'URL Twitter tidak valid']
      },
      instagram: {
        type: String,
        match: [/^https?:\/\/(www\.)?instagram\.com\/.*/, 'URL Instagram tidak valid']
      },
      linkedin: {
        type: String,
        match: [/^https?:\/\/(www\.)?linkedin\.com\/.*/, 'URL LinkedIn tidak valid']
      }
    }
  },
  
  subscription: {
    plan: {
      type: String,
      enum: {
        values: ['free', 'premium', 'pro'],
        message: 'Plan harus salah satu dari: free, premium, pro'
      },
      default: 'free'
    },
    
    expiredAt: {
      type: Date,
      default: null
    },
    
    features: [{
      type: String,
      enum: ['ai_content', 'social_posting', 'analytics', 'priority_support', 'unlimited_articles']
    }],
    
    autoRenew: {
      type: Boolean,
      default: false
    }
  },
  
  preferences: {
    language: {
      type: String,
      enum: ['id', 'en'],
      default: 'id'
    },
    
    timezone: {
      type: String,
      default: 'Asia/Jakarta'
    },
    
    notifications: {
      email: {
        type: Boolean,
        default: true
      },
      push: {
        type: Boolean,
        default: true
      },
      newsletter: {
        type: Boolean,
        default: false
      }
    }
  },
  
  stats: {
    articlesPublished: {
      type: Number,
      default: 0,
      min: 0
    },
    
    totalViews: {
      type: Number,
      default: 0,
      min: 0
    },
    
    totalLikes: {
      type: Number,
      default: 0,
      min: 0
    },
    
    totalComments: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  
  // Account status
  isActive: {
    type: Boolean,
    default: true
  },
  
  emailVerified: {
    type: Boolean,
    default: false
  },
  
  emailVerificationToken: {
    type: String,
    select: false
  },
  
  emailVerificationExpires: {
    type: Date,
    select: false
  },
  
  passwordResetToken: {
    type: String,
    select: false
  },
  
  passwordResetExpires: {
    type: Date,
    select: false
  },
  
  // Login tracking
  lastLogin: {
    type: Date,
    default: null
  },
  
  loginAttempts: {
    type: Number,
    default: 0
  },
  
  lockUntil: {
    type: Date,
    select: false
  },
  
  // Referral system
  referralCode: {
    type: String,
    unique: true,
    sparse: true
  },
  
  referredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Social accounts
  socialAccounts: {
    google: {
      id: String,
      email: String,
      name: String,
      picture: String,
      linkedAt: Date
    },
    facebook: {
      id: String,
      email: String,
      name: String,
      picture: String,
      linkedAt: Date
    },
    twitter: {
      id: String,
      username: String,
      name: String,
      picture: String,
      linkedAt: Date
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });
userSchema.index({ 'subscription.plan': 1 });
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ createdAt: -1 });

// Virtual for account locked status
userSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Virtual for subscription status
userSchema.virtual('subscriptionStatus').get(function() {
  if (this.subscription.plan === 'free') return 'free';
  if (!this.subscription.expiredAt) return 'active';
  return this.subscription.expiredAt > new Date() ? 'active' : 'expired';
});

// Pre-save middleware untuk hash password
userSchema.pre('save', async function(next) {
  // Hanya hash password jika dimodifikasi
  if (!this.isModified('password')) return next();
  
  try {
    // Hash password dengan bcrypt
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    this.password = await bcrypt.hash(this.password, saltRounds);
    next();
  } catch (error) {
    next(error);
  }
});

// Pre-save middleware untuk generate referral code
userSchema.pre('save', function(next) {
  if (this.isNew && !this.referralCode) {
    this.referralCode = this.username + '_' + Math.random().toString(36).substr(2, 6).toUpperCase();
  }
  next();
});

// Method untuk compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error('Error comparing password');
  }
};

// Method untuk generate JWT token
userSchema.methods.generateAuthToken = function() {
  const payload = {
    id: this._id,
    username: this.username,
    email: this.email,
    role: this.role
  };
  
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

// Method untuk generate refresh token
userSchema.methods.generateRefreshToken = function() {
  const payload = {
    id: this._id,
    type: 'refresh'
  };
  
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRE || '30d'
  });
};

// Method untuk increment login attempts
userSchema.methods.incLoginAttempts = function() {
  // Jika sudah ada previous attempt dan belum expired
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  
  // Jika sudah mencapai max attempts dan belum di-lock
  const maxAttempts = 5;
  const lockTime = 2 * 60 * 60 * 1000; // 2 hours
  
  if (this.loginAttempts + 1 >= maxAttempts && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + lockTime };
  }
  
  return this.updateOne(updates);
};

// Method untuk reset login attempts
userSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 },
    $set: { lastLogin: new Date() }
  });
};

// Method untuk update stats
userSchema.methods.updateStats = function(type, increment = 1) {
  const update = {};
  update[`stats.${type}`] = increment;
  
  return this.updateOne({ $inc: update });
};

// Method untuk check subscription access
userSchema.methods.hasFeature = function(feature) {
  if (this.role === 'admin') return true;
  if (this.subscription.plan === 'free') return false;
  
  const planFeatures = {
    premium: ['ai_content', 'social_posting'],
    pro: ['ai_content', 'social_posting', 'analytics', 'priority_support', 'unlimited_articles']
  };
  
  return planFeatures[this.subscription.plan]?.includes(feature) || false;
};

// Static method untuk find by email atau username
userSchema.statics.findByEmailOrUsername = function(identifier) {
  return this.findOne({
    $or: [
      { email: identifier.toLowerCase() },
      { username: identifier }
    ]
  });
};

// Static method untuk create dengan validation
userSchema.statics.createUser = async function(userData) {
  try {
    const user = new this(userData);
    await user.save();
    return user;
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      throw new Error(`${field === 'email' ? 'Email' : 'Username'} sudah digunakan`);
    }
    throw error;
  }
};

// Static method untuk get user statistics
userSchema.statics.getStatistics = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        totalUsers: { $sum: 1 },
        activeUsers: { $sum: { $cond: ['$isActive', 1, 0] } },
        verifiedUsers: { $sum: { $cond: ['$emailVerified', 1, 0] } },
        premiumUsers: { $sum: { $cond: [{ $ne: ['$subscription.plan', 'free'] }, 1, 0] } }
      }
    },
    {
      $project: {
        _id: 0,
        totalUsers: 1,
        activeUsers: 1,
        verifiedUsers: 1,
        premiumUsers: 1,
        inactiveUsers: { $subtract: ['$totalUsers', '$activeUsers'] },
        freeUsers: { $subtract: ['$totalUsers', '$premiumUsers'] }
      }
    }
  ]);
  
  return stats[0] || {
    totalUsers: 0,
    activeUsers: 0,
    verifiedUsers: 0,
    premiumUsers: 0,
    inactiveUsers: 0,
    freeUsers: 0
  };
};

module.exports = mongoose.model('User', userSchema);