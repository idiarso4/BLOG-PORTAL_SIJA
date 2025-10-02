const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/AuthController');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { authRateLimit, passwordResetRateLimit, emailVerificationRateLimit } = require('../middleware/security');
const {
  userRegistrationValidation,
  userLoginValidation,
  changePasswordValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  handleValidationErrors
} = require('../utils/validation');

// Registration
router.post('/register', 
  authRateLimit,
  userRegistrationValidation,
  handleValidationErrors,
  AuthController.register
);

// Login
router.post('/login',
  authRateLimit,
  userLoginValidation,
  handleValidationErrors,
  AuthController.login
);

// Refresh token
router.post('/refresh',
  AuthController.refreshToken
);

// Logout
router.post('/logout',
  optionalAuth,
  AuthController.logout
);

// Logout from all devices
router.post('/logout-all',
  authenticate,
  AuthController.logoutAll
);

// Email verification
router.get('/verify-email/:token',
  AuthController.verifyEmail
);

// Resend email verification
router.post('/resend-verification',
  emailVerificationRateLimit,
  AuthController.resendVerification
);

// Forgot password
router.post('/forgot-password',
  passwordResetRateLimit,
  forgotPasswordValidation,
  handleValidationErrors,
  AuthController.forgotPassword
);

// Reset password
router.post('/reset-password',
  resetPasswordValidation,
  handleValidationErrors,
  AuthController.resetPassword
);

// Change password (authenticated)
router.post('/change-password',
  authenticate,
  changePasswordValidation,
  handleValidationErrors,
  AuthController.changePassword
);

// Get current user profile
router.get('/profile',
  authenticate,
  AuthController.getProfile
);

module.exports = router;