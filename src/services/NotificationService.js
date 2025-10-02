const nodemailer = require('nodemailer');
const logger = require('../config/logger');
const User = require('../models/User');
const Article = require('../models/Article');
const Comment = require('../models/Comment');

/**
 * Notification Service untuk email notifications
 */
class NotificationService {
  
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }
  
  /**
   * Initialize email transporter
   */
  initializeTransporter() {
    try {
      this.transporter = nodemailer.createTransporter({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: process.env.SMTP_PORT || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
      
      // Verify connection
      this.transporter.verify((error, success) => {
        if (error) {
          logger.error('SMTP connection error:', error);
        } else {
          logger.info('SMTP server is ready to send emails');
        }
      });
      
    } catch (error) {
      logger.error('Failed to initialize email transporter:', error);
    }
  }
  
  /**
   * Send email notification
   * @param {Object} options - Email options
   * @returns {Promise} Send result
   */
  async sendEmail(options) {
    try {
      if (!this.transporter) {
        throw new Error('Email transporter not initialized');
      }
      
      const mailOptions = {
        from: `"${process.env.APP_NAME || 'Blog Platform'}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text
      };
      
      const result = await this.transporter.sendMail(mailOptions);
      
      logger.info('Email sent successfully', {
        to: options.to,
        subject: options.subject,
        messageId: result.messageId
      });
      
      return {
        success: true,
        messageId: result.messageId
      };
      
    } catch (error) {
      logger.error('Failed to send email:', error);
      throw error;
    }
  }
  
  /**
   * Send welcome email to new user
   * @param {Object} user - User object
   * @returns {Promise} Send result
   */
  async sendWelcomeEmail(user) {
    try {
      const html = this.generateWelcomeEmailTemplate(user);
      
      return await this.sendEmail({
        to: user.email,
        subject: `Selamat datang di ${process.env.APP_NAME || 'Blog Platform'}!`,
        html
      });
      
    } catch (error) {
      logger.error('Failed to send welcome email:', error);
      throw error;
    }
  }
  
  /**
   * Send email verification
   * @param {Object} user - User object
   * @param {String} verificationToken - Verification token
   * @returns {Promise} Send result
   */
  async sendEmailVerification(user, verificationToken) {
    try {
      const verificationUrl = `${process.env.APP_URL}/auth/verify-email?token=${verificationToken}`;
      const html = this.generateEmailVerificationTemplate(user, verificationUrl);
      
      return await this.sendEmail({
        to: user.email,
        subject: 'Verifikasi Email Anda',
        html
      });
      
    } catch (error) {
      logger.error('Failed to send email verification:', error);
      throw error;
    }
  }
  
  /**
   * Send password reset email
   * @param {Object} user - User object
   * @param {String} resetToken - Reset token
   * @returns {Promise} Send result
   */
  async sendPasswordResetEmail(user, resetToken) {
    try {
      const resetUrl = `${process.env.APP_URL}/auth/reset-password?token=${resetToken}`;
      const html = this.generatePasswordResetTemplate(user, resetUrl);
      
      return await this.sendEmail({
        to: user.email,
        subject: 'Reset Password Anda',
        html
      });
      
    } catch (error) {
      logger.error('Failed to send password reset email:', error);
      throw error;
    }
  }
  
  /**
   * Send new comment notification
   * @param {Object} comment - Comment object
   * @param {Object} article - Article object
   * @param {Object} author - Article author
   * @returns {Promise} Send result
   */
  async sendNewCommentNotification(comment, article, author) {
    try {
      // Don't send notification if author commented on their own article
      if (comment.author.toString() === author._id.toString()) {
        return { success: true, skipped: true };
      }
      
      const html = this.generateNewCommentTemplate(comment, article, author);
      
      return await this.sendEmail({
        to: author.email,
        subject: `Komentar baru di artikel "${article.judul}"`,
        html
      });
      
    } catch (error) {
      logger.error('Failed to send new comment notification:', error);
      throw error;
    }
  }
  
  /**
   * Send comment reply notification
   * @param {Object} reply - Reply comment object
   * @param {Object} originalComment - Original comment object
   * @param {Object} article - Article object
   * @returns {Promise} Send result
   */
  async sendCommentReplyNotification(reply, originalComment, article) {
    try {
      // Don't send notification if replying to own comment
      if (reply.author.toString() === originalComment.author._id.toString()) {
        return { success: true, skipped: true };
      }
      
      const html = this.generateCommentReplyTemplate(reply, originalComment, article);
      
      return await this.sendEmail({
        to: originalComment.author.email,
        subject: `Balasan komentar di artikel "${article.judul}"`,
        html
      });
      
    } catch (error) {
      logger.error('Failed to send comment reply notification:', error);
      throw error;
    }
  }
  
  /**
   * Send article like notification
   * @param {Object} user - User who liked
   * @param {Object} article - Article object
   * @param {Object} author - Article author
   * @returns {Promise} Send result
   */
  async sendArticleLikeNotification(user, article, author) {
    try {
      // Don't send notification if author liked their own article
      if (user._id.toString() === author._id.toString()) {
        return { success: true, skipped: true };
      }
      
      const html = this.generateArticleLikeTemplate(user, article, author);
      
      return await this.sendEmail({
        to: author.email,
        subject: `${user.profile.nama || user.username} menyukai artikel Anda`,
        html
      });
      
    } catch (error) {
      logger.error('Failed to send article like notification:', error);
      throw error;
    }
  }
  
  /**
   * Send subscription confirmation email
   * @param {String} email - User email
   * @param {String} name - User name
   * @param {Object} plan - Subscription plan
   * @param {Date} expiryDate - Subscription expiry date
   * @returns {Promise} Send result
   */
  async sendSubscriptionConfirmation(email, name, plan, expiryDate) {
    try {
      const html = this.generateSubscriptionConfirmationTemplate(name, plan, expiryDate);
      
      return await this.sendEmail({
        to: email,
        subject: `Konfirmasi Langganan ${plan.name}`,
        html
      });
      
    } catch (error) {
      logger.error('Failed to send subscription confirmation:', error);
      throw error;
    }
  }
  
  /**
   * Send subscription expiry reminder
   * @param {String} email - User email
   * @param {String} name - User name
   * @param {Object} plan - Subscription plan
   * @param {Date} expiryDate - Subscription expiry date
   * @returns {Promise} Send result
   */
  async sendSubscriptionReminder(email, name, plan, expiryDate) {
    try {
      const daysLeft = Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24));
      const html = this.generateSubscriptionReminderTemplate(name, plan, expiryDate, daysLeft);
      
      return await this.sendEmail({
        to: email,
        subject: `Langganan ${plan.name} akan berakhir dalam ${daysLeft} hari`,
        html
      });
      
    } catch (error) {
      logger.error('Failed to send subscription reminder:', error);
      throw error;
    }
  }
  
  /**
   * Send subscription expired notification
   * @param {String} email - User email
   * @param {String} name - User name
   * @returns {Promise} Send result
   */
  async sendSubscriptionExpired(email, name) {
    try {
      const html = this.generateSubscriptionExpiredTemplate(name);
      
      return await this.sendEmail({
        to: email,
        subject: 'Langganan Anda telah berakhir',
        html
      });
      
    } catch (error) {
      logger.error('Failed to send subscription expired notification:', error);
      throw error;
    }
  }
  
  /**
   * Send subscription cancellation confirmation
   * @param {String} email - User email
   * @param {String} name - User name
   * @param {Object} plan - Subscription plan
   * @param {Date} accessUntil - Access until date
   * @returns {Promise} Send result
   */
  async sendSubscriptionCancellation(email, name, plan, accessUntil) {
    try {
      const html = this.generateSubscriptionCancellationTemplate(name, plan, accessUntil);
      
      return await this.sendEmail({
        to: email,
        subject: `Konfirmasi Pembatalan Langganan ${plan.name}`,
        html
      });
      
    } catch (error) {
      logger.error('Failed to send subscription cancellation:', error);
      throw error;
    }
  }
  
  /**
   * Send subscription renewal confirmation
   * @param {String} email - User email
   * @param {String} name - User name
   * @param {Object} plan - Subscription plan
   * @param {Date} newExpiryDate - New expiry date
   * @returns {Promise} Send result
   */
  async sendSubscriptionRenewal(email, name, plan, newExpiryDate) {
    try {
      const html = this.generateSubscriptionRenewalTemplate(name, plan, newExpiryDate);
      
      return await this.sendEmail({
        to: email,
        subject: `Langganan ${plan.name} berhasil diperpanjang`,
        html
      });
      
    } catch (error) {
      logger.error('Failed to send subscription renewal:', error);
      throw error;
    }
  }
  
  /**
   * Send weekly digest email
   * @param {Object} user - User object
   * @param {Array} articles - Popular articles
   * @param {Object} stats - User stats
   * @returns {Promise} Send result
   */
  async sendWeeklyDigest(user, articles, stats) {
    try {
      const html = this.generateWeeklyDigestTemplate(user, articles, stats);
      
      return await this.sendEmail({
        to: user.email,
        subject: 'Ringkasan Mingguan - Blog Platform',
        html
      });
      
    } catch (error) {
      logger.error('Failed to send weekly digest:', error);
      throw error;
    }
  }
  
  // Email Template Generators
  
  generateWelcomeEmailTemplate(user) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Selamat Datang</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Selamat Datang di ${process.env.APP_NAME || 'Blog Platform'}!</h1>
          </div>
          <div class="content">
            <h2>Halo ${user.profile.nama || user.username}!</h2>
            <p>Terima kasih telah bergabung dengan platform blog kami. Kami sangat senang Anda menjadi bagian dari komunitas penulis dan pembaca yang berkembang.</p>
            
            <h3>Apa yang bisa Anda lakukan:</h3>
            <ul>
              <li>✍️ Menulis artikel dengan bantuan AI</li>
              <li>📊 Melihat analytics artikel Anda</li>
              <li>💬 Berinteraksi dengan pembaca melalui komentar</li>
              <li>🚀 Mengintegrasikan dengan social media</li>
              <li>📈 Mengoptimalkan SEO artikel</li>
            </ul>
            
            <p>Mulai perjalanan menulis Anda hari ini!</p>
            
            <a href="${process.env.APP_URL}/dashboard" class="button">Masuk ke Dashboard</a>
            
            <p>Jika Anda memiliki pertanyaan, jangan ragu untuk menghubungi tim support kami.</p>
            
            <p>Salam hangat,<br>Tim ${process.env.APP_NAME || 'Blog Platform'}</p>
          </div>
          <div class="footer">
            <p>&copy; 2024 ${process.env.APP_NAME || 'Blog Platform'}. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
  
  generateEmailVerificationTemplate(user, verificationUrl) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Verifikasi Email</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #28a745; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .button { display: inline-block; background: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Verifikasi Email Anda</h1>
          </div>
          <div class="content">
            <h2>Halo ${user.profile.nama || user.username}!</h2>
            <p>Untuk menyelesaikan pendaftaran Anda, silakan verifikasi alamat email Anda dengan mengklik tombol di bawah ini:</p>
            
            <a href="${verificationUrl}" class="button">Verifikasi Email</a>
            
            <p>Atau salin dan tempel link berikut di browser Anda:</p>
            <p style="word-break: break-all; background: #f8f9fa; padding: 10px; border-radius: 5px;">${verificationUrl}</p>
            
            <p>Link verifikasi ini akan kedaluwarsa dalam 24 jam.</p>
            
            <p>Jika Anda tidak mendaftar di platform kami, abaikan email ini.</p>
            
            <p>Salam,<br>Tim ${process.env.APP_NAME || 'Blog Platform'}</p>
          </div>
          <div class="footer">
            <p>&copy; 2024 ${process.env.APP_NAME || 'Blog Platform'}. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
  
  generatePasswordResetTemplate(user, resetUrl) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Reset Password</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #dc3545; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .button { display: inline-block; background: #dc3545; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Reset Password</h1>
          </div>
          <div class="content">
            <h2>Halo ${user.profile.nama || user.username}!</h2>
            <p>Kami menerima permintaan untuk mereset password akun Anda. Klik tombol di bawah ini untuk membuat password baru:</p>
            
            <a href="${resetUrl}" class="button">Reset Password</a>
            
            <p>Atau salin dan tempel link berikut di browser Anda:</p>
            <p style="word-break: break-all; background: #f8f9fa; padding: 10px; border-radius: 5px;">${resetUrl}</p>
            
            <p>Link reset ini akan kedaluwarsa dalam 1 jam.</p>
            
            <p>Jika Anda tidak meminta reset password, abaikan email ini. Password Anda tidak akan berubah.</p>
            
            <p>Salam,<br>Tim ${process.env.APP_NAME || 'Blog Platform'}</p>
          </div>
          <div class="footer">
            <p>&copy; 2024 ${process.env.APP_NAME || 'Blog Platform'}. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
  
  generateNewCommentTemplate(comment, article, author) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Komentar Baru</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #17a2b8; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .comment-box { background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #17a2b8; }
          .button { display: inline-block; background: #17a2b8; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>💬 Komentar Baru</h1>
          </div>
          <div class="content">
            <h2>Halo ${author.profile.nama || author.username}!</h2>
            <p><strong>${comment.author.profile.nama || comment.author.username}</strong> memberikan komentar di artikel Anda:</p>
            
            <h3>"${article.judul}"</h3>
            
            <div class="comment-box">
              <p><strong>Komentar:</strong></p>
              <p>${comment.konten}</p>
            </div>
            
            <a href="${process.env.APP_URL}/blog/${article.slug}#comments" class="button">Lihat Komentar</a>
            
            <p>Anda dapat membalas komentar ini langsung di artikel Anda.</p>
            
            <p>Salam,<br>Tim ${process.env.APP_NAME || 'Blog Platform'}</p>
          </div>
          <div class="footer">
            <p>&copy; 2024 ${process.env.APP_NAME || 'Blog Platform'}. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
  
  generateSubscriptionConfirmationTemplate(name, plan, expiryDate) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Konfirmasi Langganan</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #ffc107; color: #333; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .plan-box { background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0; border: 2px solid #ffc107; }
          .button { display: inline-block; background: #ffc107; color: #333; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Langganan Berhasil!</h1>
          </div>
          <div class="content">
            <h2>Halo ${name}!</h2>
            <p>Selamat! Langganan Anda telah berhasil diaktifkan.</p>
            
            <div class="plan-box">
              <h3>📋 Detail Langganan:</h3>
              <p><strong>Paket:</strong> ${plan.name}</p>
              <p><strong>Deskripsi:</strong> ${plan.description}</p>
              <p><strong>Berlaku hingga:</strong> ${expiryDate ? new Date(expiryDate).toLocaleDateString('id-ID') : 'Selamanya'}</p>
            </div>
            
            <p>Anda sekarang dapat menikmati semua fitur premium yang tersedia dalam paket ${plan.name}.</p>
            
            <a href="${process.env.APP_URL}/dashboard" class="button">Masuk ke Dashboard</a>
            
            <p>Terima kasih telah mempercayai platform kami!</p>
            
            <p>Salam,<br>Tim ${process.env.APP_NAME || 'Blog Platform'}</p>
          </div>
          <div class="footer">
            <p>&copy; 2024 ${process.env.APP_NAME || 'Blog Platform'}. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
  
  generateWeeklyDigestTemplate(user, articles, stats) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Ringkasan Mingguan</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .stats-box { background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0; }
          .article-item { border-bottom: 1px solid #eee; padding: 15px 0; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📊 Ringkasan Mingguan</h1>
          </div>
          <div class="content">
            <h2>Halo ${user.profile.nama || user.username}!</h2>
            <p>Berikut adalah ringkasan aktivitas Anda minggu ini:</p>
            
            <div class="stats-box">
              <h3>📈 Statistik Anda:</h3>
              <p><strong>Artikel ditulis:</strong> ${stats.articlesWritten || 0}</p>
              <p><strong>Total views:</strong> ${stats.totalViews || 0}</p>
              <p><strong>Komentar diterima:</strong> ${stats.commentsReceived || 0}</p>
              <p><strong>Likes diterima:</strong> ${stats.likesReceived || 0}</p>
            </div>
            
            ${articles && articles.length > 0 ? `
              <h3>🔥 Artikel Populer Minggu Ini:</h3>
              ${articles.map(article => `
                <div class="article-item">
                  <h4>${article.judul}</h4>
                  <p>${article.views || 0} views • ${article.commentCount || 0} komentar</p>
                </div>
              `).join('')}
            ` : ''}
            
            <a href="${process.env.APP_URL}/dashboard" class="button">Lihat Dashboard</a>
            
            <p>Tetap semangat menulis dan berbagi!</p>
            
            <p>Salam,<br>Tim ${process.env.APP_NAME || 'Blog Platform'}</p>
          </div>
          <div class="footer">
            <p>&copy; 2024 ${process.env.APP_NAME || 'Blog Platform'}. All rights reserved.</p>
            <p><a href="${process.env.APP_URL}/unsubscribe">Unsubscribe</a> dari email mingguan</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
  
  // Additional template generators for other notification types...
  generateCommentReplyTemplate(reply, originalComment, article) {
    // Implementation for comment reply template
    return this.generateNewCommentTemplate(reply, article, originalComment.author);
  }
  
  generateArticleLikeTemplate(user, article, author) {
    // Implementation for article like template
    return `<!-- Article like notification template -->`;
  }
  
  generateSubscriptionReminderTemplate(name, plan, expiryDate, daysLeft) {
    // Implementation for subscription reminder template
    return `<!-- Subscription reminder template -->`;
  }
  
  generateSubscriptionExpiredTemplate(name) {
    // Implementation for subscription expired template
    return `<!-- Subscription expired template -->`;
  }
  
  generateSubscriptionCancellationTemplate(name, plan, accessUntil) {
    // Implementation for subscription cancellation template
    return `<!-- Subscription cancellation template -->`;
  }
  
  generateSubscriptionRenewalTemplate(name, plan, newExpiryDate) {
    // Implementation for subscription renewal template
    return `<!-- Subscription renewal template -->`;
  }
}

// Create singleton instance
const notificationService = new NotificationService();

module.exports = notificationService;