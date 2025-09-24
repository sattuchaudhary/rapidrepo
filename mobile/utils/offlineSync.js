import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { getBaseURL } from './config';
import { initDatabase, bulkInsertVehicles, resetSeen, markSeenIds, deleteNotSeen, rebuildSearchIndex, getExistingIds, countVehicles, countSeen } from './db';
import { safeProgressCallback, validateProgressData } from './errorHandler';

// Enhanced rate limiting configuration for bulk downloads
const RATE_LIMIT_CONFIG = {
  maxRequestsPerMinute: 120, // faster throughput
  baseDelay: 300,
  maxDelay: 10000,
  backoffMultiplier: 1.3,
  maxRetries: 5,
  bulkChunkSize: 20000,
  compressionEnabled: true
};

// Request queue to manage rate limiting
let CURRENT_MAX_RPM = 200;
class RequestQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.requestCount = 0;
    this.lastRequestTime = 0;
  }

  async addRequest(requestFn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ requestFn, resolve, reject });
      this.processQueue();
    });
  }

  async processQueue() {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    
    while (this.queue.length > 0) {
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;
      const minDelay = (60 * 1000) / Math.max(10, CURRENT_MAX_RPM); // adaptive RPM
      
      if (timeSinceLastRequest < minDelay) {
        const waitTime = minDelay - timeSinceLastRequest;
        console.log(`⏳ Rate limiting: waiting ${waitTime}ms`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
      
      const { requestFn, resolve, reject } = this.queue.shift();
      
      try {
        const result = await requestFn();
        this.lastRequestTime = Date.now();
        this.requestCount++;
        resolve(result);
      } catch (error) {
        reject(error);
      }
    }
    
    this.processing = false;
  }
}

const requestQueue = new RequestQueue();

// Enhanced retry logic with exponential backoff
const makeRequestWithRetry = async (requestFn, maxRetries = RATE_LIMIT_CONFIG.maxRetries) => {
  let retryCount = 0;
  let delay = RATE_LIMIT_CONFIG.baseDelay;
  
  while (retryCount <= maxRetries) {
    try {
      const result = await requestQueue.addRequest(requestFn);
      // Gradual recovery on success
      CURRENT_MAX_RPM = Math.min(180, Math.floor(CURRENT_MAX_RPM * 1.05));
      return result;
    } catch (error) {
      retryCount++;
      
      if (error.response?.status === 429) {
        // Rate limited - use exponential backoff
        const backoffDelay = Math.min(delay * Math.pow(RATE_LIMIT_CONFIG.backoffMultiplier, retryCount - 1), RATE_LIMIT_CONFIG.maxDelay);
        console.log(`🚫 Rate limited (429): waiting ${backoffDelay}ms before retry ${retryCount}/${maxRetries}`);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
        delay = backoffDelay;
        // Back off RPM on 429
        CURRENT_MAX_RPM = Math.max(20, Math.floor(CURRENT_MAX_RPM * 0.85));
      } else if (retryCount <= maxRetries) {
        // Other errors - shorter delay
        const retryDelay = 2000 * retryCount;
        console.log(`⚠️ Request failed: waiting ${retryDelay}ms before retry ${retryCount}/${maxRetries}`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      } else {
        console.log(`❌ Request failed after ${maxRetries} retries: ${error.message}`);
        throw error;
      }
    }
  }
};

// Enhanced bulk download with compression and progress tracking
export const runOptimizedBulkDownload = async (onProgress = null) => {
  const token = await SecureStore.getItemAsync('token');
  if (!token) return { success: false, message: 'No token' };

  try {
    console.log('🚀 Starting optimized bulk download...');
    
    // Preflight check
    await makeRequestWithRetry(() => 
      axios.get(`${getBaseURL()}/api/health`, { timeout: 10000 })
    );

    // Get optimized stats
    const statsRes = await makeRequestWithRetry(() =>
      axios.get(`${getBaseURL()}/api/bulk-download/bulk-stats`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 15000
      })
    );
    
    const tenant = statsRes.data?.tenant || 'Unknown';
    const counts = statsRes.data?.counts || {};
    const totalRecords = statsRes.data?.totalRecords || 0;

    console.log(`📊 Tenant: ${tenant}`);
    console.log(`📈 Total records: ${totalRecords.toLocaleString()}`);

    // Init DB
    await initDatabase();
    await resetSeen();

    let inserted = 0;
    const CHUNK_SIZE = RATE_LIMIT_CONFIG.bulkChunkSize;
    // Yield helper to keep JS thread responsive during heavy loops
    let lastYield = Date.now();
    const YIELD_INTERVAL = 120; // ms
    const maybeYield = async () => {
      const now = Date.now();
      if (now - lastYield >= YIELD_INTERVAL) {
        await new Promise((r) => setTimeout(r, 0));
        lastYield = now;
      }
    };
    
    // Check if dataset is too large for bulk download
    if (totalRecords > 100000) {
      console.log(`📊 Dataset too large (${totalRecords} records), using chunked approach directly`);
      // Don't throw error, just skip bulk download and go to chunked approach
    } else {
      // Use optimized bulk download endpoint
      try {
        console.log('📥 Starting bulk download with compression...');
        
        const bulkRes = await makeRequestWithRetry(() =>
          axios.get(`${getBaseURL()}/api/bulk-download/bulk-data`, {
            headers: { 
              Authorization: `Bearer ${token}`,
              'Accept-Encoding': 'gzip, deflate',
              'Content-Type': 'application/json'
            },
            params: {
              format: 'json',
              compression: 'gzip',
              batchSize: Math.min(CHUNK_SIZE, 5000), // Smaller batch for large datasets
              collections: 'all',
              // Request explicit fields required for offline search
              fields: 'regNo,reg_no,chassisNo,chassis_no,loanNo,loan_no,bank,bank_name,make,manufacturer,customerName,customer_name,address,customer_address,vehicleType,vehicle_type,_id'
            },
            timeout: 600000, // 10 minutes for bulk download
            responseType: 'json',
            maxContentLength: 100 * 1024 * 1024, // 100MB max
            maxBodyLength: 100 * 1024 * 1024
          })
        );
        
        const allData = bulkRes.data || [];
        console.log(`📦 Downloaded ${allData.length} records in one request`);
        if (allData.length > 0) {
          try {
            const sampleKeys = Object.keys(allData[0] || {});
            console.log('🧪 Bulk sample keys:', sampleKeys.join(','));
          } catch (_) {}
        }
        
        // Process in smaller chunks for database insertion
        const insertChunkSize = 5000;
        for (let i = 0; i < allData.length; i += insertChunkSize) {
          const chunk = allData.slice(i, i + insertChunkSize);
          const validItems = chunk.filter(it => it && (it.regNo || it.chassisNo || it.reg_no || it.chassis_no));
          
          if (validItems.length > 0) {
            inserted += await bulkInsertVehicles(validItems, { reindex: false });
            await markSeenIds(validItems.map(it => it._id));
            
            // Report progress
            const processed = Math.min(i + insertChunkSize, allData.length);
            const total = allData.length;
            const percentage = Math.round((processed / total) * 100);
            
            safeProgressCallback(onProgress, {
              processed: processed,
              total: total,
              percentage: percentage
            });
            
            console.log(`✅ Processed ${processed}/${total} records`);
            await maybeYield();
          }
        }
        
      } catch (bulkError) {
        console.log('⚠️ Bulk download failed, falling back to chunked approach:', bulkError.message);
      }
    }
    
    // If bulk download was skipped or failed, use chunked approach
    if (inserted === 0) {
      // Fallback to chunked approach with smaller chunks for large datasets
      const colKeys = ['two','four','comm'];
      const fallbackChunkSize = Math.min(CHUNK_SIZE, 4000); // larger chunk for speed
      
      for (const key of colKeys) {
        const total = parseInt(counts[key] || 0);
        if (total === 0) continue;
        
        console.log(`📦 Processing ${key.toUpperCase()}: ${total.toLocaleString()} records`);
        
        for (let skip = 0; skip < total; skip += fallbackChunkSize) {
          const chunkNumber = Math.floor(skip / fallbackChunkSize) + 1;
          const totalChunks = Math.ceil(total / fallbackChunkSize);
          
          try {
            const resp = await makeRequestWithRetry(() =>
              axios.get(`${getBaseURL()}/api/bulk-download/bulk-chunked`, {
                headers: { 
                  Authorization: `Bearer ${token}`,
                  'Accept-Encoding': 'gzip, deflate',
                  'Content-Type': 'application/json'
                },
                params: { 
                  collection: key, 
                  skip, 
                  limit: fallbackChunkSize,
                  compression: 'gzip',
                  // Ensure required searchable fields are included
                  fields: 'regNo,reg_no,chassisNo,chassis_no,loanNo,loan_no,bank,bank_name,make,manufacturer,customerName,customer_name,address,customer_address,vehicleType,vehicle_type,_id'
                },
                timeout: 180000, // 3 minutes per chunk
                maxContentLength: 50 * 1024 * 1024, // 50MB max per chunk
                maxBodyLength: 50 * 1024 * 1024
              })
            );
            
            const items = (resp.data?.data || []).filter(it => it && (it.regNo || it.chassisNo || it.reg_no || it.chassis_no));
            if (items.length === 0) {
              console.log(`⚠️ Empty chunk ${chunkNumber}, skipping`);
              continue;
            }
            try {
              const sampleKeys = Object.keys(items[0] || {});
              console.log(`🧪 Chunk ${chunkNumber} sample keys:`, sampleKeys.join(','));
            } catch (_) {}
            
            // Use smaller insert chunks for better stability
            const insertChunkSize = 2000;
            for (let i = 0; i < items.length; i += insertChunkSize) {
              const insertChunk = items.slice(i, i + insertChunkSize);
              inserted += await bulkInsertVehicles(insertChunk, { reindex: false });
              await markSeenIds(insertChunk.map(it => it._id));
              
              // Report progress
              const processed = Math.min(skip + i + insertChunkSize, total);
              safeProgressCallback(onProgress, {
                processed: processed,
                total: total,
                percentage: Math.round((processed / total) * 100)
              });
              await maybeYield();
            }
            
            console.log(`✅ Chunk ${chunkNumber}/${totalChunks}: ${items.length} records inserted`);
            
          } catch (error) {
            console.log(`❌ Chunk ${chunkNumber}/${totalChunks} failed: ${error.message}`);
            // Continue with next chunk instead of stopping
          }
        }
      }
    }

    console.log('🧹 Cleaning up...');
    await deleteNotSeen();
    await rebuildSearchIndex();

    const nowIso = new Date().toISOString();
    const metadata = {
      totalRecords: inserted,
      downloadedAt: nowIso,
      tenant,
      method: 'optimized_bulk'
    };
    await SecureStore.setItemAsync('offline_metadata', JSON.stringify(metadata));
    await SecureStore.setItemAsync('lastSyncTime', nowIso);
    
    console.log(`✅ Optimized sync completed: ${inserted.toLocaleString()} records inserted`);
    return { success: true, inserted };
  } catch (e) {
    console.log(`❌ Optimized sync failed: ${e.message}`);
    return { success: false, message: e?.message || 'sync failed' };
  }
};

// Legacy sync method for backward compatibility
export const runHeadlessOfflineSync = async () => {
  return await runOptimizedBulkDownload();
};

// Missing-only sync using ID listing and fetch-by-ids
export const runMissingOnlySync = async (onProgress = null) => {
  const token = await SecureStore.getItemAsync('token');
  if (!token) return { success: false, message: 'No token' };

  try {
    await initDatabase();
    await resetSeen();

    const statsRes = await makeRequestWithRetry(() =>
      axios.get(`${getBaseURL()}/api/bulk-download/bulk-stats`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 15000
      })
    );

    const counts = statsRes.data?.counts || {};
    const colKeys = ['two','four','comm'];
    let processed = 0;
    let total = Object.values(counts).reduce((s, c) => s + (parseInt(c)||0), 0);

    const emit = (p) => safeProgressCallback(onProgress, p);

    let PAGE = 15000; // adaptive page size
    let FETCH_CHUNK = 3000; // adaptive batch size

    for (const key of colKeys) {
      const totalCol = parseInt(counts[key] || 0);
      if (totalCol === 0) continue;

      for (let skip = 0; skip < totalCol; skip += PAGE) {
        // 1) list ids page
        let idsRes;
        try {
          idsRes = await makeRequestWithRetry(() =>
            axios.get(`${getBaseURL()}/api/bulk-download/bulk-ids`, {
              headers: { Authorization: `Bearer ${token}` },
              params: { collection: key, skip, limit: PAGE },
              timeout: 60000
            })
          );
        } catch (e) {
          // Shrink on failure
          PAGE = Math.max(2000, Math.floor(PAGE * 0.8));
          console.log(`🔧 Adjusting ids PAGE → ${PAGE}`);
          throw e;
        }
        const idList = idsRes.data?.ids || [];
        if (idList.length === 0) continue;

        // mark all as seen so deleteNotSeen preserves them
        await markSeenIds(idList);

        // compute missing set
        const existingSet = await getExistingIds(idList);
        const missingIds = idList.filter(id => !existingSet.has(String(id)));

        // fetch details for missing ids in chunks
        for (let i = 0; i < missingIds.length; i += FETCH_CHUNK) {
          const batch = missingIds.slice(i, i + FETCH_CHUNK);
          try {
            const dataRes = await makeRequestWithRetry(() =>
              axios.post(`${getBaseURL()}/api/bulk-download/by-ids`, {
                ids: batch,
                collection: key
              }, {
                headers: { Authorization: `Bearer ${token}` },
                timeout: 180000
              })
            );
            const items = dataRes.data?.data || [];
            if (items.length > 0) {
              await bulkInsertVehicles(items, { reindex: false });
            }
          } catch (e) {
            console.log('by-ids batch error:', e.message);
            FETCH_CHUNK = Math.max(500, Math.floor(FETCH_CHUNK * 0.8));
            console.log(`🔧 Adjusting by-ids batch → ${FETCH_CHUNK}`);
          }
          emit({ processed: Math.min(processed + skip + i + FETCH_CHUNK, total), total, percentage: Math.round(((processed + skip + i + FETCH_CHUNK) / total) * 100) });
          await new Promise(r => setTimeout(r, 0));
        }

        emit({ processed: Math.min(processed + skip + idList.length, total), total, percentage: Math.round(((processed + skip + idList.length) / total) * 100) });
        await new Promise(r => setTimeout(r, 0));
      }

      processed += totalCol;
    }

    await deleteNotSeen();
    await rebuildSearchIndex();

    const finalCount = await countVehicles();
    const seenCount = await countSeen();
    await SecureStore.setItemAsync('offline_metadata', JSON.stringify({ method: 'missing_only', downloadedAt: new Date().toISOString(), totalRecords: finalCount, seen: seenCount }));
    return { success: true, inserted: finalCount, seen: seenCount };
  } catch (e) {
    console.log('Missing-only sync failed:', e.message);
    return { success: false, message: e?.message || 'missing-only failed' };
  }
};