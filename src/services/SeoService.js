const Article = require('../models/Article');
const Category = require('../models/Category');
const User = require('../models/User');
const logger = require('../config/logger');
const fs = require('fs').promises;
const path = require('path');

/**
 * SEO Service for optimization features
 */
class SeoService {
  
  constructor() {
    this.sitemapPath = path.join(process.cwd(), 'public', 'sitemap.xml');
    this.robotsPath = path.join(process.cwd(), 'public', 'robots.txt');
  }
  
  /**
   * Generate meta tags for article
   * @param {Object} article - Article object
   * @returns {Object} Meta tags
   */
  generateArticleMetaTags(article) {
    const baseUrl = process.env.APP_URL || 'http://localhost:3000';
    const articleUrl = `${baseUrl}/blog/${article.slug}`;
    
    // Extract first paragraph for description if no summary
    let description = article.ringkasan;
    if (!description && article.konten) {
      const textContent = article.konten.replace(/<[^>]*>/g, '');
      description = textContent.substring(0, 160) + (textContent.length > 160 ? '...' : '');
    }
    
    const metaTags = {
      // Basic meta tags
      title: article.judul,
      description: description || `Artikel tentang ${article.judul}`,
      keywords: article.tags ? article.tags.join(', ') : '',
      canonical: articleUrl,
      
      // Open Graph tags
      og: {
        title: article.judul,
        description: description,
        url: articleUrl,
        type: 'article',
        image: article.gambarUtama || `${baseUrl}/images/default-og.jpg`,
        site_name: process.env.APP_NAME || 'Blog Platform',
        locale: 'id_ID'
      },
      
      // Twitter Card tags
      twitter: {
        card: 'summary_large_image',
        title: article.judul,
        description: description,
        image: article.gambarUtama || `${baseUrl}/images/default-twitter.jpg`,
        site: process.env.TWITTER_HANDLE || '@blogplatform'
      },
      
      // Article specific meta
      article: {
        author: article.author.profile?.nama || article.author.username,
        published_time: article.createdAt.toISOString(),
        modified_time: article.updatedAt.toISOString(),
        section: article.kategori?.nama || 'General',
        tag: article.tags || []
      }
    };
    
    return metaTags;
  }
  
  /**
   * Generate meta tags for category page
   * @param {Object} category - Category object
   * @param {Number} articleCount - Number of articles in category
   * @returns {Object} Meta tags
   */
  generateCategoryMetaTags(category, articleCount = 0) {
    const baseUrl = process.env.APP_URL || 'http://localhost:3000';
    const categoryUrl = `${baseUrl}/blog?category=${category.slug}`;
    
    const metaTags = {
      title: `${category.nama} - ${process.env.APP_NAME || 'Blog Platform'}`,
      description: category.deskripsi || `Artikel dalam kategori ${category.nama}. ${articleCount} artikel tersedia.`,
      canonical: categoryUrl,
      
      og: {
        title: category.nama,
        description: category.deskripsi,
        url: categoryUrl,
        type: 'website',
        site_name: process.env.APP_NAME || 'Blog Platform'
      },
      
      twitter: {
        card: 'summary',
        title: category.nama,
        description: category.deskripsi
      }
    };
    
    return metaTags;
  }
  
  /**
   * Generate structured data for article
   * @param {Object} article - Article object
   * @returns {Object} JSON-LD structured data
   */
  generateArticleStructuredData(article) {
    const baseUrl = process.env.APP_URL || 'http://localhost:3000';
    
    const structuredData = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: article.judul,
      description: article.ringkasan || article.konten.replace(/<[^>]*>/g, '').substring(0, 160),
      image: article.gambarUtama ? [article.gambarUtama] : [],
      datePublished: article.createdAt.toISOString(),
      dateModified: article.updatedAt.toISOString(),
      author: {
        '@type': 'Person',
        name: article.author.profile?.nama || article.author.username,
        url: `${baseUrl}/authors/${article.author.username}`
      },
      publisher: {
        '@type': 'Organization',
        name: process.env.APP_NAME || 'Blog Platform',
        logo: {
          '@type': 'ImageObject',
          url: `${baseUrl}/images/logo.png`
        }
      },
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': `${baseUrl}/blog/${article.slug}`
      }
    };
    
    // Add article section if category exists
    if (article.kategori) {
      structuredData.articleSection = article.kategori.nama;
    }
    
    // Add keywords if tags exist
    if (article.tags && article.tags.length > 0) {
      structuredData.keywords = article.tags.join(', ');
    }
    
    // Add reading time estimate
    const wordCount = article.konten.replace(/<[^>]*>/g, '').split(' ').length;
    const readingTime = Math.ceil(wordCount / 200); // Average reading speed
    structuredData.timeRequired = `PT${readingTime}M`;
    
    return structuredData;
  }
  
  /**
   * Generate structured data for website
   * @returns {Object} JSON-LD structured data
   */
  generateWebsiteStructuredData() {
    const baseUrl = process.env.APP_URL || 'http://localhost:3000';
    
    return {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: process.env.APP_NAME || 'Blog Platform',
      description: process.env.APP_DESCRIPTION || 'Modern blog platform with AI integration',
      url: baseUrl,
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${baseUrl}/search?q={search_term_string}`
        },
        'query-input': 'required name=search_term_string'
      },
      publisher: {
        '@type': 'Organization',
        name: process.env.APP_NAME || 'Blog Platform',
        logo: {
          '@type': 'ImageObject',
          url: `${baseUrl}/images/logo.png`
        }
      }
    };
  }
  
  /**
   * Generate XML sitemap
   * @returns {Promise<String>} XML sitemap content
   */
  async generateSitemap() {
    try {
      const baseUrl = process.env.APP_URL || 'http://localhost:3000';
      const now = new Date().toISOString();
      
      let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;
      
      // Add homepage
      sitemap += `
  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>`;
      
      // Add blog index
      sitemap += `
  <url>
    <loc>${baseUrl}/blog</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>`;
      
      // Add published articles
      const articles = await Article.find({ status: 'published' })
        .select('slug updatedAt')
        .sort({ updatedAt: -1 })
        .lean();
      
      for (const article of articles) {
        sitemap += `
  <url>
    <loc>${baseUrl}/blog/${article.slug}</loc>
    <lastmod>${article.updatedAt.toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
      }
      
      // Add categories
      const categories = await Category.find()
        .select('slug updatedAt')
        .lean();
      
      for (const category of categories) {
        sitemap += `
  <url>
    <loc>${baseUrl}/blog?category=${category.slug}</loc>
    <lastmod>${category.updatedAt.toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`;
      }
      
      // Add author pages
      const authors = await User.find({ role: { $in: ['admin', 'author'] } })
        .select('username updatedAt')
        .lean();
      
      for (const author of authors) {
        sitemap += `
  <url>
    <loc>${baseUrl}/authors/${author.username}</loc>
    <lastmod>${author.updatedAt.toISOString()}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`;
      }
      
      // Add static pages
      const staticPages = [
        { path: '/about', priority: '0.5' },
        { path: '/contact', priority: '0.5' },
        { path: '/privacy', priority: '0.3' },
        { path: '/terms', priority: '0.3' }
      ];
      
      for (const page of staticPages) {
        sitemap += `
  <url>
    <loc>${baseUrl}${page.path}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>${page.priority}</priority>
  </url>`;
      }
      
      sitemap += `
</urlset>`;
      
      return sitemap;
      
    } catch (error) {
      logger.error('Generate sitemap error:', error);
      throw error;
    }
  }
  
  /**
   * Save sitemap to file
   * @returns {Promise<Boolean>} Success status
   */
  async saveSitemap() {
    try {
      const sitemapContent = await this.generateSitemap();
      
      // Ensure public directory exists
      const publicDir = path.dirname(this.sitemapPath);
      await fs.mkdir(publicDir, { recursive: true });
      
      await fs.writeFile(this.sitemapPath, sitemapContent, 'utf8');
      
      logger.info('Sitemap generated successfully', { path: this.sitemapPath });
      return true;
      
    } catch (error) {
      logger.error('Save sitemap error:', error);
      return false;
    }
  }
  
  /**
   * Generate robots.txt content
   * @returns {String} Robots.txt content
   */
  generateRobotsTxt() {
    const baseUrl = process.env.APP_URL || 'http://localhost:3000';
    const isProduction = process.env.NODE_ENV === 'production';
    
    let robotsTxt = `User-agent: *\n`;
    
    if (isProduction) {
      robotsTxt += `Allow: /
Disallow: /admin/
Disallow: /api/
Disallow: /dashboard/
Disallow: /auth/
Disallow: /uploads/temp/
Disallow: /*?*
Disallow: /search?

# Sitemap
Sitemap: ${baseUrl}/sitemap.xml

# Crawl delay
Crawl-delay: 1`;
    } else {
      robotsTxt += `Disallow: /`;
    }
    
    return robotsTxt;
  }
  
  /**
   * Save robots.txt to file
   * @returns {Promise<Boolean>} Success status
   */
  async saveRobotsTxt() {
    try {
      const robotsContent = this.generateRobotsTxt();
      
      // Ensure public directory exists
      const publicDir = path.dirname(this.robotsPath);
      await fs.mkdir(publicDir, { recursive: true });
      
      await fs.writeFile(this.robotsPath, robotsContent, 'utf8');
      
      logger.info('Robots.txt generated successfully', { path: this.robotsPath });
      return true;
      
    } catch (error) {
      logger.error('Save robots.txt error:', error);
      return false;
    }
  }
  
  /**
   * Analyze SEO for article
   * @param {Object} article - Article object
   * @returns {Object} SEO analysis
   */
  analyzeSEO(article) {
    const analysis = {
      score: 0,
      issues: [],
      suggestions: [],
      strengths: []
    };
    
    // Title analysis
    if (!article.judul) {
      analysis.issues.push('Artikel tidak memiliki judul');
    } else {
      const titleLength = article.judul.length;
      if (titleLength < 30) {
        analysis.suggestions.push('Judul terlalu pendek, disarankan 30-60 karakter');
      } else if (titleLength > 60) {
        analysis.suggestions.push('Judul terlalu panjang, disarankan 30-60 karakter');
      } else {
        analysis.strengths.push('Panjang judul optimal');
        analysis.score += 20;
      }
    }
    
    // Description analysis
    if (!article.ringkasan) {
      analysis.issues.push('Artikel tidak memiliki ringkasan/meta description');
    } else {
      const descLength = article.ringkasan.length;
      if (descLength < 120) {
        analysis.suggestions.push('Ringkasan terlalu pendek, disarankan 120-160 karakter');
      } else if (descLength > 160) {
        analysis.suggestions.push('Ringkasan terlalu panjang, disarankan 120-160 karakter');
      } else {
        analysis.strengths.push('Panjang ringkasan optimal');
        analysis.score += 20;
      }
    }
    
    // Content analysis
    if (!article.konten) {
      analysis.issues.push('Artikel tidak memiliki konten');
    } else {
      const textContent = article.konten.replace(/<[^>]*>/g, '');
      const wordCount = textContent.split(' ').length;
      
      if (wordCount < 300) {
        analysis.suggestions.push('Konten terlalu pendek, disarankan minimal 300 kata');
      } else {
        analysis.strengths.push(`Konten memiliki ${wordCount} kata`);
        analysis.score += 20;
      }
      
      // Check for headings
      const headingCount = (article.konten.match(/<h[1-6][^>]*>/gi) || []).length;
      if (headingCount === 0) {
        analysis.suggestions.push('Tambahkan heading (H1-H6) untuk struktur konten yang lebih baik');
      } else {
        analysis.strengths.push(`Konten memiliki ${headingCount} heading`);
        analysis.score += 10;
      }
    }
    
    // Image analysis
    if (!article.gambarUtama) {
      analysis.suggestions.push('Tambahkan gambar utama untuk meningkatkan engagement');
    } else {
      analysis.strengths.push('Artikel memiliki gambar utama');
      analysis.score += 10;
    }
    
    // Tags analysis
    if (!article.tags || article.tags.length === 0) {
      analysis.suggestions.push('Tambahkan tags untuk meningkatkan discoverability');
    } else if (article.tags.length > 10) {
      analysis.suggestions.push('Terlalu banyak tags, disarankan maksimal 10 tags');
    } else {
      analysis.strengths.push(`Artikel memiliki ${article.tags.length} tags`);
      analysis.score += 10;
    }
    
    // Category analysis
    if (!article.kategori) {
      analysis.suggestions.push('Pilih kategori untuk artikel');
    } else {
      analysis.strengths.push('Artikel memiliki kategori');
      analysis.score += 10;
    }
    
    // Calculate final score
    analysis.score = Math.min(100, analysis.score);
    
    // Add overall assessment
    if (analysis.score >= 80) {
      analysis.assessment = 'Excellent';
    } else if (analysis.score >= 60) {
      analysis.assessment = 'Good';
    } else if (analysis.score >= 40) {
      analysis.assessment = 'Fair';
    } else {
      analysis.assessment = 'Poor';
    }
    
    return analysis;
  }
  
  /**
   * Generate breadcrumb structured data
   * @param {Array} breadcrumbs - Breadcrumb items
   * @returns {Object} JSON-LD structured data
   */
  generateBreadcrumbStructuredData(breadcrumbs) {
    const baseUrl = process.env.APP_URL || 'http://localhost:3000';
    
    return {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: breadcrumbs.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        item: `${baseUrl}${item.url}`
      }))
    };
  }
  
  /**
   * Update all SEO files
   * @returns {Promise<Object>} Update results
   */
  async updateAllSEOFiles() {
    try {
      const results = {
        sitemap: await this.saveSitemap(),
        robots: await this.saveRobotsTxt()
      };
      
      logger.info('SEO files updated', results);
      return results;
      
    } catch (error) {
      logger.error('Update SEO files error:', error);
      throw error;
    }
  }
}

// Create singleton instance
const seoService = new SeoService();

module.exports = seoService;