const { checkTransactionStatus } = require('./midtransHelper');
const Transaction = require('../models/Transaction');
const Account = require('../models/Account');
const AuditLog = require('../models/AuditLog');

const syncTransactionStatus = async (orderId, merchantId) => {
  try {
    console.log(`Syncing status for ${orderId} with merchant ${merchantId}`);
    
    // Get status from Midtrans
    const midtransStatus = await checkTransactionStatus(merchantId, orderId);
    console.log('Midtrans status:', midtransStatus);
    
    // Map Midtrans status to our status
    let status = 'PENDING';
    const transactionStatus = midtransStatus.transaction_status;
    
    if (transactionStatus === 'capture' || 
        transactionStatus === 'settlement' ||
        transactionStatus === 'authorize') {
      status = 'SUCCESS';
    } else if (transactionStatus === 'cancel' || 
               transactionStatus === 'deny' || 
               transactionStatus === 'expire' ||
               transactionStatus === 'failure') {
      status = 'FAILED';
    } else if (transactionStatus === 'pending') {
      status = 'PENDING';
    }
    
    console.log(`Midtrans status: ${transactionStatus} -> Our status: ${status}`);
    

    
    // Update in database
    const transaction = await Transaction.findOneAndUpdate(
      { order_id: orderId },
      { 
        status,
        pg_response: midtransStatus,
        updatedAt: new Date()
      },
      { new: true }
    );
    
    if (!transaction) {
      throw new Error(`Transaction ${orderId} not found`);
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
        action: 'PAYMENT_SUCCESS_SYNC',
        order_id: orderId,
        pg_merchant_id: transaction.pg_merchant_id,
        amount: amountValue,
        details: { 
          synced_from_midtrans: true,
          midtrans_status: midtransStatus.transaction_status
        }
      });
    }
    
    console.log(`✅ Status sync completed for ${orderId}: ${status}`);
    return { success: true, status, transaction, synced: true };
    
  } catch (error) {
    // Handle 404 - transaction doesn't exist in Midtrans
    if (error.message.includes('404') || error.message.includes("doesn't exist")) {
      console.log(`⚠️ Transaction ${orderId} not found in Midtrans - skipping sync`);
      return { success: false, error: 'Transaction not found in Midtrans', skipped: true };
    }
    
    console.error(`❌ Status sync failed for ${orderId}:`, error.message);
    return { success: false, error: error.message };
  }
};

const syncAllPendingTransactions = async () => {
  try {
    console.log('🔄 Starting auto sync for all pending transactions...');
    
    // Only sync transactions that have pg_response (created via Midtrans)
    const pendingTransactions = await Transaction.find({ 
      status: 'PENDING',
      pg_response: { $exists: true, $ne: null },
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
    });
    
    console.log(`Found ${pendingTransactions.length} pending transactions with Midtrans data`);
    
    let syncedCount = 0;
    let skippedCount = 0;
    
    for (const transaction of pendingTransactions) {
      const result = await syncTransactionStatus(transaction.order_id, transaction.pg_merchant_id);
      if (result.skipped) {
        skippedCount++;
      } else if (result.success) {
        syncedCount++;
      }
      // Wait 1 second between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`✅ Auto sync completed - Synced: ${syncedCount}, Skipped: ${skippedCount}`);
    
  } catch (error) {
    console.error('❌ Auto sync failed:', error.message);
  }
};

module.exports = {
  syncTransactionStatus,
  syncAllPendingTransactions
};