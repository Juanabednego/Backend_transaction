const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Import connectDB untuk database
const { connectDB } = require('./config/db');

// Import semua router dari folder routes
const paymentRoutes = require('./routes/payment');
const adminRoutes = require('./routes/admin');
const authRoutes = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware global
app.use(cors({ origin: '*' })); // untuk test, nanti bisa restrict origin
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Hubungkan routes dengan prefix yang jelas
app.use('/api/payment', paymentRoutes);   // semua endpoint di payment.js diawali /api/payment
app.use('/api/admin', adminRoutes);       // diawali /api/admin
app.use('/api/auth', authRoutes);         // diawali /api/auth

// Root route (untuk test server hidup)
app.get('/', (req, res) => {
  res.json({
    message: 'Backend Sistem Transaksi API berjalan!',
    status: 'online',
    timestamp: new Date().toISOString()
  });
});

// Health check endpoint (untuk monitoring)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    nodeVersion: process.version
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

// Connect ke database (jalankan sekali saat server start)
connectDB();