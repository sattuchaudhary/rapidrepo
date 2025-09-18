const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { connectDB } = require('./config/database');
const authRoutes = require('./routes/auth');
const unifiedAuthRoutes = require('./routes/unifiedAuth');
const adminRoutes = require('./routes/admin');
const userRoutes = require('./routes/user');
const tenantRoutes = require('./routes/tenant');

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB
connectDB();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    const allowed = [
      process.env.CLIENT_URL || 'http://localhost:3000',
      'http://localhost:19006', // Expo web default
      'http://127.0.0.1:19006'
    ];
    if (!origin || allowed.includes(origin)) return callback(null, true);
    return callback(null, true); // allow all during development
  },
  credentials: true
}));

// Trust proxy for rate limiting
app.set('trust proxy', 1);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Body parser middleware
app.use(express.json({ limit: '40mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/unified-auth', unifiedAuthRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/user', userRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api/tenant/clients', require('./routes/client'));
app.use('/api/tenant/users', require('./routes/tenantUsers'));
app.use('/api/tenant/mobile', require('./routes/mobileUpload'));
app.use('/api/tenant/data', require('./routes/fileManagement'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'RapidRepo API is running',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    success: false, 
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false, 
    message: 'Route not found' 
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
});

