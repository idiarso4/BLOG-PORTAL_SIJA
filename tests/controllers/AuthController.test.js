const request = require('supertest');
const app = require('../../server');
const User = require('../../src/models/User');
const jwt = require('jsonwebtoken');

describe('AuthController', () => {
  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'Password123!',
        confirmPassword: 'Password123!',
        profile: {
          nama: 'Test User'
        }
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.username).toBe(userData.username);
      expect(response.body.data.user.email).toBe(userData.email);
      expect(response.body.data.token).toBeDefined();

      // Verify user was created in database
      const user = await User.findOne({ email: userData.email });
      expect(user).toBeTruthy();
      expect(user.username).toBe(userData.username);
    });

    it('should return validation error for invalid email', async () => {
      const userData = {
        username: 'testuser',
        email: 'invalid-email',
        password: 'Password123!',
        confirmPassword: 'Password123!'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return error for duplicate username', async () => {
      // Create existing user
      await User.create({
        username: 'existinguser',
        email: 'existing@example.com',
        password: 'hashedpassword',
        profile: { nama: 'Existing User' }
      });

      const userData = {
        username: 'existinguser',
        email: 'new@example.com',
        password: 'Password123!',
        confirmPassword: 'Password123!'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('USERNAME_EXISTS');
    });

    it('should return error for password mismatch', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'Password123!',
        confirmPassword: 'DifferentPassword123!'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/auth/login', () => {
    let testUser;

    beforeEach(async () => {
      testUser = await User.create({
        username: 'testuser',
        email: 'test@example.com',
        password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // 'password'
        profile: { nama: 'Test User' },
        isActive: true,
        isEmailVerified: true
      });
    });

    it('should login with valid credentials', async () => {
      const loginData = {
        identifier: 'test@example.com',
        password: 'password'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(testUser.email);
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
    });

    it('should login with username', async () => {
      const loginData = {
        identifier: 'testuser',
        password: 'password'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.username).toBe(testUser.username);
    });

    it('should return error for invalid credentials', async () => {
      const loginData = {
        identifier: 'test@example.com',
        password: 'wrongpassword'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should return error for inactive user', async () => {
      await User.findByIdAndUpdate(testUser._id, { isActive: false });

      const loginData = {
        identifier: 'test@example.com',
        password: 'password'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('ACCOUNT_INACTIVE');
    });

    it('should return error for non-existent user', async () => {
      const loginData = {
        identifier: 'nonexistent@example.com',
        password: 'password'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('POST /api/auth/refresh', () => {
    let testUser;
    let refreshToken;

    beforeEach(async () => {
      testUser = await User.create({
        username: 'testuser',
        email: 'test@example.com',
        password: 'hashedpassword',
        profile: { nama: 'Test User' },
        isActive: true
      });

      refreshToken = jwt.sign(
        { userId: testUser._id, type: 'refresh' },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );
    });

    it('should refresh token successfully', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
    });

    it('should return error for invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_REFRESH_TOKEN');
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    let testUser;

    beforeEach(async () => {
      testUser = await User.create({
        username: 'testuser',
        email: 'test@example.com',
        password: 'hashedpassword',
        profile: { nama: 'Test User' },
        isActive: true
      });
    });

    it('should send password reset email', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'test@example.com' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('reset');

      // Verify reset token was set
      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser.resetPasswordToken).toBeDefined();
      expect(updatedUser.resetPasswordExpires).toBeDefined();
    });

    it('should return success even for non-existent email', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/auth/reset-password', () => {
    let testUser;
    let resetToken;

    beforeEach(async () => {
      resetToken = 'reset-token-123';
      testUser = await User.create({
        username: 'testuser',
        email: 'test@example.com',
        password: 'hashedpassword',
        profile: { nama: 'Test User' },
        isActive: true,
        resetPasswordToken: resetToken,
        resetPasswordExpires: new Date(Date.now() + 3600000) // 1 hour
      });
    });

    it('should reset password successfully', async () => {
      const newPassword = 'NewPassword123!';

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: resetToken,
          password: newPassword,
          confirmPassword: newPassword
        })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify password was changed and token was cleared
      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser.resetPasswordToken).toBeUndefined();
      expect(updatedUser.resetPasswordExpires).toBeUndefined();
    });

    it('should return error for expired token', async () => {
      await User.findByIdAndUpdate(testUser._id, {
        resetPasswordExpires: new Date(Date.now() - 3600000) // 1 hour ago
      });

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: resetToken,
          password: 'NewPassword123!',
          confirmPassword: 'NewPassword123!'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_OR_EXPIRED_TOKEN');
    });

    it('should return error for invalid token', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: 'invalid-token',
          password: 'NewPassword123!',
          confirmPassword: 'NewPassword123!'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_OR_EXPIRED_TOKEN');
    });
  });

  describe('POST /api/auth/logout', () => {
    let testUser;
    let authToken;

    beforeEach(async () => {
      testUser = await User.create({
        username: 'testuser',
        email: 'test@example.com',
        password: 'hashedpassword',
        profile: { nama: 'Test User' },
        isActive: true
      });

      authToken = jwt.sign(
        { userId: testUser._id },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );
    });

    it('should logout successfully', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('logout');
    });

    it('should return error without authentication', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });
});