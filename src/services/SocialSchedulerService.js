const logger = require('../config/logger');
const ScheduledPost = require('../models/ScheduledPost');
const User = require('../models/User');
const SocialMediaService = require('./SocialMediaService');

class SocialSchedulerService {
  constructor() {
    this._timer = null;
    this._intervalMs = parseInt(process.env.SOCIAL_SCHEDULER_INTERVAL_MS || '30000', 10); // 30s
    this._isRunning = false;
  }

  start() {
    if (this._timer) return;
    logger.info(`SocialSchedulerService starting with interval ${this._intervalMs} ms`);
    this._timer = setInterval(() => this._tick().catch(err => logger.error('Scheduler tick error:', err)), this._intervalMs);
  }

  stop() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  async _tick() {
    if (this._isRunning) return; // prevent overlap
    this._isRunning = true;

    try {
      const now = new Date();

      // Atomically pick one job to process
      const job = await ScheduledPost.findOneAndUpdate(
        {
          status: { $in: ['pending', 'queued'] },
          scheduledAt: { $lte: now }
        },
        { $set: { status: 'queued' } },
        { sort: { scheduledAt: 1 }, new: true }
      );

      if (!job) return; // nothing to do

      const user = await User.findById(job.user);
      if (!user || !user.isActive) {
        await this._failJob(job, 'User not found or inactive');
        return;
      }

      const results = [];
      for (const platform of job.platforms) {
        try {
          const account = user.socialAccounts?.[platform];
          if (!account || !account.isActive) {
            results.push({ platform, status: 'failed', postId: null, postedAt: new Date(), error: 'Account not connected or inactive' });
            continue;
          }

          // Refresh token if needed (best-effort)
          if (account.tokenExpiry && new Date() > account.tokenExpiry && account.refreshToken) {
            try {
              const refreshResult = await SocialMediaService.refreshAccessToken(platform, account.refreshToken);
              if (refreshResult?.success) {
                account.accessToken = refreshResult.data.access_token;
                account.tokenExpiry = refreshResult.data.expires_in ? new Date(Date.now() + refreshResult.data.expires_in * 1000) : null;
                await user.save();
              }
            } catch (e) {
              // continue; we'll attempt with existing token
            }
          }

          const postResult = await SocialMediaService.postContent(platform, account.accessToken, {
            message: job.message,
            imageUrl: job.imageUrl,
            link: job.link,
            hashtags: job.hashtags || []
          });

          results.push({ platform, status: 'success', postId: postResult.data.postId, postedAt: postResult.data.postedAt, error: null });
        } catch (err) {
          logger.error(`Scheduled post to ${platform} error:`, err);
          results.push({ platform, status: 'failed', postId: null, postedAt: new Date(), error: err.message || 'Unknown error' });
        }
      }

      const successCount = results.filter(r => r.status === 'success').length;
      const failedCount = results.length - successCount;

      job.results = results;
      job.attempts += 1;

      if (failedCount === 0) {
        job.status = 'posted';
        job.lastError = null;
      } else if (job.attempts < job.maxRetries) {
        job.status = 'pending';
        job.lastError = results.find(r => r.status === 'failed')?.error || 'Posting failed';
        // simple backoff: +2 minutes
        job.scheduledAt = new Date(Date.now() + 2 * 60 * 1000);
      } else {
        job.status = 'failed';
        job.lastError = results.find(r => r.status === 'failed')?.error || 'Posting failed';
      }

      await job.save();

      logger.info('Scheduled post processed', {
        jobId: job._id.toString(),
        successCount,
        failedCount,
        attempts: job.attempts,
        status: job.status
      });
    } finally {
      this._isRunning = false;
    }
  }

  async _failJob(job, reason) {
    job.status = 'failed';
    job.lastError = reason;
    job.attempts += 1;
    await job.save();
  }
}

module.exports = new SocialSchedulerService();
