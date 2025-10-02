require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const session = require('express-session');
const RedisStore = require('connect-redis').default;
const { createClient } = require('redis');

// Import configurations
const config = require('./src/config/database');
const logger = require('./src/config/logger');

// Import middleware
const errorHandler = require('./src/middleware/errorHandler');
const notFound = require('./src/middleware/notFound');
const initializeData = require('./src/middleware/initializeData');

// Import routes
const authRoutes = require('./src/routes/auth');
const socialAuthRoutes = require('./src/routes/social-auth');
const blogRoutes = require('./src/routes/blog');
const userRoutes = require('./src/routes/user');
const adminRoutes = require('./src/routes/admin');
const subscriptionRoutes = require('./src/routes/subscription');
const paymentRoutes = require('./src/routes/payment');
const dashboardRoutes = require('./src/routes/dashboard');
const notificationRoutes = require('./src/routes/notification');
const searchRoutes = require('./src/routes/search');
const monitoringRoutes = require('./src/routes/monitoring');

const app = express();
const PORT = process.env.PORT || 3000;

// Enhanced security middleware
const { securityMiddlewareStack } = require('./src/middleware/security');
app.use(securityMiddlewareStack);

// Monitoring and logging
const { requestLogger, errorHandler } = require('./src/config/monitoring');
app.use(requestLogger);

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX), // limit each IP to 100 requests per windowMs
  message: {
    error: 'Terlalu banyak permintaan dari IP ini, coba lagi nanti.'
  }
});
app.use(limiter);

// CORS is now handled by security middleware stack

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/public', express.static(path.join(__dirname, 'public')));

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src/views'));

// Redis client for session store
let redisClient;
if (process.env.NODE_ENV !== 'test') {
  redisClient = createClient({
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    password: process.env.REDIS_PASSWORD
  });
  
  redisClient.on('error', (err) => {
    logger.error('Redis Client Error:', err);
  });
  
  redisClient.connect().catch(console.error);
}

// Session configuration
app.use(session({
  store: redisClient ? new RedisStore({ client: redisClient }) : undefined,
  secret: process.env.JWT_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Database connection
mongoose.connect(process.env.MONGODB_URI, config.options)
  .then(() => {
    logger.info('Connected to MongoDB');
  })
  .catch((error) => {
    logger.error('MongoDB connection error:', error);
    process.exit(1);
  });

// Initialize default data
app.use(initializeData);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/auth/social', socialAuthRoutes);
app.use('/api/blog', blogRoutes);
app.use('/api/user', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/monitoring', monitoringRoutes);

// API Documentation
if (process.env.NODE_ENV !== 'production') {
  const { specs, swaggerUi, swaggerOptions } = require('./src/config/swagger');
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, swaggerOptions));
}

// Health check endpoint (redirect to monitoring)
app.get('/health', (req, res) => {
  res.redirect('/api/monitoring/health');
});

// Root route
app.get('/', (req, res) => {
  res.render('index', { 
    title: 'Blog Express - Platform Blog Modern',
    description: 'Platform blog dengan fitur AI, social media integration, dan analytics'
  });
});

// Dashboard routes
app.get('/dashboard', (req, res) => {
  // TODO: Add authentication middleware
  res.render('dashboard/user', {
    title: 'User Dashboard',
    user: req.user || { username: 'demo', profile: { nama: 'Demo User' } }
  });
});

app.get('/admin', (req, res) => {
  // TODO: Add admin authentication middleware
  res.render('dashboard/admin', {
    title: 'Admin Dashboard'
  });
});

// Blog routes
app.get('/blog', (req, res) => {
  res.render('blog/index', {
    title: 'Blog Platform',
    description: 'Modern blog platform with AI integration',
    articles: [],
    featuredArticles: [],
    stats: {
      totalArticles: 0,
      totalAuthors: 0,
      totalViews: 0,
      totalComments: 0
    },
    user: req.user || null,
    searchQuery: req.query.search || ''
  });
});

app.get('/blog/:slug', (req, res) => {
  // TODO: Fetch article by slug
  res.render('blog/article', {
    title: 'Article Title',
    article: {
      _id: 'demo',
      judul: 'Demo Article',
      slug: req.params.slug,
      konten: '<p>This is a demo article content.</p>',
      author: {
        username: 'demo',
        profile: { nama: 'Demo Author' }
      },
      createdAt: new Date(),
      views: 100,
      tags: ['demo', 'article']
    },
    comments: [],
    relatedArticles: [],
    user: req.user || null
  });
});

// Error handling middleware
app.use(notFound);
app.use(errorHandler); // Use monitoring error handler

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  mongoose.connection.close(() => {
    logger.info('MongoDB connection closed');
    if (redisClient) {
      redisClient.quit();
    }
    process.exit(0);
  });
});

// Start server
if (process.env.NODE_ENV !== 'test') {
  const server = app.listen(PORT, () => {
    logger.info(`Server running on http://${process.env.HOST}:${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV}`);
  });
  
  // Initialize Socket.IO
  const SocketService = require('./src/services/SocketService');
  SocketService.initialize(server);

  // Initialize Social Scheduler Service
  try {
    const SocialSchedulerService = require('./src/services/SocialSchedulerService');
    SocialSchedulerService.start();
  } catch (e) {
    logger.error('Failed to start SocialSchedulerService', e);
  }
}

module.exports = app;