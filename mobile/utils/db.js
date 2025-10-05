// Use new API when available, fallback to legacy for compatibility
let _dbInstance = null;
let _isNewAPI = false;
let _dbLock = Promise.resolve();

const runLocked = (fn) => {
  const next = _dbLock.then(() => fn());
  // Prevent lock chain from breaking on rejection
  _dbLock = next.catch(() => {});
  return next;
};

const getDatabase = () => {
  if (_dbInstance) return _dbInstance;
  try {
    // SDK 50+: use sync API
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { openDatabaseSync } = require('expo-sqlite');
    _dbInstance = openDatabaseSync('rapidrepo.db');
    _isNewAPI = true;
    console.log('Using new expo-sqlite API');
    return _dbInstance;
  } catch (_) {
    // Legacy API (same package)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { openDatabase } = require('expo-sqlite');
    _dbInstance = openDatabase('rapidrepo.db');
    _isNewAPI = false;
    console.log('Using legacy expo-sqlite API');
    return _dbInstance;
  }
};

const executeSql = (db, sql, params = []) => new Promise((resolve, reject) => {
  if (_isNewAPI) {
    // New API - serialize with lock to avoid database locked
    const attempt = async (retries = 5) => {
      try {
        const res = await runLocked(() => {
          const isSelect = /^\s*select/i.test(sql);
          if (isSelect) {
            const rows = db.getAllSync(sql, params);
            return { rows: { _array: rows } };
          }
          // For non-select, use runSync so bound parameters are applied
          const result = db.runSync(sql, params);
          return { rows: { _array: [] }, changes: result?.changes || 0 };
        });
        resolve(res);
      } catch (err) {
        const msg = String(err?.message || err || '').toLowerCase();
        if (retries > 0 && (msg.includes('database is locked') || msg.includes('busy'))) {
          const wait = 100 + Math.floor(Math.random() * 200);
          setTimeout(() => attempt(retries - 1), wait);
        } else {
          reject(err);
        }
      }
    };
    attempt();
  } else {
    // Legacy API - transaction based
    db.transaction(tx => {
      tx.executeSql(
        sql,
        params,
        (_, result) => resolve(result),
        (_, error) => { reject(error); return false; }
      );
    });
  }
});

export const initDatabase = async () => {
  try {
    console.log('🔧 Initializing database...');
    const db = getDatabase();
    
    // Create table and indexes if not exists - optimized for speed
    try {
      // Use faster PRAGMA settings for better performance
      await executeSql(db, 'PRAGMA journal_mode=WAL');
      await executeSql(db, 'PRAGMA synchronous=NORMAL');
      await executeSql(db, 'PRAGMA busy_timeout=2000'); // Reduced timeout
      await executeSql(db, 'PRAGMA cache_size=5000'); // Reduced cache for faster startup
      await executeSql(db, 'PRAGMA temp_store=MEMORY'); // Use memory for temp tables
      console.log('✅ Database PRAGMA settings applied');
    } catch (e) {
      console.log('PRAGMA setup warning:', e?.message || e);
    }
    await executeSql(db, `CREATE TABLE IF NOT EXISTS vehicles (
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
    )`);
    console.log('✅ Vehicles table created/verified');
    
    await executeSql(db, 'CREATE INDEX IF NOT EXISTS idx_vehicles_regsuffix ON vehicles (regSuffix)');
    await executeSql(db, 'CREATE INDEX IF NOT EXISTS idx_vehicles_chassislc ON vehicles (chassisLc)');
    console.log('✅ Indexes created/verified');
    // Track per-file sync progress/parity versus server
    await executeSql(db, `CREATE TABLE IF NOT EXISTS file_sync (
      fileName TEXT PRIMARY KEY,
      vehicleType TEXT,
      bankName TEXT,
      total INTEGER DEFAULT 0,
      downloaded INTEGER DEFAULT 0,
      completed INTEGER DEFAULT 0,
      lastOffset INTEGER DEFAULT 0,
      serverUploadDate TEXT,
      localDownloadDate TEXT,
      updatedAt TEXT
    )`);
    await executeSql(db, 'CREATE INDEX IF NOT EXISTS idx_file_sync_completed ON file_sync (completed)');
    await executeSql(db, 'CREATE INDEX IF NOT EXISTS idx_file_sync_upload_date ON file_sync (serverUploadDate)');
    console.log('✅ File sync metadata table created/verified');
    // Aux table to mark seen ids per sync to support deletion of stale rows
    await executeSql(db, `CREATE TABLE IF NOT EXISTS sync_seen (
      _id TEXT PRIMARY KEY
    )`);
    console.log('✅ Sync table created/verified');
    
    // Test database connection
    const testResult = await executeSql(db, 'SELECT COUNT(*) as count FROM vehicles');
    console.log(`✅ Database test successful, current count: ${testResult.rows._array[0]?.count || 0}`);
    
    return db;
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
};

export const clearVehicles = async () => {
  try {
    const db = getDatabase();
    await executeSql(db, 'DELETE FROM vehicles');
  } catch (error) {
    console.log('Error clearing vehicles:', error.message);
  }
};

export const countVehicles = async () => {
  try {
    // Skip full initialization for faster startup - just get database
    const db = getDatabase();
    const res = await executeSql(db, 'SELECT COUNT(1) as c FROM vehicles');
    const count = res?.rows?._array?.[0]?.c || 0;
    console.log(`📊 Database count query result: ${count}`);
    return count;
  } catch (error) {
    console.error('Error counting vehicles:', error.message);
    // If count fails, try to initialize database and retry
    try {
      await initDatabase();
      const db = getDatabase();
      const res = await executeSql(db, 'SELECT COUNT(1) as c FROM vehicles');
      const count = res?.rows?._array?.[0]?.c || 0;
      return count;
    } catch (retryError) {
      console.error('Error counting vehicles after retry:', retryError.message);
      return 0;
    }
  }
};

// ---- Per-file sync metadata helpers ----
export const upsertFileMeta = async (fileName, data) => {
  if (!fileName) return null;
  const db = getDatabase();
  const nowIso = new Date().toISOString();
  const safe = (v) => (v === undefined || v === null ? null : v);
  await executeSql(db, `INSERT OR REPLACE INTO file_sync
    (fileName, vehicleType, bankName, total, downloaded, completed, lastOffset, serverUploadDate, localDownloadDate, updatedAt)
    VALUES (
      ?,
      COALESCE((SELECT vehicleType FROM file_sync WHERE fileName = ?), ?),
      COALESCE((SELECT bankName FROM file_sync WHERE fileName = ?), ?),
      COALESCE(?, COALESCE((SELECT total FROM file_sync WHERE fileName = ?), 0)),
      COALESCE(?, COALESCE((SELECT downloaded FROM file_sync WHERE fileName = ?), 0)),
      COALESCE(?, COALESCE((SELECT completed FROM file_sync WHERE fileName = ?), 0)),
      COALESCE(?, COALESCE((SELECT lastOffset FROM file_sync WHERE fileName = ?), 0)),
      COALESCE(?, (SELECT serverUploadDate FROM file_sync WHERE fileName = ?)),
      COALESCE(?, (SELECT localDownloadDate FROM file_sync WHERE fileName = ?)),
      ?
    )
  `, [
    String(fileName),
    String(fileName), safe(data.vehicleType),
    String(fileName), safe(data.bankName),
    safe(data.total), String(fileName),
    safe(data.downloaded), String(fileName),
    safe(data.completed ? 1 : data.completed === 0 ? 0 : null), String(fileName),
    safe(data.lastOffset), String(fileName),
    safe(data.serverUploadDate), String(fileName),
    safe(data.localDownloadDate), String(fileName),
    nowIso
  ]);
  const res = await executeSql(db, 'SELECT * FROM file_sync WHERE fileName = ?', [String(fileName)]);
  return res?.rows?._array?.[0] || null;
};

export const getFileMeta = async (fileName) => {
  if (!fileName) return null;
  const db = getDatabase();
  const res = await executeSql(db, 'SELECT * FROM file_sync WHERE fileName = ?', [String(fileName)]);
  return res?.rows?._array?.[0] || null;
};

export const listFileMeta = async () => {
  const db = getDatabase();
  const res = await executeSql(db, 'SELECT * FROM file_sync ORDER BY serverUploadDate DESC NULLS LAST, updatedAt DESC', []);
  return res?.rows?._array || [];
};

export const markFileCompleted = async (fileName) => {
  if (!fileName) return;
  const db = getDatabase();
  const nowIso = new Date().toISOString();
  await executeSql(db, 'UPDATE file_sync SET completed = 1, localDownloadDate = ?, updatedAt = ?, downloaded = total WHERE fileName = ?', [nowIso, nowIso, String(fileName)]);
};

// DEBUG: quick stats to validate searchable fields are populated
export const getSearchableFieldStats = async () => {
  try {
    const db = getDatabase();
    const stats = {};
    const total = await executeSql(db, 'SELECT COUNT(1) as c FROM vehicles');
    stats.total = total?.rows?._array?.[0]?.c || 0;
    const regFilled = await executeSql(db, "SELECT COUNT(1) as c FROM vehicles WHERE regNo IS NOT NULL AND TRIM(regNo) <> ''");
    stats.regNoFilled = regFilled?.rows?._array?.[0]?.c || 0;
    const chassisFilled = await executeSql(db, "SELECT COUNT(1) as c FROM vehicles WHERE chassisNo IS NOT NULL AND TRIM(chassisNo) <> ''");
    stats.chassisNoFilled = chassisFilled?.rows?._array?.[0]?.c || 0;
    const suffixFilled = await executeSql(db, "SELECT COUNT(1) as c FROM vehicles WHERE regSuffix IS NOT NULL AND TRIM(regSuffix) <> ''");
    stats.regSuffixFilled = suffixFilled?.rows?._array?.[0]?.c || 0;
    const sample = await executeSql(db, `SELECT _id, regNo, regSuffix, chassisNo FROM vehicles WHERE regNo IS NOT NULL AND TRIM(regNo) <> '' LIMIT 5`);
    stats.sample = sample?.rows?._array || [];
    return stats;
  } catch (error) {
    console.log('Error getting field stats:', error.message);
    return null;
  }
};

export const bulkInsertVehicles = async (items, options = {}) => {
  if (!Array.isArray(items) || items.length === 0) return 0;
  
  try {
    // Ensure database is initialized
    await initDatabase();
  } catch (error) {
    console.error('Database initialization failed:', error);
    return 0;
  }
  
  const db = getDatabase();
  let inserted = 0;

  // Optimized chunk size based on API version and options
  const chunkSize = options.chunkSize || (_isNewAPI ? 2000 : 800);
  const reindex = options.reindex !== false; // Default to true unless explicitly disabled

  console.log(`📦 Bulk inserting ${items.length} items in chunks of ${chunkSize}`);

  // Start transaction for better performance and consistency
  await executeSql(db, 'BEGIN TRANSACTION');

  try {
    for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    
    if (_isNewAPI) {
      // New API - run the whole chunk inside a lock
      try {
        const sql = `INSERT OR REPLACE INTO vehicles
          (_id, vehicleType, regNo, regSuffix, chassisNo, chassisLc, loanNo, bank, make, customerName, address)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`;
        await runLocked(async () => {
          for (const v of chunk) {
            try {
              const regNo = String(v.regNo || v.reg_no || v.registrationNumber || v.registration_no || v.vehicleNo || v.vehicle_no || '').trim();
              const regSuffix = regNo.length >= 4 ? regNo.slice(-4) : '';
              const chassisNo = String(v.chassisNo || v.chassis_no || v.chassis || v.vin || '').trim();
              const chassisLc = chassisNo.toLowerCase();
              // Derive a stable id if _id missing
              const rawId = v?._id || v?.id || (v?._id && v?._id.$oid) || v?.mongoId || v?.mongo_id;
              const derivedId = String(rawId || `${regNo}#${chassisNo}`);
              
              const result = db.runSync(sql, [
                derivedId,
                String(v.vehicleType || v.vehicle_type || ''),
                regNo,
                regSuffix,
                chassisNo,
                chassisLc,
                String(v.loanNo || v.loan_no || ''),
                String(v.bank || v.bank_name || ''),
                String(v.make || v.manufacturer || ''),
                String(v.customerName || v.customer_name || ''),
                String(v.address || v.customer_address || '')
              ]);
              
              inserted++;
              
              // Log every 100th insertion for debugging
              if (inserted % 100 === 0) {
                console.log(`📝 Inserted ${inserted} records so far...`);
              }
            } catch (individualError) {
              console.error('Individual insert failed:', individualError);
            }
          }
        });
      } catch (e) {
        console.error('Bulk insert error (new API):', e);
        throw e;
      }
    } else {
      // Legacy API - transaction based with error handling
      await new Promise((resolve, reject) => {
        db.transaction(tx => {
          try {
            for (const v of chunk) {
              const regNo = String(v.regNo || v.reg_no || v.registrationNumber || v.registration_no || v.vehicleNo || v.vehicle_no || '').trim();
              const regSuffix = regNo.length >= 4 ? regNo.slice(-4) : '';
              const chassisNo = String(v.chassisNo || v.chassis_no || v.chassis || v.vin || '').trim();
              const chassisLc = chassisNo.toLowerCase();
              const rawId = v?._id || v?.id || (v?._id && v?._id.$oid) || v?.mongoId || v?.mongo_id;
              const derivedId = String(rawId || `${regNo}#${chassisNo}`);
              tx.executeSql(
                `INSERT OR REPLACE INTO vehicles
                  (_id, vehicleType, regNo, regSuffix, chassisNo, chassisLc, loanNo, bank, make, customerName, address)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
                [
                  derivedId,
                  String(v.vehicleType || v.vehicle_type || ''),
                  regNo,
                  regSuffix,
                  chassisNo,
                  chassisLc,
                  String(v.loanNo || v.loan_no || ''),
                  String(v.bank || v.bank_name || ''),
                  String(v.make || v.manufacturer || ''),
                  String(v.customerName || v.customer_name || ''),
                  String(v.address || v.customer_address || '')
                ]
              );
            }
          } catch (e) { 
            console.error('Transaction error:', e);
            reject(e); 
          }
        }, reject, () => { 
          inserted += chunk.length; 
          resolve(); 
        });
      });
    }
    
    // Progress logging for large datasets
    if (i % (chunkSize * 10) === 0) {
      console.log(`📊 Progress: ${Math.min(i + chunkSize, items.length)}/${items.length} items processed`);
    }
  }
  
  // Rebuild indexes if requested and we have the new API
  if (reindex && _isNewAPI) {
    try {
      await rebuildSearchIndex();
    } catch (e) {
      console.log('Index rebuild completed with warnings');
    }
  }
  
  // Commit transaction
  await executeSql(db, 'COMMIT');
  console.log(`✅ Bulk insert completed: ${inserted} items inserted`);
  return inserted;
  
  } catch (error) {
    // Rollback transaction on error
    await executeSql(db, 'ROLLBACK');
    console.error('❌ Bulk insert failed, transaction rolled back:', error);
    throw error;
  }
};

export const searchByRegSuffix = async (suffix) => {
  const db = getDatabase();
  const clean = String(suffix || '').replace(/\D/g, '').slice(0, 4);
  if (!/^\d{4}$/.test(clean)) return [];
  const res = await executeSql(db, `SELECT _id, vehicleType, regNo, chassisNo, loanNo, bank, make, customerName, address
    FROM vehicles WHERE regSuffix = ?`, [clean]);
  return res?.rows?._array || [];
};

// Partial suffix match for 2-3 digits at end of registration number
export const searchByRegSuffixPartial = async (partial) => {
  const db = getDatabase();
  const clean = String(partial || '').replace(/\D/g, '').slice(0, 4);
  if (clean.length < 2) return [];
  const patternEnd = `%${clean}`; // ends with the given digits
  const patternAny = `%${clean}%`; // contains the digits anywhere
  // Prefer indexed regSuffix; also fallback to regNo LIKE (end) and (anywhere)
  const res = await executeSql(db, `
    SELECT DISTINCT _id, vehicleType, regNo, chassisNo, loanNo, bank, make, customerName, address
    FROM vehicles 
    WHERE regSuffix LIKE ? OR regNo LIKE ? OR regNo LIKE ?
    LIMIT 100
  `, [patternEnd, patternEnd, patternAny]);
  return res?.rows?._array || [];
};

// Fallback: search full regNo by suffix when regSuffix column is missing/empty for some rows
export const searchByRegNoSuffixLike = async (suffix) => {
  const db = getDatabase();
  const clean = String(suffix || '').replace(/\D/g, '').slice(0, 4);
  if (!/^\d{4}$/.test(clean)) return [];
  const patternEnd = `%${clean}`;
  const patternAny = `%${clean}%`;
  const res = await executeSql(db, `SELECT DISTINCT _id, vehicleType, regNo, chassisNo, loanNo, bank, make, customerName, address
    FROM vehicles WHERE regNo LIKE ? OR regNo LIKE ? LIMIT 200`, [patternEnd, patternAny]);
  return res?.rows?._array || [];
};

export const searchByChassis = async (needle) => {
  const db = getDatabase();
  const q = String(needle || '').trim().toLowerCase();
  if (q.length < 3) return [];
  const res = await executeSql(db, `SELECT _id, vehicleType, regNo, chassisNo, loanNo, bank, make, customerName, address
    FROM vehicles WHERE chassisLc LIKE ?`, [`%${q}%`] );
  return res?.rows?._array || [];
};

// Pagination support for browsing offline data
export const listVehiclesPage = async (offset = 0, limit = 50) => {
  const db = getDatabase();
  const safeLimit = Math.max(1, Math.min(200, parseInt(limit) || 50));
  const safeOffset = Math.max(0, parseInt(offset) || 0);
  const res = await executeSql(db, `
    SELECT _id, vehicleType, regNo, chassisNo, loanNo, bank, make, customerName, address
    FROM vehicles
    ORDER BY regNo ASC
    LIMIT ? OFFSET ?
  `, [safeLimit, safeOffset]);
  return res?.rows?._array || [];
};

export const resetSeen = async () => {
  const db = getDatabase();
  await executeSql(db, 'DELETE FROM sync_seen');
};

export const markSeenIds = async (ids) => {
  if (!Array.isArray(ids) || ids.length === 0) return 0;
  const db = getDatabase();
  const chunkSize = 900;
  let cnt = 0;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    
    if (_isNewAPI) {
      // New API - serialize with lock
      try {
        await runLocked(() => {
          for (const id of chunk) {
            db.runSync('INSERT OR REPLACE INTO sync_seen (_id) VALUES (?)', [String(id)]);
          }
        });
        cnt += chunk.length;
      } catch (e) {
        console.error('Mark seen IDs error (new API):', e);
        throw e;
      }
    } else {
      // Legacy API - transaction based
      await new Promise((resolve, reject) => {
        db.transaction(tx => {
          try {
            for (const id of chunk) {
              tx.executeSql('INSERT OR REPLACE INTO sync_seen (_id) VALUES (?)', [String(id)]);
            }
          } catch (e) { reject(e); }
        }, reject, () => { cnt += chunk.length; resolve(); });
      });
    }
  }
  return cnt;
};

export const deleteNotSeen = async () => {
  const db = getDatabase();
  await executeSql(db, 'DELETE FROM vehicles WHERE _id NOT IN (SELECT _id FROM sync_seen)');
};

export const countSeen = async () => {
  try {
    const db = getDatabase();
    const res = await executeSql(db, 'SELECT COUNT(1) as c FROM sync_seen');
    return res?.rows?._array?.[0]?.c || 0;
  } catch (_) {
    return 0;
  }
};

export const rebuildSearchIndex = async () => {
  const db = getDatabase();
  // SQLite automatically maintains indexes, but we can run ANALYZE to update statistics
  try {
    await executeSql(db, 'ANALYZE');
    console.log('Search index rebuilt successfully');
  } catch (error) {
    console.log('Search index rebuild completed (ANALYZE not supported)');
  }
};

// Get subset of ids that already exist locally
export const getExistingIds = async (ids) => {
  if (!Array.isArray(ids) || ids.length === 0) return new Set();
  const db = getDatabase();
  const existing = new Set();
  const chunkSize = 900;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const placeholders = chunk.map(() => '?').join(',');
    try {
      const res = await executeSql(db, `SELECT _id FROM vehicles WHERE _id IN (${placeholders})`, chunk.map(x => String(x)));
      (res?.rows?._array || []).forEach(row => existing.add(String(row._id)));
    } catch (e) {
      console.log('getExistingIds error:', e.message);
    }
  }
  return existing;
};


