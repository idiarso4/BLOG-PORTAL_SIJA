const Comment = require('../models/Comment');
const Article = require('../models/Article');
const User = require('../models/User');
const { validationResult } = require('express-validator');
const logger = require('../config/logger');

/**
 * Comment Controller
 */
class CommentController {
  
  /**
   * Get comments for an article (public)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getArticleComments(req, res) {
    try {
      const { articleId } = req.params;
      const {
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'asc',
        tree = false
      } = req.query;
      
      // Verify article exists
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
      
      let comments;
      let total;
      
      if (tree === 'true') {
        // Get nested comment tree
        comments = await Comment.getCommentTree(articleId, 'approved');
        total = await Comment.countDocuments({
          artikel: articleId,
          status: 'approved'
        });
      } else {
        // Get flat list of root comments with pagination
        const options = {
          page: parseInt(page),
          limit: Math.min(parseInt(limit), 50),
          sortBy,
          sortOrder: sortOrder === 'desc' ? -1 : 1
        };
        
        comments = await Comment.getArticleComments(articleId, options);
        total = await Comment.countDocuments({
          artikel: articleId,
          parent: null,
          status: 'approved'
        });
      }
      
      res.json({
        success: true,
        data: {
          comments,
          pagination: tree === 'true' ? null : {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / parseInt(limit))
          }
        }
      });
      
    } catch (error) {
      logger.error('Get article comments error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'GET_COMMENTS_ERROR',
          message: 'Terjadi kesalahan saat mengambil komentar'
        }
      });
    }
  }
  
  /**
   * Get single comment with replies (public)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getComment(req, res) {
    try {
      const { id } = req.params;
      
      const comment = await Comment.findById(id)
        .populate('penulis', 'username profile.nama profile.foto')
        .populate('artikel', 'judul slug');
      
      if (!comment) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'COMMENT_NOT_FOUND',
            message: 'Komentar tidak ditemukan'
          }
        });
      }
      
      // Only show approved comments to public
      if (comment.status !== 'approved' && (!req.user || req.user.role !== 'admin')) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'COMMENT_NOT_FOUND',
            message: 'Komentar tidak ditemukan'
          }
        });
      }
      
      // Get replies
      const replies = await comment.getReplies('approved');
      
      res.json({
        success: true,
        data: {
          comment: {
            ...comment.toObject(),
            replies
          }
        }
      });
      
    } catch (error) {
      logger.error('Get comment error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'GET_COMMENT_ERROR',
          message: 'Terjadi kesalahan saat mengambil komentar'
        }
      });
    }
  }
  
  /**
   * Create new comment (authenticated)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async createComment(req, res) {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Data komentar tidak valid',
            details: errors.array()
          }
        });
      }
      
      const { articleId } = req.params;
      const { konten, parent = null } = req.body;
      
      // Verify article exists and is published
      const article = await Article.findOne({
        _id: articleId,
        status: 'published'
      });
      
      if (!article) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'ARTICLE_NOT_FOUND',
            message: 'Artikel tidak ditemukan atau belum dipublikasikan'
          }
        });
      }
      
      // Verify parent comment if replying
      if (parent) {
        const parentComment = await Comment.findOne({
          _id: parent,
          artikel: articleId,
          status: 'approved'
        });
        
        if (!parentComment) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'PARENT_COMMENT_NOT_FOUND',
              message: 'Komentar parent tidak ditemukan'
            }
          });
        }
      }
      
      // Create comment data
      const commentData = {
        artikel: articleId,
        penulis: req.user._id,
        konten,
        parent,
        metadata: {
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        }
      };
      
      // Create comment
      const comment = new Comment(commentData);
      await comment.save();
      
      // Update article comment count
      await article.incrementEngagement('comments');
      
      // Populate comment for response
      await comment.populate('penulis', 'username profile.nama profile.foto');
      
      // Log comment creation
      logger.info('Comment created', {
        commentId: comment._id,
        articleId,
        userId: req.user._id,
        isReply: !!parent
      });
      
      res.status(201).json({
        success: true,
        message: comment.status === 'pending' 
          ? 'Komentar berhasil dibuat dan menunggu moderasi'
          : 'Komentar berhasil dibuat',
        data: {
          comment
        }
      });
      
    } catch (error) {
      logger.error('Create comment error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'CREATE_COMMENT_ERROR',
          message: 'Terjadi kesalahan saat membuat komentar'
        }
      });
    }
  }
  
  /**
   * Update comment (authenticated)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async updateComment(req, res) {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Data komentar tidak valid',
            details: errors.array()
          }
        });
      }
      
      const { id } = req.params;
      const { konten, reason = '' } = req.body;
      
      // Find comment
      const comment = await Comment.findById(id);
      
      if (!comment) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'COMMENT_NOT_FOUND',
            message: 'Komentar tidak ditemukan'
          }
        });
      }
      
      // Check ownership (only author can edit within time limit)
      if (comment.penulis.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: 'Anda tidak memiliki izin untuk mengedit komentar ini'
          }
        });
      }
      
      // Check edit time limit (15 minutes)
      const editTimeLimit = 15 * 60 * 1000; // 15 minutes
      const timeSinceCreation = Date.now() - comment.createdAt.getTime();
      
      if (timeSinceCreation > editTimeLimit) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'EDIT_TIME_EXPIRED',
            message: 'Waktu untuk mengedit komentar telah habis (maksimal 15 menit)'
          }
        });
      }
      
      // Update comment
      await comment.editComment(konten, reason);
      
      // Populate for response
      await comment.populate('penulis', 'username profile.nama profile.foto');
      
      // Log comment update
      logger.info('Comment updated', {
        commentId: comment._id,
        userId: req.user._id,
        reason
      });
      
      res.json({
        success: true,
        message: 'Komentar berhasil diperbarui',
        data: {
          comment
        }
      });
      
    } catch (error) {
      logger.error('Update comment error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'UPDATE_COMMENT_ERROR',
          message: 'Terjadi kesalahan saat memperbarui komentar'
        }
      });
    }
  }
  
  /**
   * Delete comment (authenticated)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async deleteComment(req, res) {
    try {
      const { id } = req.params;
      
      // Find comment
      const comment = await Comment.findById(id);
      
      if (!comment) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'COMMENT_NOT_FOUND',
            message: 'Komentar tidak ditemukan'
          }
        });
      }
      
      // Check ownership (author or admin can delete)
      if (comment.penulis.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: 'Anda tidak memiliki izin untuk menghapus komentar ini'
          }
        });
      }
      
      // Check if comment has replies
      const replies = await comment.getReplies();
      if (replies.length > 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'HAS_REPLIES',
            message: 'Tidak dapat menghapus komentar yang memiliki balasan'
          }
        });
      }
      
      // Delete comment
      await Comment.findByIdAndDelete(id);
      
      // Update article comment count
      const article = await Article.findById(comment.artikel);
      if (article) {
        await article.incrementEngagement('comments', -1);
      }
      
      // Log comment deletion
      logger.info('Comment deleted', {
        commentId: id,
        userId: req.user._id,
        articleId: comment.artikel
      });
      
      res.json({
        success: true,
        message: 'Komentar berhasil dihapus'
      });
      
    } catch (error) {
      logger.error('Delete comment error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'DELETE_COMMENT_ERROR',
          message: 'Terjadi kesalahan saat menghapus komentar'
        }
      });
    }
  }
  
  /**
   * Like/unlike comment (authenticated)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async toggleLike(req, res) {
    try {
      const { id } = req.params;
      
      const comment = await Comment.findById(id);
      
      if (!comment) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'COMMENT_NOT_FOUND',
            message: 'Komentar tidak ditemukan'
          }
        });
      }
      
      const userId = req.user._id;
      const hasLiked = comment.likedBy.includes(userId);
      
      if (hasLiked) {
        // Remove like
        await comment.removeLikeDislike(userId);
      } else {
        // Add like (and remove dislike if exists)
        await comment.likeComment(userId);
      }
      
      res.json({
        success: true,
        message: hasLiked ? 'Like dihapus' : 'Komentar disukai',
        data: {
          likes: comment.likes,
          dislikes: comment.dislikes,
          hasLiked: !hasLiked,
          hasDisliked: false
        }
      });
      
    } catch (error) {
      logger.error('Toggle comment like error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'TOGGLE_LIKE_ERROR',
          message: 'Terjadi kesalahan saat like komentar'
        }
      });
    }
  }
  
  /**
   * Dislike/undislike comment (authenticated)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async toggleDislike(req, res) {
    try {
      const { id } = req.params;
      
      const comment = await Comment.findById(id);
      
      if (!comment) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'COMMENT_NOT_FOUND',
            message: 'Komentar tidak ditemukan'
          }
        });
      }
      
      const userId = req.user._id;
      const hasDisliked = comment.dislikedBy.includes(userId);
      
      if (hasDisliked) {
        // Remove dislike
        await comment.removeLikeDislike(userId);
      } else {
        // Add dislike (and remove like if exists)
        await comment.dislikeComment(userId);
      }
      
      res.json({
        success: true,
        message: hasDisliked ? 'Dislike dihapus' : 'Komentar tidak disukai',
        data: {
          likes: comment.likes,
          dislikes: comment.dislikes,
          hasLiked: false,
          hasDisliked: !hasDisliked
        }
      });
      
    } catch (error) {
      logger.error('Toggle comment dislike error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'TOGGLE_DISLIKE_ERROR',
          message: 'Terjadi kesalahan saat dislike komentar'
        }
      });
    }
  }
  
  /**
   * Get pending comments for moderation (admin only)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getPendingComments(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;
      
      const options = {
        page: parseInt(page),
        limit: Math.min(parseInt(limit), 50),
        sortBy,
        sortOrder: sortOrder === 'desc' ? -1 : 1
      };
      
      const comments = await Comment.getPendingComments(options);
      const total = await Comment.countDocuments({ status: 'pending' });
      
      res.json({
        success: true,
        data: {
          comments,
          pagination: {
            page: options.page,
            limit: options.limit,
            total,
            pages: Math.ceil(total / options.limit)
          }
        }
      });
      
    } catch (error) {
      logger.error('Get pending comments error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'GET_PENDING_COMMENTS_ERROR',
          message: 'Terjadi kesalahan saat mengambil komentar pending'
        }
      });
    }
  }
  
  /**
   * Moderate comment (admin only)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async moderateComment(req, res) {
    try {
      const { id } = req.params;
      const { action, note = '' } = req.body;
      
      if (!['approve', 'reject', 'spam'].includes(action)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_ACTION',
            message: 'Action harus salah satu dari: approve, reject, spam'
          }
        });
      }
      
      const comment = await Comment.findById(id);
      
      if (!comment) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'COMMENT_NOT_FOUND',
            message: 'Komentar tidak ditemukan'
          }
        });
      }
      
      // Perform moderation action
      switch (action) {
        case 'approve':
          await comment.approve(req.user._id, note);
          break;
        case 'reject':
          await comment.reject(req.user._id, note);
          break;
        case 'spam':
          await comment.markAsSpam(req.user._id, note);
          break;
      }
      
      // Log moderation action
      logger.info('Comment moderated', {
        commentId: id,
        moderatorId: req.user._id,
        action,
        note
      });
      
      res.json({
        success: true,
        message: `Komentar berhasil di-${action}`,
        data: {
          comment
        }
      });
      
    } catch (error) {
      logger.error('Moderate comment error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'MODERATE_COMMENT_ERROR',
          message: 'Terjadi kesalahan saat moderasi komentar'
        }
      });
    }
  }
  
  /**
   * Bulk moderate comments (admin only)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async bulkModerate(req, res) {
    try {
      const { commentIds, action, note = '' } = req.body;
      
      if (!Array.isArray(commentIds) || commentIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_COMMENT_IDS',
            message: 'Comment IDs harus berupa array yang tidak kosong'
          }
        });
      }
      
      if (!['approve', 'reject', 'spam'].includes(action)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_ACTION',
            message: 'Action harus salah satu dari: approve, reject, spam'
          }
        });
      }
      
      // Perform bulk moderation
      const result = await Comment.bulkModerate(commentIds, action, req.user._id, note);
      
      // Log bulk moderation
      logger.info('Bulk comment moderation', {
        moderatorId: req.user._id,
        action,
        commentCount: commentIds.length,
        modifiedCount: result.modifiedCount
      });
      
      res.json({
        success: true,
        message: `${result.modifiedCount} komentar berhasil di-${action}`,
        data: {
          modifiedCount: result.modifiedCount,
          totalRequested: commentIds.length
        }
      });
      
    } catch (error) {
      logger.error('Bulk moderate comments error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'BULK_MODERATE_ERROR',
          message: 'Terjadi kesalahan saat bulk moderasi komentar'
        }
      });
    }
  }
  
  /**
   * Get spam comments (admin only)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getSpamComments(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        minSpamScore = 50
      } = req.query;
      
      const options = {
        page: parseInt(page),
        limit: Math.min(parseInt(limit), 50),
        minSpamScore: parseInt(minSpamScore)
      };
      
      const comments = await Comment.getSpamComments(options);
      const total = await Comment.countDocuments({
        $or: [
          { status: 'spam' },
          { spamScore: { $gte: options.minSpamScore } }
        ]
      });
      
      res.json({
        success: true,
        data: {
          comments,
          pagination: {
            page: options.page,
            limit: options.limit,
            total,
            pages: Math.ceil(total / options.limit)
          }
        }
      });
      
    } catch (error) {
      logger.error('Get spam comments error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'GET_SPAM_COMMENTS_ERROR',
          message: 'Terjadi kesalahan saat mengambil komentar spam'
        }
      });
    }
  }
  
  /**
   * Get comment statistics (admin only)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getCommentStatistics(req, res) {
    try {
      const stats = await Comment.getStatistics();
      
      res.json({
        success: true,
        data: {
          statistics: stats
        }
      });
      
    } catch (error) {
      logger.error('Get comment statistics error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'GET_STATISTICS_ERROR',
          message: 'Terjadi kesalahan saat mengambil statistik komentar'
        }
      });
    }
  }
}

module.exports = CommentController;