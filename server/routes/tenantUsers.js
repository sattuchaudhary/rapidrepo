const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');

// All routes require authentication and admin role
router.use(authenticateToken, requireAdmin);

// Test endpoint to check tenant database connection
router.get('/test-connection', async (req, res) => {
  try {
    console.log('Testing tenant database connection...');
    console.log('User:', req.user._id);
    console.log('Tenant ID:', req.user.tenantId);
    
    const tenant = await Tenant.findById(req.user.tenantId);
    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant not found'
      });
    }
    
    console.log('Tenant found:', tenant.name);
    
    const tenantConnection = await getTenantDB(tenant.name);
    const OfficeStaff = getOfficeStaffModel(tenantConnection);
    
    // Try to count documents
    const count = await OfficeStaff.countDocuments();
    
    res.json({
      success: true,
      message: 'Connection test successful',
      tenant: tenant.name,
      database: `tenants_${tenant.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
      staffCount: count
    });
  } catch (error) {
    console.error('Connection test failed:', error);
    res.status(500).json({
      success: false,
      message: 'Connection test failed',
      error: error.message
    });
  }
});

// Function to get tenant-specific database connection
const getTenantDB = async (tenantName) => {
  try {
    const dbName = `tenants_${tenantName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    console.log(`Attempting to connect to tenant database: ${dbName}`);
    
    // Check if connection already exists
    if (mongoose.connections.some(conn => conn.name === dbName)) {
      console.log(`Using existing connection to: ${dbName}`);
      return mongoose.connections.find(conn => conn.name === dbName);
    }
    
    // Create new connection to tenant database
    const tenantConnection = mongoose.createConnection(`mongodb://localhost:27017/${dbName}`, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    // Wait for connection to be ready
    await new Promise((resolve, reject) => {
      tenantConnection.once('connected', () => {
        console.log(`Successfully connected to tenant database: ${dbName}`);
        resolve();
      });
      
      tenantConnection.once('error', (err) => {
        console.error(`Failed to connect to tenant database ${dbName}:`, err.message);
        reject(err);
      });
      
      // Timeout after 5 seconds
      setTimeout(() => {
        reject(new Error(`Connection timeout to ${dbName}`));
      }, 5000);
    });
    
    return tenantConnection;
  } catch (error) {
    console.error(`Error connecting to tenant database: ${error.message}`);
    throw error;
  }
};

// Cache for models to avoid recompilation
const modelCache = new Map();

// Function to clear model cache (useful for testing or when connections change)
const clearModelCache = () => {
  modelCache.clear();
  console.log('Model cache cleared');
};

// Function to get OfficeStaff model for specific tenant
const getOfficeStaffModel = (tenantConnection) => {
  const connectionName = tenantConnection.name;
  
  // Check if model already exists in cache
  if (modelCache.has(connectionName)) {
    console.log(`Using cached OfficeStaff model for: ${connectionName}`);
    return modelCache.get(connectionName);
  }
  
  console.log(`Creating new OfficeStaff model for: ${connectionName}`);
  
  const officeStaffSchema = new mongoose.Schema({
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters']
    },
    phoneNumber: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
      match: [/^[0-9+\-\s()]+$/, 'Please enter a valid phone number']
    },
    role: {
      type: String,
      required: [true, 'Role is required'],
      enum: ['Sub Admin', 'Vehicle Confirmer', 'Manager', 'Supervisor', 'Staff'],
      default: 'Staff'
    },
    address: {
      type: String,
      required: [true, 'Address is required'],
      trim: true
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true
    },
    state: {
      type: String,
      required: [true, 'State is required'],
      trim: true
    },
    zipCode: {
      type: String,
      required: [true, 'Zip code is required'],
      trim: true
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters']
    },
    panCardNo: {
      type: String,
      trim: true,
      uppercase: true
    },
    aadhaarNumber: {
      type: String,
      trim: true
    },
    // File paths for uploaded documents
    aadharCardFront: String,
    aadharCardBack: String,
    policeVerification: String,
    panCardPhoto: String,
    draCertificate: String,
    profilePhoto: String,
    
    // Status and verification
    status: {
      type: String,
      enum: ['active', 'inactive', 'pending'],
      default: 'active'
    },
    otpVerified: {
      type: Boolean,
      default: false
    },
    
    // Created by
    createdBy: {
      type: String, // Store user ID as string since it's from main DB
      required: true
    }
  }, {
    timestamps: true
  });

  // Index for better query performance
  officeStaffSchema.index({ status: 1 });
  officeStaffSchema.index({ role: 1 });
  officeStaffSchema.index({ phoneNumber: 1 });

  // Virtual for full name
  officeStaffSchema.virtual('fullName').get(function() {
    return this.name;
  });

  // Ensure virtual fields are serialized
  officeStaffSchema.set('toJSON', { virtuals: true });
  officeStaffSchema.set('toObject', { virtuals: true });

  // Create model and cache it
  const model = tenantConnection.model('OfficeStaff', officeStaffSchema);
  modelCache.set(connectionName, model);
  
  console.log(`OfficeStaff model cached for: ${connectionName}`);
  return model;
};

// Function to get RepoAgent model for specific tenant
const getRepoAgentModel = (tenantConnection) => {
  const connectionName = tenantConnection.name;
  
  // Check if model already exists in cache
  if (modelCache.has(connectionName + '_RepoAgent')) {
    console.log(`Using cached RepoAgent model for: ${connectionName}`);
    return modelCache.get(connectionName + '_RepoAgent');
  }
  
  console.log(`Creating new RepoAgent model for: ${connectionName}`);
  
  const repoAgentSchema = new mongoose.Schema({
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters']
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email address']
    },
    phoneNumber: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
      match: [/^[0-9+\-\s()]+$/, 'Please enter a valid phone number']
    },
    address: {
      type: String,
      required: [true, 'Address is required'],
      trim: true
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true
    },
    state: {
      type: String,
      required: [true, 'State is required'],
      trim: true
    },
    zipCode: {
      type: String,
      required: [true, 'Zip code is required'],
      trim: true
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters']
    },
    panCardNo: {
      type: String,
      trim: true,
      uppercase: true
    },
    aadhaarNumber: {
      type: String,
      trim: true
    },
    // File paths for uploaded documents
    aadharCardFront: String,
    aadharCardBack: String,
    policeVerification: String,
    panCardPhoto: String,
    draCertificate: String,
    profilePhoto: String,
    
    // Role and status
    role: {
      type: String,
      default: 'Repo Agent',
      enum: ['Repo Agent']
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'pending'],
      default: 'active'
    },
    otpVerified: {
      type: Boolean,
      default: false
    },
    
    // Created by
    createdBy: {
      type: String, // Store user ID as string since it's from main DB
      required: true
    }
  }, {
    timestamps: true
  });

  // Index for better query performance
  repoAgentSchema.index({ status: 1 });
  repoAgentSchema.index({ role: 1 });
  repoAgentSchema.index({ email: 1 });
  repoAgentSchema.index({ phoneNumber: 1 });

  // Virtual for full name
  repoAgentSchema.virtual('fullName').get(function() {
    return this.name;
  });

  // Ensure virtual fields are serialized
  repoAgentSchema.set('toJSON', { virtuals: true });
  repoAgentSchema.set('toObject', { virtuals: true });

  // Create model and cache it
  const model = tenantConnection.model('RepoAgent', repoAgentSchema);
  modelCache.set(connectionName + '_RepoAgent', model);
  
  console.log(`RepoAgent model cached for: ${connectionName}`);
  return model;
};

// Office Staff Management
router.get('/staff', async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    const skip = (page - 1) * limit;
    
    console.log('Fetching office staff for user:', req.user._id);
    console.log('User tenant ID:', req.user.tenantId);
    
    // Get tenant information
    const tenant = await Tenant.findById(req.user.tenantId);
    if (!tenant) {
      console.log('Tenant not found for ID:', req.user.tenantId);
      return res.status(404).json({
        success: false,
        message: 'Tenant not found'
      });
    }
    
    console.log('Found tenant:', tenant.name);
    
    // Get tenant-specific database connection
    const tenantConnection = await getTenantDB(tenant.name);
    const OfficeStaff = getOfficeStaffModel(tenantConnection);
    
    console.log('OfficeStaff model created for tenant:', tenant.name);
    
    // Build query for search
    let query = {};
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phoneNumber: { $regex: search, $options: 'i' } },
        { role: { $regex: search, $options: 'i' } },
        { city: { $regex: search, $options: 'i' } },
        { state: { $regex: search, $options: 'i' } }
      ];
    }

    console.log('Query:', query);
    console.log('Pagination - skip:', skip, 'limit:', limit);

    // Get office staff with pagination
    const staff = await OfficeStaff.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    console.log('Found staff members:', staff.length);

    // Get total count
    const total = await OfficeStaff.countDocuments(query);
    console.log('Total staff count:', total);

    res.json({
      success: true,
      data: staff,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching office staff:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch office staff',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
 });

// Create new office staff
router.post('/staff', async (req, res) => {
  try {
    console.log('Creating new office staff with data:', req.body);
    
    // Validate required fields
    const { name, phoneNumber, role, address, city, state, zipCode, password } = req.body;
    
    if (!name || !phoneNumber || !role || !address || !city || !state || !zipCode || !password) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }

    // Get tenant information
    const tenant = await Tenant.findById(req.user.tenantId);
    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant not found'
      });
    }
    
    // Get tenant-specific database connection
    const tenantConnection = await getTenantDB(tenant.name);
    const OfficeStaff = getOfficeStaffModel(tenantConnection);
    
    console.log(`Using tenant database: tenants_${tenant.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`);

    // Check if phone number already exists for this tenant
    const existingStaff = await OfficeStaff.findOne({ phoneNumber });
    
    if (existingStaff) {
      return res.status(400).json({
        success: false,
        message: 'Phone number already exists for this tenant'
      });
    }

    // Create new office staff
    const newStaff = new OfficeStaff({
      name,
      phoneNumber,
      role,
      address,
      city,
      state,
      zipCode,
      password,
      panCardNo: req.body.panCardNo || '',
      aadhaarNumber: req.body.aadhaarNumber || '',
      // File paths will be added when file upload is implemented
      aadharCardFront: req.body.aadharCardFront || '',
      aadharCardBack: req.body.aadharCardBack || '',
      policeVerification: req.body.policeVerification || '',
      panCardPhoto: req.body.panCardPhoto || '',
      draCertificate: req.body.draCertificate || '',
      profilePhoto: req.body.profilePhoto || '',
      createdBy: req.user._id.toString(),
      status: 'active',
      otpVerified: false
    });

    // Save to tenant-specific database
    const savedStaff = await newStaff.save();
    
    console.log(`Office staff saved to tenant database ${tenant.name}:`, savedStaff._id);

    res.status(201).json({
      success: true,
      message: 'Office staff created successfully',
      data: {
        _id: savedStaff._id,
        fullName: savedStaff.name,
        mobile: savedStaff.phoneNumber,
        role: savedStaff.role,
        city: savedStaff.city,
        state: savedStaff.state,
        status: savedStaff.status,
        createdAt: savedStaff.createdAt
      }
    });
  } catch (error) {
    console.error('Error creating office staff:', error);
    
    // Handle Mongoose validation errors
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationErrors
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to create office staff',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Repo Agent Management
router.get('/agents', async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    const skip = (page - 1) * limit;
    
    console.log('Fetching repo agents for user:', req.user._id);
    console.log('User tenant ID:', req.user.tenantId);
    
    // Get tenant information
    const tenant = await Tenant.findById(req.user.tenantId);
    if (!tenant) {
      console.log('Tenant not found for ID:', req.user.tenantId);
      return res.status(404).json({
        success: false,
        message: 'Tenant not found'
      });
    }
    
    console.log('Found tenant:', tenant.name);
    
    // Get tenant-specific database connection
    const tenantConnection = await getTenantDB(tenant.name);
    const RepoAgent = getRepoAgentModel(tenantConnection);
    
    console.log('RepoAgent model created for tenant:', tenant.name);
    
    // Build query for search
    let query = { role: 'Repo Agent' };
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phoneNumber: { $regex: search, $options: 'i' } },
        { city: { $regex: search, $options: 'i' } },
        { state: { $regex: search, $options: 'i' } }
      ];
    }

    console.log('Query:', query);
    console.log('Pagination - skip:', skip, 'limit:', limit);

    // Get repo agents with pagination
    const agents = await RepoAgent.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    console.log('Found repo agents:', agents.length);

    // Get total count
    const total = await RepoAgent.countDocuments(query);
    console.log('Total repo agents count:', total);

    res.json({
      success: true,
      data: agents,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching repo agents:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch repo agents',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Create new repo agent
router.post('/agents', async (req, res) => {
  try {
    console.log('Creating new repo agent with data:', req.body);
    
    // Validate required fields
    const { name, email, phoneNumber, address, city, state, zipCode, password } = req.body;
    
    if (!name || !email || !phoneNumber || !address || !city || !state || !zipCode || !password) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }

    // Get tenant information
    const tenant = await Tenant.findById(req.user.tenantId);
    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant not found'
      });
    }
    
    // Get tenant-specific database connection
    const tenantConnection = await getTenantDB(tenant.name);
    const RepoAgent = getRepoAgentModel(tenantConnection);
    
    console.log(`Using tenant database: tenants_${tenant.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`);

    // Check if email already exists for this tenant
    const existingAgent = await RepoAgent.findOne({ email });
    
    if (existingAgent) {
      return res.status(400).json({
        success: false,
        message: 'Email already exists for this tenant'
      });
    }

    // Check if phone number already exists for this tenant
    const existingPhone = await RepoAgent.findOne({ phoneNumber });
    
    if (existingPhone) {
      return res.status(400).json({
        success: false,
        message: 'Phone number already exists for this tenant'
      });
    }

    // Create new repo agent
    const newAgent = new RepoAgent({
      name,
      email,
      phoneNumber,
      address,
      city,
      state,
      zipCode,
      password,
      panCardNo: req.body.panCardNo || '',
      aadhaarNumber: req.body.aadhaarNumber || '',
      // File paths will be added when file upload is implemented
      aadharCardFront: req.body.aadharCardFront || '',
      aadharCardBack: req.body.aadharCardBack || '',
      policeVerification: req.body.policeVerification || '',
      panCardPhoto: req.body.panCardPhoto || '',
      draCertificate: req.body.draCertificate || '',
      profilePhoto: req.body.profilePhoto || '',
      role: 'Repo Agent',
      createdBy: req.user._id.toString(),
      status: 'active',
      otpVerified: false
    });

    // Save to tenant-specific database
    const savedAgent = await newAgent.save();
    
    console.log(`Repo agent saved to tenant database ${tenant.name}:`, savedAgent._id);

    res.status(201).json({
      success: true,
      message: 'Repo agent created successfully',
      data: {
        _id: savedAgent._id,
        fullName: savedAgent.name,
        email: savedAgent.email,
        mobile: savedAgent.phoneNumber,
        city: savedAgent.city,
        state: savedAgent.state,
        status: savedAgent.status,
        createdAt: savedAgent.createdAt
      }
    });
  } catch (error) {
    console.error('Error creating repo agent:', error);
    
    // Handle Mongoose validation errors
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationErrors
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to create repo agent',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Pending Approvals
router.get('/pending', async (req, res) => {
  try {
    // For now, return sample data
    // TODO: Implement actual database queries
    const samplePending = [
      {
        _id: '1',
        fullName: 'Alex Brown',
        email: 'alex.brown@example.com',
        mobile: '+91-9876543214',
        city: 'Pune',
        state: 'Maharashtra',
        role: 'Staff',
        status: 'pending',
        createdAt: new Date('2024-01-25'),
        otpVerified: false
      }
    ];

    res.json({
      success: true,
      data: samplePending,
      pagination: {
        total: samplePending.length,
        page: 1,
        limit: 10
      }
    });
  } catch (error) {
    console.error('Error fetching pending approvals:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending approvals',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Update user status (for repo agents)
router.put('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be "active" or "inactive"'
      });
    }

    // TODO: Implement actual database update
    console.log(`Updating user ${id} status to ${status}`);

    res.json({
      success: true,
      message: `User status updated to ${status}`
    });
  } catch (error) {
    console.error('Error updating user status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user status',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;
