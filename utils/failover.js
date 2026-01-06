const Account = require('../models/Account');
const AuditLog = require('../models/AuditLog');

const selectMerchantAccount = async (amount) => {
  try {
    console.log(`🔍 Selecting PGA for amount: ${amount}`);
    
    // Get all active accounts with remaining limit info
    const accounts = await Account.find({ is_active: true }).sort({ priority: 1 });
    
    if (!accounts.length) {
      throw new Error('No active payment gateway accounts available');
    }
    
    // Calculate remaining limits for each account
    const accountsWithLimit = accounts.map(acc => {
      const limitMax = parseFloat(acc.limit_max.$numberDecimal || acc.limit_max);
      const limitUsed = parseFloat(acc.limit_used.$numberDecimal || acc.limit_used);
      const remainingLimit = limitMax - limitUsed;
      
      return {
        ...acc.toObject(),
        limit_max_num: limitMax,
        limit_used_num: limitUsed,
        remaining_limit: remainingLimit,
        can_handle: remainingLimit >= amount
      };
    });
    
    console.log('📊 Account Status:');
    accountsWithLimit.forEach(acc => {
      console.log(`  ${acc.pg_merchant_id}: ${acc.remaining_limit.toLocaleString()} remaining (${acc.can_handle ? '✅' : '❌'})`);
    });
    
    // Strategy 1: Find account with sufficient limit (priority order)
    let selectedAccount = accountsWithLimit.find(acc => acc.can_handle);
    
    if (!selectedAccount) {
      // Strategy 2: Load balancing - use account with highest remaining limit
      selectedAccount = accountsWithLimit.reduce((prev, current) => 
        (prev.remaining_limit > current.remaining_limit) ? prev : current
      );
      
      console.log(`⚠️ No single account can handle ${amount}, using highest limit: ${selectedAccount.pg_merchant_id}`);
      
      // Log insufficient limit warning
      await AuditLog.create({
        action: 'INSUFFICIENT_LIMIT_WARNING',
        pg_merchant_id: selectedAccount.pg_merchant_id,
        amount: amount,
        details: { 
          required: amount,
          available: selectedAccount.remaining_limit,
          all_accounts: accountsWithLimit.map(acc => ({
            merchant_id: acc.pg_merchant_id,
            remaining: acc.remaining_limit
          }))
        }
      });
    }
    
    console.log(`✅ Selected PGA: ${selectedAccount.pg_merchant_id} (${selectedAccount.remaining_limit.toLocaleString()} remaining)`);
    
    // Log successful selection
    await AuditLog.create({
      action: 'PGA_AUTO_SELECTED',
      pg_merchant_id: selectedAccount.pg_merchant_id,
      amount: amount,
      details: { 
        strategy: selectedAccount.can_handle ? 'sufficient_limit' : 'load_balancing',
        priority: selectedAccount.priority,
        remaining_limit: selectedAccount.remaining_limit,
        utilization_percent: ((selectedAccount.limit_used_num / selectedAccount.limit_max_num) * 100).toFixed(2)
      }
    });
    
    return {
      ...selectedAccount,
      limit_max: selectedAccount.limit_max_num,
      limit_used: selectedAccount.limit_used_num
    };
    
  } catch (error) {
    console.error('❌ PGA Selection Error:', error.message);
    throw error;
  }
};

// Function to get account utilization status
const getAccountUtilization = async () => {
  try {
    const accounts = await Account.find({ is_active: true }).sort({ priority: 1 });
    
    return accounts.map(acc => {
      const limitMax = parseFloat(acc.limit_max.$numberDecimal || acc.limit_max);
      const limitUsed = parseFloat(acc.limit_used.$numberDecimal || acc.limit_used);
      const remainingLimit = limitMax - limitUsed;
      const utilizationPercent = (limitUsed / limitMax) * 100;
      
      return {
        pg_merchant_id: acc.pg_merchant_id,
        name: acc.name,
        priority: acc.priority,
        limit_max: limitMax,
        limit_used: limitUsed,
        remaining_limit: remainingLimit,
        utilization_percent: utilizationPercent.toFixed(2),
        status: utilizationPercent >= 90 ? 'critical' : utilizationPercent >= 70 ? 'warning' : 'normal'
      };
    });
  } catch (error) {
    throw error;
  }
};

// Function to check if rebalancing is needed
const checkRebalanceNeeded = async () => {
  try {
    const utilization = await getAccountUtilization();
    
    // Check if any account is over 90% utilized while others are under 50%
    const overUtilized = utilization.filter(acc => parseFloat(acc.utilization_percent) > 90);
    const underUtilized = utilization.filter(acc => parseFloat(acc.utilization_percent) < 50);
    
    return {
      needed: overUtilized.length > 0 && underUtilized.length > 0,
      over_utilized: overUtilized,
      under_utilized: underUtilized,
      all_accounts: utilization
    };
  } catch (error) {
    throw error;
  }
};

module.exports = {
  selectMerchantAccount,
  getAccountUtilization,
  checkRebalanceNeeded
};