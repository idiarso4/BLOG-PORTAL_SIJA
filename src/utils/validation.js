const { body, validationResult } = require('express-validator');

// Validation rules untuk user registration
const userRegistrationValidation = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username harus antara 3-30 karakter')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username hanya boleh mengandung huruf, angka, dan underscore'),

  body('email')
    .trim()
    .isEmail()
    .withMessage('Format email tidak valid')
    .normalizeEmail(),

  body('password')
    .isLength({ min: 6 })
    .withMessage('Password minimal 6 karakter')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password harus mengandung huruf kecil, huruf besar, dan angka'),

  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Konfirmasi password tidak cocok');
      }
      return true;
    }),

  body('profile.nama')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Nama harus antara 2-100 karakter'),

  body('profile.bio')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Bio maksimal 500 karakter')
];

// Validation rules untuk user login
const userLoginValidation = [
  body('identifier')
    .trim()
    .notEmpty()
    .withMessage('Email atau username wajib diisi'),

  body('password')
    .notEmpty()
    .withMessage('Password wajib diisi')
];

// Validation rules untuk update profile
const userProfileUpdateValidation = [
  body('profile.nama')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Nama harus antara 2-100 karakter'),

  body('profile.bio')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Bio maksimal 500 karakter'),

  body('profile.socialLinks.facebook')
    .optional()
    .isURL()
    .withMessage('URL Facebook tidak valid'),

  body('profile.socialLinks.twitter')
    .optional()
    .isURL()
    .withMessage('URL Twitter tidak valid'),

  body('profile.socialLinks.instagram')
    .optional()
    .isURL()
    .withMessage('URL Instagram tidak valid'),

  body('profile.socialLinks.linkedin')
    .optional()
    .isURL()
    .withMessage('URL LinkedIn tidak valid'),

  body('preferences.language')
    .optional()
    .isIn(['id', 'en'])
    .withMessage('Bahasa harus id atau en'),

  body('preferences.timezone')
    .optional()
    .isString()
    .withMessage('Timezone harus berupa string')
];

// Validation rules untuk change password
const changePasswordValidation = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Password saat ini wajib diisi'),

  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('Password baru minimal 6 karakter')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password baru harus mengandung huruf kecil, huruf besar, dan angka'),

  body('confirmNewPassword')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Konfirmasi password baru tidak cocok');
      }
      return true;
    })
];

// Validation rules untuk forgot password
const forgotPasswordValidation = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Format email tidak valid')
    .normalizeEmail()
];

// Validation rules untuk reset password
const resetPasswordValidation = [
  body('token')
    .notEmpty()
    .withMessage('Token reset password wajib diisi'),

  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('Password baru minimal 6 karakter')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password baru harus mengandung huruf kecil, huruf besar, dan angka'),

  body('confirmNewPassword')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Konfirmasi password baru tidak cocok');
      }
      return true;
    })
];

// Middleware untuk handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => ({
      field: error.path,
      message: error.msg,
      value: error.value
    }));

    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Data yang dikirim tidak valid',
        details: errorMessages
      }
    });
  }

  next();
};

// Custom validation functions
const customValidations = {
  // Validate username availability
  isUsernameAvailable: async (username, userId = null) => {
    const User = require('../models/User');
    const query = { username };

    if (userId) {
      query._id = { $ne: userId };
    }

    const existingUser = await User.findOne(query);
    return !existingUser;
  },

  // Validate email availability
  isEmailAvailable: async (email, userId = null) => {
    const User = require('../models/User');
    const query = { email: email.toLowerCase() };

    if (userId) {
      query._id = { $ne: userId };
    }

    const existingUser = await User.findOne(query);
    return !existingUser;
  },

  // Validate password strength
  isPasswordStrong: (password) => {
    const minLength = 6;
    const hasLowerCase = /[a-z]/.test(password);
    const hasUpperCase = /[A-Z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    return {
      isValid: password.length >= minLength && hasLowerCase && hasUpperCase && hasNumbers,
      checks: {
        minLength: password.length >= minLength,
        hasLowerCase,
        hasUpperCase,
        hasNumbers,
        hasSpecialChar
      }
    };
  },

  // Validate social media URLs
  isSocialUrlValid: (url, platform) => {
    const patterns = {
      facebook: /^https?:\/\/(www\.)?facebook\.com\/[a-zA-Z0-9.]+\/?$/,
      twitter: /^https?:\/\/(www\.)?twitter\.com\/[a-zA-Z0-9_]+\/?$/,
      instagram: /^https?:\/\/(www\.)?instagram\.com\/[a-zA-Z0-9_.]+\/?$/,
      linkedin: /^https?:\/\/(www\.)?linkedin\.com\/(in|company)\/[a-zA-Z0-9-]+\/?$/
    };

    return patterns[platform] ? patterns[platform].test(url) : false;
  }
};

// Validation rules untuk article creation
const articleCreationValidation = [
  body('judul')
    .trim()
    .isLength({ min: 10, max: 200 })
    .withMessage('Judul harus antara 10-200 karakter'),

  body('konten')
    .trim()
    .isLength({ min: 100 })
    .withMessage('Konten minimal 100 karakter'),

  body('ringkasan')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Ringkasan maksimal 500 karakter'),

  body('kategori')
    .notEmpty()
    .withMessage('Kategori wajib dipilih')
    .isMongoId()
    .withMessage('ID kategori tidak valid'),

  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags harus berupa array'),

  body('tags.*')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Setiap tag maksimal 50 karakter'),

  body('status')
    .optional()
    .isIn(['draft', 'published', 'archived', 'scheduled'])
    .withMessage('Status harus salah satu dari: draft, published, archived, scheduled'),

  body('featured')
    .optional()
    .isBoolean()
    .withMessage('Featured harus berupa boolean'),

  body('premium')
    .optional()
    .isBoolean()
    .withMessage('Premium harus berupa boolean')
];

// Validation rules untuk article update
const articleUpdateValidation = [
  body('judul')
    .optional()
    .trim()
    .isLength({ min: 10, max: 200 })
    .withMessage('Judul harus antara 10-200 karakter'),

  body('konten')
    .optional()
    .trim()
    .isLength({ min: 100 })
    .withMessage('Konten minimal 100 karakter'),

  body('ringkasan')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Ringkasan maksimal 500 karakter'),

  body('kategori')
    .optional()
    .isMongoId()
    .withMessage('ID kategori tidak valid'),

  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags harus berupa array'),

  body('tags.*')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Setiap tag maksimal 50 karakter'),

  body('status')
    .optional()
    .isIn(['draft', 'published', 'archived', 'scheduled'])
    .withMessage('Status harus salah satu dari: draft, published, archived, scheduled'),

  body('scheduledAt')
    .optional()
    .isISO8601()
    .withMessage('Format tanggal scheduled tidak valid')
    .custom((value) => {
      if (new Date(value) <= new Date()) {
        throw new Error('Tanggal scheduled harus di masa depan');
      }
      return true;
    })
];

// Validation rules untuk SEO update
const seoUpdateValidation = [
  body('seo.metaTitle')
    .optional()
    .trim()
    .isLength({ max: 60 })
    .withMessage('Meta title maksimal 60 karakter'),

  body('seo.metaDescription')
    .optional()
    .trim()
    .isLength({ max: 160 })
    .withMessage('Meta description maksimal 160 karakter'),

  body('seo.keywords')
    .optional()
    .isArray()
    .withMessage('Keywords harus berupa array'),

  body('seo.keywords.*')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Setiap keyword maksimal 50 karakter'),

  body('seo.canonicalUrl')
    .optional()
    .isURL()
    .withMessage('Canonical URL tidak valid')
];

// Validation rules untuk social media settings
const socialMediaValidation = [
  body('socialMedia.autoPost')
    .optional()
    .isBoolean()
    .withMessage('Auto post harus berupa boolean'),

  body('socialMedia.platforms')
    .optional()
    .isArray()
    .withMessage('Platforms harus berupa array'),

  body('socialMedia.platforms.*')
    .optional()
    .isIn(['facebook', 'twitter', 'instagram', 'linkedin', 'tiktok'])
    .withMessage('Platform tidak valid'),

  body('socialMedia.customMessage')
    .optional()
    .trim()
    .isLength({ max: 280 })
    .withMessage('Custom message maksimal 280 karakter'),

  body('socialMedia.hashtags')
    .optional()
    .isArray()
    .withMessage('Hashtags harus berupa array'),

  body('socialMedia.hashtags.*')
    .optional()
    .matches(/^#[a-zA-Z0-9_]+$/)
    .withMessage('Hashtag harus dimulai dengan # dan hanya mengandung huruf, angka, underscore')
];

module.exports = {
  userRegistrationValidation,
  userLoginValidation,
  userProfileUpdateValidation,
  changePasswordValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  articleCreationValidation,
  articleUpdateValidation,
  seoUpdateValidation,
  socialMediaValidation,
  categoryCreationValidation,
  categoryUpdateValidation,
  commentCreationValidation,
  commentUpdateValidation,
  commentModerationValidation,
  handleValidationErrors,
  customValidations
};

// Validation rules untuk category creation
const categoryCreationValidation = [
  body('nama')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Nama kategori harus antara 2-100 karakter'),

  body('deskripsi')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Deskripsi maksimal 500 karakter'),

  body('parent')
    .optional()
    .isMongoId()
    .withMessage('ID parent kategori tidak valid'),

  body('icon')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Icon maksimal 50 karakter'),

  body('color')
    .optional()
    .matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
    .withMessage('Format warna harus hex color (contoh: #FF5733)'),

  body('sortOrder')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Sort order harus berupa angka positif')
];

// Validation rules untuk category update
const categoryUpdateValidation = [
  body('nama')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Nama kategori harus antara 2-100 karakter'),

  body('deskripsi')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Deskripsi maksimal 500 karakter'),

  body('parent')
    .optional()
    .isMongoId()
    .withMessage('ID parent kategori tidak valid'),

  body('icon')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Icon maksimal 50 karakter'),

  body('color')
    .optional()
    .matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
    .withMessage('Format warna harus hex color (contoh: #FF5733)'),

  body('sortOrder')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Sort order harus berupa angka positif'),

  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('Status aktif harus berupa boolean')
];

// Validation rules untuk comment creation
const commentCreationValidation = [
  body('artikel')
    .notEmpty()
    .withMessage('ID artikel wajib diisi')
    .isMongoId()
    .withMessage('ID artikel tidak valid'),

  body('konten')
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Komentar harus antara 1-1000 karakter'),

  body('parent')
    .optional()
    .isMongoId()
    .withMessage('ID parent komentar tidak valid'),

  // Guest comment fields (if user not logged in)
  body('guestInfo.nama')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Nama harus antara 2-100 karakter'),

  body('guestInfo.email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Format email tidak valid')
    .normalizeEmail(),

  body('guestInfo.website')
    .optional()
    .trim()
    .isURL()
    .withMessage('Format website tidak valid')
];

// Validation rules untuk comment update
const commentUpdateValidation = [
  body('konten')
    .optional()
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Komentar harus antara 1-1000 karakter'),

  body('reason')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Alasan edit maksimal 200 karakter')
];

// Validation rules untuk comment moderation
const commentModerationValidation = [
  body('action')
    .isIn(['approve', 'reject', 'spam'])
    .withMessage('Action harus salah satu dari: approve, reject, spam'),

  body('note')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Catatan moderasi maksimal 500 karakter'),

  body('commentIds')
    .optional()
    .isArray()
    .withMessage('Comment IDs harus berupa array'),

  body('commentIds.*')
    .optional()
    .isMongoId()
    .withMessage('ID komentar tidak valid')
];

// Validation rules untuk AI content generation
const aiContentGenerationValidation = [
  body('topic')
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('Topik harus antara 3-200 karakter'),

  body('category')
    .optional()
    .isMongoId()
    .withMessage('Category ID tidak valid'),

  body('tone')
    .optional()
    .isIn(['professional', 'casual', 'academic', 'conversational'])
    .withMessage('Tone harus salah satu dari: professional, casual, academic, conversational'),

  body('length')
    .optional()
    .isIn(['short', 'medium', 'long'])
    .withMessage('Length harus salah satu dari: short, medium, long'),

  body('keywords')
    .optional()
    .isArray()
    .withMessage('Keywords harus berupa array'),

  body('keywords.*')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Setiap keyword harus antara 1-50 karakter'),

  body('targetAudience')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Target audience maksimal 100 karakter'),

  body('saveAsDraft')
    .optional()
    .isBoolean()
    .withMessage('saveAsDraft harus berupa boolean'),

  body('sections')
    .optional()
    .isInt({ min: 3, max: 10 })
    .withMessage('Sections harus antara 3-10')
];

// Validation rules untuk AI content improvement
const aiContentImprovementValidation = [
  body('content')
    .trim()
    .isLength({ min: 50, max: 10000 })
    .withMessage('Konten harus antara 50-10000 karakter'),

  body('type')
    .optional()
    .isIn(['general', 'seo', 'readability', 'grammar'])
    .withMessage('Type harus salah satu dari: general, seo, readability, grammar'),

  body('targetKeywords')
    .optional()
    .isArray()
    .withMessage('Target keywords harus berupa array'),

  body('targetKeywords.*')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Setiap keyword harus antara 1-50 karakter'),

  body('tone')
    .optional()
    .isIn(['professional', 'casual', 'academic', 'conversational'])
    .withMessage('Tone harus salah satu dari: professional, casual, academic, conversational'),

  body('articleId')
    .optional()
    .isMongoId()
    .withMessage('Article ID tidak valid')
];

// Validation rules untuk AI SEO generation
const aiSeoValidation = [
  body('title')
    .trim()
    .isLength({ min: 10, max: 200 })
    .withMessage('Title harus antara 10-200 karakter'),

  body('content')
    .trim()
    .isLength({ min: 100, max: 5000 })
    .withMessage('Content harus antara 100-5000 karakter'),

  body('keywords')
    .optional()
    .isArray()
    .withMessage('Keywords harus berupa array'),

  body('keywords.*')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Setiap keyword harus antara 1-50 karakter')
];

// Validation rules untuk AI content ideas
const aiContentIdeasValidation = [
  body('category')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Category harus antara 2-100 karakter'),

  body('audience')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Audience maksimal 100 karakter'),

  body('count')
    .optional()
    .isInt({ min: 1, max: 20 })
    .withMessage('Count harus antara 1-20'),

  body('trending')
    .optional()
    .isBoolean()
    .withMessage('Trending harus berupa boolean')
];

// Validation rules untuk AI image generation
const aiImageGenerationValidation = [
  body('prompt')
    .trim()
    .isLength({ min: 10, max: 1000 })
    .withMessage('Prompt harus antara 10-1000 karakter'),

  body('size')
    .optional()
    .isIn(['256x256', '512x512', '1024x1024', '1792x1024', '1024x1792'])
    .withMessage('Size harus salah satu dari: 256x256, 512x512, 1024x1024, 1792x1024, 1024x1792'),

  body('quality')
    .optional()
    .isIn(['standard', 'hd'])
    .withMessage('Quality harus salah satu dari: standard, hd'),

  body('style')
    .optional()
    .isIn(['vivid', 'natural'])
    .withMessage('Style harus salah satu dari: vivid, natural'),

  body('optimizePrompt')
    .optional()
    .isBoolean()
    .withMessage('optimizePrompt harus berupa boolean')
];

// Validation rules untuk AI image prompt optimization
const aiImagePromptValidation = [
  body('prompt')
    .trim()
    .isLength({ min: 5, max: 500 })
    .withMessage('Prompt harus antara 5-500 karakter'),

  body('style')
    .optional()
    .isIn(['realistic', 'artistic', 'cartoon', 'abstract', 'photographic'])
    .withMessage('Style harus salah satu dari: realistic, artistic, cartoon, abstract, photographic'),

  body('mood')
    .optional()
    .isIn(['neutral', 'happy', 'dramatic', 'calm', 'energetic', 'mysterious'])
    .withMessage('Mood harus salah satu dari: neutral, happy, dramatic, calm, energetic, mysterious'),

  body('details')
    .optional()
    .isIn(['low', 'medium', 'high'])
    .withMessage('Details harus salah satu dari: low, medium, high')
];

// Validation rules untuk social media posting
const socialMediaPostValidation = [
  body('platforms')
    .isArray({ min: 1 })
    .withMessage('Minimal satu platform harus dipilih'),

  body('platforms.*')
    .isIn(['facebook', 'twitter', 'instagram', 'linkedin', 'tiktok'])
    .withMessage('Platform tidak valid'),

  body('message')
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Message harus antara 1-2000 karakter'),

  body('imageUrl')
    .optional()
    .isURL()
    .withMessage('Image URL tidak valid'),

  body('link')
    .optional()
    .isURL()
    .withMessage('Link tidak valid'),

  body('hashtags')
    .optional()
    .isArray()
    .withMessage('Hashtags harus berupa array'),

  body('hashtags.*')
    .optional()
    .matches(/^#[a-zA-Z0-9_]+$/)
    .withMessage('Hashtag harus dimulai dengan # dan hanya mengandung huruf, angka, underscore'),

  body('articleId')
    .optional()
    .isMongoId()
    .withMessage('Article ID tidak valid')
];m
odule.exports = {
  userRegistrationValidation,
  userLoginValidation,
  userProfileUpdateValidation,
  changePasswordValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  articleCreationValidation,
  articleUpdateValidation,
  seoUpdateValidation,
  socialMediaValidation,
  categoryCreationValidation,
  categoryUpdateValidation,
  commentCreationValidation,
  commentUpdateValidation,
  commentModerationValidation,
  aiContentGenerationValidation,
  aiContentImprovementValidation,
  aiSeoValidation,
  aiContentIdeasValidation,
  aiImageGenerationValidation,
  aiImagePromptValidation,
  socialMediaPostValidation,
  handleValidationErrors,
  customValidations
};// Valid
ation rules untuk subscription upgrade
const subscriptionUpgradeValidation = [
  body('planId')
    .trim()
    .isIn(['free', 'premium', 'pro'])
    .withMessage('Plan ID harus salah satu dari: free, premium, pro'),

  body('paymentMethod')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Payment method harus antara 2-50 karakter'),

  body('transactionId')
    .optional()
    .trim()
    .isLength({ min: 5, max: 100 })
    .withMessage('Transaction ID harus antara 5-100 karakter'),

  body('autoRenew')
    .optional()
    .isBoolean()
    .withMessage('autoRenew harus berupa boolean')
];
/
/ Validation rules untuk subscription
const subscriptionValidation = [
  body('planId')
    .notEmpty()
    .withMessage('Plan ID wajib diisi')
    .isMongoId()
    .withMessage('Plan ID tidak valid'),

  body('billingCycle')
    .isIn(['monthly', 'yearly'])
    .withMessage('Billing cycle harus monthly atau yearly'),

  body('paymentMethod')
    .optional()
    .isIn(['credit_card', 'bank_transfer', 'e_wallet', 'crypto'])
    .withMessage('Payment method tidak valid'),

  body('promoCode')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Promo code maksimal 50 karakter'),

  body('autoRenew')
    .optional()
    .isBoolean()
    .withMessage('Auto renew harus boolean')
];

// Validation rules untuk payment
const paymentValidation = [
  body('subscriptionId')
    .notEmpty()
    .withMessage('Subscription ID wajib diisi')
    .isMongoId()
    .withMessage('Subscription ID tidak valid'),

  body('gateway')
    .optional()
    .isIn(['midtrans', 'xendit', 'stripe'])
    .withMessage('Payment gateway tidak valid')
];

module.exports = {
  userRegistrationValidation,
  userLoginValidation,
  articleValidation,
  categoryValidation,
  commentValidation,
  subscriptionValidation,
  paymentValidation,
  handleValidationErrors
};