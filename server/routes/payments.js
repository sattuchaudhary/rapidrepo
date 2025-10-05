const express = require('express');
const router = express.Router();
const { authenticateUnifiedToken } = require('../middleware/unifiedAuth');
const { requireSuperAdmin } = require('../middleware/auth');
const { submitPayment, listPayments, approvePayment, rejectPayment } = require('../controllers/paymentController');

// Anyone logged-in (mobile/admin) can submit for their tenant
router.post('/submit', authenticateUnifiedToken, submitPayment);

// Admin views pending payments; allow admin or super_admin via standard auth middleware if needed
router.get('/', authenticateUnifiedToken, listPayments);

// Approve / Reject by admin users (web admin). Using unifiedToken but should ensure admin role in implementation.
router.post('/:id/approve', authenticateUnifiedToken, approvePayment);
router.post('/:id/reject', authenticateUnifiedToken, rejectPayment);

module.exports = router;


