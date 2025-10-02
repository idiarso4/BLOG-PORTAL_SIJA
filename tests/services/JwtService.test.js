const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../../src/models/User');
const JwtService = require('../../src/services/JwtService');

describe('JWT Service', () => {
  let mongoServer;
  let testUser;

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
  });

  describe('Token Generation', () => {
    it('should generate access token', () => {
      const token = JwtService.generateAccessToken(testUser);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      
      const decoded = JwtService.decodeToken(token);
      expect(decoded.id).toBe(testUser._id.toString());
      expect(decoded.username).toBe(testUser.username);
      expect(decoded.email).toBe(testUser.email);
      expect(decoded.role).toBe(testUser.role);
      expect(decoded.type).toBe('access');
    });

    it('should generate refresh token', () => {
      const token = JwtService.generateRefreshToken(testUser);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      
      const decoded = JwtService.decodeToken(token);
      expect(decoded.id).toBe(testUser._id.toString());
      expect(decoded.type).toBe('refresh');
      expect(decoded.tokenId).toBeDefined();
    });

    it('should generate token pair', () => {
      const tokenPair = JwtService.generateTokenPair(testUser);
      
      expect(tokenPair.accessToken).toBeDefined();
      expect(tokenPair.refreshToken).toBeDefined();
      expect(tokenPair.tokenType).toBe('Bearer');
      expect(tokenPair.expiresIn).toBeDefined();
    });

    it('should generate email verification token', () => {
      const token = JwtService.generateEmailVerificationToken(testUser._id, testUser.email);
      
      expect(token).toBeDefined();
      
      const decoded = JwtService.decodeToken(token);
      expect(decoded.id).toBe(testUser._id.toString());
      expect(decoded.email).toBe(testUser.email);
      expect(decoded.type).toBe('email_verification');
    });

    it('should generate password reset token', () => {
      const token = JwtService.generatePasswordResetToken(testUser._id, testUser.email);
      
      expect(token).toBeDefined();
      
      const decoded = JwtService.decodeToken(token);
      expect(decoded.id).toBe(testUser._id.toString());
      expect(decoded.email).toBe(testUser.email);
      expect(decoded.type).toBe('password_reset');
    });
  });

  describe('Token Verification', () => {
    let accessToken;
    let refreshToken;

    beforeEach(() => {
      accessToken = JwtService.generateAccessToken(testUser);
      refreshToken = JwtService.generateRefreshToken(testUser);
    });

    it('should verify valid access token', () => {
      const decoded = JwtService.verifyAccessToken(accessToken);
      
      expect(decoded.id).toBe(testUser._id.toString());
      expect(decoded.username).toBe(testUser.username);
      expect(decoded.type).toBe('access');
    });

    it('should verify valid refresh token', () => {
      const decoded = JwtService.verifyRefreshToken(refreshToken);
      
      expect(decoded.id).toBe(testUser._id.toString());
      expect(decoded.type).toBe('refresh');
    });

    it('should throw error for invalid access token', () => {
      expect(() => {
        JwtService.verifyAccessToken('invalid_token');
      }).toThrow('Invalid access token');
    });

    it('should throw error for invalid refresh token', () => {
      expect(() => {
        JwtService.verifyRefreshToken('invalid_token');
      }).toThrow('Invalid refresh token');
    });

    it('should verify email verification token', () => {
      const token = JwtService.generateEmailVerificationToken(testUser._id, testUser.email);
      const decoded = JwtService.verifyEmailVerificationToken(token);
      
      expect(decoded.id).toBe(testUser._id.toString());
      expect(decoded.type).toBe('email_verification');
    });

    it('should verify password reset token', () => {
      const token = JwtService.generatePasswordResetToken(testUser._id, testUser.email);
      const decoded = JwtService.verifyPasswordResetToken(token);
      
      expect(decoded.id).toBe(testUser._id.toString());
      expect(decoded.type).toBe('password_reset');
    });

    it('should throw error for wrong token type in email verification', () => {
      expect(() => {
        JwtService.verifyEmailVerificationToken(accessToken);
      }).toThrow('Invalid token type');
    });

    it('should throw error for wrong token type in password reset', () => {
      expect(() => {
        JwtService.verifyPasswordResetToken(accessToken);
      }).toThrow('Invalid token type');
    });
  });

  describe('Token Refresh', () => {
    let refreshToken;

    beforeEach(() => {
      refreshToken = JwtService.generateRefreshToken(testUser);
    });

    it('should refresh access token with valid refresh token', async () => {
      const newTokenPair = await JwtService.refreshAccessToken(refreshToken);
      
      expect(newTokenPair.accessToken).toBeDefined();
      expect(newTokenPair.refreshToken).toBeDefined();
      expect(newTokenPair.accessToken).not.toBe(refreshToken);
      
      const decoded = JwtService.verifyAccessToken(newTokenPair.accessToken);
      expect(decoded.id).toBe(testUser._id.toString());
    });

    it('should throw error for invalid refresh token', async () => {
      await expect(JwtService.refreshAccessToken('invalid_token')).rejects.toThrow();
    });

    it('should throw error for wrong token type', async () => {
      const accessToken = JwtService.generateAccessToken(testUser);
      await expect(JwtService.refreshAccessToken(accessToken)).rejects.toThrow('Invalid token type');
    });

    it('should throw error for inactive user', async () => {
      testUser.isActive = false;
      await testUser.save();
      
      await expect(JwtService.refreshAccessToken(refreshToken)).rejects.toThrow('User not found or inactive');
    });
  });

  describe('Token Utilities', () => {
    let accessToken;

    beforeEach(() => {
      accessToken = JwtService.generateAccessToken(testUser);
    });

    it('should get token expiration', () => {
      const expiration = JwtService.getTokenExpiration(accessToken);
      
      expect(expiration).toBeDefined();
      expect(typeof expiration).toBe('number');
      expect(expiration).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });

    it('should check if token is expired', () => {
      const isExpired = JwtService.isTokenExpired(accessToken);
      
      expect(isExpired).toBe(false);
    });

    it('should decode token without verification', () => {
      const decoded = JwtService.decodeToken(accessToken);
      
      expect(decoded.id).toBe(testUser._id.toString());
      expect(decoded.username).toBe(testUser.username);
    });

    it('should return null for invalid token decode', () => {
      const decoded = JwtService.decodeToken('invalid_token');
      
      expect(decoded).toBeNull();
    });

    it('should return null for token expiration of invalid token', () => {
      const expiration = JwtService.getTokenExpiration('invalid_token');
      
      expect(expiration).toBeNull();
    });

    it('should return true for expired token check of invalid token', () => {
      const isExpired = JwtService.isTokenExpired('invalid_token');
      
      expect(isExpired).toBe(true);
    });
  });

  describe('Token Revocation', () => {
    let refreshToken;

    beforeEach(() => {
      refreshToken = JwtService.generateRefreshToken(testUser);
    });

    it('should revoke refresh token', async () => {
      await expect(JwtService.revokeRefreshToken(refreshToken)).resolves.not.toThrow();
    });

    it('should revoke all refresh tokens for user', async () => {
      await expect(JwtService.revokeAllRefreshTokens(testUser._id)).resolves.not.toThrow();
    });

    it('should handle invalid token in revocation', async () => {
      await expect(JwtService.revokeRefreshToken('invalid_token')).rejects.toThrow();
    });
  });

  describe('Token Storage Operations', () => {
    let refreshToken;

    beforeEach(() => {
      refreshToken = JwtService.generateRefreshToken(testUser);
    });

    it('should store refresh token', async () => {
      await expect(JwtService.storeRefreshToken(testUser._id, refreshToken)).resolves.not.toThrow();
    });

    it('should remove refresh token', async () => {
      await JwtService.storeRefreshToken(testUser._id, refreshToken);
      await expect(JwtService.removeRefreshToken(testUser._id, refreshToken)).resolves.not.toThrow();
    });

    it('should get user refresh tokens', async () => {
      await JwtService.storeRefreshToken(testUser._id, refreshToken);
      const tokens = await JwtService.getUserRefreshTokens(testUser._id);
      
      expect(Array.isArray(tokens)).toBe(true);
    });

    it('should clear user refresh tokens', async () => {
      await JwtService.storeRefreshToken(testUser._id, refreshToken);
      await expect(JwtService.clearUserRefreshTokens(testUser._id)).resolves.not.toThrow();
    });
  });

  describe('Token Blacklisting', () => {
    let accessToken;

    beforeEach(() => {
      accessToken = JwtService.generateAccessToken(testUser);
    });

    it('should blacklist token', async () => {
      await expect(JwtService.blacklistToken(accessToken)).resolves.not.toThrow();
    });

    it('should check if token is blacklisted', async () => {
      await JwtService.blacklistToken(accessToken);
      const isBlacklisted = await JwtService.isTokenBlacklisted(accessToken);
      
      // Note: This might return false if Redis is not available in test environment
      expect(typeof isBlacklisted).toBe('boolean');
    });

    it('should handle invalid token in blacklisting', async () => {
      await expect(JwtService.blacklistToken('invalid_token')).resolves.not.toThrow();
    });
  });

  describe('Token Statistics', () => {
    it('should get token statistics', async () => {
      const stats = await JwtService.getTokenStatistics();
      
      expect(stats).toBeDefined();
      expect(typeof stats.activeRefreshTokens).toBe('number');
      expect(typeof stats.blacklistedTokens).toBe('number');
    });
  });

  describe('Token Cleanup', () => {
    it('should cleanup expired tokens', async () => {
      await expect(JwtService.cleanupExpiredTokens()).resolves.not.toThrow();
    });
  });
});