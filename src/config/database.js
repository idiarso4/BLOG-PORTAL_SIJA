const mongoose = require('mongoose');

const config = {
  options: {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    maxPoolSize: 10, // Maintain up to 10 socket connections
    serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
    socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
    family: 4 // Use IPv4, skip trying IPv6
  },
  
  // Database connection for different environments
  getConnectionString: () => {
    switch (process.env.NODE_ENV) {
      case 'test':
        return process.env.MONGODB_TEST_URI;
      case 'production':
        return process.env.MONGODB_URI;
      default:
        return process.env.MONGODB_URI;
    }
  },

  // Connect to database
  connect: async () => {
    try {
      const connectionString = config.getConnectionString();
      await mongoose.connect(connectionString, config.options);
      console.log(`Connected to MongoDB: ${process.env.NODE_ENV} environment`);
    } catch (error) {
      console.error('Database connection error:', error);
      process.exit(1);
    }
  },

  // Disconnect from database
  disconnect: async () => {
    try {
      await mongoose.connection.close();
      console.log('Disconnected from MongoDB');
    } catch (error) {
      console.error('Database disconnection error:', error);
    }
  },

  // Clear database (for testing)
  clearDatabase: async () => {
    if (process.env.NODE_ENV === 'test') {
      const collections = mongoose.connection.collections;
      for (const key in collections) {
        const collection = collections[key];
        await collection.deleteMany({});
      }
    }
  }
};

module.exports = config;