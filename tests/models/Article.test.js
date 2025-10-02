const mongoose = require('mongoose');
const Article = require('../../src/models/Article');
const User = require('../../src/models/User');
const { MongoMemoryServer } = require('mongodb-memory-server');

describe('Article Model', () => {
  let mongoServer;
  let testUser;
  let testCategory;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await Article.deleteMany({});
    await User.deleteMany({});
    
    // Create test user
    testUser = new User({
      username: 'testauthor',
      email: 'author@example.com',
      password: 'Password123',
      profile: {
        nama: 'Test Author'
      }
    });
    await testUser.save();
    
    // Create mock category ID
    testCategory = new mongoose.Types.ObjectId();
  });

  describe('Article Creation', () => {
    it('should create an article with valid data', async () => {
      const articleData = {
        judul: 'Test Article Title',
        konten: 'This is a test article content with more than 100 characters to meet the minimum requirement for article content validation.',
        ringkasan: 'This is a test summary',
        kategori: testCategory,
        penulis: testUser._id,
        tags: ['test', 'article']
      };

      const article = new Article(articleData);
      const savedArticle = await article.save();

      expect(savedArticle._id).toBeDefined();
      expect(savedArticle.judul).toBe('Test Article Title');
      expect(savedArticle.slug).toBeDefined();
      expect(savedArticle.slug).toMatch(/^test-article-title-\d{6}$/);
      expect(savedArticle.status).toBe('draft'); // default status
      expect(savedArticle.featured).toBe(false); // default featured
      expect(savedArticle.premium).toBe(false); // default premium
      expect(savedArticle.metadata.views).toBe(0); // default views
      expect(savedArticle.version).toBe(1); // default version
    });

    it('should auto-generate slug from title', async () => {
      const articleData = {
        judul: 'Artikel dengan Judul Panjang dan Spasi',
        konten: 'This is a test article content with more than 100 characters to meet the minimum requirement for article content validation.',
        kategori: testCategory,
        penulis: testUser._id
      };

      const article = new Article(articleData);
      const savedArticle = await article.save();

      expect(savedArticle.slug).toMatch(/^artikel-dengan-judul-panjang-dan-spasi-\d{6}$/);
    });

    it('should calculate reading time and word count', async () => {
      const longContent = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(50);
      
      const articleData = {
        judul: 'Test Article with Long Content',
        konten: longContent,
        kategori: testCategory,
        penulis: testUser._id
      };

      const article = new Article(articleData);
      const savedArticle = await article.save();

      expect(savedArticle.metadata.readTime).toBeGreaterThan(0);
      expect(savedArticle.metadata.wordCount).toBeGreaterThan(0);
    });

    it('should generate SEO fields automatically', async () => {
      const articleData = {
        judul: 'Test Article for SEO Generation',
        konten: 'This is a test article content with more than 100 characters to meet the minimum requirement for article content validation.',
        ringkasan: 'This is a test summary for SEO',
        kategori: testCategory,
        penulis: testUser._id
      };

      const article = new Article(articleData);
      const savedArticle = await article.save();

      expect(savedArticle.seo.metaTitle).toBeDefined();
      expect(savedArticle.seo.metaDescription).toBeDefined();
      expect(savedArticle.seo.structuredData).toBeDefined();
      expect(savedArticle.seo.structuredData['@type']).toBe('Article');
    });
  });

  describe('Article Validation', () => {
    it('should require title', async () => {
      const articleData = {
        konten: 'This is a test article content with more than 100 characters to meet the minimum requirement.',
        kategori: testCategory,
        penulis: testUser._id
      };

      const article = new Article(articleData);
      
      await expect(article.save()).rejects.toThrow('Judul artikel wajib diisi');
    });

    it('should require content', async () => {
      const articleData = {
        judul: 'Test Article Title',
        kategori: testCategory,
        penulis: testUser._id
      };

      const article = new Article(articleData);
      
      await expect(article.save()).rejects.toThrow('Konten artikel wajib diisi');
    });

    it('should require category', async () => {
      const articleData = {
        judul: 'Test Article Title',
        konten: 'This is a test article content with more than 100 characters to meet the minimum requirement.',
        penulis: testUser._id
      };

      const article = new Article(articleData);
      
      await expect(article.save()).rejects.toThrow('Kategori artikel wajib dipilih');
    });

    it('should require author', async () => {
      const articleData = {
        judul: 'Test Article Title',
        konten: 'This is a test article content with more than 100 characters to meet the minimum requirement.',
        kategori: testCategory
      };

      const article = new Article(articleData);
      
      await expect(article.save()).rejects.toThrow('Penulis artikel wajib diisi');
    });

    it('should validate title length', async () => {
      const articleData = {
        judul: 'Short', // too short
        konten: 'This is a test article content with more than 100 characters to meet the minimum requirement.',
        kategori: testCategory,
        penulis: testUser._id
      };

      const article = new Article(articleData);
      
      await expect(article.save()).rejects.toThrow('Judul minimal 10 karakter');
    });

    it('should validate content length', async () => {
      const articleData = {
        judul: 'Test Article Title',
        konten: 'Short content', // too short
        kategori: testCategory,
        penulis: testUser._id
      };

      const article = new Article(articleData);
      
      await expect(article.save()).rejects.toThrow('Konten minimal 100 karakter');
    });

    it('should validate status enum', async () => {
      const articleData = {
        judul: 'Test Article Title',
        konten: 'This is a test article content with more than 100 characters to meet the minimum requirement.',
        kategori: testCategory,
        penulis: testUser._id,
        status: 'invalid_status'
      };

      const article = new Article(articleData);
      
      await expect(article.save()).rejects.toThrow();
    });
  });

  describe('Article Methods', () => {
    let article;

    beforeEach(async () => {
      const articleData = {
        judul: 'Test Article for Methods',
        konten: 'This is a test article content with more than 100 characters to meet the minimum requirement for article content validation.',
        ringkasan: 'Test summary',
        kategori: testCategory,
        penulis: testUser._id,
        tags: ['test', 'methods']
      };

      article = new Article(articleData);
      await article.save();
    });

    it('should increment views correctly', async () => {
      expect(article.metadata.views).toBe(0);
      
      await article.incrementViews('Indonesia', 'desktop', 'google');
      
      expect(article.metadata.views).toBe(1);
      expect(article.analytics.dailyViews).toHaveLength(1);
      expect(article.analytics.countries).toHaveLength(1);
      expect(article.analytics.devices).toHaveLength(1);
      expect(article.analytics.referrers).toHaveLength(1);
    });

    it('should increment engagement metrics', async () => {
      expect(article.metadata.likes).toBe(0);
      
      await article.incrementEngagement('likes');
      
      expect(article.metadata.likes).toBe(1);
    });

    it('should create new version', async () => {
      const originalVersion = article.version;
      const originalContent = article.konten;
      
      article.konten = 'Updated content with more than 100 characters to meet the minimum requirement for article content validation.';
      article.createVersion(testUser._id, 'Updated content');
      
      expect(article.version).toBe(originalVersion + 1);
      expect(article.previousVersions).toHaveLength(1);
      expect(article.previousVersions[0].konten).toBe(originalContent);
      expect(article.previousVersions[0].updatedBy.toString()).toBe(testUser._id.toString());
    });

    it('should publish article', async () => {
      expect(article.status).toBe('draft');
      expect(article.publishedAt).toBeNull();
      
      await article.publish();
      
      expect(article.status).toBe('published');
      expect(article.publishedAt).toBeDefined();
      expect(article.isPublished).toBe(true);
    });

    it('should schedule article', async () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // 1 day from now
      
      await article.schedule(futureDate);
      
      expect(article.status).toBe('scheduled');
      expect(article.scheduledAt).toBeDefined();
      expect(article.isScheduled).toBe(true);
    });

    it('should archive article', async () => {
      await article.archive();
      
      expect(article.status).toBe('archived');
    });
  });

  describe('Article Virtuals', () => {
    let article;

    beforeEach(async () => {
      const articleData = {
        judul: 'Test Article for Virtuals',
        konten: 'This is a test article content with more than 100 characters to meet the minimum requirement for article content validation.',
        kategori: testCategory,
        penulis: testUser._id
      };

      article = new Article(articleData);
      await article.save();
    });

    it('should generate correct URL', () => {
      expect(article.url).toBe(`/artikel/${article.slug}`);
    });

    it('should format reading time correctly', () => {
      article.metadata.readTime = 5;
      expect(article.readingTime).toBe('5 menit');
      
      article.metadata.readTime = 1;
      expect(article.readingTime).toBe('1 menit');
      
      article.metadata.readTime = 0.5;
      expect(article.readingTime).toBe('Kurang dari 1 menit');
    });

    it('should calculate engagement rate', () => {
      article.metadata.views = 100;
      article.metadata.likes = 10;
      article.metadata.shares = 5;
      article.metadata.comments = 5;
      
      expect(parseFloat(article.engagementRate)).toBe(20.00);
    });

    it('should determine published status', async () => {
      expect(article.isPublished).toBe(false);
      
      await article.publish();
      
      expect(article.isPublished).toBe(true);
    });
  });

  describe('Article Statics', () => {
    beforeEach(async () => {
      // Create test articles
      const articles = [
        {
          judul: 'Published Article 1',
          konten: 'This is published article content with more than 100 characters to meet the minimum requirement.',
          kategori: testCategory,
          penulis: testUser._id,
          status: 'published',
          publishedAt: new Date(),
          featured: true,
          metadata: { views: 100, likes: 10 }
        },
        {
          judul: 'Published Article 2',
          konten: 'This is another published article content with more than 100 characters to meet the minimum requirement.',
          kategori: testCategory,
          penulis: testUser._id,
          status: 'published',
          publishedAt: new Date(),
          premium: true,
          metadata: { views: 50, likes: 5 }
        },
        {
          judul: 'Draft Article',
          konten: 'This is draft article content with more than 100 characters to meet the minimum requirement.',
          kategori: testCategory,
          penulis: testUser._id,
          status: 'draft'
        }
      ];

      await Article.insertMany(articles);
    });

    it('should find published articles', async () => {
      const publishedArticles = await Article.findPublished();
      
      expect(publishedArticles).toHaveLength(2);
      publishedArticles.forEach(article => {
        expect(article.status).toBe('published');
      });
    });

    it('should find published articles with filters', async () => {
      const featuredArticles = await Article.findPublished({ featured: true });
      
      expect(featuredArticles).toHaveLength(1);
      expect(featuredArticles[0].featured).toBe(true);
    });

    it('should get article statistics', async () => {
      const stats = await Article.getStatistics();
      
      expect(stats.totalArticles).toBe(3);
      expect(stats.publishedArticles).toBe(2);
      expect(stats.draftArticles).toBe(1);
      expect(stats.featuredArticles).toBe(1);
      expect(stats.premiumArticles).toBe(1);
      expect(stats.totalViews).toBe(150);
      expect(stats.totalLikes).toBe(15);
    });

    it('should get trending articles', async () => {
      const trendingArticles = await Article.getTrending(7, 5);
      
      expect(trendingArticles).toHaveLength(2); // Only published articles
      // Should be sorted by trending score (views + likes*5 + shares*10 + comments*15)
      expect(trendingArticles[0].metadata.views).toBeGreaterThanOrEqual(trendingArticles[1].metadata.views);
    });
  });

  describe('Article Search', () => {
    beforeEach(async () => {
      const articles = [
        {
          judul: 'JavaScript Tutorial for Beginners',
          konten: 'Learn JavaScript programming language from scratch with this comprehensive tutorial for beginners.',
          kategori: testCategory,
          penulis: testUser._id,
          status: 'published',
          publishedAt: new Date(),
          tags: ['javascript', 'tutorial', 'programming']
        },
        {
          judul: 'Advanced React Concepts',
          konten: 'Explore advanced React concepts including hooks, context, and performance optimization techniques.',
          kategori: testCategory,
          penulis: testUser._id,
          status: 'published',
          publishedAt: new Date(),
          tags: ['react', 'javascript', 'frontend']
        }
      ];

      await Article.insertMany(articles);
    });

    it('should search articles by text', async () => {
      const results = await Article.searchArticles('JavaScript');
      
      expect(results).toHaveLength(2);
      // Results should be sorted by text score
      expect(results[0].judul).toContain('JavaScript');
    });

    it('should search articles with filters', async () => {
      const results = await Article.searchArticles('React', { penulis: testUser._id });
      
      expect(results).toHaveLength(1);
      expect(results[0].judul).toContain('React');
    });
  });
});