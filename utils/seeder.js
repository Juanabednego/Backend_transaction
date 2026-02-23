const Account = require('../models/Account');
const Transaction = require('../models/Transaction');
const AuditLog = require('../models/AuditLog');
const User = require('../models/User');

const seedAccounts = async () => {
  try {
    await Account.deleteMany({});
    const accounts = [
      {
        pg_merchant_id: 'MERCHANT_001',
        name: 'Primary Gateway',
        server_key: 'SB-Mid-server-xxx',
        client_key: 'SB-Mid-client-xxx',
        limit_max: 10000000,
        limit_used: 2500000,
        priority: 1,
        is_active: true
      },
      {
        pg_merchant_id: 'MERCHANT_002',
        name: 'Secondary Gateway',
        server_key: 'SB-Mid-server-yyy',
        client_key: 'SB-Mid-client-yyy',
        limit_max: 5000000,
        limit_used: 1200000,
        priority: 2,
        is_active: true
      }
    ];
    await Account.insertMany(accounts);
    console.log('Accounts seeded successfully');
  } catch (error) {
    console.error('Seeder error:', error);
    throw error;
  }
};

const seedTransactions = async () => {
  try {
    await Transaction.deleteMany({});
    const transactions = [
      {
        order_id: 'TRX2024001',
        amount: 150000,
        pg_merchant_id: 'MERCHANT_001',
        status: 'SUCCESS',
        payment_method: 'qris'
      },
      {
        order_id: 'TRX2024002',
        amount: 250000,
        pg_merchant_id: 'MERCHANT_001',
        status: 'PENDING',
        payment_method: 'bri_va'
      },
      {
        order_id: 'TRX2024003',
        amount: 100000,
        pg_merchant_id: 'MERCHANT_002',
        status: 'SUCCESS',
        payment_method: 'bca_va'
      }
    ];
    await Transaction.insertMany(transactions);
    console.log('Transactions seeded successfully');
  } catch (error) {
    console.error('Transaction seeder error:', error);
    throw error;
  }
};

const seedUsers = async () => {
  try {
    await User.deleteMany({});
    const users = [
      {
        username: 'admin',
        email: 'admin@example.com',
        password: 'admin123',
        full_name: 'Administrator',
        phone: '081234567890',
        address: 'Jl. Admin No. 1, Jakarta',
        role: 'admin'
      },
      {
        username: 'customer',
        email: 'customer@example.com',
        password: 'customer123',
        full_name: 'John Customer',
        phone: '081234567891',
        address: 'Jl. Customer No. 2, Jakarta',
        role: 'customer'
      }
    ];
    await User.insertMany(users);
    console.log('Users seeded successfully');
  } catch (error) {
    console.error('User seeder error:', error);
    throw error;
  }
};

const seedAll = async () => {
  try {
    console.log('Starting database seeding...');
    await seedUsers();
    await seedAccounts();
    await seedTransactions();
    console.log('Database seeding completed!');
  } catch (error) {
    console.error('Seeding failed:', error);
    throw error;
  }
};

module.exports = { seedAccounts, seedTransactions, seedUsers, seedAll };