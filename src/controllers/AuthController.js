const User = require('../models/User');
const JwtService = require('../services/JwtService');
const EmailService = require('../services/EmailService');
const AuthUtils = require('../utils/auth');
const { validationResult } = require('express-validator');
const logger = require('../config/logger');
const crypto = require('crypto');

/**
 * Authentication Controller
 */
class AuthController {
  
  /**
   * Register new user
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async register(req, res) {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Data registrasi tidak valid',
            details: errors.array()
          }
        });
      }
      
      const { username, email, password, profile, referralCode } = req.body;
      
      // Check if user already exists
      const existingUser = await User.findByEmailOrUsername(email);
      if (existingUser) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'USER_EXISTS',
            message: existingUser.email === email.toLowerCase() 
              ? 'Email sudah terdaftar' 
              : 'Username sudah digunakan'
          }
        });
      }
      
      // Handle referral code
      let referredBy = null;
      if (referralCode) {
        const referrer = await User.findOne({ referralCode });
        if (referrer) {
          referredBy = referrer._id;
        }
      }
      
      // Create new user
      const userData = {
        username,
        email: email.toLowerCase(),
        password,
        profile,
        referredBy
      };
      
      const user = await User.createUser(userData);
      
      // Generate email verification token
      const verificationToken = JwtService.generateEmailVerificationToken(
        user._id, 
        user.email
      );
      
      // Update user with verification token
      user.emailVerificationToken = verificationToken;
      user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      await user.save();
      
      // Generate auth tokens
      const tokens = JwtService.generateTokenPair(user);
      
      // Store refresh token
      await JwtService.storeRefreshToken(user._id, tokens.refreshToken);
      
      // Log registration
      logger.info('User registered', {
        userId: user._id,
        username: user.username,
        email: user.email,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      // Send verification email
      try {
        await EmailService.sendVerificationEmail(user.email, verificationToken, user.profile.nama);
      } catch (emailError) {
        logger.error('Failed to send verification email:', emailError);
        // Don't fail registration if email fails
      }
      
      res.status(201).json({
        success: true,
        message: 'Registrasi berhasil. Silakan verifikasi email Anda.',
        data: {
          user: {
            id: user._id,
            username: user.username,
            email: user.email,
            role: user.role,
            emailVerified: user.emailVerified,
            profile: user.profile
          },
          tokens
        }
      });
      
    } catch (error) {
      logger.error('Registration error:', error);
      
      if (error.code === 11000) {
        const field = Object.keys(error.keyPattern)[0];
        return res.status(409).json({
          success: false,
          error: {
            code: 'DUPLICATE_FIELD',
            message: `${field === 'email' ? 'Email' : 'Username'} sudah digunakan`
          }
        });
      }
      
      res.status(500).json({
        success: false,
        error: {
          code: 'REGISTRATION_ERROR',
          message: 'Terjadi kesalahan saat registrasi'
        }
      });
    }
  }
  
  /**
   * Login user
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async login(req, res) {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Data login tidak valid',
            details: errors.array()
          }
        });
      }
      
      const { identifier, password, rememberMe = false } = req.body;
      
      // Find user by email or username
      const user = await User.findByEmailOrUsername(identifier)
        .select('+password +loginAttempts +lockUntil');
      
      if (!user) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Email/username atau password salah'
          }
        });
      }
      
      // Check if account is locked
      if (user.isLocked) {
        return res.status(423).json({
          success: false,
          error: {
            code: 'ACCOUNT_LOCKED',
            message: 'Akun terkunci karena terlalu banyak percobaan login yang gagal'
          }
        });
      }
      
      // Check if account is active
      if (!user.isActive) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'ACCOUNT_INACTIVE',
            message: 'Akun telah dinonaktifkan'
          }
        });
      }
      
      // Verify password
      const isPasswordValid = await user.comparePassword(password);
      
      if (!isPasswordValid) {
        // Increment login attempts
        await user.incLoginAttempts();
        
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Email/username atau password salah'
          }
        });
      }
      
      // Reset login attempts on successful login
      await user.resetLoginAttempts();
      
      // Generate auth tokens
      const tokens = JwtService.generateTokenPair(user);
      
      // Store refresh token
      await JwtService.storeRefreshToken(user._id, tokens.refreshToken);
      
      // Set cookie for remember me
      if (rememberMe) {
        res.cookie('refreshToken', tokens.refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });
      }
      
      // Log login
      logger.info('User logged in', {
        userId: user._id,
        username: user.username,
        email: user.email,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      res.json({
        success: true,
        message: 'Login berhasil',
        data: {
          user: {
            id: user._id,
            username: user.username,
            email: user.email,
            role: user.role,
            emailVerified: user.emailVerified,
            profile: user.profile,
            subscription: user.subscription
          },
          tokens
        }
      });
      
    } catch (error) {
      logger.error('Login error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'LOGIN_ERROR',
          message: 'Terjadi kesalahan saat login'
        }
      });
    }
  }
  
  /**
   * Refresh access token
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async refreshToken(req, res) {
    try {
      const { refreshToken } = req.body;
      const cookieRefreshToken = req.cookies?.refreshToken;
      
      const token = refreshToken || cookieRefreshToken;
      
      if (!token) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'NO_REFRESH_TOKEN',
            message: 'Refresh token diperlukan'
          }
        });
      }
      
      // Refresh the token
      const newTokens = await JwtService.refreshAccessToken(token);
      
      // Update cookie if it was used
      if (cookieRefreshToken) {
        res.cookie('refreshToken', newTokens.refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });
      }
      
      res.json({
        success: true,
        message: 'Token berhasil diperbarui',
        data: {
          tokens: newTokens
        }
      });
      
    } catch (error) {
      logger.error('Token refresh error:', error);
      
      // Clear cookie on error
      res.clearCookie('refreshToken');
      
      res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_REFRESH_ERROR',
          message: 'Gagal memperbarui token'
        }
      });
    }
  }
  
  /**
   * Logout user
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async logout(req, res) {
    try {
      const { refreshToken } = req.body;
      const cookieRefreshToken = req.cookies?.refreshToken;
      
      const token = refreshToken || cookieRefreshToken;
      
      if (token) {
        // Revoke refresh token
        await JwtService.revokeRefreshToken(token);
      }
      
      // Blacklist current access token
      if (req.token) {
        await JwtService.blacklistToken(req.token);
      }
      
      // Clear cookie
      res.clearCookie('refreshToken');
      
      // Log logout
      if (req.user) {
        logger.info('User logged out', {
          userId: req.user._id,
          username: req.user.username,
          ip: req.ip
        });
      }
      
      res.json({
        success: true,
        message: 'Logout berhasil'
      });
      
    } catch (error) {
      logger.error('Logout error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'LOGOUT_ERROR',
          message: 'Terjadi kesalahan saat logout'
        }
      });
    }
  }
  
  /**
   * Logout from all devices
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async logoutAll(req, res) {
    try {
      // Revoke all refresh tokens for user
      await JwtService.revokeAllRefreshTokens(req.user._id);
      
      // Blacklist current access token
      if (req.token) {
        await JwtService.blacklistToken(req.token);
      }
      
      // Clear cookie
      res.clearCookie('refreshToken');
      
      // Log logout all
      logger.info('User logged out from all devices', {
        userId: req.user._id,
        username: req.user.username,
        ip: req.ip
      });
      
      res.json({
        success: true,
        message: 'Logout dari semua perangkat berhasil'
      });
      
    } catch (error) {
      logger.error('Logout all error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'LOGOUT_ALL_ERROR',
          message: 'Terjadi kesalahan saat logout dari semua perangkat'
        }
      });
    }
  }
  
  /**
   * Verify email
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async verifyEmail(req, res) {
    try {
      const { token } = req.params;
      
      if (!token) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'NO_TOKEN',
            message: 'Token verifikasi diperlukan'
          }
        });
      }
      
      // Verify email verification token
      const decoded = JwtService.verifyEmailVerificationToken(token);
      
      // Find user
      const user = await User.findById(decoded.id);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User tidak ditemukan'
          }
        });
      }
      
      // Check if email is already verified
      if (user.emailVerified) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'ALREADY_VERIFIED',
            message: 'Email sudah diverifikasi'
          }
        });
      }
      
      // Verify email
      user.emailVerified = true;
      user.emailVerificationToken = undefined;
      user.emailVerificationExpires = undefined;
      await user.save();
      
      // Log email verification
      logger.info('Email verified', {
        userId: user._id,
        email: user.email,
        ip: req.ip
      });
      
      res.json({
        success: true,
        message: 'Email berhasil diverifikasi'
      });
      
    } catch (error) {
      logger.error('Email verification error:', error);
      
      if (error.message.includes('Invalid email verification token')) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Token verifikasi tidak valid atau telah kedaluwarsa'
          }
        });
      }
      
      res.status(500).json({
        success: false,
        error: {
          code: 'VERIFICATION_ERROR',
          message: 'Terjadi kesalahan saat verifikasi email'
        }
      });
    }
  }
  
  /**
   * Resend email verification
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async resendVerification(req, res) {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'EMAIL_REQUIRED',
            message: 'Email diperlukan'
          }
        });
      }
      
      // Find user
      const user = await User.findOne({ email: email.toLowerCase() });
      
      if (!user) {
        // Don't reveal if user exists or not
        return res.json({
          success: true,
          message: 'Jika email terdaftar, link verifikasi akan dikirim'
        });
      }
      
      // Check if already verified
      if (user.emailVerified) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'ALREADY_VERIFIED',
            message: 'Email sudah diverifikasi'
          }
        });
      }
      
      // Generate new verification token
      const verificationToken = JwtService.generateEmailVerificationToken(
        user._id, 
        user.email
      );
      
      // Update user
      user.emailVerificationToken = verificationToken;
      user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      await user.save();
      
      // Send verification email
      try {
        await EmailService.sendVerificationEmail(user.email, verificationToken, user.profile.nama);
      } catch (emailError) {
        logger.error('Failed to send verification email:', emailError);
        // Don't fail the request if email fails
      }
      
      // Log resend verification
      logger.info('Email verification resent', {
        userId: user._id,
        email: user.email,
        ip: req.ip
      });
      
      res.json({
        success: true,
        message: 'Link verifikasi telah dikirim ke email Anda'
      });
      
    } catch (error) {
      logger.error('Resend verification error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'RESEND_ERROR',
          message: 'Terjadi kesalahan saat mengirim ulang verifikasi'
        }
      });
    }
  }
  
  /**
   * Forgot password
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async forgotPassword(req, res) {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'EMAIL_REQUIRED',
            message: 'Email diperlukan'
          }
        });
      }
      
      // Find user
      const user = await User.findOne({ email: email.toLowerCase() });
      
      if (!user) {
        // Don't reveal if user exists or not
        return res.json({
          success: true,
          message: 'Jika email terdaftar, link reset password akan dikirim'
        });
      }
      
      // Generate password reset token
      const resetToken = JwtService.generatePasswordResetToken(user._id, user.email);
      
      // Update user
      user.passwordResetToken = resetToken;
      user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await user.save();
      
      // Send reset email
      try {
        await EmailService.sendPasswordResetEmail(user.email, resetToken, user.profile.nama);
      } catch (emailError) {
        logger.error('Failed to send password reset email:', emailError);
        // Don't fail the request if email fails
      }
      
      // Log password reset request
      logger.info('Password reset requested', {
        userId: user._id,
        email: user.email,
        ip: req.ip
      });
      
      res.json({
        success: true,
        message: 'Link reset password telah dikirim ke email Anda'
      });
      
    } catch (error) {
      logger.error('Forgot password error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'FORGOT_PASSWORD_ERROR',
          message: 'Terjadi kesalahan saat memproses permintaan reset password'
        }
      });
    }
  }
  
  /**
   * Reset password
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async resetPassword(req, res) {
    try {
      const { token, newPassword } = req.body;
      
      if (!token || !newPassword) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_FIELDS',
            message: 'Token dan password baru diperlukan'
          }
        });
      }
      
      // Verify password reset token
      const decoded = JwtService.verifyPasswordResetToken(token);
      
      // Find user
      const user = await User.findById(decoded.id);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User tidak ditemukan'
          }
        });
      }
      
      // Update password
      user.password = newPassword;
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save();
      
      // Revoke all refresh tokens (force re-login)
      await JwtService.revokeAllRefreshTokens(user._id);
      
      // Log password reset
      logger.info('Password reset completed', {
        userId: user._id,
        email: user.email,
        ip: req.ip
      });
      
      res.json({
        success: true,
        message: 'Password berhasil direset. Silakan login dengan password baru.'
      });
      
    } catch (error) {
      logger.error('Reset password error:', error);
      
      if (error.message.includes('Invalid password reset token')) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Token reset password tidak valid atau telah kedaluwarsa'
          }
        });
      }
      
      res.status(500).json({
        success: false,
        error: {
          code: 'RESET_PASSWORD_ERROR',
          message: 'Terjadi kesalahan saat reset password'
        }
      });
    }
  }
  
  /**
   * Change password (authenticated user)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_FIELDS',
            message: 'Password saat ini dan password baru diperlukan'
          }
        });
      }
      
      // Get user with password
      const user = await User.findById(req.user._id).select('+password');
      
      // Verify current password
      const isCurrentPasswordValid = await user.comparePassword(currentPassword);
      
      if (!isCurrentPasswordValid) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_CURRENT_PASSWORD',
            message: 'Password saat ini salah'
          }
        });
      }
      
      // Update password
      user.password = newPassword;
      await user.save();
      
      // Revoke all other refresh tokens (keep current session)
      await JwtService.revokeAllRefreshTokens(user._id);
      
      // Generate new tokens for current session
      const tokens = JwtService.generateTokenPair(user);
      await JwtService.storeRefreshToken(user._id, tokens.refreshToken);
      
      // Log password change
      logger.info('Password changed', {
        userId: user._id,
        email: user.email,
        ip: req.ip
      });
      
      res.json({
        success: true,
        message: 'Password berhasil diubah',
        data: {
          tokens
        }
      });
      
    } catch (error) {
      logger.error('Change password error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'CHANGE_PASSWORD_ERROR',
          message: 'Terjadi kesalahan saat mengubah password'
        }
      });
    }
  }
  
  /**
   * Get current user profile
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getProfile(req, res) {
    try {
      res.json({
        success: true,
        data: {
          user: {
            id: req.user._id,
            username: req.user.username,
            email: req.user.email,
            role: req.user.role,
            emailVerified: req.user.emailVerified,
            profile: req.user.profile,
            subscription: req.user.subscription,
            stats: req.user.stats,
            createdAt: req.user.createdAt
          }
        }
      });
    } catch (error) {
      logger.error('Get profile error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'PROFILE_ERROR',
          message: 'Terjadi kesalahan saat mengambil profil'
        }
      });
    }
  }
}

module.exports = AuthController;