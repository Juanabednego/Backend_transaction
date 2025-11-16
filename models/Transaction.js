const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  order_id: {
    type: String,
    required: true,
    unique: true
  },
  amount: {
    type: mongoose.Schema.Types.Decimal128,
    required: true
  },
  pg_merchant_id: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['PENDING', 'SUCCESS', 'FAILED'],
    default: 'PENDING'
  },
  redirect_url: {
    type: String
  },
  pg_response: {
    type: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Transaction', transactionSchema);