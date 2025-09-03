const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const mongoose = require('mongoose');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const Tenant = require('../models/Tenant');

// Auth
router.use(authenticateToken, requireAdmin);

// Multer setup (memory storage; we parse in memory)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Connect to tenant DB helper
const getTenantDB = async (tenantName) => {
  const dbName = `tenants_${tenantName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  if (mongoose.connections.some((c) => c.name === dbName)) {
    return mongoose.connections.find((c) => c.name === dbName);
  }
  const conn = mongoose.createConnection(`mongodb://localhost:27017/${dbName}`, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  await new Promise((resolve, reject) => {
    conn.once('connected', resolve);
    conn.once('error', reject);
  });
  return conn;
};

// Model cache per connection and collection
const modelCache = new Map();
const getUploadModel = (conn, collectionName) => {
  const key = `${conn.name}_${collectionName}`;
  if (modelCache.has(key)) return modelCache.get(key);

  const schema = new mongoose.Schema({
    // Primary context
    bankName: String,
    vehicleType: String, // 'TwoWheeler' | 'FourWheeler' | 'Commercial'
    // Structured fields (all optional)
    registrationNumber: String,
    agreementNumber: String,
    make: String,
    engineNumber: String,
    productName: String,
    emiAmount: String,
    firstConfirmerName: String,
    secondConfirmerName: String,
    thirdConfirmerName: String,
    bucket: String,
    branchAllocation: String,
    seasoning: String,
    fileName: String,
    status: String,
    customerName: String,
    chasisNumber: String,
    pos: String,
    firstConfirmerNo: String,
    secondConfirmerNo: String,
    thirdConfirmerNo: String,
    address: String,
    sec17: String,
    model: String,
    tbr: String,
    uploadDate: String,
    // Keep raw for full fidelity
    raw: mongoose.Schema.Types.Mixed,
  }, { timestamps: true });

  const model = conn.model(collectionName, schema, collectionName);
  modelCache.set(key, model);
  return model;
};

// GET banks (clients) for dropdown
router.get('/banks', async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.user.tenantId);
    if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found' });
    const conn = await getTenantDB(tenant.name);
    // Clients collection lives in tenant DB; align with existing clientController naming
    const Client = conn.model('Client', new mongoose.Schema({}, { strict: false }), 'clients');
    const docs = await Client.find({}, { name: 1 }).sort({ name: 1 }).lean();
    const banks = docs.map(d => ({ id: String(d._id), name: d.name || 'Unnamed' }));
    res.json({ success: true, data: banks });
  } catch (err) {
    console.error('Fetch banks error:', err);
    res.status(500).json({ success: false, message: 'Failed to load banks' });
  }
});

// POST upload excel
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const { vehicleType, bankId, bankName } = req.body;
    if (!vehicleType || !req.file) {
      return res.status(400).json({ success: false, message: 'vehicleType and file are required' });
    }

    const tenant = await Tenant.findById(req.user.tenantId);
    if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found' });
    const conn = await getTenantDB(tenant.name);

    // Select collection by vehicleType
    const collection = vehicleType === 'FourWheeler' ? 'four_wheeler_uploads' : vehicleType === 'Commercial' ? 'commercial_uploads' : 'two_wheeler_uploads';
    const UploadModel = getUploadModel(conn, collection);

    // Parse workbook
    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    // Field mapping (aliases, case-insensitive)
    const FIELD_ALIASES = {
      registrationNumber: ['registration number', 'registration', 'reg no', 'reg number'],
      agreementNumber: ['agreement number', 'agreement no', 'agreement'],
      make: ['make', 'vehicle make'],
      engineNumber: ['engine number', 'engine no'],
      productName: ['product name', 'product'],
      emiAmount: ['emi amount', 'emi'],
      firstConfirmerName: ['1st confirmer name', 'first confirmer name'],
      secondConfirmerName: ['2nd confirmer name', 'second confirmer name', '2st confirmer name'],
      thirdConfirmerName: ['3rd confirmer name', 'third confirmer name'],
      bucket: ['bucket', 'bucket status'],
      branchAllocation: ['branchallocation', 'branch allocation'],
      seasoning: ['seasoning'],
      fileName: ['filename', 'file name'],
      status: ['status'],
      customerName: ['customer name', 'customer'],
      chasisNumber: ['chasis number', 'chassis number', 'chassis no', 'chasis no'],
      pos: ['pos'],
      firstConfirmerNo: ['1st confirmer no', 'first confirmer no'],
      secondConfirmerNo: ['2nd confirmer no', 'second confirmer no', '2st confirmer no'],
      thirdConfirmerNo: ['3rd confirmer no', 'third confirmer no'],
      address: ['address'],
      sec17: ['sec 17', 'section 17', 'sec17'],
      model: ['model', 'vehicle model'],
      tbr: ['tbr'],
      uploadDate: ['uploaddate', 'upload date']
    };

    const normalize = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

    // Precompute header mapping using first row's keys
    const headerKeys = rows.length ? Object.keys(rows[0]) : [];
    const headerMap = {};
    for (const key of headerKeys) {
      headerMap[normalize(key)] = key;
    }

    const extract = (row) => {
      const doc = {};
      for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
        let value = '';
        for (const alias of aliases) {
          const header = headerMap[normalize(alias)];
          if (header && row[header] !== undefined && row[header] !== null && row[header] !== '') {
            value = String(row[header]);
            break;
          }
        }
        doc[field] = value;
      }
      return doc;
    };

    // Attach context and mapped fields, enforce actual filename
    const actualFileName = req.file?.originalname || '';
    const docs = rows.map(r => ({
      bankName: bankName || '',
      vehicleType,
      ...extract(r),
      fileName: actualFileName, // override with uploaded file's real name
      raw: r
    }));
    if (docs.length === 0) return res.status(400).json({ success: false, message: 'No rows found in sheet' });

    console.log('[MobileUpload] tenant:', tenant.name, 'db:', conn.name, 'collection:', collection, 'rows:', docs.length);
    const result = await UploadModel.insertMany(docs, { ordered: false });
    res.json({ success: true, message: 'File processed', inserted: result.length, database: conn.name, collection });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ success: false, message: 'Upload failed' });
  }
});

module.exports = router;


 