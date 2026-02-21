// server.js (bagian yang relevan)

const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { connectDB } = require('./config/db');

// Import semua router dari folder routes
const paymentRoutes = require('./routes/payment');  // ← hubungkan ke payment.js
const adminRoutes = require('./routes/admin');      // ← hubungkan ke admin.js
const authRoutes = require('./routes/auth');        // ← hubungkan ke auth.js

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Hubungkan routes ke path tertentu
app.use('/api/payment', paymentRoutes);   // semua endpoint di payment.js akan diawali /api/payment
app.use('/api/admin', adminRoutes);       // diawali /api/admin
app.use('/api/auth', authRoutes);         // diawali /api/auth

// Contoh root route (opsional)
app.get('/', (req, res) => {
  res.json({ message: 'Backend Sistem Transaksi API berjalan!' });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

// Connect DB (dari kode kamu sebelumnya)
connectDB();
