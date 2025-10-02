const User = require('../models/User');
const Article = require('../models/Article');
const SocialMediaService = require('../services/SocialMediaService');
const { validationResult } = require('express-validator');
const logger = require('../config/logger');
const crypto = require('crypto');

/**
 * Social Media Controller
 */
class SocialMediaController {

    /**
     * Get OAuth URL for platform connection
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async getOAuthUrl(req, res) {
        try {
            const { platform } = req.params;

            if (!SocialMediaService.getSupportedPlatforms().find(p => p.key === platform)) {
                return res.status(400).json({
                    success: false,
                    error: {
                        code: 'UNSUPPORTED_PLATFORM',
                        message: 'Platform tidak didukung'
                    }
                });
            }

            const state = crypto.randomBytes(16).toString('hex');
            const redirectUri = `${process.env.APP_URL}/api/social-media/callback/${platform}`;

            // Store state in session or cache for validation
            req.session = req.session || {};
            req.session.oauthState = state;
            req.session.userId = req.user._id;

            const oauthUrl = SocialMediaService.getOAuthUrl(platform, redirectUri, state);

            res.json({
                success: true,
                data: {
                    oauthUrl,
                    state
                }
            });

        } catch (error) {
            logger.error('Get OAuth URL error:', error);

            res.status(500).json({
                success: false,
                error: {
                    code: 'OAUTH_URL_ERROR',
                    message: 'Terjadi kesalahan saat membuat URL OAuth'
                }
            });
        }
    }

    /**
     * Handle OAuth callback
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async handleOAuthCallback(req, res) {
        try {
            const { platform } = req.params;
            const { code, state } = req.query;

            // Validate state parameter
            if (!req.session?.oauthState || req.session.oauthState !== state) {
                return res.status(400).json({
                    success: false,
                    error: {
                        code: 'INVALID_STATE',
                        message: 'State parameter tidak valid'
                    }
                });
            }

            if (!code) {
                return res.status(400).json({
                    success: false,
                    error: {
                        code: 'NO_CODE',
                        message: 'Authorization code tidak ditemukan'
                    }
                });
            }

            const redirectUri = `${process.env.APP_URL}/api/social-media/callback/${platform}`;

            // Exchange code for token
            const tokenResult = await SocialMediaService.exchangeCodeForToken(
                platform,
                code,
                redirectUri
            );

            if (!tokenResult.success) {
                throw new Error('Gagal menukar code untuk token');
            }

            const { access_token, refresh_token, expires_in } = tokenResult.data;

            // Get user profile from platform
            const profileResult = await SocialMediaService.getUserProfile(platform, access_token);

            if (!profileResult.success) {
                throw new Error('Gagal mengambil profil user');
            }

            const profile = profileResult.data;

            // Update user's social accounts
            const userId = req.session.userId;
            const user = await User.findById(userId);

            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: {
                        code: 'USER_NOT_FOUND',
                        message: 'User tidak ditemukan'
                    }
                });
            }

            // Store social account data
            if (!user.socialAccounts) {
                user.socialAccounts = {};
            }

            user.socialAccounts[platform] = {
                id: profile.id,
                name: profile.name,
                username: profile.username,
                email: profile.email,
                picture: profile.picture,
                accessToken: access_token,
                refreshToken: refresh_token,
                tokenExpiry: expires_in ? new Date(Date.now() + expires_in * 1000) : null,
                connectedAt: new Date(),
                isActive: true
            };

            await user.save();

            // Clear session data
            delete req.session.oauthState;
            delete req.session.userId;

            // Log connection
            logger.info('Social account connected', {
                userId: user._id,
                platform,
                accountId: profile.id,
                accountName: profile.name
            });

            res.json({
                success: true,
                message: `Akun ${platform} berhasil terhubung`,
                data: {
                    platform,
                    account: {
                        id: profile.id,
                        name: profile.name,
                        username: profile.username,
                        picture: profile.picture
                    }
                }
            });

        } catch (error) {
            logger.error('OAuth callback error:', error);

            res.status(500).json({
                success: false,
                error: {
                    code: 'OAUTH_CALLBACK_ERROR',
                    message: error.message || 'Terjadi kesalahan saat menghubungkan akun'
                }
            });
        }
    }

    /**
     * Get connected social accounts
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async getConnectedAccounts(req, res) {
        try {
            const user = await User.findById(req.user._id);

            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: {
                        code: 'USER_NOT_FOUND',
                        message: 'User tidak ditemukan'
                    }
                });
            }

            const connectedAccounts = [];
            const supportedPlatforms = SocialMediaService.getSupportedPlatforms();

            for (const platform of supportedPlatforms) {
                const account = user.socialAccounts?.[platform.key];

                connectedAccounts.push({
                    platform: platform.key,
                    platformName: platform.name,
                    connected: !!account,
                    account: account ? {
                        id: account.id,
                        name: account.name,
                        username: account.username,
                        picture: account.picture,
                        connectedAt: account.connectedAt,
                        isActive: account.isActive,
                        tokenExpiry: account.tokenExpiry
                    } : null
                });
            }

            res.json({
                success: true,
                data: {
                    accounts: connectedAccounts
                }
            });

        } catch (error) {
            logger.error('Get connected accounts error:', error);

            res.status(500).json({
                success: false,
                error: {
                    code: 'GET_ACCOUNTS_ERROR',
                    message: 'Terjadi kesalahan saat mengambil akun terhubung'
                }
            });
        }
    }

    /**
     * Disconnect social account
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async disconnectAccount(req, res) {
        try {
            const { platform } = req.params;

            const user = await User.findById(req.user._id);

            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: {
                        code: 'USER_NOT_FOUND',
                        message: 'User tidak ditemukan'
                    }
                });
            }

            if (!user.socialAccounts?.[platform]) {
                return res.status(404).json({
                    success: false,
                    error: {
                        code: 'ACCOUNT_NOT_CONNECTED',
                        message: 'Akun tidak terhubung'
                    }
                });
            }

            // Remove social account
            delete user.socialAccounts[platform];
            await user.save();

            // Log disconnection
            logger.info('Social account disconnected', {
                userId: user._id,
                platform
            });

            res.json({
                success: true,
                message: `Akun ${platform} berhasil diputus hubungannya`
            });

        } catch (error) {
            logger.error('Disconnect account error:', error);

            res.status(500).json({
                success: false,
                error: {
                    code: 'DISCONNECT_ERROR',
                    message: 'Terjadi kesalahan saat memutus hubungan akun'
                }
            });
        }
    }

    /**
     * Post content to social media
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async postToSocialMedia(req, res) {
        try {
            // Check validation errors
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Data tidak valid',
                        details: errors.array()
                    }
                });
            }

            const {
                platforms,
                message,
                imageUrl,
                link,
                hashtags = [],
                articleId
            } = req.body;

            const user = await User.findById(req.user._id);

            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: {
                        code: 'USER_NOT_FOUND',
                        message: 'User tidak ditemukan'
                    }
                });
            }

            // Verify article ownership if articleId provided
            if (articleId) {
                const article = await Article.findById(articleId);
                if (!article || article.penulis.toString() !== user._id.toString()) {
                    return res.status(403).json({
                        success: false,
                        error: {
                            code: 'ARTICLE_ACCESS_DENIED',
                            message: 'Anda tidak memiliki akses ke artikel ini'
                        }
                    });
                }
            }

            const results = [];

            // Post to each selected platform
            for (const platform of platforms) {
                const account = user.socialAccounts?.[platform];

                if (!account || !account.isActive) {
                    results.push({
                        platform,
                        success: false,
                        error: 'Akun tidak terhubung atau tidak aktif'
                    });
                    continue;
                }

                try {
                    // Check if token is expired and refresh if needed
                    if (account.tokenExpiry && new Date() > account.tokenExpiry) {
                        if (account.refreshToken) {
                            const refreshResult = await SocialMediaService.refreshAccessToken(
                                platform,
                                account.refreshToken
                            );

                            if (refreshResult.success) {
                                account.accessToken = refreshResult.data.access_token;
                                account.tokenExpiry = refreshResult.data.expires_in ?
                                    new Date(Date.now() + refreshResult.data.expires_in * 1000) : null;
                                await user.save();
                            }
                        }
                    }

                    const postResult = await SocialMediaService.postContent(
                        platform,
                        account.accessToken,
                        {
                            message,
                            imageUrl,
                            link,
                            hashtags
                        }
                    );

                    results.push({
                        platform,
                        success: true,
                        postId: postResult.data.postId,
                        postedAt: postResult.data.postedAt
                    });

                    // Update article social media history if articleId provided
                    if (articleId) {
                        const article = await Article.findById(articleId);
                        if (article) {
                            if (!article.socialMedia.postHistory) {
                                article.socialMedia.postHistory = [];
                            }

                            article.socialMedia.postHistory.push({
                                platform,
                                postId: postResult.data.postId,
                                postedAt: postResult.data.postedAt,
                                status: 'success'
                            });

                            await article.save();
                        }
                    }

                } catch (error) {
                    logger.error(`Post to ${platform} error:`, error);

                    results.push({
                        platform,
                        success: false,
                        error: error.message
                    });

                    // Update article social media history with error
                    if (articleId) {
                        const article = await Article.findById(articleId);
                        if (article) {
                            if (!article.socialMedia.postHistory) {
                                article.socialMedia.postHistory = [];
                            }

                            article.socialMedia.postHistory.push({
                                platform,
                                postId: null,
                                postedAt: new Date(),
                                status: 'failed',
                                error: error.message
                            });

                            await article.save();
                        }
                    }
                }
            }

            const successCount = results.filter(r => r.success).length;

            // Log social media posting
            logger.info('Social media posting completed', {
                userId: user._id,
                platforms,
                successCount,
                totalPlatforms: platforms.length,
                articleId
            });

            res.json({
                success: true,
                message: `Berhasil posting ke ${successCount} dari ${platforms.length} platform`,
                data: {
                    results,
                    summary: {
                        total: platforms.length,
                        success: successCount,
                        failed: platforms.length - successCount
                    }
                }
            });

        } catch (error) {
            logger.error('Post to social media error:', error);

            res.status(500).json({
                success: false,
                error: {
                    code: 'SOCIAL_POST_ERROR',
                    message: 'Terjadi kesalahan saat posting ke media sosial'
                }
            });
        }
    }

    /**
     * Get social media analytics
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async getSocialAnalytics(req, res) {
        try {
            const { platform, postId } = req.params;

            const user = await User.findById(req.user._id);

            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: {
                        code: 'USER_NOT_FOUND',
                        message: 'User tidak ditemukan'
                    }
                });
            }

            const account = user.socialAccounts?.[platform];

            if (!account || !account.isActive) {
                return res.status(404).json({
                    success: false,
                    error: {
                        code: 'ACCOUNT_NOT_CONNECTED',
                        message: 'Akun tidak terhubung atau tidak aktif'
                    }
                });
            }

            const analyticsResult = await SocialMediaService.getPostAnalytics(
                platform,
                account.accessToken,
                postId
            );

            if (!analyticsResult.success) {
                throw new Error('Gagal mengambil analytics');
            }

            res.json({
                success: true,
                data: {
                    platform,
                    postId,
                    analytics: analyticsResult.data,
                    retrievedAt: new Date()
                }
            });

        } catch (error) {
            logger.error('Get social analytics error:', error);

            res.status(500).json({
                success: false,
                error: {
                    code: 'ANALYTICS_ERROR',
                    message: error.message || 'Terjadi kesalahan saat mengambil analytics'
                }
            });
        }
    }

    /**
     * Get supported platforms
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async getSupportedPlatforms(req, res) {
        try {
            const platforms = SocialMediaService.getSupportedPlatforms();

            res.json({
                success: true,
                data: {
                    platforms
                }
            });

        } catch (error) {
            logger.error('Get supported platforms error:', error);

            res.status(500).json({
                success: false,
                error: {
                    code: 'GET_PLATFORMS_ERROR',
                    message: 'Terjadi kesalahan saat mengambil daftar platform'
                }
            });
        }
    }
}

module.exports = SocialMediaController;