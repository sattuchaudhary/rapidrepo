const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const Tenant = require('../models/Tenant');
const { authenticateUnifiedToken } = require('../middleware/unifiedAuth');

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
