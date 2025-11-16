const Account = require('../models/Account');

const seedAccounts = async () => {
  try {
    // Hapus data lama jika ada
    await Account.deleteMany({});

    // Insert data awal
    const accounts = [
      {
        pg_merchant_id: 'MERCHANT_001',
        name: 'Rekening 1',
        limit_max: 1000000, // 1 juta
        limit_used: 0,
        priority: 1,
        is_active: true
      },
      {
        pg_merchant_id: 'MERCHANT_002', 
        name: 'Rekening 2',
        limit_max: 2000000, // 2 juta
        limit_used: 0,
        priority: 2,
        is_active: true
      }
    ];

    await Account.insertMany(accounts);
    console.log('Seeder: Accounts created successfully');
  } catch (error) {
    console.error('Seeder error:', error);
  }
};

module.exports = { seedAccounts };