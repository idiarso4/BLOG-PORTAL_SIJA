const express = require('express');
const router = express.Router();
const UserController = require('../controllers/UserController');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { uploadConfigs, handleUploadError } = require('../middleware/upload');
const { generalRateLimit, uploadRateLimit } = require('../middleware/security');
const {
  userProfileUpdateValidation,
  handleValidationErrors
} = require('../utils/validation');

// Public routes
router.get('/profile/:username',
  UserController.getPublicProfile
);

// Authenticated routes
router.get('/profile',
  authenticate,
  UserController.getProfile
);

router.put('/profile',
  authenticate,
  uploadRateLimit,
  uploadConfigs.avatar,
  handleUploadError,
  userProfileUpdateValidation,
  handleValidationErrors,
  UserController.updateProfile
);

router.post('/avatar',
  authenticate,
  uploadRateLimit,
  uploadConfigs.avatar,
  handleUploadError,
  UserController.uploadAvatar
);

router.delete('/avatar',
  authenticate,
  UserController.deleteAvatar
);

router.get('/dashboard/stats',
  authenticate,
  UserController.getDashboardStats
);

router.put('/preferences',
  authenticate,
  generalRateLimit,
  UserController.updatePreferences
);

router.get('/activity',
  authenticate,
  UserController.getActivityFeed
);

router.post('/deactivate',
  authenticate,
  generalRateLimit,
  UserController.deactivateAccount
);

module.exports = router;