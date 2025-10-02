const mongoose = require('mongoose');
const Category = require('../../src/models/Category');
const { MongoMemoryServer } = require('mongodb-memory-server');

describe('Category Model', () => {
  let mongoServer;

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
    await Category.deleteMany({});
  });

  describe('Category Creation', () => {
    it('should create a category with valid data', async () => {
      const categoryData = {
        nama: 'Teknologi',
        deskripsi: 'Artikel tentang teknologi terbaru',
        icon: 'fas fa-laptop',
        color: '#007bff'
      };

      const category = new Category(categoryData);
      const savedCategory = await category.save();

      expect(savedCategory._id).toBeDefined();
      expect(savedCategory.nama).toBe('Teknologi');
      expect(savedCategory.slug).toBe('teknologi');
      expect(savedCategory.deskripsi).toBe('Artikel tentang teknologi terbaru');
      expect(savedCategory.isActive).toBe(true); // default active
      expect(savedCategory.sortOrder).toBe(0); // default sort order
      expect(savedCategory.parent).toBeNull(); // default no parent
    });

    it('should auto-generate slug from nama', async () => {
      const categoryData = {
        nama: 'Teknologi & Inovasi'
      };

      const category = new Category(categoryData);
      const savedCategory = await category.save();

      expect(savedCategory.slug).toBe('teknologi-inovasi');
    });

    it('should generate SEO fields automatically', async () => {
      const categoryData = {
        nama: 'Teknologi',
        deskripsi: 'Artikel tentang teknologi terbaru'
      };

      const category = new Category(categoryData);
      const savedCategory = await category.save();

      expect(savedCategory.seo.metaTitle).toBe('Teknologi - Blog Express');
      expect(savedCategory.seo.metaDescription).toBe('Artikel tentang teknologi terbaru');
    });
  });

  describe('Category Validation', () => {
    it('should require nama', async () => {
      const categoryData = {
        deskripsi: 'Test description'
      };

      const category = new Category(categoryData);
      
      await expect(category.save()).rejects.toThrow('Nama kategori wajib diisi');
    });

    it('should validate nama length', async () => {
      const categoryData = {
        nama: 'A' // too short
      };

      const category = new Category(categoryData);
      
      await expect(category.save()).rejects.toThrow('Nama kategori minimal 2 karakter');
    });

    it('should validate color format', async () => {
      const categoryData = {
        nama: 'Test Category',
        color: 'invalid-color'
      };

      const category = new Category(categoryData);
      
      await expect(category.save()).rejects.toThrow('Format warna harus hex color');
    });

    it('should enforce unique slug', async () => {
      const categoryData1 = {
        nama: 'Teknologi'
      };

      const categoryData2 = {
        nama: 'Teknologi' // same name, will generate same slug
      };

      const category1 = new Category(categoryData1);
      await category1.save();

      const category2 = new Category(categoryData2);
      await expect(category2.save()).rejects.toThrow();
    });
  });

  describe('Category Hierarchy', () => {
    let parentCategory;

    beforeEach(async () => {
      parentCategory = new Category({
        nama: 'Parent Category',
        deskripsi: 'This is a parent category'
      });
      await parentCategory.save();
    });

    it('should create child category', async () => {
      const childData = {
        nama: 'Child Category',
        parent: parentCategory._id
      };

      const child = new Category(childData);
      const savedChild = await child.save();

      expect(savedChild.parent.toString()).toBe(parentCategory._id.toString());
    });

    it('should prevent circular reference', async () => {
      const childData = {
        nama: 'Child Category',
        parent: parentCategory._id
      };

      const child = new Category(childData);
      await child.save();

      // Try to make parent a child of child (circular reference)
      parentCategory.parent = child._id;
      
      await expect(parentCategory.save()).rejects.toThrow('Circular reference terdeteksi');
    });

    it('should prevent self-reference', async () => {
      parentCategory.parent = parentCategory._id;
      
      await expect(parentCategory.save()).rejects.toThrow('Category tidak boleh menjadi parent dari dirinya sendiri');
    });

    it('should validate parent exists', async () => {
      const invalidParentId = new mongoose.Types.ObjectId();
      
      const childData = {
        nama: 'Child Category',
        parent: invalidParentId
      };

      const child = new Category(childData);
      
      await expect(child.save()).rejects.toThrow('Parent category tidak ditemukan');
    });
  });

  describe('Category Methods', () => {
    let category;

    beforeEach(async () => {
      category = new Category({
        nama: 'Test Category',
        deskripsi: 'Test description'
      });
      await category.save();
    });

    it('should get full path', async () => {
      const parent = new Category({
        nama: 'Parent',
        deskripsi: 'Parent category'
      });
      await parent.save();

      const child = new Category({
        nama: 'Child',
        parent: parent._id
      });
      await child.save();

      const fullPath = await child.getFullPath();
      
      expect(fullPath).toHaveLength(2);
      expect(fullPath[0].nama).toBe('Parent');
      expect(fullPath[1].nama).toBe('Child');
    });

    it('should get children categories', async () => {
      const child1 = new Category({
        nama: 'Child 1',
        parent: category._id
      });
      await child1.save();

      const child2 = new Category({
        nama: 'Child 2',
        parent: category._id
      });
      await child2.save();

      const children = await category.getChildren();
      
      expect(children).toHaveLength(2);
      expect(children.map(c => c.nama)).toContain('Child 1');
      expect(children.map(c => c.nama)).toContain('Child 2');
    });

    it('should get descendants recursively', async () => {
      const child = new Category({
        nama: 'Child',
        parent: category._id
      });
      await child.save();

      const grandchild = new Category({
        nama: 'Grandchild',
        parent: child._id
      });
      await grandchild.save();

      const descendants = await category.getDescendants();
      
      expect(descendants).toHaveLength(2);
      expect(descendants.map(c => c.nama)).toContain('Child');
      expect(descendants.map(c => c.nama)).toContain('Grandchild');
    });

    it('should update statistics', async () => {
      await category.updateStats({
        articleCount: 5,
        totalViews: 100,
        lastArticleAt: true
      });

      const updatedCategory = await Category.findById(category._id);
      expect(updatedCategory.stats.articleCount).toBe(5);
      expect(updatedCategory.stats.totalViews).toBe(100);
      expect(updatedCategory.stats.lastArticleAt).toBeDefined();
    });
  });

  describe('Category Virtuals', () => {
    let category;

    beforeEach(async () => {
      category = new Category({
        nama: 'Test Category'
      });
      await category.save();
    });

    it('should generate correct URL', () => {
      expect(category.url).toBe(`/kategori/${category.slug}`);
    });
  });

  describe('Category Statics', () => {
    beforeEach(async () => {
      // Create test categories
      const categories = [
        {
          nama: 'Root 1',
          isActive: true,
          sortOrder: 1,
          stats: { articleCount: 10, totalViews: 100 }
        },
        {
          nama: 'Root 2',
          isActive: true,
          sortOrder: 2,
          stats: { articleCount: 5, totalViews: 50 }
        },
        {
          nama: 'Inactive Root',
          isActive: false,
          stats: { articleCount: 2, totalViews: 20 }
        }
      ];

      const savedCategories = await Category.insertMany(categories);

      // Create child category
      await Category.create({
        nama: 'Child of Root 1',
        parent: savedCategories[0]._id,
        isActive: true,
        stats: { articleCount: 3, totalViews: 30 }
      });
    });

    it('should get root categories', async () => {
      const rootCategories = await Category.getRootCategories();
      
      expect(rootCategories).toHaveLength(2); // Only active root categories
      expect(rootCategories[0].nama).toBe('Root 1'); // Sorted by sortOrder
    });

    it('should get category tree', async () => {
      const tree = await Category.getCategoryTree();
      
      expect(tree).toHaveLength(2); // Only active root categories
      expect(tree[0].children).toHaveLength(1); // Root 1 has 1 child
      expect(tree[0].children[0].nama).toBe('Child of Root 1');
    });

    it('should get popular categories', async () => {
      const popular = await Category.getPopularCategories(5);
      
      expect(popular).toHaveLength(3); // All active categories
      expect(popular[0].stats.articleCount).toBeGreaterThanOrEqual(popular[1].stats.articleCount);
    });

    it('should search categories', async () => {
      const results = await Category.searchCategories('Root');
      
      expect(results).toHaveLength(2); // Only active categories matching search
      expect(results.every(cat => cat.nama.includes('Root'))).toBe(true);
    });

    it('should get category statistics', async () => {
      const stats = await Category.getStatistics();
      
      expect(stats.totalCategories).toBe(4);
      expect(stats.activeCategories).toBe(3);
      expect(stats.rootCategories).toBe(3); // Including inactive
      expect(stats.totalArticles).toBe(20); // Sum of all articleCount
      expect(stats.totalViews).toBe(200); // Sum of all totalViews
    });

    it('should create category with validation', async () => {
      const categoryData = {
        nama: 'New Category',
        deskripsi: 'New category description'
      };

      const category = await Category.createCategory(categoryData);
      expect(category).toBeDefined();
      expect(category.nama).toBe('New Category');
    });
  });
});