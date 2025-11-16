const Account = require('../models/Account');
const AuditLog = require('../models/AuditLog');

const selectMerchantAccount = async (amount) => {
  try {
    // Cari rekening aktif dengan sisa limit cukup, prioritas 1 dulu
    const account = await Account.findOne({
      is_active: true,
      $expr: {
        $gte: [
          { $subtract: ['$limit_max', '$limit_used'] },
          amount
        ]
      }
    }).sort({ priority: 1 });

    if (!account) {
      // Log audit jika tidak ada rekening tersedia
      await AuditLog.create({
        action: 'FAILOVER_NO_ACCOUNT',
        amount: amount,
        details: { message: 'No available account with sufficient limit' }
      });
      throw new Error('No available account with sufficient limit');
    }

    // Log audit untuk pemilihan rekening
    await AuditLog.create({
      action: 'ACCOUNT_SELECTED',
      pg_merchant_id: account.pg_merchant_id,
      amount: amount,
      details: { 
        priority: account.priority,
        remaining_limit: account.limit_max - account.limit_used
      }
    });

    return account;
  } catch (error) {
    throw error;
  }
};

module.exports = {
  selectMerchantAccount
};