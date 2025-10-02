const express = require('express');
const router = express.Router();
const DashboardController = require('../controllers/DashboardController');
const { authenticate, authorize } = require('../middleware/auth');
const { generalRateLimit } = require('../middleware/security');

// User dashboard routes
router.get('/user',
  authenticate,
  DashboardController.getUserDashboard
);

// Admin dashboard routes
router.get('/admin',
  authenticate,
  authorize('admin'),
  DashboardController.getAdminDashboard
);

// Export routes
router.get('/export',
  authenticate,
  generalRateLimit,
  DashboardController.exportAnalytics
);

module.exports = router;