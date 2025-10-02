const express = require('express');
const router = express.Router();
const SocialAuthController = require('../controllers/SocialAuthController');
const { authenticate } = require('../middleware/auth');
const { authRateLimit } = require('../middleware/security');

// Get social login URLs
router.get('/urls',
  SocialAuthController.getSocialLoginUrls
);

// Google OAuth
router.post('/google',
  authRateLimit,
  SocialAuthController.googleAuth
);

// Facebook OAuth
router.post('/facebook',
  authRateLimit,
  SocialAuthController.facebookAuth
);

// Link social account (authenticated users)
router.post('/link',
  authenticate,
  SocialAuthController.linkSocialAccount
);

// Unlink social account (authenticated users)
router.delete('/unlink/:provider',
  authenticate,
  SocialAuthController.unlinkSocialAccount
);

module.exports = router;