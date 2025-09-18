// Use new API when available, fallback to legacy for compatibility
let _dbInstance = null;
let _searchIndex = null; // In-memory search index for ultra-fast lookups
let _progressiveCache = new Map(); // Progressive search cache for instant results
let _backgroundSearchTimeout = null; // Background search timeout

const getDatabase = () => {
  if (_dbInstance) return _dbInstance;
  try {
    // SDK 50+: use sync API
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { openDatabaseSync } = require('expo-sqlite');
    _dbInstance = openDatabaseSync('rapidrepo.db');
    return _dbInstance;
  } catch (_) {
    // Legacy API (same package)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { openDatabase } = require('expo-sqlite');
    _dbInstance = openDatabase('rapidrepo.db');
    return _dbInstance;
  }
};

// Build in-memory search index for instant lookups
export const buildSearchIndex = async () => {
  try {
    const db = getDatabase();
    const res = await executeSql(db, `SELECT _id, regSuffix, chassisLc, regNo, chassisNo, loanNo, bank, make, customerName, address FROM vehicles`);
    const vehicles = res?.rows?._array || [];
    
    _searchIndex = {
      regSuffix: new Map(), // regSuffix -> [vehicles]
      chassisPrefix: new Map(), // chassis prefix -> [vehicles]
      regNo: new Map(), // regNo -> vehicle
      chassisNo: new Map() // chassisNo -> vehicle
    };
    
    vehicles.forEach(vehicle => {
      // Index by registration suffix
      if (vehicle.regSuffix) {
        if (!_searchIndex.regSuffix.has(vehicle.regSuffix)) {
          _searchIndex.regSuffix.set(vehicle.regSuffix, []);
        }
        _searchIndex.regSuffix.get(vehicle.regSuffix).push(vehicle);
      }
      
      // Index by chassis prefix (first 3 chars)
      if (vehicle.chassisLc && vehicle.chassisLc.length >= 3) {
        const prefix = vehicle.chassisLc.slice(0, 3);
        if (!_searchIndex.chassisPrefix.has(prefix)) {
          _searchIndex.chassisPrefix.set(prefix, []);
        }
        _searchIndex.chassisPrefix.get(prefix).push(vehicle);
      }
      
      // Index by full regNo and chassisNo
      if (vehicle.regNo) {
        _searchIndex.regNo.set(vehicle.regNo.toLowerCase(), vehicle);
      }
      if (vehicle.chassisNo) {
        _searchIndex.chassisNo.set(vehicle.chassisNo.toLowerCase(), vehicle);
      }
    });
    
    console.log(`Search index built: ${_searchIndex.regSuffix.size} reg suffixes, ${_searchIndex.chassisPrefix.size} chassis prefixes`);
    return _searchIndex;
  } catch (error) {
    console.error('Error building search index:', error);
    return null;
  }
};

// Get search index (build if not exists)
const getSearchIndex = async () => {
  if (!_searchIndex) {
    await buildSearchIndex();
  }
  return _searchIndex;
};

// Instant check: is in-memory search index ready?
export const isSearchIndexReady = () => {
  return !!_searchIndex;
};

// Zero-latency lookup from in-memory index only (no DB)
export const quickLookupByRegSuffix = (suffix) => {
  const clean = String(suffix || '').replace(/\D/g, '').slice(0, 4);
  if (!/^[0-9]{4}$/.test(clean)) return [];
  if (!_searchIndex) return [];
  const arr = _searchIndex.regSuffix?.get(clean) || [];
  return Array.isArray(arr) ? arr : [];
};

const executeSql = (db, sql, params = []) => new Promise((resolve, reject) => {
  try {
    // For new API (SDK 50+)
    if (db.execSync) {
      const result = db.execSync(sql, params);
      resolve({ rows: { _array: result } });
    } else if (db.transaction) {
      // Legacy API
      db.transaction(tx => {
        tx.executeSql(
          sql,
          params,
          (_, result) => resolve(result),
          (_, error) => { reject(error); return false; }
        );
      });
    } else {
      reject(new Error('Database not properly initialized'));
    }
  } catch (error) {
    reject(error);
  }
});

export const initDatabase = async () => {
  const db = getDatabase();
  // Create table and indexes if not exists
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
  
  // Create optimized indexes for ultra-fast searches
  await executeSql(db, 'CREATE INDEX IF NOT EXISTS idx_vehicles_regsuffix ON vehicles (regSuffix)');
  await executeSql(db, 'CREATE INDEX IF NOT EXISTS idx_vehicles_chassislc ON vehicles (chassisLc)');
  await executeSql(db, 'CREATE INDEX IF NOT EXISTS idx_vehicles_regno ON vehicles (regNo)');
  await executeSql(db, 'CREATE INDEX IF NOT EXISTS idx_vehicles_chassisno ON vehicles (chassisNo)');
  await executeSql(db, 'CREATE INDEX IF NOT EXISTS idx_vehicles_loanno ON vehicles (loanNo)');
  
  // Composite indexes for complex queries
  await executeSql(db, 'CREATE INDEX IF NOT EXISTS idx_vehicles_regsuffix_chassis ON vehicles (regSuffix, chassisLc)');
  
  // Aux table to mark seen ids per sync to support deletion of stale rows
  await executeSql(db, `CREATE TABLE IF NOT EXISTS sync_seen (
    _id TEXT PRIMARY KEY
  )`);
  return db;
};

export const clearVehicles = async () => {
  const db = getDatabase();
  await executeSql(db, 'DELETE FROM vehicles');
};

export const countVehicles = async () => {
  const db = getDatabase();
  const res = await executeSql(db, 'SELECT COUNT(1) as c FROM vehicles');
  return res?.rows?._array?.[0]?.c || 0;
};

export const bulkInsertVehicles = async (items, options = {}) => {
  const { reindex = true } = options;
  if (!Array.isArray(items) || items.length === 0) return 0;
  const db = getDatabase();
  let inserted = 0;

  // Insert in chunks to avoid large statements (optimized for performance)
  const chunkSize = 2000; // Increased from 800 to 2000 for better performance
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    
    try {
      // For new API (SDK 50+)
      if (db.execSync) {
        for (const v of chunk) {
          const regNo = String(v.regNo || '').trim();
          const regSuffix = regNo.length >= 4 ? regNo.slice(-4) : '';
          const chassisNo = String(v.chassisNo || '').trim();
          const chassisLc = chassisNo.toLowerCase();
          
          db.execSync(
            `INSERT OR REPLACE INTO vehicles
              (_id, vehicleType, regNo, regSuffix, chassisNo, chassisLc, loanNo, bank, make, customerName, address)
             VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
            [
              String(v._id || ''),
              String(v.vehicleType || ''),
              regNo,
              regSuffix,
              chassisNo,
              chassisLc,
              String(v.loanNo || ''),
              String(v.bank || ''),
              String(v.make || ''),
              String(v.customerName || ''),
              String(v.address || '')
            ]
          );
        }
        inserted += chunk.length;
      } else if (db.transaction) {
        // Legacy API
        await new Promise((resolve, reject) => {
          db.transaction(tx => {
            try {
              for (const v of chunk) {
                const regNo = String(v.regNo || '').trim();
                const regSuffix = regNo.length >= 4 ? regNo.slice(-4) : '';
                const chassisNo = String(v.chassisNo || '').trim();
                const chassisLc = chassisNo.toLowerCase();
                tx.executeSql(
                  `INSERT OR REPLACE INTO vehicles
                    (_id, vehicleType, regNo, regSuffix, chassisNo, chassisLc, loanNo, bank, make, customerName, address)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
                  [
                    String(v._id || ''),
                    String(v.vehicleType || ''),
                    regNo,
                    regSuffix,
                    chassisNo,
                    chassisLc,
                    String(v.loanNo || ''),
                    String(v.bank || ''),
                    String(v.make || ''),
                    String(v.customerName || ''),
                    String(v.address || '')
                  ]
                );
              }
            } catch (e) { reject(e); }
          }, reject, () => { inserted += chunk.length; resolve(); });
        });
      } else {
        throw new Error('Database not properly initialized');
      }
    } catch (error) {
      console.error('Error inserting chunk:', error);
      // Continue with next chunk even if one fails
    }
  }
  
  // Rebuild search index after bulk insert for ultra-fast searches (optional)
  if (inserted > 0 && reindex) {
    try {
      await buildSearchIndex();
      console.log(`Search index rebuilt after inserting ${inserted} records`);
    } catch (error) {
      console.error('Error rebuilding search index:', error);
    }
  }
  
  return inserted;
};

// Explicit function to rebuild index on demand (e.g., once after full sync)
export const rebuildSearchIndex = async () => {
  try {
    await buildSearchIndex();
    return true;
  } catch (error) {
    console.error('Rebuild search index error:', error);
    return false;
  }
};

// Ultra-fast search using in-memory index
export const searchByRegSuffix = async (suffix) => {
  const clean = String(suffix || '').replace(/\D/g, '').slice(0, 4);
  if (!/^\d{4}$/.test(clean)) return [];
  
  try {
    // Try in-memory index first (ULTRA FAST)
    const index = await getSearchIndex();
    if (index && index.regSuffix.has(clean)) {
      return index.regSuffix.get(clean);
    }
  } catch (error) {
    console.error('Index search error:', error);
  }
  
  // Fallback to database query
  const db = getDatabase();
  const res = await executeSql(db, `SELECT _id, vehicleType, regNo, chassisNo, loanNo, bank, make, customerName, address
    FROM vehicles WHERE regSuffix = ?`, [clean]);
  return res?.rows?._array || [];
};

// Ultra-fast chassis search using in-memory index
export const searchByChassis = async (needle) => {
  const q = String(needle || '').trim().toLowerCase();
  if (q.length < 3) return [];
  
  try {
    // Try in-memory index first (ULTRA FAST)
    const index = await getSearchIndex();
    if (index) {
      // Search by prefix for fast lookup
      if (q.length >= 3) {
        const prefix = q.slice(0, 3);
        if (index.chassisPrefix.has(prefix)) {
          const candidates = index.chassisPrefix.get(prefix);
          // Filter by full needle
          return candidates.filter(vehicle => 
            vehicle.chassisLc && vehicle.chassisLc.includes(q)
          );
        }
      }
      
      // Direct chassis number lookup
      if (index.chassisNo.has(q)) {
        return [index.chassisNo.get(q)];
      }
    }
  } catch (error) {
    console.error('Index search error:', error);
  }
  
  // Fallback to database query
  const db = getDatabase();
  const res = await executeSql(db, `SELECT _id, vehicleType, regNo, chassisNo, loanNo, bank, make, customerName, address
    FROM vehicles WHERE chassisLc LIKE ?`, [`%${q}%`] );
  return res?.rows?._array || [];
};

// Progressive search with background prefetching for 0ms response
export const progressiveSearch = async (input, onProgress = null) => {
  const clean = String(input || '').replace(/\D/g, '').slice(0, 4);
  if (clean.length < 2) return [];
  
  // Check progressive cache first (INSTANT)
  if (_progressiveCache.has(clean)) {
    const cached = _progressiveCache.get(clean);
    console.log(`Progressive cache hit for ${clean}: ${cached.length} results`);
    return cached;
  }
  
  // Start background search for longer inputs
  if (clean.length >= 2) {
    startBackgroundSearch(clean, onProgress);
  }
  
  // Return partial results if available
  return await getPartialResults(clean);
};

// Start background search for progressive results
const startBackgroundSearch = (input, onProgress = null) => {
  // Clear previous timeout
  if (_backgroundSearchTimeout) {
    clearTimeout(_backgroundSearchTimeout);
  }
  
  // Start background search after small delay
  _backgroundSearchTimeout = setTimeout(async () => {
    try {
      const results = await searchByRegSuffix(input);
      
      // Cache the results for instant future access
      _progressiveCache.set(input, results);
      
      // Notify progress if callback provided
      if (onProgress) {
        onProgress(results);
      }
      
      console.log(`Background search completed for ${input}: ${results.length} results`);
    } catch (error) {
      console.error('Background search error:', error);
    }
  }, 50); // 50ms delay for background processing
};

// Get partial results for progressive display
const getPartialResults = async (input) => {
  try {
    const index = await getSearchIndex();
    if (index) {
      const partialResults = [];
      
      // Find all regSuffixes that start with input
      for (const [suffix, vehicles] of index.regSuffix) {
        if (suffix.startsWith(input)) {
          partialResults.push(...vehicles);
        }
      }
      
      // Limit results for performance
      return partialResults.slice(0, 20);
    }
  } catch (error) {
    console.error('Partial search error:', error);
  }
  
  return [];
};

// Smart prediction based on typing patterns
export const predictNextDigits = async (input) => {
  const clean = String(input || '').replace(/\D/g, '').slice(0, 4);
  if (clean.length < 2) return [];
  
  try {
    const index = await getSearchIndex();
    if (index) {
      const predictions = new Map();
      
      // Find all regSuffixes that start with input
      for (const [suffix, vehicles] of index.regSuffix) {
        if (suffix.startsWith(clean)) {
          const nextDigit = suffix[clean.length];
          if (nextDigit) {
            if (!predictions.has(nextDigit)) {
              predictions.set(nextDigit, 0);
            }
            predictions.set(nextDigit, predictions.get(nextDigit) + vehicles.length);
          }
        }
      }
      
      // Sort by frequency and return top predictions
      return Array.from(predictions.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([digit, count]) => ({ digit, count }));
    }
  } catch (error) {
    console.error('Prediction error:', error);
  }
  
  return [];
};

// Clear progressive cache when needed
export const clearProgressiveCache = () => {
  _progressiveCache.clear();
  console.log('Progressive cache cleared');
};

// New: Ultra-fast partial search for suggestions
export const searchSuggestions = async (input) => {
  const clean = String(input || '').replace(/\D/g, '').slice(0, 4);
  if (clean.length < 2) return [];
  
  try {
    const index = await getSearchIndex();
    if (index) {
      const suggestions = [];
      // Find all regSuffixes that start with input
      for (const [suffix, vehicles] of index.regSuffix) {
        if (suffix.startsWith(clean)) {
          suggestions.push({
            suffix,
            count: vehicles.length,
            sample: vehicles[0] // First vehicle as sample
          });
        }
      }
      return suggestions.slice(0, 5); // Limit to 5 suggestions
    }
  } catch (error) {
    console.error('Suggestion search error:', error);
  }
  
  return [];
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
    
    try {
      // For new API (SDK 50+)
      if (db.execSync) {
        for (const id of chunk) {
          db.execSync('INSERT OR REPLACE INTO sync_seen (_id) VALUES (?)', [String(id)]);
        }
        cnt += chunk.length;
      } else if (db.transaction) {
        // Legacy API
        await new Promise((resolve, reject) => {
          db.transaction(tx => {
            try {
              for (const id of chunk) {
                tx.executeSql('INSERT OR REPLACE INTO sync_seen (_id) VALUES (?)', [String(id)]);
              }
            } catch (e) { reject(e); }
          }, reject, () => { cnt += chunk.length; resolve(); });
        });
      } else {
        throw new Error('Database not properly initialized');
      }
    } catch (error) {
      console.error('Error marking seen IDs:', error);
      // Continue with next chunk even if one fails
    }
  }
  return cnt;
};

export const deleteNotSeen = async () => {
  const db = getDatabase();
  await executeSql(db, 'DELETE FROM vehicles WHERE _id NOT IN (SELECT _id FROM sync_seen)');
};


