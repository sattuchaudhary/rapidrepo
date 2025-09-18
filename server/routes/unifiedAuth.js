const express = require('express');
const { body } = require('express-validator');
const { unifiedLogin, getUnifiedProfile } = require('../controllers/unifiedAuthController');
const { authenticateUnifiedToken } = require('../middleware/unifiedAuth');

const router = express.Router();

// Validation middleware
const loginValidation = [
  body('identifier')
    .notEmpty()
    .withMessage('Email or phone number is required'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

// Routes
router.post('/login', loginValidation, unifiedLogin);
router.get('/profile', authenticateUnifiedToken, getUnifiedProfile);

module.exports = router;

