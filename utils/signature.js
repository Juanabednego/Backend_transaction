const crypto = require('crypto');

const generateSignature = (orderId, amount) => {
  const data = `${orderId}${amount}${process.env.SECRET_KEY}`;
  return crypto.createHash('sha256').update(data).digest('hex');
};

const verifySignature = (orderId, amount, signature) => {
  const expectedSignature = generateSignature(orderId, amount);
  return expectedSignature === signature;
};

module.exports = {
  generateSignature,
  verifySignature
};