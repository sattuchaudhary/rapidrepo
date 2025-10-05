const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const Tenant = require('../models/Tenant');
const { authenticateUnifiedToken } = require('../middleware/unifiedAuth');
const { getRemainingTime } = require('../middleware/subscription');

const {
  getAllTenants,
  getTenantById,
  createTenant,
  updateTenant,
  deleteTenant,
  getTenantStats,
  addClientManagementToExistingTenants,
  getTwoWheelerData,
  getFourWheelerData,
  getCVData
} = require('../controllers/tenantController');

const { authenticateToken, requireSuperAdmin, requireAdmin } = require('../middleware/auth');

// Public (tenant-auth) endpoints – must come BEFORE super-admin middleware

// Field mapping configuration for mobile app (tenant-scoped)
router.post('/field-mapping', authenticateUnifiedToken, async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const fieldMapping = req.body || {};

    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }

    await Tenant.findByIdAndUpdate(tenantId, { fieldMapping }, { new: true });
    res.json({ success: true, message: 'Field mapping configuration saved successfully' });
  } catch (error) {
    console.error('Error saving field mapping:', error);
    res.status(500).json({ success: false, message: 'Failed to save field mapping configuration' });
  }
});

router.get('/field-mapping', authenticateUnifiedToken, async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }

    res.json({ success: true, fieldMapping: tenant.fieldMapping || {
      regNo: true,
      chassisNo: true,
      loanNo: true,
      bank: true,
      make: true,
      customerName: true,
      engineNo: true,
      emiAmount: true,
      address: true,
      branch: true,
      pos: true,
      model: true,
      productName: true,
      bucket: true,
      season: true,
      inYard: false,
      yardName: false,
      yardLocation: false,
      status: true,
      uploadDate: false,
      fileName: false
    }});
  } catch (error) {
    console.error('Error getting field mapping:', error);
    res.status(500).json({ success: false, message: 'Failed to get field mapping configuration' });
  }
});

// Tenant profile endpoints
router.get('/profile', authenticateUnifiedToken, async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }

    // Get additional statistics
    const User = require('../models/User');
    const userCount = await User.countDocuments({ tenantId: tenantId });
    
    // Count files from uploads collections
    const mongoose = require('mongoose');
    const db = mongoose.connection.db;
    const fileCount = await db.collection('_uploads').countDocuments({ tenantId: tenantId });

    res.json({ 
      success: true, 
      tenant: {
        ...tenant.toObject(),
        userCount,
        fileCount
      }
    });
  } catch (error) {
    console.error('Error getting tenant profile:', error);
    res.status(500).json({ success: false, message: 'Failed to get tenant profile' });
  }
});

router.put('/profile', authenticateUnifiedToken, async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { name, email, phone, address, description } = req.body;
    
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;
    if (address !== undefined) updateData.address = address;
    if (description !== undefined) updateData.description = description;

    const tenant = await Tenant.findByIdAndUpdate(
      tenantId, 
      updateData, 
      { new: true, runValidators: true }
    );

    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }

    res.json({ 
      success: true, 
      message: 'Tenant profile updated successfully',
      tenant: tenant.toObject()
    });
  } catch (error) {
    console.error('Error updating tenant profile:', error);
    res.status(500).json({ success: false, message: 'Failed to update tenant profile' });
  }
});

// Tenant settings endpoints
router.get('/settings', authenticateUnifiedToken, async (req, res) => {
  try {
    console.log('📊 Settings request - User type:', req.user?.userType, 'Role:', req.user?.role);
    console.log('📊 Settings request - Full User:', req.user);
    
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      console.log('📊 No tenantId found in user object');
      return res.status(401).json({ success: false, message: 'Unauthorized - No tenant ID' });
    }

    console.log('📊 Looking for tenant:', tenantId);
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      console.log('📊 Tenant not found:', tenantId);
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }

    // Return settings with defaults
    const settings = {
      dataMultiplier: tenant.settings?.dataMultiplier || 1,
      paymentConfig: tenant.settings?.paymentConfig || { upiId: '', payeeName: '', qrCodeImageUrl: '', instructions: '' },
      ...tenant.settings
    };

    console.log('📊 Returning settings for user type:', req.user?.userType, 'Settings:', settings);
    res.json({ 
      success: true, 
      data: settings
    });
  } catch (error) {
    console.error('Error getting tenant settings:', error);
    res.status(500).json({ success: false, message: 'Failed to get tenant settings' });
  }
});

// Subscription remaining time for current tenant
router.get('/subscription/remaining', authenticateUnifiedToken, getRemainingTime);

router.put('/settings', authenticateUnifiedToken, async (req, res) => {
  try {
    console.log('📊 Settings update request - User:', req.user);
    console.log('📊 Settings update request - Body:', req.body);
    
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      console.log('📊 No tenantId found in user object');
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { dataMultiplier, paymentConfig } = req.body;
    
    // Validate dataMultiplier
    if (dataMultiplier && ![1, 2, 3, 4, 5, 6].includes(dataMultiplier)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Data multiplier must be 1, 2, 3, 4, 5, or 6' 
      });
    }

    // First get the current tenant to preserve existing settings
    const currentTenant = await Tenant.findById(tenantId);
    if (!currentTenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }

    // Merge with existing settings
    const updatedSettings = {
      ...currentTenant.settings,
      dataMultiplier: dataMultiplier || currentTenant.settings?.dataMultiplier || 1,
      paymentConfig: {
        ...(currentTenant.settings?.paymentConfig || {}),
        ...(paymentConfig || {})
      }
    };

    console.log('📊 Updating settings to:', updatedSettings);

    const updateDoc = {};
    if (dataMultiplier !== undefined) updateDoc['settings.dataMultiplier'] = dataMultiplier;
    if (paymentConfig) {
      if (paymentConfig.upiId !== undefined) updateDoc['settings.paymentConfig.upiId'] = paymentConfig.upiId;
      if (paymentConfig.payeeName !== undefined) updateDoc['settings.paymentConfig.payeeName'] = paymentConfig.payeeName;
      if (paymentConfig.qrCodeImageUrl !== undefined) updateDoc['settings.paymentConfig.qrCodeImageUrl'] = paymentConfig.qrCodeImageUrl;
      if (paymentConfig.instructions !== undefined) updateDoc['settings.paymentConfig.instructions'] = paymentConfig.instructions;
      if (paymentConfig.planPrices) {
        const pp = paymentConfig.planPrices || {};
        if (pp.weekly !== undefined) updateDoc['settings.paymentConfig.planPrices.weekly'] = Number(pp.weekly) || 0;
        if (pp.monthly !== undefined) updateDoc['settings.paymentConfig.planPrices.monthly'] = Number(pp.monthly) || 0;
        if (pp.quarterly !== undefined) updateDoc['settings.paymentConfig.planPrices.quarterly'] = Number(pp.quarterly) || 0;
        if (pp.yearly !== undefined) updateDoc['settings.paymentConfig.planPrices.yearly'] = Number(pp.yearly) || 0;
      }
    }

    const tenant = await Tenant.findByIdAndUpdate(
      tenantId, 
      updateDoc,
      { new: true, runValidators: true }
    );

    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found after update' });
    }

    console.log('📊 Updated tenant settings:', tenant.settings);

    res.json({ success: true, message: 'Settings updated successfully', data: tenant.settings });
  } catch (error) {
    console.error('Error updating tenant settings:', error);
    res.status(500).json({ success: false, message: 'Failed to update tenant settings' });
  }
});

// Agency confirmer management endpoints
router.get('/agency-confirmers', authenticateUnifiedToken, async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }

    // Get tenant-specific database connection
    const { getTenantDB } = require('../config/database');
    const tenantDb = await getTenantDB(tenant.name);
    
    // Create AgencyConfirmer model for this tenant
    const AgencyConfirmer = tenantDb.model('AgencyConfirmer', require('../models/AgencyConfirmer'));
    
    // Get all active agency confirmers
    const confirmers = await AgencyConfirmer.find({ isActive: true }).sort({ createdAt: 1 });

    res.json({ 
      success: true, 
      data: confirmers
    });
  } catch (error) {
    console.error('Error getting agency confirmers:', error);
    res.status(500).json({ success: false, message: 'Failed to get agency confirmers' });
  }
});

router.put('/agency-confirmers', authenticateUnifiedToken, async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { agencyConfirmers } = req.body;

    // Validate agency confirmers data
    if (!Array.isArray(agencyConfirmers)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Agency confirmers must be an array' 
      });
    }

    // Validate each confirmer
    for (let i = 0; i < agencyConfirmers.length; i++) {
      const confirmer = agencyConfirmers[i];
      
      if (!confirmer.name || !confirmer.phoneNumber) {
        return res.status(400).json({ 
          success: false, 
          message: `Confirmer ${i + 1}: Name and phone number are required` 
        });
      }
      
      if (!/^\d{10}$/.test(confirmer.phoneNumber)) {
        return res.status(400).json({ 
          success: false, 
          message: `Confirmer ${i + 1}: Phone number must be exactly 10 digits` 
        });
      }
    }

    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }

    console.log('User object for agency confirmers:', req.user);
    console.log('Tenant ID:', tenantId);

    // Get tenant-specific database connection
    const { getTenantDB } = require('../config/database');
    const tenantDb = await getTenantDB(tenant.name);
    
    // Create AgencyConfirmer model for this tenant
    const AgencyConfirmer = tenantDb.model('AgencyConfirmer', require('../models/AgencyConfirmer'));
    
    // Deactivate all existing confirmers
    await AgencyConfirmer.updateMany({}, { isActive: false });
    
    // Create new confirmers
    const newConfirmers = agencyConfirmers.map(confirmer => ({
      name: confirmer.name,
      phoneNumber: confirmer.phoneNumber,
      isActive: true,
      createdBy: req.user?._id || req.user?.id || tenantId
    }));
    
    const savedConfirmers = await AgencyConfirmer.insertMany(newConfirmers);

    res.json({ 
      success: true, 
      message: 'Agency confirmers updated successfully',
      data: savedConfirmers
    });
  } catch (error) {
    console.error('Error updating agency confirmers:', error);
    res.status(500).json({ success: false, message: 'Failed to update agency confirmers' });
  }
});

// Public endpoint for mobile app to fetch agency confirmers (for repo agents only)
router.get('/agency-confirmers/mobile', authenticateUnifiedToken, async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Check if user is a repo agent
    const userType = req.user?.userType || '';
    const role = req.user?.role || '';
    const isRepoAgent = typeof userType === 'string' && userType.toLowerCase().includes('repo') ||
                       typeof role === 'string' && role.toLowerCase().includes('repo') ||
                       typeof req.user?.designation === 'string' && req.user.designation.toLowerCase().includes('repo') ||
                       typeof req.user?.type === 'string' && req.user.type.toLowerCase().includes('repo') ||
                       typeof req.user?.title === 'string' && req.user.title.toLowerCase().includes('repo');

    // Only repo agents can access agency confirmer data
    if (!isRepoAgent) {
      return res.json({ 
        success: true, 
        data: [] 
      });
    }

    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }

    // Get tenant-specific database connection
    const { getTenantDB } = require('../config/database');
    const tenantDb = await getTenantDB(tenant.name);
    
    // Create AgencyConfirmer model for this tenant
    const AgencyConfirmer = tenantDb.model('AgencyConfirmer', require('../models/AgencyConfirmer'));
    
    // Get all active agency confirmers
    const confirmers = await AgencyConfirmer.find({ isActive: true }).sort({ createdAt: 1 });

    res.json({ 
      success: true, 
      data: confirmers
    });
  } catch (error) {
    console.error('Error getting agency confirmers for mobile:', error);
    res.status(500).json({ success: false, message: 'Failed to get agency confirmers' });
  }
});

// Validation middleware
const validateTenant = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('type')
    .isIn(['agency', 'nbfc', 'bank'])
    .withMessage('Invalid tenant type'),
  body('subscriptionPlan')
    .optional()
    .isIn(['basic', 'premium', 'enterprise'])
    .withMessage('Invalid subscription plan'),
  body('maxUsers')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Max users must be between 1 and 1000'),
  // Admin validation (only for creation)
  body('adminFirstName')
    .if(body('adminFirstName').exists())
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Admin first name must be between 2 and 50 characters'),
  body('adminLastName')
    .if(body('adminLastName').exists())
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Admin last name must be between 2 and 50 characters'),
  body('adminEmail')
    .if(body('adminFirstName').exists())
    .isEmail()
    .withMessage('Please enter a valid admin email'),
  body('adminPassword')
    .if(body('adminPassword').exists())
    .isLength({ min: 6 })
    .withMessage('Admin password must be at least 6 characters')
];

// All routes require super admin access
router.use(authenticateToken, requireSuperAdmin);

// Get all tenants with pagination and search
router.get('/', getAllTenants);

// Get tenant statistics
router.get('/stats', getTenantStats);

// Get single tenant
router.get('/:id', getTenantById);

// Create new tenant
router.post('/', validateTenant, createTenant);

// Update tenant
router.put('/:id', validateTenant, updateTenant);

// Delete tenant
router.delete('/:id', deleteTenant);

// Add clientmanagement collection to existing tenants
router.post('/add-clientmanagement', addClientManagementToExistingTenants);

// Data fetch endpoints for tenant users (require admin access)
router.get('/data/two-wheeler', authenticateToken, requireAdmin, getTwoWheelerData);
router.get('/data/four-wheeler', authenticateToken, requireAdmin, getFourWheelerData);
router.get('/data/cv', authenticateToken, requireAdmin, getCVData);


module.exports = router;
