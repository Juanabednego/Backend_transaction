const express = require('express');
const router = express.Router();
const { generateSignature } = require('../utils/signature');

// Helper endpoint untuk generate signature (development only)
router.post('/generate-signature', (req, res) => {
  const { order_id, amount } = req.body;
  
  if (!order_id || !amount) {
    return res.status(400).json({
      success: false,
      message: 'order_id and amount required'
    });
  }

  const signature = generateSignature(order_id, amount);
  
  res.json({
    success: true,
    data: {
      order_id,
      amount,
      signature
    }
  });
});

module.exports = router;