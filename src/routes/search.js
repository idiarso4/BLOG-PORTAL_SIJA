const express = require('express');
const router = express.Router();
const SearchController = require('../controllers/SearchController');
const { authenticate, authorize } = require('../middleware/auth');
const { generalRateLimit, apiRateLimit } = require('../middleware/security');
const { query } = require('express-validator');

// Search validation middleware
const searchValidation = [
  query('q')
    .optional()
    .isLength({ min: 1, max: 200 })
    .withMessage('Query must be between 1 and 200 characters'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50'),
  query('sortBy')
    .optional()
    .isIn(['relevance', 'date', 'views', 'title'])
    .withMessage('Invalid sort option')
];

// Public search routes
router.get('/articles',
  apiRateLimit,
  searchValidation,
  SearchController.searchArticles
);

router.get('/suggestions',
  apiRateLimit,
  query('q').isLength({ min: 2, max: 100 }).withMessage('Query must be between 2 and 100 characters'),
  SearchController.getSearchSuggestions
);

router.get('/categories',
  apiRateLimit,
  searchValidation,
  SearchController.searchCategories
);

router.get('/popular-terms',
  generalRateLimit,
  SearchController.getPopularSearchTerms
);

router.get('/global',
  apiRateLimit,
  query('q').isLength({ min: 2, max: 100 }).withMessage('Query must be between 2 and 100 characters'),
  SearchController.globalSearch
);

// Advanced search (public but with rate limiting)
router.get('/advanced',
  generalRateLimit,
  searchValidation,
  query('type').optional().isIn(['all', 'articles', 'users', 'categories']),
  SearchController.advancedSearch
);

// Admin-only search routes
router.get('/users',
  authenticate,
  authorize('admin'),
  generalRateLimit,
  searchValidation,
  SearchController.searchUsers
);

router.get('/analytics',
  authenticate,
  authorize('admin'),
  generalRateLimit,
  query('startDate').optional().isISO8601().withMessage('Invalid start date format'),
  query('endDate').optional().isISO8601().withMessage('Invalid end date format'),
  SearchController.getSearchAnalytics
);

module.exports = router;