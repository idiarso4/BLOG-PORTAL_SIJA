const User = require('../models/User');
const JwtService = require('../services/JwtService');
const EmailService = require('../services/EmailService');
const logger = require('../config/logger');
const axios = require('axios');

/**
 * Social Authentication Controller
 */
class SocialAuthController {
  
  /**
   * Google OAuth login
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async googleAuth(req, res) {
    try {
      const { token, code } = req.body;
      
      if (!token && !code) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_TOKEN',
            message: 'Google token atau code diperlukan'
          }
        });
      }
      
      let googleUser;
      
      if (token) {
        // Verify Google ID token
        googleUser = await SocialAuthController.verifyGoogleToken(token);
      } else if (code) {
        // Exchange code for token and get user info
        googleUser = await SocialAuthController.exchangeGoogleCode(code);
      }
      
      if (!googleUser) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_GOOGLE_TOKEN',
            message: 'Token Google tidak valid'
          }
        });
      }
      
      // Find or create user
      const result = await SocialAuthController.findOrCreateSocialUser({
        provider: 'google',
        providerId: googleUser.sub || googleUser.id,
        email: googleUser.email,
        name: googleUser.name,
        picture: googleUser.picture,
        emailVerified: googleUser.email_verified || true
      });
      
      // Generate tokens
      const tokens = JwtService.generateTokenPair(result.user);
      await JwtService.storeRefreshToken(result.user._id, tokens.refreshToken);
      
      // Log social login
      logger.info('Google OAuth login', {
        userId: result.user._id,
        email: result.user.email,
        isNewUser: result.isNewUser,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      // Send welcome email for new users
      if (result.isNewUser) {
        try {
          await EmailService.sendWelcomeEmail(result.user.email, result.user.profile.nama);
        } catch (emailError) {
          logger.error('Failed to send welcome email:', emailError);
        }
      }
      
      res.json({
        success: true,
        message: result.isNewUser ? 'Akun berhasil dibuat dengan Google' : 'Login berhasil dengan Google',
        data: {
          user: {
            id: result.user._id,
            username: result.user.username,
            email: result.user.email,
            role: result.user.role,
            emailVerified: result.user.emailVerified,
            profile: result.user.profile,
            subscription: result.user.subscription
          },
          tokens,
          isNewUser: result.isNewUser
        }
      });
      
    } catch (error) {
      logger.error('Google OAuth error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'GOOGLE_AUTH_ERROR',
          message: 'Terjadi kesalahan saat login dengan Google'
        }
      });
    }
  }
  
  /**
   * Facebook OAuth login
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async facebookAuth(req, res) {
    try {
      const { accessToken } = req.body;
      
      if (!accessToken) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_TOKEN',
            message: 'Facebook access token diperlukan'
          }
        });
      }
      
      // Verify Facebook access token and get user info
      const facebookUser = await SocialAuthController.verifyFacebookToken(accessToken);
      
      if (!facebookUser) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_FACEBOOK_TOKEN',
            message: 'Token Facebook tidak valid'
          }
        });
      }
      
      // Find or create user
      const result = await SocialAuthController.findOrCreateSocialUser({
        provider: 'facebook',
        providerId: facebookUser.id,
        email: facebookUser.email,
        name: facebookUser.name,
        picture: facebookUser.picture?.data?.url,
        emailVerified: true // Facebook emails are considered verified
      });
      
      // Generate tokens
      const tokens = JwtService.generateTokenPair(result.user);
      await JwtService.storeRefreshToken(result.user._id, tokens.refreshToken);
      
      // Log social login
      logger.info('Facebook OAuth login', {
        userId: result.user._id,
        email: result.user.email,
        isNewUser: result.isNewUser,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      // Send welcome email for new users
      if (result.isNewUser) {
        try {
          await EmailService.sendWelcomeEmail(result.user.email, result.user.profile.nama);
        } catch (emailError) {
          logger.error('Failed to send welcome email:', emailError);
        }
      }
      
      res.json({
        success: true,
        message: result.isNewUser ? 'Akun berhasil dibuat dengan Facebook' : 'Login berhasil dengan Facebook',
        data: {
          user: {
            id: result.user._id,
            username: result.user.username,
            email: result.user.email,
            role: result.user.role,
            emailVerified: result.user.emailVerified,
            profile: result.user.profile,
            subscription: result.user.subscription
          },
          tokens,
          isNewUser: result.isNewUser
        }
      });
      
    } catch (error) {
      logger.error('Facebook OAuth error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'FACEBOOK_AUTH_ERROR',
          message: 'Terjadi kesalahan saat login dengan Facebook'
        }
      });
    }
  }
  
  /**
   * Link social account to existing user
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async linkSocialAccount(req, res) {
    try {
      const { provider, token, accessToken } = req.body;
      
      if (!provider || (!token && !accessToken)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_FIELDS',
            message: 'Provider dan token diperlukan'
          }
        });
      }
      
      let socialUser;
      
      if (provider === 'google') {
        socialUser = await SocialAuthController.verifyGoogleToken(token);
      } else if (provider === 'facebook') {
        socialUser = await SocialAuthController.verifyFacebookToken(accessToken);
      } else {
        return res.status(400).json({
          success: false,
          error: {
            code: 'UNSUPPORTED_PROVIDER',
            message: 'Provider tidak didukung'
          }
        });
      }
      
      if (!socialUser) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Token tidak valid'
          }
        });
      }
      
      const providerId = socialUser.sub || socialUser.id;
      
      // Check if social account is already linked to another user
      const existingUser = await User.findOne({
        [`socialAccounts.${provider}.id`]: providerId
      });
      
      if (existingUser && existingUser._id.toString() !== req.user._id.toString()) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'ACCOUNT_ALREADY_LINKED',
            message: `Akun ${provider} sudah terhubung dengan user lain`
          }
        });
      }
      
      // Link social account to current user
      const updateData = {};
      updateData[`socialAccounts.${provider}`] = {
        id: providerId,
        email: socialUser.email,
        name: socialUser.name,
        picture: socialUser.picture?.data?.url || socialUser.picture,
        linkedAt: new Date()
      };
      
      await User.findByIdAndUpdate(req.user._id, {
        $set: updateData
      });
      
      // Log account linking
      logger.info('Social account linked', {
        userId: req.user._id,
        provider,
        socialId: providerId,
        ip: req.ip
      });
      
      res.json({
        success: true,
        message: `Akun ${provider} berhasil dihubungkan`
      });
      
    } catch (error) {
      logger.error('Link social account error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'LINK_ACCOUNT_ERROR',
          message: 'Terjadi kesalahan saat menghubungkan akun sosial'
        }
      });
    }
  }
  
  /**
   * Unlink social account
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async unlinkSocialAccount(req, res) {
    try {
      const { provider } = req.params;
      
      if (!['google', 'facebook'].includes(provider)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'UNSUPPORTED_PROVIDER',
            message: 'Provider tidak didukung'
          }
        });
      }
      
      // Check if user has password (can't unlink if no password set)
      const user = await User.findById(req.user._id).select('+password');
      
      if (!user.password) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'NO_PASSWORD_SET',
            message: 'Tidak dapat memutus hubungan akun sosial. Silakan set password terlebih dahulu.'
          }
        });
      }
      
      // Unlink social account
      const updateData = {};
      updateData[`socialAccounts.${provider}`] = undefined;
      
      await User.findByIdAndUpdate(req.user._id, {
        $unset: updateData
      });
      
      // Log account unlinking
      logger.info('Social account unlinked', {
        userId: req.user._id,
        provider,
        ip: req.ip
      });
      
      res.json({
        success: true,
        message: `Akun ${provider} berhasil diputus hubungannya`
      });
      
    } catch (error) {
      logger.error('Unlink social account error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'UNLINK_ACCOUNT_ERROR',
          message: 'Terjadi kesalahan saat memutus hubungan akun sosial'
        }
      });
    }
  }
  
  /**
   * Verify Google ID token
   * @param {String} token - Google ID token
   * @returns {Object} User info
   */
  static async verifyGoogleToken(token) {
    try {
      const response = await axios.get(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${token}`
      );
      
      const userData = response.data;
      
      // Verify audience (client ID)
      if (userData.aud !== process.env.GOOGLE_CLIENT_ID) {
        throw new Error('Invalid audience');
      }
      
      return userData;
    } catch (error) {
      logger.error('Google token verification error:', error);
      return null;
    }
  }
  
  /**
   * Exchange Google authorization code for token and get user info
   * @param {String} code - Google authorization code
   * @returns {Object} User info
   */
  static async exchangeGoogleCode(code) {
    try {
      // Exchange code for access token
      const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: `${process.env.APP_URL}/auth/google/callback`
      });
      
      const { access_token } = tokenResponse.data;
      
      // Get user info
      const userResponse = await axios.get(
        `https://www.googleapis.com/oauth2/v2/userinfo?access_token=${access_token}`
      );
      
      return userResponse.data;
    } catch (error) {
      logger.error('Google code exchange error:', error);
      return null;
    }
  }
  
  /**
   * Verify Facebook access token and get user info
   * @param {String} accessToken - Facebook access token
   * @returns {Object} User info
   */
  static async verifyFacebookToken(accessToken) {
    try {
      // Verify token with Facebook
      const verifyResponse = await axios.get(
        `https://graph.facebook.com/me?access_token=${accessToken}&fields=id,name,email,picture`
      );
      
      return verifyResponse.data;
    } catch (error) {
      logger.error('Facebook token verification error:', error);
      return null;
    }
  }
  
  /**
   * Find or create user from social login
   * @param {Object} socialData - Social user data
   * @returns {Object} User and isNewUser flag
   */
  static async findOrCreateSocialUser(socialData) {
    const { provider, providerId, email, name, picture, emailVerified } = socialData;
    
    // First, try to find user by social provider ID
    let user = await User.findOne({
      [`socialAccounts.${provider}.id`]: providerId
    });
    
    if (user) {
      // Update social account info
      const updateData = {};
      updateData[`socialAccounts.${provider}`] = {
        id: providerId,
        email,
        name,
        picture,
        linkedAt: user.socialAccounts?.[provider]?.linkedAt || new Date()
      };
      
      await User.findByIdAndUpdate(user._id, {
        $set: updateData
      });
      
      return { user, isNewUser: false };
    }
    
    // If not found by social ID, try to find by email
    if (email) {
      user = await User.findOne({ email: email.toLowerCase() });
      
      if (user) {
        // Link social account to existing user
        const updateData = {};
        updateData[`socialAccounts.${provider}`] = {
          id: providerId,
          email,
          name,
          picture,
          linkedAt: new Date()
        };
        
        await User.findByIdAndUpdate(user._id, {
          $set: updateData
        });
        
        return { user, isNewUser: false };
      }
    }
    
    // Create new user
    const username = await SocialAuthController.generateUniqueUsername(name, email);
    
    const userData = {
      username,
      email: email?.toLowerCase(),
      profile: {
        nama: name,
        foto: picture
      },
      emailVerified: emailVerified || false,
      socialAccounts: {
        [provider]: {
          id: providerId,
          email,
          name,
          picture,
          linkedAt: new Date()
        }
      }
    };
    
    // Generate a random password for social users (they won't use it)
    userData.password = Math.random().toString(36).slice(-12) + 'A1!';
    
    user = await User.createUser(userData);
    
    return { user, isNewUser: true };
  }
  
  /**
   * Generate unique username from name or email
   * @param {String} name - User's name
   * @param {String} email - User's email
   * @returns {String} Unique username
   */
  static async generateUniqueUsername(name, email) {
    let baseUsername;
    
    if (name) {
      // Generate from name
      baseUsername = name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .substring(0, 20);
    } else if (email) {
      // Generate from email
      baseUsername = email
        .split('@')[0]
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .substring(0, 20);
    } else {
      baseUsername = 'user';
    }
    
    // Ensure minimum length
    if (baseUsername.length < 3) {
      baseUsername = 'user' + baseUsername;
    }
    
    let username = baseUsername;
    let counter = 1;
    
    // Check uniqueness and add number if needed
    while (await User.findOne({ username })) {
      username = baseUsername + counter;
      counter++;
    }
    
    return username;
  }
  
  /**
   * Get social login URLs
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getSocialLoginUrls(req, res) {
    try {
      const baseUrl = process.env.APP_URL;
      
      const urls = {
        google: `https://accounts.google.com/oauth/authorize?` +
          `client_id=${process.env.GOOGLE_CLIENT_ID}&` +
          `redirect_uri=${encodeURIComponent(baseUrl + '/auth/google/callback')}&` +
          `response_type=code&` +
          `scope=openid email profile`,
          
        facebook: `https://www.facebook.com/v18.0/dialog/oauth?` +
          `client_id=${process.env.FACEBOOK_APP_ID}&` +
          `redirect_uri=${encodeURIComponent(baseUrl + '/auth/facebook/callback')}&` +
          `response_type=code&` +
          `scope=email`
      };
      
      res.json({
        success: true,
        data: { urls }
      });
      
    } catch (error) {
      logger.error('Get social login URLs error:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'SOCIAL_URLS_ERROR',
          message: 'Terjadi kesalahan saat mengambil URL login sosial'
        }
      });
    }
  }
}

module.exports = SocialAuthController;