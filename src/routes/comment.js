const express = require('express');
const router = express.Router();
const CommentController = require('../controllers/CommentController');
const { authenticate, authorize, optionalAuth } = require('../middleware/auth');
const { generalRateLimit, commentRateLimit } = require('../middleware/security');
const {
  commentCreationValidation,
  commentUpdateValidation,
  commentModerationValidation,
  handleValidationErrors
} = require('../utils/validation');

// Public routes
router.get('/article/:articleId',
  CommentController.getArticleComments
);

router.get('/:id',
  optionalAuth,
  CommentController.getComment
);

// Authenticated routes
router.post('/article/:articleId',
  authenticate,
  commentRateLimit,
  commentCreationValidation,
  handleValidationErrors,
  CommentController.createComment
);

router.put('/:id',
  authenticate,
  generalRateLimit,
  commentUpdateValidation,
  handleValidationErrors,
  CommentController.updateComment
);

router.delete('/:id',
  authenticate,
  CommentController.deleteComment
);

// Engagement routes
router.post('/:id/like',
  authenticate,
  generalRateLimit,
  CommentController.toggleLike
);

router.post('/:id/dislike',
  authenticate,
  generalRateLimit,
  CommentController.toggleDislike
);

// Admin moderation routes
router.get('/admin/pending',
  authenticate,
  authorize('admin'),
  CommentController.getPendingComments
);

router.get('/admin/spam',
  authenticate,
  authorize('admin'),
  CommentController.getSpamComments
);

router.get('/admin/statistics',
  authenticate,
  authorize('admin'),
  CommentController.getCommentStatistics
);

router.post('/:id/moderate',
  authenticate,
  authorize('admin'),
  commentModerationValidation,
  handleValidationErrors,
  CommentController.moderateComment
);

router.post('/admin/bulk-moderate',
  authenticate,
  authorize('admin'),
  generalRateLimit,
  commentModerationValidation,
  handleValidationErrors,
  CommentController.bulkModerate
);

module.exports = router;