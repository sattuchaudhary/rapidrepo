const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { connectDB } = require('./config/database');
const authRoutes = require('./routes/auth');
const unifiedAuthRoutes = require('./routes/unifiedAuth');
const adminRoutes = require('./routes/admin');
const historyRoutes = require('./routes/history');
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
      'http://127.0.0.1:19006',
      'https://kanufox.com',
      'http://www.kanufox.com',
      'http://72.60.103.24',
      'https://72.60.103.24',
      'https://rapidrepo.cloud',
      'http://rapidrepo.cloud',
      'https://rapidbuddy.cloud',
      'http://rapidbuddy.cloud',
      'https://api.rapidbuddy.cloud',
      'http://api.rapidbuddy.cloud'
    ];
    if (!origin || allowed.includes(origin)) return callback(null, true);
    return callback(null, true); // allow all during development
  },
  credentials: true
}));

// Trust proxy for rate limiting
app.set('trust proxy', 1);

// Rate limiting - more generous for data operations
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Increased limit for general API usage
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// More restrictive rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Strict limit for auth
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply general rate limiting to all routes
app.use(generalLimiter);

// Body parser middleware with no size limits and 20 minute timeouts
app.use(express.json({ 
  limit: '1gb', // 1GB limit (effectively unlimited for most cases)
  timeout: '1200000' // 20 minutes
}));
app.use(express.urlencoded({ 
  extended: true,
  limit: '1gb', // 1GB limit (effectively unlimited for most cases)
  timeout: '1200000' // 20 minutes
}));

// Increase server timeout to 20 minutes
app.use((req, res, next) => {
  req.setTimeout(1200000); // 20 minutes
  res.setTimeout(1200000); // 20 minutes
  next();
});

// Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/unified-auth', authLimiter, unifiedAuthRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/user', userRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api/tenant/clients', require('./routes/client'));
app.use('/api/tenant/users', require('./routes/tenantUsers'));
app.use('/api/tenant/mobile', require('./routes/mobileUpload'));
app.use('/api/tenant/data', require('./routes/fileManagement'));
app.use('/api/bulk-download', require('./routes/bulkDownload'));

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

