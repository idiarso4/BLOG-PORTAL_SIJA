const express = require('express');
const router = express.Router();
const NotificationController = require('../controllers/NotificationController');
const { authenticate, authorize } = require('../middleware/auth');
const { generalRateLimit, emailVerificationRateLimit } = require('../middleware/security');
const { body } = require('express-validator');

// Notification preferences routes (authenticated users)
router.get('/preferences',
  authenticate,
  NotificationController.getNotificationPreferences
);

router.put('/preferences',
  authenticate,
  generalRateLimit,
  [
    body('emailNotifications').optional().isBoolean(),
    body('commentNotifications').optional().isBoolean(),
    body('likeNotifications').optional().isBoolean(),
    body('weeklyDigest').optional().isBoolean(),
    body('marketingEmails').optional().isBoolean()
  ],
  NotificationController.updateNotificationPreferences
);

// Unsubscribe route (public)
router.post('/unsubscribe',
  authenticate,
  NotificationController.unsubscribeAll
);

// Admin routes
router.post('/test-email',
  authenticate,
  authorize('admin'),
  generalRateLimit,
  [
    body('to').isEmail().withMessage('Valid email is required'),
    body('subject').optional().isLength({ max: 200 }),
    body('message').optional().isLength({ max: 1000 })
  ],
  NotificationController.sendTestEmail
);

router.post('/welcome/:userId',
  authenticate,
  authorize('admin'),
  emailVerificationRateLimit,
  NotificationController.sendWelcomeEmail
);

router.post('/weekly-digest',
  authenticate,
  authorize('admin'),
  generalRateLimit,
  NotificationController.sendWeeklyDigest
);

router.get('/stats',
  authenticate,
  authorize('admin'),
  NotificationController.getNotificationStats
);

module.exports = router;