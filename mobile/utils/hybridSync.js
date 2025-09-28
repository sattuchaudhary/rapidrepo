import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system';
import axios from 'axios';
import { getBaseURL } from './config';
import { initDatabase, bulkInsertVehicles, clearVehicles, countVehicles } from './db';

// Simple sync configuration (SQLite only)
const SIMPLE_SYNC_CONFIG = {
  maxRecordsPerBatch: 100000, // 1 lakh records per batch
  timeout: 600000, // 10 minutes per batch
  delayBetweenBatches: 1000, // 1 second delay
  maxRetries: 3,
  saveJsonFiles: false, // Don't save JSON files
  convertToSqlite: true // Convert to SQLite for search
};

// Offset management functions
const getCurrentOffset = async () => {
  try {
    const offset = await SecureStore.getItemAsync('sync_offset');
    return offset ? parseInt(offset) : 0;
  } catch (error) {
    console.error('Error getting current offset:', error);
    return 0;
  }
};

const setCurrentOffset = async (offset) => {
  try {
    await SecureStore.setItemAsync('sync_offset', offset.toString());
    console.log(`📝 Updated sync offset to: ${offset}`);
  } catch (error) {
    console.error('Error setting current offset:', error);
  }
};

const resetSyncOffset = async () => {
  try {
    await SecureStore.deleteItemAsync('sync_offset');
    console.log('🔄 Reset sync offset to 0');
  } catch (error) {
    console.error('Error resetting sync offset:', error);
  }
};

// Download JSON data and save to file
export const downloadAndSaveJson = async (offset = 0, batchNumber = 1) => {
  try {
    const token = await SecureStore.getItemAsync('token');
    if (!token) {
      throw new Error('No authentication token found');
    }

    console.log(`📥 Downloading batch ${batchNumber} starting from offset ${offset}`);
    
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
    
    const { data, totalRecords, hasMore, nextOffset, currentBatch, tenant } = response.data;
    
    console.log(`📦 Downloaded ${currentBatch} records from server`);
    
    // Skip JSON file saving - direct SQLite conversion only
    
    return {
      success: true,
      data,
      downloaded: currentBatch,
      totalRecords,
      hasMore,
      nextOffset,
      batchNumber
    };
  } catch (error) {
    console.error('Download and save JSON failed:', error);
    throw new Error(`Download failed: ${error.message}`);
  }
};

// Convert JSON data to SQLite
export const convertJsonToSqlite = async (jsonData, isFirstBatch = false) => {
  try {
    console.log(`🔄 Converting ${jsonData.length} records to SQLite`);
    
    // Debug: Check sample data
    if (jsonData.length > 0) {
      console.log('🔍 Sample record:', JSON.stringify(jsonData[0], null, 2));
    }
    
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
    
    // Insert new data with detailed logging
    console.log('📝 Starting bulk insert...');
    const inserted = await bulkInsertVehicles(jsonData, {
      chunkSize: 1000, // Smaller chunks for better debugging
      reindex: true
    });
    console.log('📝 Bulk insert completed');
    
    // Check count after insertion
    const countAfter = await countVehicles();
    console.log(`📊 Records after insertion: ${countAfter}`);
    console.log(`✅ Converted ${inserted} records to SQLite`);
    
    // Verify insertion
    if (inserted !== jsonData.length) {
      console.warn(`⚠️ Insertion mismatch: expected ${jsonData.length}, got ${inserted}`);
    }
    
    // Additional verification
    if (countAfter <= countBefore) {
      console.error(`❌ Database count did not increase! Before: ${countBefore}, After: ${countAfter}`);
    }
    
    return inserted;
  } catch (error) {
    console.error('JSON to SQLite conversion failed:', error);
    console.error('Error details:', error.stack);
    throw new Error(`Database conversion failed: ${error.message}`);
  }
};

// Load JSON from file and convert to SQLite
export const loadJsonFromFileAndConvert = async (filePath) => {
  try {
    console.log(`📂 Loading JSON from file: ${filePath}`);
    
    // Check if file exists
    const fileInfo = await FileSystem.getInfoAsync(filePath);
    if (!fileInfo.exists) {
      throw new Error('JSON file does not exist');
    }
    
    // Read JSON file
    const jsonString = await FileSystem.readAsStringAsync(filePath);
    const jsonData = JSON.parse(jsonString);
    
    console.log(`📦 Loaded ${jsonData.data.length} records from JSON file`);
    
    // Convert to SQLite
    const inserted = await convertJsonToSqlite(jsonData.data, false);
    
    return {
      success: true,
      inserted,
      totalRecords: jsonData.data.length,
      batchNumber: jsonData.batchNumber,
      downloadedAt: jsonData.downloadedAt
    };
  } catch (error) {
    console.error('Load JSON from file failed:', error);
    throw new Error(`Failed to load JSON file: ${error.message}`);
  }
};

// Single batch sync (1 lakh records per click)
export const singleBatchSync = async (onProgress = null) => {
  try {
    console.log('🚀 Starting single batch sync (1 lakh records)...');
    
    // Get current offset from stored metadata
    const currentOffset = await getCurrentOffset();
    const batchNumber = Math.floor(currentOffset / SIMPLE_SYNC_CONFIG.maxRecordsPerBatch) + 1;
    
    console.log(`📥 Batch ${batchNumber}: Downloading from offset ${currentOffset}`);
    
    // Download single batch
    const downloadResult = await downloadAndSaveJson(currentOffset, batchNumber);
    
    let totalInserted = 0;
    
    // Convert to SQLite
    if (SIMPLE_SYNC_CONFIG.convertToSqlite && downloadResult.data.length > 0) {
      const inserted = await convertJsonToSqlite(downloadResult.data, currentOffset === 0);
      totalInserted += inserted;
    }
    
    // Update stored offset for next batch
    await setCurrentOffset(downloadResult.nextOffset);
    
    // Update progress
    if (onProgress) {
      onProgress({
        processed: downloadResult.downloaded,
        currentBatch: downloadResult.downloaded,
        batchNumber,
        percentage: 100,
        hasMore: downloadResult.hasMore
      });
    }
    
    console.log(`✅ Batch ${batchNumber} completed: ${downloadResult.downloaded} downloaded, ${totalInserted} inserted`);
    
    const finalResult = {
      success: true,
      totalDownloaded: downloadResult.downloaded,
      totalInserted,
      batchesProcessed: 1,
      hasMore: downloadResult.hasMore,
      nextOffset: downloadResult.nextOffset,
      syncType: 'single_batch'
    };
    
    console.log('🎉 Single batch sync completed:', finalResult);
    return finalResult;
    
  } catch (error) {
    console.error('Single batch sync failed:', error);
    throw new Error(`Single batch sync failed: ${error.message}`);
  }
};

// Complete hybrid sync (download JSON + convert to SQLite)
export const hybridSync = async (onProgress = null) => {
  try {
    console.log('🚀 Starting hybrid sync (JSON + SQLite)...');
    
    let offset = 0;
    let totalDownloaded = 0;
    let totalInserted = 0;
    let hasMore = true;
    let batchNumber = 1;
    const savedFiles = [];
    
    while (hasMore) {
      console.log(`📥 Batch ${batchNumber}: Downloading from offset ${offset}`);
      
      try {
        // Download and save JSON
        const downloadResult = await downloadAndSaveJson(offset, batchNumber);
        
        totalDownloaded += downloadResult.downloaded;
        hasMore = downloadResult.hasMore;
        offset = downloadResult.nextOffset;
        
        // Convert to SQLite
        if (SIMPLE_SYNC_CONFIG.convertToSqlite && downloadResult.data.length > 0) {
          const inserted = await convertJsonToSqlite(downloadResult.data, batchNumber === 1);
          totalInserted += inserted;
        }
        
        // Update progress
        if (onProgress) {
          onProgress({
            processed: totalDownloaded,
            total: downloadResult.totalRecords,
            percentage: Math.round((totalDownloaded / downloadResult.totalRecords) * 100),
            currentBatch: downloadResult.downloaded,
            inserted: totalInserted,
            batchNumber
          });
        }
        
        console.log(`✅ Batch ${batchNumber} completed: ${downloadResult.downloaded} downloaded, ${totalInserted} inserted`);
        
        // Small delay between batches
        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, SIMPLE_SYNC_CONFIG.delayBetweenBatches));
        }
        
        batchNumber++;
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
      extraRecordsCleaned: cleaned,
      syncType: 'simple'
    };
    
    console.log('🎉 Simple sync completed:', finalResult);
    return finalResult;
    
  } catch (error) {
    console.error('Simple sync failed:', error);
    throw new Error(`Simple sync failed: ${error.message}`);
  }
};

// Reset sync progress (start from beginning)
export const resetSyncProgress = async () => {
  try {
    await resetSyncOffset();
    console.log('🔄 Sync progress reset - next sync will start from beginning');
    return { success: true };
  } catch (error) {
    console.error('Error resetting sync progress:', error);
    return { success: false, error: error.message };
  }
};

// Auto cleanup function
const autoCleanup = async () => {
  try {
    console.log('🧹 Starting auto cleanup...');
    
    const token = await SecureStore.getItemAsync('token');
    if (!token) {
      console.log('No token for cleanup, skipping');
      return 0;
    }

    // Get latest server data for cleanup
    const response = await axios.get(`${getBaseURL()}/api/bulk-download/simple-dump`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { limit: 50000, offset: 0 },
      timeout: 60000
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
    
    // Simple cleanup approach
    if (localCount > serverIds.size * 1.1) {
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

// List all saved JSON files
export const listSavedJsonFiles = async () => {
  try {
    const files = await FileSystem.readDirectoryAsync(FileSystem.documentDirectory);
    const jsonFiles = files.filter(file => file.endsWith('.json'));
    
    const fileDetails = await Promise.all(
      jsonFiles.map(async (file) => {
        const filePath = `${FileSystem.documentDirectory}${file}`;
        const fileInfo = await FileSystem.getInfoAsync(filePath);
        return {
          name: file,
          path: filePath,
          size: fileInfo.size,
          modificationTime: fileInfo.modificationTime
        };
      })
    );
    
    return fileDetails;
  } catch (error) {
    console.error('Error listing JSON files:', error);
    return [];
  }
};

// Delete old JSON files (keep only recent ones)
export const cleanupOldJsonFiles = async (keepRecent = 5) => {
  try {
    const files = await listSavedJsonFiles();
    
    // Sort by modification time (newest first)
    files.sort((a, b) => b.modificationTime - a.modificationTime);
    
    // Delete old files
    const filesToDelete = files.slice(keepRecent);
    let deletedCount = 0;
    
    for (const file of filesToDelete) {
      try {
        await FileSystem.deleteAsync(file.path);
        deletedCount++;
        console.log(`🗑️ Deleted old JSON file: ${file.name}`);
      } catch (error) {
        console.error(`Failed to delete ${file.name}:`, error);
      }
    }
    
    console.log(`🧹 Cleaned up ${deletedCount} old JSON files`);
    return deletedCount;
  } catch (error) {
    console.error('Error cleaning up JSON files:', error);
    return 0;
  }
};
