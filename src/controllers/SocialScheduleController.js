const ScheduledPost = require('../models/ScheduledPost');
const Article = require('../models/Article');
const logger = require('../config/logger');

class SocialScheduleController {
  // POST /api/social-media/schedule
  static async schedulePost(req, res) {
    try {
      const { platforms, message, imageUrl, link, hashtags = [], articleId = null, scheduledAt } = req.body;

      if (!Array.isArray(platforms) || platforms.length === 0) {
        return res.status(400).json({ success: false, error: { code: 'PLATFORMS_REQUIRED', message: 'Minimal satu platform harus dipilih' } });
      }
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ success: false, error: { code: 'MESSAGE_REQUIRED', message: 'Pesan wajib diisi' } });
      }
      const when = new Date(scheduledAt);
      if (!scheduledAt || isNaN(when.getTime()) || when < new Date(Date.now() + 15000)) {
        return res.status(400).json({ success: false, error: { code: 'INVALID_SCHEDULED_AT', message: 'Waktu penjadwalan tidak valid (minimal 15 detik dari sekarang)' } });
      }

      if (articleId) {
        const article = await Article.findById(articleId);
        if (!article || (article.penulis.toString() !== req.user._id.toString() && req.user.role !== 'admin')) {
          return res.status(403).json({ success: false, error: { code: 'ARTICLE_ACCESS_DENIED', message: 'Anda tidak memiliki akses ke artikel ini' } });
        }
      }

      const scheduled = await ScheduledPost.create({
        user: req.user._id,
        platforms,
        message,
        imageUrl: imageUrl || null,
        link: link || null,
        hashtags,
        article: articleId || null,
        scheduledAt: when,
        status: 'pending',
        attempts: 0
      });

      res.status(201).json({ success: true, message: 'Posting terjadwal berhasil dibuat', data: { id: scheduled._id, status: scheduled.status, scheduledAt: scheduled.scheduledAt } });
    } catch (error) {
      logger.error('Schedule post error:', error);
      res.status(500).json({ success: false, error: { code: 'SCHEDULE_ERROR', message: 'Terjadi kesalahan saat membuat jadwal posting' } });
    }
  }

  // GET /api/social-media/schedule
  static async listScheduledPosts(req, res) {
    try {
      const { status, from, to, page = 1, limit = 20 } = req.query;
      const query = { user: req.user._id };
      if (status) query.status = status;
      if (from || to) {
        query.scheduledAt = {};
        if (from) query.scheduledAt.$gte = new Date(from);
        if (to) query.scheduledAt.$lte = new Date(to);
      }

      const items = await ScheduledPost.find(query)
        .sort({ scheduledAt: -1 })
        .limit(Math.min(parseInt(limit, 10) || 20, 100))
        .skip(((parseInt(page, 10) || 1) - 1) * (parseInt(limit, 10) || 20));

      res.json({ success: true, data: { items } });
    } catch (error) {
      logger.error('List scheduled posts error:', error);
      res.status(500).json({ success: false, error: { code: 'LIST_SCHEDULE_ERROR', message: 'Terjadi kesalahan saat mengambil daftar jadwal' } });
    }
  }

  // POST /api/social-media/schedule/:id/cancel
  static async cancelScheduledPost(req, res) {
    try {
      const { id } = req.params;
      const sched = await ScheduledPost.findOne({ _id: id, user: req.user._id });
      if (!sched) return res.status(404).json({ success: false, error: { code: 'SCHEDULE_NOT_FOUND', message: 'Jadwal tidak ditemukan' } });
      if (!['pending', 'queued'].includes(sched.status)) {
        return res.status(400).json({ success: false, error: { code: 'CANNOT_CANCEL', message: `Tidak dapat membatalkan status: ${sched.status}` } });
      }
      sched.status = 'canceled';
      await sched.save();
      res.json({ success: true, message: 'Jadwal berhasil dibatalkan' });
    } catch (error) {
      logger.error('Cancel scheduled post error:', error);
      res.status(500).json({ success: false, error: { code: 'CANCEL_SCHEDULE_ERROR', message: 'Terjadi kesalahan saat membatalkan jadwal' } });
    }
  }

  // POST /api/social-media/schedule/:id/reschedule
  static async reschedulePost(req, res) {
    try {
      const { id } = req.params;
      const { scheduledAt } = req.body;
      const when = new Date(scheduledAt);
      if (!scheduledAt || isNaN(when.getTime()) || when < new Date(Date.now() + 15000)) {
        return res.status(400).json({ success: false, error: { code: 'INVALID_SCHEDULED_AT', message: 'Waktu penjadwalan tidak valid (minimal 15 detik dari sekarang)' } });
      }
      const sched = await ScheduledPost.findOne({ _id: id, user: req.user._id });
      if (!sched) return res.status(404).json({ success: false, error: { code: 'SCHEDULE_NOT_FOUND', message: 'Jadwal tidak ditemukan' } });
      if (!['pending', 'queued'].includes(sched.status)) {
        return res.status(400).json({ success: false, error: { code: 'CANNOT_RESCHEDULE', message: `Tidak dapat menjadwal ulang status: ${sched.status}` } });
      }
      sched.scheduledAt = when;
      sched.status = 'pending';
      await sched.save();
      res.json({ success: true, message: 'Jadwal berhasil diubah', data: { scheduledAt: sched.scheduledAt } });
    } catch (error) {
      logger.error('Reschedule post error:', error);
      res.status(500).json({ success: false, error: { code: 'RESCHEDULE_ERROR', message: 'Terjadi kesalahan saat mengubah jadwal' } });
    }
  }
}

module.exports = SocialScheduleController;
