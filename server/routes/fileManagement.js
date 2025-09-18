const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { authenticateUnifiedToken, requireAdmin } = require('../middleware/unifiedAuth');
const Tenant = require('../models/Tenant');
const { getTenantDB } = require('../config/database');

// Helper: escape user-provided strings for safe use in RegExp
const escapeRegexSafe = (str) => String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Public/unified: Mobile/global search across vehicle collections (allows tenant users)
router.get('/search', authenticateUnifiedToken, async (req, res) => {
  try {
    const { q = '', type = 'auto', limit = 200 } = req.query;
    const raw = String(q || '').trim();
    if (!raw) return res.json({ success: true, data: [] });

    const tenantName = req.user?.tenantName;
    const tenantId = req.user?.tenantId;
    if (!tenantName && !tenantId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    let tenant = null;
    if (tenantId) {
      tenant = await Tenant.findById(tenantId);
    }
    if (!tenant && tenantName) {
      tenant = await Tenant.findOne({ name: tenantName });
    }
    if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found' });

    const conn = await getTenantDB(tenant.name);
    const collections = ['two_wheeler_data', 'four_wheeler_data', 'commercial_data'];
    const results = [];
    
    // Optimize for 4-digit registration number searches
    if (/^\d{4}$/.test(raw) && (type === 'auto' || type === 'reg' || type === 'registration')) {
      // Use exact suffix match for better performance
      const suffix = raw;
      
      for (const col of collections) {
        try {
          const Model = conn.model('Vehicle', new mongoose.Schema({}, { strict: false }), col);
          
          // Create indexes if they don't exist (one-time operation)
          try {
            await Model.collection.createIndex({ registrationNumber: 1 });
            await Model.collection.createIndex({ chassisNumber: 1 });
          } catch (indexError) {
            // Index might already exist, ignore error
          }
          
          // Use $regex with $options for better performance
          const docs = await Model.find({
            registrationNumber: { $regex: suffix + '$', $options: 'i' }
          })
          .limit(parseInt(limit))
          .lean()
          .hint({ registrationNumber: 1 }); // Force index usage
          
          for (const v of docs) {
            results.push({
              _id: v._id,
              vehicleType: col.includes('two') ? 'TwoWheeler' : col.includes('four') ? 'FourWheeler' : 'Commercial',
              regNo: v.registrationNumber || '',
              chassisNo: v.chassisNumber || '',
              loanNo: v.agreementNumber || '',
              bank: v.bankName || '',
              make: v.vehicleMake || '',
              customerName: v.customerName || ''
            });
            if (results.length >= parseInt(limit)) break;
          }
          if (results.length >= parseInt(limit)) break;
        } catch (_) {}
      }
    } else {
      // Fallback to original search for other types
      const regex = new RegExp(escapeRegexSafe(raw), 'i');
      
      for (const col of collections) {
        try {
          const Model = conn.model('Vehicle', new mongoose.Schema({}, { strict: false }), col);
          
          // Create indexes if they don't exist
          try {
            await Model.collection.createIndex({ registrationNumber: 1 });
            await Model.collection.createIndex({ chassisNumber: 1 });
            await Model.collection.createIndex({ agreementNumber: 1 });
          } catch (indexError) {
            // Index might already exist, ignore error
          }
          
          const or = [];
          if (type === 'auto' || type === 'chassis') or.push({ chassisNumber: regex });
          if (type === 'auto' || type === 'reg' || type === 'registration') or.push({ registrationNumber: regex });
          if (type === 'auto' || type === 'loan') or.push({ agreementNumber: regex });
          if (/^\d{3,6}$/.test(raw)) {
            const tail = new RegExp(raw + '$', 'i');
            or.push({ chassisNumber: tail });
            or.push({ registrationNumber: tail });
          }
          if (or.length === 0) continue;
          
          const docs = await Model.find({ $or: or })
            .limit(parseInt(limit))
            .lean();
            
          for (const v of docs) {
            results.push({
              _id: v._id,
              vehicleType: col.includes('two') ? 'TwoWheeler' : col.includes('four') ? 'FourWheeler' : 'Commercial',
              regNo: v.registrationNumber || '',
              chassisNo: v.chassisNumber || '',
              loanNo: v.agreementNumber || '',
              bank: v.bankName || '',
              make: v.vehicleMake || '',
              customerName: v.customerName || ''
            });
            if (results.length >= parseInt(limit)) break;
          }
          if (results.length >= parseInt(limit)) break;
        } catch (_) {}
      }
    }

    // Sort A->Z by registration number (fallback to chassis)
    results.sort((a, b) => {
      const ka = (a.regNo || a.chassisNo || '').toString();
      const kb = (b.regNo || b.chassisNo || '').toString();
      return ka.localeCompare(kb, undefined, { sensitivity: 'base' });
    });
    
    return res.json({ success: true, data: results.slice(0, parseInt(limit)) });
  } catch (error) {
    console.error('Search error:', error);
    return res.status(500).json({ success: false, message: 'Search failed' });
  }
});

// Get single vehicle by id (mobile detail)
router.get('/vehicle/:id', authenticateUnifiedToken, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenantId;
    const tenantName = req.user?.tenantName;
    if (!tenantId && !tenantName) return res.status(401).json({ success: false, message: 'Unauthorized' });
    let tenant = null;
    if (tenantId) tenant = await Tenant.findById(tenantId);
    if (!tenant && tenantName) tenant = await Tenant.findOne({ name: tenantName });
    if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found' });

    const conn = await getTenantDB(tenant.name);
    const collections = ['two_wheeler_data', 'four_wheeler_data', 'commercial_data'];
    for (const col of collections) {
      const Model = conn.model('Vehicle', new mongoose.Schema({}, { strict: false }), col);
      try {
        const doc = await Model.findById(id).lean();
        if (doc) {
          return res.json({ success: true, data: { 
            _id: doc._id,
            vehicleType: col.includes('two') ? 'TwoWheeler' : col.includes('four') ? 'FourWheeler' : 'Commercial',
            regNo: doc.registrationNumber || '',
            chassisNo: doc.chassisNumber || '',
            loanNo: doc.agreementNumber || '',
            bank: doc.bankName || '',
            make: doc.vehicleMake || '',
            customerName: doc.customerName || '',
            address: doc.address || '',
            branch: doc.branchName || '',
            status: doc.status || 'Pending'
          }});
        }
      } catch (_) {}
    }
    return res.status(404).json({ success: false, message: 'Vehicle not found' });
  } catch (error) {
    console.error('Vehicle detail error:', error);
    return res.status(500).json({ success: false, message: 'Failed to get vehicle details' });
  }
});

// Log a search history event (who viewed which vehicle and when)
router.post('/search/history', authenticateUnifiedToken, async (req, res) => {
  try {
    const tenantId = req.user?.tenantId || null;
    const tenantName = req.user?.tenantName || null;
    const userId = req.user?.userId || null;
    const userType = req.user?.userType || 'agent';

    const { vehicleId = null, regNo = '', chassisNo = '', query = '', type = '' } = req.body || {};

    const historySchema = new mongoose.Schema({
      tenantId: mongoose.Schema.Types.ObjectId,
      tenantName: String,
      userId: mongoose.Schema.Types.ObjectId,
      userType: String,
      vehicleId: mongoose.Schema.Types.ObjectId,
      regNo: String,
      chassisNo: String,
      query: String,
      type: String,
      createdAt: { type: Date, default: Date.now }
    }, { strict: false });

    const SearchHistory = mongoose.model('SearchHistory', historySchema, 'search_histories');
    await SearchHistory.create({ tenantId, tenantName, userId, userType, vehicleId, regNo, chassisNo, query, type });
    return res.json({ success: true });
  } catch (error) {
    console.error('Search history log error:', error);
    return res.status(500).json({ success: false, message: 'Failed to log search history' });
  }
});

// Progress tracking for offline dump
router.get('/offline-dump-progress', authenticateUnifiedToken, async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const tenantName = req.user?.tenantName;
    if (!tenantId && !tenantName) return res.status(401).json({ success: false, message: 'Unauthorized' });
    
    let tenant = null;
    if (tenantId) tenant = await Tenant.findById(tenantId);
    if (!tenant && tenantName) tenant = await Tenant.findOne({ name: tenantName });
    if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found' });

    const conn = await getTenantDB(tenant.name);
    const collections = ['two_wheeler_data', 'four_wheeler_data', 'commercial_data'];
    let totalRecords = 0;
    
    for (const col of collections) {
      try {
        const Model = conn.model('Vehicle', new mongoose.Schema({}, { strict: false }), col);
        const count = await Model.countDocuments({});
        totalRecords += count;
        console.log(`Collection ${col}: ${count} records`);
      } catch (e) {
        console.error(`Error counting collection ${col}:`, e);
      }
    }
    
    res.json({ 
      success: true, 
      totalRecords: totalRecords,
      collections: collections.length,
      tenant: tenant.name
    });
  } catch (error) {
    console.error('Progress check error:', error);
    res.status(500).json({ success: false, message: 'Failed to check progress' });
  }
});

// Offline dump for tenant (minimal fields), for mobile caching
router.get('/offline-dump', authenticateUnifiedToken, async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const tenantName = req.user?.tenantName;
    if (!tenantId && !tenantName) return res.status(401).json({ success: false, message: 'Unauthorized' });
    let tenant = null;
    if (tenantId) tenant = await Tenant.findById(tenantId);
    if (!tenant && tenantName) tenant = await Tenant.findOne({ name: tenantName });
    if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found' });

    const conn = await getTenantDB(tenant.name);
    const collections = ['two_wheeler_data', 'four_wheeler_data', 'commercial_data'];
    const out = [];
    let totalRecords = 0;
    const batchSize = 10000; // Process in batches of 10k records
    
    console.log(`Starting offline dump for tenant: ${tenant.name}`);
    
    for (const col of collections) {
      try {
        const Model = conn.model('Vehicle', new mongoose.Schema({}, { strict: false }), col);
        
        // Get total count first
        const totalCount = await Model.countDocuments({});
        console.log(`Collection ${col}: ${totalCount} total records`);
        
        // Process in batches to avoid memory issues
        let skip = 0;
        let processedCount = 0;
        
        while (skip < totalCount) {
          const docs = await Model.find({}, {
            registrationNumber: 1,
            chassisNumber: 1,
            agreementNumber: 1,
            bankName: 1,
            vehicleMake: 1,
            customerName: 1,
            address: 1
          })
          .skip(skip)
          .limit(batchSize)
          .lean();
          
          if (docs.length === 0) break;
          
          // Process documents in batch for better performance
          const batchData = [];
          for (const v of docs) {
            // Only include records that have either regNo or chassisNo
            if (v.registrationNumber || v.chassisNumber) {
              batchData.push({
                _id: v._id,
                vehicleType: col.includes('two') ? 'TwoWheeler' : col.includes('four') ? 'FourWheeler' : 'Commercial',
                regNo: v.registrationNumber || '',
                chassisNo: v.chassisNumber || '',
                loanNo: v.agreementNumber || '',
                bank: v.bankName || '',
                make: v.vehicleMake || '',
                customerName: v.customerName || '',
                address: v.address || ''
              });
            }
          }
          
          // Add batch to output
          out.push(...batchData);
          
          processedCount += docs.length;
          skip += batchSize;
          console.log(`Collection ${col}: Processed ${processedCount}/${totalCount} records (${batchData.length} valid)`);
        }
        
        console.log(`Collection ${col}: Retrieved ${processedCount} records`);
        totalRecords += processedCount;
      } catch (e) {
        console.error(`Error processing collection ${col}:`, e);
        // Continue with other collections even if one fails
      }
    }
    
    // Sort stable
    out.sort((a,b)=>{
      const ka=(a.regNo||a.chassisNo||'').toString();
      const kb=(b.regNo||b.chassisNo||'').toString();
      return ka.localeCompare(kb,undefined,{sensitivity:'base'});
    });
    
    console.log(`Offline dump completed: ${out.length} records for ${tenant.name}`);
    
    return res.json({ 
      success: true, 
      data: out,
      totalRecords: out.length,
      collections: collections.length,
      tenant: tenant.name
    });
  } catch (error) {
    console.error('Offline dump error:', error);
    return res.status(500).json({ success: false, message: 'Failed to build offline dump' });
  }
});

// Lightweight stats to plan chunked sync
router.get('/offline-stats', authenticateUnifiedToken, async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const tenantName = req.user?.tenantName;
    if (!tenantId && !tenantName) return res.status(401).json({ success: false, message: 'Unauthorized' });
    let tenant = null;
    if (tenantId) tenant = await Tenant.findById(tenantId);
    if (!tenant && tenantName) tenant = await Tenant.findOne({ name: tenantName });
    if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found' });

    const conn = await getTenantDB(tenant.name);
    const map = {
      two: 'two_wheeler_data',
      four: 'four_wheeler_data',
      comm: 'commercial_data'
    };
    const out = {};
    for (const [key, col] of Object.entries(map)) {
      try {
        const M = conn.model('Vehicle', new mongoose.Schema({}, { strict: false }), col);
        out[key] = await M.countDocuments({});
      } catch (_) { out[key] = 0; }
    }
    return res.json({ success: true, tenant: tenant.name, counts: out, collections: Object.keys(map) });
  } catch (error) {
    console.error('offline-stats error:', error);
    return res.status(500).json({ success: false, message: 'Failed to get stats' });
  }
});

// Chunked data for incremental sync
// query: col=two|four|comm, skip=0, limit=5000
router.get('/offline-chunk', authenticateUnifiedToken, async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const tenantName = req.user?.tenantName;
    if (!tenantId && !tenantName) return res.status(401).json({ success: false, message: 'Unauthorized' });
    let tenant = null;
    if (tenantId) tenant = await Tenant.findById(tenantId);
    if (!tenant && tenantName) tenant = await Tenant.findOne({ name: tenantName });
    if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found' });

    const { col = 'two', skip = 0, limit = 5000 } = req.query;
    const mapping = { two: 'two_wheeler_data', four: 'four_wheeler_data', comm: 'commercial_data' };
    const collection = mapping[col] || mapping.two;
    const conn = await getTenantDB(tenant.name);
    const M = conn.model('Vehicle', new mongoose.Schema({}, { strict: false }), collection);

    const s = Math.max(0, parseInt(skip));
    const l = Math.min(10000, Math.max(1, parseInt(limit)));

    const docs = await M.find({}, {
      registrationNumber: 1,
      chassisNumber: 1,
      agreementNumber: 1,
      bankName: 1,
      vehicleMake: 1,
      customerName: 1,
      address: 1
    }).sort({ _id: 1 }).skip(s).limit(l).lean();

    const data = docs.map(v => ({
      _id: v._id,
      vehicleType: collection.includes('two') ? 'TwoWheeler' : collection.includes('four') ? 'FourWheeler' : 'Commercial',
      regNo: v.registrationNumber || '',
      chassisNo: v.chassisNumber || '',
      loanNo: v.agreementNumber || '',
      bank: v.bankName || '',
      make: v.vehicleMake || '',
      customerName: v.customerName || '',
      address: v.address || ''
    }));

    return res.json({ success: true, tenant: tenant.name, col, skip: s, limit: l, count: data.length, data });
  } catch (error) {
    console.error('offline-chunk error:', error);
    return res.status(500).json({ success: false, message: 'Failed to get chunk' });
  }
});

// Get download progress for large datasets
router.get('/offline-dump-progress', authenticateUnifiedToken, async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const tenantName = req.user?.tenantName;
    if (!tenantId && !tenantName) return res.status(401).json({ success: false, message: 'Unauthorized' });
    
    let tenant = null;
    if (tenantId) tenant = await Tenant.findById(tenantId);
    if (!tenant && tenantName) tenant = await Tenant.findOne({ name: tenantName });
    if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found' });

    const conn = await getTenantDB(tenant.name);
    const collections = ['two_wheeler_data', 'four_wheeler_data', 'commercial_data'];
    let totalRecords = 0;
    
    for (const col of collections) {
      try {
        const Model = conn.model('Vehicle', new mongoose.Schema({}, { strict: false }), col);
        const count = await Model.countDocuments({});
        totalRecords += count;
      } catch (e) {
        // ignore missing collections
      }
    }
    
    return res.json({ 
      success: true, 
      totalRecords,
      collections: collections.length,
      tenant: tenant.name
    });
  } catch (error) {
    console.error('Progress check error:', error);
    return res.status(500).json({ success: false, message: 'Failed to check progress' });
  }
});

// Confirm vehicle by id (simple status update)
router.put('/vehicle/:id/confirm', authenticateUnifiedToken, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenantId;
    const tenantName = req.user?.tenantName;
    if (!tenantId && !tenantName) return res.status(401).json({ success: false, message: 'Unauthorized' });
    let tenant = null;
    if (tenantId) tenant = await Tenant.findById(tenantId);
    if (!tenant && tenantName) tenant = await Tenant.findOne({ name: tenantName });
    if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found' });

    const conn = await getTenantDB(tenant.name);
    const collections = ['two_wheeler_data', 'four_wheeler_data', 'commercial_data'];
    for (const col of collections) {
      const Model = conn.model('Vehicle', new mongoose.Schema({}, { strict: false }), col);
      try {
        const updated = await Model.findByIdAndUpdate(id, { $set: { status: 'Confirmed' } }, { new: true });
        if (updated) {
          // Create admin notification in main DB
          try {
            const notifSchema = new mongoose.Schema({
              tenantId: mongoose.Schema.Types.ObjectId,
              tenantName: String,
              type: String,
              title: String,
              message: String,
              payload: Object,
              createdBy: String,
              createdAt: { type: Date, default: Date.now },
              read: { type: Boolean, default: false }
            }, { strict: false });
            const Notification = mongoose.model('Notification', notifSchema, 'notifications');
            await Notification.create({
              tenantId: tenant._id,
              tenantName: tenant.name,
              type: 'vehicle_confirm',
              title: 'Vehicle confirmation requested',
              message: `Reg ${updated.registrationNumber || ''} confirmed by ${req.user.userType}`,
              payload: {
                vehicleId: updated._id,
                regNo: updated.registrationNumber || '',
                chassisNo: updated.chassisNumber || '',
                loanNo: updated.agreementNumber || '',
                bank: updated.bankName || ''
              },
              createdBy: req.user.userId || null
            });
          } catch (e) {
            console.log('Notification create error:', e.message);
          }
          return res.json({ success: true, message: 'Vehicle confirmed, notification sent', data: { _id: updated._id, status: updated.status } });
        }
      } catch (_) {}
    }
    return res.status(404).json({ success: false, message: 'Vehicle not found' });
  } catch (error) {
    console.error('Vehicle confirm error:', error);
    return res.status(500).json({ success: false, message: 'Failed to confirm vehicle' });
  }
});

// Auth middleware for admin-only routes below
router.use(authenticateUnifiedToken, requireAdmin);

// Get two wheeler upload history
router.get('/two-wheeler', async (req, res) => {
  try {
    const { page = 1, limit = 25, search = '', bank = '', dateStart = '', dateEnd = '' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const tenant = await Tenant.findById(req.user.tenantId);
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }

    const conn = await getTenantDB(tenant.name);

    const VehicleModel = conn.model('Vehicle', new mongoose.Schema({}, { strict: false }), 'two_wheeler_data');
    const UploadModel = conn.model('Upload', new mongoose.Schema({}, { strict: false }), 'two_wheeler_data_uploads');

    // Build match stage from data collection
    const match = {};
    if (search) {
      match.$or = [
        { fileName: { $regex: search, $options: 'i' } },
        { bankName: { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } },
        { registrationNumber: { $regex: search, $options: 'i' } },
        { vehicleMake: { $regex: search, $options: 'i' } }
      ];
    }
    if (bank) {
      match.bankName = { $regex: `^${bank}$`, $options: 'i' };
    }
    if (dateStart || dateEnd) {
      match.uploadDate = {};
      if (dateStart) match.uploadDate.$gte = new Date(dateStart);
      if (dateEnd) {
        const end = new Date(dateEnd);
        // include whole day if only date provided
        end.setHours(23,59,59,999);
        match.uploadDate.$lte = end;
      }
    }

    // Ensure only records with a valid fileName are considered
    match.fileName = match.fileName || { $exists: true, $ne: '' };
    // Ensure only records with a valid fileName are considered
    match.fileName = match.fileName || { $exists: true, $ne: '' };
    const pipeline = [
      { $match: match },
      { $group: {
          _id: '$fileName',
          total: { $sum: 1 },
          lastUploadDate: { $max: '$uploadDate' },
          banks: { $addToSet: '$bankName' }
        }
      },
      { $sort: { lastUploadDate: -1 } },
      { $skip: skip },
      { $limit: parseInt(limit) }
    ];

    const countPipeline = [
      { $match: match },
      { $group: { _id: '$fileName' } },
      { $count: 'total' }
    ];

    const [groups, countArr] = await Promise.all([
      VehicleModel.aggregate(pipeline),
      VehicleModel.aggregate(countPipeline)
    ]);

    const total = countArr[0]?.total || 0;

    // For each group, try to find the matching upload doc to get _id and uploadedBy
    const uploadsByKey = {};
    for (const g of groups) {
      // pick latest upload doc for this fileName (case-insensitive fallback)
      let uploadDoc = await UploadModel.findOne({ fileName: g._id })
        .sort({ uploadDate: -1 })
        .lean();
      if (!uploadDoc) {
        uploadDoc = await UploadModel.findOne({ fileName: { $regex: `^${g._id}$`, $options: 'i' } })
          .sort({ uploadDate: -1 })
          .lean();
      }
      uploadsByKey[g._id] = uploadDoc || null;
    }

    // Resolve user names
    const userIds = [...new Set(Object.values(uploadsByKey)
      .filter(Boolean)
      .map(u => u.uploadedBy)
      .filter(Boolean))];
    const users = {};
    if (userIds.length > 0) {
      try {
        const User = require('../models/User');
        const userData = await User.find({ _id: { $in: userIds } }, { firstName: 1, lastName: 1, email: 1 }).lean();
        userData.forEach(user => {
          users[user._id] = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Unknown User';
        });
      } catch (err) {
        console.log('Could not fetch user names:', err.message);
      }
    }

    const formattedData = groups.map((g, index) => {
      const upload = uploadsByKey[g._id];
      const displayBank = (Array.isArray(g.banks) && g.banks[0]) || upload?.bankName || 'N/A';
      return {
        id: skip + index + 1,
        // Always use encoded fileName as identifier so details can fetch by fileName
        _id: encodeURIComponent(g._id),
        bankName: displayBank,
        fileName: g._id || 'N/A',
        user: upload && users[upload.uploadedBy] ? users[upload.uploadedBy] : 'Shree Parking',
        uploadDate: g.lastUploadDate ? new Date(g.lastUploadDate).toLocaleString('en-GB', {
          day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
        }) : 'N/A',
        total: g.total || 0,
        hold: 0,
        inYard: 0,
        release: 0,
        status: 'ok',
        processedRecords: g.total || 0,
        failedRecords: 0,
        errors: [],
        warnings: []
      };
    });

    res.json({
      success: true,
      data: formattedData,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Error fetching two wheeler uploads:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch upload history',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get four wheeler upload history
router.get('/four-wheeler', async (req, res) => {
  try {
    const { page = 1, limit = 25, search = '', bank = '', dateStart = '', dateEnd = '' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const tenant = await Tenant.findById(req.user.tenantId);
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }

    const conn = await getTenantDB(tenant.name);

    const VehicleModel = conn.model('Vehicle', new mongoose.Schema({}, { strict: false }), 'four_wheeler_data');
    const UploadModel = conn.model('Upload', new mongoose.Schema({}, { strict: false }), 'four_wheeler_data_uploads');

    const match = {};
    if (search) {
      match.$or = [
        { fileName: { $regex: search, $options: 'i' } },
        { bankName: { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } },
        { registrationNumber: { $regex: search, $options: 'i' } },
        { vehicleMake: { $regex: search, $options: 'i' } }
      ];
    }
    if (bank) {
      match.bankName = { $regex: `^${bank}$`, $options: 'i' };
    }
    if (dateStart || dateEnd) {
      match.uploadDate = {};
      if (dateStart) match.uploadDate.$gte = new Date(dateStart);
      if (dateEnd) {
        const end = new Date(dateEnd);
        end.setHours(23,59,59,999);
        match.uploadDate.$lte = end;
      }
    }

    const pipeline = [
      { $match: match },
      { $group: {
          _id: '$fileName',
          total: { $sum: 1 },
          lastUploadDate: { $max: '$uploadDate' },
          banks: { $addToSet: '$bankName' }
        }
      },
      { $sort: { lastUploadDate: -1 } },
      { $skip: skip },
      { $limit: parseInt(limit) }
    ];

    const countPipeline = [
      { $match: match },
      { $group: { _id: '$fileName' } },
      { $count: 'total' }
    ];

    const [groups, countArr] = await Promise.all([
      VehicleModel.aggregate(pipeline),
      VehicleModel.aggregate(countPipeline)
    ]);

    const total = countArr[0]?.total || 0;

    const uploadsByKey = {};
    for (const g of groups) {
      let uploadDoc = await UploadModel.findOne({ fileName: g._id })
        .sort({ uploadDate: -1 })
        .lean();
      if (!uploadDoc) {
        uploadDoc = await UploadModel.findOne({ fileName: { $regex: `^${g._id}$`, $options: 'i' } })
          .sort({ uploadDate: -1 })
          .lean();
      }
      uploadsByKey[g._id] = uploadDoc || null;
    }

    const userIds = [...new Set(Object.values(uploadsByKey)
      .filter(Boolean)
      .map(u => u.uploadedBy)
      .filter(Boolean))];
    const users = {};
    if (userIds.length > 0) {
      try {
        const User = require('../models/User');
        const userData = await User.find({ _id: { $in: userIds } }, { firstName: 1, lastName: 1, email: 1 }).lean();
        userData.forEach(user => {
          users[user._id] = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Unknown User';
        });
      } catch (err) {
        console.log('Could not fetch user names:', err.message);
      }
    }

    const formattedData = groups.map((g, index) => {
      const upload = uploadsByKey[g._id];
      const displayBank = (Array.isArray(g.banks) && g.banks[0]) || upload?.bankName || 'N/A';
      return {
        id: skip + index + 1,
        // Always use encoded fileName as identifier so details can fetch by fileName
        _id: encodeURIComponent(g._id),
        bankName: displayBank,
        fileName: g._id || 'N/A',
        user: upload && users[upload.uploadedBy] ? users[upload.uploadedBy] : 'Shree Parking',
        uploadDate: g.lastUploadDate ? new Date(g.lastUploadDate).toLocaleString('en-GB', {
          day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
        }) : 'N/A',
        total: g.total || 0,
        hold: 0,
        inYard: 0,
        release: 0,
        status: 'ok',
        processedRecords: g.total || 0,
        failedRecords: 0,
        errors: [],
        warnings: []
      };
    });

    res.json({
      success: true,
      data: formattedData,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Error fetching four wheeler uploads:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch upload history',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get commercial vehicle upload history
router.get('/cv', async (req, res) => {
  try {
    const { page = 1, limit = 25, search = '' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const tenant = await Tenant.findById(req.user.tenantId);
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }

    const conn = await getTenantDB(tenant.name);
    
    // Get upload history from commercial_data_uploads collection
    const UploadModel = conn.model('Upload', new mongoose.Schema({}, { strict: false }), 'commercial_data_uploads');
    
    // Build search query
    let searchQuery = {};
    if (search) {
      searchQuery = {
        $or: [
          { fileName: { $regex: search, $options: 'i' } },
          { bankName: { $regex: search, $options: 'i' } },
          { status: { $regex: search, $options: 'i' } }
        ]
      };
    }

    // Get total count
    const total = await UploadModel.countDocuments(searchQuery);
    
    // Get paginated data
    const uploads = await UploadModel.find(searchQuery)
      .sort({ uploadDate: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Get user names for uploadedBy IDs
    const userIds = [...new Set(uploads.map(upload => upload.uploadedBy).filter(Boolean))];
    const users = {};
    
    if (userIds.length > 0) {
      try {
        const User = require('../models/User');
        const userData = await User.find({ _id: { $in: userIds } }, { firstName: 1, lastName: 1, email: 1 }).lean();
        userData.forEach(user => {
          users[user._id] = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Unknown User';
        });
      } catch (err) {
        console.log('Could not fetch user names:', err.message);
      }
    }

    // Format data for frontend
    const formattedData = uploads.map((upload, index) => ({
      id: skip + index + 1,
      _id: upload._id,
      bankName: upload.bankName || 'N/A',
      fileName: upload.fileName || 'N/A',
      user: users[upload.uploadedBy] || 'Shree Parking',
      uploadDate: upload.uploadDate ? new Date(upload.uploadDate).toLocaleString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }) : 'N/A',
      total: upload.totalRecords || 0,
      hold: 0,
      inYard: 0,
      release: 0,
      status: upload.status === 'Completed' ? 'ok' : 'error',
      processedRecords: upload.processedRecords || 0,
      failedRecords: upload.failedRecords || 0,
      errors: upload.errors || [],
      warnings: upload.warnings || []
    }));

    res.json({
      success: true,
      data: formattedData,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Error fetching commercial vehicle uploads:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch upload history',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get specific file data (vehicle details)
// Accept uploadId or encoded fileName as :id
router.get('/file/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 25, search = '', chassisNumber = '', registrationNumber = '', bank = '', dateStart = '', dateEnd = '' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    console.log('=== FILE DATA REQUEST ===');
    console.log('ID param:', id);
    console.log('Query params:', { page, limit, search, chassisNumber, registrationNumber });

    const tenant = await Tenant.findById(req.user.tenantId);
    if (!tenant) {
      console.log('Tenant not found');
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }

    console.log('Tenant found:', tenant.name);
    const conn = await getTenantDB(tenant.name);
    
    // First, let's check what collections exist
    const collections = await conn.db.listCollections().toArray();
    const collectionNames = collections.map(col => col.name);
    console.log('Available collections:', collectionNames);
    
    // Try to find upload record first
    const uploadCollections = ['two_wheeler_data_uploads', 'four_wheeler_data_uploads', 'commercial_data_uploads'];
    let uploadDetails = null;
    let dataCollection = null;
    
    console.log('Searching for upload record by ObjectId...');
    for (const collection of uploadCollections) {
      if (collectionNames.includes(collection)) {
        try {
          console.log(`Checking ${collection}...`);
          const UploadModel = conn.model('Upload', new mongoose.Schema({}, { strict: false }), collection);
          const upload = mongoose.isValidObjectId(id) ? await UploadModel.findById(id).lean() : null;
          
          if (upload) {
            uploadDetails = upload;
            dataCollection = collection.replace('_uploads', '_data');
            console.log('Found upload record:', {
              fileName: upload.fileName,
              vehicleType: upload.vehicleType,
              uploadDate: upload.uploadDate
            });
            break;
          }
        } catch (err) {
          console.log(`Error checking ${collection}:`, err.message);
        }
      }
    }
    
    // If no upload record, treat :id as encoded fileName and fetch by fileName
    if (!uploadDetails) {
      // decode once, and try twice in case of double-encoding
      let decodedFileName = decodeURIComponent(id || '');
      try {
        if (/%[0-9a-fA-F]{2}/.test(decodedFileName)) {
          decodedFileName = decodeURIComponent(decodedFileName);
        }
      } catch (_) {}
      decodedFileName = (decodedFileName || '').trim();
      console.log('No upload record found. Trying by fileName:', decodedFileName);
      // Determine which data collection(s) to search by checking presence
      // Prioritize two_wheeler_data per requirement
      const presentCollections = ['two_wheeler_data', 'four_wheeler_data', 'commercial_data'].filter(c => collectionNames.includes(c));
      if (presentCollections.length === 0) {
        return res.status(404).json({ success: false, message: 'No data collections found' });
      }
      // Prefer two_wheeler_data; fall back to others only if zero results
      const orderedCollections = ['two_wheeler_data', ...presentCollections.filter(c => c !== 'two_wheeler_data')];
      let VehicleModel = null;
      // helper existed at module scope: escapeRegexSafe
      // match ignoring leading/trailing whitespace and case
      const fileNameRegex = new RegExp('^\\s*' + escapeRegexSafe(decodedFileName) + '\\s*$', 'i');
      // Probe each collection with a count to avoid false negatives due to exact-case existence check
      for (const col of orderedCollections) {
        const M = conn.model('Vehicle', new mongoose.Schema({}, { strict: false }), col);
        const probeCount = await M.countDocuments({ fileName: fileNameRegex });
        if (probeCount > 0) { VehicleModel = M; break; }
      }
      if (!VehicleModel) {
        return res.status(404).json({ success: false, message: 'File data not found' });
      }
      let searchQuery = { fileName: fileNameRegex };
      if (bank) searchQuery.bankName = { $regex: `^${bank}$`, $options: 'i' };
      if (dateStart || dateEnd) {
        searchQuery.uploadDate = {};
        if (dateStart) searchQuery.uploadDate.$gte = new Date(dateStart);
        if (dateEnd) { const end = new Date(dateEnd); end.setHours(23,59,59,999); searchQuery.uploadDate.$lte = end; }
      }
      if (search) {
        searchQuery.$and = [{ $or: [
          { customerName: { $regex: search, $options: 'i' } },
          { registrationNumber: { $regex: search, $options: 'i' } },
          { bankName: { $regex: search, $options: 'i' } },
          { vehicleMake: { $regex: search, $options: 'i' } },
          { chassisNumber: { $regex: search, $options: 'i' } }
        ]}];
      }
      if (chassisNumber) (searchQuery.$and ? searchQuery.$and.push({ chassisNumber: { $regex: chassisNumber, $options: 'i' } }) : searchQuery.chassisNumber = { $regex: chassisNumber, $options: 'i' });
      if (registrationNumber) (searchQuery.$and ? searchQuery.$and.push({ registrationNumber: { $regex: registrationNumber, $options: 'i' } }) : searchQuery.registrationNumber = { $regex: registrationNumber, $options: 'i' });
      const total = await VehicleModel.countDocuments(searchQuery);
      const vehicles = await VehicleModel.find(searchQuery).sort({ _id: 1 }).skip(skip).limit(parseInt(limit)).lean();
      const formattedData = vehicles.map((v, i) => ({
        id: skip + i + 1,
        _id: v._id,
        bank: v.bankName || 'N/A',
        regNo: v.registrationNumber || 'N/A',
        loanNo: v.agreementNumber || 'N/A',
        customerName: v.customerName || 'N/A',
        make: v.vehicleMake || 'N/A',
        chassisNo: v.chassisNumber || 'N/A',
        engineNo: v.engineNumber || 'N/A',
        status: 'Pending',
        emiAmount: v.emiAmount || 0,
        address: v.address || 'N/A',
        branchName: v.branchName || 'N/A',
        pos: v.pos || 'N/A',
        bucketStatus: v.bucketStatus || 'N/A',
        firstConfirmedName: v.firstConfirmedName || 'N/A',
        firstConfirmerPhone: v.firstConfirmerPhone || 'N/A',
        secondConfirmedName: v.secondConfirmedName || 'N/A',
        secondConfirmerPhone: v.secondConfirmerPhone || 'N/A',
        thirdConfirmerName: v.thirdConfirmerName || 'N/A',
        thirdConfirmerPhone: v.thirdConfirmerPhone || 'N/A',
        zone: v.zone || 'N/A',
        areaOffice: v.areaOffice || 'N/A',
        region: v.region || 'N/A',
        allocation: v.allocation || 'N/A',
        vehicleModel: v.vehicleModel || 'N/A',
        productName: v.productName || 'N/A',
        location: v.location || 'N/A'
      }));
      return res.json({ success: true, data: formattedData, uploadDetails: {
        fileName: decodedFileName, bankName: bank || 'N/A', vehicleType: 'Unknown', uploadDate: null,
        totalRecords: total, processedRecords: total, failedRecords: 0
      }, pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) } });
    }
    
    // If upload record found, get specific data
    console.log('Getting specific data for upload:', uploadDetails.fileName);
    
    if (!collectionNames.includes(dataCollection)) {
      console.log(`Data collection ${dataCollection} does not exist`);
      return res.status(404).json({ success: false, message: 'Data collection not found' });
    }
    
    const VehicleModel = conn.model('Vehicle', new mongoose.Schema({}, { strict: false }), dataCollection);
    
    // Build search query: include ALL rows for this fileName (do not restrict by uploadDate)
    // Build a flexible filename regex (trim + case-insensitive)
    const escapedUploadedName = escapeRegexSafe(String(uploadDetails.fileName || '').trim());
    const uploadFileNameRegex = new RegExp('^\\s*' + escapedUploadedName + '\\s*$', 'i');
    let searchQuery = { fileName: uploadFileNameRegex };
    if (bank) {
      searchQuery.bankName = { $regex: `^${bank}$`, $options: 'i' };
    }
    if (dateStart || dateEnd) {
      searchQuery.uploadDate = {};
      if (dateStart) searchQuery.uploadDate.$gte = new Date(dateStart);
      if (dateEnd) {
        const end = new Date(dateEnd);
        end.setHours(23,59,59,999);
        searchQuery.uploadDate.$lte = end;
      }
    }
    
    // Add search filters
    if (search) {
      searchQuery.$and = [
        {
          $or: [
            { customerName: { $regex: search, $options: 'i' } },
            { registrationNumber: { $regex: search, $options: 'i' } },
            { bankName: { $regex: search, $options: 'i' } },
            { vehicleMake: { $regex: search, $options: 'i' } },
            { chassisNumber: { $regex: search, $options: 'i' } }
          ]
        }
      ];
    }
    
    if (chassisNumber) {
      if (searchQuery.$and) {
        searchQuery.$and.push({ chassisNumber: { $regex: chassisNumber, $options: 'i' } });
      } else {
        searchQuery.chassisNumber = { $regex: chassisNumber, $options: 'i' };
      }
    }
    
    if (registrationNumber) {
      if (searchQuery.$and) {
        searchQuery.$and.push({ registrationNumber: { $regex: registrationNumber, $options: 'i' } });
      } else {
        searchQuery.registrationNumber = { $regex: registrationNumber, $options: 'i' };
      }
    }
    
    console.log('Search query:', JSON.stringify(searchQuery, null, 2));
    
    // Get total count
    const total = await VehicleModel.countDocuments(searchQuery);
    console.log('Total records found:', total);
    
    // Get paginated data
    const vehicles = await VehicleModel.find(searchQuery)
      .sort({ _id: 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();
    
    console.log('Vehicles fetched:', vehicles.length);
    
    // Format data for frontend
    const formattedData = vehicles.map((vehicle, index) => ({
      id: skip + index + 1,
      _id: vehicle._id,
      bank: vehicle.bankName || 'N/A',
      regNo: vehicle.registrationNumber || 'N/A',
      loanNo: vehicle.agreementNumber || 'N/A',
      customerName: vehicle.customerName || 'N/A',
      make: vehicle.vehicleMake || 'N/A',
      chassisNo: vehicle.chassisNumber || 'N/A',
      engineNo: vehicle.engineNumber || 'N/A',
      status: 'Pending',
      emiAmount: vehicle.emiAmount || 0,
      address: vehicle.address || 'N/A',
      branchName: vehicle.branchName || 'N/A',
      pos: vehicle.pos || 'N/A',
      bucketStatus: vehicle.bucketStatus || 'N/A',
      firstConfirmedName: vehicle.firstConfirmedName || 'N/A',
      firstConfirmerPhone: vehicle.firstConfirmerPhone || 'N/A',
      secondConfirmedName: vehicle.secondConfirmedName || 'N/A',
      secondConfirmerPhone: vehicle.secondConfirmerPhone || 'N/A',
      thirdConfirmerName: vehicle.thirdConfirmerName || 'N/A',
      thirdConfirmerPhone: vehicle.thirdConfirmerPhone || 'N/A',
      zone: vehicle.zone || 'N/A',
      areaOffice: vehicle.areaOffice || 'N/A',
      region: vehicle.region || 'N/A',
      allocation: vehicle.allocation || 'N/A',
      vehicleModel: vehicle.vehicleModel || 'N/A',
      productName: vehicle.productName || 'N/A',
      location: vehicle.location || 'N/A'
    }));
    
    console.log('Returning specific data:', formattedData.length, 'records');
    
    res.json({
      success: true,
      data: formattedData,
      uploadDetails: {
        fileName: uploadDetails.fileName,
        bankName: uploadDetails.bankName,
        vehicleType: uploadDetails.vehicleType,
        uploadDate: uploadDetails.uploadDate,
        totalRecords: uploadDetails.totalRecords,
        processedRecords: uploadDetails.processedRecords,
        failedRecords: uploadDetails.failedRecords
      },
      pagination: {
        total: total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Error fetching file data:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch file data',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Delete two wheeler data by upload id or encoded filename
router.delete('/two-wheeler/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const tenant = await Tenant.findById(req.user.tenantId);
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }

    const conn = await getTenantDB(tenant.name);
    const VehicleModel = conn.model('Vehicle', new mongoose.Schema({}, { strict: false }), 'two_wheeler_data');
    const UploadModel = conn.model('Upload', new mongoose.Schema({}, { strict: false }), 'two_wheeler_data_uploads');

    let targetFileName = null;

    // Try ObjectId path first
    if (mongoose.isValidObjectId(id)) {
      const uploadDoc = await UploadModel.findById(id).lean();
      if (uploadDoc && uploadDoc.fileName) {
        targetFileName = String(uploadDoc.fileName).trim();
      }
    }

    // If not found via ObjectId, treat id as encoded filename
    if (!targetFileName) {
      let decodedFileName = decodeURIComponent(id || '');
      try {
        if (/%[0-9a-fA-F]{2}/.test(decodedFileName)) {
          decodedFileName = decodeURIComponent(decodedFileName);
        }
      } catch (_) {}
      decodedFileName = (decodedFileName || '').trim();
      if (decodedFileName) {
        targetFileName = decodedFileName;
      }
    }

    if (!targetFileName) {
      return res.status(400).json({ success: false, message: 'Invalid identifier provided' });
    }

    const fileNameRegex = new RegExp('^\\s*' + escapeRegexSafe(targetFileName) + '\\s*$', 'i');

    const deleteDataResult = await VehicleModel.deleteMany({ fileName: fileNameRegex });
    const deleteUploadResult = await UploadModel.deleteMany({ fileName: fileNameRegex });

    if ((deleteDataResult.deletedCount || 0) === 0 && (deleteUploadResult.deletedCount || 0) === 0) {
      return res.status(404).json({ success: false, message: 'No matching records found to delete' });
    }

    return res.json({
      success: true,
      message: 'Deletion completed',
      fileName: targetFileName,
      deletedDataCount: deleteDataResult.deletedCount || 0,
      deletedUploadCount: deleteUploadResult.deletedCount || 0
    });
  } catch (error) {
    console.error('Error deleting two wheeler data:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete two wheeler data',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Debug endpoint to check collections
router.get('/debug/collections', async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.user.tenantId);
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }

    const conn = await getTenantDB(tenant.name);
    
    // List all collections
    const collections = await conn.db.listCollections().toArray();
    const collectionNames = collections.map(col => col.name);
    
    // Check specific collections we're interested in
    const targetCollections = [
      'two_wheeler_data_uploads',
      'four_wheeler_data_uploads', 
      'commercial_data_uploads',
      'two_wheeler_data',
      'four_wheeler_data',
      'commercial_data'
    ];
    
    const collectionInfo = {};
    
    for (const collectionName of targetCollections) {
      try {
        const exists = collectionNames.includes(collectionName);
        let count = 0;
        
        if (exists) {
          const Model = conn.model('Temp', new mongoose.Schema({}, { strict: false }), collectionName);
          count = await Model.countDocuments({});
        }
        
        collectionInfo[collectionName] = {
          exists,
          count
        };
      } catch (err) {
        collectionInfo[collectionName] = {
          exists: false,
          count: 0,
          error: err.message
        };
      }
    }
    
    res.json({
      success: true,
      tenant: tenant.name,
      allCollections: collectionNames,
      targetCollections: collectionInfo
    });
    
  } catch (error) {
    console.error('Error in debug collections:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get collection info',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Mobile/global search across vehicle collections
router.get('/search', async (req, res) => {
  try {
    const { q = '', type = 'auto', limit = 200 } = req.query;
    const raw = String(q || '').trim();
    if (!raw) return res.json({ success: true, data: [] });

    const tenant = await Tenant.findById(req.user.tenantId);
    if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found' });

    const conn = await getTenantDB(tenant.name);
    const collections = ['two_wheeler_data', 'four_wheeler_data', 'commercial_data'];
    const results = [];
    const regex = new RegExp(escapeRegexSafe(raw), 'i');

    for (const col of collections) {
      try {
        const Model = conn.model('Vehicle', new mongoose.Schema({}, { strict: false }), col);
        const or = [];
        if (type === 'auto' || type === 'chassis') {
          or.push({ chassisNumber: regex });
        }
        if (type === 'auto' || type === 'reg' || type === 'registration') {
          or.push({ registrationNumber: regex });
        }
        if (type === 'auto' || type === 'loan') {
          or.push({ agreementNumber: regex });
        }
        // Last 4 digits convenience: if q is 3-6 digits, also endsWith
        if (/^\d{3,6}$/.test(raw)) {
          const tail = new RegExp(raw + '$', 'i');
          or.push({ chassisNumber: tail });
          or.push({ registrationNumber: tail });
        }
        if (or.length === 0) continue;
        const docs = await Model.find({ $or: or })
          .limit(parseInt(limit))
          .lean();
        for (const v of docs) {
          results.push({
            _id: v._id,
            vehicleType: col.includes('two') ? 'TwoWheeler' : col.includes('four') ? 'FourWheeler' : 'Commercial',
            regNo: v.registrationNumber || '',
            chassisNo: v.chassisNumber || '',
            loanNo: v.agreementNumber || '',
            bank: v.bankName || '',
            make: v.vehicleMake || '',
            customerName: v.customerName || '',
          });
          if (results.length >= parseInt(limit)) break;
        }
        if (results.length >= parseInt(limit)) break;
      } catch (e) {
        // ignore missing collections
      }
    }

    return res.json({ success: true, data: results.slice(0, parseInt(limit)) });
  } catch (error) {
    console.error('Search error:', error);
    return res.status(500).json({ success: false, message: 'Search failed' });
  }
});

module.exports = router;
