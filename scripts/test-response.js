const mongoose = require('mongoose');
require('dotenv').config();
const Account = require('../models/Account');

const testResponse = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB\n');
    
    // Fetch accounts
    const accounts = await Account.find({});
    
    // Format response like API
    const response = {
      success: true,
      data: accounts
    };
    
    console.log('API Response Format:');
    console.log(JSON.stringify(response, null, 2));
    
    console.log('\n✅ Response includes all required fields:');
    if (accounts.length > 0) {
      const firstAccount = accounts[0].toObject();
      console.log('- _id:', firstAccount._id ? '✓' : '✗');
      console.log('- pg_merchant_id:', firstAccount.pg_merchant_id ? '✓' : '✗');
      console.log('- name:', firstAccount.name ? '✓' : '✗');
      console.log('- server_key:', firstAccount.server_key !== undefined ? '✓' : '✗');
      console.log('- client_key:', firstAccount.client_key !== undefined ? '✓' : '✗');
      console.log('- limit_max:', firstAccount.limit_max ? '✓' : '✗');
      console.log('- limit_used:', firstAccount.limit_used !== undefined ? '✓' : '✗');
      console.log('- priority:', firstAccount.priority ? '✓' : '✗');
      console.log('- is_active:', firstAccount.is_active !== undefined ? '✓' : '✗');
      console.log('- last_reset:', firstAccount.last_reset ? '✓' : '✗');
    } else {
      console.log('⚠️  No accounts found. Run seeder first: node scripts/run-seeder.js');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
};

testResponse();
