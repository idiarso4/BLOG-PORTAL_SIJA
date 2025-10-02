const AiService = require('../services/AiService');
const Article = require('../models/Article');
const Category = require('../models/Category');
const { validationResult } = require('express-validator');
const logger = require('../config/logger');

/**
 * AI Controller
 */
class AiController {
  
  /**
   * Generate article content
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async generateArticle(req, res) {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Data tidak valid',
            details: errors.array()
          }
        });
      }
      
      // Check if user has AI feature access
      if (!req.user.hasFeature('ai_content_generation')) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FEATURE_NOT_AVAILABLE',
            message: 'Fitur AI content generation tidak tersedia dalam paket Anda'
          }
        });
      }
      
      const {
        topic,
        category,
        tone = 'professional',
        length = 'medium',
        keywords = [],
        targetAudience = 'general',
        saveAsDraft = false
      } = req.body;
      
      // Verify category exists
      if (category) {
        const categoryExists = await Category.findById(category);
        if (!categoryExists) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'CATEGORY_NOT_FOUND',
              message: 'Kategori tidak ditemukan'
            }
          });
        }
      }
      
      // Generate article using AI
      const result = await AiService.generateArticle({
        topic,
        category,
        tone,
        length,
        language: 'id',
        keywords,
        targetAudience
      });
      
      let savedArticle = null;
      
      // Save as draft if requested
      if (saveAsDraft && result.success) {
        const articleData = {
          judul: result.data.title,
          konten: result.data.content,
          ringkasan: result.data.summary,
          kategori: category,
          tags: keywords,
          penulis: req.user._id,
          status: 'draft',
          flags: {
            isAiGenerated: true,
            aiModel: result.data.metadata.model,
            aiPrompt: JSON.stringify(result.data.metadata.prompt)
          }
        };
        
        const article = new Article(articleData);
        savedArticle = await article.save();
      }
      
      // Log AI usage
      logger.info('AI article generated', {
        userId: req.user._id,
        topic,
        category,
        tokensUsed: result.data.metadata.tokensUsed,
        savedAsDraft: saveAsDraft
      });
      
      res.json({
        success: true,
        message: 'Artikel berhasil dihasilkan',
        data: {
          generatedContent: result.data,
          savedArticle: savedArticle ? {
            id: savedArticle._id,
            title: savedArticle.judul,
            status: savedArticle.status
          } : null
        }
      });
      
    } catch (error) {
      logger.error('Generate article error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'GENERATE_ARTICLE_ERROR',
          message: error.message || 'Terjadi kesalahan saat menghasilkan artikel'
        }
      });
    }
  }
  
  /**
   * Generate article outline
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async generateOutline(req, res) {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Data tidak valid',
            details: errors.array()
          }
        });
      }
      
      // Check feature access
      if (!req.user.hasFeature('ai_content_generation')) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FEATURE_NOT_AVAILABLE',
            message: 'Fitur AI content generation tidak tersedia dalam paket Anda'
          }
        });
      }
      
      const { topic, category, sections = 5 } = req.body;
      
      // Generate outline
      const result = await AiService.generateOutline({
        topic,
        category,
        sections
      });
      
      // Log AI usage
      logger.info('AI outline generated', {
        userId: req.user._id,
        topic,
        category,
        tokensUsed: result.data.metadata.tokensUsed
      });
      
      res.json({
        success: true,
        message: 'Outline berhasil dihasilkan',
        data: result.data
      });
      
    } catch (error) {
      logger.error('Generate outline error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'GENERATE_OUTLINE_ERROR',
          message: error.message || 'Terjadi kesalahan saat menghasilkan outline'
        }
      });
    }
  }
  
  /**
   * Improve existing content
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async improveContent(req, res) {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Data tidak valid',
            details: errors.array()
          }
        });
      }
      
      // Check feature access
      if (!req.user.hasFeature('ai_content_improvement')) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FEATURE_NOT_AVAILABLE',
            message: 'Fitur AI content improvement tidak tersedia dalam paket Anda'
          }
        });
      }
      
      const {
        content,
        type = 'general',
        targetKeywords = [],
        tone = 'professional',
        articleId = null
      } = req.body;
      
      // If articleId provided, verify ownership
      if (articleId) {
        const article = await Article.findById(articleId);
        if (!article) {
          return res.status(404).json({
            success: false,
            error: {
              code: 'ARTICLE_NOT_FOUND',
              message: 'Artikel tidak ditemukan'
            }
          });
        }
        
        if (article.penulis.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
          return res.status(403).json({
            success: false,
            error: {
              code: 'ACCESS_DENIED',
              message: 'Anda tidak memiliki izin untuk mengedit artikel ini'
            }
          });
        }
      }
      
      // Improve content
      const result = await AiService.improveContent(content, {
        type,
        targetKeywords,
        tone
      });
      
      // Log AI usage
      logger.info('AI content improved', {
        userId: req.user._id,
        type,
        articleId,
        tokensUsed: result.data.metadata.tokensUsed
      });
      
      res.json({
        success: true,
        message: 'Konten berhasil diperbaiki',
        data: result.data
      });
      
    } catch (error) {
      logger.error('Improve content error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'IMPROVE_CONTENT_ERROR',
          message: error.message || 'Terjadi kesalahan saat memperbaiki konten'
        }
      });
    }
  }
  
  /**
   * Generate SEO meta tags
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async generateSEOTags(req, res) {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Data tidak valid',
            details: errors.array()
          }
        });
      }
      
      // Check feature access
      if (!req.user.hasFeature('ai_seo_optimization')) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FEATURE_NOT_AVAILABLE',
            message: 'Fitur AI SEO optimization tidak tersedia dalam paket Anda'
          }
        });
      }
      
      const { title, content, keywords = [] } = req.body;
      
      // Generate SEO tags
      const result = await AiService.generateSEOTags(title, content, keywords);
      
      // Log AI usage
      logger.info('AI SEO tags generated', {
        userId: req.user._id,
        title,
        tokensUsed: result.data.metadata.tokensUsed
      });
      
      res.json({
        success: true,
        message: 'SEO tags berhasil dihasilkan',
        data: result.data
      });
      
    } catch (error) {
      logger.error('Generate SEO tags error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'GENERATE_SEO_ERROR',
          message: error.message || 'Terjadi kesalahan saat menghasilkan SEO tags'
        }
      });
    }
  }
  
  /**
   * Generate content ideas
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async generateContentIdeas(req, res) {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Data tidak valid',
            details: errors.array()
          }
        });
      }
      
      // Check feature access
      if (!req.user.hasFeature('ai_content_ideas')) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FEATURE_NOT_AVAILABLE',
            message: 'Fitur AI content ideas tidak tersedia dalam paket Anda'
          }
        });
      }
      
      const {
        category,
        audience = 'general',
        count = 10,
        trending = false
      } = req.body;
      
      // Generate content ideas
      const result = await AiService.generateContentIdeas({
        category,
        audience,
        count,
        trending
      });
      
      // Log AI usage
      logger.info('AI content ideas generated', {
        userId: req.user._id,
        category,
        count: result.data.ideas.length,
        tokensUsed: result.data.metadata.tokensUsed
      });
      
      res.json({
        success: true,
        message: 'Ide konten berhasil dihasilkan',
        data: result.data
      });
      
    } catch (error) {
      logger.error('Generate content ideas error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'GENERATE_IDEAS_ERROR',
          message: error.message || 'Terjadi kesalahan saat menghasilkan ide konten'
        }
      });
    }
  }
  
  /**
   * Get AI service status
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getServiceStatus(req, res) {
    try {
      const isAvailable = AiService.isAvailable();
      const usageStats = await AiService.getUsageStats();
      
      res.json({
        success: true,
        data: {
          available: isAvailable,
          features: {
            contentGeneration: isAvailable,
            contentImprovement: isAvailable,
            seoOptimization: isAvailable,
            contentIdeas: isAvailable
          },
          usage: usageStats,
          userFeatures: {
            aiContentGeneration: req.user.hasFeature('ai_content_generation'),
            aiContentImprovement: req.user.hasFeature('ai_content_improvement'),
            aiSeoOptimization: req.user.hasFeature('ai_seo_optimization'),
            aiContentIdeas: req.user.hasFeature('ai_content_ideas')
          }
        }
      });
      
    } catch (error) {
      logger.error('Get AI service status error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'SERVICE_STATUS_ERROR',
          message: 'Terjadi kesalahan saat mengambil status layanan AI'
        }
      });
    }
  }
  
  /**
   * Generate image using AI
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async generateImage(req, res) {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Data tidak valid',
            details: errors.array()
          }
        });
      }
      
      // Check feature access
      if (!req.user.hasFeature('ai_image_generation')) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FEATURE_NOT_AVAILABLE',
            message: 'Fitur AI image generation tidak tersedia dalam paket Anda'
          }
        });
      }
      
      const {
        prompt,
        size = '1024x1024',
        quality = 'standard',
        style = 'vivid',
        optimizePrompt = false
      } = req.body;
      
      let finalPrompt = prompt;
      
      // Optimize prompt if requested
      if (optimizePrompt) {
        const optimizedResult = await AiService.optimizeImagePrompt(prompt);
        if (optimizedResult.success) {
          finalPrompt = optimizedResult.data.optimizedPrompt;
        }
      }
      
      // Generate image
      const result = await AiService.generateImage({
        prompt: finalPrompt,
        size,
        quality,
        style,
        count: 1
      });
      
      // Log AI usage
      logger.info('AI image generated', {
        userId: req.user._id,
        prompt: prompt.substring(0, 100),
        size,
        quality,
        style,
        optimized: optimizePrompt
      });
      
      res.json({
        success: true,
        message: 'Gambar berhasil dihasilkan',
        data: result.data
      });
      
    } catch (error) {
      logger.error('Generate image error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'GENERATE_IMAGE_ERROR',
          message: error.message || 'Terjadi kesalahan saat menghasilkan gambar'
        }
      });
    }
  }
  
  /**
   * Optimize image prompt
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async optimizeImagePrompt(req, res) {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Data tidak valid',
            details: errors.array()
          }
        });
      }
      
      // Check feature access
      if (!req.user.hasFeature('ai_image_generation')) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FEATURE_NOT_AVAILABLE',
            message: 'Fitur AI image generation tidak tersedia dalam paket Anda'
          }
        });
      }
      
      const {
        prompt,
        style = 'realistic',
        mood = 'neutral',
        details = 'medium'
      } = req.body;
      
      // Optimize prompt
      const result = await AiService.optimizeImagePrompt(prompt, {
        style,
        mood,
        details
      });
      
      // Log AI usage
      logger.info('AI image prompt optimized', {
        userId: req.user._id,
        originalPrompt: prompt.substring(0, 100),
        tokensUsed: result.data.metadata.tokensUsed
      });
      
      res.json({
        success: true,
        message: 'Prompt gambar berhasil dioptimasi',
        data: result.data
      });
      
    } catch (error) {
      logger.error('Optimize image prompt error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'OPTIMIZE_PROMPT_ERROR',
          message: error.message || 'Terjadi kesalahan saat mengoptimasi prompt'
        }
      });
    }
  }
  
  /**
   * Get AI templates
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getTemplates(req, res) {
    try {
      const templates = [
        {
          id: 'blog_post',
          name: 'Blog Post',
          description: 'Template untuk artikel blog umum',
          category: 'general',
          prompts: {
            tone: ['professional', 'casual', 'conversational'],
            length: ['short', 'medium', 'long'],
            audience: ['general', 'beginner', 'expert']
          }
        },
        {
          id: 'tutorial',
          name: 'Tutorial',
          description: 'Template untuk artikel tutorial step-by-step',
          category: 'education',
          prompts: {
            tone: ['instructional', 'friendly', 'detailed'],
            length: ['medium', 'long'],
            audience: ['beginner', 'intermediate', 'advanced']
          }
        },
        {
          id: 'news_article',
          name: 'News Article',
          description: 'Template untuk artikel berita',
          category: 'news',
          prompts: {
            tone: ['objective', 'analytical', 'investigative'],
            length: ['short', 'medium'],
            audience: ['general', 'informed']
          }
        },
        {
          id: 'review',
          name: 'Product Review',
          description: 'Template untuk review produk atau layanan',
          category: 'review',
          prompts: {
            tone: ['honest', 'detailed', 'comparative'],
            length: ['medium', 'long'],
            audience: ['consumers', 'enthusiasts']
          }
        },
        {
          id: 'listicle',
          name: 'Listicle',
          description: 'Template untuk artikel berbentuk list',
          category: 'entertainment',
          prompts: {
            tone: ['engaging', 'informative', 'entertaining'],
            length: ['short', 'medium'],
            audience: ['general', 'specific']
          }
        }
      ];
      
      res.json({
        success: true,
        data: {
          templates
        }
      });
      
    } catch (error) {
      logger.error('Get AI templates error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'GET_TEMPLATES_ERROR',
          message: 'Terjadi kesalahan saat mengambil template AI'
        }
      });
    }
  }
}

module.exports = AiController;