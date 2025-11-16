const { verifySignature } = require('../utils/signature');

const validateSignature = (req, res, next) => {
  const { order_id, amount, signature } = req.body;

  if (!order_id || !amount || !signature) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: order_id, amount, signature'
    });
  }

  if (!verifySignature(order_id, amount, signature)) {
    return res.status(403).json({
      success: false,
      message: 'Invalid signature'
    });
  }

  next();
};

module.exports = validateSignature;