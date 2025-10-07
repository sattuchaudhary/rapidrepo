// Enhanced Security Configuration for RapidRepo Server
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const compression = require('compression');
const morgan = require('morgan');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const { connectDB } = require('./config/database');
const authRoutes = require('./routes/auth');
const unifiedAuthRoutes = require('./routes/unifiedAuth');
const adminRoutes = require('./routes/admin');
const historyRoutes = require('./routes/history');
const userRoutes = require('./routes/user');
const tenantRoutes = require('./routes/tenant');
const paymentsRoutes = require('./routes/payments');
const { authenticateUnifiedToken } = require('./middleware/unifiedAuth');
const { requireActiveSubscription } = require('./middleware/subscription');

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB
connectDB();

// Trust proxy for rate limiting and security
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// CORS configuration with security
app.use(cors({
  origin: (origin, callback) => {
    const allowed = [
      process.env.CLIENT_URL || 'http://localhost:3000',
      'https://rapidbuddy.cloud',
      'https://www.rapidbuddy.cloud'
    ];
    
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowed.includes(origin)) {
      return callback(null, true);
    }
    
    // In production, be strict about origins
    if (process.env.NODE_ENV === 'production') {
      return callback(new Error('Not allowed by CORS'), false);
    }
    
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  optionsSuccessStatus: 200
}));

// Handle preflight requests
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(200);
});

// Rate limiting configurations
const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.API_RATE_LIMIT) || 100,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
    retryAfter: Math.ceil((parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000) / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many requests from this IP, please try again later.',
      retryAfter: Math.ceil((parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000) / 1000)
    });
  }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.AUTH_RATE_LIMIT) || 5,
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.',
    retryAfter: 900
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many authentication attempts, please try again later.',
      retryAfter: 900
    });
  }
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 uploads per hour per IP
  message: {
    success: false,
    message: 'Too many upload attempts, please try again later.',
    retryAfter: 3600
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Apply general rate limiting
app.use(generalLimiter);

// Compression middleware
app.use(compression());

// Body parser middleware with security
app.use(express.json({ 
  limit: process.env.MAX_FILE_SIZE || '10gb',
  timeout: '1200000' // 20 minutes
}));
app.use(express.urlencoded({ 
  extended: true,
  limit: process.env.MAX_FILE_SIZE || '10gb',
  timeout: '1200000' // 20 minutes
}));

// Data sanitization against NoSQL query injection
app.use(mongoSanitize());

// Data sanitization against XSS
app.use(xss());

// Prevent parameter pollution
app.use(hpp());

// Request logging
if (process.env.NODE_ENV === 'production') {
  // Create logs directory if it doesn't exist
  const logsDir = path.dirname(process.env.LOG_FILE || '/var/log/rapidrepo/app.log');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  
  // Create write stream for logging
  const accessLogStream = fs.createWriteStream(
    process.env.LOG_FILE || '/var/log/rapidrepo/app.log',
    { flags: 'a' }
  );
  
  app.use(morgan('combined', { stream: accessLogStream }));
} else {
  app.use(morgan('dev'));
}

// Increase server timeout
app.use((req, res, next) => {
  req.setTimeout(1200000); // 20 minutes
  res.setTimeout(1200000); // 20 minutes
  next();
});

// Security headers middleware
app.use((req, res, next) => {
  // Remove X-Powered-By header
  res.removeHeader('X-Powered-By');
  
  // Add security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  next();
});

// Routes with appropriate rate limiting
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/unified-auth', authLimiter, unifiedAuthRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/user', userRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api/tenant/clients', require('./routes/client'));
app.use('/api/tenant/users', require('./routes/tenantUsers'));
app.use('/api/tenant/mobile', uploadLimiter, require('./routes/mobileUpload'));
app.use('/api/tenant/data', require('./routes/fileManagement'));
app.use('/api/tenant', tenantRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/bulk-download', require('./routes/bulkDownload'));
app.use('/api/uploads', require('./routes/uploads'));
app.use('/api/subscriptions', require('./routes/subscriptions'));

// Static hosting for uploaded files with security
app.use('/uploads', (req, res, next) => {
  // Security headers for uploaded files
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Block execution of uploaded files
  if (req.path.match(/\.(php|pl|py|jsp|asp|sh|cgi)$/i)) {
    return res.status(403).json({ success: false, message: 'File type not allowed' });
  }
  
  next();
}, express.static(path.join(__dirname, 'uploads')));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'RapidRepo API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  
  // Log error in production
  if (process.env.NODE_ENV === 'production') {
    const errorLog = {
      timestamp: new Date().toISOString(),
      error: err.message,
      stack: err.stack,
      url: req.url,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    };
    
    console.error('Error Log:', JSON.stringify(errorLog));
  }
  
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

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🔒 Security features enabled`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
});

module.exports = app;
