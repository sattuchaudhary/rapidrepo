const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const mongoose = require('mongoose');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const Tenant = require('../models/Tenant');
const { getTenantDB } = require('../config/database');

// Auth middleware
router.use(authenticateToken, requireAdmin);

// Multer configuration for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 40 * 1024 * 1024, // 40MB limit
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only Excel and CSV files are allowed.'), false);
    }
  }
});

// Using existing getTenantDB from config/database.js

// Field mapping for data extraction
const FIELD_MAPPING = {
  location: {
    aliases: ['location', 'city', 'place'],
    required: false,
    type: 'string'
  },
  bankName: {
    aliases: ['bank name', 'bank', 'lender', 'financier'],
    required: false,
    type: 'string'
  },
  agreementNumber: {
    aliases: ['agreement number', 'agreement no', 'agreement', 'loan number'],
    required: false,
    type: 'string'
  },
  customerName: {
    aliases: ['customer name', 'customer', 'borrower name', 'applicant name'],
    required: false,
    type: 'string'
  },
  vehicleMake: {
    aliases: ['vehicle make', 'make', 'brand', 'manufacturer'],
    required: false,
    type: 'string'
  },
  registrationNumber: {
    aliases: ['registration number', 'registration', 'reg no', 'reg number', 'vehicle number'],
    required: false,
    type: 'string'
  },
  engineNumber: {
    aliases: ['engine number', 'engine no', 'engine'],
    required: false,
    type: 'string'
  },
  chassisNumber: {
    aliases: ['chassis number', 'chassis no', 'chassis', 'vin'],
    required: false,
    type: 'string'
  },
  emiAmount: {
    aliases: ['emi amount', 'emi', 'monthly emi', 'installment'],
    required: false,
    type: 'number'
  },
  pos: {
    aliases: ['pos', 'point of sale'],
    required: false,
    type: 'string'
  },
  bucketStatus: {
    aliases: ['bucket status', 'bucket', 'dpd bucket'],
    required: false,
    type: 'string'
  },
  address: {
    aliases: ['address', 'customer address', 'borrower address'],
    required: false,
    type: 'string'
  },
  branchName: {
    aliases: ['branch name', 'branch', 'branch allocation'],
    required: false,
    type: 'string'
  },
  firstConfirmedName: {
    aliases: ['1st confirmed name', 'first confirmed name', 'confirmed name'],
    required: false,
    type: 'string'
  },
  firstConfirmerPhone: {
    aliases: ['1st confirmer phone number', 'first confirmer phone', 'confirmed phone'],
    required: false,
    type: 'string'
  },
  secondConfirmedName: {
    aliases: ['2nd confirmed name', 'second confirmed name'],
    required: false,
    type: 'string'
  },
  secondConfirmerPhone: {
    aliases: ['2nd confirmer phone number', 'second confirmer phone'],
    required: false,
    type: 'string'
  },
  thirdConfirmerName: {
    aliases: ['3rd confirmer name', 'third confirmer name'],
    required: false,
    type: 'string'
  },
  thirdConfirmerPhone: {
    aliases: ['3rd confirmer phone number', 'third confirmer phone'],
    required: false,
    type: 'string'
  },
  zone: {
    aliases: ['zone', 'area zone'],
    required: false,
    type: 'string'
  },
  areaOffice: {
    aliases: ['area office', 'office'],
    required: false,
    type: 'string'
  },
  region: {
    aliases: ['region', 'state'],
    required: false,
    type: 'string'
  },
  allocation: {
    aliases: ['allocation', 'branch allocation'],
    required: false,
    type: 'string'
  },
  vehicleModel: {
    aliases: ['vehicle model', 'model', 'variant'],
    required: false,
    type: 'string'
  },
  productName: {
    aliases: ['product name', 'product', 'loan product'],
    required: false,
    type: 'string'
  }
};

// Normalize string for comparison
const normalizeString = (str) => {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
};

// Validate data against field mapping
const validateData = (data, fieldMapping) => {
  const errors = [];
  const warnings = [];

  for (const [field, config] of Object.entries(fieldMapping)) {
    if (config.required && (!data[field] || data[field].toString().trim() === '')) {
      errors.push(`Required field '${field}' is missing or empty`);
    }

    if (data[field] && config.type === 'number') {
      const numValue = parseFloat(data[field]);
      if (isNaN(numValue)) {
        warnings.push(`Field '${field}' should be a number, got: ${data[field]}`);
      }
    }

    if (data[field] && config.type === 'string' && data[field].length > 255) {
      warnings.push(`Field '${field}' is too long (${data[field].length} characters)`);
    }
  }

  return { errors, warnings };
};

// Extract data from row using field mapping
const extractDataFromRow = (row, headerMap) => {
  const extractedData = {};
  
  for (const [field, config] of Object.entries(FIELD_MAPPING)) {
    let value = '';
    
    for (const alias of config.aliases) {
      const normalizedAlias = normalizeString(alias);
      const header = headerMap[normalizedAlias];
      
      if (header && row[header] !== undefined && row[header] !== null && row[header] !== '') {
        value = String(row[header]).trim();
        break;
      }
    }
    
    extractedData[field] = value;
  }
  
  return extractedData;
};

// Get banks/clients for dropdown
router.get('/banks', async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.user.tenantId);
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }

    const conn = await getTenantDB(tenant.name);
    const Client = conn.model('Client', new mongoose.Schema({}, { strict: false }), 'clients');
    
    const clients = await Client.find({}, { name: 1, status: 1 })
      .sort({ name: 1 })
      .lean();

    const banks = clients.map(client => ({
      id: String(client._id),
      name: client.name || 'Unnamed Client',
      status: client.status || 'active'
    }));

    res.json({ success: true, data: banks });
  } catch (error) {
    console.error('Error fetching banks:', error);
    res.status(500).json({ success: false, message: 'Failed to load banks' });
  }
});

// Preview data before upload
router.post('/preview', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file provided' });
    }

    // Parse Excel file
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

    if (rows.length === 0) {
      return res.status(400).json({ success: false, message: 'No data found in file' });
    }

    // Create header mapping
    const headerKeys = Object.keys(rows[0]);
    const headerMap = {};
    for (const key of headerKeys) {
      headerMap[normalizeString(key)] = key;
    }

    // Process first 10 rows for preview
    const previewData = rows.slice(0, 10).map((row, index) => {
      const extractedData = extractDataFromRow(row, headerMap);
      const validation = validateData(extractedData, FIELD_MAPPING);
      
      return {
        ...extractedData,
        status: validation.errors.length > 0 ? 'Error' : 'Valid',
        errors: validation.errors,
        warnings: validation.warnings
      };
    });

    res.json({
      success: true,
      data: previewData,
      totalRows: rows.length,
      headers: headerKeys
    });

  } catch (error) {
    console.error('Preview error:', error);
    res.status(500).json({ success: false, message: 'Failed to preview data' });
  }
});

// Upload file with enhanced processing
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const { vehicleType, bankId, bankName } = req.body;
    
    if (!vehicleType || !req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'Vehicle type and file are required' 
      });
    }

    const tenant = await Tenant.findById(req.user.tenantId);
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }

    const conn = await getTenantDB(tenant.name);

    // Determine collection name based on vehicle type
    const collectionName = vehicleType === 'FourWheeler' 
      ? 'four_wheeler_data' 
      : vehicleType === 'Commercial' 
        ? 'commercial_data' 
        : 'two_wheeler_data';

    // Create upload history schema
    const uploadSchema = new mongoose.Schema({
      bankName: String,
      bankId: String,
      vehicleType: String,
      fileName: String,
      uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      uploadDate: { type: Date, default: Date.now },
      status: { type: String, default: 'Completed' },
      totalRecords: Number,
      processedRecords: Number,
      failedRecords: Number,
      errors: [String],
      warnings: [String]
    }, { timestamps: true });

    const UploadModel = conn.model('Upload', uploadSchema, `${collectionName}_uploads`);

    // Parse Excel file
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

    if (rows.length === 0) {
      return res.status(400).json({ success: false, message: 'No data found in file' });
    }

    // Create header mapping
    const headerKeys = Object.keys(rows[0]);
    const headerMap = {};
    for (const key of headerKeys) {
      headerMap[normalizeString(key)] = key;
    }

    // Process all rows
    const processedData = [];
    const allErrors = [];
    const allWarnings = [];
    let processedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const extractedData = extractDataFromRow(row, headerMap);
      const validation = validateData(extractedData, FIELD_MAPPING);

      if (validation.errors.length > 0) {
        failedCount++;
        allErrors.push(`Row ${i + 1}: ${validation.errors.join(', ')}`);
      } else {
        processedCount++;
        processedData.push({
          ...extractedData,
          bankName: bankName || '',
          bankId: bankId || '',
          vehicleType: vehicleType,
          fileName: req.file.originalname,
          uploadDate: new Date(),
          uploadedBy: req.user._id,
          raw: row
        });
      }

      allWarnings.push(...validation.warnings.map(w => `Row ${i + 1}: ${w}`));
    }

    // Save upload record
    const uploadRecord = new UploadModel({
      bankName: bankName || '',
      bankId: bankId || '',
      vehicleType: vehicleType,
      fileName: req.file.originalname,
      uploadedBy: req.user._id,
      totalRecords: rows.length,
      processedRecords: processedCount,
      failedRecords: failedCount,
      errors: allErrors,
      warnings: allWarnings
    });

    await uploadRecord.save();

    // Insert processed data into main collection
    if (processedData.length > 0) {
      const mainCollection = conn.collection(collectionName);
      
      // Create indexes for better performance
      await mainCollection.createIndex({ registrationNumber: 1 });
      await mainCollection.createIndex({ customerName: 1 });
      await mainCollection.createIndex({ bankName: 1 });
      
      // Insert data
      const result = await mainCollection.insertMany(processedData);
      console.log(`Inserted ${result.insertedCount} records into ${collectionName}`);
    }

    res.json({
      success: true,
      message: 'File uploaded successfully',
      inserted: processedCount,
      failed: failedCount,
      total: rows.length,
      database: conn.name,
      collection: collectionName,
      errors: allErrors.slice(0, 10), // Return first 10 errors
      warnings: allWarnings.slice(0, 10) // Return first 10 warnings
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Upload failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get upload history
router.get('/history', async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.user.tenantId);
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }

    const conn = await getTenantDB(tenant.name);
    
    // Get all upload collections
    const collections = await conn.db.listCollections({ name: { $regex: /_uploads$/ } }).toArray();
    
    let allUploads = [];
    
    for (const collection of collections) {
      const UploadModel = conn.model('Upload', new mongoose.Schema({}, { strict: false }), collection.name);
      const uploads = await UploadModel.find({})
        .sort({ uploadDate: -1 })
        .limit(50)
        .lean();
      
      allUploads = allUploads.concat(uploads);
    }
    
    // Sort by upload date
    allUploads.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));

    res.json({ success: true, data: allUploads });
  } catch (error) {
    console.error('History error:', error);
    res.status(500).json({ success: false, message: 'Failed to load upload history' });
  }
});

module.exports = router;