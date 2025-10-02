const SearchService = require('../services/SearchService');
const { validationResult } = require('express-validator');
const logger = require('../config/logger');

/**
 * Search Controller
 */
class SearchController {
  
  /**
   * Search articles
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async searchArticles(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid search parameters',
            details: errors.array()
          }
        });
      }
      
      const {
        q: query = '',
        category = null,
        author = null,
        tags = [],
        dateFrom = null,
        dateTo = null,
        sortBy = 'relevance',
        page = 1,
        limit = 10,
        includeContent = false
      } = req.query;
      
      // Parse tags if it's a string
      const parsedTags = Array.isArray(tags) ? tags : (tags ? tags.split(',') : []);
      
      const searchOptions = {
        query: query.trim(),
        category,
        author,
        tags: parsedTags,
        dateFrom,
        dateTo,
        sortBy,
        page: parseInt(page),
        limit: Math.min(parseInt(limit), 50), // Max 50 results per page
        includeContent: includeContent === 'true'
      };
      
      const results = await SearchService.searchArticles(searchOptions);
      
      // Log search for analytics
      await SearchService.logSearch(
        query,
        req.user?._id,
        results.pagination.total
      );
      
      res.json({
        success: true,
        data: results
      });
      
    } catch (error) {
      logger.error('Search articles error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'SEARCH_ERROR',
          message: 'Terjadi kesalahan saat melakukan pencarian'
        }
      });
    }
  }
  
  /**
   * Get search suggestions
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getSearchSuggestions(req, res) {
    try {
      const { q: query = '', limit = 10 } = req.query;
      
      if (!query || query.length < 2) {
        return res.json({
          success: true,
          data: {
            articles: [],
            tags: [],
            categories: []
          }
        });
      }
      
      const suggestions = await SearchService.getSearchSuggestions(
        query.trim(),
        Math.min(parseInt(limit), 20)
      );
      
      res.json({
        success: true,
        data: suggestions
      });
      
    } catch (error) {
      logger.error('Get search suggestions error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'SUGGESTIONS_ERROR',
          message: 'Terjadi kesalahan saat mengambil saran pencarian'
        }
      });
    }
  }
  
  /**
   * Advanced search
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async advancedSearch(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid search parameters',
            details: errors.array()
          }
        });
      }
      
      const {
        q: query = '',
        type = 'all',
        category = null,
        author = null,
        tags = [],
        dateFrom = null,
        dateTo = null,
        sortBy = 'relevance',
        page = 1,
        limit = 10
      } = req.query;
      
      const parsedTags = Array.isArray(tags) ? tags : (tags ? tags.split(',') : []);
      
      const searchFilters = {
        query: query.trim(),
        type,
        category,
        author,
        tags: parsedTags,
        dateFrom,
        dateTo,
        sortBy,
        page: parseInt(page),
        limit: Math.min(parseInt(limit), 50)
      };
      
      const results = await SearchService.advancedSearch(searchFilters);
      
      // Log search for analytics
      const totalResults = Object.values(results).reduce((sum, result) => {
        return sum + (result.pagination?.total || result.users?.length || result.categories?.length || 0);
      }, 0);
      
      await SearchService.logSearch(query, req.user?._id, totalResults);
      
      res.json({
        success: true,
        data: results
      });
      
    } catch (error) {
      logger.error('Advanced search error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'ADVANCED_SEARCH_ERROR',
          message: 'Terjadi kesalahan saat melakukan pencarian lanjutan'
        }
      });
    }
  }
  
  /**
   * Search users (admin only)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async searchUsers(req, res) {
    try {
      const {
        q: query = '',
        role = null,
        isActive = true,
        page = 1,
        limit = 10
      } = req.query;
      
      if (!query || query.length < 2) {
        return res.json({
          success: true,
          data: {
            users: [],
            pagination: {
              page: 1,
              limit: 10,
              total: 0,
              pages: 0
            }
          }
        });
      }
      
      const searchOptions = {
        role,
        isActive: isActive === 'true',
        page: parseInt(page),
        limit: Math.min(parseInt(limit), 50)
      };
      
      const results = await SearchService.searchUsers(query.trim(), searchOptions);
      
      res.json({
        success: true,
        data: results
      });
      
    } catch (error) {
      logger.error('Search users error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'SEARCH_USERS_ERROR',
          message: 'Terjadi kesalahan saat mencari pengguna'
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
      const {
        q: query = '',
        page = 1,
        limit = 10
      } = req.query;
      
      if (!query || query.length < 2) {
        return res.json({
          success: true,
          data: {
            categories: [],
            pagination: {
              page: 1,
              limit: 10,
              total: 0,
              pages: 0
            }
          }
        });
      }
      
      const searchOptions = {
        page: parseInt(page),
        limit: Math.min(parseInt(limit), 50)
      };
      
      const results = await SearchService.searchCategories(query.trim(), searchOptions);
      
      res.json({
        success: true,
        data: results
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
   * Get popular search terms
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getPopularSearchTerms(req, res) {
    try {
      const { limit = 10 } = req.query;
      
      const popularTerms = await SearchService.getPopularSearchTerms(
        Math.min(parseInt(limit), 50)
      );
      
      res.json({
        success: true,
        data: {
          popularTerms
        }
      });
      
    } catch (error) {
      logger.error('Get popular search terms error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'POPULAR_TERMS_ERROR',
          message: 'Terjadi kesalahan saat mengambil kata kunci populer'
        }
      });
    }
  }
  
  /**
   * Get search analytics (admin only)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getSearchAnalytics(req, res) {
    try {
      const {
        startDate = null,
        endDate = null
      } = req.query;
      
      const options = {};
      
      if (startDate) {
        options.startDate = new Date(startDate);
      }
      
      if (endDate) {
        options.endDate = new Date(endDate);
      }
      
      const analytics = await SearchService.getSearchAnalytics(options);
      
      res.json({
        success: true,
        data: analytics
      });
      
    } catch (error) {
      logger.error('Get search analytics error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'SEARCH_ANALYTICS_ERROR',
          message: 'Terjadi kesalahan saat mengambil analitik pencarian'
        }
      });
    }
  }
  
  /**
   * Global search (search across all content types)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async globalSearch(req, res) {
    try {
      const { q: query = '', limit = 5 } = req.query;
      
      if (!query || query.length < 2) {
        return res.json({
          success: true,
          data: {
            articles: [],
            categories: [],
            suggestions: []
          }
        });
      }
      
      const searchLimit = Math.min(parseInt(limit), 10);
      
      // Perform parallel searches
      const [articles, categories, suggestions] = await Promise.all([
        SearchService.searchArticles({
          query: query.trim(),
          limit: searchLimit,
          page: 1
        }),
        SearchService.searchCategories(query.trim(), {
          limit: searchLimit,
          page: 1
        }),
        SearchService.getSearchSuggestions(query.trim(), searchLimit)
      ]);
      
      // Log search
      const totalResults = articles.pagination.total + categories.pagination.total;
      await SearchService.logSearch(query, req.user?._id, totalResults);
      
      res.json({
        success: true,
        data: {
          articles: articles.articles,
          categories: categories.categories,
          suggestions: suggestions.articles.concat(suggestions.tags, suggestions.categories),
          totalResults
        }
      });
      
    } catch (error) {
      logger.error('Global search error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'GLOBAL_SEARCH_ERROR',
          message: 'Terjadi kesalahan saat melakukan pencarian global'
        }
      });
    }
  }
}

module.exports = SearchController;