const Category = require('../models/Category');
const Article = require('../models/Article');
const { validationResult } = require('express-validator');
const logger = require('../config/logger');

/**
 * Category Controller
 */
class CategoryController {
  
  /**
   * Get all categories (public)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getCategories(req, res) {
    try {
      const { 
        includeInactive = false,
        includeStats = false,
        tree = false,
        parent = null
      } = req.query;
      
      let categories;
      
      if (tree === 'true') {
        // Get category tree structure
        categories = await Category.getCategoryTree(!includeInactive);
      } else {
        // Get flat list of categories
        const query = {};
        if (!includeInactive) query.isActive = true;
        if (parent) query.parent = parent === 'null' ? null : parent;
        
        categories = await Category.find(query)
          .sort({ sortOrder: 1, nama: 1 });
      }
      
      // Include statistics if requested
      if (includeStats === 'true') {
        for (let category of categories) {
          if (category.children) {
            // For tree structure, process recursively
            await CategoryController.addStatsToCategory(category);
          } else {
            // For flat list
            const articleCount = await Article.countDocuments({
              kategori: category._id,
              status: 'published'
            });
            category.stats.articleCount = articleCount;
          }
        }
      }
      
      res.json({
        success: true,
        data: {
          categories: categories
        }
      });
      
    } catch (error) {
      logger.error('Get categories error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'GET_CATEGORIES_ERROR',
          message: 'Terjadi kesalahan saat mengambil kategori'
        }
      });
    }
  }
  
  /**
   * Get single category by slug (public)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getCategory(req, res) {
    try {
      const { slug } = req.params;
      
      const category = await Category.findOne({ 
        slug, 
        isActive: true 
      });
      
      if (!category) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'CATEGORY_NOT_FOUND',
            message: 'Kategori tidak ditemukan'
          }
        });
      }
      
      // Get category path (breadcrumb)
      const fullPath = await category.getFullPath();
      
      // Get children categories
      const children = await category.getChildren(true);
      
      // Get recent articles in this category
      const recentArticles = await Article.findPublished({ kategori: category._id })
        .limit(5)
        .sort({ publishedAt: -1 });
      
      res.json({
        success: true,
        data: {
          category: {
            ...category.toObject(),
            fullPath,
            children,
            recentArticles
          }
        }
      });
      
    } catch (error) {
      logger.error('Get category error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'GET_CATEGORY_ERROR',
          message: 'Terjadi kesalahan saat mengambil kategori'
        }
      });
    }
  }
  
  /**
   * Create new category (admin only)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async createCategory(req, res) {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Data kategori tidak valid',
            details: errors.array()
          }
        });
      }
      
      const {
        nama,
        deskripsi,
        icon = 'fas fa-folder',
        color = '#6c757d',
        parent = null,
        sortOrder = 0,
        seo = {}
      } = req.body;
      
      // Verify parent category exists if specified
      if (parent) {
        const parentCategory = await Category.findById(parent);
        if (!parentCategory) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'PARENT_NOT_FOUND',
              message: 'Kategori parent tidak ditemukan'
            }
          });
        }
      }
      
      // Create category
      const categoryData = {
        nama,
        deskripsi,
        icon,
        color,
        parent,
        sortOrder,
        seo
      };
      
      const category = await Category.createCategory(categoryData);
      
      // Log category creation
      logger.info('Category created', {
        categoryId: category._id,
        userId: req.user._id,
        name: category.nama
      });
      
      res.status(201).json({
        success: true,
        message: 'Kategori berhasil dibuat',
        data: {
          category
        }
      });
      
    } catch (error) {
      logger.error('Create category error:', error);
      
      if (error.message.includes('Slug kategori sudah digunakan')) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'DUPLICATE_SLUG',
            message: 'Nama kategori sudah digunakan'
          }
        });
      }
      
      if (error.message.includes('Circular reference')) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'CIRCULAR_REFERENCE',
            message: 'Tidak dapat membuat referensi melingkar dalam hierarki kategori'
          }
        });
      }
      
      res.status(500).json({
        success: false,
        error: {
          code: 'CREATE_CATEGORY_ERROR',
          message: 'Terjadi kesalahan saat membuat kategori'
        }
      });
    }
  }
  
  /**
   * Update category (admin only)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async updateCategory(req, res) {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Data kategori tidak valid',
            details: errors.array()
          }
        });
      }
      
      const { id } = req.params;
      const {
        nama,
        deskripsi,
        icon,
        color,
        parent,
        isActive,
        sortOrder,
        seo
      } = req.body;
      
      // Find category
      const category = await Category.findById(id);
      
      if (!category) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'CATEGORY_NOT_FOUND',
            message: 'Kategori tidak ditemukan'
          }
        });
      }
      
      // Verify parent category if changed
      if (parent && parent !== category.parent?.toString()) {
        const parentCategory = await Category.findById(parent);
        if (!parentCategory) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'PARENT_NOT_FOUND',
              message: 'Kategori parent tidak ditemukan'
            }
          });
        }
      }
      
      // Update fields
      if (nama !== undefined) category.nama = nama;
      if (deskripsi !== undefined) category.deskripsi = deskripsi;
      if (icon !== undefined) category.icon = icon;
      if (color !== undefined) category.color = color;
      if (parent !== undefined) category.parent = parent || null;
      if (isActive !== undefined) category.isActive = isActive;
      if (sortOrder !== undefined) category.sortOrder = sortOrder;
      if (seo !== undefined) category.seo = { ...category.seo, ...seo };
      
      await category.save();
      
      // Log category update
      logger.info('Category updated', {
        categoryId: category._id,
        userId: req.user._id,
        name: category.nama
      });
      
      res.json({
        success: true,
        message: 'Kategori berhasil diperbarui',
        data: {
          category
        }
      });
      
    } catch (error) {
      logger.error('Update category error:', error);
      
      if (error.message.includes('Circular reference')) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'CIRCULAR_REFERENCE',
            message: 'Tidak dapat membuat referensi melingkar dalam hierarki kategori'
          }
        });
      }
      
      res.status(500).json({
        success: false,
        error: {
          code: 'UPDATE_CATEGORY_ERROR',
          message: 'Terjadi kesalahan saat memperbarui kategori'
        }
      });
    }
  }
  
  /**
   * Delete category (admin only)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async deleteCategory(req, res) {
    try {
      const { id } = req.params;
      const { moveArticlesTo = null } = req.body;
      
      // Find category
      const category = await Category.findById(id);
      
      if (!category) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'CATEGORY_NOT_FOUND',
            message: 'Kategori tidak ditemukan'
          }
        });
      }
      
      // Check if category has children
      const children = await category.getChildren(false);
      if (children.length > 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'HAS_CHILDREN',
            message: 'Tidak dapat menghapus kategori yang memiliki sub-kategori'
          }
        });
      }
      
      // Check if category has articles
      const articleCount = await Article.countDocuments({ kategori: id });
      
      if (articleCount > 0) {
        if (!moveArticlesTo) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'HAS_ARTICLES',
              message: 'Kategori memiliki artikel. Tentukan kategori tujuan untuk memindahkan artikel.'
            }
          });
        }
        
        // Verify target category exists
        const targetCategory = await Category.findById(moveArticlesTo);
        if (!targetCategory) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'TARGET_CATEGORY_NOT_FOUND',
              message: 'Kategori tujuan tidak ditemukan'
            }
          });
        }
        
        // Move articles to target category
        await Article.updateMany(
          { kategori: id },
          { kategori: moveArticlesTo }
        );
        
        // Update target category stats
        await targetCategory.updateStats({ articleCount: articleCount });
      }
      
      // Delete category
      await Category.findByIdAndDelete(id);
      
      // Log category deletion
      logger.info('Category deleted', {
        categoryId: id,
        userId: req.user._id,
        name: category.nama,
        articlesMovedTo: moveArticlesTo
      });
      
      res.json({
        success: true,
        message: articleCount > 0 
          ? `Kategori berhasil dihapus dan ${articleCount} artikel dipindahkan`
          : 'Kategori berhasil dihapus'
      });
      
    } catch (error) {
      logger.error('Delete category error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'DELETE_CATEGORY_ERROR',
          message: 'Terjadi kesalahan saat menghapus kategori'
        }
      });
    }
  }
  
  /**
   * Get popular categories
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getPopularCategories(req, res) {
    try {
      const { limit = 10 } = req.query;
      
      const categories = await Category.getPopularCategories(parseInt(limit));
      
      res.json({
        success: true,
        data: {
          categories
        }
      });
      
    } catch (error) {
      logger.error('Get popular categories error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'GET_POPULAR_CATEGORIES_ERROR',
          message: 'Terjadi kesalahan saat mengambil kategori populer'
        }
      });
    }
  }
  
  /**
   * Search categories
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async searchCategories(req, res) {
    try {
      const { q } = req.query;
      
      if (!q || q.trim().length < 2) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_SEARCH_QUERY',
            message: 'Query pencarian minimal 2 karakter'
          }
        });
      }
      
      const categories = await Category.searchCategories(q.trim());
      
      res.json({
        success: true,
        data: {
          categories,
          query: q.trim()
        }
      });
      
    } catch (error) {
      logger.error('Search categories error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'SEARCH_CATEGORIES_ERROR',
          message: 'Terjadi kesalahan saat mencari kategori'
        }
      });
    }
  }
  
  /**
   * Get category statistics (admin only)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getCategoryStatistics(req, res) {
    try {
      const stats = await Category.getStatistics();
      
      res.json({
        success: true,
        data: {
          statistics: stats
        }
      });
      
    } catch (error) {
      logger.error('Get category statistics error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'GET_STATISTICS_ERROR',
          message: 'Terjadi kesalahan saat mengambil statistik kategori'
        }
      });
    }
  }
  
  /**
   * Reorder categories (admin only)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async reorderCategories(req, res) {
    try {
      const { categories } = req.body;
      
      if (!Array.isArray(categories)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_DATA',
            message: 'Data kategori harus berupa array'
          }
        });
      }
      
      // Update sort order for each category
      const updatePromises = categories.map((cat, index) => 
        Category.findByIdAndUpdate(cat.id, { sortOrder: index })
      );
      
      await Promise.all(updatePromises);
      
      // Log reorder
      logger.info('Categories reordered', {
        userId: req.user._id,
        categoryCount: categories.length
      });
      
      res.json({
        success: true,
        message: 'Urutan kategori berhasil diperbarui'
      });
      
    } catch (error) {
      logger.error('Reorder categories error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'REORDER_ERROR',
          message: 'Terjadi kesalahan saat mengatur ulang kategori'
        }
      });
    }
  }
  
  /**
   * Helper method to add stats to category tree
   * @param {Object} category - Category object
   */
  static async addStatsToCategory(category) {
    // Get article count for this category
    const articleCount = await Article.countDocuments({
      kategori: category._id,
      status: 'published'
    });
    
    category.stats.articleCount = articleCount;
    
    // Process children recursively
    if (category.children && category.children.length > 0) {
      for (let child of category.children) {
        await CategoryController.addStatsToCategory(child);
      }
    }
  }
}

module.exports = CategoryController;