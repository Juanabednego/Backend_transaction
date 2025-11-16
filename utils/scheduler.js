const cron = require('node-cron');
const Account = require('../models/Account');
const AuditLog = require('../models/AuditLog');

const setupDailyReset = () => {
  // Reset setiap hari pukul 00:00
  cron.schedule('0 0 * * *', async () => {
    try {
      const result = await Account.updateMany(
        {},
        { 
          $set: { 
            limit_used: 0, 
            last_reset: new Date() 
          } 
        }
      );

      // Log audit
      await AuditLog.create({
        action: 'DAILY_RESET',
        details: { 
          accounts_reset: result.modifiedCount,
          reset_time: new Date()
        }
      });

      console.log(`Daily reset completed: ${result.modifiedCount} accounts reset`);
    } catch (error) {
      console.error('Daily reset error:', error);
    }
  });

  console.log('Daily reset scheduler initialized');
};

module.exports = { setupDailyReset };