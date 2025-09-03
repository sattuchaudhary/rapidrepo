const express = require('express');
const { body } = require('express-validator');
const adminController = require('../controllers/adminController');
const { authenticateToken, requireSuperAdmin } = require('../middleware/auth');

const router = express.Router();

// All admin routes require authentication and super admin role
router.use(authenticateToken);
router.use(requireSuperAdmin);

// Validation middleware
const createUserValidation = [
  body('firstName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),
  body('lastName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please enter a valid email'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  body('role')
    .isIn(['super_admin', 'admin', 'user'])
    .withMessage('Invalid role'),
  body('tenantId')
    .optional()
    .isMongoId()
    .withMessage('Invalid tenant ID')
];

const updateUserValidation = [
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please enter a valid email'),
  body('role')
    .optional()
    .isIn(['super_admin', 'admin', 'user'])
    .withMessage('Invalid role'),
  body('tenantId')
    .optional()
    .isMongoId()
    .withMessage('Invalid tenant ID'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean')
];

// User management routes
router.get('/users', adminController.getAllUsers);
router.get('/users/:id', adminController.getUserById);
router.post('/users', createUserValidation, adminController.createUser);
router.put('/users/:id', updateUserValidation, adminController.updateUser);
router.delete('/users/:id', adminController.deleteUser);

// Tenant management routes
router.get('/tenants', adminController.getAllTenants);

// Dashboard routes
router.get('/dashboard/stats', adminController.getDashboardStats);

module.exports = router;








