import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { getBaseURL } from './config';
import { bulkInsertVehicles, upsertFileMeta, getFileMeta, listFileMeta, markFileCompleted, resetSeen, markSeenIds, deleteNotSeen } from './db';

// Enhanced rate limiter with retry logic
class RateLimiter {
  constructor({ capacity = 2, refillIntervalMs = 1000 }) {
    this.capacity = capacity;
    this.tokens = capacity;
    this.queue = [];
    setInterval(() => this.refill(), refillIntervalMs);
  }
  refill() {
    this.tokens = this.capacity;
    this.drain();
  }
  drain() {
    while (this.tokens > 0 && this.queue.length > 0) {
      this.tokens--;
      const next = this.queue.shift();
      next();
    }
  }
  async schedule(fn) {
    return new Promise((resolve, reject) => {
      const run = async () => {
        try { resolve(await fn()); }
        catch (e) { reject(e); }
      };
      if (this.tokens > 0) {
        this.tokens--;
        run();
      } else {
        this.queue.push(run);
      }
    });
  }
}

// Retry helper with exponential backoff
const retryWithBackoff = async (fn, maxRetries = 3, baseDelay = 1000) => {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const isNetworkError = error.code === 'NETWORK_ERROR' || 
                           error.message?.includes('Network Error') ||
                           error.message?.includes('timeout') ||
                           error.response?.status >= 500;
      
      if (attempt === maxRetries || !isNetworkError) {
        throw error;
      }
      
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
      console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${Math.round(delay)}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw lastError;
};

const limiter = new RateLimiter({ capacity: 1, refillIntervalMs: 600 });

export const listAllFiles = async () => {
  const token = await SecureStore.getItemAsync('token');
  if (!token) return [];
  const headers = { Authorization: `Bearer ${token}` };
  const base = getBaseURL();
  const endpoints = [
    `${base}/api/tenant/data/two-wheeler`,
    `${base}/api/tenant/data/four-wheeler`,
    `${base}/api/tenant/data/cv`
  ];
  const files = [];
  for (const url of endpoints) {
    let page = 1;
    let pages = 1;
    do {
      const { data } = await limiter.schedule(() => retryWithBackoff(() => 
        axios.get(url, { headers, params: { page, limit: 50 }, timeout: 15000 })
      ));
      if (data?.success && Array.isArray(data.data)) {
        for (const row of data.data) {
          const fileName = row.fileName || row._id || '';
          if (!fileName) continue;
          let vehicleType = row.vehicleType || '';
          if (!vehicleType) {
            if (url.includes('two-wheeler')) vehicleType = 'TwoWheeler';
            else if (url.includes('four-wheeler')) vehicleType = 'FourWheeler';
            else if (url.includes('cv')) vehicleType = 'Commercial';
          }
          let uploadDate = row.uploadDate || null;
          if (uploadDate && typeof uploadDate === 'string' && !uploadDate.includes('T')) {
            try { uploadDate = new Date(uploadDate).toISOString(); } catch { uploadDate = null; }
          }
          files.push({
            fileName,
            bankName: row.bankName || '',
            vehicleType,
            total: row.total || row.processedRecords || 0,
            uploadDate
          });
          // Upsert meta for quick resume
          await upsertFileMeta(fileName, {
            vehicleType,
            bankName: row.bankName || '',
            total: row.total || row.processedRecords || 0,
            serverUploadDate: uploadDate
          });
        }
        pages = data.pagination?.pages || 1;
      }
      page += 1;
    } while (page <= pages);
  }
  // Deduplicate by fileName
  const map = new Map();
  for (const f of files) map.set(f.fileName, f);
  return Array.from(map.values());
};

export const downloadNextForFile = async (fileName, options = {}) => {
  const token = await SecureStore.getItemAsync('token');
  if (!token) throw new Error('No authentication token found');
  const headers = { Authorization: `Bearer ${token}` };
  const base = getBaseURL();

  // Ensure metadata row and resume info
  let meta = await upsertFileMeta(fileName, {});
  const currentDownloaded = parseInt(meta?.downloaded || 0);
  const total = parseInt(meta?.total || 0);
  const completed = !!meta?.completed;
  const lastOffset = parseInt(meta?.lastOffset || 0);

  if (completed || (total > 0 && currentDownloaded >= total)) {
    if (!meta?.completed) {
      await markFileCompleted(fileName);
    }
    return { fileName, downloaded: 0, inserted: 0, hasMore: false, total };
  }

  const limit = Math.max(1000, Math.min(50000, options.limit || 50000));
  const nextPage = Math.floor(lastOffset / limit) + 1;
  const id = encodeURIComponent(fileName);
  const { data } = await limiter.schedule(() => retryWithBackoff(() => 
    axios.get(`${base}/api/tenant/data/file/${id}`, {
      headers,
      params: { page: nextPage, limit },
      timeout: 45000
    }), 3, 2000
  ));
  if (!data?.success) throw new Error(data?.message || 'File page fetch failed');

  // Update meta with server-declared total if provided
  const serverTotal = data?.pagination?.total;
  meta = await upsertFileMeta(fileName, {
    total: typeof serverTotal === 'number' ? serverTotal : undefined,
    bankName: data?.uploadDetails?.bankName,
    vehicleType: data?.uploadDetails?.vehicleType,
    serverUploadDate: data?.uploadDetails?.uploadDate || meta?.serverUploadDate || null
  });

  const rows = Array.isArray(data?.data) ? data.data : [];
  if (rows.length === 0) {
    await markFileCompleted(fileName);
    return { fileName, downloaded: 0, inserted: 0, hasMore: false, total: meta?.total || 0 };
  }

  const inserted = await bulkInsertVehicles(rows, { chunkSize: 1500, reindex: false });
  const newDownloaded = currentDownloaded + rows.length;
  const newOffset = lastOffset + rows.length;
  await upsertFileMeta(fileName, {
    downloaded: newDownloaded,
    lastOffset: newOffset,
    localDownloadDate: new Date().toISOString()
  });

  const finalTotal = parseInt((meta?.total || serverTotal || 0));
  const stillHasMore = finalTotal > 0 ? newDownloaded < finalTotal : rows.length === limit;
  if (!stillHasMore) {
    await markFileCompleted(fileName);
  }
  return { fileName, downloaded: rows.length, inserted, hasMore: stillHasMore, total: finalTotal || newDownloaded };
};

export const singleClickPerFileSync = async (onProgress = null, limit = 50000) => {
  const files = await listAllFiles();
  const metas = await listFileMeta();
  const metaByName = new Map(metas.map(m => [m.fileName, m]));
  let processed = 0;
  let skipped = 0;
  let totalInserted = 0;
  let totalRecords = 0;

  // Calculate total records to download for progress tracking
  for (const f of files) {
    const meta = metaByName.get(f.fileName);
    if (!(meta?.completed && meta?.total && meta?.downloaded >= meta?.total)) {
      totalRecords += Math.min(limit, parseInt(f.total || 0));
    }
  }

  let downloadedRecords = 0;

  for (const f of files) {
    const meta = metaByName.get(f.fileName);
    if (meta?.completed && meta?.total && meta?.downloaded >= meta?.total) {
      skipped++;
      continue;
    }
    
    // Download only one batch (50k records) per file per sync
    const res = await downloadNextForFile(f.fileName, { limit });
    totalInserted += res.inserted;
    downloadedRecords += res.downloaded;
    
    if (onProgress) {
      try { 
        // Calculate percentage based on downloaded records vs total records
        const percentage = totalRecords > 0 ? Math.min(99, Math.round((downloadedRecords / totalRecords) * 100)) : 0;
        
        onProgress({ 
          processedFiles: processed, 
          totalFiles: files.length, 
          inserted: totalInserted, 
          downloadedRecords: downloadedRecords,
          totalRecords: totalRecords,
          percentage: percentage,
          currentFile: f.fileName
        }); 
      } catch (_) {}
    }
    
    processed++;
  }
  
  return { 
    success: true, 
    filesProcessed: processed, 
    filesSkipped: skipped, 
    totalFiles: files.length, 
    totalInserted
  };
};


export const debugFileComparison = async () => { return; };

export const getPerFileSyncStatus = async () => {
  const files = await listAllFiles();
  const metas = await listFileMeta();
  const byName = new Map(metas.map(m => [m.fileName, m]));
  let totalServer = 0;
  let totalLocal = 0;
  for (const f of files) {
    totalServer += parseInt(f.total || 0);
    const m = byName.get(f.fileName);
    if (m) totalLocal += parseInt(m.downloaded || 0);
  }
  const anyIncomplete = files.some(f => {
    const m = byName.get(f.fileName);
    return !(m && m.completed && m.total && m.downloaded >= m.total);
  });
  return {
    anyIncomplete,
    totalServer,
    totalLocal,
    serverFileCount: files.length,
    localFileCount: metas.length,
    cleanupResult: { deletedFiles: 0, deletedRecords: 0 }
  };
};

// --- New: Direct chunk-based download avoiding file listing ---
export const downloadAllViaChunks = async (onProgress = null, limit = 50000, options = {}) => {
  const token = await SecureStore.getItemAsync('token');
  if (!token) throw new Error('No authentication token found');
  const headers = { Authorization: `Bearer ${token}` };
  const base = getBaseURL();

  const cols = ['two', 'four', 'comm'];
  let totalInserted = 0;
  let processed = 0;
  let currentCol = '';
  const pageLimit = Math.max(1000, Math.min(50000, limit || 50000));

  const mirror = options?.mirror === true;
  if (mirror) {
    try { await resetSeen(); } catch (_) {}
  }

  // Try to fetch total record counts for better progress reporting
  let totalRecords = 0;
  try {
    const { data: stats } = await axios.get(`${base}/api/tenant/data/offline-stats`, { headers, timeout: 15000 });
    if (stats?.success) {
      const counts = stats?.counts || {};
      // counts may be an object with values per collection; sum all numeric values
      totalRecords = Object.values(counts).reduce((acc, v) => acc + (typeof v === 'number' ? v : 0), 0);
    }
  } catch (_) {}

  for (const col of cols) {
    currentCol = col;
    let skip = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data } = await limiter.schedule(() => retryWithBackoff(() =>
        axios.get(`${base}/api/tenant/data/offline-chunk`, {
          headers,
          params: { col, skip, limit: pageLimit },
          timeout: 45000
        }), 3, 1500
      ));
      if (!data?.success) throw new Error(data?.message || 'Chunk fetch failed');
      const rows = Array.isArray(data?.data) ? data.data : [];
      if (rows.length === 0) break;
      const inserted = await bulkInsertVehicles(rows, { chunkSize: 1500, reindex: false });
      totalInserted += inserted;
      processed += rows.length;
      if (mirror) {
        try {
          const ids = rows.map(r => r?._id).filter(Boolean);
          await markSeenIds(ids);
        } catch (_) {}
      }
      skip += rows.length;
      if (onProgress) {
        try {
          const pct = totalRecords > 0 ? Math.min(99, Math.round((processed / totalRecords) * 100)) : 0;
          onProgress({ inserted: totalInserted, downloadedRecords: processed, totalRecords, percentage: pct, currentFile: `col:${currentCol} skip:${skip}` });
        } catch (_) {}
      }
      if (rows.length < pageLimit) break;
    }
  }

  if (mirror) {
    try {
      await deleteNotSeen();
    } catch (_) {}
  }

  if (onProgress) {
    try { onProgress({ inserted: totalInserted, downloadedRecords: processed, totalRecords, percentage: 100, currentFile: '' }); } catch (_) {}
  }

  return { success: true, inserted: totalInserted };
};