// MongoDB initialization script for Docker
db = db.getSiblingDB('blog-platform');

// Create application user
db.createUser({
  user: 'blogapp',
  pwd: 'blogapp123',
  roles: [
    {
      role: 'readWrite',
      db: 'blog-platform'
    }
  ]
});

// Create indexes for better performance
db.users.createIndex({ username: 1 }, { unique: true });
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ 'profile.nama': 'text', username: 'text' });

db.articles.createIndex({ slug: 1 }, { unique: true });
db.articles.createIndex({ status: 1, createdAt: -1 });
db.articles.createIndex({ author: 1, status: 1 });
db.articles.createIndex({ kategori: 1, status: 1 });
db.articles.createIndex({ tags: 1 });
db.articles.createIndex({ 
  judul: 'text', 
  konten: 'text', 
  ringkasan: 'text',
  tags: 'text'
}, {
  weights: {
    judul: 10,
    ringkasan: 5,
    tags: 3,
    konten: 1
  }
});

db.categories.createIndex({ slug: 1 }, { unique: true });
db.categories.createIndex({ parent: 1 });
db.categories.createIndex({ nama: 'text', deskripsi: 'text' });

db.comments.createIndex({ article: 1, createdAt: -1 });
db.comments.createIndex({ author: 1 });
db.comments.createIndex({ parent: 1 });
db.comments.createIndex({ isApproved: 1 });

db.analytics.createIndex({ entityType: 1, entityId: 1, eventType: 1 });
db.analytics.createIndex({ userId: 1, createdAt: -1 });
db.analytics.createIndex({ createdAt: -1 });

db.subscriptions.createIndex({ slug: 1 }, { unique: true });
db.subscriptions.createIndex({ isActive: 1, sortOrder: 1 });

db.usersubscriptions.createIndex({ user: 1, status: 1 });
db.usersubscriptions.createIndex({ subscription: 1, status: 1 });
db.usersubscriptions.createIndex({ endDate: 1, status: 1 });
db.usersubscriptions.createIndex({ 'payment.transactionId': 1 });

print('Database initialized successfully with indexes');

// Insert default data
db.categories.insertMany([
  {
    nama: 'Teknologi',
    slug: 'teknologi',
    deskripsi: 'Artikel tentang teknologi dan inovasi terbaru',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    nama: 'Lifestyle',
    slug: 'lifestyle',
    deskripsi: 'Tips dan trik untuk gaya hidup yang lebih baik',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    nama: 'Bisnis',
    slug: 'bisnis',
    deskripsi: 'Strategi dan insight dunia bisnis',
    createdAt: new Date(),
    updatedAt: new Date()
  }
]);

print('Default categories inserted');

// Create admin user
const adminUser = {
  username: 'admin',
  email: 'admin@blogplatform.com',
  password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // password
  role: 'admin',
  profile: {
    nama: 'Administrator',
    bio: 'Platform Administrator'
  },
  isActive: true,
  isEmailVerified: true,
  createdAt: new Date(),
  updatedAt: new Date()
};

db.users.insertOne(adminUser);
print('Admin user created: admin@blogplatform.com / password');