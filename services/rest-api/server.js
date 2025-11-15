const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { errorHandler } = require('./middleware/errorHandler');

// Impor rute baru
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const teamRoutes = require('./routes/team.routes');

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    service: 'User Service (REST)',
    timestamp: new Date().toISOString()
  });
});

// --- Rute ---
// Rute publik untuk autentikasi
app.use('/auth', authRoutes); 

// Rute API (Gateway akan memproteksi ini)
app.use('/api/users', userRoutes);
app.use('/api/teams', teamRoutes);


// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.originalUrl}`
  });
});

app.listen(PORT, () => {
  console.log(`🚀 User Service (REST) running on port ${PORT}`);
  console.log(`🔑 Public Key Endpoint: http://localhost:${PORT}/auth/public-key`);
});

module.exports = app;