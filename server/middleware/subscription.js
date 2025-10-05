const Tenant = require('../models/Tenant');
const UserSubscription = require('../models/UserSubscription');

// Enforce active subscription for tenant-bound users (mobile and admin except super_admin)
const requireActiveSubscription = async (req, res, next) => {
  try {
    const tenantId = req.user?.tenantId || req.query.tenantId || req.body.tenantId;
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant context required' });
    }
    const now = new Date();
    // Per-user subscription check for mobile users; fallback to tenant-wide if desired
    const mobileUserId = req.user?.agentId || req.user?.staffId || req.user?.userId;
    if (mobileUserId) {
      const userSub = await UserSubscription.findOne({ tenantId, mobileUserId }).select('endDate');
      if (!userSub || !userSub.endDate || new Date(userSub.endDate) < now) {
        return res.status(402).json({ success: false, code: 'SUBSCRIPTION_EXPIRED', message: 'Your subscription expired. Please renew.' });
      }
    }
    next();
  } catch (err) {
    console.error('requireActiveSubscription error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Public endpoint to fetch remaining time for current tenant
const getRemainingTime = async (req, res) => {
  try {
    const tenantId = req.user?.tenantId || req.query.tenantId || req.body.tenantId;
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'tenantId required' });
    }
    const tenant = await require('../models/Tenant').findById(tenantId).select('subscription');
    const now = new Date();
    const end = tenant?.subscription?.endDate ? new Date(tenant.subscription.endDate) : null;
    const remainingMs = end ? Math.max(0, end - now) : 0;
    return res.json({ success: true, data: { endDate: end, remainingMs } });
  } catch (err) {
    console.error('getRemainingTime error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

module.exports = { requireActiveSubscription, getRemainingTime };


