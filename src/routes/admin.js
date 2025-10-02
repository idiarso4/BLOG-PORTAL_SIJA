const express = require('express');
const router = express.Router();
const AdminController = require('../controllers/AdminController');
const { authenticate, authorize } = require('../middleware/auth');
const { generalRateLimit } = require('../middleware/security');

// All admin routes require admin authentication
router.use(authenticate);
router.use(authorize('admin'));

// Dashboard
router.get('/dashboard/stats',
  AdminController.getDashboardStats
);

// User management
router.get('/users',
  AdminController.getUsers
);

router.get('/users/:id',
  AdminController.getUser
);

router.put('/users/:id/role',
  generalRateLimit,
  AdminController.updateUserRole
);

router.put('/users/:id/status',
  generalRateLimit,
  AdminController.toggleUserStatus
);

router.delete('/users/:id',
  generalRateLimit,
  AdminController.deleteUser
);

router.post('/users/bulk-actions',
  generalRateLimit,
  AdminController.bulkUserActions
);

router.get('/users/:id/activity',
  AdminController.getUserActivityLogs
);

module.exports = router;