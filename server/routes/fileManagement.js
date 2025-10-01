const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { authenticateUnifiedToken, requireAdmin } = require('../middleware/unifiedAuth');
const Tenant = require('../models/Tenant');
const { getTenantDB } = require('../config/database');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
let BetterSqlite3;

// Try to load better-sqlite3 for snapshot building; if unavailable, endpoints will respond accordingly
try {
  // eslint-disable-next-line import/no-extraneous-dependencies, global-require
  BetterSqlite3 = require('better-sqlite3');
} catch (_) {
  BetterSqlite3 = null;
}

const SNAPSHOT_DIR = process.env.SNAPSHOT_DIR || path.join(process.cwd(), 'snapshots');
const ensureDir = (p) => { try { fs.mkdirSync(p, { recursive: true }); } catch (_) {} };
ensureDir(SNAPSHOT_DIR);

const getSnapshotPaths = (tenantName) => {
  const safe = String(tenantName || 'tenant').replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
  const base = path.join(SNAPSHOT_DIR, safe);
  ensureDir(base);
  return {
    dir: base,
    dbPath: path.join(base, 'rapidrepo.db'),
    tmpPath: path.join(base, 'rapidrepo.db.tmp'),
    metaPath: path.join(base, 'meta.json')
  };
};

async function buildTenantSnapshotInternal(tenantName) {
  if (!BetterSqlite3) {
    throw new Error('better-sqlite3 not installed. Run: npm install better-sqlite3');
  }

  const paths = getSnapshotPaths(tenantName);
  // Remove existing tmp
  try { fs.unlinkSync(paths.tmpPath); } catch (_) {}

  const db = new BetterSqlite3(paths.tmpPath);
  try {
    // Use compatible settings for mobile SQLite
    db.pragma('journal_mode = DELETE');
    db.pragma('synchronous = FULL');
    db.pragma('page_size = 4096');
    db.exec(`CREATE TABLE IF NOT EXISTS vehicles (
      _id TEXT PRIMARY KEY,
      vehicleType TEXT,
      regNo TEXT,
      regSuffix TEXT,
      chassisNo TEXT,
      chassisLc TEXT,
      loanNo TEXT,
      bank TEXT,
      make TEXT,
      customerName TEXT,
      address TEXT
    );`);
    db.exec('CREATE INDEX IF NOT EXISTS idx_vehicles_regsuffix ON vehicles (regSuffix);');
    db.exec('CREATE INDEX IF NOT EXISTS idx_vehicles_chassislc ON vehicles (chassisLc);');
    db.exec('CREATE INDEX IF NOT EXISTS idx_vehicles_regno ON vehicles (regNo);');
    db.exec('CREATE INDEX IF NOT EXISTS idx_vehicles_chassisno ON vehicles (chassisNo);');
    db.exec('CREATE INDEX IF NOT EXISTS idx_vehicles_loanno ON vehicles (loanNo);');

    const insertStmt = db.prepare(`INSERT OR REPLACE INTO vehicles
      (_id, vehicleType, regNo, regSuffix, chassisNo, chassisLc, loanNo, bank, make, customerName, address)
      VALUES (@_id, @vehicleType, @regNo, @regSuffix, @chassisNo, @chassisLc, @loanNo, @bank, @make, @customerName, @address)`);
    const insertMany = db.transaction((rows) => {
      for (const v of rows) insertStmt.run(v);
    });

    // Pull data from Mongo in chunks and insert
    const conn = await getTenantDB(tenantName);
    const collections = ['two_wheeler_data', 'four_wheeler_data', 'commercial_data'];
    for (const col of collections) {
      try {
        const M = conn.model('Vehicle', new mongoose.Schema({}, { strict: false }), col);
        const total = await M.countDocuments({});
        const batch = 10000;
        for (let skip = 0; skip < total; skip += batch) {
          const docs = await M.find({}, {
            registrationNumber: 1,
            chassisNumber: 1,
            agreementNumber: 1,
            bankName: 1,
            vehicleMake: 1,
            customerName: 1,
            address: 1
          }).sort({ _id: 1 }).skip(skip).limit(batch).lean();
          const rows = [];
          for (const v of docs) {
            const regNo = String(v.registrationNumber || '').trim();
            const chassisNo = String(v.chassisNumber || '').trim();
            if (!regNo && !chassisNo) continue;
            rows.push({
              _id: String(v._id || ''),
              vehicleType: col.includes('two') ? 'TwoWheeler' : col.includes('four') ? 'FourWheeler' : 'Commercial',
              regNo,
              regSuffix: regNo.length >= 4 ? regNo.slice(-4) : '',
              chassisNo,
              chassisLc: chassisNo.toLowerCase(),
              loanNo: String(v.agreementNumber || ''),
              bank: String(v.bankName || ''),
              make: String(v.vehicleMake || ''),
              customerName: String(v.customerName || ''),
              address: String(v.address || '')
            });
          }
          if (rows.length) insertMany(rows);
        }
      } catch (_) {}
    }

    // Optimize database before closing
    db.pragma('optimize');
    db.close();

    // Move tmp -> final
    try { fs.unlinkSync(paths.dbPath); } catch (_) {}
    fs.renameSync(paths.tmpPath, paths.dbPath);

    // Compute md5 and size
    const buf = fs.readFileSync(paths.dbPath);
    const md5 = crypto.createHash('md5').update(buf).digest('hex');
    const size = fs.statSync(paths.dbPath).size;
    const meta = { tenant: tenantName, md5, size, version: Date.now(), updatedAt: new Date().toISOString() };
    fs.writeFileSync(paths.metaPath, JSON.stringify(meta));
    return meta;
  } catch (e) {
    try { db.close(); } catch (_) {}
    try { fs.unlinkSync(paths.tmpPath); } catch (_) {}
    throw e;
  }
}

// Expose builder for internal use (e.g., after upload)
router.buildTenantSnapshot = async (tenantName) => buildTenantSnapshotInternal(tenantName);

// Snapshot meta endpoint
router.get('/offline-snapshot-meta', authenticateUnifiedToken, async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const tenantNameClaim = req.user?.tenantName;
    let tenant = null;
    if (tenantId) tenant = await Tenant.findById(tenantId);
    if (!tenant && tenantNameClaim) tenant = await Tenant.findOne({ name: tenantNameClaim });
    if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found' });

    const { metaPath } = getSnapshotPaths(tenant.name);
    if (!fs.existsSync(metaPath)) return res.status(404).json({ success: false, message: 'Snapshot not found' });
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    return res.json(meta);
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to get snapshot meta' });
  }
});

// Snapshot download endpoint
router.get('/offline-snapshot', authenticateUnifiedToken, async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const tenantNameClaim = req.user?.tenantName;
    let tenant = null;
    if (tenantId) tenant = await Tenant.findById(tenantId);
    if (!tenant && tenantNameClaim) tenant = await Tenant.findOne({ name: tenantNameClaim });
    if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found' });

    const { dbPath } = getSnapshotPaths(tenant.name);
    if (!fs.existsSync(dbPath)) return res.status(404).json({ success: false, message: 'Snapshot not found' });
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', 'attachment; filename="rapidrepo.db"');
    fs.createReadStream(dbPath).pipe(res);
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to get snapshot' });
  }
});

// Build snapshot on demand (admin only)
router.post('/offline-snapshot/build', authenticateUnifiedToken, requireAdmin, async (req, res) => {
  try {
    if (!BetterSqlite3) {
      return res.status(501).json({ success: false, message: 'Snapshot builder unavailable. Install dependency: npm install better-sqlite3' });
    }
    const tenantId = req.user?.tenantId;
    const tenantNameClaim = req.user?.tenantName;
    let tenant = null;
    if (tenantId) tenant = await Tenant.findById(tenantId);
    if (!tenant && tenantNameClaim) tenant = await Tenant.findOne({ name: tenantNameClaim });
    if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found' });

    const meta = await buildTenantSnapshotInternal(tenant.name);
    return res.json({ success: true, message: 'Snapshot built', meta });
  } catch (error) {
    console.error('Snapshot build error:', error);
    return res.status(500).json({ success: false, message: 'Failed to build snapshot' });
  }
});

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
          // normalized view + include entire raw document so frontend can render additional fields
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
            branch: doc.branchName || doc.branch || '',
            status: doc.status || 'Pending',
            engineNo: doc.engineNumber || doc.engineNo || '',
            productName: doc.productName || '',
            emiAmount: doc.emiAmount || '',
            pos: doc.pos || doc.POS || '',
            model: doc.model || doc.vehicleModel || '',
            uploadDate: doc.uploadDate || doc.createdAt || null,
            bucket: doc.bucket || '',
            season: doc.season || doc.seasoning || '',
            inYard: doc.inYard || doc.inyard || doc.yardStatus || '',
            yardName: doc.yardName || doc.yard || '',
            yardLocation: doc.yardLocation || doc.yardAddress || '',
            fileName: doc.fileName || '',
            raw: doc
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

// Generic vehicle status update
router.put('/vehicle/:id/status', authenticateUnifiedToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};
    const allowed = ['Pending','Hold','In Yard','Released','Cancelled','pending','hold','inYard','released','cancelled'];
    if (!status || !allowed.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

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
        const updated = await Model.findByIdAndUpdate(id, { $set: { status } }, { new: true });
        if (updated) {
          return res.json({ success: true, message: 'Status updated', data: { _id: updated._id, status: updated.status } });
        }
      } catch (_) {}
    }
    return res.status(404).json({ success: false, message: 'Vehicle not found' });
  } catch (error) {
    console.error('Vehicle status update error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update status' });
  }
});

// Delete single vehicle by id (from any collection)
router.delete('/vehicle/:id', authenticateUnifiedToken, async (req, res) => {
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
        const existing = await Model.findById(id).lean();
        if (existing) {
          const del = await Model.deleteOne({ _id: id });
          return res.json({ success: true, message: 'Vehicle deleted', deletedCount: del?.deletedCount || 0 });
        }
      } catch (_) {}
    }
    return res.status(404).json({ success: false, message: 'Vehicle not found' });
  } catch (error) {
    console.error('Vehicle delete error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete vehicle' });
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
    const { since } = req.query;
    const sinceDate = since ? new Date(since) : new Date(0);
    
    const out = {};
    let newRecords = 0;
    
    for (const [key, col] of Object.entries(map)) {
      try {
        const M = conn.model('Vehicle', new mongoose.Schema({}, { strict: false }), col);
        const totalCount = await M.countDocuments({});
        out[key] = totalCount;
        
        // Count new records since last sync
        const newCount = await M.countDocuments({
          $or: [
            { createdAt: { $gte: sinceDate } },
            { updatedAt: { $gte: sinceDate } },
            { uploadDate: { $gte: sinceDate } }
          ]
        });
        newRecords += newCount;
      } catch (_) { 
        out[key] = 0; 
      }
    }
    
    return res.json({ 
      success: true, 
      tenant: tenant.name, 
      counts: out, 
      newRecords: newRecords,
      since: sinceDate.toISOString(),
      collections: Object.keys(map) 
    });
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
    const l = Math.min(100000, Math.max(1, parseInt(limit))); // Max 1 lakh records per chunk

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

// Incremental sync - get only new data since last sync
router.get('/incremental-sync', authenticateUnifiedToken, async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const tenantName = req.user?.tenantName;
    if (!tenantId && !tenantName) return res.status(401).json({ success: false, message: 'Unauthorized' });
    
    let tenant = null;
    if (tenantId) tenant = await Tenant.findById(tenantId);
    if (!tenant && tenantName) tenant = await Tenant.findOne({ name: tenantName });
    if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found' });

    const { since } = req.query;
    const sinceDate = since ? new Date(since) : new Date(0);
    
    const conn = await getTenantDB(tenant.name);
    const collections = ['two_wheeler_data', 'four_wheeler_data', 'commercial_data'];
    const out = [];
    let totalRecords = 0;
    
    console.log(`Incremental sync for tenant: ${tenant.name} since ${sinceDate.toISOString()}`);
    
    for (const col of collections) {
      try {
        const Model = conn.model('Vehicle', new mongoose.Schema({}, { strict: false }), col);
        
        // Find records created or updated since the given date
        const docs = await Model.find({
          $or: [
            { createdAt: { $gte: sinceDate } },
            { updatedAt: { $gte: sinceDate } },
            { uploadDate: { $gte: sinceDate } }
          ]
        }, {
          registrationNumber: 1,
          chassisNumber: 1,
          agreementNumber: 1,
          bankName: 1,
          vehicleMake: 1,
          customerName: 1,
          address: 1,
          createdAt: 1,
          updatedAt: 1,
          uploadDate: 1
        }).sort({ _id: 1 }).lean();

        const data = docs.map(v => ({
          _id: v._id,
          vehicleType: col.includes('two') ? 'TwoWheeler' : col.includes('four') ? 'FourWheeler' : 'Commercial',
          regNo: v.registrationNumber || '',
          chassisNo: v.chassisNumber || '',
          loanNo: v.agreementNumber || '',
          bank: v.bankName || '',
          make: v.vehicleMake || '',
          customerName: v.customerName || '',
          address: v.address || '',
          createdAt: v.createdAt,
          updatedAt: v.updatedAt,
          uploadDate: v.uploadDate
        }));

        out.push(...data);
        totalRecords += data.length;
        console.log(`Collection ${col}: Found ${data.length} new/updated records`);
      } catch (e) {
        console.error(`Error processing collection ${col}:`, e);
      }
    }
    
    console.log(`Incremental sync completed: ${totalRecords} new/updated records for ${tenant.name}`);
    
    return res.json({ 
      success: true, 
      data: out,
      totalRecords: totalRecords,
      since: sinceDate.toISOString(),
      tenant: tenant.name
    });
  } catch (error) {
    console.error('Incremental sync error:', error);
    return res.status(500).json({ success: false, message: 'Failed to get incremental data' });
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

// Auth: allow tenant users (repo agents/office staff) to access read-only download endpoints
// and keep admin requirement for mutating/admin-only routes.
router.use(authenticateUnifiedToken);
router.use((req, res, next) => {
  try {
    const isGet = String(req.method || '').toUpperCase() === 'GET';
    const p = String(req.path || '');
    const isReadOnlyDownload = isGet && (
      p === '/two-wheeler' ||
      p === '/four-wheeler' ||
      p === '/cv' ||
      p.startsWith('/file/') ||
      p === '/offline-dump-progress' ||
      p === '/dashboard-stats'
    );
    if (isReadOnlyDownload) return next();
  } catch (_) {}
  return requireAdmin(req, res, next);
});

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
    
    // If no users found, try to get from tenant users
    if (Object.keys(users).length === 0) {
      try {
        const User = require('../models/User');
        const tenantUsers = await User.find({ tenantId: tenant._id }, { firstName: 1, lastName: 1, email: 1 }).lean();
        tenantUsers.forEach(user => {
          users[user._id] = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Unknown User';
        });
      } catch (err) {
        console.log('Could not fetch tenant users:', err.message);
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
        user: upload && users[upload.uploadedBy] ? users[upload.uploadedBy] : tenant.name || 'Unknown User',
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

// Tenant dashboard statistics (totals and breakdowns)
router.get('/dashboard-stats', async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.user.tenantId);
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }

    const conn = await getTenantDB(tenant.name);
    const collections = {
      two: 'two_wheeler_data',
      four: 'four_wheeler_data',
      comm: 'commercial_data'
    };

    const out = {
      totalRecords: 0,
      onHold: 0,
      inYard: 0,
      released: 0,
      totalVehicles: 0,
      twoWheeler: 0,
      fourWheeler: 0,
      cvData: 0,
      associatedBanks: [],
      userStats: {
        officeStaff: 0,
        repoAgents: 0
      }
    };

    const bankCounts = new Map();

    // Count vehicles per collection and accumulate bank counts
    for (const [key, col] of Object.entries(collections)) {
      try {
        const M = conn.model('Vehicle', new mongoose.Schema({}, { strict: false }), col);
        const total = await M.countDocuments({});
        out.totalVehicles += total;
        if (key === 'two') out.twoWheeler = total;
        if (key === 'four') out.fourWheeler = total;
        if (key === 'comm') out.cvData = total;

        // Optional status tallies if field exists
        try { out.onHold += await M.countDocuments({ status: /hold/i }); } catch (_) {}
        try { out.inYard += await M.countDocuments({ status: /yard/i }); } catch (_) {}
        try { out.released += await M.countDocuments({ status: /release/i }); } catch (_) {}

        // Aggregate bankName counts (top 10)
        const banks = await M.aggregate([
          { $match: { bankName: { $exists: true, $ne: '' } } },
          { $group: { _id: '$bankName', count: { $sum: 1 } } }
        ]);
        for (const b of banks) {
          const name = String(b._id || '').trim();
          const prev = bankCounts.get(name) || 0;
          bankCounts.set(name, prev + (b.count || 0));
        }
      } catch (_) { /* collection may not exist */ }
    }

    out.totalRecords = out.totalVehicles;
    out.associatedBanks = Array.from(bankCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    // User stats from tenant database collections
    try {
      const OfficeStaff = conn.model('OfficeStaff', new mongoose.Schema({}, { strict: false }), 'officestaffs');
      out.userStats.officeStaff = await OfficeStaff.countDocuments({});
    } catch (_) { /* collection may not exist */ }
    try {
      const RepoAgent = conn.model('RepoAgent', new mongoose.Schema({}, { strict: false }), 'repoagents');
      out.userStats.repoAgents = await RepoAgent.countDocuments({});
    } catch (_) { /* collection may not exist */ }

    return res.json({ success: true, data: out });
  } catch (error) {
    console.error('dashboard-stats error:', error);
    return res.status(500).json({ success: false, message: 'Failed to get dashboard stats' });
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
    
    // If no users found, try to get from tenant users
    if (Object.keys(users).length === 0) {
      try {
        const User = require('../models/User');
        const tenantUsers = await User.find({ tenantId: tenant._id }, { firstName: 1, lastName: 1, email: 1 }).lean();
        tenantUsers.forEach(user => {
          users[user._id] = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Unknown User';
        });
      } catch (err) {
        console.log('Could not fetch tenant users:', err.message);
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
        user: upload && users[upload.uploadedBy] ? users[upload.uploadedBy] : tenant.name || 'Unknown User',
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
    
    // If no users found, try to get from tenant users
    if (Object.keys(users).length === 0) {
      try {
        const User = require('../models/User');
        const tenantUsers = await User.find({ tenantId: tenant._id }, { firstName: 1, lastName: 1, email: 1 }).lean();
        tenantUsers.forEach(user => {
          users[user._id] = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Unknown User';
        });
      } catch (err) {
        console.log('Could not fetch tenant users:', err.message);
      }
    }

    // Get actual vehicle counts for each file from commercial_data collection
    const VehicleModel = conn.model('Vehicle', new mongoose.Schema({}, { strict: false }), 'commercial_data');
    const fileCounts = {};
    
    for (const upload of uploads) {
      if (upload.fileName) {
        try {
          const fileNameRegex = new RegExp('^\\s*' + escapeRegexSafe(upload.fileName.trim()) + '\\s*$', 'i');
          const count = await VehicleModel.countDocuments({ fileName: { $regex: fileNameRegex } });
          fileCounts[upload.fileName] = count;
        } catch (err) {
          fileCounts[upload.fileName] = 0;
        }
      }
    }

    // Format data for frontend
    const formattedData = uploads.map((upload, index) => ({
      id: skip + index + 1,
      _id: upload._id,
      bankName: upload.bankName || 'N/A',
      fileName: upload.fileName || 'N/A',
      user: users[upload.uploadedBy] || tenant.name || 'Unknown User',
      uploadDate: upload.uploadDate ? new Date(upload.uploadDate).toLocaleString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }) : 'N/A',
      total: fileCounts[upload.fileName] || 0,
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
            const uploadToDataMap = {
              'two_wheeler_data_uploads': 'two_wheeler_data',
              'four_wheeler_data_uploads': 'four_wheeler_data',
              'commercial_data_uploads': 'commercial_data'
            };
            dataCollection = uploadToDataMap[collection] || null;
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
      let selectedCollection = null;
      // helper existed at module scope: escapeRegexSafe
      // match ignoring leading/trailing whitespace and case
      const fileNameRegex = new RegExp('^\\s*' + escapeRegexSafe(decodedFileName) + '\\s*$', 'i');
      // Probe each collection with a count to avoid false negatives due to exact-case existence check
      for (const col of orderedCollections) {
        const M = conn.model('Vehicle', new mongoose.Schema({}, { strict: false }), col);
        const probeCount = await M.countDocuments({ fileName: fileNameRegex });
        if (probeCount > 0) { VehicleModel = M; selectedCollection = col; break; }
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
      // Derive vehicleType from the collection we matched and bankName from the first row if available
      const derivedVehicleType = selectedCollection?.includes('two')
        ? 'TwoWheeler'
        : selectedCollection?.includes('four')
          ? 'FourWheeler'
          : selectedCollection?.includes('commercial')
            ? 'Commercial'
            : 'Unknown';
      const firstRowBank = vehicles?.[0]?.bankName || vehicles?.[0]?.bank || '';

      return res.json({ success: true, data: formattedData, uploadDetails: {
        fileName: decodedFileName,
        bankName: (bank || firstRowBank || 'N/A'),
        vehicleType: derivedVehicleType,
        uploadDate: null,
        totalRecords: total,
        processedRecords: total,
        failedRecords: 0
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

// Delete an uploaded file and all its vehicle rows
router.delete('/file/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const tenant = await Tenant.findById(req.user.tenantId);
    if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found' });

    const conn = await getTenantDB(tenant.name);
    const uploadCollections = ['two_wheeler_data_uploads', 'four_wheeler_data_uploads', 'commercial_data_uploads'];
    let uploadDetails = null;
    let dataCollection = null;

    // Find the upload by id across upload collections
    for (const collection of uploadCollections) {
      try {
        const UploadModel = conn.model('Upload', new mongoose.Schema({}, { strict: false }), collection);
        const rec = mongoose.isValidObjectId(id) ? await UploadModel.findById(id).lean() : null;
        if (rec) {
          uploadDetails = rec;
          const uploadToDataMap = {
            'two_wheeler_data_uploads': 'two_wheeler_data',
            'four_wheeler_data_uploads': 'four_wheeler_data',
            'commercial_data_uploads': 'commercial_data'
          };
          dataCollection = uploadToDataMap[collection] || null;
          // delete upload record
          await UploadModel.deleteOne({ _id: id });
          break;
        }
      } catch (_) {}
    }

    // If upload not found by ObjectId, treat :id as encoded filename and delete by filename across collections
    if (!uploadDetails || !dataCollection) {
      let decodedFileName = decodeURIComponent(id || '');
      try {
        if (/%[0-9a-fA-F]{2}/.test(decodedFileName)) {
          decodedFileName = decodeURIComponent(decodedFileName);
        }
      } catch (_) {}
      decodedFileName = (decodedFileName || '').trim();
      if (!decodedFileName) {
        return res.status(404).json({ success: false, message: 'Upload not found' });
      }

      const regex = new RegExp('^\\s*' + escapeRegexSafe(decodedFileName) + '\\s*$', 'i');
      const dataCollections = ['two_wheeler_data', 'four_wheeler_data', 'commercial_data'];

      let totalDeletedData = 0;
      for (const col of dataCollections) {
        try {
          const exists = await conn.db.listCollections({ name: col }).hasNext();
          if (!exists) continue;
          const M = conn.model('Vehicle', new mongoose.Schema({}, { strict: false }), col);
          const delRes = await M.deleteMany({ fileName: { $regex: regex } });
          totalDeletedData += delRes?.deletedCount || 0;
        } catch (_) {}
      }

      let totalDeletedUploads = 0;
      for (const ucol of uploadCollections) {
        try {
          const exists = await conn.db.listCollections({ name: ucol }).hasNext();
          if (!exists) continue;
          const U = conn.model('Upload', new mongoose.Schema({}, { strict: false }), ucol);
          const delUp = await U.deleteMany({ fileName: { $regex: regex } });
          totalDeletedUploads += delUp?.deletedCount || 0;
        } catch (_) {}
      }

      if (totalDeletedData === 0 && totalDeletedUploads === 0) {
        return res.status(404).json({ success: false, message: 'Upload not found' });
      }
      return res.json({ success: true, message: 'File and data deleted', deletedData: totalDeletedData, deletedUploads: totalDeletedUploads });
    }

    // Delete all rows for this fileName in the resolved data collection
    const VehicleModel = conn.model('Vehicle', new mongoose.Schema({}, { strict: false }), dataCollection);
    const escaped = String(uploadDetails.fileName || '').trim();
    if (!escaped) {
      return res.json({ success: true, message: 'Upload deleted (no data rows matched by filename)' });
    }
    const regex = new RegExp('^\\s*' + escapeRegexSafe(escaped) + '\\s*$', 'i');
    const result = await VehicleModel.deleteMany({ fileName: { $regex: regex } });

    return res.json({ success: true, message: 'File and data deleted', deleted: result?.deletedCount || 0 });
  } catch (error) {
    console.error('Delete file error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete file' });
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
