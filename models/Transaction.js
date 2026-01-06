const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  order_id: {
    type: String,
    required: true,
    unique: true
  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false // Optional for backward compatibility
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
    enum: ['CREATED', 'PENDING', 'SUCCESS', 'FAILED'],
    default: 'PENDING'
  },
  payment_method: {
    type: String,
    enum: ['qris', 'bca_va', 'bni_va', 'bri_va', 'mandiri_va', 'gopay', 'shopeepay'],
    required: false
  },
  redirect_url: {
    type: String
  },
  pg_response: {
    type: mongoose.Schema.Types.Mixed
  },
  customer_details: {
    type: mongoose.Schema.Types.Mixed
  },
  item_details: {
    type: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// Index untuk optimasi query
transactionSchema.index({ order_id: 1 });
transactionSchema.index({ status: 1 });
transactionSchema.index({ pg_merchant_id: 1 });
transactionSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Transaction', transactionSchema);