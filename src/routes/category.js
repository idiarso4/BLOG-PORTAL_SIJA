const express = require('express');
const router = express.Router();
const CategoryController = require('../controllers/CategoryController');
const { authenticate, authorize } = require('../middleware/auth');
const { generalRateLimit } = require('../middleware/security');
const {
  categoryCreationValidation,
  categoryUpdateValidation,
  handleValidationErrors
} = require('../utils/validation');

// Public routes
router.get('/',
  CategoryController.getCategories
);

router.get('/popular',
  CategoryController.getPopularCategories
);

router.get('/search',
  CategoryController.searchCategories
);

router.get('/:slug',
  CategoryController.getCategory
);

// Admin only routes
router.post('/',
  authenticate,
  authorize('admin'),
  generalRateLimit,
  categoryCreationValidation,
  handleValidationErrors,
  CategoryController.createCategory
);

router.put('/:id',
  authenticate,
  authorize('admin'),
  generalRateLimit,
  categoryUpdateValidation,
  handleValidationErrors,
  CategoryController.updateCategory
);

router.delete('/:id',
  authenticate,
  authorize('admin'),
  CategoryController.deleteCategory
);

router.get('/admin/statistics',
  authenticate,
  authorize('admin'),
  CategoryController.getCategoryStatistics
);

router.post('/admin/reorder',
  authenticate,
  authorize('admin'),
  generalRateLimit,
  CategoryController.reorderCategories
);

module.exports = router;