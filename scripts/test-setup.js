#!/usr/bin/env node

/**
 * Script untuk testing setup project
 * Menguji koneksi database, redis, dan konfigurasi dasar
 */

require('dotenv').config();
const mongoose = require('mongoose');
const redisClient = require('../src/config/redis');
const logger = require('../src/config/logger');

async function testSetup() {
  console.log('🧪 Testing Blog Express Setup...\n');

  // Test 1: Environment Variables
  console.log('1. Testing Environment Variables...');
  const requiredEnvVars = [
    'NODE_ENV',
    'PORT',
    'MONGODB_URI',
    'JWT_SECRET',
    'REDIS_HOST',
    'REDIS_PORT'
  ];

  let envTestPassed = true;
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      console.log(`   ❌ Missing: ${envVar}`);
      envTestPassed = false;
    } else {
      console.log(`   ✅ Found: ${envVar}`);
    }
  }

  if (!envTestPassed) {
    console.log('\n❌ Environment variables test failed!');
    process.exit(1);
  }

  // Test 2: MongoDB Connection
  console.log('\n2. Testing MongoDB Connection...');
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('   ✅ MongoDB connected successfully');
    await mongoose.connection.close();
    console.log('   ✅ MongoDB disconnected successfully');
  } catch (error) {
    console.log('   ❌ MongoDB connection failed:', error.message);
    process.exit(1);
  }

  // Test 3: Redis Connection
  console.log('\n3. Testing Redis Connection...');
  try {
    await redisClient.connect();
    console.log('   ✅ Redis connected successfully');
    
    // Test Redis operations
    await redisClient.set('test_key', 'test_value', 10);
    const value = await redisClient.get('test_key');
    
    if (value === 'test_value') {
      console.log('   ✅ Redis operations working');
    } else {
      console.log('   ❌ Redis operations failed');
    }
    
    await redisClient.del('test_key');
    await redisClient.disconnect();
    console.log('   ✅ Redis disconnected successfully');
  } catch (error) {
    console.log('   ⚠️  Redis connection failed (optional):', error.message);
    console.log('   ℹ️  Redis is optional for development');
  }

  // Test 4: Logger
  console.log('\n4. Testing Logger...');
  try {
    logger.info('Test log message');
    console.log('   ✅ Logger working successfully');
  } catch (error) {
    console.log('   ❌ Logger failed:', error.message);
  }

  // Test 5: File Structure
  console.log('\n5. Testing File Structure...');
  const fs = require('fs');
  const path = require('path');
  
  const requiredDirs = [
    'src/config',
    'src/middleware',
    'src/routes',
    'src/views',
    'uploads',
    'public',
    'logs'
  ];

  let fileTestPassed = true;
  for (const dir of requiredDirs) {
    if (fs.existsSync(path.join(__dirname, '..', dir))) {
      console.log(`   ✅ Directory exists: ${dir}`);
    } else {
      console.log(`   ❌ Directory missing: ${dir}`);
      fileTestPassed = false;
    }
  }

  if (!fileTestPassed) {
    console.log('\n❌ File structure test failed!');
    process.exit(1);
  }

  console.log('\n🎉 All tests passed! Blog Express setup is ready.');
  console.log('\n📝 Next steps:');
  console.log('   1. Run: npm install');
  console.log('   2. Configure your .env file');
  console.log('   3. Start MongoDB and Redis services');
  console.log('   4. Run: npm run dev');
  console.log('   5. Visit: http://localhost:3000');
  
  process.exit(0);
}

// Handle errors
process.on('unhandledRejection', (err) => {
  console.log('\n❌ Unhandled Promise Rejection:', err.message);
  process.exit(1);
});

// Run tests
testSetup();