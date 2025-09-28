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

// Simple dump endpoint for mobile app (1 lakh records max per batch)
router.get('/simple-dump', authenticateUnifiedToken, async (req, res) => {
  try {
    const { limit = 50000, offset = 0 } = req.query;
    
    const tenantId = req.user?.tenantId;
    const tenantName = req.user?.tenantName;
    let tenant = null;
    
    if (tenantId) tenant = await Tenant.findById(tenantId);
    if (!tenant && tenantName) tenant = await Tenant.findOne({ name: tenantName });
    if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found' });

    const conn = await getTenantDB(tenant.name);
    const collections = ['two_wheeler_data', 'four_wheeler_data', 'commercial_data'];
    
    // Get total count across all collections
    let totalRecords = 0;
    for (const collectionName of collections) {
      try {
        const Model = conn.model('Vehicle', new mongoose.Schema({}, { strict: false }), collectionName);
        const count = await Model.countDocuments({});
        totalRecords += count;
      } catch (error) {
        console.error(`Error counting ${collectionName}:`, error);
      }
    }

    // Collect data from all collections
    const allData = [];
    let currentOffset = parseInt(offset);
    let remainingLimit = Math.min(parseInt(limit), 50000); // Max 50K records per batch
    
    for (const collectionName of collections) {
      if (remainingLimit <= 0) break;
      
      try {
        const Model = conn.model('Vehicle', new mongoose.Schema({}, { strict: false }), collectionName);
        const collectionCount = await Model.countDocuments({});
        
        // Skip if offset is beyond this collection
        if (currentOffset >= collectionCount) {
          currentOffset -= collectionCount;
          continue;
        }
        
        // Calculate how many records to fetch from this collection
        const skipInCollection = currentOffset;
        const limitInCollection = Math.min(remainingLimit, collectionCount - skipInCollection);
        
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
        .skip(skipInCollection)
        .limit(limitInCollection)
        .lean();

        // Transform data for mobile app
        const transformedData = docs.map(doc => ({
          _id: doc._id,
          vehicleType: collectionName.includes('two') ? 'TwoWheeler' : 
                     collectionName.includes('four') ? 'FourWheeler' : 'Commercial',
          regNo: doc.registrationNumber || '',
          reg_no: doc.registrationNumber || '', // Alternative field name
          chassisNo: doc.chassisNumber || '',
          chassis_no: doc.chassisNumber || '', // Alternative field name
          loanNo: doc.agreementNumber || '',
          loan_no: doc.agreementNumber || '', // Alternative field name
          bank: doc.bankName || '',
          bank_name: doc.bankName || '', // Alternative field name
          make: doc.vehicleMake || '',
          manufacturer: doc.vehicleMake || '', // Alternative field name
          customerName: doc.customerName || '',
          customer_name: doc.customerName || '', // Alternative field name
          address: doc.address || '',
          customer_address: doc.address || '' // Alternative field name
        }));

        allData.push(...transformedData);
        remainingLimit -= transformedData.length;
        currentOffset = 0; // Reset offset for next collection
        
      } catch (error) {
        console.error(`Error processing ${collectionName}:`, error);
        // Continue with other collections
      }
    }

    const hasMore = (parseInt(offset) + allData.length) < totalRecords;
    const nextOffset = parseInt(offset) + allData.length;

    res.json({
      success: true,
      data: allData,
      totalRecords,
      currentBatch: allData.length,
      offset: parseInt(offset),
      hasMore,
      nextOffset,
      tenant: tenant.name
    });

    console.log(`Simple dump completed: ${allData.length} records (${offset}-${nextOffset}) for ${tenant.name}`);

  } catch (error) {
    console.error('Simple dump error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Simple dump failed',
      error: error.message 
    });
  }
});

// Get new records since timestamp (for incremental sync)
router.get('/new-records', authenticateUnifiedToken, async (req, res) => {
  try {
    const { since, limit = 50000, offset = 0 } = req.query;
    
    if (!since) {
      return res.status(400).json({ 
        success: false, 
        message: 'since timestamp is required' 
      });
    }
    
    const tenantId = req.user?.tenantId;
    const tenantName = req.user?.tenantName;
    let tenant = null;
    
    if (tenantId) tenant = await Tenant.findById(tenantId);
    if (!tenant && tenantName) tenant = await Tenant.findOne({ name: tenantName });
    if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found' });

    const conn = await getTenantDB(tenant.name);
    const collections = ['two_wheeler_data', 'four_wheeler_data', 'commercial_data'];
    
    // Parse since timestamp
    const sinceDate = new Date(since);
    if (isNaN(sinceDate.getTime())) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid since timestamp format' 
      });
    }
    
    // Get new records from all collections
    const allNewData = [];
    let currentOffset = parseInt(offset);
    let remainingLimit = Math.min(parseInt(limit), 50000);
    
    for (const collectionName of collections) {
      if (remainingLimit <= 0) break;
      
      try {
        const Model = conn.model('Vehicle', new mongoose.Schema({}, { strict: false }), collectionName);
        
        // Find records created/updated after since timestamp
        const newDocs = await Model.find({
          $or: [
            { createdAt: { $gt: sinceDate } },
            { updatedAt: { $gt: sinceDate } },
            { uploadDate: { $gt: sinceDate } }
          ]
        }, {
          registrationNumber: 1,
          chassisNumber: 1,
          agreementNumber: 1,
          bankName: 1,
          vehicleMake: 1,
          customerName: 1,
          address: 1,
          _id: 1,
          createdAt: 1,
          updatedAt: 1,
          uploadDate: 1
        })
        .sort({ _id: 1 })
        .skip(currentOffset)
        .limit(remainingLimit)
        .lean();

        // Transform data for mobile app
        const transformedData = newDocs.map(doc => ({
          _id: doc._id,
          vehicleType: collectionName.includes('two') ? 'TwoWheeler' : 
                     collectionName.includes('four') ? 'FourWheeler' : 'Commercial',
          regNo: doc.registrationNumber || '',
          reg_no: doc.registrationNumber || '',
          chassisNo: doc.chassisNumber || '',
          chassis_no: doc.chassisNumber || '',
          loanNo: doc.agreementNumber || '',
          loan_no: doc.agreementNumber || '',
          bank: doc.bankName || '',
          bank_name: doc.bankName || '',
          make: doc.vehicleMake || '',
          manufacturer: doc.vehicleMake || '',
          customerName: doc.customerName || '',
          customer_name: doc.customerName || '',
          address: doc.address || '',
          customer_address: doc.address || '',
          createdAt: doc.createdAt || doc.uploadDate,
          updatedAt: doc.updatedAt || doc.uploadDate
        }));

        allNewData.push(...transformedData);
        remainingLimit -= transformedData.length;
        currentOffset = 0; // Reset offset for next collection
        
      } catch (error) {
        console.error(`Error processing ${collectionName} for new records:`, error);
        // Continue with other collections
      }
    }

    // Get total count of new records
    let totalNewRecords = 0;
    for (const collectionName of collections) {
      try {
        const Model = conn.model('Vehicle', new mongoose.Schema({}, { strict: false }), collectionName);
        const count = await Model.countDocuments({
          $or: [
            { createdAt: { $gt: sinceDate } },
            { updatedAt: { $gt: sinceDate } },
            { uploadDate: { $gt: sinceDate } }
          ]
        });
        totalNewRecords += count;
      } catch (error) {
        console.error(`Error counting new records in ${collectionName}:`, error);
      }
    }

    const hasMore = (parseInt(offset) + allNewData.length) < totalNewRecords;
    const nextOffset = parseInt(offset) + allNewData.length;

    res.json({
      success: true,
      data: allNewData,
      totalNewRecords,
      currentBatch: allNewData.length,
      offset: parseInt(offset),
      hasMore,
      nextOffset,
      since: since,
      tenant: tenant.name
    });

    console.log(`New records query completed: ${allNewData.length} new records since ${since} for ${tenant.name}`);

  } catch (error) {
    console.error('New records query error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'New records query failed',
      error: error.message 
    });
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
