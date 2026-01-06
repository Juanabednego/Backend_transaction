const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
  try {
    // Try MongoDB Atlas first
    if (process.env.MONGODB_URI) {
      const conn = await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 5000 // 5 second timeout
      });
      console.log(`✅ MongoDB Atlas Connected: ${conn.connection.host}`);
    } else {
      throw new Error('No MongoDB URI provided');
    }
  } catch (error) {
    console.warn('⚠️ MongoDB Atlas connection failed:', error.message);
    console.log('🔄 Trying local MongoDB...');
    
    try {
      // Fallback to local MongoDB
      const conn = await mongoose.connect('mongodb://localhost:27017/transaksidb', {
        serverSelectionTimeoutMS: 3000
      });
      console.log(`✅ Local MongoDB Connected: ${conn.connection.host}`);
    } catch (localError) {
      console.warn('⚠️ Local MongoDB also failed:', localError.message);
      console.log('🔄 Using in-memory database for development...');
      
      // Use in-memory database as last resort
      try {
        const { MongoMemoryServer } = require('mongodb-memory-server');
        const mongod = await MongoMemoryServer.create();
        const uri = mongod.getUri();
        const conn = await mongoose.connect(uri);
        console.log('✅ In-Memory Database Connected (Development Mode)');
        
        // Seed data for in-memory database
        setTimeout(() => {
          const { seedAll } = require('../utils/seeder');
          seedAll().catch(console.error);
        }, 1000);
        
      } catch (memoryError) {
        console.error('❌ All database connections failed:', memoryError.message);
        console.log('💡 Please check your MongoDB installation or internet connection');
        process.exit(1);
      }
    }
  }
};

module.exports = { connectDB };