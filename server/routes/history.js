const express = require('express');
const mongoose = require('mongoose');
const { authenticateUnifiedToken } = require('../middleware/unifiedAuth');
const { getTenantDB } = require('../config/database');
const Tenant = require('../models/Tenant');
const User = require('../models/User');

const router = express.Router();

// Bind models for a tenant connection
const getModelsForTenant = (connection) => ({
  SearchHistory: require('../models/SearchHistory')(connection),
  ShareHistory: require('../models/ShareHistory')(connection),
  AppUsageSession: require('../models/AppUsageSession')(connection),
});

// Middleware to attach tenant models to request
router.use(authenticateUnifiedToken, async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(400).json({ success: false, message: 'Tenant context missing' });
    }

    let tenantId = req.user.tenantId || null;
    let tenantName = req.user.tenantName || null;

    // If we only have tenantId, resolve name; if only name, resolve id
    if (tenantId && !tenantName) {
      try {
        const tenantDoc = await Tenant.findById(tenantId).lean();
        if (tenantDoc && tenantDoc.name) tenantName = tenantDoc.name;
      } catch (_) {}
    } else if (!tenantId && tenantName) {
      try {
        const tenantDoc = await Tenant.findOne({ name: tenantName }).lean();
        if (tenantDoc && tenantDoc._id) tenantId = tenantDoc._id;
      } catch (_) {}
    }

    if (!tenantName) {
      return res.status(400).json({ success: false, message: 'Tenant context missing' });
    }

    const connection = await getTenantDB(tenantName);
    req.tenantModels = getModelsForTenant(connection);
    req.tenantConnection = connection;
    const unifiedUserId = req.user.userId || req.user.agentId || req.user.staffId || req.user._id;
    req.tenantContext = { tenantId, userId: unifiedUserId, tenantName };
    next();
  } catch (error) {
    console.error('History tenant middleware error:', error);
    res.status(500).json({ success: false, message: 'Failed to resolve tenant database' });
  }
});

// GET /api/history/notifications
// Returns recent share actions for the current tenant (admin-visible)
router.get('/notifications', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 25));
    const skip = (page - 1) * pageSize;

    const { ShareHistory } = req.tenantModels;
    const tenantId = req.tenantContext.tenantId;

    const [items, total] = await Promise.all([
      ShareHistory.find({ tenantId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean(),
      ShareHistory.countDocuments({ tenantId })
    ]);

    // Enrich with names: prefer tenant RepoAgent/OfficeStaff, fallback to main Users, finally metadata
    const userIds = Array.from(new Set(items.map(i => String(i.userId)).filter(Boolean)));
    const userMap = new Map();

    // Try tenant-scoped models if they exist
    try {
      const conn = req.tenantConnection;
      const repoModel = conn.models && conn.models.RepoAgent ? conn.model('RepoAgent') : null;
      const staffModel = conn.models && conn.models.OfficeStaff ? conn.model('OfficeStaff') : null;
      if (repoModel) {
        const repoDocs = await repoModel.find({ _id: { $in: userIds } }).select('name').lean();
        for (const d of repoDocs) userMap.set(String(d._id), d.name);
      }
      if (staffModel) {
        const staffDocs = await staffModel.find({ _id: { $in: userIds } }).select('name').lean();
        for (const d of staffDocs) userMap.set(String(d._id), d.name);
      }
    } catch (_) {}

    // Fallback to main User collection
    const remainingIds = userIds.filter(id => !userMap.has(id));
    if (remainingIds.length) {
      const users = await User.find({ _id: { $in: remainingIds } }).select('firstName lastName').lean();
      for (const u of users) {
        userMap.set(String(u._id), `${u.firstName || ''} ${u.lastName || ''}`.trim());
      }
    }

    const normalizeVehicle = (i) => {
      const m = i.metadata || {};
      return m.vehicleNumber || m.vehicle_no || m.regNo || i.vehicleId || '';
    };

    const enriched = items.map(i => ({
      ...i,
      displayName: i.metadata?.userName || userMap.get(String(i.userId)) || 'User',
      vehicleNumber: normalizeVehicle(i),
      loanNumber: i.metadata?.loanNumber || i.metadata?.loan_no || 'N/A',
      bucket: (i.metadata && (i.metadata.bucket ?? 'N/A')) ?? 'N/A'
    }));

    res.json({
      success: true,
      data: {
        items: enriched,
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    });
  } catch (error) {
    console.error('notifications fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to load notifications' });
  }
});

// POST /api/history/search-click
router.post('/search-click', async (req, res) => {
  try {
    const { query, vehicleId, vehicleType, metadata } = req.body || {};
    if (!vehicleId) return res.status(400).json({ success: false, message: 'vehicleId is required' });

    const { SearchHistory } = req.tenantModels;
    const doc = await SearchHistory.create({
      userId: req.tenantContext.userId,
      tenantId: req.tenantContext.tenantId,
      query: query || '',
      vehicleId,
      vehicleType: vehicleType || 'other',
      metadata: metadata || {},
    });
    res.json({ success: true, data: { id: doc._id } });
  } catch (error) {
    console.error('search-click error:', error);
    res.status(500).json({ success: false, message: 'Failed to log search click' });
  }
});

// POST /api/history/share
router.post('/share', async (req, res) => {
  try {
    const { vehicleId, vehicleType, channel, recipient, payloadPreview, metadata } = req.body || {};
    if (!vehicleId) return res.status(400).json({ success: false, message: 'vehicleId is required' });

    const { ShareHistory } = req.tenantModels;
    const doc = await ShareHistory.create({
      userId: req.tenantContext.userId,
      tenantId: req.tenantContext.tenantId,
      vehicleId,
      vehicleType: vehicleType || 'other',
      channel: channel || 'whatsapp',
      recipient: recipient || '',
      payloadPreview: payloadPreview || '',
      metadata: metadata || {},
    });
    res.json({ success: true, data: { id: doc._id } });
  } catch (error) {
    console.error('share history error:', error);
    res.status(500).json({ success: false, message: 'Failed to log share action' });
  }
});

// POST /api/history/usage/start
router.post('/usage/start', async (req, res) => {
  try {
    const { deviceId, platform, metadata } = req.body || {};
    const { AppUsageSession } = req.tenantModels;
    const doc = await AppUsageSession.create({
      userId: req.tenantContext.userId,
      tenantId: req.tenantContext.tenantId,
      deviceId: deviceId || '',
      platform: platform || 'other',
      startedAt: new Date(),
      metadata: metadata || {},
    });
    res.json({ success: true, data: { sessionId: doc._id } });
  } catch (error) {
    console.error('usage start error:', error);
    res.status(500).json({ success: false, message: 'Failed to start usage session' });
  }
});

// POST /api/history/usage/end
router.post('/usage/end', async (req, res) => {
  try {
    const { sessionId, endedAt, metadata } = req.body || {};
    if (!sessionId) return res.status(400).json({ success: false, message: 'sessionId is required' });

    const { AppUsageSession } = req.tenantModels;
    const session = await AppUsageSession.findById(sessionId);
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    if (String(session.userId) !== String(req.tenantContext.userId)) {
      return res.status(403).json({ success: false, message: 'Not your session' });
    }

    const endTime = endedAt ? new Date(endedAt) : new Date();
    const durationMs = endTime - session.startedAt;

    session.endedAt = endTime;
    session.durationMs = Math.max(0, Number(durationMs) || 0);
    if (metadata && typeof metadata === 'object') {
      session.metadata = Object.assign({}, session.metadata || {}, metadata);
    }
    await session.save();

    res.json({ success: true, data: { durationMs: session.durationMs } });
  } catch (error) {
    console.error('usage end error:', error);
    res.status(500).json({ success: false, message: 'Failed to end usage session' });
  }
});

module.exports = router;



