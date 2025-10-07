const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Verify JWT token for unified system
const authenticateUnifiedToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Normalize decoded fields
    const decodedUserId = decoded.userId || decoded.agentId || decoded.staffId || null;
    let decodedUserType = decoded.userType || decoded.type || null;
    let decodedRole = decoded.role || null;
    let decodedTenantId = decoded.tenantId || null;
    const decodedTenantName = decoded.tenantName || null;

    // Backward compatibility: tokens issued by /api/auth login don't include userType/role/tenantId
    // If we have a userId but no userType, treat as main user by loading from User
    if (!decodedUserType && decodedUserId) {
      const user = await User.findById(decodedUserId).select('-password');
      if (!user || !user.isActive) {
        return res.status(401).json({ success: false, message: 'Invalid token - user not found' });
      }
      decodedUserType = 'main_user';
      decodedRole = user.role;
      decodedTenantId = user.tenantId || null;
      req.user = { userId: decodedUserId, agentId: null, staffId: null, userType: decodedUserType, role: decodedRole, tenantId: decodedTenantId, tenantName: decodedTenantName, mainUser: user };
    } else {
      // Set user info in request directly from token
      req.user = {
        userId: decodedUserId,
        agentId: decoded.agentId || null,
        staffId: decoded.staffId || null,
        userType: decodedUserType,
        role: decodedRole || 'agent',
        tenantId: decodedTenantId,
        tenantName: decodedTenantName
      };

      if (decodedUserType === 'main_user') {
        // Verify main user still exists and is active
        const user = await User.findById(decodedUserId).select('-password');
        if (!user || !user.isActive) {
          return res.status(401).json({ success: false, message: 'Invalid token - user not found' });
        }
        req.user.mainUser = user;
      } else {
        // For mobile users (repo agents, office staff), ensure tenant context exists
        if (!decodedTenantId) {
          return res.status(401).json({ success: false, message: 'Invalid token - missing tenant information' });
        }
      }
    }

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    }
    
    console.error('Unified auth middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication error'
    });
  }
};

// Check if user is super admin
const requireSuperAdmin = (req, res, next) => {
  if (req.user.userType !== 'main_user' || req.user.role !== 'super_admin') {
    return res.status(403).json({
      success: false,
      message: 'Super admin access required'
    });
  }
  next();
};

// Check if user is admin (super admin or tenant admin)
const requireAdmin = (req, res, next) => {
  if (req.user.userType !== 'main_user' || !['super_admin', 'admin'].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }
  next();
};

// Check if user is tenant admin or has tenant access
const requireTenantAccess = (req, res, next) => {
  const { tenantId } = req.params;
  
  // Super admin can access all tenants
  if (req.user.userType === 'main_user' && req.user.role === 'super_admin') {
    return next();
  }
  
  // Tenant admin can access their own tenant
  if (req.user.userType === 'main_user' && req.user.role === 'admin' && req.user.tenantId.toString() === tenantId) {
    return next();
  }
  
  // Tenant users can access their own tenant
  if (req.user.userType !== 'main_user' && req.user.tenantId.toString() === tenantId) {
    return next();
  }
  
  return res.status(403).json({
    success: false,
    message: 'Access denied to this tenant'
  });
};

// Check if user is office staff
const requireOfficeStaff = (req, res, next) => {
  if (req.user.userType !== 'office_staff') {
    return res.status(403).json({
      success: false,
      message: 'Office staff access required'
    });
  }
  next();
};

// Check if user is repo agent
const requireRepoAgent = (req, res, next) => {
  if (req.user.userType !== 'repo_agent') {
    return res.status(403).json({
      success: false,
      message: 'Repo agent access required'
    });
  }
  next();
};

// Optional authentication (for public routes that can work with or without auth)
const optionalUnifiedAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      req.user = {
        userId: decoded.userId,
        userType: decoded.userType,
        role: decoded.role,
        tenantId: decoded.tenantId,
        tenantName: decoded.tenantName
      };
    }
    
    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};

module.exports = {
  authenticateUnifiedToken,
  requireSuperAdmin,
  requireAdmin,
  requireTenantAccess,
  requireOfficeStaff,
  requireRepoAgent,
  optionalUnifiedAuth
};

