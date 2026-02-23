const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const Account = require('../models/Account');
const AuditLog = require('../models/AuditLog');
// const validateSignature = require('../middleware/validateSignature'); // Disabled for now
const { selectMerchantAccount } = require('../utils/failover');
const { createMidtransTransaction, validateMidtransNotification } = require('../utils/midtransHelper');

const extractVirtualAccount = (midtransResponse, paymentMethod) => {
  if (!midtransResponse) return null;

  console.log('Extracting VA for method:', paymentMethod);
  console.log('Midtrans response:', JSON.stringify(midtransResponse, null, 2));

  // Extract VA number based on payment method
  switch (paymentMethod) {
    case 'bca_va':
      return midtransResponse.va_numbers?.[0]?.va_number || midtransResponse.bca_va_number;
    case 'bni_va':
      return midtransResponse.va_numbers?.[0]?.va_number;
    case 'bri_va':
      return midtransResponse.va_numbers?.[0]?.va_number;
    case 'mandiri_va':
      return midtransResponse.bill_key || midtransResponse.biller_code;
    case 'permata_va':
      return midtransResponse.permata_va_number;
    default:
      // Generic fallback
      if (midtransResponse.va_numbers && midtransResponse.va_numbers.length > 0) {
        return midtransResponse.va_numbers[0].va_number;
      }
      return midtransResponse.bca_va_number || midtransResponse.permata_va_number || null;
  }
};

const getPaymentInstructions = (paymentMethod, orderId, amount, midtransResponse) => {
  return {
    method: paymentMethod,
    order_id: orderId,
    amount: amount,
    virtual_account: extractVirtualAccount(midtransResponse, paymentMethod),
    midtrans_data: midtransResponse
  };
};

// API Transaksi Utama
router.post('/process-payment', async (req, res) => {
  try {
    const { order_id, amount, payment_method, user_id } = req.body;
    const amountDecimal = parseFloat(amount);

    // Cek apakah transaksi sudah ada
    let transaction = await Transaction.findOne({ order_id });

    if (!transaction) {
      // Pilih rekening merchant
      const account = await selectMerchantAccount(amountDecimal);

      // Panggilan ke Midtrans Snap API
      const pgResponse = await createMidtransTransaction(account.pg_merchant_id, {
        order_id,
        amount: amountDecimal,
        customer_details: req.body.customer_details,
        item_details: req.body.item_details,
        payment_method
      });

      // Catat transaksi baru
      transaction = await Transaction.create({
        order_id,
        user_id: user_id || null,
        amount: amountDecimal,
        pg_merchant_id: account.pg_merchant_id,
        status: 'PENDING',
        redirect_url: pgResponse.redirect_url,
        pg_response: pgResponse,
        payment_method,
        customer_details: req.body.customer_details,
        item_details: req.body.item_details
      });

      // Log audit
      await AuditLog.create({
        action: 'PAYMENT_INITIATED',
        order_id,
        pg_merchant_id: account.pg_merchant_id,
        amount: amountDecimal,
        details: { transaction_id: transaction._id, payment_method }
      });
    }

    // Generate payment URL untuk redirect ke frontend
    const frontendUrl = process.env.FRONTEND_URL || 'https://smeruu.com';
    const paymentUrl = `${frontendUrl}/payment?order_id=${order_id}&user_id=${user_id || ''}`;

    res.json({
      success: true,
      data: {
        order_id,
        user_id: user_id || null,
        payment_method: transaction.payment_method,
        pg_merchant_id: transaction.pg_merchant_id,
        amount: amountDecimal,
        status: 'PENDING',
        payment_url: paymentUrl,
        midtrans_response: transaction.pg_response,
        virtual_account: extractVirtualAccount(transaction.pg_response, transaction.payment_method),
        raw_midtrans_response: transaction.pg_response,
        instructions: getPaymentInstructions(transaction.payment_method, order_id, amountDecimal, transaction.pg_response)
      }
    });

  } catch (error) {
    console.error('Payment processing error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// API untuk mendapatkan status transaksi
router.get('/transaction-status/:order_id', async (req, res) => {
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
      data: {
        order_id: transaction.order_id,
        amount: transaction.amount,
        status: transaction.status,
        payment_method: transaction.payment_method,
        created_at: transaction.createdAt,
        updated_at: transaction.updatedAt
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Update user_id untuk transaksi yang sudah ada
router.post('/update-user-id', async (req, res) => {
  try {
    const { order_id, user_id } = req.body;

    console.log(`Updating user_id for transaction: ${order_id} -> ${user_id}`);

    const transaction = await Transaction.findOneAndUpdate(
      { order_id },
      { user_id: user_id || null, updatedAt: new Date() },
      { new: true }
    );

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    console.log(`User ID update successful: ${order_id}`);

    res.json({
      success: true,
      message: 'User ID updated successfully',
      data: transaction
    });
  } catch (error) {
    console.error('User ID update error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Manual status update untuk testing
router.post('/update-status', async (req, res) => {
  try {
    const { order_id, status } = req.body;

    console.log(`Manual status update: ${order_id} -> ${status}`);

    const transaction = await Transaction.findOneAndUpdate(
      { order_id },
      { status, updatedAt: new Date() },
      { new: true }
    );

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    // Update limit if SUCCESS
    if (status === 'SUCCESS') {
      const amountValue = parseFloat(transaction.amount.$numberDecimal || transaction.amount);

      await Account.updateOne(
        { pg_merchant_id: transaction.pg_merchant_id },
        { $inc: { limit_used: amountValue } }
      );

      // Log audit
      await AuditLog.create({
        action: 'PAYMENT_SUCCESS_MANUAL',
        order_id,
        pg_merchant_id: transaction.pg_merchant_id,
        amount: amountValue,
        details: {
          manual_update: true,
          payment_method: transaction.payment_method
        }
      });
    }

    console.log(`Manual update successful: ${order_id}`);

    res.json({
      success: true,
      message: 'Status updated successfully',
      data: transaction
    });
  } catch (error) {
    console.error('Manual update error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Auto sync status dengan Midtrans
router.post('/sync-status/:order_id', async (req, res) => {
  try {
    const { order_id } = req.params;
    const { syncTransactionStatus } = require('../utils/statusSync');

    // Get transaction to find merchant ID
    const transaction = await Transaction.findOne({ order_id });
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    // Sync with Midtrans
    const result = await syncTransactionStatus(order_id, transaction.pg_merchant_id);

    res.json({
      success: result.success,
      message: result.success ? 'Status synced successfully' : 'Sync failed',
      data: result.transaction,
      error: result.error
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Auto sync semua pending transactions
router.post('/sync-all-pending', async (req, res) => {
  try {
    const { syncAllPendingTransactions } = require('../utils/statusSync');

    // Run sync in background
    syncAllPendingTransactions();

    res.json({
      success: true,
      message: 'Auto sync started for all pending transactions'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// API IPN/Webhook
router.post('/pg-callback', async (req, res) => {
  try {
    console.log('=== MIDTRANS CALLBACK RECEIVED ===');
    console.log('Full callback data:', JSON.stringify(req.body, null, 2));

    const { order_id, transaction_status, fraud_status } = req.body;

    if (!order_id) {
      console.log('ERROR: No order_id in callback');
      return res.status(400).json({ success: false, message: 'No order_id' });
    }

    // Tentukan status berdasarkan response Midtrans
    let status = 'PENDING';
    if (transaction_status === 'capture' || transaction_status === 'settlement') {
      status = 'SUCCESS';
    } else if (transaction_status === 'cancel' || transaction_status === 'deny' || transaction_status === 'expire') {
      status = 'FAILED';
    }

    console.log(`Processing: ${order_id} | Midtrans Status: ${transaction_status} | Our Status: ${status}`);

    // Update status transaksi
    const transaction = await Transaction.findOneAndUpdate(
      { order_id },
      {
        status,
        pg_response: req.body,
        updatedAt: new Date()
      },
      { new: true }
    );

    if (!transaction) {
      console.log(`ERROR: Transaction ${order_id} not found in database`);
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    console.log(`SUCCESS: Transaction ${order_id} updated to ${status}`);

    // Jika transaksi sukses, update limit
    if (status === 'SUCCESS') {
      const amountValue = parseFloat(transaction.amount.$numberDecimal || transaction.amount);

      await Account.updateOne(
        { pg_merchant_id: transaction.pg_merchant_id },
        { $inc: { limit_used: amountValue } }
      );

      console.log(`Updated limit for merchant: ${transaction.pg_merchant_id}`);

      // Log audit
      await AuditLog.create({
        action: 'PAYMENT_SUCCESS',
        order_id,
        pg_merchant_id: transaction.pg_merchant_id,
        amount: amountValue,
        details: {
          transaction_status,
          fraud_status,
          payment_method: transaction.payment_method,
          callback_time: new Date()
        }
      });
    }

    res.json({
      success: true,
      message: 'Callback processed successfully',
      data: { order_id, status }
    });

  } catch (error) {
    console.error('CALLBACK ERROR:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
module.exports.extractVirtualAccount = extractVirtualAccount;