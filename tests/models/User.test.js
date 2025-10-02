const mongoose = require('mongoose');
const User = require('../../src/models/User');
const { MongoMemoryServer } = require('mongodb-memory-server');

describe('User Model', () => {
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
    await User.deleteMany({});
  });

  describe('User Creation', () => {
    it('should create a user with valid data', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'Password123',
        profile: {
          nama: 'Test User'
        }
      };

      const user = new User(userData);
      const savedUser = await user.save();

      expect(savedUser._id).toBeDefined();
      expect(savedUser.username).toBe('testuser');
      expect(savedUser.email).toBe('test@example.com');
      expect(savedUser.profile.nama).toBe('Test User');
      expect(savedUser.role).toBe('pembaca'); // default role
      expect(savedUser.subscription.plan).toBe('free'); // default plan
      expect(savedUser.isActive).toBe(true); // default active
      expect(savedUser.emailVerified).toBe(false); // default not verified
    });

    it('should hash password before saving', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'Password123',
        profile: {
          nama: 'Test User'
        }
      };

      const user = new User(userData);
      const savedUser = await user.save();

      expect(savedUser.password).not.toBe('Password123');
      expect(savedUser.password).toMatch(/^\$2[aby]\$\d+\$/); // bcrypt hash pattern
    });

    it('should generate referral code automatically', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'Password123',
        profile: {
          nama: 'Test User'
        }
      };

      const user = new User(userData);
      const savedUser = await user.save();

      expect(savedUser.referralCode).toBeDefined();
      expect(savedUser.referralCode).toMatch(/^testuser_[A-Z0-9]{6}$/);
    });
  });

  describe('User Validation', () => {
    it('should require username', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'Password123',
        profile: {
          nama: 'Test User'
        }
      };

      const user = new User(userData);
      
      await expect(user.save()).rejects.toThrow('Username wajib diisi');
    });

    it('should require email', async () => {
      const userData = {
        username: 'testuser',
        password: 'Password123',
        profile: {
          nama: 'Test User'
        }
      };

      const user = new User(userData);
      
      await expect(user.save()).rejects.toThrow('Email wajib diisi');
    });

    it('should require password', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        profile: {
          nama: 'Test User'
        }
      };

      const user = new User(userData);
      
      await expect(user.save()).rejects.toThrow('Password wajib diisi');
    });

    it('should validate email format', async () => {
      const userData = {
        username: 'testuser',
        email: 'invalid-email',
        password: 'Password123',
        profile: {
          nama: 'Test User'
        }
      };

      const user = new User(userData);
      
      await expect(user.save()).rejects.toThrow('Format email tidak valid');
    });

    it('should validate username format', async () => {
      const userData = {
        username: 'test user!', // invalid characters
        email: 'test@example.com',
        password: 'Password123',
        profile: {
          nama: 'Test User'
        }
      };

      const user = new User(userData);
      
      await expect(user.save()).rejects.toThrow('Username hanya boleh mengandung huruf, angka, dan underscore');
    });

    it('should validate password minimum length', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: '123', // too short
        profile: {
          nama: 'Test User'
        }
      };

      const user = new User(userData);
      
      await expect(user.save()).rejects.toThrow('Password minimal 6 karakter');
    });

    it('should enforce unique email', async () => {
      const userData1 = {
        username: 'testuser1',
        email: 'test@example.com',
        password: 'Password123',
        profile: {
          nama: 'Test User 1'
        }
      };

      const userData2 = {
        username: 'testuser2',
        email: 'test@example.com', // same email
        password: 'Password123',
        profile: {
          nama: 'Test User 2'
        }
      };

      const user1 = new User(userData1);
      await user1.save();

      const user2 = new User(userData2);
      await expect(user2.save()).rejects.toThrow();
    });

    it('should enforce unique username', async () => {
      const userData1 = {
        username: 'testuser',
        email: 'test1@example.com',
        password: 'Password123',
        profile: {
          nama: 'Test User 1'
        }
      };

      const userData2 = {
        username: 'testuser', // same username
        email: 'test2@example.com',
        password: 'Password123',
        profile: {
          nama: 'Test User 2'
        }
      };

      const user1 = new User(userData1);
      await user1.save();

      const user2 = new User(userData2);
      await expect(user2.save()).rejects.toThrow();
    });
  });

  describe('User Methods', () => {
    let user;

    beforeEach(async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'Password123',
        profile: {
          nama: 'Test User'
        }
      };

      user = new User(userData);
      await user.save();
    });

    it('should compare password correctly', async () => {
      const isMatch = await user.comparePassword('Password123');
      expect(isMatch).toBe(true);

      const isNotMatch = await user.comparePassword('WrongPassword');
      expect(isNotMatch).toBe(false);
    });

    it('should generate auth token', () => {
      const token = user.generateAuthToken();
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
    });

    it('should generate refresh token', () => {
      const refreshToken = user.generateRefreshToken();
      expect(refreshToken).toBeDefined();
      expect(typeof refreshToken).toBe('string');
    });

    it('should update stats correctly', async () => {
      await user.updateStats('articlesPublished', 5);
      await user.updateStats('totalViews', 100);

      const updatedUser = await User.findById(user._id);
      expect(updatedUser.stats.articlesPublished).toBe(5);
      expect(updatedUser.stats.totalViews).toBe(100);
    });

    it('should check feature access correctly', () => {
      // Free user should not have premium features
      expect(user.hasFeature('ai_content')).toBe(false);
      expect(user.hasFeature('social_posting')).toBe(false);

      // Update to premium
      user.subscription.plan = 'premium';
      expect(user.hasFeature('ai_content')).toBe(true);
      expect(user.hasFeature('social_posting')).toBe(true);
      expect(user.hasFeature('analytics')).toBe(false); // pro feature

      // Update to pro
      user.subscription.plan = 'pro';
      expect(user.hasFeature('analytics')).toBe(true);
      expect(user.hasFeature('unlimited_articles')).toBe(true);
    });

    it('should handle login attempts correctly', async () => {
      expect(user.loginAttempts).toBe(0);
      expect(user.isLocked).toBe(false);

      // Increment login attempts
      await user.incLoginAttempts();
      const updatedUser = await User.findById(user._id);
      expect(updatedUser.loginAttempts).toBe(1);
    });

    it('should reset login attempts correctly', async () => {
      user.loginAttempts = 3;
      await user.save();

      await user.resetLoginAttempts();
      const updatedUser = await User.findById(user._id);
      expect(updatedUser.loginAttempts).toBeUndefined();
      expect(updatedUser.lastLogin).toBeDefined();
    });
  });

  describe('User Statics', () => {
    beforeEach(async () => {
      // Create test users
      const users = [
        {
          username: 'user1',
          email: 'user1@example.com',
          password: 'Password123',
          profile: { nama: 'User 1' },
          isActive: true,
          emailVerified: true,
          subscription: { plan: 'free' }
        },
        {
          username: 'user2',
          email: 'user2@example.com',
          password: 'Password123',
          profile: { nama: 'User 2' },
          isActive: true,
          emailVerified: false,
          subscription: { plan: 'premium' }
        },
        {
          username: 'user3',
          email: 'user3@example.com',
          password: 'Password123',
          profile: { nama: 'User 3' },
          isActive: false,
          emailVerified: true,
          subscription: { plan: 'pro' }
        }
      ];

      await User.insertMany(users);
    });

    it('should find user by email or username', async () => {
      const userByEmail = await User.findByEmailOrUsername('user1@example.com');
      expect(userByEmail).toBeDefined();
      expect(userByEmail.username).toBe('user1');

      const userByUsername = await User.findByEmailOrUsername('user2');
      expect(userByUsername).toBeDefined();
      expect(userByUsername.email).toBe('user2@example.com');
    });

    it('should get user statistics', async () => {
      const stats = await User.getStatistics();
      
      expect(stats.totalUsers).toBe(3);
      expect(stats.activeUsers).toBe(2);
      expect(stats.inactiveUsers).toBe(1);
      expect(stats.verifiedUsers).toBe(2);
      expect(stats.premiumUsers).toBe(2); // premium + pro
      expect(stats.freeUsers).toBe(1);
    });

    it('should create user with validation', async () => {
      const userData = {
        username: 'newuser',
        email: 'newuser@example.com',
        password: 'Password123',
        profile: {
          nama: 'New User'
        }
      };

      const user = await User.createUser(userData);
      expect(user).toBeDefined();
      expect(user.username).toBe('newuser');
    });
  });

  describe('User Virtuals', () => {
    it('should calculate subscription status correctly', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'Password123',
        profile: {
          nama: 'Test User'
        }
      };

      const user = new User(userData);
      
      // Free plan
      expect(user.subscriptionStatus).toBe('free');

      // Active premium
      user.subscription.plan = 'premium';
      user.subscription.expiredAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
      expect(user.subscriptionStatus).toBe('active');

      // Expired premium
      user.subscription.expiredAt = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 day ago
      expect(user.subscriptionStatus).toBe('expired');
    });

    it('should calculate lock status correctly', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'Password123',
        profile: {
          nama: 'Test User'
        }
      };

      const user = new User(userData);
      
      // Not locked
      expect(user.isLocked).toBe(false);

      // Locked
      user.lockUntil = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
      expect(user.isLocked).toBe(true);

      // Lock expired
      user.lockUntil = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
      expect(user.isLocked).toBe(false);
    });
  });
});