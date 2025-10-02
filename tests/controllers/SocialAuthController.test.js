const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../../src/models/User');
const JwtService = require('../../src/services/JwtService');
const SocialAuthController = require('../../src/controllers/SocialAuthController');
const socialAuthRoutes = require('../../src/routes/social-auth');

// Mock axios for external API calls
jest.mock('axios');
const axios = require('axios');

describe('Social Auth Controller', () => {
  let app;
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    // Create Express app for testing
    app = express();
    app.use(express.json());
    app.use('/api/auth/social', socialAuthRoutes);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await User.deleteMany({});
    jest.clearAllMocks();
  });

  describe('POST /api/auth/social/google', () => {
    const mockGoogleUser = {
      sub: 'google123',
      email: 'test@gmail.com',
      name: 'Test User',
      picture: 'https://example.com/photo.jpg',
      email_verified: true,
      aud: process.env.GOOGLE_CLIENT_ID
    };

    it('should login with valid Google token (new user)', async () => {
      // Mock Google token verification
      axios.get.mockResolvedValue({
        data: mockGoogleUser
      });

      const response = await request(app)
        .post('/api/auth/social/google')
        .send({
          token: 'valid_google_token'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe('test@gmail.com');
      expect(response.body.data.tokens).toBeDefined();
      expect(response.body.data.isNewUser).toBe(true);

      // Verify user was created
      const user = await User.findOne({ email: 'test@gmail.com' });
      expect(user).toBeDefined();
      expect(user.socialAccounts.google.id).toBe('google123');
    });

    it('should login with existing Google user', async () => {
      // Create existing user with Google account
      const existingUser = await User.createUser({
        username: 'testuser',
        email: 'test@gmail.com',
        password: 'Password123',
        profile: { nama: 'Test User' },
        socialAccounts: {
          google: {
            id: 'google123',
            email: 'test@gmail.com',
            name: 'Test User',
            linkedAt: new Date()
          }
        }
      });

      axios.get.mockResolvedValue({
        data: mockGoogleUser
      });

      const response = await request(app)
        .post('/api/auth/social/google')
        .send({
          token: 'valid_google_token'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.id).toBe(existingUser._id.toString());
      expect(response.body.data.isNewUser).toBe(false);
    });

    it('should link Google account to existing email user', async () => {
      // Create existing user without Google account
      await User.createUser({
        username: 'testuser',
        email: 'test@gmail.com',
        password: 'Password123',
        profile: { nama: 'Test User' }
      });

      axios.get.mockResolvedValue({
        data: mockGoogleUser
      });

      const response = await request(app)
        .post('/api/auth/social/google')
        .send({
          token: 'valid_google_token'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.isNewUser).toBe(false);

      // Verify Google account was linked
      const user = await User.findOne({ email: 'test@gmail.com' });
      expect(user.socialAccounts.google.id).toBe('google123');
    });

    it('should reject invalid Google token', async () => {
      axios.get.mockRejectedValue(new Error('Invalid token'));

      const response = await request(app)
        .post('/api/auth/social/google')
        .send({
          token: 'invalid_token'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_GOOGLE_TOKEN');
    });

    it('should reject request without token', async () => {
      const response = await request(app)
        .post('/api/auth/social/google')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });
  });

  describe('POST /api/auth/social/facebook', () => {
    const mockFacebookUser = {
      id: 'facebook123',
      email: 'test@facebook.com',
      name: 'Test User',
      picture: {
        data: {
          url: 'https://example.com/photo.jpg'
        }
      }
    };

    it('should login with valid Facebook token (new user)', async () => {
      axios.get.mockResolvedValue({
        data: mockFacebookUser
      });

      const response = await request(app)
        .post('/api/auth/social/facebook')
        .send({
          accessToken: 'valid_facebook_token'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe('test@facebook.com');
      expect(response.body.data.tokens).toBeDefined();
      expect(response.body.data.isNewUser).toBe(true);

      // Verify user was created
      const user = await User.findOne({ email: 'test@facebook.com' });
      expect(user).toBeDefined();
      expect(user.socialAccounts.facebook.id).toBe('facebook123');
    });

    it('should login with existing Facebook user', async () => {
      // Create existing user with Facebook account
      const existingUser = await User.createUser({
        username: 'testuser',
        email: 'test@facebook.com',
        password: 'Password123',
        profile: { nama: 'Test User' },
        socialAccounts: {
          facebook: {
            id: 'facebook123',
            email: 'test@facebook.com',
            name: 'Test User',
            linkedAt: new Date()
          }
        }
      });

      axios.get.mockResolvedValue({
        data: mockFacebookUser
      });

      const response = await request(app)
        .post('/api/auth/social/facebook')
        .send({
          accessToken: 'valid_facebook_token'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.id).toBe(existingUser._id.toString());
      expect(response.body.data.isNewUser).toBe(false);
    });

    it('should reject invalid Facebook token', async () => {
      axios.get.mockRejectedValue(new Error('Invalid token'));

      const response = await request(app)
        .post('/api/auth/social/facebook')
        .send({
          accessToken: 'invalid_token'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_FACEBOOK_TOKEN');
    });
  });

  describe('POST /api/auth/social/link', () => {
    let testUser;
    let accessToken;

    beforeEach(async () => {
      testUser = await User.createUser({
        username: 'testuser',
        email: 'test@example.com',
        password: 'Password123',
        profile: { nama: 'Test User' }
      });

      accessToken = JwtService.generateAccessToken(testUser);
    });

    it('should link Google account to authenticated user', async () => {
      const mockGoogleUser = {
        sub: 'google123',
        email: 'test@gmail.com',
        name: 'Test User',
        picture: 'https://example.com/photo.jpg',
        aud: process.env.GOOGLE_CLIENT_ID
      };

      axios.get.mockResolvedValue({
        data: mockGoogleUser
      });

      const response = await request(app)
        .post('/api/auth/social/link')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          provider: 'google',
          token: 'valid_google_token'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('google');

      // Verify account was linked
      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser.socialAccounts.google.id).toBe('google123');
    });

    it('should reject linking already linked account', async () => {
      // Create another user with the same Google account
      await User.createUser({
        username: 'anotheruser',
        email: 'another@example.com',
        password: 'Password123',
        profile: { nama: 'Another User' },
        socialAccounts: {
          google: {
            id: 'google123',
            email: 'test@gmail.com',
            name: 'Test User',
            linkedAt: new Date()
          }
        }
      });

      const mockGoogleUser = {
        sub: 'google123',
        email: 'test@gmail.com',
        name: 'Test User',
        picture: 'https://example.com/photo.jpg',
        aud: process.env.GOOGLE_CLIENT_ID
      };

      axios.get.mockResolvedValue({
        data: mockGoogleUser
      });

      const response = await request(app)
        .post('/api/auth/social/link')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          provider: 'google',
          token: 'valid_google_token'
        });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('ACCOUNT_ALREADY_LINKED');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/auth/social/link')
        .send({
          provider: 'google',
          token: 'valid_google_token'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NO_TOKEN');
    });
  });

  describe('DELETE /api/auth/social/unlink/:provider', () => {
    let testUser;
    let accessToken;

    beforeEach(async () => {
      testUser = await User.createUser({
        username: 'testuser',
        email: 'test@example.com',
        password: 'Password123',
        profile: { nama: 'Test User' },
        socialAccounts: {
          google: {
            id: 'google123',
            email: 'test@gmail.com',
            name: 'Test User',
            linkedAt: new Date()
          }
        }
      });

      accessToken = JwtService.generateAccessToken(testUser);
    });

    it('should unlink social account', async () => {
      const response = await request(app)
        .delete('/api/auth/social/unlink/google')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('google');

      // Verify account was unlinked
      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser.socialAccounts.google).toBeUndefined();
    });

    it('should reject unlinking when no password set', async () => {
      // Create user without password (social-only user)
      const socialUser = await User.createUser({
        username: 'socialuser',
        email: 'social@example.com',
        password: 'TempPassword123', // This will be hashed
        profile: { nama: 'Social User' },
        socialAccounts: {
          google: {
            id: 'google456',
            email: 'social@gmail.com',
            name: 'Social User',
            linkedAt: new Date()
          }
        }
      });

      // Remove password to simulate social-only user
      await User.findByIdAndUpdate(socialUser._id, {
        $unset: { password: 1 }
      });

      const socialAccessToken = JwtService.generateAccessToken(socialUser);

      const response = await request(app)
        .delete('/api/auth/social/unlink/google')
        .set('Authorization', `Bearer ${socialAccessToken}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NO_PASSWORD_SET');
    });

    it('should reject unsupported provider', async () => {
      const response = await request(app)
        .delete('/api/auth/social/unlink/unsupported')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNSUPPORTED_PROVIDER');
    });
  });

  describe('GET /api/auth/social/urls', () => {
    it('should return social login URLs', async () => {
      const response = await request(app)
        .get('/api/auth/social/urls');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.urls).toBeDefined();
      expect(response.body.data.urls.google).toContain('accounts.google.com');
      expect(response.body.data.urls.facebook).toContain('facebook.com');
    });
  });

  describe('Helper Methods', () => {
    describe('generateUniqueUsername', () => {
      it('should generate username from name', async () => {
        const username = await SocialAuthController.generateUniqueUsername('John Doe', null);
        expect(username).toBe('johndoe');
      });

      it('should generate username from email', async () => {
        const username = await SocialAuthController.generateUniqueUsername(null, 'test@example.com');
        expect(username).toBe('test');
      });

      it('should handle duplicate usernames', async () => {
        // Create existing user
        await User.createUser({
          username: 'johndoe',
          email: 'existing@example.com',
          password: 'Password123',
          profile: { nama: 'Existing User' }
        });

        const username = await SocialAuthController.generateUniqueUsername('John Doe', null);
        expect(username).toBe('johndoe1');
      });

      it('should handle short names', async () => {
        const username = await SocialAuthController.generateUniqueUsername('Jo', null);
        expect(username).toBe('userjo');
      });

      it('should fallback to user when no name or email', async () => {
        const username = await SocialAuthController.generateUniqueUsername(null, null);
        expect(username).toBe('user');
      });
    });
  });
});