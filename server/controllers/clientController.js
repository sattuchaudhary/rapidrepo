const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');

// Create client document inside tenant DB (consistent with other modules)
const createClientDatabase = async (tenantName, clientName) => {
  try {
    const tenantDbName = `tenants_${tenantName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    const tenantDb = mongoose.connection.useDb(tenantDbName);

    const clientDoc = {
      name: clientName,
      createdOn: new Date(),
      status: 'active',
      collections: {
        users: [],
        logs: [],
        vehicle: [],
        two_vehicle: [],
        four_vehicle: [],
        cv_vehicle: []
      }
    };

    const result = await tenantDb.collection('clientmanagement').insertOne(clientDoc);

    return {
      _id: result.insertedId,
      name: clientName,
      createdOn: clientDoc.createdOn,
      status: 'active'
    };
  } catch (error) {
    console.error('Error creating client:', error);
    throw error;
  }
};

// Delete client document
const deleteClientDatabase = async (tenantName, clientName) => {
  try {
    const tenantDbName = `tenants_${tenantName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    const tenantDb = mongoose.connection.useDb(tenantDbName);

    await tenantDb.collection('clientmanagement').deleteOne({ name: clientName });
  } catch (error) {
    console.error('Error deleting client:', error);
    throw error;
  }
};

// Client Management Controller
const clientController = {
  // Create new client
  createClient: async (req, res) => {
    try {
      const { name } = req.body;
      const tenantId = req.user.tenantId;
      
      console.log('Create Client Request:', { name, tenantId, user: req.user });
      
      if (!name || !tenantId) {
        return res.status(400).json({ 
          success: false, 
          message: 'Client name and tenant ID are required',
          debug: { name, tenantId, user: req.user }
        });
      }
      
      // Resolve tenant name for consistent DB naming
      const tenant = await Tenant.findById(tenantId);
      if (!tenant) {
        return res.status(404).json({ success: false, message: 'Tenant not found' });
      }

      // Create client in tenant database
      const clientData = await createClientDatabase(tenant.name, name);
      
      res.status(201).json({
        success: true,
        message: 'Client created successfully',
        data: clientData
      });
      
    } catch (error) {
      console.error('Error creating client:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create client',
        error: error.message
      });
    }
  },

  // Get all clients for a tenant
  getClients: async (req, res) => {
    try {
      const tenantId = req.user.tenantId;
      const { page = 1, limit = 10 } = req.query;
      
      console.log('Get Clients Request:', { tenantId, user: req.user });
      
      // Get tenant database by tenant name (consistent with others)
      const tenant = await Tenant.findById(tenantId);
      if (!tenant) {
        return res.status(404).json({ success: false, message: 'Tenant not found' });
      }
      const tenantDbName = `tenants_${tenant.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
      const tenantDb = mongoose.connection.useDb(tenantDbName);
      
      const clients = await tenantDb.collection('clientmanagement')
        .find({})
        .sort({ createdOn: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .toArray();
      
      const total = await tenantDb.collection('clientmanagement').countDocuments({});
      
      res.json({
        success: true,
        data: clients,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });
      
    } catch (error) {
      console.error('Error fetching clients:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch clients',
        error: error.message
      });
    }
  },

  // Update client
  updateClient: async (req, res) => {
    try {
      const { id } = req.params;
      const { name } = req.body;
      const tenantId = req.user.tenantId;
      
      if (!name) {
        return res.status(400).json({ 
          success: false, 
          message: 'Client name is required' 
        });
      }
      
      // Get tenant database
      const tenant = await Tenant.findById(tenantId);
      if (!tenant) {
        return res.status(404).json({ success: false, message: 'Tenant not found' });
      }
      const tenantDbName = `tenants_${tenant.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
      const tenantDb = mongoose.connection.useDb(tenantDbName);
      
      const result = await tenantDb.collection('clientmanagement').updateOne(
        { _id: new mongoose.Types.ObjectId(id) },
        { $set: { name, updatedOn: new Date() } }
      );
      
      if (result.matchedCount === 0) {
        return res.status(404).json({
          success: false,
          message: 'Client not found'
        });
      }
      
      res.json({
        success: true,
        message: 'Client updated successfully'
      });
      
    } catch (error) {
      console.error('Error updating client:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update client',
        error: error.message
      });
    }
  },

  // Delete client
  deleteClient: async (req, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.user.tenantId;
      
      // Get tenant database
      const tenant = await Tenant.findById(tenantId);
      if (!tenant) {
        return res.status(404).json({ success: false, message: 'Tenant not found' });
      }
      const tenantDbName = `tenants_${tenant.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
      const tenantDb = mongoose.connection.useDb(tenantDbName);
      
      const client = await tenantDb.collection('clientmanagement').findOne({
        _id: new mongoose.Types.ObjectId(id)
      });
      
      if (!client) {
        return res.status(404).json({
          success: false,
          message: 'Client not found'
        });
      }
      
      // Delete client from tenant database
      await tenantDb.collection('clientmanagement').deleteOne({
        _id: new mongoose.Types.ObjectId(id)
      });
      
      res.json({
        success: true,
        message: 'Client deleted successfully'
      });
      
    } catch (error) {
      console.error('Error deleting client:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete client',
        error: error.message
      });
    }
  },

  // Get client dashboard stats
  getClientStats: async (req, res) => {
    try {
      const tenantId = req.user.tenantId;
      
      // Get tenant database
      const tenant = await Tenant.findById(tenantId);
      if (!tenant) {
        return res.status(404).json({ success: false, message: 'Tenant not found' });
      }
      const tenantDbName = `tenants_${tenant.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
      const tenantDb = mongoose.connection.useDb(tenantDbName);
      
      const totalClients = await tenantDb.collection('clientmanagement').countDocuments({});
      const activeClients = await tenantDb.collection('clientmanagement').countDocuments({ 
        status: 'active' 
      });
      
      res.json({
        success: true,
        data: {
          totalClients,
          activeClients,
          inactiveClients: totalClients - activeClients
        }
      });
      
    } catch (error) {
      console.error('Error fetching client stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch client stats',
        error: error.message
      });
    }
  }
};

module.exports = clientController;
