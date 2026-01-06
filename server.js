const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { connectDB } = require('./config/db');
const paymentRoutes = require('./routes/payment');
const adminRoutes = require('./routes/admin');
const authRoutes = require('./routes/auth');
const { seedAll } = require('./utils/seeder');
const { setupDailyReset } = require('./utils/scheduler');
const Transaction = require('./models/Transaction');
const cron = require('node-cron');

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to database with fallback
connectDB().then(() => {
  // Auto-seed database if empty
  setTimeout(async () => {
    try {
      const Account = require('./models/Account');
      const accountCount = await Account.countDocuments();
      if (accountCount === 0) {
        console.log('🌱 Database is empty, seeding initial data...');
        const { seedAll } = require('./utils/seeder');
        await seedAll();
        console.log('✅ Initial data seeded successfully');
      }
    } catch (error) {
      console.warn('⚠️ Auto-seeding failed:', error.message);
    }
  }, 2000);
}).catch(console.error);

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api', paymentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/auth', authRoutes);

app.get('/', (req, res) => {
  res.json({
    message: 'Backend Sistem Transaksi API',
    status: 'running',
    timestamp: new Date().toISOString(),
    endpoints: {
      'POST /api/process-payment': 'Process payment transaction',
      'POST /api/pg-callback': 'Payment gateway callback',
      'POST /api/seed': 'Seed initial data',
      'POST /api/create-transaction': 'Create transaction from main web',
      'GET /api/health': 'Health check endpoint'
    }
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    database: 'connected'
  });
});

// Endpoint untuk menerima data transaksi dari web utama
app.post('/api/create-transaction', async (req, res) => {
  try {
    const { order_id, amount, customer_details, item_details, user_id } = req.body;
    
    if (!order_id || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Order ID dan amount wajib diisi'
      });
    }

    // Generate URL untuk redirect ke payment page
    let paymentUrl = `http://localhost:5173/payment?order_id=${order_id}&amount=${amount}&from_web=true`;
    
    // Add user_id to URL if provided
    if (user_id) {
      paymentUrl += `&user_id=${user_id}`;
    }

    res.json({
      success: true,
      data: {
        order_id,
        payment_url: paymentUrl,
        amount: parseFloat(amount),
        user_id: user_id || null
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Endpoint untuk seeding data (development only)
app.post('/api/seed', async (req, res) => {
  try {
    await seedAll();
    res.json({ success: true, message: 'Data seeded successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Endpoint untuk mendapatkan data transaksi berdasarkan order_id
app.get('/api/transaction/:order_id', async (req, res) => {
  try {
    const { order_id } = req.params;
    const transaction = await Transaction.findOne({ order_id });
    
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaksi tidak ditemukan'
      });
    }

    res.json({
      success: true,
      data: transaction
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Setup daily reset scheduler
setupDailyReset();

// Setup auto sync scheduler
const { syncAllPendingTransactions } = require('./utils/statusSync');

// Auto sync every 2 minutes
cron.schedule('*/2 * * * *', () => {
  console.log('🔄 Running auto sync for pending transactions...');
  syncAllPendingTransactions();
});

// Manual sync endpoint
app.post('/api/force-sync', async (req, res) => {
  try {
    console.log('🔄 Manual sync triggered');
    await syncAllPendingTransactions();
    res.json({ success: true, message: 'Manual sync completed' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

console.log('✅ Auto sync scheduler started (every 2 minutes)');

// Debug endpoint untuk melihat raw Midtrans response
app.get('/api/debug/transaction/:order_id', async (req, res) => {
  try {
    const { order_id } = req.params;
    const transaction = await Transaction.findOne({ order_id }).populate('user_id', 'username email full_name phone');
    
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    res.json({
      success: true,
      data: {
        order_id: transaction.order_id,
        user_id: transaction.user_id,
        user_info: transaction.user_id ? {
          id: transaction.user_id._id,
          username: transaction.user_id.username,
          email: transaction.user_id.email,
          full_name: transaction.user_id.full_name,
          phone: transaction.user_id.phone
        } : null,
        payment_method: transaction.payment_method,
        pg_merchant_id: transaction.pg_merchant_id,
        raw_midtrans_response: transaction.pg_response
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Debug endpoint untuk melihat semua transaksi dengan user info
app.get('/api/debug/all-transactions', async (req, res) => {
  try {
    const transactions = await Transaction.find({})
      .populate('user_id', 'username email full_name phone')
      .sort({ createdAt: -1 })
      .limit(10);
    
    const formattedTransactions = transactions.map(tx => ({
      order_id: tx.order_id,
      user_id: tx.user_id?._id || null,
      user_info: tx.user_id ? {
        username: tx.user_id.username,
        email: tx.user_id.email,
        full_name: tx.user_id.full_name,
        phone: tx.user_id.phone
      } : null,
      amount: tx.amount,
      status: tx.status,
      createdAt: tx.createdAt
    }));
    
    res.json({
      success: true,
      data: formattedTransactions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
