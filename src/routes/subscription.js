const express = require('express');
const router = express.Router();
const SubscriptionController = require('../controllers/SubscriptionController');
const { authenticate, authorize } = require('../middleware/auth');
const { generalRateLimit } = require('../middleware/security');
const {
  subscriptionUpgradeValidation,
  handleValidationErrors
} = require('../utils/validation');

// Public routes
router.get('/plans',
  SubscriptionController.getPlans
);

// Authenticated routes
router.get('/current',
  authenticate,
  SubscriptionController.getCurrentSubscription
);

router.post('/upgrade',
  authenticate,
  generalRateLimit,
  subscriptionUpgradeValidation,
  handleValidationErrors,
  SubscriptionController.upgradeSubscription
);

router.post('/cancel',
  authenticate,
  generalRateLimit,
  SubscriptionController.cancelSubscription
);

router.post('/renew',
  authenticate,
  generalRateLimit,
  SubscriptionController.renewSubscription
);

router.get('/feature/:feature',
  authenticate,
  SubscriptionController.checkFeatureAccess
);

router.get('/usage/:limitType',
  authenticate,
  SubscriptionController.checkUsageLimit
);

// Admin routes
router.get('/admin/stats',
  authenticate,
  authorize('admin'),
  SubscriptionController.getSubscriptionStats
);

router.post('/admin/process-expired',
  authenticate,
  authorize('admin'),
  SubscriptionController.processExpiredSubscriptions
);

router.post('/admin/send-reminders',
  authenticate,
  authorize('admin'),
  SubscriptionController.sendSubscriptionReminders
);

module.exports = router;