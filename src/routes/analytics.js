const express = require('express');
const router = express.Router();
const AnalyticsController = require('../controllers/AnalyticsController');
const { authenticate, authorize, optionalAuth } = require('../middleware/auth');
const { generalRateLimit } = require('../middleware/security');

// Public tracking endpoints
router.post('/track/view',
  optionalAuth,
  AnalyticsController.trackView
);

// Authenticated tracking
router.post('/track/engagement',
  authenticate,
  generalRateLimit,
  AnalyticsController.trackEngagement
);

// User analytics
router.get('/user',
  authenticate,
  AnalyticsController.getUserAnalytics
);

router.get('/article/:articleId',
  authenticate,
  AnalyticsController.getArticleAnalytics
);

// Admin analytics
router.get('/dashboard',
  authenticate,
  authorize(['admin', 'penulis']),
  AnalyticsController.getDashboard
);

router.get('/realtime',
  authenticate,
  authorize('admin'),
  AnalyticsController.getRealTimeStats
);

router.get('/export',
  authenticate,
  authorize(['admin', 'penulis']),
  AnalyticsController.exportAnalytics
);

module.exports = router;