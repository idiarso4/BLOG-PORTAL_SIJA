const express = require('express');
const router = express.Router();
const MonitoringController = require('../controllers/MonitoringController');
const { authenticate, authorize } = require('../middleware/auth');
const { generalRateLimit } = require('../middleware/security');

// Public health check
router.get('/health',
  MonitoringController.getHealth
);

// Admin-only monitoring routes
router.get('/metrics',
  authenticate,
  authorize('admin'),
  generalRateLimit,
  MonitoringController.getMetrics
);

router.get('/errors/stats',
  authenticate,
  authorize('admin'),
  generalRateLimit,
  MonitoringController.getErrorStats
);

router.get('/errors/recent',
  authenticate,
  authorize('admin'),
  generalRateLimit,
  MonitoringController.getRecentErrors
);

router.get('/system',
  authenticate,
  authorize('admin'),
  generalRateLimit,
  MonitoringController.getSystemInfo
);

router.delete('/errors/clear',
  authenticate,
  authorize('admin'),
  generalRateLimit,
  MonitoringController.clearErrorLogs
);

// Development-only routes
if (process.env.NODE_ENV !== 'production') {
  router.post('/test-error',
    authenticate,
    authorize('admin'),
    generalRateLimit,
    MonitoringController.testError
  );
}

module.exports = router;