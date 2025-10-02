const multer = require('multer');
const path = require('path');
const fs = require('fs');
const logger = require('../config/logger');

// Ensure upload directory exists
const uploadDir = 'uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadPath = uploadDir;
    
    // Create subdirectories based on file type
    if (file.fieldname === 'thumbnail') {
      uploadPath = path.join(uploadDir, 'thumbnails');
    } else if (file.fieldname === 'avatar') {
      uploadPath = path.join(uploadDir, 'avatars');
    } else if (file.fieldname === 'media') {
      uploadPath = path.join(uploadDir, 'media');
    }
    
    // Ensure directory exists
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    
    cb(null, uploadPath);
  },
  
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9]/g, '-')
      .toLowerCase();
    
    cb(null, `${name}-${uniqueSuffix}${ext}`);
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  // Allowed file types
  const allowedTypes = {
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'image/gif': ['.gif'],
    'image/webp': ['.webp'],
    'application/pdf': ['.pdf'],
    'application/msword': ['.doc'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
  };
  
  const allowedMimeTypes = Object.keys(allowedTypes);
  const fileExtension = path.extname(file.originalname).toLowerCase();
  
  // Check mime type
  if (!allowedMimeTypes.includes(file.mimetype)) {
    const error = new Error('Tipe file tidak diizinkan');
    error.code = 'INVALID_FILE_TYPE';
    return cb(error, false);
  }
  
  // Check file extension
  const validExtensions = allowedTypes[file.mimetype];
  if (!validExtensions.includes(fileExtension)) {
    const error = new Error('Ekstensi file tidak sesuai dengan tipe file');
    error.code = 'INVALID_FILE_EXTENSION';
    return cb(error, false);
  }
  
  cb(null, true);
};

// Multer configuration
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB default
    files: 5 // Maximum 5 files
  }
});

// Error handling middleware for multer
const handleUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    let message = 'Terjadi kesalahan saat upload file';
    let code = 'UPLOAD_ERROR';
    
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        message = 'File terlalu besar. Maksimal 10MB';
        code = 'FILE_TOO_LARGE';
        break;
      case 'LIMIT_FILE_COUNT':
        message = 'Terlalu banyak file. Maksimal 5 file';
        code = 'TOO_MANY_FILES';
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        message = 'Field file tidak dikenali';
        code = 'UNEXPECTED_FILE';
        break;
    }
    
    logger.error('Multer upload error:', error);
    
    return res.status(400).json({
      success: false,
      error: {
        code,
        message
      }
    });
  }
  
  if (error && error.code) {
    logger.error('File upload error:', error);
    
    return res.status(400).json({
      success: false,
      error: {
        code: error.code,
        message: error.message
      }
    });
  }
  
  next(error);
};

// Upload configurations for different use cases
const uploadConfigs = {
  // Single thumbnail upload
  thumbnail: upload.single('thumbnail'),
  
  // Single avatar upload
  avatar: upload.single('avatar'),
  
  // Multiple media files
  media: upload.array('media', 5),
  
  // Mixed files (thumbnail + media)
  mixed: upload.fields([
    { name: 'thumbnail', maxCount: 1 },
    { name: 'media', maxCount: 5 }
  ]),
  
  // Any single file
  single: upload.single('file'),
  
  // No files (for form data only)
  none: upload.none()
};

// Utility functions
const uploadUtils = {
  /**
   * Delete uploaded file
   * @param {String} filePath - Path to file
   */
  deleteFile: (filePath) => {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        logger.info('File deleted:', filePath);
      }
    } catch (error) {
      logger.error('Error deleting file:', error);
    }
  },
  
  /**
   * Get file info
   * @param {String} filePath - Path to file
   * @returns {Object} File info
   */
  getFileInfo: (filePath) => {
    try {
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        return {
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime,
          extension: path.extname(filePath),
          name: path.basename(filePath)
        };
      }
      return null;
    } catch (error) {
      logger.error('Error getting file info:', error);
      return null;
    }
  },
  
  /**
   * Validate image dimensions
   * @param {String} filePath - Path to image file
   * @param {Object} requirements - Size requirements
   * @returns {Boolean} Is valid
   */
  validateImageSize: async (filePath, requirements = {}) => {
    try {
      // This would require image processing library like sharp
      // For now, just return true
      return true;
    } catch (error) {
      logger.error('Error validating image size:', error);
      return false;
    }
  },
  
  /**
   * Generate thumbnail
   * @param {String} filePath - Path to original image
   * @param {String} outputPath - Path for thumbnail
   * @param {Object} options - Thumbnail options
   */
  generateThumbnail: async (filePath, outputPath, options = {}) => {
    try {
      // This would require image processing library like sharp
      // For now, just copy the file
      fs.copyFileSync(filePath, outputPath);
      logger.info('Thumbnail generated:', outputPath);
    } catch (error) {
      logger.error('Error generating thumbnail:', error);
    }
  }
};

module.exports = {
  upload,
  uploadConfigs,
  handleUploadError,
  uploadUtils
};