const slugify = require('slugify');

/**
 * Article utility functions
 */
class ArticleUtils {
  
  /**
   * Generate unique slug from title
   * @param {String} title - Article title
   * @param {String} existingSlug - Existing slug to check against
   * @returns {String} Unique slug
   */
  static generateSlug(title, existingSlug = null) {
    const baseSlug = slugify(title, {
      lower: true,
      strict: true,
      locale: 'id',
      remove: /[*+~.()'"!:@]/g
    });
    
    // If it's the same as existing slug, return it
    if (existingSlug === baseSlug) {
      return baseSlug;
    }
    
    // Add timestamp to ensure uniqueness
    const timestamp = Date.now().toString().slice(-6);
    return `${baseSlug}-${timestamp}`;
  }
  
  /**
   * Calculate reading time based on content
   * @param {String} content - Article content
   * @param {Number} wordsPerMinute - Average reading speed
   * @returns {Number} Reading time in minutes
   */
  static calculateReadingTime(content, wordsPerMinute = 200) {
    // Remove HTML tags and count words
    const plainText = content.replace(/<[^>]*>/g, '');
    const wordCount = plainText.trim().split(/\s+/).length;
    return Math.ceil(wordCount / wordsPerMinute);
  }
  
  /**
   * Calculate word count
   * @param {String} content - Article content
   * @returns {Number} Word count
   */
  static calculateWordCount(content) {
    const plainText = content.replace(/<[^>]*>/g, '');
    return plainText.trim().split(/\s+/).length;
  }
  
  /**
   * Extract excerpt from content
   * @param {String} content - Article content
   * @param {Number} maxLength - Maximum excerpt length
   * @returns {String} Excerpt
   */
  static extractExcerpt(content, maxLength = 160) {
    const plainText = content.replace(/<[^>]*>/g, '');
    if (plainText.length <= maxLength) {
      return plainText;
    }
    
    return plainText.substring(0, maxLength).trim() + '...';
  }
  
  /**
   * Generate SEO-friendly meta title
   * @param {String} title - Article title
   * @param {String} siteName - Site name
   * @returns {String} Meta title
   */
  static generateMetaTitle(title, siteName = 'Blog Express') {
    const maxLength = 60;
    const separator = ' | ';
    const availableLength = maxLength - siteName.length - separator.length;
    
    if (title.length <= availableLength) {
      return `${title}${separator}${siteName}`;
    }
    
    return title.substring(0, availableLength - 3).trim() + '...';
  }
  
  /**
   * Generate meta description
   * @param {String} summary - Article summary
   * @param {String} content - Article content
   * @returns {String} Meta description
   */
  static generateMetaDescription(summary, content) {
    const maxLength = 160;
    
    if (summary && summary.length <= maxLength) {
      return summary;
    }
    
    const excerpt = this.extractExcerpt(content, maxLength);
    return excerpt;
  }
  
  /**
   * Extract keywords from content
   * @param {String} title - Article title
   * @param {String} content - Article content
   * @param {Array} tags - Article tags
   * @returns {Array} Keywords
   */
  static extractKeywords(title, content, tags = []) {
    const keywords = new Set();
    
    // Add tags as keywords
    tags.forEach(tag => keywords.add(tag.toLowerCase()));
    
    // Extract keywords from title
    const titleWords = title.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3);
    
    titleWords.forEach(word => keywords.add(word));
    
    // Extract common words from content (simple approach)
    const plainText = content.replace(/<[^>]*>/g, '').toLowerCase();
    const words = plainText.split(/\s+/)
      .filter(word => word.length > 4)
      .filter(word => !/^(yang|dengan|untuk|dari|pada|dalam|akan|adalah|atau|dan|ini|itu|juga|dapat|bisa|harus|sudah|belum|tidak|bukan)$/.test(word));
    
    // Count word frequency
    const wordCount = {};
    words.forEach(word => {
      wordCount[word] = (wordCount[word] || 0) + 1;
    });
    
    // Get top words
    const topWords = Object.entries(wordCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([word]) => word);
    
    topWords.forEach(word => keywords.add(word));
    
    return Array.from(keywords).slice(0, 10);
  }
  
  /**
   * Generate structured data for article
   * @param {Object} article - Article object
   * @param {Object} author - Author object
   * @param {String} baseUrl - Base URL
   * @returns {Object} Structured data
   */
  static generateStructuredData(article, author, baseUrl) {
    return {
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": article.judul,
      "description": article.seo.metaDescription || article.ringkasan,
      "image": article.thumbnail ? `${baseUrl}${article.thumbnail}` : null,
      "datePublished": article.publishedAt,
      "dateModified": article.updatedAt,
      "author": {
        "@type": "Person",
        "name": author.profile.nama,
        "url": `${baseUrl}/penulis/${author.username}`
      },
      "publisher": {
        "@type": "Organization",
        "name": "Blog Express",
        "logo": {
          "@type": "ImageObject",
          "url": `${baseUrl}/images/logo.png`
        }
      },
      "mainEntityOfPage": {
        "@type": "WebPage",
        "@id": `${baseUrl}${article.url}`
      },
      "wordCount": article.metadata.wordCount,
      "timeRequired": `PT${article.metadata.readTime}M`,
      "keywords": article.seo.keywords.join(', ')
    };
  }
  
  /**
   * Generate social media message
   * @param {Object} article - Article object
   * @param {String} platform - Social media platform
   * @param {String} baseUrl - Base URL
   * @returns {String} Social media message
   */
  static generateSocialMessage(article, platform, baseUrl) {
    const url = `${baseUrl}${article.url}`;
    const hashtags = article.socialMedia.hashtags.join(' ');
    
    let message = article.socialMedia.customMessage || article.judul;
    
    switch (platform) {
      case 'twitter':
        const maxLength = 280 - url.length - hashtags.length - 3; // 3 for spaces
        if (message.length > maxLength) {
          message = message.substring(0, maxLength - 3) + '...';
        }
        return `${message} ${url} ${hashtags}`.trim();
        
      case 'facebook':
        return `${message}\n\n${url}\n\n${hashtags}`;
        
      case 'linkedin':
        return `${message}\n\n${url}\n\n${hashtags}`;
        
      case 'instagram':
        // Instagram doesn't support clickable links in posts
        return `${message}\n\n${hashtags}\n\nLink in bio!`;
        
      default:
        return `${message} ${url} ${hashtags}`.trim();
    }
  }
  
  /**
   * Validate article content
   * @param {Object} articleData - Article data to validate
   * @returns {Object} Validation result
   */
  static validateContent(articleData) {
    const errors = [];
    
    // Check title length
    if (!articleData.judul || articleData.judul.length < 10) {
      errors.push('Judul minimal 10 karakter');
    }
    
    if (articleData.judul && articleData.judul.length > 200) {
      errors.push('Judul maksimal 200 karakter');
    }
    
    // Check content length
    if (!articleData.konten || articleData.konten.length < 100) {
      errors.push('Konten minimal 100 karakter');
    }
    
    // Check category
    if (!articleData.kategori) {
      errors.push('Kategori wajib dipilih');
    }
    
    // Check tags
    if (articleData.tags && articleData.tags.length > 10) {
      errors.push('Maksimal 10 tags');
    }
    
    // Check SEO fields
    if (articleData.seo) {
      if (articleData.seo.metaTitle && articleData.seo.metaTitle.length > 60) {
        errors.push('Meta title maksimal 60 karakter');
      }
      
      if (articleData.seo.metaDescription && articleData.seo.metaDescription.length > 160) {
        errors.push('Meta description maksimal 160 karakter');
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Format article for API response
   * @param {Object} article - Article object
   * @param {Boolean} includeContent - Include full content
   * @returns {Object} Formatted article
   */
  static formatForResponse(article, includeContent = true) {
    const formatted = {
      id: article._id,
      judul: article.judul,
      slug: article.slug,
      ringkasan: article.ringkasan,
      thumbnail: article.thumbnail,
      kategori: article.kategori,
      tags: article.tags,
      penulis: article.penulis,
      status: article.status,
      featured: article.featured,
      premium: article.premium,
      metadata: article.metadata,
      url: article.url,
      readingTime: article.readingTime,
      isPublished: article.isPublished,
      isScheduled: article.isScheduled,
      engagementRate: article.engagementRate,
      publishedAt: article.publishedAt,
      createdAt: article.createdAt,
      updatedAt: article.updatedAt
    };
    
    if (includeContent) {
      formatted.konten = article.konten;
    }
    
    return formatted;
  }
  
  /**
   * Get article statistics summary
   * @param {Object} article - Article object
   * @returns {Object} Statistics summary
   */
  static getStatisticsSummary(article) {
    const { views, likes, shares, comments } = article.metadata;
    const totalEngagement = likes + shares + comments;
    const engagementRate = views > 0 ? (totalEngagement / views * 100).toFixed(2) : 0;
    
    return {
      views,
      likes,
      shares,
      comments,
      totalEngagement,
      engagementRate: parseFloat(engagementRate),
      readTime: article.metadata.readTime,
      wordCount: article.metadata.wordCount
    };
  }
}

module.exports = ArticleUtils;