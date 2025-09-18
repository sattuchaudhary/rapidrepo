const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const { getTenantDB } = require('../config/database');
const mongoose = require('mongoose');

// Helper function to get OfficeStaff model
const getOfficeStaffModel = (tenantConnection) => {
  const officeStaffSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    phoneNumber: { type: String, required: true, trim: true },
    role: { type: String, required: true, enum: ['Sub Admin', 'Vehicle Confirmer', 'Manager', 'Supervisor', 'Staff'] },
    password: { type: String, required: true },
    status: { type: String, enum: ['active', 'inactive', 'pending'], default: 'active' },
    createdBy: { type: String, required: true }
  }, { timestamps: true });

  // Hash password before save
  officeStaffSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    try {
      const salt = await bcrypt.genSalt(12);
      this.password = await bcrypt.hash(this.password, salt);
      next();
    } catch (err) {
      next(err);
    }
  });

  return tenantConnection.model('OfficeStaff', officeStaffSchema);
};

// Helper function to get RepoAgent model
const getRepoAgentModel = (tenantConnection) => {
  const repoAgentSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phoneNumber: { type: String, required: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, default: 'Repo Agent' },
    status: { type: String, enum: ['active', 'inactive', 'pending'], default: 'active' },
    createdBy: { type: String, required: true }
  }, { timestamps: true });

  // Hash password before save
  repoAgentSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    try {
      const salt = await bcrypt.genSalt(12);
      this.password = await bcrypt.hash(this.password, salt);
      next();
    } catch (err) {
      next(err);
    }
  });

  return tenantConnection.model('RepoAgent', repoAgentSchema);
};

// Generate JWT token
const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// Unified Login Controller
const unifiedLogin = async (req, res) => {
  try {
    const { identifier, password } = req.body; // identifier can be email or phone
    
    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: 'Identifier (email/phone) and password are required'
      });
    }

    console.log(`[UnifiedLogin] Attempting login for: ${identifier}`);

    // Step 1: Check main system users (Super Admin, Tenant Admin, Regular Users)
    const mainUser = await User.findOne({ 
      email: identifier.toLowerCase().trim() 
    }).select('+password');

    if (mainUser && mainUser.isActive) {
      const isPasswordValid = await mainUser.comparePassword(password);
      
      if (isPasswordValid) {
        // Update last login
        mainUser.lastLogin = new Date();
        await mainUser.save();

        const token = generateToken({
          userId: mainUser._id,
          userType: 'main_user',
          role: mainUser.role,
          tenantId: mainUser.tenantId
        });

        console.log(`[UnifiedLogin] Main user login successful: ${mainUser.email}`);

        return res.json({
          success: true,
          message: 'Login successful',
          data: {
            user: {
              id: mainUser._id,
              firstName: mainUser.firstName,
              lastName: mainUser.lastName,
              email: mainUser.email,
              role: mainUser.role,
              tenantId: mainUser.tenantId,
              userType: 'main_user'
            },
            token,
            redirectTo: mainUser.role === 'super_admin' ? '/admin' : 
                      mainUser.role === 'admin' ? '/tenant' : '/dashboard'
          }
        });
      }
    }

    // Step 2: Check tenant users (Office Staff and Repo Agents)
    const tenants = await Tenant.find({ isActive: true }).lean();
    let foundTenantUser = null;

    for (const tenant of tenants) {
      try {
        const conn = await getTenantDB(tenant.name);
        
        // Check Office Staff (allow raw or digits-only phone)
        const OfficeStaff = getOfficeStaffModel(conn);
        const raw = String(identifier || '').trim();
        const digits = raw.replace(/\D/g, '');
        const staff = await OfficeStaff.findOne({
          $or: [
            { phoneNumber: raw },
            { phoneNumber: digits }
          ]
        });

        if (staff && staff.status === 'active') {
          const isPasswordValid = await bcrypt.compare(password, staff.password);
          
          if (isPasswordValid) {
            foundTenantUser = {
              user: staff,
              tenant: tenant,
              userType: 'office_staff'
            };
            break;
          }
        }

        // Check Repo Agents
        const RepoAgent = getRepoAgentModel(conn);
        const agent = await RepoAgent.findOne({
          $or: [
            { email: identifier.toLowerCase().trim() },
            { phoneNumber: identifier.trim() }
          ]
        });

        if (agent && agent.status === 'active') {
          const isPasswordValid = await bcrypt.compare(password, agent.password);
          
          if (isPasswordValid) {
            foundTenantUser = {
              user: agent,
              tenant: tenant,
              userType: 'repo_agent'
            };
            break;
          }
        }

      } catch (error) {
        console.error(`Error checking tenant ${tenant.name}:`, error.message);
        continue;
      }
    }

    if (foundTenantUser) {
      const { user, tenant, userType } = foundTenantUser;
      
      const token = generateToken({
        userId: user._id,
        userType: userType,
        tenantId: tenant._id,
        tenantName: tenant.name,
        role: user.role || userType
      });

      console.log(`[UnifiedLogin] Tenant user login successful: ${user.name} (${userType})`);

      return res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: {
            id: user._id,
            name: user.name,
            email: user.email || null,
            phoneNumber: user.phoneNumber || null,
            role: user.role || userType,
            tenantId: tenant._id,
            tenantName: tenant.name,
            userType: userType
          },
          token,
          redirectTo: userType === 'office_staff' ? '/staff-dashboard' : '/agent-dashboard'
        }
      });
    }

    // If no user found
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });

  } catch (error) {
    console.error('Unified login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Get user profile (works for all user types)
const getUnifiedProfile = async (req, res) => {
  try {
    const { userId, userType, tenantId, tenantName } = req.user;

    if (userType === 'main_user') {
      // Get main user profile
      const user = await User.findById(userId).populate('tenantId');
      
      return res.json({
        success: true,
        data: {
          user: {
            id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            role: user.role,
            tenantId: user.tenantId,
            userType: 'main_user'
          }
        }
      });
    } else {
      // Get tenant user profile
      const conn = await getTenantDB(tenantName);
      let user = null;

      if (userType === 'office_staff') {
        const OfficeStaff = getOfficeStaffModel(conn);
        user = await OfficeStaff.findById(userId);
      } else if (userType === 'repo_agent') {
        const RepoAgent = getRepoAgentModel(conn);
        user = await RepoAgent.findById(userId);
      }

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      return res.json({
        success: true,
        data: {
          user: {
            id: user._id,
            name: user.name,
            email: user.email || null,
            phoneNumber: user.phoneNumber || null,
            role: user.role || userType,
            tenantId: tenantId,
            tenantName: tenantName,
            userType: userType
          }
        }
      });
    }

  } catch (error) {
    console.error('Get unified profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get profile',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

module.exports = {
  unifiedLogin,
  getUnifiedProfile
};
