const express = require('express');
const router = express.Router();
const SocialMediaController = require('../controllers/SocialMediaController');
const SocialScheduleController = require('../controllers/SocialScheduleController');

const { authenticate } = require('../middleware/auth');
const { generalRateLimit } = require('../middleware/security');
const {
  socialMediaPostValidation,
  handleValidationErrors
} = require('../utils/validation');

// All social media routes require authentication
router.use(authenticate);

// Get supported platforms (public info)
router.get('/platforms',
  SocialMediaController.getSupportedPlatforms
);

// Get connected accounts
router.get('/accounts',
  SocialMediaController.getConnectedAccounts
);

// OAuth flow
router.get('/connect/:platform',
  SocialMediaController.getOAuthUrl
);

router.get('/callback/:platform',
  SocialMediaController.handleOAuthCallback
);

// Account management
router.delete('/accounts/:platform',
  generalRateLimit,
  SocialMediaController.disconnectAccount
);

// Content posting
router.post('/post',
  generalRateLimit,
  socialMediaPostValidation,
  handleValidationErrors,
  SocialMediaController.postToSocialMedia
);

// Analytics
router.get('/analytics/:platform/:postId',
  SocialMediaController.getSocialAnalytics
);

// Scheduling endpoints
router.post('/schedule',
  socialMediaPostValidation,
  handleValidationErrors,
  SocialScheduleController.schedulePost
);

router.get('/schedule',
  SocialScheduleController.listScheduledPosts
);

router.post('/schedule/:id/cancel',
  SocialScheduleController.cancelScheduledPost
);

router.post('/schedule/:id/reschedule',
  SocialScheduleController.reschedulePost
);

module.exports = router;