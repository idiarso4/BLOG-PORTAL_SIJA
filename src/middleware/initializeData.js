const Subscription = require('../models/Subscription');
const Category = require('../models/Category');
const logger = require('../config/logger');

/**
 * Initialize default data
 */
const initializeData = async (req, res, next) => {
  try {
    // Only run on first request to avoid repeated execution
    if (!global.dataInitialized) {
      // Create default subscription plans
      const subscriptionCount = await Subscription.countDocuments();
      if (subscriptionCount === 0) {
        await Subscription.createDefaultPlans();
        logger.info('Default subscription plans created');
      }
      
      // Create default categories
      const categoryCount = await Category.countDocuments();
      if (categoryCount === 0) {
        const defaultCategories = [
          {
            nama: 'Teknologi',
            slug: 'teknologi',
            deskripsi: 'Artikel tentang teknologi dan inovasi terbaru'
          },
          {
            nama: 'Lifestyle',
            slug: 'lifestyle',
            deskripsi: 'Tips dan trik untuk gaya hidup yang lebih baik'
          },
          {
            nama: 'Bisnis',
            slug: 'bisnis',
            deskripsi: 'Strategi dan insight dunia bisnis'
          },
          {
            nama: 'Pendidikan',
            slug: 'pendidikan',
            deskripsi: 'Konten edukatif dan pembelajaran'
          },
          {
            nama: 'Kesehatan',
            slug: 'kesehatan',
            deskripsi: 'Tips kesehatan dan wellness'
          }
        ];
        
        await Category.insertMany(defaultCategories);
        logger.info('Default categories created');
      }
      
      global.dataInitialized = true;
    }
    
    next();
  } catch (error) {
    logger.error('Error initializing data:', error);
    next(); // Continue even if initialization fails
  }
};

module.exports = initializeData;