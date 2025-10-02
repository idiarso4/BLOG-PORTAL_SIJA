const request = require('supertest');
const app = require('../../server');
const User = require('../../src/models/User');
const Article = require('../../src/models/Article');
const Category = require('../../src/models/Category');
const jwt = require('jsonwebtoken');

describe('ArticleController', () => {
  let testUser;
  let authToken;
  let testCategory;

  beforeEach(async () => {
    // Create test user
    testUser = await User.create({
      username: 'testauthor',
      email: 'author@example.com',
      password: 'hashedpassword',
      profile: { nama: 'Test Author' },
      role: 'author',
      isActive: true
    });

    // Create auth token
    authToken = jwt.sign(
      { userId: testUser._id },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Create test category
    testCategory = await Category.create({
      nama: 'Test Category',
      slug: 'test-category',
      deskripsi: 'Test category description'
    });
  });

  describe('GET /api/blog/articles', () => {
    beforeEach(async () => {
      // Create test articles
      await Article.create([
        {
          judul: 'Published Article 1',
          slug: 'published-article-1',
          konten: 'Content of published article 1',
          author: testUser._id,
          kategori: testCategory._id,
          status: 'published',
          tags: ['test', 'article']
        },
        {
          judul: 'Published Article 2',
          slug: 'published-article-2',
          konten: 'Content of published article 2',
          author: testUser._id,
          kategori: testCategory._id,
          status: 'published',
          tags: ['test']
        },
        {
          judul: 'Draft Article',
          slug: 'draft-article',
          konten: 'Content of draft article',
          author: testUser._id,
          kategori: testCategory._id,
          status: 'draft'
        }
      ]);
    });

    it('should get published articles', async () => {
      const response = await request(app)
        .get('/api/blog/articles')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.articles).toHaveLength(2);
      expect(response.body.data.articles[0].status).toBe('published');
      expect(response.body.data.pagination).toBeDefined();
    });

    it('should filter articles by category', async () => {
      const response = await request(app)
        .get(`/api/blog/articles?category=${testCategory._id}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.articles).toHaveLength(2);
      response.body.data.articles.forEach(article => {
        expect(article.kategori._id).toBe(testCategory._id.toString());
      });
    });

    it('should filter articles by tag', async () => {
      const response = await request(app)
        .get('/api/blog/articles?tags=test')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.articles).toHaveLength(2);
    });

    it('should paginate articles', async () => {
      const response = await request(app)
        .get('/api/blog/articles?page=1&limit=1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.articles).toHaveLength(1);
      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.limit).toBe(1);
      expect(response.body.data.pagination.total).toBe(2);
    });

    it('should sort articles by date', async () => {
      const response = await request(app)
        .get('/api/blog/articles?sort=createdAt:asc')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.articles).toHaveLength(2);
      // First article should be older
      expect(new Date(response.body.data.articles[0].createdAt))
        .toBeLessThanOrEqual(new Date(response.body.data.articles[1].createdAt));
    });
  });

  describe('GET /api/blog/articles/:slug', () => {
    let testArticle;

    beforeEach(async () => {
      testArticle = await Article.create({
        judul: 'Test Article',
        slug: 'test-article',
        konten: 'This is test article content',
        ringkasan: 'Test article summary',
        author: testUser._id,
        kategori: testCategory._id,
        status: 'published',
        tags: ['test', 'article'],
        views: 0
      });
    });

    it('should get article by slug', async () => {
      const response = await request(app)
        .get('/api/blog/articles/test-article')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.article.judul).toBe('Test Article');
      expect(response.body.data.article.slug).toBe('test-article');
      expect(response.body.data.article.author.username).toBe(testUser.username);
      expect(response.body.data.article.kategori.nama).toBe(testCategory.nama);
    });

    it('should increment view count', async () => {
      await request(app)
        .get('/api/blog/articles/test-article')
        .expect(200);

      const updatedArticle = await Article.findById(testArticle._id);
      expect(updatedArticle.views).toBe(1);
    });

    it('should return 404 for non-existent article', async () => {
      const response = await request(app)
        .get('/api/blog/articles/non-existent-slug')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('ARTICLE_NOT_FOUND');
    });

    it('should return 404 for draft article (public access)', async () => {
      await Article.findByIdAndUpdate(testArticle._id, { status: 'draft' });

      const response = await request(app)
        .get('/api/blog/articles/test-article')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('ARTICLE_NOT_FOUND');
    });
  });

  describe('POST /api/blog/articles', () => {
    it('should create new article', async () => {
      const articleData = {
        judul: 'New Test Article',
        konten: 'This is new test article content',
        ringkasan: 'New test article summary',
        kategori: testCategory._id,
        tags: ['new', 'test'],
        status: 'published'
      };

      const response = await request(app)
        .post('/api/blog/articles')
        .set('Authorization', `Bearer ${authToken}`)
        .send(articleData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.article.judul).toBe(articleData.judul);
      expect(response.body.data.article.slug).toBe('new-test-article');
      expect(response.body.data.article.author).toBe(testUser._id.toString());

      // Verify article was created in database
      const article = await Article.findOne({ slug: 'new-test-article' });
      expect(article).toBeTruthy();
      expect(article.judul).toBe(articleData.judul);
    });

    it('should return validation error for missing required fields', async () => {
      const articleData = {
        konten: 'Content without title'
      };

      const response = await request(app)
        .post('/api/blog/articles')
        .set('Authorization', `Bearer ${authToken}`)
        .send(articleData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return error without authentication', async () => {
      const articleData = {
        judul: 'Unauthorized Article',
        konten: 'This should not be created'
      };

      const response = await request(app)
        .post('/api/blog/articles')
        .send(articleData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should generate unique slug for duplicate titles', async () => {
      // Create first article
      await Article.create({
        judul: 'Duplicate Title',
        slug: 'duplicate-title',
        konten: 'First article content',
        author: testUser._id,
        status: 'published'
      });

      const articleData = {
        judul: 'Duplicate Title',
        konten: 'Second article content',
        status: 'published'
      };

      const response = await request(app)
        .post('/api/blog/articles')
        .set('Authorization', `Bearer ${authToken}`)
        .send(articleData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.article.slug).toBe('duplicate-title-1');
    });
  });

  describe('PUT /api/blog/articles/:id', () => {
    let testArticle;

    beforeEach(async () => {
      testArticle = await Article.create({
        judul: 'Original Title',
        slug: 'original-title',
        konten: 'Original content',
        author: testUser._id,
        kategori: testCategory._id,
        status: 'draft'
      });
    });

    it('should update article by author', async () => {
      const updateData = {
        judul: 'Updated Title',
        konten: 'Updated content',
        status: 'published'
      };

      const response = await request(app)
        .put(`/api/blog/articles/${testArticle._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.article.judul).toBe(updateData.judul);
      expect(response.body.data.article.konten).toBe(updateData.konten);
      expect(response.body.data.article.status).toBe(updateData.status);

      // Verify article was updated in database
      const updatedArticle = await Article.findById(testArticle._id);
      expect(updatedArticle.judul).toBe(updateData.judul);
    });

    it('should return 404 for non-existent article', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      const response = await request(app)
        .put(`/api/blog/articles/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ judul: 'Updated Title' })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('ARTICLE_NOT_FOUND');
    });

    it('should return 403 for unauthorized user', async () => {
      // Create another user
      const otherUser = await User.create({
        username: 'otheruser',
        email: 'other@example.com',
        password: 'hashedpassword',
        profile: { nama: 'Other User' },
        isActive: true
      });

      const otherToken = jwt.sign(
        { userId: otherUser._id },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .put(`/api/blog/articles/${testArticle._id}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ judul: 'Unauthorized Update' })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('DELETE /api/blog/articles/:id', () => {
    let testArticle;

    beforeEach(async () => {
      testArticle = await Article.create({
        judul: 'Article to Delete',
        slug: 'article-to-delete',
        konten: 'This article will be deleted',
        author: testUser._id,
        status: 'draft'
      });
    });

    it('should delete article by author', async () => {
      const response = await request(app)
        .delete(`/api/blog/articles/${testArticle._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted');

      // Verify article was deleted from database
      const deletedArticle = await Article.findById(testArticle._id);
      expect(deletedArticle).toBeNull();
    });

    it('should return 404 for non-existent article', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      const response = await request(app)
        .delete(`/api/blog/articles/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('ARTICLE_NOT_FOUND');
    });

    it('should return 403 for unauthorized user', async () => {
      // Create another user
      const otherUser = await User.create({
        username: 'otheruser',
        email: 'other@example.com',
        password: 'hashedpassword',
        profile: { nama: 'Other User' },
        isActive: true
      });

      const otherToken = jwt.sign(
        { userId: otherUser._id },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .delete(`/api/blog/articles/${testArticle._id}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });
  });
});