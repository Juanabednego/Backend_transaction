const { getSnapClient, getCoreApiClient } = require('../config/midtrans');

// Fungsi untuk membuat transaksi Midtrans
const createMidtransTransaction = async (merchantId, transactionData) => {
  try {
    const coreApi = getCoreApiClient(merchantId);
    
    const parameter = {
      payment_type: getPaymentType(transactionData.payment_method),
      transaction_details: {
        order_id: transactionData.order_id,
        gross_amount: transactionData.amount
      },
      customer_details: transactionData.customer_details || {
        first_name: 'Customer',
        last_name: 'Name',
        email: 'customer@example.com',
        phone: '081234567890'
      },
      item_details: transactionData.item_details || [{
        id: 'ITEM001',
        price: transactionData.amount,
        quantity: 1,
        name: 'Payment Item'
      }]
    };

    // Add specific payment method parameters
    addPaymentMethodParams(parameter, transactionData.payment_method);

    const transaction = await coreApi.charge(parameter);
    return transaction;
  } catch (error) {
    throw new Error(`Midtrans transaction failed for ${merchantId}: ${error.message}`);
  }
};

const getPaymentType = (paymentMethod) => {
  const types = {
    'qris': 'qris',
    'bca_va': 'bank_transfer',
    'bni_va': 'bank_transfer',
    'bri_va': 'bank_transfer', 
    'mandiri_va': 'echannel',
    'gopay': 'gopay',
    'shopeepay': 'shopeepay'
  };
  return types[paymentMethod] || 'bank_transfer';
};

const addPaymentMethodParams = (parameter, paymentMethod) => {
  switch(paymentMethod) {
    case 'bca_va':
      parameter.bank_transfer = { bank: 'bca' };
      break;
    case 'bni_va':
      parameter.bank_transfer = { bank: 'bni' };
      break;
    case 'bri_va':
      parameter.bank_transfer = { bank: 'bri' };
      break;
    case 'mandiri_va':
      parameter.echannel = {
        bill_info1: 'Payment for order ' + parameter.transaction_details.order_id,
        bill_info2: 'Total amount ' + parameter.transaction_details.gross_amount
      };
      break;
  }
};

// Fungsi untuk verifikasi status transaksi
const checkTransactionStatus = async (merchantId, orderId) => {
  try {
    const coreApi = getCoreApiClient(merchantId);
    const statusResponse = await coreApi.transaction.status(orderId);
    return statusResponse;
  } catch (error) {
    throw new Error(`Status check failed for ${merchantId}: ${error.message}`);
  }
};

// Fungsi untuk validasi notification dari Midtrans
const validateMidtransNotification = async (merchantId, notificationData) => {
  try {
    const coreApi = getCoreApiClient(merchantId);
    const statusResponse = await coreApi.transaction.notification(notificationData);
    return statusResponse;
  } catch (error) {
    throw new Error(`Notification validation failed: ${error.message}`);
  }
};

module.exports = {
  createMidtransTransaction,
  checkTransactionStatus,
  validateMidtransNotification,
  getPaymentType,
  addPaymentMethodParams
};