const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

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
