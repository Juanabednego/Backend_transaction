const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema({
  pg_merchant_id: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  server_key: {
    type: String,
    required: false
  },
  client_key: {
    type: String,
    required: false
  },
  limit_max: {
    type: mongoose.Schema.Types.Decimal128,
    required: true
  },
  limit_used: {
    type: mongoose.Schema.Types.Decimal128,
    default: 0
  },
  priority: {
    type: Number,
    required: true
  },
  is_active: {
    type: Boolean,
    default: true
  },
  last_reset: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Account', accountSchema);