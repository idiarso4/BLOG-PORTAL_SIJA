const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const redis = require('redis');

let mongoServer;
let redisClient;

// Setup test environment
beforeAll(async () => {
  // Start in-memory MongoDB
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  
  // Mock Redis client
  redisClient = {
    connect: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    quit: jest.fn(),
  };
  
  // Mock external services
  jest.mock('../src/services/CacheService', () => ({
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    isAvailable: jest.fn(() => true),
  }));
  
  jest.mock('../src/services/NotificationService', () => ({
    sendEmail: jest.fn(),
    sendWelcomeEmail: jest.fn(),
    sendPasswordResetEmail: jest.fn(),
  }));
  
  jest.mock('../src/services/SocketService', () => ({
    sendToUser: jest.fn(),
    sendToArticle: jest.fn(),
    notifyNewComment: jest.fn(),
  }));
});

// Cleanup after tests
afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
  
  if (redisClient) {
    await redisClient.quit();
  }
});

// Clear database between tests
afterEach(async () => {
  const collections = mongoose.connection.collections;
  
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }
});

module.exports = {
  mongoServer,
  redisClient,
};