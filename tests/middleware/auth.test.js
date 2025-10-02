const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../../src/models/User');
const JwtService = require('../../src/services/JwtService');
const {
  authenticate,
  optionalAuth,
  authorize,
  requireEmailVerification,
  requireFeature,
  requireOwnership,
  authGuard
} = require('../../src/middleware/auth');

describe('Authentication Middleware', () => {
  let app;
  let mongoServer;
  let testUser;
  let adminUser;
  let accessToken;
  let adminToken;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    // Create Express app for testing
    app = express();
    app.use(express.json());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await User.deleteMany({});

    // Create test users
    testUser = new User({
      username: 'testuser',
      email: 'test@example.com',
      password: 'Password123',
      profile: {
        nama: 'Test User'
      },
      emailVerified: true,
      subscription: {
        plan: 'premium'
      }
    });
    await testUser.save();

    adminUser = new User({
      username: 'admin',
      email: 'admin@example.com',
      password: 'Password123',
      profile: {
        nama: 'Admin User'
      },
      role: 'admin',
      emailVerified: true
    });
    await adminUser.save();

    // Generate tokens
    accessToken = JwtService.generateAccessToken(testUser);
    adminToken = JwtService.generateAccessToken(adminUser);
  });

  describe('authenticate middleware', () => {
    beforeEach(() => {
      app.get('/protected', authenticate, (req, res) => {
        res.json({
          success: true,
          user: {
            id: req.user._id,
            username: req.user.username
          }
        });
      });
    });

    it('should authenticate valid token', async () => {
      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user.username).toBe('testuser');
    });

    it('should reject request without token', async () => {
      const response = await request(app)
        .get('/protected');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NO_TOKEN');
    });

    it('should reject invalid token', async () => {
      const response = await request(app)
        .get('/protected')
        .set('Authorization', 'Bearer invalid_token');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });

    it('should reject token for inactive user', async () => {
      testUser.isActive = false;
      await testUser.save();

      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('USER_INACTIVE');
    });

    it('should reject token for locked user', async () => {
      testUser.lockUntil = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
      await testUser.save();

      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('ACCOUNT_LOCKED');
    });
  });

  describe('optionalAuth middleware', () => {
    beforeEach(() => {
      app.get('/optional', optionalAuth, (req, res) => {
        res.json({
          success: true,
          authenticated: !!req.user,
          user: req.user ? {
            id: req.user._id,
            username: req.user.username
          } : null
        });
      });
    });

    it('should work without token', async () => {
      const response = await request(app)
        .get('/optional');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.authenticated).toBe(false);
      expect(response.body.user).toBeNull();
    });

    it('should authenticate valid token', async () => {
      const response = await request(app)
        .get('/optional')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.authenticated).toBe(true);
      expect(response.body.user.username).toBe('testuser');
    });

    it('should ignore invalid token', async () => {
      const response = await request(app)
        .get('/optional')
        .set('Authorization', 'Bearer invalid_token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.authenticated).toBe(false);
      expect(response.body.user).toBeNull();
    });
  });

  describe('authorize middleware', () => {
    beforeEach(() => {
      app.get('/admin-only', authenticate, authorize('admin'), (req, res) => {
        res.json({ success: true, message: 'Admin access granted' });
      });

      app.get('/multi-role', authenticate, authorize(['admin', 'penulis']), (req, res) => {
        res.json({ success: true, message: 'Multi-role access granted' });
      });
    });

    it('should allow admin access to admin-only route', async () => {
      const response = await request(app)
        .get('/admin-only')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should deny non-admin access to admin-only route', async () => {
      const response = await request(app)
        .get('/admin-only')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    it('should allow admin access to multi-role route', async () => {
      const response = await request(app)
        .get('/multi-role')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should deny unauthorized role access', async () => {
      const response = await request(app)
        .get('/multi-role')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });
  });

  describe('requireEmailVerification middleware', () => {
    beforeEach(() => {
      app.get('/verified-only', authenticate, requireEmailVerification, (req, res) => {
        res.json({ success: true, message: 'Email verified access granted' });
      });
    });

    it('should allow access for verified user', async () => {
      const response = await request(app)
        .get('/verified-only')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should deny access for unverified user', async () => {
      testUser.emailVerified = false;
      await testUser.save();

      // Generate new token with updated user data
      const unverifiedToken = JwtService.generateAccessToken(testUser);

      const response = await request(app)
        .get('/verified-only')
        .set('Authorization', `Bearer ${unverifiedToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('EMAIL_NOT_VERIFIED');
    });
  });

  describe('requireFeature middleware', () => {
    beforeEach(() => {
      app.get('/premium-feature', authenticate, requireFeature('ai_content'), (req, res) => {
        res.json({ success: true, message: 'Premium feature access granted' });
      });
    });

    it('should allow access for user with feature', async () => {
      const response = await request(app)
        .get('/premium-feature')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should deny access for user without feature', async () => {
      testUser.subscription.plan = 'free';
      await testUser.save();

      // Generate new token with updated user data
      const freeToken = JwtService.generateAccessToken(testUser);

      const response = await request(app)
        .get('/premium-feature')
        .set('Authorization', `Bearer ${freeToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FEATURE_NOT_AVAILABLE');
    });

    it('should allow admin access regardless of subscription', async () => {
      const response = await request(app)
        .get('/premium-feature')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('requireOwnership middleware', () => {
    beforeEach(() => {
      app.get('/user/:userId/profile', authenticate, requireOwnership('userId'), (req, res) => {
        res.json({ success: true, message: 'Profile access granted' });
      });
    });

    it('should allow user to access own resource', async () => {
      const response = await request(app)
        .get(`/user/${testUser._id}/profile`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should deny user access to other user resource', async () => {
      const response = await request(app)
        .get(`/user/${adminUser._id}/profile`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('ACCESS_DENIED');
    });

    it('should allow admin to access any resource', async () => {
      const response = await request(app)
        .get(`/user/${testUser._id}/profile`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('authGuard middleware', () => {
    beforeEach(() => {
      app.get('/complex-auth', ...authGuard({
        roles: ['admin', 'penulis'],
        requireVerification: true,
        requireFeature: 'ai_content'
      }), (req, res) => {
        res.json({ success: true, message: 'Complex auth passed' });
      });

      app.get('/optional-auth', ...authGuard({
        optional: true
      }), (req, res) => {
        res.json({
          success: true,
          authenticated: !!req.user
        });
      });
    });

    it('should handle complex authentication requirements', async () => {
      // Update admin to have premium subscription
      adminUser.subscription.plan = 'premium';
      await adminUser.save();
      const newAdminToken = JwtService.generateAccessToken(adminUser);

      const response = await request(app)
        .get('/complex-auth')
        .set('Authorization', `Bearer ${newAdminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should handle optional authentication', async () => {
      const response = await request(app)
        .get('/optional-auth');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.authenticated).toBe(false);
    });

    it('should handle optional authentication with token', async () => {
      const response = await request(app)
        .get('/optional-auth')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.authenticated).toBe(true);
    });
  });
});