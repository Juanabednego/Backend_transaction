const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI tidak ditemukan di environment variables');
    }

    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,   // tambah timeout connect
      family: 4                  // pakai IPv4 (kadang solve issue DNS)
    });

    console.log(`✅ MongoDB Atlas Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('❌ MongoDB connection FAILED:', error.name);
    console.error('Error message:', error.message);
    // Log detail lengkap error agar terlihat di runtime logs
    console.error('Full error details:', error);

    // JANGAN process.exit(1) agar app tetap jalan meski DB gagal
    // Ini memungkinkan /api/health bisa diakses untuk debug
  }
};

module.exports = { connectDB };