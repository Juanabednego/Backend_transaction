// server.js versi test minimal (comment routes sementara)

const express = require('express');
require('dotenv').config();
const { connectDB } = require('./config/db');

// Comment dulu ini supaya tidak crash saat require routes
// const paymentRoutes = require('./routes/payment');
// const adminRoutes = require('./routes/admin');
// const authRoutes = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());

// Root route
app.get('/', (req, res) => {
  res.json({ message: 'Backend Sistem Transaksi API berjalan!' });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

// Connect DB
connectDB();
