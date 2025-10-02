const express = require('express');
const router = express.Router();
const ArticleController = require('../controllers/ArticleController');
const { authenticate, optionalAuth, authorize, requireFeature } = require('../middleware/auth');
const { uploadConfigs, handleUploadError } = require('../middleware/upload');
const { generalRateLimit, uploadRateLimit } = require('../middleware/security');
const {
  articleCreationValidation,
  articleUpdateValidation,
  handleValidationErrors
} = require('../utils/validation');

// Public routes
router.get('/articles',
  optionalAuth,
  ArticleController.getArticles
);

router.get('/articles/trending',
  ArticleController.getTrendingArticles
);

router.get('/articles/:slug',
  optionalAuth,
  ArticleController.getArticle
);

// Authenticated routes
router.get('/my-articles',
  authenticate,
  ArticleController.getUserArticles
);

router.post('/articles',
  authenticate,
  uploadRateLimit,
  uploadConfigs.thumbnail,
  handleUploadError,
  articleCreationValidation,
  handleValidationErrors,
  ArticleController.createArticle
);

router.put('/articles/:id',
  authenticate,
  uploadRateLimit,
  uploadConfigs.thumbnail,
  handleUploadError,
  articleUpdateValidation,
  handleValidationErrors,
  ArticleController.updateArticle
);

router.delete('/articles/:id',
  authenticate,
  ArticleController.deleteArticle
);

// Engagement routes
router.post('/articles/:id/like',
  authenticate,
  generalRateLimit,
  ArticleController.toggleLike
);

router.post('/articles/:id/share',
  generalRateLimit,
  ArticleController.shareArticle
);

module.exports = router;