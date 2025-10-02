const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../config/logger');

/**
 * Socket.IO Service for real-time notifications
 */
class SocketService {
  
  constructor() {
    this.io = null;
    this.connectedUsers = new Map(); // userId -> socketId mapping
    this.userSockets = new Map(); // socketId -> userId mapping
  }
  
  /**
   * Initialize Socket.IO server
   * @param {Object} server - HTTP server instance
   */
  initialize(server) {
    this.io = new Server(server, {
      cors: {
        origin: process.env.NODE_ENV === 'production' 
          ? [process.env.APP_URL]
          : ['http://localhost:3000', 'http://127.0.0.1:3000'],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });
    
    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
          return next(new Error('Authentication token required'));
        }
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId).select('username email profile role isActive');
        
        if (!user || !user.isActive) {
          return next(new Error('Invalid or inactive user'));
        }
        
        socket.userId = user._id.toString();
        socket.user = user;
        next();
        
      } catch (error) {
        logger.error('Socket authentication error:', error);
        next(new Error('Authentication failed'));
      }
    });
    
    // Connection handling
    this.io.on('connection', (socket) => {
      this.handleConnection(socket);
    });
    
    logger.info('Socket.IO server initialized');
  }
  
  /**
   * Handle new socket connection
   * @param {Object} socket - Socket instance
   */
  handleConnection(socket) {
    const userId = socket.userId;
    
    // Store user connection
    this.connectedUsers.set(userId, socket.id);
    this.userSockets.set(socket.id, userId);
    
    // Join user to their personal room
    socket.join(`user:${userId}`);
    
    // Join admin users to admin room
    if (socket.user.role === 'admin') {
      socket.join('admin');
    }
    
    logger.info('User connected via socket', {
      userId,
      socketId: socket.id,
      username: socket.user.username
    });
    
    // Send welcome message
    socket.emit('connected', {
      message: 'Connected to real-time notifications',
      userId,
      timestamp: new Date().toISOString()
    });
    
    // Handle events
    this.setupEventHandlers(socket);
    
    // Handle disconnection
    socket.on('disconnect', () => {
      this.handleDisconnection(socket);
    });
  }
  
  /**
   * Setup event handlers for socket
   * @param {Object} socket - Socket instance
   */
  setupEventHandlers(socket) {
    const userId = socket.userId;
    
    // Join article room for real-time comments
    socket.on('join-article', (articleId) => {
      socket.join(`article:${articleId}`);
      logger.debug('User joined article room', { userId, articleId });
    });
    
    // Leave article room
    socket.on('leave-article', (articleId) => {
      socket.leave(`article:${articleId}`);
      logger.debug('User left article room', { userId, articleId });
    });
    
    // Handle typing indicators for comments
    socket.on('typing-comment', (data) => {
      socket.to(`article:${data.articleId}`).emit('user-typing', {
        userId,
        username: socket.user.username,
        articleId: data.articleId,
        timestamp: new Date().toISOString()
      });
    });
    
    // Handle stop typing
    socket.on('stop-typing', (data) => {
      socket.to(`article:${data.articleId}`).emit('user-stop-typing', {
        userId,
        articleId: data.articleId
      });
    });
    
    // Handle online status
    socket.on('update-status', (status) => {
      if (['online', 'away', 'busy'].includes(status)) {
        socket.broadcast.emit('user-status-change', {
          userId,
          status,
          timestamp: new Date().toISOString()
        });
      }
    });
    
    // Handle read receipts
    socket.on('mark-notification-read', (notificationId) => {
      // TODO: Update notification as read in database
      socket.emit('notification-read', { notificationId });
    });
    
    // Admin events
    if (socket.user.role === 'admin') {
      socket.on('admin-broadcast', (data) => {
        this.broadcastToAll('admin-message', {
          message: data.message,
          type: data.type || 'info',
          timestamp: new Date().toISOString()
        });
      });
    }
  }
  
  /**
   * Handle socket disconnection
   * @param {Object} socket - Socket instance
   */
  handleDisconnection(socket) {
    const userId = socket.userId;
    
    // Remove user from maps
    this.connectedUsers.delete(userId);
    this.userSockets.delete(socket.id);
    
    // Broadcast user offline status
    socket.broadcast.emit('user-status-change', {
      userId,
      status: 'offline',
      timestamp: new Date().toISOString()
    });
    
    logger.info('User disconnected from socket', {
      userId,
      socketId: socket.id,
      username: socket.user?.username
    });
  }
  
  /**
   * Send notification to specific user
   * @param {String} userId - Target user ID
   * @param {String} type - Notification type
   * @param {Object} data - Notification data
   */
  sendToUser(userId, type, data) {
    if (!this.io) return;
    
    this.io.to(`user:${userId}`).emit('notification', {
      type,
      data,
      timestamp: new Date().toISOString()
    });
    
    logger.debug('Notification sent to user', { userId, type });
  }
  
  /**
   * Send notification to article subscribers
   * @param {String} articleId - Article ID
   * @param {String} type - Notification type
   * @param {Object} data - Notification data
   * @param {String} excludeUserId - User ID to exclude from notification
   */
  sendToArticle(articleId, type, data, excludeUserId = null) {
    if (!this.io) return;
    
    const notification = {
      type,
      data,
      timestamp: new Date().toISOString()
    };
    
    if (excludeUserId) {
      this.io.to(`article:${articleId}`).except(`user:${excludeUserId}`).emit('notification', notification);
    } else {
      this.io.to(`article:${articleId}`).emit('notification', notification);
    }
    
    logger.debug('Notification sent to article subscribers', { articleId, type });
  }
  
  /**
   * Send notification to all admin users
   * @param {String} type - Notification type
   * @param {Object} data - Notification data
   */
  sendToAdmins(type, data) {
    if (!this.io) return;
    
    this.io.to('admin').emit('admin-notification', {
      type,
      data,
      timestamp: new Date().toISOString()
    });
    
    logger.debug('Admin notification sent', { type });
  }
  
  /**
   * Broadcast to all connected users
   * @param {String} type - Notification type
   * @param {Object} data - Notification data
   */
  broadcastToAll(type, data) {
    if (!this.io) return;
    
    this.io.emit('broadcast', {
      type,
      data,
      timestamp: new Date().toISOString()
    });
    
    logger.debug('Broadcast sent to all users', { type });
  }
  
  /**
   * Send new comment notification
   * @param {Object} comment - Comment object
   * @param {Object} article - Article object
   */
  notifyNewComment(comment, article) {
    // Notify article author
    if (comment.author.toString() !== article.author.toString()) {
      this.sendToUser(article.author.toString(), 'new-comment', {
        commentId: comment._id,
        articleId: article._id,
        articleTitle: article.judul,
        commenterName: comment.author.profile?.nama || comment.author.username,
        commentContent: comment.konten.substring(0, 100) + (comment.konten.length > 100 ? '...' : '')
      });
    }
    
    // Notify article subscribers (users in article room)
    this.sendToArticle(article._id.toString(), 'article-comment', {
      commentId: comment._id,
      author: {
        id: comment.author._id,
        name: comment.author.profile?.nama || comment.author.username,
        avatar: comment.author.profile?.avatar
      },
      content: comment.konten,
      createdAt: comment.createdAt
    }, comment.author.toString());
  }
  
  /**
   * Send article like notification
   * @param {Object} user - User who liked
   * @param {Object} article - Article object
   */
  notifyArticleLike(user, article) {
    if (user._id.toString() !== article.author.toString()) {
      this.sendToUser(article.author.toString(), 'article-like', {
        articleId: article._id,
        articleTitle: article.judul,
        likerName: user.profile?.nama || user.username,
        likerId: user._id
      });
    }
  }
  
  /**
   * Send subscription notification
   * @param {String} userId - User ID
   * @param {String} type - Subscription event type
   * @param {Object} data - Subscription data
   */
  notifySubscription(userId, type, data) {
    this.sendToUser(userId, 'subscription', {
      eventType: type,
      ...data
    });
    
    // Also notify admins
    this.sendToAdmins('user-subscription', {
      userId,
      eventType: type,
      ...data
    });
  }
  
  /**
   * Send system notification
   * @param {String} type - System notification type
   * @param {Object} data - Notification data
   * @param {String} target - Target audience (all, admins, users)
   */
  notifySystem(type, data, target = 'all') {
    switch (target) {
      case 'admins':
        this.sendToAdmins('system', { type, ...data });
        break;
      case 'users':
        this.broadcastToAll('system', { type, ...data });
        break;
      default:
        this.broadcastToAll('system', { type, ...data });
        this.sendToAdmins('system', { type, ...data });
    }
  }
  
  /**
   * Get connected users count
   * @returns {Number} Number of connected users
   */
  getConnectedUsersCount() {
    return this.connectedUsers.size;
  }
  
  /**
   * Get connected users list (admin only)
   * @returns {Array} List of connected users
   */
  getConnectedUsers() {
    const users = [];
    for (const [userId, socketId] of this.connectedUsers.entries()) {
      const socket = this.io.sockets.sockets.get(socketId);
      if (socket) {
        users.push({
          userId,
          username: socket.user.username,
          connectedAt: socket.handshake.time,
          lastActivity: new Date().toISOString()
        });
      }
    }
    return users;
  }
  
  /**
   * Check if user is online
   * @param {String} userId - User ID
   * @returns {Boolean} Is user online
   */
  isUserOnline(userId) {
    return this.connectedUsers.has(userId);
  }
}

// Create singleton instance
const socketService = new SocketService();

module.exports = socketService;