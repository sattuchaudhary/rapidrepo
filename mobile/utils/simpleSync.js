import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { getBaseURL } from './config';
import { initDatabase, bulkInsertVehicles, clearVehicles, countVehicles } from './db';

// Simple sync configuration
const SIMPLE_SYNC_CONFIG = {
  maxRecordsPerBatch: 100000, // 1 lakh records per batch for first time sync
  timeout: 600000, // 10 minutes per batch (increased for larger batches)
  delayBetweenBatches: 1000, // 1 second delay between batches
  maxRetries: 3
};

// Simple download and convert function
export const downloadAndConvert = async (offset = 0, onProgress = null) => {
  try {
    const token = await SecureStore.getItemAsync('token');
    if (!token) {
      throw new Error('No authentication token found');
    }

    console.log(`📥 Downloading batch starting from offset ${offset}`);
    
    const response = await axios.get(`${getBaseURL()}/api/bulk-download/simple-dump`, {
      headers: { 
        Authorization: `Bearer ${token}`,
        'Accept-Encoding': 'gzip, deflate'
      },
      params: { 
        limit: SIMPLE_SYNC_CONFIG.maxRecordsPerBatch, 
        offset 
      },
      timeout: SIMPLE_SYNC_CONFIG.timeout
    });
    
    if (!response.data.success) {
      throw new Error(response.data.message || 'Download failed');
    }
    
    const { data, totalRecords, hasMore, nextOffset, currentBatch } = response.data;
    
    console.log(`📦 Downloaded ${currentBatch} records from server`);
    
    // Convert JSON to SQLite
    const inserted = await convertJsonToSqlite(data, offset === 0);
    
    // Update progress
    if (onProgress) {
      onProgress({
        processed: offset + currentBatch,
        total: totalRecords,
        percentage: Math.round(((offset + currentBatch) / totalRecords) * 100),
        currentBatch,
        inserted
      });
    }
    
    return {
      success: true,
      downloaded: currentBatch,
      inserted,
      totalRecords,
      hasMore,
      nextOffset
    };
  } catch (error) {
    console.error('Download and convert failed:', error);
    throw new Error(`Download failed: ${error.message}`);
  }
};

// Convert JSON array to SQLite
const convertJsonToSqlite = async (jsonData, isFirstBatch = false) => {
  try {
    console.log(`🔄 Starting JSON to SQLite conversion: ${jsonData.length} records`);
    
    // Initialize database
    await initDatabase();
    console.log('✅ Database initialized');
    
    // Clear existing data if this is first batch
    if (isFirstBatch && jsonData.length > 0) {
      console.log('🧹 Clearing existing data for fresh sync');
      await clearVehicles();
      console.log('✅ Existing data cleared');
    }
    
    // Check current count before insertion
    const countBefore = await countVehicles();
    console.log(`📊 Records before insertion: ${countBefore}`);
    
    // Insert new data
    const inserted = await bulkInsertVehicles(jsonData, {
      chunkSize: 2000, // Smaller chunks for better performance
      reindex: true
    });
    
    // Check count after insertion
    const countAfter = await countVehicles();
    console.log(`📊 Records after insertion: ${countAfter}`);
    console.log(`✅ Converted ${inserted} records to SQLite`);
    
    // Verify insertion
    if (inserted !== jsonData.length) {
      console.warn(`⚠️ Insertion mismatch: expected ${jsonData.length}, got ${inserted}`);
    }
    
    return inserted;
  } catch (error) {
    console.error('JSON to SQLite conversion failed:', error);
    throw new Error(`Database conversion failed: ${error.message}`);
  }
};

// Auto cleanup function - removes extra records not present on server
export const autoCleanup = async () => {
  try {
    console.log('🧹 Starting auto cleanup...');
    
    const token = await SecureStore.getItemAsync('token');
    if (!token) {
      console.log('No token for cleanup, skipping');
      return 0;
    }

    // Get latest server data (first batch only for ID comparison)
    const response = await axios.get(`${getBaseURL()}/api/bulk-download/simple-dump`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { limit: 100000, offset: 0 },
      timeout: 60000 // 1 minute timeout for cleanup
    });
    
    if (!response.data.success) {
      console.log('Failed to get server data for cleanup');
      return 0;
    }
    
    const serverIds = new Set(response.data.data.map(item => String(item._id)));
    console.log(`📊 Server has ${serverIds.size} records`);
    
    // Get local count
    const localCount = await countVehicles();
    console.log(`📱 Local has ${localCount} records`);
    
    // For now, we'll do a simple approach:
    // If local count is significantly more than server, clear and resync
    if (localCount > serverIds.size * 1.1) { // 10% tolerance
      console.log('🧹 Local data seems outdated, clearing for fresh sync');
      await clearVehicles();
      return localCount;
    }
    
    console.log('✅ No cleanup needed');
    return 0;
  } catch (error) {
    console.error('Auto cleanup failed:', error);
    return 0;
  }
};

// Single batch sync function - downloads only one batch at a time
export const singleBatchSync = async (offset = 0, onProgress = null) => {
  try {
    console.log(`🚀 Starting single batch sync from offset ${offset}...`);
    
    const result = await downloadAndConvert(offset, onProgress);
    
    console.log(`✅ Batch completed: ${result.downloaded} downloaded, ${result.inserted} inserted`);
    
    return {
      success: true,
      downloaded: result.downloaded,
      inserted: result.inserted,
      hasMore: result.hasMore,
      nextOffset: result.nextOffset,
      totalRecords: result.totalRecords,
      currentOffset: offset
    };
    
  } catch (error) {
    console.error('Single batch sync failed:', error);
    throw new Error(`Single batch sync failed: ${error.message}`);
  }
};

// Complete simple sync function - for full sync (kept for backward compatibility)
export const simpleSync = async (onProgress = null) => {
  try {
    console.log('🚀 Starting simple sync...');
    
    let offset = 0;
    let totalDownloaded = 0;
    let totalInserted = 0;
    let hasMore = true;
    let batchNumber = 1;
    
    while (hasMore) {
      console.log(`📥 Batch ${batchNumber}: Downloading from offset ${offset}`);
      
      try {
        const result = await downloadAndConvert(offset, onProgress);
        
        totalDownloaded += result.downloaded;
        totalInserted += result.inserted;
        hasMore = result.hasMore;
        offset = result.nextOffset;
        batchNumber++;
        
        console.log(`✅ Batch ${batchNumber - 1} completed: ${result.downloaded} downloaded, ${result.inserted} inserted`);
        
        // Small delay between batches to prevent overwhelming
        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, SIMPLE_SYNC_CONFIG.delayBetweenBatches));
        }
      } catch (error) {
        console.error(`Batch ${batchNumber} failed:`, error);
        throw error;
      }
    }
    
    // Auto cleanup after all downloads
    const cleaned = await autoCleanup();
    
    const finalResult = {
      success: true,
      totalDownloaded,
      totalInserted,
      batchesProcessed: batchNumber - 1,
      extraRecordsCleaned: cleaned
    };
    
    console.log('🎉 Simple sync completed:', finalResult);
    return finalResult;
    
  } catch (error) {
    console.error('Simple sync failed:', error);
    throw new Error(`Simple sync failed: ${error.message}`);
  }
};

// Check if sync is needed (compare local vs server count)
export const isSyncNeeded = async () => {
  try {
    const token = await SecureStore.getItemAsync('token');
    if (!token) return false;
    
    // Get server count
    const response = await axios.get(`${getBaseURL()}/api/bulk-download/simple-dump`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { limit: 1, offset: 0 }, // Just get metadata
      timeout: 30000
    });
    
    if (!response.data.success) return false;
    
    const serverTotal = response.data.totalRecords;
    const localCount = await countVehicles();
    
    // Sync if difference is more than 1 record
    const difference = Math.abs(serverTotal - localCount);
    
    return difference > 1;
  } catch (error) {
    console.error('Sync check failed:', error);
    return false;
  }
};

// Get sync status
export const getSyncStatus = async () => {
  try {
    const localCount = await countVehicles();
    const needsSync = await isSyncNeeded();
    
    return {
      localCount,
      needsSync,
      lastSync: await SecureStore.getItemAsync('last_simple_sync')
    };
  } catch (error) {
    console.error('Get sync status failed:', error);
    return {
      localCount: 0,
      needsSync: false,
      lastSync: null
    };
  }
};

// Mark sync as completed
export const markSyncCompleted = async () => {
  try {
    await SecureStore.setItemAsync('last_simple_sync', new Date().toISOString());
  } catch (error) {
    console.error('Failed to mark sync completed:', error);
  }
};
