const Article = require('../models/Article');
const Category = require('../models/Category');
const User = require('../models/User');
const ArticleUtils = require('../utils/article');
const { validationResult } = require('express-validator');
const logger = require('../config/logger');
const multer = require('multer');
const path = require('path');

/**
 * Article Controller
 */
class ArticleController {
  
  /**
   * Get all articles (public)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getArticles(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        kategori,
        penulis,
        featured,
        premium,
        tags,
        search,
        sortBy = 'publishedAt',
        sortOrder = 'desc'
      } = req.query;
      
      const options = {
        page: parseInt(page),
        limit: Math.min(parseInt(limit), 50), // Max 50 articles per page
        sort: {}
      };
      
      options.sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
      
      let query = {};
      
      // Build query based on filters
      if (kategori) query.kategori = kategori;
      if (penulis) query.penulis = penulis;
      if (featured !== undefined) query.featured = featured === 'true';
      if (premium !== undefined) query.premium = premium === 'true';
      if (tags) query.tags = { $in: tags.split(',') };
      
      let articles;
      
      if (search) {
        // Use text search
        articles = await Article.searchArticles(search, {
          kategori: query.kategori,
          penulis: query.penulis
        })
        .limit(options.limit)
        .skip((options.page - 1) * options.limit);
      } else {
        // Regular query
        articles = await Article.findPublished({
          ...query
        })
        .limit(options.limit)
        .skip((options.page - 1) * options.limit)
        .sort(options.sort);
      }
      
      // Get total count for pagination
      const totalQuery = search 
        ? Article.find({ $text: { $search: search }, status: 'published', ...query })
        : Article.find({ status: 'published', ...query });
      
      const total = await totalQuery.countDocuments();
      
      // Format articles for response
      const formattedArticles = articles.map(article => 
        ArticleUtils.formatForResponse(article, false) // Don't include full content
      );
      
      res.json({
        success: true,
        data: {
          articles: formattedArticles,
          pagination: {
            page: options.page,
            limit: options.limit,
            total,
            pages: Math.ceil(total / options.limit)
          }
        }
      });
      
    } catch (error) {
      logger.error('Get articles error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'GET_ARTICLES_ERROR',
          message: 'Terjadi kesalahan saat mengambil artikel'
        }
      });
    }
  }
  
  /**
   * Get single article by slug (public)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getArticle(req, res) {
    try {
      const { slug } = req.params;
      
      const article = await Article.findOne({ 
        slug, 
        status: 'published',
        publishedAt: { $lte: new Date() }
      })
      .populate('penulis', 'username profile.nama profile.foto')
      .populate('kategori', 'nama slug');
      
      if (!article) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'ARTICLE_NOT_FOUND',
            message: 'Artikel tidak ditemukan'
          }
        });
      }
      
      // Check if premium article and user has access
      if (article.premium && (!req.user || !req.user.hasFeature('premium_content'))) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'PREMIUM_CONTENT',
            message: 'Artikel ini hanya tersedia untuk pengguna premium'
          }
        });
      }
      
      // Increment view count
      const country = req.get('CF-IPCountry') || req.get('X-Country') || null;
      const userAgent = req.get('User-Agent') || '';
      const device = userAgent.includes('Mobile') ? 'mobile' : 
                    userAgent.includes('Tablet') ? 'tablet' : 'desktop';
      const referrer = req.get('Referer') || 'direct';
      
      await article.incrementViews(country, device, referrer);
      
      // Get related articles
      const relatedArticles = await Article.find({
        _id: { $ne: article._id },
        kategori: article.kategori,
        status: 'published',
        publishedAt: { $lte: new Date() }
      })
      .populate('penulis', 'username profile.nama profile.foto')
      .limit(5)
      .sort({ publishedAt: -1 });
      
      res.json({
        success: true,
        data: {
          article: ArticleUtils.formatForResponse(article, true),
          relatedArticles: relatedArticles.map(a => 
            ArticleUtils.formatForResponse(a, false)
          )
        }
      });
      
    } catch (error) {
      logger.error('Get article error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'GET_ARTICLE_ERROR',
          message: 'Terjadi kesalahan saat mengambil artikel'
        }
      });
    }
  }
  
  /**
   * Create new article (authenticated)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async createArticle(req, res) {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Data artikel tidak valid',
            details: errors.array()
          }
        });
      }
      
      const {
        judul,
        konten,
        ringkasan,
        kategori,
        tags = [],
        status = 'draft',
        featured = false,
        premium = false,
        scheduledAt,
        seo = {},
        socialMedia = {}
      } = req.body;
      
      // Verify category exists
      const categoryExists = await Category.findById(kategori);
      if (!categoryExists) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'CATEGORY_NOT_FOUND',
            message: 'Kategori tidak ditemukan'
          }
        });
      }
      
      // Check if user can create premium articles
      if (premium && !req.user.hasFeature('premium_content')) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'PREMIUM_FEATURE_REQUIRED',
            message: 'Fitur artikel premium tidak tersedia dalam paket Anda'
          }
        });
      }
      
      // Create article data
      const articleData = {
        judul,
        konten,
        ringkasan,
        kategori,
        tags: tags.filter(tag => tag.trim()),
        penulis: req.user._id,
        status,
        featured: req.user.role === 'admin' ? featured : false, // Only admin can set featured
        premium,
        seo,
        socialMedia
      };
      
      // Handle thumbnail upload if present
      if (req.file) {
        articleData.thumbnail = `/uploads/${req.file.filename}`;
      }
      
      // Handle scheduling
      if (status === 'scheduled' && scheduledAt) {
        const scheduleDate = new Date(scheduledAt);
        if (scheduleDate <= new Date()) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_SCHEDULE_DATE',
              message: 'Tanggal jadwal harus di masa depan'
            }
          });
        }
        articleData.scheduledAt = scheduleDate;
      }
      
      // Create article
      const article = new Article(articleData);
      await article.save();
      
      // Update user stats
      await req.user.updateStats('articlesPublished', 1);
      
      // Update category stats
      await categoryExists.updateStats({ 
        articleCount: 1,
        lastArticleAt: true 
      });
      
      // Log article creation
      logger.info('Article created', {
        articleId: article._id,
        userId: req.user._id,
        title: article.judul,
        status: article.status
      });
      
      res.status(201).json({
        success: true,
        message: 'Artikel berhasil dibuat',
        data: {
          article: ArticleUtils.formatForResponse(article, true)
        }
      });
      
    } catch (error) {
      logger.error('Create article error:', error);
      
      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'DUPLICATE_SLUG',
            message: 'Slug artikel sudah digunakan'
          }
        });
      }
      
      res.status(500).json({
        success: false,
        error: {
          code: 'CREATE_ARTICLE_ERROR',
          message: 'Terjadi kesalahan saat membuat artikel'
        }
      });
    }
  }
  
  /**
   * Update article (authenticated)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async updateArticle(req, res) {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Data artikel tidak valid',
            details: errors.array()
          }
        });
      }
      
      const { id } = req.params;
      const {
        judul,
        konten,
        ringkasan,
        kategori,
        tags,
        status,
        featured,
        premium,
        scheduledAt,
        seo,
        socialMedia,
        changeNote
      } = req.body;
      
      // Find article
      const article = await Article.findById(id);
      
      if (!article) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'ARTICLE_NOT_FOUND',
            message: 'Artikel tidak ditemukan'
          }
        });
      }
      
      // Check ownership (only author or admin can edit)
      if (article.penulis.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: 'Anda tidak memiliki izin untuk mengedit artikel ini'
          }
        });
      }
      
      // Verify category if changed
      if (kategori && kategori !== article.kategori.toString()) {
        const categoryExists = await Category.findById(kategori);
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
      
      // Check premium feature access
      if (premium && !req.user.hasFeature('premium_content')) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'PREMIUM_FEATURE_REQUIRED',
            message: 'Fitur artikel premium tidak tersedia dalam paket Anda'
          }
        });
      }
      
      // Create version if content changed
      if (konten && konten !== article.konten) {
        article.createVersion(req.user._id, changeNote || 'Content updated');
      }
      
      // Update fields
      const updateData = {};
      if (judul !== undefined) updateData.judul = judul;
      if (konten !== undefined) updateData.konten = konten;
      if (ringkasan !== undefined) updateData.ringkasan = ringkasan;
      if (kategori !== undefined) updateData.kategori = kategori;
      if (tags !== undefined) updateData.tags = tags.filter(tag => tag.trim());
      if (status !== undefined) updateData.status = status;
      if (premium !== undefined) updateData.premium = premium;
      if (seo !== undefined) updateData.seo = { ...article.seo, ...seo };
      if (socialMedia !== undefined) updateData.socialMedia = { ...article.socialMedia, ...socialMedia };
      
      // Only admin can set featured
      if (featured !== undefined && req.user.role === 'admin') {
        updateData.featured = featured;
      }
      
      // Handle thumbnail upload
      if (req.file) {
        updateData.thumbnail = `/uploads/${req.file.filename}`;
      }
      
      // Handle scheduling
      if (status === 'scheduled' && scheduledAt) {
        const scheduleDate = new Date(scheduledAt);
        if (scheduleDate <= new Date()) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_SCHEDULE_DATE',
              message: 'Tanggal jadwal harus di masa depan'
            }
          });
        }
        updateData.scheduledAt = scheduleDate;
      }
      
      // Update article
      Object.assign(article, updateData);
      await article.save();
      
      // Log article update
      logger.info('Article updated', {
        articleId: article._id,
        userId: req.user._id,
        title: article.judul,
        changes: Object.keys(updateData)
      });
      
      res.json({
        success: true,
        message: 'Artikel berhasil diperbarui',
        data: {
          article: ArticleUtils.formatForResponse(article, true)
        }
      });
      
    } catch (error) {
      logger.error('Update article error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'UPDATE_ARTICLE_ERROR',
          message: 'Terjadi kesalahan saat memperbarui artikel'
        }
      });
    }
  }
  
  /**
   * Delete article (authenticated)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async deleteArticle(req, res) {
    try {
      const { id } = req.params;
      
      // Find article
      const article = await Article.findById(id);
      
      if (!article) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'ARTICLE_NOT_FOUND',
            message: 'Artikel tidak ditemukan'
          }
        });
      }
      
      // Check ownership (only author or admin can delete)
      if (article.penulis.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: 'Anda tidak memiliki izin untuk menghapus artikel ini'
          }
        });
      }
      
      // Delete article
      await Article.findByIdAndDelete(id);
      
      // Update user stats
      await req.user.updateStats('articlesPublished', -1);
      
      // Update category stats
      const category = await Category.findById(article.kategori);
      if (category) {
        await category.updateStats({ articleCount: -1 });
      }
      
      // Log article deletion
      logger.info('Article deleted', {
        articleId: article._id,
        userId: req.user._id,
        title: article.judul
      });
      
      res.json({
        success: true,
        message: 'Artikel berhasil dihapus'
      });
      
    } catch (error) {
      logger.error('Delete article error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'DELETE_ARTICLE_ERROR',
          message: 'Terjadi kesalahan saat menghapus artikel'
        }
      });
    }
  }
  
  /**
   * Get user's articles (authenticated)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getUserArticles(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        status,
        sortBy = 'updatedAt',
        sortOrder = 'desc'
      } = req.query;
      
      const options = {
        page: parseInt(page),
        limit: Math.min(parseInt(limit), 50),
        sort: {}
      };
      
      options.sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
      
      const query = { penulis: req.user._id };
      if (status) query.status = status;
      
      const articles = await Article.find(query)
        .populate('kategori', 'nama slug')
        .limit(options.limit)
        .skip((options.page - 1) * options.limit)
        .sort(options.sort);
      
      const total = await Article.countDocuments(query);
      
      // Format articles for response
      const formattedArticles = articles.map(article => 
        ArticleUtils.formatForResponse(article, false)
      );
      
      res.json({
        success: true,
        data: {
          articles: formattedArticles,
          pagination: {
            page: options.page,
            limit: options.limit,
            total,
            pages: Math.ceil(total / options.limit)
          }
        }
      });
      
    } catch (error) {
      logger.error('Get user articles error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'GET_USER_ARTICLES_ERROR',
          message: 'Terjadi kesalahan saat mengambil artikel pengguna'
        }
      });
    }
  }
  
  /**
   * Get trending articles
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getTrendingArticles(req, res) {
    try {
      const { days = 7, limit = 10 } = req.query;
      
      const trendingArticles = await Article.getTrending(
        parseInt(days), 
        parseInt(limit)
      );
      
      res.json({
        success: true,
        data: {
          articles: trendingArticles.map(article => 
            ArticleUtils.formatForResponse(article, false)
          )
        }
      });
      
    } catch (error) {
      logger.error('Get trending articles error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'GET_TRENDING_ERROR',
          message: 'Terjadi kesalahan saat mengambil artikel trending'
        }
      });
    }
  }
  
  /**
   * Like/unlike article
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async toggleLike(req, res) {
    try {
      const { id } = req.params;
      
      const article = await Article.findById(id);
      
      if (!article) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'ARTICLE_NOT_FOUND',
            message: 'Artikel tidak ditemukan'
          }
        });
      }
      
      // For now, just increment likes (in real app, track user likes)
      await article.incrementEngagement('likes');
      
      res.json({
        success: true,
        message: 'Like berhasil',
        data: {
          likes: article.metadata.likes
        }
      });
      
    } catch (error) {
      logger.error('Toggle like error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'TOGGLE_LIKE_ERROR',
          message: 'Terjadi kesalahan saat like artikel'
        }
      });
    }
  }
  
  /**
   * Share article (increment share count)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async shareArticle(req, res) {
    try {
      const { id } = req.params;
      
      const article = await Article.findById(id);
      
      if (!article) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'ARTICLE_NOT_FOUND',
            message: 'Artikel tidak ditemukan'
          }
        });
      }
      
      await article.incrementEngagement('shares');
      
      res.json({
        success: true,
        message: 'Share berhasil dicatat',
        data: {
          shares: article.metadata.shares
        }
      });
      
    } catch (error) {
      logger.error('Share article error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'SHARE_ARTICLE_ERROR',
          message: 'Terjadi kesalahan saat share artikel'
        }
      });
    }
  }
}

module.exports = ArticleController;