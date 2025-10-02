const nodemailer = require('nodemailer');
const logger = require('../config/logger');

/**
 * Email Service untuk mengirim berbagai jenis email
 */
class EmailService {

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
        host: process.env.MAIL_HOST,
        port: process.env.MAIL_PORT,
        secure: process.env.MAIL_PORT == 465, // true for 465, false for other ports
        auth: {
          user: process.env.MAIL_USERNAME,
          pass: process.env.MAIL_PASSWORD
        }
      });

      // Verify connection
      this.transporter.verify((error, success) => {
        if (error) {
          logger.error('Email transporter verification failed:', error);
        } else {
          logger.info('Email transporter is ready');
        }
      });

    } catch (error) {
      logger.error('Failed to initialize email transporter:', error);
    }
  }

  /**
   * Send email
   * @param {Object} options - Email options
   */
  async sendEmail(options) {
    try {
      if (!this.transporter) {
        throw new Error('Email transporter not initialized');
      }

      const mailOptions = {
        from: `${process.env.MAIL_FROM_NAME} <${process.env.MAIL_FROM_ADDRESS}>`,
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

      return result;

    } catch (error) {
      logger.error('Failed to send email:', error);
      throw error;
    }
  }

  /**
   * Send email verification email
   * @param {String} email - User email
   * @param {String} token - Verification token
   * @param {String} username - Username
   */
  async sendVerificationEmail(email, token, username) {
    const verificationUrl = `${process.env.APP_URL}/api/auth/verify-email/${token}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verifikasi Email - ${process.env.APP_NAME}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #007bff; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px 20px; background: #f8f9fa; }
          .button { display: inline-block; padding: 12px 30px; background: #007bff; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { padding: 20px; text-align: center; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${process.env.APP_NAME}</h1>
          </div>
          <div class="content">
            <h2>Verifikasi Email Anda</h2>
            <p>Halo ${username},</p>
            <p>Terima kasih telah mendaftar di ${process.env.APP_NAME}. Untuk melengkapi proses registrasi, silakan verifikasi email Anda dengan mengklik tombol di bawah ini:</p>
            <p style="text-align: center;">
              <a href="${verificationUrl}" class="button">Verifikasi Email</a>
            </p>
            <p>Atau salin dan tempel link berikut di browser Anda:</p>
            <p style="word-break: break-all; background: #e9ecef; padding: 10px; border-radius: 3px;">
              ${verificationUrl}
            </p>
            <p><strong>Link ini akan kedaluwarsa dalam 24 jam.</strong></p>
            <p>Jika Anda tidak mendaftar di ${process.env.APP_NAME}, abaikan email ini.</p>
          </div>
          <div class="footer">
            <p>&copy; 2024 ${process.env.APP_NAME}. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Verifikasi Email - ${process.env.APP_NAME}
      
      Halo ${username},
      
      Terima kasih telah mendaftar di ${process.env.APP_NAME}. Untuk melengkapi proses registrasi, silakan verifikasi email Anda dengan mengunjungi link berikut:
      
      ${verificationUrl}
      
      Link ini akan kedaluwarsa dalam 24 jam.
      
      Jika Anda tidak mendaftar di ${process.env.APP_NAME}, abaikan email ini.
    `;

    return this.sendEmail({
      to: email,
      subject: `Verifikasi Email - ${process.env.APP_NAME}`,
      html,
      text
    });
  }

  /**
   * Send password reset email
   * @param {String} email - User email
   * @param {String} token - Reset token
   * @param {String} username - Username
   */
  async sendPasswordResetEmail(email, token, username) {
    const resetUrl = `${process.env.APP_URL}/reset-password?token=${token}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Password - ${process.env.APP_NAME}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #dc3545; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px 20px; background: #f8f9fa; }
          .button { display: inline-block; padding: 12px 30px; background: #dc3545; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { padding: 20px; text-align: center; color: #666; font-size: 14px; }
          .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${process.env.APP_NAME}</h1>
          </div>
          <div class="content">
            <h2>Reset Password</h2>
            <p>Halo ${username},</p>
            <p>Kami menerima permintaan untuk reset password akun Anda. Klik tombol di bawah ini untuk membuat password baru:</p>
            <p style="text-align: center;">
              <a href="${resetUrl}" class="button">Reset Password</a>
            </p>
            <p>Atau salin dan tempel link berikut di browser Anda:</p>
            <p style="word-break: break-all; background: #e9ecef; padding: 10px; border-radius: 3px;">
              ${resetUrl}
            </p>
            <div class="warning">
              <strong>Penting:</strong>
              <ul>
                <li>Link ini akan kedaluwarsa dalam 1 jam</li>
                <li>Jika Anda tidak meminta reset password, abaikan email ini</li>
                <li>Password Anda tidak akan berubah sampai Anda mengklik link di atas</li>
              </ul>
            </div>
          </div>
          <div class="footer">
            <p>&copy; 2024 ${process.env.APP_NAME}. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Reset Password - ${process.env.APP_NAME}
      
      Halo ${username},
      
      Kami menerima permintaan untuk reset password akun Anda. Kunjungi link berikut untuk membuat password baru:
      
      ${resetUrl}
      
      PENTING:
      - Link ini akan kedaluwarsa dalam 1 jam
      - Jika Anda tidak meminta reset password, abaikan email ini
      - Password Anda tidak akan berubah sampai Anda mengklik link di atas
    `;

    return this.sendEmail({
      to: email,
      subject: `Reset Password - ${process.env.APP_NAME}`,
      html,
      text
    });
  }

  /**
   * Send welcome email
   * @param {String} email - User email
   * @param {String} username - Username
   */
  async sendWelcomeEmail(email, username) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Selamat Datang - ${process.env.APP_NAME}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #28a745; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px 20px; background: #f8f9fa; }
          .button { display: inline-block; padding: 12px 30px; background: #28a745; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { padding: 20px; text-align: center; color: #666; font-size: 14px; }
          .features { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Selamat Datang di ${process.env.APP_NAME}!</h1>
          </div>
          <div class="content">
            <h2>Halo ${username}!</h2>
            <p>Selamat datang di ${process.env.APP_NAME}! Kami sangat senang Anda bergabung dengan komunitas kami.</p>
            
            <div class="features">
              <h3>Apa yang bisa Anda lakukan:</h3>
              <ul>
                <li>📝 Membaca artikel-artikel menarik</li>
                <li>💬 Berinteraksi dengan komentar</li>
                <li>🔖 Menyimpan artikel favorit</li>
                <li>✍️ Menulis artikel (untuk penulis)</li>
                <li>🤖 Menggunakan AI untuk generate konten</li>
              </ul>
            </div>
            
            <p style="text-align: center;">
              <a href="${process.env.APP_URL}" class="button">Mulai Jelajahi</a>
            </p>
            
            <p>Jika Anda memiliki pertanyaan, jangan ragu untuk menghubungi tim support kami.</p>
            <p>Selamat menjelajah!</p>
          </div>
          <div class="footer">
            <p>&copy; 2024 ${process.env.APP_NAME}. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Selamat Datang di ${process.env.APP_NAME}!
      
      Halo ${username}!
      
      Selamat datang di ${process.env.APP_NAME}! Kami sangat senang Anda bergabung dengan komunitas kami.
      
      Apa yang bisa Anda lakukan:
      - Membaca artikel-artikel menarik
      - Berinteraksi dengan komentar
      - Menyimpan artikel favorit
      - Menulis artikel (untuk penulis)
      - Menggunakan AI untuk generate konten
      
      Mulai jelajahi: ${process.env.APP_URL}
      
      Jika Anda memiliki pertanyaan, jangan ragu untuk menghubungi tim support kami.
      
      Selamat menjelajah!
    `;

    return this.sendEmail({
      to: email,
      subject: `Selamat Datang di ${process.env.APP_NAME}!`,
      html,
      text
    });
  }

  /**
   * Send notification email
   * @param {String} email - User email
   * @param {String} subject - Email subject
   * @param {String} message - Email message
   * @param {String} username - Username
   */
  async sendNotificationEmail(email, subject, message, username) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject} - ${process.env.APP_NAME}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #6c757d; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px 20px; background: #f8f9fa; }
          .footer { padding: 20px; text-align: center; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${process.env.APP_NAME}</h1>
          </div>
          <div class="content">
            <h2>${subject}</h2>
            <p>Halo ${username},</p>
            <div>${message}</div>
          </div>
          <div class="footer">
            <p>&copy; 2024 ${process.env.APP_NAME}. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      ${subject} - ${process.env.APP_NAME}
      
      Halo ${username},
      
      ${message.replace(/<[^>]*>/g, '')}
    `;

    return this.sendEmail({
      to: email,
      subject: `${subject} - ${process.env.APP_NAME}`,
      html,
      text
    });
  }

  /**
   * Send role change notification
   * @param {String} email - User email
   * @param {String} name - User name
   * @param {String} oldRole - Old role
   * @param {String} newRole - New role
   */
  async sendRoleChangeNotification(email, name, oldRole, newRole) {
    const roleNames = {
      admin: 'Administrator',
      penulis: 'Penulis',
      pembaca: 'Pembaca'
    };

    const subject = 'Perubahan Role Akun';
    const message = `
      <p>Role akun Anda telah diubah oleh administrator.</p>
      <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
        <p><strong>Role Lama:</strong> ${roleNames[oldRole]}</p>
        <p><strong>Role Baru:</strong> ${roleNames[newRole]}</p>
      </div>
      <p>Perubahan ini akan berlaku pada login berikutnya.</p>
    `;

    return this.sendCustomEmail(email, name, subject, message);
  }

  /**
   * Send account status notification
   * @param {String} email - User email
   * @param {String} name - User name
   * @param {String} action - Action performed
   * @param {String} reason - Reason for action
   */
  async sendAccountStatusNotification(email, name, action, reason) {
    const actionMessages = {
      block: 'Akun Anda telah diblokir oleh administrator.',
      unblock: 'Akun Anda telah dibuka blokirnya oleh administrator.',
      activate: 'Akun Anda telah diaktifkan oleh administrator.',
      deactivate: 'Akun Anda telah dinonaktifkan oleh administrator.'
    };

    const subject = 'Perubahan Status Akun';
    const message = `
      <p>${actionMessages[action]}</p>
      ${reason ? `<div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
        <p><strong>Alasan:</strong> ${reason}</p>
      </div>` : ''}
      <p>Jika Anda memiliki pertanyaan, silakan hubungi administrator.</p>
    `;

    return this.sendCustomEmail(email, name, subject, message);
  }
}

// Create singleton instance
const emailService = new EmailService();

module.exports = emailService;