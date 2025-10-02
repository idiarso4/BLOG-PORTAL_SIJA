const express = require('express');
const router = express.Router();
const AiController = require('../controllers/AiController');
const { authenticate, requireFeature } = require('../middleware/auth');
const { generalRateLimit, aiRateLimit } = require('../middleware/security');
const {
  aiContentGenerationValidation,
  aiContentImprovementValidation,
  aiSeoValidation,
  aiContentIdeasValidation,
  handleValidationErrors
} = require('../utils/validation');

// All AI routes require authentication
router.use(authenticate);

// Service status (available to all authenticated users)
router.get('/status',
  AiController.getServiceStatus
);

// Templates (available to all authenticated users)
router.get('/templates',
  AiController.getTemplates
);

// Content generation
router.post('/generate/article',
  aiRateLimit,
  aiContentGenerationValidation,
  handleValidationErrors,
  AiController.generateArticle
);

router.post('/generate/outline',
  aiRateLimit,
  aiContentGenerationValidation,
  handleValidationErrors,
  AiController.generateOutline
);

// Content improvement
router.post('/improve/content',
  aiRateLimit,
  aiContentImprovementValidation,
  handleValidationErrors,
  AiController.improveContent
);

// SEO optimization
router.post('/generate/seo',
  aiRateLimit,
  aiSeoValidation,
  handleValidationErrors,
  AiController.generateSEOTags
);

// Content ideas
router.post('/generate/ideas',
  aiRateLimit,
  aiContentIdeasValidation,
  handleValidationErrors,
  AiController.generateContentIdeas
);

// Image generation
router.post('/generate/image',
  aiRateLimit,
  aiImageGenerationValidation,
  handleValidationErrors,
  AiController.generateImage
);

router.post('/optimize/image-prompt',
  aiRateLimit,
  aiImagePromptValidation,
  handleValidationErrors,
  AiController.optimizeImagePrompt
);

module.exports = router;