const OpenAI = require('openai');
const logger = require('../config/logger');

/**
 * AI Service untuk integrasi dengan OpenAI API
 */
class AiService {
  
  constructor() {
    this.openai = null;
    this.initializeOpenAI();
  }
  
  /**
   * Initialize OpenAI client
   */
  initializeOpenAI() {
    try {
      if (!process.env.OPENAI_API_KEY) {
        logger.warn('OpenAI API key not configured');
        return;
      }
      
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
      
      logger.info('OpenAI client initialized');
    } catch (error) {
      logger.error('Failed to initialize OpenAI client:', error);
    }
  }
  
  /**
   * Check if OpenAI is available
   */
  isAvailable() {
    return this.openai !== null;
  }
  
  /**
   * Generate article content
   * @param {Object} options - Generation options
   * @returns {Object} Generated content
   */
  async generateArticle(options) {
    if (!this.isAvailable()) {
      throw new Error('OpenAI service tidak tersedia');
    }
    
    const {
      topic,
      category,
      tone = 'professional',
      length = 'medium',
      language = 'id',
      keywords = [],
      targetAudience = 'general'
    } = options;
    
    try {
      // Build prompt based on options
      const prompt = this.buildArticlePrompt({
        topic,
        category,
        tone,
        length,
        language,
        keywords,
        targetAudience
      });
      
      const completion = await this.openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'Anda adalah seorang penulis artikel profesional yang ahli dalam membuat konten berkualitas tinggi dalam bahasa Indonesia.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: this.getMaxTokens(length),
        temperature: 0.7,
        presence_penalty: 0.1,
        frequency_penalty: 0.1
      });
      
      const generatedText = completion.choices[0].message.content;
      
      // Parse the generated content
      const parsedContent = this.parseGeneratedArticle(generatedText);
      
      // Log usage
      logger.info('Article generated', {
        topic,
        category,
        tokensUsed: completion.usage.total_tokens,
        model: completion.model
      });
      
      return {
        success: true,
        data: {
          ...parsedContent,
          metadata: {
            model: completion.model,
            tokensUsed: completion.usage.total_tokens,
            generatedAt: new Date(),
            prompt: {
              topic,
              category,
              tone,
              length,
              language,
              keywords,
              targetAudience
            }
          }
        }
      };
      
    } catch (error) {
      logger.error('Article generation error:', error);
      throw new Error('Gagal menghasilkan artikel: ' + error.message);
    }
  }
  
  /**
   * Generate article outline
   * @param {Object} options - Generation options
   * @returns {Object} Generated outline
   */
  async generateOutline(options) {
    if (!this.isAvailable()) {
      throw new Error('OpenAI service tidak tersedia');
    }
    
    const { topic, category, sections = 5 } = options;
    
    try {
      const prompt = `
        Buatkan outline artikel tentang "${topic}" dalam kategori ${category}.
        
        Format yang diinginkan:
        1. Judul artikel yang menarik
        2. Ringkasan singkat (1-2 kalimat)
        3. ${sections} poin utama yang akan dibahas
        4. Kesimpulan
        
        Pastikan outline ini terstruktur dengan baik dan mudah dipahami.
      `;
      
      const completion = await this.openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'Anda adalah seorang editor artikel yang ahli dalam membuat outline artikel yang terstruktur dan menarik.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 800,
        temperature: 0.8
      });
      
      const outline = completion.choices[0].message.content;
      
      logger.info('Outline generated', {
        topic,
        category,
        tokensUsed: completion.usage.total_tokens
      });
      
      return {
        success: true,
        data: {
          outline,
          metadata: {
            model: completion.model,
            tokensUsed: completion.usage.total_tokens,
            generatedAt: new Date()
          }
        }
      };
      
    } catch (error) {
      logger.error('Outline generation error:', error);
      throw new Error('Gagal menghasilkan outline: ' + error.message);
    }
  }
  
  /**
   * Improve existing content
   * @param {String} content - Original content
   * @param {Object} options - Improvement options
   * @returns {Object} Improved content
   */
  async improveContent(content, options = {}) {
    if (!this.isAvailable()) {
      throw new Error('OpenAI service tidak tersedia');
    }
    
    const {
      type = 'general', // general, seo, readability, grammar
      targetKeywords = [],
      tone = 'professional'
    } = options;
    
    try {
      const prompt = this.buildImprovementPrompt(content, type, targetKeywords, tone);
      
      const completion = await this.openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'Anda adalah seorang editor profesional yang ahli dalam memperbaiki dan meningkatkan kualitas konten artikel.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: Math.min(content.length * 2, 4000),
        temperature: 0.5
      });
      
      const improvedContent = completion.choices[0].message.content;
      
      logger.info('Content improved', {
        type,
        originalLength: content.length,
        improvedLength: improvedContent.length,
        tokensUsed: completion.usage.total_tokens
      });
      
      return {
        success: true,
        data: {
          originalContent: content,
          improvedContent,
          improvements: this.analyzeImprovements(content, improvedContent),
          metadata: {
            model: completion.model,
            tokensUsed: completion.usage.total_tokens,
            improvementType: type,
            generatedAt: new Date()
          }
        }
      };
      
    } catch (error) {
      logger.error('Content improvement error:', error);
      throw new Error('Gagal memperbaiki konten: ' + error.message);
    }
  }
  
  /**
   * Generate SEO meta tags
   * @param {String} title - Article title
   * @param {String} content - Article content
   * @param {Array} keywords - Target keywords
   * @returns {Object} SEO meta tags
   */
  async generateSEOTags(title, content, keywords = []) {
    if (!this.isAvailable()) {
      throw new Error('OpenAI service tidak tersedia');
    }
    
    try {
      const prompt = `
        Berdasarkan judul "${title}" dan konten artikel berikut, buatkan:
        1. Meta title yang SEO-friendly (maksimal 60 karakter)
        2. Meta description yang menarik (maksimal 160 karakter)
        3. 5-10 keywords yang relevan
        4. Slug URL yang SEO-friendly
        
        ${keywords.length > 0 ? `Target keywords: ${keywords.join(', ')}` : ''}
        
        Konten artikel:
        ${content.substring(0, 1000)}...
        
        Format response dalam JSON:
        {
          "metaTitle": "...",
          "metaDescription": "...",
          "keywords": ["keyword1", "keyword2", ...],
          "slug": "..."
        }
      `;
      
      const completion = await this.openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'Anda adalah seorang SEO specialist yang ahli dalam membuat meta tags yang optimal untuk search engine.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 500,
        temperature: 0.3
      });
      
      const response = completion.choices[0].message.content;
      
      // Try to parse JSON response
      let seoTags;
      try {
        seoTags = JSON.parse(response);
      } catch (parseError) {
        // Fallback if JSON parsing fails
        seoTags = this.extractSEOTagsFromText(response);
      }
      
      logger.info('SEO tags generated', {
        title,
        tokensUsed: completion.usage.total_tokens
      });
      
      return {
        success: true,
        data: {
          ...seoTags,
          metadata: {
            model: completion.model,
            tokensUsed: completion.usage.total_tokens,
            generatedAt: new Date()
          }
        }
      };
      
    } catch (error) {
      logger.error('SEO tags generation error:', error);
      throw new Error('Gagal menghasilkan SEO tags: ' + error.message);
    }
  }
  
  /**
   * Generate content ideas
   * @param {Object} options - Generation options
   * @returns {Object} Content ideas
   */
  async generateContentIdeas(options) {
    if (!this.isAvailable()) {
      throw new Error('OpenAI service tidak tersedia');
    }
    
    const {
      category,
      audience = 'general',
      count = 10,
      trending = false
    } = options;
    
    try {
      const prompt = `
        Buatkan ${count} ide artikel untuk kategori "${category}" dengan target audience "${audience}".
        ${trending ? 'Fokus pada topik yang sedang trending dan relevan saat ini.' : ''}
        
        Untuk setiap ide, berikan:
        1. Judul artikel yang menarik
        2. Ringkasan singkat (1 kalimat)
        3. Target keyword utama
        4. Estimasi tingkat kesulitan (mudah/sedang/sulit)
        
        Format dalam JSON array:
        [
          {
            "title": "...",
            "summary": "...",
            "keyword": "...",
            "difficulty": "..."
          }
        ]
      `;
      
      const completion = await this.openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'Anda adalah seorang content strategist yang ahli dalam menghasilkan ide konten yang menarik dan relevan.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1500,
        temperature: 0.9
      });
      
      const response = completion.choices[0].message.content;
      
      // Try to parse JSON response
      let ideas;
      try {
        ideas = JSON.parse(response);
      } catch (parseError) {
        // Fallback parsing
        ideas = this.extractIdeasFromText(response);
      }
      
      logger.info('Content ideas generated', {
        category,
        count: ideas.length,
        tokensUsed: completion.usage.total_tokens
      });
      
      return {
        success: true,
        data: {
          ideas,
          metadata: {
            model: completion.model,
            tokensUsed: completion.usage.total_tokens,
            category,
            audience,
            generatedAt: new Date()
          }
        }
      };
      
    } catch (error) {
      logger.error('Content ideas generation error:', error);
      throw new Error('Gagal menghasilkan ide konten: ' + error.message);
    }
  }
  
  /**
   * Build article generation prompt
   * @param {Object} options - Prompt options
   * @returns {String} Generated prompt
   */
  buildArticlePrompt(options) {
    const {
      topic,
      category,
      tone,
      length,
      language,
      keywords,
      targetAudience
    } = options;
    
    const lengthGuide = {
      short: '300-500 kata',
      medium: '800-1200 kata',
      long: '1500-2500 kata'
    };
    
    const toneGuide = {
      professional: 'profesional dan formal',
      casual: 'santai dan mudah dipahami',
      academic: 'akademis dengan referensi',
      conversational: 'seperti berbicara dengan teman'
    };
    
    return `
      Tulis artikel lengkap tentang "${topic}" untuk kategori ${category}.
      
      Spesifikasi:
      - Panjang: ${lengthGuide[length] || lengthGuide.medium}
      - Tone: ${toneGuide[tone] || toneGuide.professional}
      - Target audience: ${targetAudience}
      - Bahasa: ${language === 'id' ? 'Indonesia' : 'English'}
      ${keywords.length > 0 ? `- Keywords yang harus disertakan: ${keywords.join(', ')}` : ''}
      
      Format artikel:
      1. Judul yang menarik dan SEO-friendly
      2. Paragraf pembuka yang engaging
      3. Konten utama dengan sub-heading yang jelas
      4. Kesimpulan yang kuat
      5. Call-to-action di akhir
      
      Pastikan artikel informatif, mudah dibaca, dan memberikan value kepada pembaca.
    `;
  }
  
  /**
   * Build content improvement prompt
   * @param {String} content - Original content
   * @param {String} type - Improvement type
   * @param {Array} keywords - Target keywords
   * @param {String} tone - Desired tone
   * @returns {String} Improvement prompt
   */
  buildImprovementPrompt(content, type, keywords, tone) {
    const improvements = {
      general: 'Perbaiki secara keseluruhan untuk meningkatkan kualitas, keterbacaan, dan engagement',
      seo: 'Optimasi untuk SEO dengan meningkatkan keyword density dan struktur',
      readability: 'Tingkatkan keterbacaan dengan memperbaiki struktur kalimat dan paragraf',
      grammar: 'Perbaiki tata bahasa, ejaan, dan struktur kalimat'
    };
    
    return `
      ${improvements[type] || improvements.general} pada konten berikut:
      
      ${keywords.length > 0 ? `Target keywords: ${keywords.join(', ')}` : ''}
      Tone yang diinginkan: ${tone}
      
      Konten asli:
      ${content}
      
      Berikan versi yang diperbaiki dengan penjelasan singkat tentang perubahan yang dilakukan.
    `;
  }
  
  /**
   * Parse generated article content
   * @param {String} generatedText - Raw generated text
   * @returns {Object} Parsed article components
   */
  parseGeneratedArticle(generatedText) {
    const lines = generatedText.split('\n').filter(line => line.trim());
    
    let title = '';
    let content = '';
    let summary = '';
    
    // Extract title (usually the first line or marked with #)
    const titleLine = lines.find(line => 
      line.startsWith('#') || 
      line.length < 100 && !line.includes('.')
    );
    
    if (titleLine) {
      title = titleLine.replace(/^#+\s*/, '').trim();
    }
    
    // Extract content (everything else)
    content = generatedText.replace(titleLine || '', '').trim();
    
    // Generate summary from first paragraph
    const firstParagraph = content.split('\n\n')[0];
    if (firstParagraph && firstParagraph.length > 50) {
      summary = firstParagraph.substring(0, 200) + '...';
    }
    
    return {
      title: title || 'Artikel Tanpa Judul',
      content,
      summary
    };
  }
  
  /**
   * Extract SEO tags from text response
   * @param {String} text - Response text
   * @returns {Object} Extracted SEO tags
   */
  extractSEOTagsFromText(text) {
    const lines = text.split('\n');
    
    return {
      metaTitle: this.extractValue(lines, 'meta title') || 'Default Title',
      metaDescription: this.extractValue(lines, 'meta description') || 'Default description',
      keywords: this.extractKeywords(text),
      slug: this.extractValue(lines, 'slug') || 'default-slug'
    };
  }
  
  /**
   * Extract content ideas from text response
   * @param {String} text - Response text
   * @returns {Array} Extracted ideas
   */
  extractIdeasFromText(text) {
    const ideas = [];
    const lines = text.split('\n').filter(line => line.trim());
    
    let currentIdea = {};
    
    lines.forEach(line => {
      if (line.match(/^\d+\./)) {
        if (Object.keys(currentIdea).length > 0) {
          ideas.push(currentIdea);
        }
        currentIdea = {
          title: line.replace(/^\d+\.\s*/, ''),
          summary: '',
          keyword: '',
          difficulty: 'sedang'
        };
      }
    });
    
    if (Object.keys(currentIdea).length > 0) {
      ideas.push(currentIdea);
    }
    
    return ideas;
  }
  
  /**
   * Extract value from lines
   * @param {Array} lines - Text lines
   * @param {String} key - Key to search for
   * @returns {String} Extracted value
   */
  extractValue(lines, key) {
    const line = lines.find(l => 
      l.toLowerCase().includes(key.toLowerCase())
    );
    
    if (line) {
      return line.split(':')[1]?.trim().replace(/['"]/g, '') || '';
    }
    
    return '';
  }
  
  /**
   * Extract keywords from text
   * @param {String} text - Text to extract from
   * @returns {Array} Extracted keywords
   */
  extractKeywords(text) {
    const keywordMatch = text.match(/keywords?[:\s]+([^.\n]+)/i);
    if (keywordMatch) {
      return keywordMatch[1]
        .split(',')
        .map(k => k.trim().replace(/['"]/g, ''))
        .filter(k => k.length > 0);
    }
    
    return [];
  }
  
  /**
   * Analyze improvements between original and improved content
   * @param {String} original - Original content
   * @param {String} improved - Improved content
   * @returns {Object} Analysis results
   */
  analyzeImprovements(original, improved) {
    return {
      lengthChange: improved.length - original.length,
      wordCountChange: improved.split(' ').length - original.split(' ').length,
      readabilityImproved: improved.split('.').length > original.split('.').length,
      structureImproved: (improved.match(/\n\n/g) || []).length > (original.match(/\n\n/g) || []).length
    };
  }
  
  /**
   * Get max tokens based on length
   * @param {String} length - Desired length
   * @returns {Number} Max tokens
   */
  getMaxTokens(length) {
    const tokenLimits = {
      short: 800,
      medium: 1500,
      long: 3000
    };
    
    return tokenLimits[length] || tokenLimits.medium;
  }
  
  /**
   * Generate image using DALL-E
   * @param {Object} options - Image generation options
   * @returns {Object} Generated image data
   */
  async generateImage(options) {
    if (!this.isAvailable()) {
      throw new Error('OpenAI service tidak tersedia');
    }
    
    const {
      prompt,
      size = '1024x1024',
      quality = 'standard',
      style = 'vivid',
      count = 1
    } = options;
    
    try {
      const response = await this.openai.images.generate({
        model: 'dall-e-3',
        prompt,
        n: count,
        size,
        quality,
        style
      });
      
      const images = response.data.map(image => ({
        url: image.url,
        revisedPrompt: image.revised_prompt || prompt
      }));
      
      logger.info('Image generated', {
        prompt: prompt.substring(0, 100),
        size,
        quality,
        style,
        count: images.length
      });
      
      return {
        success: true,
        data: {
          images,
          metadata: {
            model: 'dall-e-3',
            originalPrompt: prompt,
            size,
            quality,
            style,
            generatedAt: new Date()
          }
        }
      };
      
    } catch (error) {
      logger.error('Image generation error:', error);
      throw new Error('Gagal menghasilkan gambar: ' + error.message);
    }
  }
  
  /**
   * Optimize image prompt
   * @param {String} basicPrompt - Basic image description
   * @param {Object} options - Optimization options
   * @returns {Object} Optimized prompt
   */
  async optimizeImagePrompt(basicPrompt, options = {}) {
    if (!this.isAvailable()) {
      throw new Error('OpenAI service tidak tersedia');
    }
    
    const {
      style = 'realistic',
      mood = 'neutral',
      details = 'medium'
    } = options;
    
    try {
      const prompt = `
        Optimasi prompt berikut untuk DALL-E image generation:
        
        Prompt dasar: "${basicPrompt}"
        Style yang diinginkan: ${style}
        Mood: ${mood}
        Level detail: ${details}
        
        Buatkan prompt yang lebih detail dan spesifik untuk menghasilkan gambar berkualitas tinggi.
        Sertakan detail tentang lighting, composition, color palette, dan style.
        
        Berikan hanya prompt yang sudah dioptimasi, tanpa penjelasan tambahan.
      `;
      
      const completion = await this.openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'Anda adalah seorang prompt engineer yang ahli dalam membuat prompt untuk AI image generation.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 300,
        temperature: 0.7
      });
      
      const optimizedPrompt = completion.choices[0].message.content.trim();
      
      logger.info('Image prompt optimized', {
        originalPrompt: basicPrompt,
        optimizedLength: optimizedPrompt.length,
        tokensUsed: completion.usage.total_tokens
      });
      
      return {
        success: true,
        data: {
          originalPrompt: basicPrompt,
          optimizedPrompt,
          metadata: {
            model: completion.model,
            tokensUsed: completion.usage.total_tokens,
            style,
            mood,
            details,
            generatedAt: new Date()
          }
        }
      };
      
    } catch (error) {
      logger.error('Image prompt optimization error:', error);
      throw new Error('Gagal mengoptimasi prompt gambar: ' + error.message);
    }
  }
  
  /**
   * Get usage statistics
   * @returns {Object} Usage statistics
   */
  async getUsageStats() {
    // This would typically come from a database
    // For now, return placeholder data
    return {
      totalRequests: 0,
      totalTokensUsed: 0,
      totalImagesGenerated: 0,
      averageTokensPerRequest: 0,
      mostUsedFeature: 'article_generation',
      lastUsed: new Date()
    };
  }
}

// Create singleton instance
const aiService = new AiService();

module.exports = aiService;