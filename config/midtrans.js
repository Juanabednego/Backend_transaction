const midtransClient = require('midtrans-client');

// Konfigurasi untuk 2 akun Midtrans dengan fallback
const midtransConfigs = {
  MERCHANT_001: {
    isProduction: false,
    serverKey: process.env.MIDTRANS_SERVER_KEY_1,
    clientKey: process.env.MIDTRANS_CLIENT_KEY_1 || 'Mid-client-ZxWfoZF1G0tIUjDu',
  },
  MERCHANT_002: {
    isProduction: false,
    serverKey: process.env.MIDTRANS_SERVER_KEY_2,
    clientKey: process.env.MIDTRANS_CLIENT_KEY_2 || 'Mid-client-sP1Wf_XYfqE8UfJ3',
  }
};

// Fungsi untuk mendapatkan Snap client berdasarkan merchant ID
const getSnapClient = (merchantId) => {
  const config = midtransConfigs[merchantId];
  if (!config) {
    console.warn(`Midtrans config not found for merchant: ${merchantId}, using MERCHANT_001`);
    return new midtransClient.Snap(midtransConfigs.MERCHANT_001);
  }
  
  if (!config.serverKey || !config.clientKey) {
    console.warn(`Incomplete Midtrans config for ${merchantId}, using fallback`);
    return new midtransClient.Snap(midtransConfigs.MERCHANT_001);
  }
  
  return new midtransClient.Snap(config);
};

// Fungsi untuk mendapatkan Core API client
const getCoreApiClient = (merchantId) => {
  const config = midtransConfigs[merchantId];
  if (!config) {
    console.warn(`Midtrans config not found for merchant: ${merchantId}, using MERCHANT_001`);
    return new midtransClient.CoreApi(midtransConfigs.MERCHANT_001);
  }
  
  if (!config.serverKey || !config.clientKey) {
    console.warn(`Incomplete Midtrans config for ${merchantId}, using fallback`);
    return new midtransClient.CoreApi(midtransConfigs.MERCHANT_001);
  }
  
  return new midtransClient.CoreApi(config);
};

module.exports = {
  getSnapClient,
  getCoreApiClient,
  midtransConfigs
};