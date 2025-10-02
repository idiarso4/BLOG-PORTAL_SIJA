const axios = require('axios');
const logger = require('../config/logger');

/**
 * Social Media Service untuk integrasi dengan berbagai platform
 */
class SocialMediaService {
  
  constructor() {
    this.platforms = {
      facebook: {
        name: 'Facebook',
        apiUrl: 'https://graph.facebook.com/v18.0',
        scopes: ['pages_manage_posts', 'pages_read_engagement', 'pages_show_list']
      },
      twitter: {
        name: 'Twitter/X',
        apiUrl: 'https://api.twitter.com/2',
        scopes: ['tweet.read', 'tweet.write', 'users.read']
      },
      instagram: {
        name: 'Instagram',
        apiUrl: 'https://graph.instagram.com',
        scopes: ['instagram_basic', 'instagram_content_publish']
      },
      linkedin: {
        name: 'LinkedIn',
        apiUrl: 'https://api.linkedin.com/v2',
        scopes: ['w_member_social', 'r_liteprofile']
      },
      tiktok: {
        name: 'TikTok',
        apiUrl: 'https://open-api.tiktok.com',
        scopes: ['user.info.basic', 'video.publish']
      }
    };
  }
  
  /**
   * Get OAuth URL for platform
   * @param {String} platform - Social media platform
   * @param {String} redirectUri - Redirect URI
   * @param {String} state - State parameter
   * @returns {String} OAuth URL
   */
  getOAuthUrl(platform, redirectUri, state) {
    const config = this.platforms[platform];
    if (!config) {
      throw new Error(`Platform ${platform} tidak didukung`);
    }
    
    const baseUrls = {
      facebook: 'https://www.facebook.com/v18.0/dialog/oauth',
      twitter: 'https://twitter.com/i/oauth2/authorize',
      instagram: 'https://api.instagram.com/oauth/authorize',
      linkedin: 'https://www.linkedin.com/oauth/v2/authorization',
      tiktok: 'https://www.tiktok.com/auth/authorize/'
    };
    
    const clientIds = {
      facebook: process.env.FACEBOOK_APP_ID,
      twitter: process.env.TWITTER_CLIENT_ID,
      instagram: process.env.INSTAGRAM_CLIENT_ID,
      linkedin: process.env.LINKEDIN_CLIENT_ID,
      tiktok: process.env.TIKTOK_CLIENT_KEY
    };
    
    const params = new URLSearchParams({
      client_id: clientIds[platform],
      redirect_uri: redirectUri,
      scope: config.scopes.join(' '),
      response_type: 'code',
      state
    });
    
    return `${baseUrls[platform]}?${params.toString()}`;
  }
  
  /**
   * Exchange authorization code for access token
   * @param {String} platform - Social media platform
   * @param {String} code - Authorization code
   * @param {String} redirectUri - Redirect URI
   * @returns {Object} Token data
   */
  async exchangeCodeForToken(platform, code, redirectUri) {
    try {
      const tokenUrls = {
        facebook: 'https://graph.facebook.com/v18.0/oauth/access_token',
        twitter: 'https://api.twitter.com/2/oauth2/token',
        instagram: 'https://api.instagram.com/oauth/access_token',
        linkedin: 'https://www.linkedin.com/oauth/v2/accessToken',
        tiktok: 'https://open-api.tiktok.com/oauth/access_token/'
      };
      
      const clientSecrets = {
        facebook: process.env.FACEBOOK_APP_SECRET,
        twitter: process.env.TWITTER_CLIENT_SECRET,
        instagram: process.env.INSTAGRAM_CLIENT_SECRET,
        linkedin: process.env.LINKEDIN_CLIENT_SECRET,
        tiktok: process.env.TIKTOK_CLIENT_SECRET
      };
      
      const clientIds = {
        facebook: process.env.FACEBOOK_APP_ID,
        twitter: process.env.TWITTER_CLIENT_ID,
        instagram: process.env.INSTAGRAM_CLIENT_ID,
        linkedin: process.env.LINKEDIN_CLIENT_ID,
        tiktok: process.env.TIKTOK_CLIENT_KEY
      };
      
      const tokenData = {
        client_id: clientIds[platform],
        client_secret: clientSecrets[platform],
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      };
      
      const response = await axios.post(tokenUrls[platform], tokenData);
      
      return {
        success: true,
        data: response.data
      };
      
    } catch (error) {
      logger.error(`Token exchange error for ${platform}:`, error);
      throw new Error(`Gagal menukar kode untuk token ${platform}: ${error.message}`);
    }
  }
  
  /**
   * Get user profile from platform
   * @param {String} platform - Social media platform
   * @param {String} accessToken - Access token
   * @returns {Object} User profile data
   */
  async getUserProfile(platform, accessToken) {
    try {
      const profileUrls = {
        facebook: 'https://graph.facebook.com/me?fields=id,name,email,picture',
        twitter: 'https://api.twitter.com/2/users/me',
        instagram: 'https://graph.instagram.com/me?fields=id,username',
        linkedin: 'https://api.linkedin.com/v2/people/~',
        tiktok: 'https://open-api.tiktok.com/user/info/'
      };
      
      const headers = {
        Authorization: `Bearer ${accessToken}`
      };
      
      const response = await axios.get(profileUrls[platform], { headers });
      
      return {
        success: true,
        data: this.normalizeProfileData(platform, response.data)
      };
      
    } catch (error) {
      logger.error(`Get profile error for ${platform}:`, error);
      throw new Error(`Gagal mengambil profil ${platform}: ${error.message}`);
    }
  }
  
  /**
   * Post content to platform
   * @param {String} platform - Social media platform
   * @param {String} accessToken - Access token
   * @param {Object} content - Content to post
   * @returns {Object} Post result
   */
  async postContent(platform, accessToken, content) {
    try {
      const { message, imageUrl, link, hashtags = [] } = content;
      
      const postData = this.formatContentForPlatform(platform, {
        message,
        imageUrl,
        link,
        hashtags
      });
      
      const postUrls = {
        facebook: 'https://graph.facebook.com/me/feed',
        twitter: 'https://api.twitter.com/2/tweets',
        instagram: 'https://graph.instagram.com/me/media',
        linkedin: 'https://api.linkedin.com/v2/ugcPosts',
        tiktok: 'https://open-api.tiktok.com/share/video/upload/'
      };
      
      const headers = {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      };
      
      const response = await axios.post(postUrls[platform], postData, { headers });
      
      logger.info(`Content posted to ${platform}`, {
        platform,
        postId: response.data.id,
        message: message.substring(0, 50)
      });
      
      return {
        success: true,
        data: {
          postId: response.data.id,
          platform,
          postedAt: new Date(),
          response: response.data
        }
      };
      
    } catch (error) {
      logger.error(`Post content error for ${platform}:`, error);
      throw new Error(`Gagal posting ke ${platform}: ${error.message}`);
    }
  }
  
  /**
   * Get post analytics
   * @param {String} platform - Social media platform
   * @param {String} accessToken - Access token
   * @param {String} postId - Post ID
   * @returns {Object} Analytics data
   */
  async getPostAnalytics(platform, accessToken, postId) {
    try {
      const analyticsUrls = {
        facebook: `https://graph.facebook.com/${postId}/insights`,
        twitter: `https://api.twitter.com/2/tweets/${postId}?tweet.fields=public_metrics`,
        instagram: `https://graph.instagram.com/${postId}/insights`,
        linkedin: `https://api.linkedin.com/v2/socialActions/${postId}`,
        tiktok: `https://open-api.tiktok.com/video/data/?video_id=${postId}`
      };
      
      const headers = {
        Authorization: `Bearer ${accessToken}`
      };
      
      const response = await axios.get(analyticsUrls[platform], { headers });
      
      return {
        success: true,
        data: this.normalizeAnalyticsData(platform, response.data)
      };
      
    } catch (error) {
      logger.error(`Get analytics error for ${platform}:`, error);
      throw new Error(`Gagal mengambil analytics ${platform}: ${error.message}`);
    }
  }
  
  /**
   * Refresh access token
   * @param {String} platform - Social media platform
   * @param {String} refreshToken - Refresh token
   * @returns {Object} New token data
   */
  async refreshAccessToken(platform, refreshToken) {
    try {
      // Implementation varies by platform
      // Some platforms don't support refresh tokens
      const refreshUrls = {
        facebook: 'https://graph.facebook.com/oauth/access_token',
        twitter: 'https://api.twitter.com/2/oauth2/token',
        linkedin: 'https://www.linkedin.com/oauth/v2/accessToken'
      };
      
      if (!refreshUrls[platform]) {
        throw new Error(`Platform ${platform} tidak mendukung refresh token`);
      }
      
      const clientSecrets = {
        facebook: process.env.FACEBOOK_APP_SECRET,
        twitter: process.env.TWITTER_CLIENT_SECRET,
        linkedin: process.env.LINKEDIN_CLIENT_SECRET
      };
      
      const clientIds = {
        facebook: process.env.FACEBOOK_APP_ID,
        twitter: process.env.TWITTER_CLIENT_ID,
        linkedin: process.env.LINKEDIN_CLIENT_ID
      };
      
      const tokenData = {
        client_id: clientIds[platform],
        client_secret: clientSecrets[platform],
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      };
      
      const response = await axios.post(refreshUrls[platform], tokenData);
      
      return {
        success: true,
        data: response.data
      };
      
    } catch (error) {
      logger.error(`Refresh token error for ${platform}:`, error);
      throw new Error(`Gagal refresh token ${platform}: ${error.message}`);
    }
  }
  
  /**
   * Normalize profile data across platforms
   * @param {String} platform - Social media platform
   * @param {Object} rawData - Raw profile data
   * @returns {Object} Normalized profile data
   */
  normalizeProfileData(platform, rawData) {
    const normalized = {
      id: null,
      name: null,
      username: null,
      email: null,
      picture: null,
      platform
    };
    
    switch (platform) {
      case 'facebook':
        normalized.id = rawData.id;
        normalized.name = rawData.name;
        normalized.email = rawData.email;
        normalized.picture = rawData.picture?.data?.url;
        break;
        
      case 'twitter':
        normalized.id = rawData.data?.id;
        normalized.name = rawData.data?.name;
        normalized.username = rawData.data?.username;
        normalized.picture = rawData.data?.profile_image_url;
        break;
        
      case 'instagram':
        normalized.id = rawData.id;
        normalized.username = rawData.username;
        break;
        
      case 'linkedin':
        normalized.id = rawData.id;
        normalized.name = `${rawData.firstName?.localized?.en_US} ${rawData.lastName?.localized?.en_US}`;
        break;
        
      case 'tiktok':
        normalized.id = rawData.data?.user?.open_id;
        normalized.name = rawData.data?.user?.display_name;
        normalized.username = rawData.data?.user?.unique_id;
        normalized.picture = rawData.data?.user?.avatar_url;
        break;
    }
    
    return normalized;
  }
  
  /**
   * Format content for specific platform
   * @param {String} platform - Social media platform
   * @param {Object} content - Content to format
   * @returns {Object} Formatted content
   */
  formatContentForPlatform(platform, content) {
    const { message, imageUrl, link, hashtags } = content;
    
    switch (platform) {
      case 'facebook':
        return {
          message: `${message}\n\n${hashtags.join(' ')}`,
          link: link,
          ...(imageUrl && { picture: imageUrl })
        };
        
      case 'twitter':
        const twitterMessage = `${message} ${hashtags.join(' ')} ${link || ''}`.trim();
        return {
          text: twitterMessage.substring(0, 280) // Twitter character limit
        };
        
      case 'instagram':
        return {
          caption: `${message}\n\n${hashtags.join(' ')}`,
          image_url: imageUrl
        };
        
      case 'linkedin':
        return {
          author: 'urn:li:person:PERSON_ID', // This would be dynamic
          lifecycleState: 'PUBLISHED',
          specificContent: {
            'com.linkedin.ugc.ShareContent': {
              shareCommentary: {
                text: `${message}\n\n${hashtags.join(' ')}`
              },
              shareMediaCategory: 'NONE'
            }
          },
          visibility: {
            'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
          }
        };
        
      case 'tiktok':
        return {
          video_id: imageUrl, // For TikTok, this would be video ID
          text: `${message} ${hashtags.join(' ')}`
        };
        
      default:
        return { message, imageUrl, link, hashtags };
    }
  }
  
  /**
   * Normalize analytics data across platforms
   * @param {String} platform - Social media platform
   * @param {Object} rawData - Raw analytics data
   * @returns {Object} Normalized analytics data
   */
  normalizeAnalyticsData(platform, rawData) {
    const normalized = {
      views: 0,
      likes: 0,
      shares: 0,
      comments: 0,
      clicks: 0,
      platform
    };
    
    switch (platform) {
      case 'facebook':
        const fbData = rawData.data?.[0]?.values?.[0]?.value || {};
        normalized.views = fbData.post_impressions || 0;
        normalized.likes = fbData.post_reactions_like_total || 0;
        normalized.shares = fbData.post_shares || 0;
        normalized.comments = fbData.post_comments || 0;
        break;
        
      case 'twitter':
        const twitterMetrics = rawData.data?.public_metrics || {};
        normalized.views = twitterMetrics.impression_count || 0;
        normalized.likes = twitterMetrics.like_count || 0;
        normalized.shares = twitterMetrics.retweet_count || 0;
        normalized.comments = twitterMetrics.reply_count || 0;
        break;
        
      case 'instagram':
        const igData = rawData.data?.[0]?.values?.[0]?.value || {};
        normalized.views = igData.impressions || 0;
        normalized.likes = igData.likes || 0;
        normalized.comments = igData.comments || 0;
        break;
        
      case 'linkedin':
        normalized.views = rawData.totalShareStatistics?.impressionCount || 0;
        normalized.likes = rawData.totalShareStatistics?.likeCount || 0;
        normalized.shares = rawData.totalShareStatistics?.shareCount || 0;
        normalized.comments = rawData.totalShareStatistics?.commentCount || 0;
        break;
        
      case 'tiktok':
        const ttData = rawData.data?.list?.[0] || {};
        normalized.views = ttData.play_count || 0;
        normalized.likes = ttData.like_count || 0;
        normalized.shares = ttData.share_count || 0;
        normalized.comments = ttData.comment_count || 0;
        break;
    }
    
    return normalized;
  }
  
  /**
   * Validate platform credentials
   * @param {String} platform - Social media platform
   * @param {String} accessToken - Access token
   * @returns {Boolean} Validation result
   */
  async validateCredentials(platform, accessToken) {
    try {
      const result = await this.getUserProfile(platform, accessToken);
      return result.success;
    } catch (error) {
      logger.error(`Credential validation failed for ${platform}:`, error);
      return false;
    }
  }
  
  /**
   * Get supported platforms
   * @returns {Array} List of supported platforms
   */
  getSupportedPlatforms() {
    return Object.keys(this.platforms).map(key => ({
      key,
      ...this.platforms[key]
    }));
  }
}

// Create singleton instance
const socialMediaService = new SocialMediaService();

module.exports = socialMediaService;