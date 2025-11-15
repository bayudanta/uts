const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:3001';
const TASK_SERVICE_URL = process.env.TASK_SERVICE_URL || 'http://localhost:4000';

let PUBLIC_KEY = null;

// --- Fungsi untuk mengambil Public Key ---
const fetchPublicKey = async () => {
  try {
    // Gunakan URL layanan internal (nama kontainer Docker)
    const internalUserServiceUrl = process.env.NODE_ENV === 'production' 
      ? 'http://rest-api:3001' 
      : USER_SERVICE_URL;
      
    const response = await axios.get(`${internalUserServiceUrl}/auth/public-key`);
    PUBLIC_KEY = response.data.publicKey;
    console.log('Public Key successfully fetched from User Service.');
  } catch (error) {
    console.error('Failed to fetch public key. Retrying in 5 seconds...', error.message);
    setTimeout(fetchPublicKey, 5000); // Coba lagi
  }
};

// --- Middleware Verifikasi JWT ---
const verifyToken = (req, res, next) => {
  if (!PUBLIC_KEY) {
    return res.status(503).json({ error: 'Service unavailable. Public key not yet fetched.' });
  }

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (token == null) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  jwt.verify(token, PUBLIC_KEY, { algorithms: ['RS256'] }, (err, user) => {
    if (err) {
      console.error("JWT Verification Error:", err.message);
      return res.status(403).json({ error: 'Invalid or expired token.' });
    }
    
    // Meneruskan header kustom ke layanan backend
    req.headers['x-user-id'] = user.id;
    req.headers['x-user-email'] = user.email;
    req.headers['x-user-name'] = user.name;
    req.headers['x-team-id'] = user.teamId;

    next();
  });
};

// --- Konfigurasi Server ---
app.use(helmet());
app.use(cors({
  origin: [
    'http://localhost:3002', // Frontend dev
    'http://frontend-app:3000' // Frontend docker
  ],
  credentials: true
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    services: {
      'user-service': USER_SERVICE_URL,
      'task-service': TASK_SERVICE_URL
    }
  });
});

// --- Proxy Definitions ---

// Proxy untuk Autentikasi (Publik)
const authProxy = createProxyMiddleware({
  target: USER_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: { '^/auth': '/auth' },
  onError: (err, req, res) => {
    console.error('Auth Proxy Error:', err.message);
    res.status(502).json({ error: 'Auth service unavailable.' });
  }
});

// Proxy untuk User/Team API (Terproteksi)
const userApiProxy = createProxyMiddleware({
  target: USER_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: { '^/api': '/api' },
  onError: (err, req, res) => {
    console.error('User API Proxy Error:', err.message);
    res.status(502).json({ error: 'User service unavailable.' });
  }
});

// Proxy untuk Task API (GraphQL) (Terproteksi)
const taskApiProxy = createProxyMiddleware({
  target: TASK_SERVICE_URL,
  changeOrigin: true,
  ws: true, // Penting untuk Subscriptions
  pathRewrite: { '^/graphql': '/graphql' },
  onError: (err, req, res) => {
    console.error('Task API Proxy Error:', err.message);
    res.status(502).json({ error: 'Task service unavailable.' });
  },
  onProxyReqWs: (proxyReq, req, socket, options, head) => {
    // Coba teruskan token dari connectionParams (jika ada) sebagai header
    // graphql-ws client akan mengirimkannya di 'protocol'
    // Format: ["graphql-transport-ws",{"authorization":"Bearer ..."}]
    try {
      const protocol = req.headers['sec-websocket-protocol'];
      if (protocol) {
        const params = JSON.parse(protocol.split(',')[1]);
        if (params.authorization) {
          proxyReq.setHeader('Authorization', params.authorization);
        }
      }
    } catch (e) {
      console.warn('Could not parse websocket protocol for auth.');
    }
  }
});

// --- Terapkan Rute Proxy ---

// Rute publik
app.use('/auth', authProxy);

// Rute terproteksi
app.use('/api', verifyToken, userApiProxy);
app.use('/graphql', verifyToken, taskApiProxy);


// Error handling
app.use((err, req, res, next) => {
  console.error('Gateway Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Mulai server dan ambil public key
const server = app.listen(PORT, () => {
  console.log(`🚀 API Gateway running on port ${PORT}`);
  console.log(`🔄 Proxying /auth/* to: ${USER_SERVICE_URL}`);
  console.log(`🔄 Proxying /api/* to: ${USER_SERVICE_URL} (JWT Protected)`);
  console.log(`🔄 Proxying /graphql to: ${TASK_SERVICE_URL} (JWT Protected)`);
  
  // Ambil public key saat startup
  fetchPublicKey(); 
});

module.exports = app;