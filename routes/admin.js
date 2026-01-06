const express = require('express');
const router = express.Router();
const Account = require('../models/Account');
const Transaction = require('../models/Transaction');
const AuditLog = require('../models/AuditLog');

// Lihat semua accounts
router.get('/accounts', async (req, res) => {
  try {
    const accounts = await Account.find({});
    res.json({ success: true, data: accounts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update account (untuk mengganti payment gateway)
router.put('/accounts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const account = await Account.findByIdAndUpdate(id, updateData, { new: true });
    
    if (!account) {
      return res.status(404).json({ success: false, message: 'Account not found' });
    }

    // Log audit
    await AuditLog.create({
      action: 'ACCOUNT_UPDATED',
      pg_merchant_id: account.pg_merchant_id,
      details: { updated_fields: Object.keys(updateData) }
    });

    res.json({ success: true, data: account });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Lihat semua transactions dengan filter
router.get('/transactions', async (req, res) => {
  try {
    const { status, payment_method, start_date, end_date, has_user, page = 1, limit = 50 } = req.query;
    
    let filter = {};
    if (status) filter.status = status;
    if (payment_method) filter.payment_method = payment_method;
    if (has_user === 'true') filter.user_id = { $ne: null };
    if (has_user === 'false') filter.user_id = null;
    if (start_date || end_date) {
      filter.createdAt = {};
      if (start_date) filter.createdAt.$gte = new Date(start_date);
      if (end_date) filter.createdAt.$lte = new Date(end_date);
    }

    const skip = (page - 1) * limit;
    const transactions = await Transaction.find(filter)
      .populate('user_id', 'username email full_name phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
      
    const total = await Transaction.countDocuments(filter);
    
    // Format transactions with user info
    const formattedTransactions = transactions.map(tx => ({
      ...tx.toObject(),
      user_info: tx.user_id ? {
        username: tx.user_id.username,
        email: tx.user_id.email,
        full_name: tx.user_id.full_name,
        phone: tx.user_id.phone
      } : null
    }));
    
    res.json({ 
      success: true, 
      data: formattedTransactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Dashboard statistics
router.get('/dashboard-stats', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Statistik hari ini
    const todayStats = await Transaction.aggregate([
      {
        $match: {
          createdAt: { $gte: today, $lt: tomorrow }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: { $toDouble: '$amount' } }
        }
      }
    ]);

    // Statistik per payment gateway
    const gatewayStats = await Transaction.aggregate([
      {
        $match: {
          status: 'SUCCESS',
          createdAt: { $gte: today, $lt: tomorrow }
        }
      },
      {
        $group: {
          _id: '$pg_merchant_id',
          count: { $sum: 1 },
          totalAmount: { $sum: { $toDouble: '$amount' } }
        }
      }
    ]);

    // Format response
    let stats = {
      todayTransactions: 0,
      todayRevenue: 0,
      pendingTransactions: 0,
      successTransactions: 0,
      failedTransactions: 0
    };

    todayStats.forEach(stat => {
      if (stat._id === 'SUCCESS') {
        stats.successTransactions = stat.count;
        stats.todayRevenue = stat.totalAmount;
      } else if (stat._id === 'PENDING') {
        stats.pendingTransactions = stat.count;
      } else if (stat._id === 'FAILED') {
        stats.failedTransactions = stat.count;
      }
      stats.todayTransactions += stat.count;
    });

    res.json({ 
      success: true, 
      data: {
        ...stats,
        gatewayStats
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Laporan keuangan per gateway
router.get('/financial-report', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    let dateFilter = {};
    if (start_date || end_date) {
      dateFilter.createdAt = {};
      if (start_date) dateFilter.createdAt.$gte = new Date(start_date);
      if (end_date) dateFilter.createdAt.$lte = new Date(end_date);
    }

    const report = await Transaction.aggregate([
      { $match: { status: 'SUCCESS', ...dateFilter } },
      {
        $group: {
          _id: {
            pg_merchant_id: '$pg_merchant_id',
            payment_method: '$payment_method'
          },
          count: { $sum: 1 },
          totalAmount: { $sum: { $toDouble: '$amount' } },
          avgAmount: { $avg: { $toDouble: '$amount' } }
        }
      },
      {
        $lookup: {
          from: 'accounts',
          localField: '_id.pg_merchant_id',
          foreignField: 'pg_merchant_id',
          as: 'account'
        }
      },
      {
        $project: {
          pg_merchant_id: '$_id.pg_merchant_id',
          payment_method: '$_id.payment_method',
          account_name: { $arrayElemAt: ['$account.name', 0] },
          count: 1,
          totalAmount: 1,
          avgAmount: 1
        }
      }
    ]);

    res.json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Lihat audit logs
router.get('/audit-logs', async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * limit;
    
    const logs = await AuditLog.find({})
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(parseInt(limit));
      
    const total = await AuditLog.countDocuments();
    
    res.json({ 
      success: true, 
      data: logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Toggle account status
router.patch('/accounts/:id/toggle', async (req, res) => {
  try {
    const { id } = req.params;
    const account = await Account.findById(id);
    
    if (!account) {
      return res.status(404).json({ success: false, message: 'Account not found' });
    }

    account.is_active = !account.is_active;
    await account.save();

    // Log audit
    await AuditLog.create({
      action: account.is_active ? 'ACCOUNT_ACTIVATED' : 'ACCOUNT_DEACTIVATED',
      pg_merchant_id: account.pg_merchant_id,
      details: { new_status: account.is_active }
    });

    res.json({ success: true, data: account });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get PGA utilization status
router.get('/pga-utilization', async (req, res) => {
  try {
    const { getAccountUtilization } = require('../utils/failover');
    const utilization = await getAccountUtilization();
    
    res.json({ success: true, data: utilization });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Check if rebalancing is needed
router.get('/rebalance-check', async (req, res) => {
  try {
    const { checkRebalanceNeeded } = require('../utils/failover');
    const rebalanceInfo = await checkRebalanceNeeded();
    
    res.json({ success: true, data: rebalanceInfo });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Manual PGA selection test
router.post('/test-pga-selection', async (req, res) => {
  try {
    const { amount } = req.body;
    const { selectMerchantAccount } = require('../utils/failover');
    
    if (!amount) {
      return res.status(400).json({ success: false, message: 'Amount is required' });
    }
    
    const selectedAccount = await selectMerchantAccount(parseFloat(amount));
    
    res.json({ 
      success: true, 
      data: {
        selected_account: selectedAccount.pg_merchant_id,
        remaining_limit: selectedAccount.remaining_limit,
        can_handle: selectedAccount.remaining_limit >= amount,
        message: `PGA ${selectedAccount.pg_merchant_id} selected for amount ${amount}`
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Clear all account limits (reset used_amount to 0)
router.post('/clear-limits', async (req, res) => {
  try {
    const result = await Account.updateMany(
      {},
      { $set: { used_amount: 0 } }
    );
    
    // Log audit
    await AuditLog.create({
      action: 'LIMITS_CLEARED',
      pg_merchant_id: 'ALL',
      details: { accounts_affected: result.modifiedCount }
    });
    
    res.json({ 
      success: true, 
      message: `Successfully cleared limits for ${result.modifiedCount} accounts`,
      data: { accounts_affected: result.modifiedCount }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;