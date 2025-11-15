const crypto = require('crypto');

// Hasilkan satu pasang kunci saat server dimulai
// DALAM PRODUKSI, ini harus dimuat dari variabel lingkungan (.env) atau secret manager
// JANGAN generate kunci setiap kali server start di produksi karena token lama akan invalid.
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem'
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem'
  }
});

console.log("RSA Key Pair Generated for JWT (User Service).");

module.exports = {
  privateKey,
  publicKey
};