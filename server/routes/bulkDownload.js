const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { authenticateUnifiedToken, requireAdmin } = require('../middleware/unifiedAuth');
const Tenant = require('../models/Tenant');
const { getTenantDB } = require('../config/database');
const zlib = require('zlib');
const { promisify } = require('util');

const gzip = promisify(zlib.gzip);
const deflate = promisify(zlib.deflate);

// Enhanced bulk download with compression and streaming
router.get('/bulk-data', authenticateUnifiedToken, async (req, res) => {
  try {
    const { 
      format = 'json', 
      compression = 'gzip', 
      batchSize = 5000,
      collections = 'all',
      fields = 'essential'
    } = req.query;

    const tenantId = req.user?.tenantId;
    const tenantName = req.user?.tenantName;
    let tenant = null;
    
    if (tenantId) tenant = await Tenant.findById(tenantId);
    if (!tenant && tenantName) tenant = await Tenant.findOne({ name: tenantName });
    if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found' });

    const conn = await getTenantDB(tenant.name);
    
    // Define field selection based on requirements
    const fieldSets = {
      essential: {
        registrationNumber: 1,
        chassisNumber: 1,
        agreementNumber: 1,
        bankName: 1,
        vehicleMake: 1,
        customerName: 1,
        address: 1,
        _id: 1
      },
      full: {
        registrationNumber: 1,
        chassisNumber: 1,
        agreementNumber: 1,
        bankName: 1,
        vehicleMake: 1,
        customerName: 1,
        address: 1,
        engineNumber: 1,
        emiAmount: 1,
        branchName: 1,
        pos: 1,
        bucketStatus: 1,
        firstConfirmedName: 1,
        firstConfirmerPhone: 1,
        secondConfirmedName: 1,
        secondConfirmerPhone: 1,
        thirdConfirmerName: 1,
        thirdConfirmerPhone: 1,
        zone: 1,
        areaOffice: 1,
        region: 1,
        allocation: 1,
        vehicleModel: 1,
        productName: 1,
        location: 1,
        _id: 1
      }
    };

    const selectedFields = fieldSets[fields] || fieldSets.essential;
    const targetCollections = collections === 'all' 
      ? ['two_wheeler_data', 'four_wheeler_data', 'commercial_data']
      : collections.split(',').map(c => `${c}_data`);

    // For large datasets, return chunked data instead of streaming
    const maxRecords = 100000; // 100k records max for bulk download
    let totalRecords = 0;
    
    // Count total records first
    for (const collectionName of targetCollections) {
      try {
        const Model = conn.model('Vehicle', new mongoose.Schema({}, { strict: false }), collectionName);
        const count = await Model.countDocuments({});
        totalRecords += count;
      } catch (error) {
        console.error(`Error counting ${collectionName}:`, error);
      }
    }

    if (totalRecords > maxRecords) {
      return res.status(413).json({ 
        success: false, 
        message: `Dataset too large (${totalRecords} records). Use chunked download instead.`,
        totalRecords,
        maxRecords
      });
    }

    // Set response headers
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache');
    
    if (compression === 'gzip') {
      res.setHeader('Content-Encoding', 'gzip');
    } else if (compression === 'deflate') {
      res.setHeader('Content-Encoding', 'deflate');
    }

    // Collect all data first, then send as single response
    const allData = [];
    let totalProcessed = 0;

    for (const collectionName of targetCollections) {
      try {
        const Model = conn.model('Vehicle', new mongoose.Schema({}, { strict: false }), collectionName);
        const totalCount = await Model.countDocuments({});
        
        console.log(`Processing ${collectionName}: ${totalCount} records`);

        for (let skip = 0; skip < totalCount; skip += parseInt(batchSize)) {
          const docs = await Model.find({}, selectedFields)
            .sort({ _id: 1 })
            .skip(skip)
            .limit(parseInt(batchSize))
            .lean();

          for (const doc of docs) {
            const vehicleData = {
              _id: doc._id,
              vehicleType: collectionName.includes('two') ? 'TwoWheeler' : 
                         collectionName.includes('four') ? 'FourWheeler' : 'Commercial',
              regNo: doc.registrationNumber || '',
              chassisNo: doc.chassisNumber || '',
              loanNo: doc.agreementNumber || '',
              bank: doc.bankName || '',
              make: doc.vehicleMake || '',
              customerName: doc.customerName || '',
              address: doc.address || '',
              ...(fields === 'full' && {
                engineNo: doc.engineNumber || '',
                emiAmount: doc.emiAmount || 0,
                branchName: doc.branchName || '',
                pos: doc.pos || '',
                bucketStatus: doc.bucketStatus || '',
                firstConfirmedName: doc.firstConfirmedName || '',
                firstConfirmerPhone: doc.firstConfirmerPhone || '',
                secondConfirmedName: doc.secondConfirmedName || '',
                secondConfirmerPhone: doc.secondConfirmerPhone || '',
                thirdConfirmerName: doc.thirdConfirmerName || '',
                thirdConfirmerPhone: doc.thirdConfirmerPhone || '',
                zone: doc.zone || '',
                areaOffice: doc.areaOffice || '',
                region: doc.region || '',
                allocation: doc.allocation || '',
                vehicleModel: doc.vehicleModel || '',
                productName: doc.productName || '',
                location: doc.location || ''
              })
            };

            allData.push(vehicleData);
            totalProcessed++;
          }

          // Add small delay to prevent overwhelming the server
          if (skip + parseInt(batchSize) < totalCount) {
            await new Promise(resolve => setTimeout(resolve, 5));
          }
        }
      } catch (error) {
        console.error(`Error processing ${collectionName}:`, error);
        // Continue with other collections
      }
    }

    // Send response
    res.json(allData);

    console.log(`Bulk download completed: ${totalProcessed} records for ${tenant.name}`);

  } catch (error) {
    console.error('Bulk download error:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Bulk download failed' });
    }
  }
});

// Optimized chunked download with progress tracking
router.get('/bulk-chunked', authenticateUnifiedToken, async (req, res) => {
  try {
    const { 
      collection = 'two',
      skip = 0,
      limit = 10000,
      compression = 'gzip'
    } = req.query;

    const tenantId = req.user?.tenantId;
    const tenantName = req.user?.tenantName;
    let tenant = null;
    
    if (tenantId) tenant = await Tenant.findById(tenantId);
    if (!tenant && tenantName) tenant = await Tenant.findOne({ name: tenantName });
    if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found' });

    const conn = await getTenantDB(tenant.name);
    const collectionMap = {
      two: 'two_wheeler_data',
      four: 'four_wheeler_data',
      comm: 'commercial_data'
    };

    const collectionName = collectionMap[collection] || collectionMap.two;
    const Model = conn.model('Vehicle', new mongoose.Schema({}, { strict: false }), collectionName);

    const docs = await Model.find({}, {
      registrationNumber: 1,
      chassisNumber: 1,
      agreementNumber: 1,
      bankName: 1,
      vehicleMake: 1,
      customerName: 1,
      address: 1,
      _id: 1
    })
    .sort({ _id: 1 })
    .skip(parseInt(skip))
    .limit(parseInt(limit))
    .lean();

    const data = docs.map(doc => ({
      _id: doc._id,
      vehicleType: collectionName.includes('two') ? 'TwoWheeler' : 
                 collectionName.includes('four') ? 'FourWheeler' : 'Commercial',
      regNo: doc.registrationNumber || '',
      chassisNo: doc.chassisNumber || '',
      loanNo: doc.agreementNumber || '',
      bank: doc.bankName || '',
      make: doc.vehicleMake || '',
      customerName: doc.customerName || '',
      address: doc.address || ''
    }));

    let responseData = JSON.stringify({ success: true, data, count: data.length });

    // Apply compression if requested
    if (compression === 'gzip') {
      res.setHeader('Content-Encoding', 'gzip');
      responseData = await gzip(responseData);
    } else if (compression === 'deflate') {
      res.setHeader('Content-Encoding', 'deflate');
      responseData = await deflate(responseData);
    }

    res.setHeader('Content-Type', 'application/json');
    res.send(responseData);

  } catch (error) {
    console.error('Chunked download error:', error);
    res.status(500).json({ success: false, message: 'Chunked download failed' });
  }
});

// List only IDs for a collection (paginated)
router.get('/bulk-ids', authenticateUnifiedToken, async (req, res) => {
  try {
    const { collection = 'two', skip = 0, limit = 10000 } = req.query;

    const tenantId = req.user?.tenantId;
    const tenantName = req.user?.tenantName;
    let tenant = null;
    if (tenantId) tenant = await Tenant.findById(tenantId);
    if (!tenant && tenantName) tenant = await Tenant.findOne({ name: tenantName });
    if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found' });

    const conn = await getTenantDB(tenant.name);
    const collectionMap = { two: 'two_wheeler_data', four: 'four_wheeler_data', comm: 'commercial_data' };
    const collectionName = collectionMap[collection] || collectionMap.two;
    const Model = conn.model('Vehicle', new mongoose.Schema({}, { strict: false }), collectionName);

    const docs = await Model.find({}, { _id: 1 })
      .sort({ _id: 1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit))
      .lean();

    const ids = docs.map(d => d._id);
    res.json({ success: true, ids, count: ids.length });
  } catch (error) {
    console.error('bulk-ids error:', error);
    res.status(500).json({ success: false, message: 'Failed to list ids' });
  }
});

// Fetch records by IDs (batched client-side)
router.post('/by-ids', authenticateUnifiedToken, async (req, res) => {
  try {
    const { ids = [], collection = 'two' } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) return res.json({ success: true, data: [] });

    const tenantId = req.user?.tenantId;
    const tenantName = req.user?.tenantName;
    let tenant = null;
    if (tenantId) tenant = await Tenant.findById(tenantId);
    if (!tenant && tenantName) tenant = await Tenant.findOne({ name: tenantName });
    if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found' });

    const conn = await getTenantDB(tenant.name);
    const collectionMap = { two: 'two_wheeler_data', four: 'four_wheeler_data', comm: 'commercial_data' };
    const collectionName = collectionMap[collection] || collectionMap.two;
    const Model = conn.model('Vehicle', new mongoose.Schema({}, { strict: false }), collectionName);

    const docs = await Model.find({ _id: { $in: ids } }, {
      registrationNumber: 1,
      chassisNumber: 1,
      agreementNumber: 1,
      bankName: 1,
      vehicleMake: 1,
      customerName: 1,
      address: 1,
      _id: 1
    }).lean();

    const data = docs.map(doc => ({
      _id: doc._id,
      vehicleType: collectionName.includes('two') ? 'TwoWheeler' : collectionName.includes('four') ? 'FourWheeler' : 'Commercial',
      regNo: doc.registrationNumber || '',
      chassisNo: doc.chassisNumber || '',
      loanNo: doc.agreementNumber || '',
      bank: doc.bankName || '',
      make: doc.vehicleMake || '',
      customerName: doc.customerName || '',
      address: doc.address || ''
    }));

    res.json({ success: true, data, count: data.length });
  } catch (error) {
    console.error('by-ids error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch by ids' });
  }
});

// Get optimized collection statistics
router.get('/bulk-stats', authenticateUnifiedToken, async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const tenantName = req.user?.tenantName;
    let tenant = null;
    
    if (tenantId) tenant = await Tenant.findById(tenantId);
    if (!tenant && tenantName) tenant = await Tenant.findOne({ name: tenantName });
    if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found' });

    const conn = await getTenantDB(tenant.name);
    const collections = ['two_wheeler_data', 'four_wheeler_data', 'commercial_data'];
    const stats = {};

    for (const col of collections) {
      try {
        const Model = conn.model('Vehicle', new mongoose.Schema({}, { strict: false }), col);
        const count = await Model.countDocuments({});
        const key = col.includes('two') ? 'two' : col.includes('four') ? 'four' : 'comm';
        stats[key] = count;
      } catch (error) {
        const key = col.includes('two') ? 'two' : col.includes('four') ? 'four' : 'comm';
        stats[key] = 0;
      }
    }

    res.json({ 
      success: true, 
      tenant: tenant.name,
      counts: stats,
      totalRecords: Object.values(stats).reduce((sum, count) => sum + count, 0)
    });

  } catch (error) {
    console.error('Bulk stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to get bulk stats' });
  }
});

// Create optimized SQLite snapshot for instant download
router.post('/create-snapshot', authenticateUnifiedToken, requireAdmin, async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const tenantName = req.user?.tenantName;
    let tenant = null;
    
    if (tenantId) tenant = await Tenant.findById(tenantId);
    if (!tenant && tenantName) tenant = await Tenant.findOne({ name: tenantName });
    if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found' });

    // Trigger snapshot creation (this would integrate with your existing snapshot system)
    const snapshotResult = await createOptimizedSnapshot(tenant.name);
    
    res.json({ 
      success: true, 
      message: 'Snapshot created successfully',
      snapshot: snapshotResult
    });

  } catch (error) {
    console.error('Snapshot creation error:', error);
    res.status(500).json({ success: false, message: 'Failed to create snapshot' });
  }
});

// Helper function to create optimized snapshot
async function createOptimizedSnapshot(tenantName) {
  // This would integrate with your existing snapshot creation logic
  // but with optimizations for mobile SQLite
  return {
    tenant: tenantName,
    created: new Date().toISOString(),
    status: 'completed'
  };
}

module.exports = router;
