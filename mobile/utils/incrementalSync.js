import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { getBaseURL } from './config';
import { initDatabase, bulkInsertVehicles, countVehicles } from './db';

// Incremental sync configuration
const INCREMENTAL_SYNC_CONFIG = {
  maxRecordsPerBatch: 100000, // 1 lakh records per batch for first time sync
  timeout: 600000, // 10 minutes per batch (increased for larger batches)
  delayBetweenBatches: 1000, // 1 second delay between batches
  maxRetries: 3
};

// Get last sync timestamp
export const getLastSyncTimestamp = async () => {
  try {
    const timestamp = await SecureStore.getItemAsync('last_sync_timestamp');
    return timestamp ? new Date(timestamp) : null;
  } catch (error) {
    console.error('Error getting last sync timestamp:', error);
    return null;
  }
};

// Set last sync timestamp
export const setLastSyncTimestamp = async (timestamp = new Date()) => {
  try {
    await SecureStore.setItemAsync('last_sync_timestamp', timestamp.toISOString());
  } catch (error) {
    console.error('Error setting last sync timestamp:', error);
  }
};

// Check if incremental sync is needed
export const isIncrementalSyncNeeded = async () => {
  try {
    const token = await SecureStore.getItemAsync('token');
    if (!token) return false;
    
    // Get server count
    const response = await axios.get(`${getBaseURL()}/api/bulk-download/simple-dump`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { limit: 1, offset: 0 },
      timeout: 30000
    });
    
    if (!response.data.success) return false;
    
    const serverTotal = response.data.totalRecords;
    const localCount = await countVehicles();
    
    // If difference is more than 1 record, sync needed
    const difference = Math.abs(serverTotal - localCount);
    
    return difference > 1;
  } catch (error) {
    console.error('Incremental sync check failed:', error);
    return false;
  }
};

// Get new records since last sync
export const getNewRecordsSince = async (sinceTimestamp, onProgress = null) => {
  try {
    const token = await SecureStore.getItemAsync('token');
    if (!token) {
      throw new Error('No authentication token found');
    }

    console.log(`📥 Getting new records since ${sinceTimestamp.toISOString()}`);
    
    // Get new records from server
    const response = await axios.get(`${getBaseURL()}/api/bulk-download/new-records`, {
      headers: { 
        Authorization: `Bearer ${token}`,
        'Accept-Encoding': 'gzip, deflate'
      },
      params: { 
        since: sinceTimestamp.toISOString(),
        limit: INCREMENTAL_SYNC_CONFIG.maxRecordsPerBatch
      },
      timeout: INCREMENTAL_SYNC_CONFIG.timeout
    });
    
    if (!response.data.success) {
      throw new Error(response.data.message || 'Failed to get new records');
    }
    
    const { data, totalNewRecords, hasMore, nextOffset } = response.data;
    
    console.log(`📦 Found ${totalNewRecords} new records`);
    
    // Convert and insert new records
    const inserted = await convertAndInsertNewRecords(data);
    
    // Update progress
    if (onProgress) {
      onProgress({
        processed: data.length,
        total: totalNewRecords,
        percentage: Math.round((data.length / totalNewRecords) * 100),
        newRecords: data.length,
        inserted
      });
    }
    
    return {
      success: true,
      newRecords: data.length,
      inserted,
      totalNewRecords,
      hasMore,
      nextOffset
    };
  } catch (error) {
    console.error('Get new records failed:', error);
    throw new Error(`Failed to get new records: ${error.message}`);
  }
};

// Convert and insert new records
const convertAndInsertNewRecords = async (jsonData) => {
  try {
    await initDatabase();
    
    // Insert new data (no need to clear existing)
    const inserted = await bulkInsertVehicles(jsonData, {
      chunkSize: 2000,
      reindex: true
    });
    
    console.log(`✅ Inserted ${inserted} new records`);
    return inserted;
  } catch (error) {
    console.error('New records conversion failed:', error);
    throw new Error(`Failed to insert new records: ${error.message}`);
  }
};

// Incremental sync function
export const incrementalSync = async (onProgress = null) => {
  try {
    console.log('🚀 Starting incremental sync...');
    
    const lastSync = await getLastSyncTimestamp();
    if (!lastSync) {
      console.log('No previous sync found, performing full sync');
      return { success: false, message: 'No previous sync found' };
    }
    
    const result = await getNewRecordsSince(lastSync, onProgress);
    
    if (result.success) {
      const finalResult = {
        success: true,
        newRecordsFound: result.totalNewRecords,
        newRecordsInserted: result.inserted,
        lastSyncTime: lastSync.toISOString(),
        syncType: 'incremental'
      };
      
      console.log('🎉 Incremental sync completed:', finalResult);
      return finalResult;
    }
    
    return result;
  } catch (error) {
    console.error('Incremental sync failed:', error);
    throw new Error(`Incremental sync failed: ${error.message}`);
  }
};

// Smart sync - chooses between incremental and full sync
export const smartSync = async (onProgress = null) => {
  try {
    console.log('🧠 Starting smart sync...');
    
    // Check if incremental sync is possible
    const lastSync = await getLastSyncTimestamp();
    const needsSync = await isIncrementalSyncNeeded();
    
    if (!needsSync) {
      console.log('✅ No sync needed');
      return { success: true, message: 'No sync needed', syncType: 'none' };
    }
    
    if (lastSync) {
      console.log('📈 Performing incremental sync');
      const result = await incrementalSync(onProgress);
      if (result.success) {
        // Update timestamp after successful incremental sync
        await setLastSyncTimestamp();
      }
      return result;
    } else {
      console.log('📥 Performing full sync (no previous sync found)');
      // Import full sync function
      const { simpleSync } = await import('./simpleSync');
      const result = await simpleSync(onProgress);
      if (result.success) {
        await setLastSyncTimestamp();
        result.syncType = 'full';
      }
      return result;
    }
  } catch (error) {
    console.error('Smart sync failed:', error);
    throw new Error(`Smart sync failed: ${error.message}`);
  }
};

// Get sync status
export const getIncrementalSyncStatus = async () => {
  try {
    const lastSync = await getLastSyncTimestamp();
    const localCount = await countVehicles();
    const needsSync = await isIncrementalSyncNeeded();
    
    return {
      lastSync,
      localCount,
      needsSync,
      syncType: lastSync ? 'incremental' : 'full'
    };
  } catch (error) {
    console.error('Get incremental sync status failed:', error);
    return {
      lastSync: null,
      localCount: 0,
      needsSync: false,
      syncType: 'full'
    };
  }
};
