const mongoose = require('mongoose');
const Comment = require('../../src/models/Comment');
const User = require('../../src/models/User');
const { MongoMemoryServer } = require('mongodb-memory-server');

describe('Comment Model', () => {
  let mongoServer;
  let testUser;
  let testArticle;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await Comment.deleteMany({});
    await User.deleteMany({});
    
    // Create test user
    testUser = new User({
      username: 'testcommenter',
      email: 'commenter@example.com',
      password: 'Password123',
      profile: {
        nama: 'Test Commenter'
      }
    });
    await testUser.save();
    
    // Create mock article ID
    testArticle = new mongoose.Types.ObjectId();
  });

  describe('Comment Creation', () => {
    it('should create a comment with valid data', async () => {
      const commentData = {
        artikel: testArticle,
        penulis: testUser._id,
        konten: 'This is a test comment'
      };

      const comment = new Comment(commentData);
      const savedComment = await comment.save();

      expect(savedComment._id).toBeDefined();
      expect(savedComment.konten).toBe('This is a test comment');
      expect(savedComment.status).toBe('pending'); // default status
      expect(savedComment.likes).toBe(0); // default likes
      expect(savedComment.dislikes).toBe(0); // default dislikes
      expect(savedComment.spamScore).toBeDefined();
      expect(savedComment.parent).toBeNull(); // default no parent
    });

    it('should calculate spam score automatically', async () => {
      const spamContent = 'CLICK HERE FOR FREE MONEY! CONGRATULATIONS! You won the lottery! Visit https://spam.com';
      
      const commentData = {
        artikel: testArticle,
        penulis: testUser._id,
        konten: spamContent
      };

      const comment = new Comment(commentData);
      const savedComment = await comment.save();

      expect(savedComment.spamScore).toBeGreaterThan(50);
      expect(savedComment.status).toBe('spam'); // Auto-marked as spam
    });

    it('should create nested comment (reply)', async () => {
      // Create parent comment
      const parentComment = new Comment({
        artikel: testArticle,
        penulis: testUser._id,
        konten: 'Parent comment'
      });
      await parentComment.save();

      // Create reply
      const replyData = {
        artikel: testArticle,
        penulis: testUser._id,
        konten: 'This is a reply',
        parent: parentComment._id
      };

      const reply = new Comment(replyData);
      const savedReply = await reply.save();

      expect(savedReply.parent.toString()).toBe(parentComment._id.toString());
    });

    it('should create guest comment', async () => {
      const commentData = {
        artikel: testArticle,
        konten: 'Guest comment',
        guestInfo: {
          nama: 'Guest User',
          email: 'guest@example.com',
          website: 'https://example.com'
        }
      };

      const comment = new Comment(commentData);
      const savedComment = await comment.save();

      expect(savedComment.guestInfo.nama).toBe('Guest User');
      expect(savedComment.guestInfo.email).toBe('guest@example.com');
      expect(savedComment.isGuest).toBe(true);
    });
  });

  describe('Comment Validation', () => {
    it('should require artikel', async () => {
      const commentData = {
        penulis: testUser._id,
        konten: 'Test comment'
      };

      const comment = new Comment(commentData);
      
      await expect(comment.save()).rejects.toThrow('Artikel wajib diisi');
    });

    it('should require konten', async () => {
      const commentData = {
        artikel: testArticle,
        penulis: testUser._id
      };

      const comment = new Comment(commentData);
      
      await expect(comment.save()).rejects.toThrow('Konten komentar wajib diisi');
    });

    it('should validate konten length', async () => {
      const longContent = 'A'.repeat(1001); // Too long
      
      const commentData = {
        artikel: testArticle,
        penulis: testUser._id,
        konten: longContent
      };

      const comment = new Comment(commentData);
      
      await expect(comment.save()).rejects.toThrow('Komentar maksimal 1000 karakter');
    });

    it('should validate status enum', async () => {
      const commentData = {
        artikel: testArticle,
        penulis: testUser._id,
        konten: 'Test comment',
        status: 'invalid_status'
      };

      const comment = new Comment(commentData);
      
      await expect(comment.save()).rejects.toThrow();
    });

    it('should validate guest email format', async () => {
      const commentData = {
        artikel: testArticle,
        konten: 'Guest comment',
        guestInfo: {
          nama: 'Guest User',
          email: 'invalid-email'
        }
      };

      const comment = new Comment(commentData);
      
      await expect(comment.save()).rejects.toThrow('Format email tidak valid');
    });
  });

  describe('Comment Methods', () => {
    let comment;
    let anotherUser;

    beforeEach(async () => {
      comment = new Comment({
        artikel: testArticle,
        penulis: testUser._id,
        konten: 'Test comment for methods'
      });
      await comment.save();

      anotherUser = new User({
        username: 'anotheruser',
        email: 'another@example.com',
        password: 'Password123',
        profile: {
          nama: 'Another User'
        }
      });
      await anotherUser.save();
    });

    it('should like comment', async () => {
      expect(comment.likes).toBe(0);
      expect(comment.likedBy).toHaveLength(0);
      
      await comment.likeComment(anotherUser._id);
      
      expect(comment.likes).toBe(1);
      expect(comment.likedBy).toHaveLength(1);
      expect(comment.likedBy[0].toString()).toBe(anotherUser._id.toString());
    });

    it('should dislike comment', async () => {
      expect(comment.dislikes).toBe(0);
      expect(comment.dislikedBy).toHaveLength(0);
      
      await comment.dislikeComment(anotherUser._id);
      
      expect(comment.dislikes).toBe(1);
      expect(comment.dislikedBy).toHaveLength(1);
      expect(comment.dislikedBy[0].toString()).toBe(anotherUser._id.toString());
    });

    it('should remove like when disliking', async () => {
      // First like
      await comment.likeComment(anotherUser._id);
      expect(comment.likes).toBe(1);
      
      // Then dislike (should remove like)
      await comment.dislikeComment(anotherUser._id);
      expect(comment.likes).toBe(0);
      expect(comment.dislikes).toBe(1);
    });

    it('should remove like/dislike', async () => {
      await comment.likeComment(anotherUser._id);
      expect(comment.likes).toBe(1);
      
      await comment.removeLikeDislike(anotherUser._id);
      expect(comment.likes).toBe(0);
      expect(comment.likedBy).toHaveLength(0);
    });

    it('should approve comment', async () => {
      expect(comment.status).toBe('pending');
      
      await comment.approve(testUser._id, 'Approved by moderator');
      
      expect(comment.status).toBe('approved');
      expect(comment.moderatedBy.toString()).toBe(testUser._id.toString());
      expect(comment.moderatedAt).toBeDefined();
      expect(comment.moderationNote).toBe('Approved by moderator');
    });

    it('should reject comment', async () => {
      await comment.reject(testUser._id, 'Inappropriate content');
      
      expect(comment.status).toBe('rejected');
      expect(comment.moderationNote).toBe('Inappropriate content');
    });

    it('should mark as spam', async () => {
      await comment.markAsSpam(testUser._id, 'Detected as spam');
      
      expect(comment.status).toBe('spam');
      expect(comment.moderationNote).toBe('Detected as spam');
    });

    it('should edit comment', async () => {
      const originalContent = comment.konten;
      const newContent = 'Updated comment content';
      
      await comment.editComment(newContent, 'Fixed typo');
      
      expect(comment.konten).toBe(newContent);
      expect(comment.metadata.edited).toBe(true);
      expect(comment.metadata.editedAt).toBeDefined();
      expect(comment.metadata.editHistory).toHaveLength(1);
      expect(comment.metadata.editHistory[0].konten).toBe(originalContent);
      expect(comment.metadata.editHistory[0].reason).toBe('Fixed typo');
    });

    it('should get replies', async () => {
      // Create replies
      const reply1 = new Comment({
        artikel: testArticle,
        penulis: testUser._id,
        konten: 'Reply 1',
        parent: comment._id,
        status: 'approved'
      });
      await reply1.save();

      const reply2 = new Comment({
        artikel: testArticle,
        penulis: anotherUser._id,
        konten: 'Reply 2',
        parent: comment._id,
        status: 'approved'
      });
      await reply2.save();

      const replies = await comment.getReplies();
      
      expect(replies).toHaveLength(2);
      expect(replies.map(r => r.konten)).toContain('Reply 1');
      expect(replies.map(r => r.konten)).toContain('Reply 2');
    });

    it('should get all replies recursively', async () => {
      // Create reply
      const reply = new Comment({
        artikel: testArticle,
        penulis: testUser._id,
        konten: 'Reply',
        parent: comment._id,
        status: 'approved'
      });
      await reply.save();

      // Create nested reply
      const nestedReply = new Comment({
        artikel: testArticle,
        penulis: anotherUser._id,
        konten: 'Nested Reply',
        parent: reply._id,
        status: 'approved'
      });
      await nestedReply.save();

      const allReplies = await comment.getAllReplies();
      
      expect(allReplies).toHaveLength(2);
      expect(allReplies.map(r => r.konten)).toContain('Reply');
      expect(allReplies.map(r => r.konten)).toContain('Nested Reply');
    });
  });

  describe('Comment Virtuals', () => {
    let comment;

    beforeEach(async () => {
      comment = new Comment({
        artikel: testArticle,
        penulis: testUser._id,
        konten: 'Test comment',
        likes: 10,
        dislikes: 3
      });
      await comment.save();
    });

    it('should calculate net likes', () => {
      expect(comment.netLikes).toBe(7); // 10 - 3
    });

    it('should determine approved status', async () => {
      expect(comment.isApproved).toBe(false); // Default is pending
      
      await comment.approve(testUser._id);
      expect(comment.isApproved).toBe(true);
    });

    it('should determine guest status', () => {
      expect(comment.isGuest).toBe(false); // Has penulis
      
      const guestComment = new Comment({
        artikel: testArticle,
        konten: 'Guest comment',
        guestInfo: { nama: 'Guest' }
      });
      
      expect(guestComment.isGuest).toBe(true);
    });
  });

  describe('Comment Statics', () => {
    beforeEach(async () => {
      // Create test comments
      const comments = [
        {
          artikel: testArticle,
          penulis: testUser._id,
          konten: 'Approved comment 1',
          status: 'approved',
          likes: 5
        },
        {
          artikel: testArticle,
          penulis: testUser._id,
          konten: 'Approved comment 2',
          status: 'approved',
          likes: 3
        },
        {
          artikel: testArticle,
          penulis: testUser._id,
          konten: 'Pending comment',
          status: 'pending'
        },
        {
          artikel: testArticle,
          penulis: testUser._id,
          konten: 'Spam comment',
          status: 'spam',
          spamScore: 80
        }
      ];

      const savedComments = await Comment.insertMany(comments);

      // Create reply
      await Comment.create({
        artikel: testArticle,
        penulis: testUser._id,
        konten: 'Reply to first comment',
        parent: savedComments[0]._id,
        status: 'approved'
      });
    });

    it('should get article comments', async () => {
      const comments = await Comment.getArticleComments(testArticle);
      
      expect(comments).toHaveLength(2); // Only approved root comments
      comments.forEach(comment => {
        expect(comment.status).toBe('approved');
        expect(comment.parent).toBeNull();
      });
    });

    it('should get comment tree', async () => {
      const tree = await Comment.getCommentTree(testArticle);
      
      expect(tree).toHaveLength(2); // Root comments
      expect(tree[0].replies).toHaveLength(1); // First comment has 1 reply
      expect(tree[0].replies[0].konten).toBe('Reply to first comment');
    });

    it('should get pending comments', async () => {
      const pendingComments = await Comment.getPendingComments();
      
      expect(pendingComments).toHaveLength(1);
      expect(pendingComments[0].status).toBe('pending');
    });

    it('should get spam comments', async () => {
      const spamComments = await Comment.getSpamComments();
      
      expect(spamComments).toHaveLength(1);
      expect(spamComments[0].status).toBe('spam');
    });

    it('should get comment statistics', async () => {
      const stats = await Comment.getStatistics();
      
      expect(stats.totalComments).toBe(5);
      expect(stats.approvedComments).toBe(3); // Including reply
      expect(stats.pendingComments).toBe(1);
      expect(stats.spamComments).toBe(1);
      expect(stats.totalLikes).toBe(8); // 5 + 3 + 0 + 0 + 0
    });

    it('should bulk moderate comments', async () => {
      const pendingComment = await Comment.findOne({ status: 'pending' });
      
      await Comment.bulkModerate([pendingComment._id], 'approve', testUser._id, 'Bulk approved');
      
      const updatedComment = await Comment.findById(pendingComment._id);
      expect(updatedComment.status).toBe('approved');
      expect(updatedComment.moderationNote).toBe('Bulk approved');
    });
  });

  describe('Spam Detection', () => {
    it('should detect spam keywords', async () => {
      const spamContent = 'Free money! Click here to win the lottery!';
      
      const comment = new Comment({
        artikel: testArticle,
        penulis: testUser._id,
        konten: spamContent
      });

      comment.calculateSpamScore();
      
      expect(comment.spamScore).toBeGreaterThan(30);
    });

    it('should detect URL spam', async () => {
      const urlSpamContent = 'Check out https://spam1.com and https://spam2.com and https://spam3.com';
      
      const comment = new Comment({
        artikel: testArticle,
        penulis: testUser._id,
        konten: urlSpamContent
      });

      comment.calculateSpamScore();
      
      expect(comment.spamScore).toBeGreaterThan(20);
    });

    it('should detect excessive caps', async () => {
      const capsContent = 'THIS IS ALL CAPS SPAM MESSAGE!!!';
      
      const comment = new Comment({
        artikel: testArticle,
        penulis: testUser._id,
        konten: capsContent
      });

      comment.calculateSpamScore();
      
      expect(comment.spamScore).toBeGreaterThan(10);
    });

    it('should auto-mark high spam score as spam', async () => {
      const highSpamContent = 'FREE MONEY! CLICK HERE! CONGRATULATIONS! You won the lottery! Visit https://spam.com and https://spam2.com';
      
      const comment = new Comment({
        artikel: testArticle,
        penulis: testUser._id,
        konten: highSpamContent
      });
      
      await comment.save();
      
      expect(comment.spamScore).toBeGreaterThanOrEqual(70);
      expect(comment.status).toBe('spam');
    });
  });
});