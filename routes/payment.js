const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const Account = require('../models/Account');
const AuditLog = require('../models/AuditLog');
const validateSignature = require('../middleware/validateSignature');
const { selectMerchantAccount } = require('../utils/failover');

// API Transaksi Utama
router.post('/process-payment', validateSignature, async (req, res) => {
  try {
    const { order_id, amount } = req.body;
    const amountDecimal = parseFloat(amount);

    // Pilih rekening merchant
    const account = await selectMerchantAccount(amountDecimal);

    // Simulasi wrapper PG (panggilan API eksternal)
    const pgResponse = {
      redirect_url: `https://payment-gateway.com/pay/${order_id}`,
      pg_transaction_id: `PG_${Date.now()}`,
      status: 'PENDING'
    };

    // Catat transaksi baru
    const transaction = await Transaction.create({
      order_id,
      amount: amountDecimal,
      pg_merchant_id: account.pg_merchant_id,
      status: 'PENDING',
      redirect_url: pgResponse.redirect_url,
      pg_response: pgResponse
    });

    // Log audit
    await AuditLog.create({
      action: 'PAYMENT_INITIATED',
      order_id,
      pg_merchant_id: account.pg_merchant_id,
      amount: amountDecimal,
      details: { transaction_id: transaction._id }
    });

    res.json({
      success: true,
      data: {
        order_id,
        redirect_url: pgResponse.redirect_url,
        pg_merchant_id: account.pg_merchant_id
      }
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
    const { order_id, status, pg_transaction_id } = req.body;

    // Update status transaksi
    const transaction = await Transaction.findOneAndUpdate(
      { order_id },
      { 
        status,
        pg_response: req.body
      },
      { new: true }
    );

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    // Jika transaksi sukses, update limit menggunakan atomic operation
    if (status === 'SUCCESS') {
      await Account.updateOne(
        { pg_merchant_id: transaction.pg_merchant_id },
        { $inc: { limit_used: transaction.amount } }
      );

      // Log audit
      await AuditLog.create({
        action: 'PAYMENT_SUCCESS',
        order_id,
        pg_merchant_id: transaction.pg_merchant_id,
        amount: transaction.amount,
        details: { pg_transaction_id }
      });
    }

    res.json({
      success: true,
      message: 'Callback processed successfully'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;