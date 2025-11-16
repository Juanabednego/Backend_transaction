const express = require('express');
require('dotenv').config();
const connectDB = require('./config/db');
const paymentRoutes = require('./routes/payment');
const helperRoutes = require('./routes/helper');
const adminRoutes = require('./routes/admin');
const { seedAccounts } = require('./utils/seeder');
const { setupDailyReset } = require('./utils/scheduler');

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to database
connectDB();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api', paymentRoutes);
app.use('/api', helperRoutes);
app.use('/api/admin', adminRoutes);

app.get('/', (req, res) => {
  res.json({
    message: 'Backend Sistem Transaksi API',
    endpoints: {
      'POST /api/process-payment': 'Process payment transaction',
      'POST /api/pg-callback': 'Payment gateway callback',
      'POST /api/seed': 'Seed initial data'
    }
  });
});

// Endpoint untuk seeding data (development only)
app.post('/api/seed', async (req, res) => {
  try {
    await seedAccounts();
    res.json({ success: true, message: 'Data seeded successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Setup daily reset scheduler
setupDailyReset();

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
