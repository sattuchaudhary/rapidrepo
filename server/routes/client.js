const express = require('express');
const router = express.Router();
const clientController = require('../controllers/clientController');
const { authenticateUnifiedToken } = require('../middleware/unifiedAuth');

// All routes require unified authentication
router.use(authenticateUnifiedToken);

// Client Management Routes
router.post('/', clientController.createClient);
router.get('/', clientController.getClients);
router.put('/:id', clientController.updateClient);
router.delete('/:id', clientController.deleteClient);
router.get('/stats', clientController.getClientStats);

module.exports = router;
