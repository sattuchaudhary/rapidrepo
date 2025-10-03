const Tenant = require('../models/Tenant');
const User = require('../models/User');
const mongoose = require('mongoose');

// Get all tenants with pagination and search
const getAllTenants = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    const skip = (page - 1) * limit;

    let query = {};
    if (search) {
      query = {
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { type: { $regex: search, $options: 'i' } }
        ]
      };
    }

    const tenants = await Tenant.find(query)
      .populate('createdBy', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Tenant.countDocuments(query);
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        tenants,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          total,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Get tenants error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tenants',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Get single tenant by ID
const getTenantById = async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.id)
      .populate('createdBy', 'firstName lastName email');

    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant not found'
      });
    }

    res.json({
      success: true,
      data: { tenant }
    });
  } catch (error) {
    console.error('Get tenant error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tenant',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Create new tenant
const createTenant = async (req, res) => {
  try {
    console.log('Creating tenant with data:', req.body);
    console.log('User from request:', req.user);
    
    const { 
      name, 
      type, 
      subscriptionPlan = 'basic', 
      maxUsers = 10,
      adminFirstName,
      adminLastName,
      adminEmail,
      adminPassword
    } = req.body;

    // Check if tenant name already exists
    const existingTenant = await Tenant.findOne({ name });
    if (existingTenant) {
      return res.status(400).json({
        success: false,
        message: 'Tenant name already exists'
      });
    }

    // Check if admin email already exists
    const existingAdmin = await User.findOne({ email: adminEmail });
    if (existingAdmin) {
      return res.status(400).json({
        success: false,
        message: 'Admin email already exists'
      });
    }

    console.log('Creating tenant document...');
    // Create tenant first
    const tenant = new Tenant({
      name,
      type,
      subscription: {
        plan: subscriptionPlan,
        maxUsers: parseInt(maxUsers),
        currentUsers: 0
      },
      createdBy: req.user._id
    });

    await tenant.save();
    console.log('Tenant saved successfully:', tenant._id);

    console.log('Creating admin user...');
    // Create tenant admin user
    const adminUser = new User({
      firstName: adminFirstName,
      lastName: adminLastName,
      email: adminEmail,
      password: adminPassword,
      role: 'admin',
      tenantId: tenant._id,
      isActive: true
    });

    await adminUser.save();
    console.log('Admin user saved successfully:', adminUser._id);

    // Update tenant with admin user reference
    tenant.adminUser = adminUser._id;
    await tenant.save();
    console.log('Tenant updated with admin user reference');

    console.log('Creating tenant database structure...');
    // Create separate database structure for tenant
    await createTenantDatabase(tenant._id, tenant.name);
    console.log('Tenant database structure created successfully');

    res.status(201).json({
      success: true,
      message: 'Tenant created successfully with admin account',
      data: { 
        tenant,
        adminUser: {
          _id: adminUser._id,
          firstName: adminUser.firstName,
          lastName: adminUser.lastName,
          email: adminUser.email,
          role: adminUser.role
        }
      }
    });
  } catch (error) {
    console.error('Create tenant error details:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to create tenant',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Update tenant
const updateTenant = async (req, res) => {
  try {
    const { name, type, subscriptionPlan, maxUsers, isActive } = req.body;
    const tenantId = req.params.id;

    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant not found'
      });
    }

    // Check if tenant name already exists (excluding current tenant)
    if (name && name !== tenant.name) {
      const existingTenant = await Tenant.findOne({
        _id: { $ne: tenantId },
        name
      });

      if (existingTenant) {
        return res.status(400).json({
          success: false,
          message: 'Tenant name already exists'
        });
      }
    }

    // Update tenant
    const updateData = {};
    if (name) updateData.name = name;
    if (type) updateData.type = type;
    if (isActive !== undefined) updateData.isActive = isActive;
    
    if (subscriptionPlan || maxUsers) {
      updateData.subscription = {
        ...tenant.subscription,
        ...(subscriptionPlan && { plan: subscriptionPlan }),
        ...(maxUsers && { maxUsers: parseInt(maxUsers) })
      };
    }

    const updatedTenant = await Tenant.findByIdAndUpdate(
      tenantId,
      updateData,
      { new: true }
    ).populate('createdBy', 'firstName lastName email')
     .populate('adminUser', 'firstName lastName email');

    res.json({
      success: true,
      message: 'Tenant updated successfully',
      data: { tenant: updatedTenant }
    });
  } catch (error) {
    console.error('Update tenant error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update tenant',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Delete tenant
const deleteTenant = async (req, res) => {
  try {
    const tenantId = req.params.id;

    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant not found'
      });
    }

    // Check if tenant has users
    const userCount = await User.countDocuments({ tenantId });
    if (userCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete tenant with existing users'
      });
    }

    // Delete tenant database structure
    await deleteTenantDatabase(tenantId, tenant.name);

    // Delete tenant
    await Tenant.findByIdAndDelete(tenantId);

    res.json({
      success: true,
      message: 'Tenant deleted successfully'
    });
  } catch (error) {
    console.error('Delete tenant error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete tenant',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Get tenant statistics
const getTenantStats = async (req, res) => {
  try {
    const totalTenants = await Tenant.countDocuments();
    const activeTenants = await Tenant.countDocuments({ isActive: true });
    const inactiveTenants = await Tenant.countDocuments({ isActive: false });

    // Get tenants by subscription plan
    const tenantsByPlan = await Tenant.aggregate([
      {
        $group: {
          _id: '$subscription.plan',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get recent tenants
    const recentTenants = await Tenant.find()
      .populate('createdBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      success: true,
      data: {
        stats: {
          totalTenants,
          activeTenants,
          inactiveTenants
        },
        tenantsByPlan,
        recentTenants
      }
    });
  } catch (error) {
    console.error('Get tenant stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tenant statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Create separate database structure for tenant
const createTenantDatabase = async (tenantId, tenantName) => {
  try {
    console.log(`Creating database structure for tenant: ${tenantId}`);
    
    // Create tenants_db database (if not exists)
    const tenantsDbName = 'tenants_db';
    const tenantsDb = mongoose.connection.useDb(tenantsDbName);
    console.log(`Connected to database: ${tenantsDbName}`);

    // Create tenant-specific database within tenants_db
    const tenantDbName = `tenants_${tenantName.toLowerCase().replace(/\s+/g, '_')}`;
    const tenantDb = mongoose.connection.useDb(tenantDbName);
    console.log(`Creating tenant database: ${tenantDbName}`);

    // Create collections for tenant
    console.log('Creating collections...');
    
    // Users collection
    await tenantDb.createCollection('users');
    console.log('Users collection created');
    
    // Logs collection
    await tenantDb.createCollection('logs');
    console.log('Logs collection created');
    
    // Vehicle collection
    await tenantDb.createCollection('vehicle');
    console.log('Vehicle collection created');

    // Create vehicle sub-collections (as separate collections)
    await tenantDb.createCollection('two_vehicle');
    console.log('Two vehicle collection created');
    
    await tenantDb.createCollection('four_vehicle');
    console.log('Four vehicle collection created');
    
    await tenantDb.createCollection('cv_vehicle');
    console.log('CV vehicle collection created');

    // Client Management collection
    await tenantDb.createCollection('clientmanagement');
    console.log('Client Management collection created');

    // Agency Confirmers collection
    await tenantDb.createCollection('agencyconfirmers');
    console.log('Agency Confirmers collection created');

    console.log(`✅ Created complete database structure for tenant: ${tenantName}`);
    console.log(`📁 Database: ${tenantDbName}`);
    console.log(`📂 Collections: users, logs, vehicle, two_vehicle, four_vehicle, cv_vehicle, clientmanagement, agencyconfirmers`);
    
    // Store tenant database info in main database for reference
    const tenantInfo = {
      tenantId: tenantId,
      tenantName: tenantName,
      databaseName: tenantDbName,
      collections: ['users', 'logs', 'vehicle', 'two_vehicle', 'four_vehicle', 'cv_vehicle', 'clientmanagement', 'agencyconfirmers'],
      createdAt: new Date()
    };
    
    // Store in tenants_db.tenant_databases collection
    await tenantsDb.collection('tenant_databases').insertOne(tenantInfo);
    console.log(`💾 Tenant database info stored in ${tenantsDbName}.tenant_databases`);
    
  } catch (error) {
    console.error('Error creating tenant database structure:', error);
    console.error('Error stack:', error.stack);
    throw error;
  }
};

// Delete tenant database structure
const deleteTenantDatabase = async (tenantId, tenantName) => {
  try {
    // Drop the entire tenant database
    const tenantDbName = `tenants_${tenantName.toLowerCase().replace(/\s+/g, '_')}`;
    const tenantDb = mongoose.connection.useDb(tenantDbName);
    
    // Drop the entire database
    await tenantDb.dropDatabase();
    
    console.log(`Deleted entire database for tenant: ${tenantId} (${tenantDbName})`);
    
    // Also remove from tenant_databases collection
    const tenantsDb = mongoose.connection.useDb('tenants_db');
    await tenantsDb.collection('tenant_databases').deleteOne({ tenantId: tenantId });
    console.log(`Removed tenant info from tenants_db.tenant_databases`);
    
  } catch (error) {
    console.error('Error deleting tenant database structure:', error);
    throw error;
  }
};

// Get tenant database connection
const getTenantConnection = (tenantName) => {
  const tenantDbName = `tenants_${tenantName.toLowerCase().replace(/\s+/g, '_')}`;
  return mongoose.connection.useDb(tenantDbName);
};

// Get tenant specific collection names
const getTenantCollectionNames = () => {
  return {
    users: 'users',
    logs: 'logs',
    vehicle: 'vehicle',
    two_vehicle: 'two_vehicle',
    four_vehicle: 'four_vehicle',
    cv_vehicle: 'cv_vehicle'
  };
};

// Add clientmanagement collection to existing tenants
const addClientManagementToExistingTenants = async (req, res) => {
  try {
    console.log('Adding clientmanagement collection to existing tenants...');
    
    // Get all tenants
    const tenants = await Tenant.find({});
    let updatedCount = 0;
    
    for (const tenant of tenants) {
      try {
        const tenantDbName = `tenants_${tenant.name.toLowerCase().replace(/\s+/g, '_')}`;
        const tenantDb = mongoose.connection.useDb(tenantDbName);
        
        // Check if clientmanagement collection already exists
        const collections = await tenantDb.listCollections().toArray();
        const hasClientManagement = collections.some(col => col.name === 'clientmanagement');
        
        if (!hasClientManagement) {
          await tenantDb.createCollection('clientmanagement');
          console.log(`✅ Added clientmanagement collection to tenant: ${tenant.name}`);
          updatedCount++;
        } else {
          console.log(`ℹ️  Clientmanagement collection already exists for tenant: ${tenant.name}`);
        }
      } catch (error) {
        console.error(`❌ Error adding clientmanagement to tenant ${tenant.name}:`, error.message);
      }
    }
    
    res.json({
      success: true,
      message: `Added clientmanagement collection to ${updatedCount} tenants`,
      updatedCount,
      totalTenants: tenants.length
    });
    
  } catch (error) {
    console.error('Error adding clientmanagement to existing tenants:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add clientmanagement collection',
      error: error.message
    });
  }
};

// Get Two Wheeler Data
const getTwoWheelerData = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { page = 1, limit = 25, search = '' } = req.query;
    
    // Get tenant info
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }
    
    // Connect to tenant database
    const tenantDbName = `tenants_${tenant.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    const tenantDb = mongoose.connection.useDb(tenantDbName);
    
    // Get data from two_wheeler_uploads collection
    const collection = tenantDb.collection('two_wheeler_uploads');
    
    // Build query
    let query = {};
    if (search) {
      query = {
        $or: [
          { bankName: { $regex: search, $options: 'i' } },
          { fileName: { $regex: search, $options: 'i' } },
          { customerName: { $regex: search, $options: 'i' } }
        ]
      };
    }
    
    // Get total count
    const total = await collection.countDocuments(query);
    
    // Get paginated data
    const skip = (page - 1) * limit;
    const data = await collection
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .toArray();
    
    // Transform data for frontend
    const transformedData = data.map((item, index) => ({
      id: skip + index + 1,
      bankName: item.bankName || '',
      fileName: item.fileName || '',
      user: 'System', // You can modify this based on your user tracking
      uploadDate: item.createdAt ? new Date(item.createdAt).toLocaleString('en-IN') : '',
      total: 1, // Each record represents one vehicle
      hold: 0,
      inYard: 0,
      release: 0,
      status: 'ok',
      _id: item._id,
      registrationNumber: item.registrationNumber || '',
      customerName: item.customerName || '',
      make: item.make || '',
      model: item.model || ''
    }));
    
    res.json({
      success: true,
      data: transformedData,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    console.error('Error fetching two wheeler data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch two wheeler data',
      error: error.message
    });
  }
};

// Get Four Wheeler Data
const getFourWheelerData = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { page = 1, limit = 25, search = '' } = req.query;
    
    // Get tenant info
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }
    
    // Connect to tenant database
    const tenantDbName = `tenants_${tenant.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    const tenantDb = mongoose.connection.useDb(tenantDbName);
    
    // Get data from four_wheeler_uploads collection
    const collection = tenantDb.collection('four_wheeler_uploads');
    
    // Build query
    let query = {};
    if (search) {
      query = {
        $or: [
          { bankName: { $regex: search, $options: 'i' } },
          { fileName: { $regex: search, $options: 'i' } },
          { customerName: { $regex: search, $options: 'i' } }
        ]
      };
    }
    
    // Get total count
    const total = await collection.countDocuments(query);
    
    // Get paginated data
    const skip = (page - 1) * limit;
    const data = await collection
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .toArray();
    
    // Transform data for frontend
    const transformedData = data.map((item, index) => ({
      id: skip + index + 1,
      bankName: item.bankName || '',
      fileName: item.fileName || '',
      user: 'System',
      uploadDate: item.createdAt ? new Date(item.createdAt).toLocaleString('en-IN') : '',
      total: 1,
      hold: 0,
      inYard: 0,
      release: 0,
      status: 'ok',
      _id: item._id,
      registrationNumber: item.registrationNumber || '',
      customerName: item.customerName || '',
      make: item.make || '',
      model: item.model || ''
    }));
    
    res.json({
      success: true,
      data: transformedData,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    console.error('Error fetching four wheeler data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch four wheeler data',
      error: error.message
    });
  }
};

// Get CV Data
const getCVData = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { page = 1, limit = 25, search = '' } = req.query;
    
    // Get tenant info
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }
    
    // Connect to tenant database
    const tenantDbName = `tenants_${tenant.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    const tenantDb = mongoose.connection.useDb(tenantDbName);
    
    // Get data from commercial_uploads collection
    const collection = tenantDb.collection('commercial_uploads');
    
    // Build query
    let query = {};
    if (search) {
      query = {
        $or: [
          { bankName: { $regex: search, $options: 'i' } },
          { fileName: { $regex: search, $options: 'i' } },
          { customerName: { $regex: search, $options: 'i' } }
        ]
      };
    }
    
    // Get total count
    const total = await collection.countDocuments(query);
    
    // Get paginated data
    const skip = (page - 1) * limit;
    const data = await collection
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .toArray();
    
    // Transform data for frontend
    const transformedData = data.map((item, index) => ({
      id: skip + index + 1,
      bankName: item.bankName || '',
      fileName: item.fileName || '',
      user: 'System',
      uploadDate: item.createdAt ? new Date(item.createdAt).toLocaleString('en-IN') : '',
      total: 1,
      hold: 0,
      inYard: 0,
      release: 0,
      status: 'ok',
      _id: item._id,
      registrationNumber: item.registrationNumber || '',
      customerName: item.customerName || '',
      make: item.make || '',
      model: item.model || ''
    }));
    
    res.json({
      success: true,
      data: transformedData,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    console.error('Error fetching CV data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch CV data',
      error: error.message
    });
  }
};

module.exports = {
  getAllTenants,
  getTenantById,
  createTenant,
  updateTenant,
  deleteTenant,
  getTenantStats,
  getTenantConnection,
  getTenantCollectionNames,
  addClientManagementToExistingTenants,
  getTwoWheelerData,
  getFourWheelerData,
  getCVData
};
