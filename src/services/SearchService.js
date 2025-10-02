const Article = require('../models/Article');
const Category = require('../models/Category');
const User = require('../models/User');
const CacheService = require('./CacheService');
const logger = require('../config/logger');

/**
 * Search Service for full-text search functionality
 */
class SearchService {
  
  constructor() {
    this.searchCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }
  
  /**
   * Search articles with full-text search
   * @param {Object} options - Search options
   * @returns {Promise<Object>} Search results
   */
  async searchArticles(options = {}) {
    try {
      const {
        query = '',
        category = null,
        author = null,
        tags = [],
        dateFrom = null,
        dateTo = null,
        status = 'published',
        sortBy = 'relevance',
        page = 1,
        limit = 10,
        includeContent = false
      } = options;
      
      // Generate cache key
      const cacheKey = `search:articles:${JSON.stringify(options)}`;
      
      // Try to get from cache first
      const cachedResult = await CacheService.getCachedAnalytics('search', options);
      if (cachedResult) {
        return cachedResult;
      }
      
      // Build search pipeline
      const pipeline = [];
      
      // Match stage
      const matchStage = { status };
      
      // Text search
      if (query.trim()) {
        matchStage.$text = { $search: query };
      }
      
      // Category filter
      if (category) {
        matchStage.kategori = category;
      }
      
      // Author filter
      if (author) {
        matchStage.author = author;
      }
      
      // Tags filter
      if (tags.length > 0) {
        matchStage.tags = { $in: tags };
      }
      
      // Date range filter
      if (dateFrom || dateTo) {
        matchStage.createdAt = {};
        if (dateFrom) matchStage.createdAt.$gte = new Date(dateFrom);
        if (dateTo) matchStage.createdAt.$lte = new Date(dateTo);
      }
      
      pipeline.push({ $match: matchStage });
      
      // Add score for text search
      if (query.trim()) {
        pipeline.push({ $addFields: { score: { $meta: 'textScore' } } });\n      }\n      \n      // Lookup author and category\n      pipeline.push(\n        {\n          $lookup: {\n            from: 'users',\n            localField: 'author',\n            foreignField: '_id',\n            as: 'author',\n            pipeline: [{ $project: { username: 1, 'profile.nama': 1, 'profile.avatar': 1 } }]\n          }\n        },\n        {\n          $lookup: {\n            from: 'categories',\n            localField: 'kategori',\n            foreignField: '_id',\n            as: 'kategori'\n          }\n        }\n      );\n      \n      // Unwind lookups\n      pipeline.push(\n        { $unwind: { path: '$author', preserveNullAndEmptyArrays: true } },\n        { $unwind: { path: '$kategori', preserveNullAndEmptyArrays: true } }\n      );\n      \n      // Project fields\n      const projectStage = {\n        judul: 1,\n        slug: 1,\n        ringkasan: 1,\n        gambarUtama: 1,\n        tags: 1,\n        views: 1,\n        createdAt: 1,\n        updatedAt: 1,\n        author: 1,\n        kategori: 1\n      };\n      \n      if (includeContent) {\n        projectStage.konten = 1;\n      }\n      \n      if (query.trim()) {\n        projectStage.score = 1;\n      }\n      \n      pipeline.push({ $project: projectStage });\n      \n      // Sort stage\n      let sortStage = {};\n      \n      switch (sortBy) {\n        case 'relevance':\n          if (query.trim()) {\n            sortStage = { score: { $meta: 'textScore' }, createdAt: -1 };\n          } else {\n            sortStage = { createdAt: -1 };\n          }\n          break;\n        case 'date':\n          sortStage = { createdAt: -1 };\n          break;\n        case 'views':\n          sortStage = { views: -1, createdAt: -1 };\n          break;\n        case 'title':\n          sortStage = { judul: 1 };\n          break;\n        default:\n          sortStage = { createdAt: -1 };\n      }\n      \n      pipeline.push({ $sort: sortStage });\n      \n      // Get total count\n      const countPipeline = [...pipeline, { $count: 'total' }];\n      const countResult = await Article.aggregate(countPipeline);\n      const total = countResult[0]?.total || 0;\n      \n      // Add pagination\n      const skip = (page - 1) * limit;\n      pipeline.push({ $skip: skip }, { $limit: limit });\n      \n      // Execute search\n      const articles = await Article.aggregate(pipeline);\n      \n      // Calculate pagination\n      const totalPages = Math.ceil(total / limit);\n      \n      const result = {\n        articles,\n        pagination: {\n          page,\n          limit,\n          total,\n          pages: totalPages,\n          hasNext: page < totalPages,\n          hasPrev: page > 1\n        },\n        searchInfo: {\n          query,\n          filters: {\n            category,\n            author,\n            tags,\n            dateFrom,\n            dateTo\n          },\n          sortBy,\n          resultsCount: articles.length,\n          totalResults: total\n        }\n      };\n      \n      // Cache the result\n      await CacheService.cacheAnalytics('search', options, result, 300); // 5 minutes\n      \n      return result;\n      \n    } catch (error) {\n      logger.error('Search articles error:', error);\n      throw error;\n    }\n  }\n  \n  /**\n   * Get search suggestions\n   * @param {String} query - Search query\n   * @param {Number} limit - Number of suggestions\n   * @returns {Promise<Array>} Search suggestions\n   */\n  async getSearchSuggestions(query, limit = 10) {\n    try {\n      if (!query || query.length < 2) {\n        return [];\n      }\n      \n      const cacheKey = `suggestions:${query}:${limit}`;\n      const cached = await CacheService.get(cacheKey);\n      \n      if (cached) {\n        return cached;\n      }\n      \n      // Search in article titles\n      const titleSuggestions = await Article.find({\n        status: 'published',\n        judul: { $regex: query, $options: 'i' }\n      })\n      .select('judul slug')\n      .limit(limit)\n      .lean();\n      \n      // Search in tags\n      const tagSuggestions = await Article.aggregate([\n        { $match: { status: 'published' } },\n        { $unwind: '$tags' },\n        { $match: { tags: { $regex: query, $options: 'i' } } },\n        { $group: { _id: '$tags', count: { $sum: 1 } } },\n        { $sort: { count: -1 } },\n        { $limit: limit }\n      ]);\n      \n      // Search in categories\n      const categorySuggestions = await Category.find({\n        nama: { $regex: query, $options: 'i' }\n      })\n      .select('nama slug')\n      .limit(5)\n      .lean();\n      \n      const suggestions = {\n        articles: titleSuggestions.map(article => ({\n          type: 'article',\n          title: article.judul,\n          slug: article.slug,\n          url: `/blog/${article.slug}`\n        })),\n        tags: tagSuggestions.map(tag => ({\n          type: 'tag',\n          title: tag._id,\n          count: tag.count,\n          url: `/blog?tag=${encodeURIComponent(tag._id)}`\n        })),\n        categories: categorySuggestions.map(category => ({\n          type: 'category',\n          title: category.nama,\n          slug: category.slug,\n          url: `/blog?category=${category.slug}`\n        }))\n      };\n      \n      // Cache suggestions\n      await CacheService.set(cacheKey, suggestions, 1800); // 30 minutes\n      \n      return suggestions;\n      \n    } catch (error) {\n      logger.error('Get search suggestions error:', error);\n      return { articles: [], tags: [], categories: [] };\n    }\n  }\n  \n  /**\n   * Search users\n   * @param {String} query - Search query\n   * @param {Object} options - Search options\n   * @returns {Promise<Object>} Search results\n   */\n  async searchUsers(query, options = {}) {\n    try {\n      const {\n        role = null,\n        isActive = true,\n        page = 1,\n        limit = 10\n      } = options;\n      \n      const matchStage = {\n        isActive,\n        $or: [\n          { username: { $regex: query, $options: 'i' } },\n          { email: { $regex: query, $options: 'i' } },\n          { 'profile.nama': { $regex: query, $options: 'i' } }\n        ]\n      };\n      \n      if (role) {\n        matchStage.role = role;\n      }\n      \n      const pipeline = [\n        { $match: matchStage },\n        {\n          $project: {\n            username: 1,\n            email: 1,\n            'profile.nama': 1,\n            'profile.avatar': 1,\n            'profile.bio': 1,\n            role: 1,\n            createdAt: 1\n          }\n        },\n        { $sort: { 'profile.nama': 1, username: 1 } }\n      ];\n      \n      // Get total count\n      const countPipeline = [...pipeline, { $count: 'total' }];\n      const countResult = await User.aggregate(countPipeline);\n      const total = countResult[0]?.total || 0;\n      \n      // Add pagination\n      const skip = (page - 1) * limit;\n      pipeline.push({ $skip: skip }, { $limit: limit });\n      \n      const users = await User.aggregate(pipeline);\n      \n      return {\n        users,\n        pagination: {\n          page,\n          limit,\n          total,\n          pages: Math.ceil(total / limit)\n        }\n      };\n      \n    } catch (error) {\n      logger.error('Search users error:', error);\n      throw error;\n    }\n  }\n  \n  /**\n   * Advanced search with multiple filters\n   * @param {Object} filters - Search filters\n   * @returns {Promise<Object>} Search results\n   */\n  async advancedSearch(filters = {}) {\n    try {\n      const {\n        query = '',\n        type = 'all', // all, articles, users, categories\n        ...otherFilters\n      } = filters;\n      \n      const results = {};\n      \n      if (type === 'all' || type === 'articles') {\n        results.articles = await this.searchArticles({ query, ...otherFilters });\n      }\n      \n      if (type === 'all' || type === 'users') {\n        results.users = await this.searchUsers(query, otherFilters);\n      }\n      \n      if (type === 'all' || type === 'categories') {\n        results.categories = await this.searchCategories(query, otherFilters);\n      }\n      \n      return results;\n      \n    } catch (error) {\n      logger.error('Advanced search error:', error);\n      throw error;\n    }\n  }\n  \n  /**\n   * Search categories\n   * @param {String} query - Search query\n   * @param {Object} options - Search options\n   * @returns {Promise<Object>} Search results\n   */\n  async searchCategories(query, options = {}) {\n    try {\n      const { page = 1, limit = 10 } = options;\n      \n      const matchStage = {\n        $or: [\n          { nama: { $regex: query, $options: 'i' } },\n          { deskripsi: { $regex: query, $options: 'i' } }\n        ]\n      };\n      \n      const pipeline = [\n        { $match: matchStage },\n        {\n          $lookup: {\n            from: 'articles',\n            localField: '_id',\n            foreignField: 'kategori',\n            as: 'articles'\n          }\n        },\n        {\n          $addFields: {\n            articleCount: { $size: '$articles' }\n          }\n        },\n        {\n          $project: {\n            nama: 1,\n            slug: 1,\n            deskripsi: 1,\n            articleCount: 1,\n            createdAt: 1\n          }\n        },\n        { $sort: { articleCount: -1, nama: 1 } }\n      ];\n      \n      // Get total count\n      const countPipeline = [...pipeline, { $count: 'total' }];\n      const countResult = await Category.aggregate(countPipeline);\n      const total = countResult[0]?.total || 0;\n      \n      // Add pagination\n      const skip = (page - 1) * limit;\n      pipeline.push({ $skip: skip }, { $limit: limit });\n      \n      const categories = await Category.aggregate(pipeline);\n      \n      return {\n        categories,\n        pagination: {\n          page,\n          limit,\n          total,\n          pages: Math.ceil(total / limit)\n        }\n      };\n      \n    } catch (error) {\n      logger.error('Search categories error:', error);\n      throw error;\n    }\n  }\n  \n  /**\n   * Get popular search terms\n   * @param {Number} limit - Number of terms to return\n   * @returns {Promise<Array>} Popular search terms\n   */\n  async getPopularSearchTerms(limit = 10) {\n    try {\n      const cacheKey = 'popular-search-terms';\n      const cached = await CacheService.get(cacheKey);\n      \n      if (cached) {\n        return cached;\n      }\n      \n      // This would typically come from search analytics\n      // For now, we'll return popular tags\n      const popularTerms = await Article.aggregate([\n        { $match: { status: 'published' } },\n        { $unwind: '$tags' },\n        { $group: { _id: '$tags', count: { $sum: 1 } } },\n        { $sort: { count: -1 } },\n        { $limit: limit },\n        {\n          $project: {\n            term: '$_id',\n            count: 1,\n            _id: 0\n          }\n        }\n      ]);\n      \n      // Cache for 1 hour\n      await CacheService.set(cacheKey, popularTerms, 3600);\n      \n      return popularTerms;\n      \n    } catch (error) {\n      logger.error('Get popular search terms error:', error);\n      return [];\n    }\n  }\n  \n  /**\n   * Log search query for analytics\n   * @param {String} query - Search query\n   * @param {String} userId - User ID (optional)\n   * @param {Number} resultsCount - Number of results\n   */\n  async logSearch(query, userId = null, resultsCount = 0) {\n    try {\n      // Increment search counter\n      const searchKey = `search-count:${query.toLowerCase()}`;\n      await CacheService.incr(searchKey, 1, 86400 * 7); // Keep for 7 days\n      \n      // Log search event\n      logger.info('Search performed', {\n        query,\n        userId,\n        resultsCount,\n        timestamp: new Date().toISOString()\n      });\n      \n    } catch (error) {\n      logger.error('Log search error:', error);\n    }\n  }\n  \n  /**\n   * Get search analytics\n   * @param {Object} options - Analytics options\n   * @returns {Promise<Object>} Search analytics\n   */\n  async getSearchAnalytics(options = {}) {\n    try {\n      const {\n        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),\n        endDate = new Date()\n      } = options;\n      \n      // This would typically come from a dedicated analytics collection\n      // For now, we'll return basic statistics\n      const analytics = {\n        totalSearches: 0,\n        uniqueQueries: 0,\n        popularTerms: await this.getPopularSearchTerms(10),\n        searchTrends: [],\n        noResultsQueries: []\n      };\n      \n      return analytics;\n      \n    } catch (error) {\n      logger.error('Get search analytics error:', error);\n      return {\n        totalSearches: 0,\n        uniqueQueries: 0,\n        popularTerms: [],\n        searchTrends: [],\n        noResultsQueries: []\n      };\n    }\n  }\n}\n\n// Create singleton instance\nconst searchService = new SearchService();\n\nmodule.exports = searchService;