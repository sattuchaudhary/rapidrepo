const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const mongoose = require('mongoose');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const Tenant = require('../models/Tenant');
const { getTenantDB } = require('../config/database');
const fileManagementRouter = require('./fileManagement');

// Auth middleware
router.use(authenticateToken, requireAdmin);

// Multer configuration for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 * 1024, // 10GB limit (practically unlimited)
    files: 1,
    fieldSize: 10 * 1024 * 1024 * 1024, // 10GB field size
    fieldNameSize: 1000 // 1KB field name size
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = new Set([
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
      'application/vnd.ms-excel', // xls
      'application/vnd.ms-excel.sheet.macroEnabled.12', // xlsm
      'text/csv',
      'application/csv',
      'text/plain'
    ]);

    if (allowedMimeTypes.has(file.mimetype)) {
      return cb(null, true);
    }

    // Fallback to extension check when mimetype is unreliable (common on Windows)
    const name = (file.originalname || '').toLowerCase();
    const allowedExtensions = ['.xlsx', '.xls', '.xlsm', '.csv'];
    const hasAllowedExt = allowedExtensions.some(ext => name.endsWith(ext));
    if (hasAllowedExt) {
      return cb(null, true);
    }

    cb(new Error('Invalid file type. Only Excel (.xlsx/.xls/.xlsm) and CSV (.csv) files are allowed.'), false);
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

    // Special validation for registration number
    if (field === 'registrationNumber' && data[field]) {
      const regNumber = data[field];
      // Check if it's a valid format after formatting (should be alphanumeric)
      if (!/^[A-Z0-9]+$/.test(regNumber)) {
        warnings.push(`Registration number '${regNumber}' contains invalid characters after formatting`);
      }
      // Check reasonable length (typically 8-15 characters for Indian registration numbers)
      if (regNumber.length < 6 || regNumber.length > 15) {
        warnings.push(`Registration number '${regNumber}' has unusual length (${regNumber.length} characters)`);
      }
    }
  }

  return { errors, warnings };
};

// Format registration number by removing hyphens and spaces
const formatRegistrationNumber = (regNumber) => {
  if (!regNumber || typeof regNumber !== 'string') return regNumber;
  
  const original = regNumber;
  // Remove hyphens, spaces, and convert to uppercase
  const formatted = regNumber.replace(/[-\s]/g, '').toUpperCase();
  
  // Log formatting if there was a change
  if (original !== formatted) {
    console.log(`Registration number formatted: "${original}" → "${formatted}"`);
  }
  
  return formatted;
};

// Format phone number by removing spaces, hyphens, and brackets
const formatPhoneNumber = (phoneNumber) => {
  if (!phoneNumber || typeof phoneNumber !== 'string') return phoneNumber;
  
  const original = phoneNumber;
  // Remove spaces, hyphens, brackets, and plus signs, keep only digits
  const formatted = phoneNumber.replace(/[\s\-\(\)\+]/g, '');
  
  // Log formatting if there was a change
  if (original !== formatted && formatted !== '') {
    console.log(`Phone number formatted: "${original}" → "${formatted}"`);
  }
  
  return formatted;
};

// Apply field-specific formatting
const applyFieldFormatting = (field, value) => {
  if (!value || value === '') return value;
  
  switch (field) {
    case 'registrationNumber':
      return formatRegistrationNumber(value);
    case 'firstConfirmerPhone':
    case 'secondConfirmerPhone':
    case 'thirdConfirmerPhone':
      return formatPhoneNumber(value);
    case 'engineNumber':
    case 'chassisNumber':
      // Remove spaces and hyphens from engine/chassis numbers and convert to uppercase
      return value.replace(/[\s\-]/g, '').toUpperCase();
    default:
      return value;
  }
};

// Extract data from row using field mapping
// If providedFieldMap is passed as { standardField: fileColumnName }, it takes precedence.
// Only extracts data for fields that are explicitly mapped when providedFieldMap is provided
const extractDataFromRow = (row, headerMap, providedFieldMap) => {
  const extractedData = {};
  
  // If explicit mapping is provided, ONLY process mapped fields
  if (providedFieldMap && Object.keys(providedFieldMap).length > 0) {
    for (const [field, mappedHeader] of Object.entries(providedFieldMap)) {
      // Only process if this field exists in FIELD_MAPPING and has a valid mapping
      if (FIELD_MAPPING[field] && mappedHeader && mappedHeader.trim() !== '') {
        let value = '';
        if (row[mappedHeader] !== undefined && row[mappedHeader] !== null && row[mappedHeader] !== '') {
          value = String(row[mappedHeader]).trim();
          // Apply field-specific formatting
          value = applyFieldFormatting(field, value);
        }
        extractedData[field] = value;
      }
    }
  } else {
    // Fallback: use automatic mapping with aliases (existing behavior)
    for (const [field, config] of Object.entries(FIELD_MAPPING)) {
      let value = '';
      
      // Try aliases for automatic mapping
      for (const alias of config.aliases) {
        const normalizedAlias = normalizeString(alias);
        const header = headerMap[normalizedAlias];
        if (header && row[header] !== undefined && row[header] !== null && row[header] !== '') {
          value = String(row[header]).trim();
          // Apply field-specific formatting
          value = applyFieldFormatting(field, value);
          break;
        }
      }
      
      extractedData[field] = value;
    }
  }
  
  return extractedData;
};

// Save/load header mappings per tenant + vehicleType + bank
router.get('/mappings', async (req, res) => {
  try {
    const { vehicleType = '', bankId = '' } = req.query;
    const tenant = await Tenant.findById(req.user.tenantId);
    if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found' });
    const conn = await getTenantDB(tenant.name);
    const Mapping = conn.model('HeaderMapping', new mongoose.Schema({
      vehicleType: String,
      bankId: String,
      bankName: String,
      mapping: Object,
      updatedAt: { type: Date, default: Date.now }
    }, { strict: false }), 'header_mappings');

    const doc = await Mapping.findOne({ vehicleType, bankId }).lean();
    res.json({ success: true, data: doc?.mapping || {} });
  } catch (error) {
    console.error('Get mappings error:', error);
    res.status(500).json({ success: false, message: 'Failed to load mappings' });
  }
});

router.post('/mappings', async (req, res) => {
  try {
    const { vehicleType = '', bankId = '', bankName = '', mapping = {} } = req.body || {};
    const tenant = await Tenant.findById(req.user.tenantId);
    if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found' });
    const conn = await getTenantDB(tenant.name);
    const Mapping = conn.model('HeaderMapping', new mongoose.Schema({
      vehicleType: String,
      bankId: String,
      bankName: String,
      mapping: Object,
      updatedAt: { type: Date, default: Date.now }
    }, { strict: false }), 'header_mappings');

    const doc = await Mapping.findOneAndUpdate(
      { vehicleType, bankId },
      { $set: { vehicleType, bankId, bankName, mapping, updatedAt: new Date() } },
      { new: true, upsert: true }
    ).lean();
    res.json({ success: true, message: 'Mapping saved', data: doc.mapping });
  } catch (error) {
    console.error('Save mappings error:', error);
    res.status(500).json({ success: false, message: 'Failed to save mappings' });
  }
});

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

    // Parse Excel/CSV file (support password if provided; community builds may not decrypt encrypted workbooks)
    const password = req.body?.password || undefined;
    let workbook;
    try {
      workbook = XLSX.read(req.file.buffer, { type: 'buffer', password });
    } catch (err) {
      const msg = String(err?.message || '').toLowerCase();
      // Heuristics: xlsx throws different messages for encrypted files depending on build
      const looksEncrypted = msg.includes('password') || msg.includes('encrypted') || msg.includes('decrypt') || msg.includes('protected');
      if (looksEncrypted && !password) {
        return res.status(400).json({ success: false, message: 'This file is password-protected. Please enter the password.', error: 'PASSWORD_REQUIRED' });
      }
      if (looksEncrypted && password) {
        return res.status(400).json({ success: false, message: 'Invalid password. Please try again.', error: 'INVALID_PASSWORD' });
      }
      return res.status(400).json({ success: false, message: 'Unable to read file. Ensure it is a valid Excel/CSV.', error: 'READ_FAILED' });
    }
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

    // Optional: use provided mapping
    let providedFieldMap = {};
    try {
      if (req.body && req.body.mapping) {
        providedFieldMap = typeof req.body.mapping === 'string' ? JSON.parse(req.body.mapping) : req.body.mapping;
        console.log('Preview using explicit field mapping:', providedFieldMap);
        
        // Log which columns will be ignored in preview
        const mappedColumns = Object.values(providedFieldMap);
        const unmappedColumns = headerKeys.filter(header => !mappedColumns.includes(header));
        if (unmappedColumns.length > 0) {
          console.log('Preview - Unmapped columns (will be ignored):', unmappedColumns);
        }
      } else {
        console.log('Preview - No explicit mapping provided, using automatic field detection');
      }
    } catch (error) {
      console.error('Preview - Error parsing field mapping:', error);
    }

    // Process first 10 rows for normalized preview
    const previewData = rows.slice(0, 10).map((row, index) => {
      const extractedData = extractDataFromRow(row, headerMap, providedFieldMap);
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
      headers: headerKeys,
      rawRows: rows.slice(0, 200) // return first 200 raw rows for inline grid
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

    // Parse Excel/CSV file (support password if provided)
    const password = req.body?.password || undefined;
    let workbook;
    try {
      workbook = XLSX.read(req.file.buffer, { type: 'buffer', password });
    } catch (err) {
      const msg = String(err?.message || '').toLowerCase();
      const looksEncrypted = msg.includes('password') || msg.includes('encrypted') || msg.includes('decrypt') || msg.includes('protected');
      if (looksEncrypted && !password) {
        return res.status(400).json({ success: false, message: 'This file is password-protected. Please enter the password.', error: 'PASSWORD_REQUIRED' });
      }
      if (looksEncrypted && password) {
        return res.status(400).json({ success: false, message: 'Invalid password. Please try again.', error: 'INVALID_PASSWORD' });
      }
      return res.status(400).json({ success: false, message: 'Unable to read file. Ensure it is a valid Excel/CSV.', error: 'READ_FAILED' });
    }
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

    // Optional: mapping provided by client
    let providedFieldMap = {};
    try {
      if (req.body && req.body.mapping) {
        providedFieldMap = typeof req.body.mapping === 'string' ? JSON.parse(req.body.mapping) : req.body.mapping;
        console.log('Using explicit field mapping:', providedFieldMap);
        
        // Log which columns will be ignored
        const mappedColumns = Object.values(providedFieldMap);
        const unmappedColumns = headerKeys.filter(header => !mappedColumns.includes(header));
        if (unmappedColumns.length > 0) {
          console.log('Unmapped columns (will be ignored):', unmappedColumns);
        }
      } else {
        console.log('No explicit mapping provided, using automatic field detection');
      }
    } catch (error) {
      console.error('Error parsing field mapping:', error);
    }

    // Process all rows
    const processedData = [];
    const allErrors = [];
    const allWarnings = [];
    let processedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const extractedData = extractDataFromRow(row, headerMap, providedFieldMap);
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
          uploadedBy: req.user.userId,
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
      uploadedBy: req.user.userId,
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

    // Attempt to (asynchronously) rebuild the offline snapshot for instant mobile download
    try {
      const tenantName = tenant.name;
      if (fileManagementRouter && typeof fileManagementRouter.buildTenantSnapshot === 'function') {
        // Fire and forget
        fileManagementRouter.buildTenantSnapshot(tenantName).catch(() => {});
      }
    } catch (_) {}

    // Prepare summary information about mapping
    let mappingSummary = '';
    if (providedFieldMap && Object.keys(providedFieldMap).length > 0) {
      const mappedFields = Object.keys(providedFieldMap);
      const mappedColumns = Object.values(providedFieldMap);
      const unmappedColumns = headerKeys.filter(header => !mappedColumns.includes(header));
      
      mappingSummary = `Processed ${mappedFields.length} mapped fields. `;
      if (unmappedColumns.length > 0) {
        mappingSummary += `${unmappedColumns.length} columns were ignored (not mapped).`;
      }
    } else {
      mappingSummary = 'Used automatic field detection for all columns.';
    }

    res.json({
      success: true,
      message: 'File uploaded successfully',
      inserted: processedCount,
      failed: failedCount,
      total: rows.length,
      database: conn.name,
      collection: collectionName,
      mappingSummary: mappingSummary,
      processedFields: providedFieldMap ? Object.keys(providedFieldMap) : Object.keys(FIELD_MAPPING),
      errors: allErrors.slice(0, 10), // Return first 10 errors
      warnings: allWarnings.slice(0, 10) // Return first 10 warnings
    });

  } catch (error) {
    console.error('Upload error:', error);
    
    // Handle specific error types
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ 
        success: false, 
        message: 'File too large. Maximum size allowed is 10GB.',
        error: 'FILE_TOO_LARGE'
      });
    }
    
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ 
        success: false, 
        message: 'Unexpected file field.',
        error: 'INVALID_FILE_FIELD'
      });
    }
    
    if (error.name === 'TimeoutError') {
      return res.status(408).json({ 
        success: false, 
        message: 'Upload timeout. Please try again with a smaller file or check your connection.',
        error: 'UPLOAD_TIMEOUT'
      });
    }
    
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