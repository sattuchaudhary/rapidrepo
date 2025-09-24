import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, TextInput, FlatList, Image, Modal, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';


import * as SQLite from 'expo-sqlite';
import axios from 'axios';
import { getBaseURL } from '../utils/config';
import * as FileSystem from 'expo-file-system/legacy';
// removed: background task imports not needed on simplified dashboard



// Smart Download Manager Class
class SmartDownloadManager {
  constructor() {
    this.isDownloading = false;
    this.downloadStats = {
      totalRecords: 0,
      downloadedRecords: 0,
      failedChunks: 0,
      retryCount: 0,
      startTime: null,
      avgSpeed: 0
    };
    this.adaptiveConfig = {
      baseChunkSize: 1000,
      currentChunkSize: 1000,
      maxChunkSize: 5000,
      minChunkSize: 100,
      delayBetweenChunks: 500,
      maxRetries: 3,
      backoffMultiplier: 2,
      concurrency: 1
    };
  }

  adaptChunkSize(success, responseTime, errorType = null) {
    const config = this.adaptiveConfig;
    
    if (success && responseTime < 2000) {
      config.currentChunkSize = Math.min(
        config.maxChunkSize,
        Math.floor(config.currentChunkSize * 1.2)
      );
      config.delayBetweenChunks = Math.max(200, config.delayBetweenChunks * 0.9);
    } else if (errorType === 429 || responseTime > 10000) {
      config.currentChunkSize = Math.max(
        config.minChunkSize,
        Math.floor(config.currentChunkSize * 0.5)
      );
      config.delayBetweenChunks = Math.min(10000, config.delayBetweenChunks * 2);
    } else if (!success) {
      config.currentChunkSize = Math.max(
        config.minChunkSize,
        Math.floor(config.currentChunkSize * 0.8)
      );
      config.delayBetweenChunks = Math.min(5000, config.delayBetweenChunks * 1.5);
    }

    console.log(`Adapted chunk size: ${config.currentChunkSize}, delay: ${config.delayBetweenChunks}ms`);
  }

  selectOptimalStrategy(totalRecords) {
    if (totalRecords > 10000000) {
      this.adaptiveConfig = {
        ...this.adaptiveConfig,
        baseChunkSize: 2000,
        currentChunkSize: 2000,
        maxChunkSize: 5000,
        delayBetweenChunks: 300,
        concurrency: 3
      };
      return 'ultra_parallel';
    } else if (totalRecords > 5000000) {
      this.adaptiveConfig = {
        ...this.adaptiveConfig,
        baseChunkSize: 1500,
        currentChunkSize: 1500,
        maxChunkSize: 3000,
        delayBetweenChunks: 500,
        concurrency: 2
      };
      return 'balanced_parallel';
    } else if (totalRecords > 1000000) {
      this.adaptiveConfig = {
        ...this.adaptiveConfig,
        baseChunkSize: 1000,
        currentChunkSize: 1000,
        maxChunkSize: 2000,
        delayBetweenChunks: 800,
        concurrency: 2
      };
      return 'conservative_parallel';
    } else {
      this.adaptiveConfig = {
        ...this.adaptiveConfig,
        baseChunkSize: 2000,
        currentChunkSize: 2000,
        maxChunkSize: 5000,
        delayBetweenChunks: 200,
        concurrency: 1
      };
      return 'sequential_fast';
    }
  }

  async downloadWithAdaptiveStrategy(token, getBaseURL, onProgress) {
    if (this.isDownloading) return { success: false, message: 'Already downloading' };
    
    this.isDownloading = true;
    this.downloadStats.startTime = Date.now();
    
    try {
      const statsRes = await axios.get(`${getBaseURL()}/api/tenant/data/offline-stats`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 15000
      });

      const counts = statsRes.data?.counts || {};
      const collections = ['two', 'four', 'comm'];
      const totalRecords = collections.reduce((sum, k) => sum + parseInt(counts[k] || 0), 0);
      
      this.downloadStats.totalRecords = totalRecords;
      
      if (totalRecords === 0) {
        return { success: false, message: 'No data available' };
      }

      onProgress({
        phase: 'initializing',
        totalRecords,
        downloadedRecords: 0,
        percentage: 0,
        message: `Preparing to download ${totalRecords.toLocaleString()} records...`
      });

      let strategy = this.selectOptimalStrategy(totalRecords);
      console.log(`Selected strategy: ${strategy} for ${totalRecords.toLocaleString()} records`);

      const allData = [];
      let globalProgress = 0;

      for (const collection of collections) {
        const collectionCount = parseInt(counts[collection] || 0);
        if (collectionCount === 0) continue;

        console.log(`Processing ${collection}: ${collectionCount.toLocaleString()} records`);
        
        const collectionData = await this.downloadCollection(
          collection,
          collectionCount,
          token,
          getBaseURL,
          strategy,
          (collectionProgress) => {
            const totalProgress = globalProgress + (collectionProgress.percentage * collectionCount / totalRecords);
            onProgress({
              phase: 'downloading',
              collection,
              totalRecords,
              downloadedRecords: this.downloadStats.downloadedRecords,
              percentage: totalProgress,
              message: `Downloading ${collection}: ${collectionProgress.current}/${collectionProgress.total}`,
              speed: this.calculateSpeed()
            });
          }
        );

        allData.push(...collectionData);
        globalProgress += (collectionCount / totalRecords) * 100;
        this.downloadStats.downloadedRecords += collectionData.length;
      }

      onProgress({
        phase: 'storing',
        percentage: 95,
        message: 'Storing data locally...'
      });

      return { 
        success: true, 
        data: allData,
        stats: this.downloadStats 
      };

    } catch (error) {
      console.error('Download failed:', error);
      return { 
        success: false, 
        message: error.message,
        stats: this.downloadStats 
      };
    } finally {
      this.isDownloading = false;
    }
  }

  async downloadCollection(collection, totalCount, token, getBaseURL, strategy, onProgress) {
    const config = this.adaptiveConfig;
    const allData = [];
    let consecutiveErrors = 0;
    const maxConsecutiveErrors = 10;

    const chunks = [];
    for (let skip = 0; skip < totalCount; skip += config.currentChunkSize) {
      chunks.push({
        skip,
        limit: Math.min(config.currentChunkSize, totalCount - skip)
      });
    }

    if (config.concurrency > 1 && strategy.includes('parallel')) {
      return await this.downloadParallel(chunks, collection, token, getBaseURL, onProgress);
    } else {
      return await this.downloadSequential(chunks, collection, token, getBaseURL, onProgress);
    }
  }

  async downloadSequential(chunks, collection, token, getBaseURL, onProgress) {
    const allData = [];
    let consecutiveErrors = 0;
    const config = this.adaptiveConfig;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      let retryCount = 0;
      let success = false;

      while (retryCount < config.maxRetries && !success) {
        const startTime = Date.now();
        
        try {
          const response = await axios.get(`${getBaseURL()}/api/tenant/data/offline-chunk`, {
            headers: { Authorization: `Bearer ${token}` },
            params: { col: collection, skip: chunk.skip, limit: chunk.limit },
            timeout: 45000
          });

          const responseTime = Date.now() - startTime;
          const chunkData = response.data?.data || [];
          
          allData.push(...chunkData);
          consecutiveErrors = 0;
          success = true;

          this.adaptChunkSize(true, responseTime);

          onProgress({
            current: i + 1,
            total: chunks.length,
            percentage: ((i + 1) / chunks.length) * 100,
            records: chunkData.length
          });

          console.log(`Chunk ${i + 1}/${chunks.length}: ${chunkData.length} records (${responseTime}ms)`);

          if (i < chunks.length - 1) {
            await new Promise(resolve => setTimeout(resolve, config.delayBetweenChunks));
          }

        } catch (error) {
          retryCount++;
          consecutiveErrors++;
          
          const responseTime = Date.now() - startTime;
          const isRateLimit = error.response?.status === 429;
          
          console.error(`Chunk ${i + 1} failed (attempt ${retryCount}):`, error.message);

          this.adaptChunkSize(false, responseTime, isRateLimit ? 429 : 'other');

          if (retryCount < config.maxRetries) {
            const delay = config.delayBetweenChunks * Math.pow(config.backoffMultiplier, retryCount);
            console.log(`Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          } else {
            console.log(`Skipping chunk ${i + 1} after ${config.maxRetries} retries`);
            this.downloadStats.failedChunks++;
          }

          if (consecutiveErrors >= 5) {
            const emergencyPause = 30000 + (consecutiveErrors * 10000);
            console.log(`Emergency pause: ${emergencyPause}ms`);
            await new Promise(resolve => setTimeout(resolve, emergencyPause));
          }
        }
      }

      if (consecutiveErrors >= 10) {
        console.log('Too many consecutive errors, stopping collection download');
        break;
      }
    }

    return allData;
  }

  async downloadParallel(chunks, collection, token, getBaseURL, onProgress) {
    const config = this.adaptiveConfig;
    const allData = [];
    
    const batchSize = config.concurrency;
    const batches = [];
    
    for (let i = 0; i < chunks.length; i += batchSize) {
      batches.push(chunks.slice(i, i + batchSize));
    }

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      
      const promises = batch.map(async (chunk, index) => {
        let retryCount = 0;
        
        while (retryCount < config.maxRetries) {
          try {
            const response = await axios.get(`${getBaseURL()}/api/tenant/data/offline-chunk`, {
              headers: { Authorization: `Bearer ${token}` },
              params: { col: collection, skip: chunk.skip, limit: chunk.limit },
              timeout: 45000
            });

            return response.data?.data || [];
          } catch (error) {
            retryCount++;
            if (retryCount < config.maxRetries) {
              const delay = 1000 * retryCount * (index + 1);
              await new Promise(resolve => setTimeout(resolve, delay));
            } else {
              console.error('Parallel chunk failed after retries:', error.message);
              return [];
            }
          }
        }
      });

      const batchResults = await Promise.all(promises);
      const batchData = batchResults.flat();
      allData.push(...batchData);

      onProgress({
        current: (batchIndex + 1) * batchSize,
        total: chunks.length,
        percentage: ((batchIndex + 1) * batchSize / chunks.length) * 100,
        records: batchData.length
      });

      if (batchIndex < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, config.delayBetweenChunks));
      }
    }

    return allData;
  }

  calculateSpeed() {
    const elapsedTime = (Date.now() - this.downloadStats.startTime) / 1000;
    return elapsedTime > 0 ? Math.round(this.downloadStats.downloadedRecords / elapsedTime) : 0;
  }
}

// SQLite Database Manager
class SQLiteOfflineDB {
  constructor() {
    this.db = null;
    this.dbName = 'VehicleOfflineDB.db';
  }

  async initDatabase() {
    try {
      this.db = await SQLite.openDatabaseAsync(this.dbName);

      await this.createTables();
      await this.createIndexes();
      console.log('SQLite database initialized');
      
    } catch (error) {
      console.error('Database initialization failed:', error);
      throw error;
    }
  }

  async createTables() {
    try {
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS vehicles (
          id TEXT PRIMARY KEY,
          reg_no TEXT,
          chassis_no TEXT,
          loan_no TEXT,
          vehicle_type TEXT,
          brand TEXT,
          model TEXT,
          variant TEXT,
          year INTEGER,
          color TEXT,
          engine_no TEXT,
          fuel_type TEXT,
          loan_amount REAL,
          emi_amount REAL,
          tenure INTEGER,
          customer_name TEXT,
          customer_phone TEXT,
          customer_address TEXT,
          branch TEXT,
          status TEXT,
          created_at INTEGER,
          updated_at INTEGER,
          search_text TEXT,
          full_data TEXT
        )
      `);
      console.log('Table created successfully');
    } catch (error) {
      console.error('Error creating table:', error);
      throw error;
    }
  }

  async createIndexes() {
    try {
      const indexes = [
        'CREATE INDEX IF NOT EXISTS idx_reg_no ON vehicles(reg_no)',
        'CREATE INDEX IF NOT EXISTS idx_chassis_no ON vehicles(chassis_no)',
        'CREATE INDEX IF NOT EXISTS idx_loan_no ON vehicles(loan_no)',
        'CREATE INDEX IF NOT EXISTS idx_search_text ON vehicles(search_text)',
        'CREATE INDEX IF NOT EXISTS idx_reg_suffix ON vehicles(substr(reg_no, -4))',
        'CREATE INDEX IF NOT EXISTS idx_vehicle_type ON vehicles(vehicle_type)',
        'CREATE INDEX IF NOT EXISTS idx_status ON vehicles(status)',
        'CREATE INDEX IF NOT EXISTS idx_updated_at ON vehicles(updated_at)'
      ];

      for (const indexSQL of indexes) {
        try {
          await this.db.execAsync(indexSQL);
        } catch (error) {
          console.error('Index creation error:', error);
        }
      }
      console.log('Indexes created successfully');
    } catch (error) {
      console.error('Error creating indexes:', error);
      throw error;
    }
  }

  async batchInsertVehicles(vehicles, chunkSize = 1000) {
    for (let i = 0; i < vehicles.length; i += chunkSize) {
      const chunk = vehicles.slice(i, i + chunkSize);
      
      try {
        await this.db.withTransactionAsync(async (tx) => {
          for (const vehicle of chunk) {
            const searchText = `${vehicle.regNo || ''} ${vehicle.chassisNo || ''} ${vehicle.loanNo || ''} ${vehicle.customerName || ''}`.toLowerCase();
            
            await tx.runAsync(`
              INSERT OR REPLACE INTO vehicles 
              (id, reg_no, chassis_no, loan_no, vehicle_type, brand, model, variant, 
               year, color, engine_no, fuel_type, loan_amount, emi_amount, tenure,
               customer_name, customer_phone, customer_address, branch, status,
               created_at, updated_at, search_text, full_data)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              vehicle._id || vehicle.id,
              vehicle.regNo,
              vehicle.chassisNo,
              vehicle.loanNo,
              vehicle.vehicleType,
              vehicle.brand,
              vehicle.model,
              vehicle.variant,
              vehicle.year,
              vehicle.color,
              vehicle.engineNo,
              vehicle.fuelType,
              vehicle.loanAmount,
              vehicle.emiAmount,
              vehicle.tenure,
              vehicle.customerName,
              vehicle.customerPhone,
              vehicle.customerAddress,
              vehicle.branch,
              vehicle.status,
              new Date(vehicle.createdAt || Date.now()).getTime(),
              new Date(vehicle.updatedAt || Date.now()).getTime(),
              searchText,
              JSON.stringify(vehicle)
            ]);
          }
        });
        console.log(`Inserted chunk ${Math.floor(i/chunkSize) + 1}/${Math.ceil(vehicles.length/chunkSize)}`);
      } catch (error) {
        console.error(`Error inserting chunk ${Math.floor(i/chunkSize) + 1}:`, error);
        throw error;
      }
    }
  }

  async searchVehicles(query, searchType, limit = 100) {
    try {
      const lowerQuery = query.toLowerCase();
      let sql, params;

      switch (searchType) {
        case 'reg':
          if (/^\d{4}$/.test(query)) {
            sql = `
              SELECT id, reg_no, chassis_no, loan_no, customer_name, full_data
              FROM vehicles 
              WHERE substr(reg_no, -4) = ? 
              ORDER BY updated_at DESC 
              LIMIT ?
            `;
            params = [query, limit];
          } else {
            sql = `
              SELECT id, reg_no, chassis_no, loan_no, customer_name, full_data
              FROM vehicles 
              WHERE reg_no LIKE ? 
              ORDER BY updated_at DESC 
              LIMIT ?
            `;
            params = [`%${query}%`, limit];
          }
          break;

        case 'chassis':
          sql = `
            SELECT id, reg_no, chassis_no, loan_no, customer_name, full_data
            FROM vehicles 
            WHERE chassis_no LIKE ? 
            ORDER BY updated_at DESC 
            LIMIT ?
          `;
          params = [`%${query}%`, limit];
          break;

        default:
          sql = `
            SELECT id, reg_no, chassis_no, loan_no, customer_name, full_data
            FROM vehicles 
            WHERE search_text LIKE ? 
            ORDER BY updated_at DESC 
            LIMIT ?
          `;
          params = [`%${lowerQuery}%`, limit];
      }

      const result = await this.db.getAllAsync(sql, params);
      const results = result.map(row => ({
        id: row.id,
        regNo: row.reg_no,
        chassisNo: row.chassis_no,
        loanNo: row.loan_no,
        customerName: row.customer_name,
        fullData: JSON.parse(row.full_data)
      }));
      
      return results;
    } catch (error) {
      console.error('Search error:', error);
      throw error;
    }
  }

  async getTotalCount() {
    try {
      const result = await this.db.getFirstAsync('SELECT COUNT(*) as count FROM vehicles');
      return result.count;
    } catch (error) {
      console.error('Error getting total count:', error);
      throw error;
    }
  }

  async clearAllData() {
    try {
      await this.db.execAsync('DELETE FROM vehicles');
    } catch (error) {
      console.error('Error clearing data:', error);
      throw error;
    }
  }
}

// Background sync functions
// Background task helpers are defined once in utils/backgroundTasks
import { registerOfflineBackgroundSync, unregisterOfflineBackgroundSync } from '../utils/backgroundTasks';
import { countVehicles, searchByRegSuffix, searchByChassis, searchByRegSuffixPartial, searchByRegNoSuffixLike, initDatabase, bulkInsertVehicles, rebuildSearchIndex } from '../utils/db';

// Main Dashboard Component
export default function DashboardScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [agent, setAgent] = useState(null);
  const [searchValue, setSearchValue] = useState('');
  const [chassisValue, setChassisValue] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [localCount, setLocalCount] = useState(0);
  const [progressiveResults, setProgressiveResults] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [lastDownloadedAt, setLastDownloadedAt] = useState(null);
  const [isOfflineMode, setIsOfflineMode] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadStatus, setDownloadStatus] = useState('Ready');
  
  // Use shared utils/db for offline store used by sync

  useEffect(() => {
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync('agent');
        if (stored) setAgent(JSON.parse(stored));

        // Initialize shared DB and load count
        const count = await countVehicles();
        setLocalCount(typeof count === 'number' ? count : 0);
        
        if (count > 0) {
          const lastSync = await SecureStore.getItemAsync('lastSyncTime');
          if (lastSync) {
            setLastDownloadedAt(new Date(lastSync).toLocaleString());
            setLastSyncTime(lastSync);
          }
        }

        console.log(`SQLite loaded with ${count} records`);
      } catch (error) {
        console.error('Error loading data:', error);
      }
    })();
  }, []);

  const logout = async () => {
    await SecureStore.deleteItemAsync('token');
    await SecureStore.deleteItemAsync('agent');
    navigation.replace('Login');
  };

  const ProgressBar = ({ progress, status }) => (
    <View style={styles.progressContainer}>
      <View style={styles.progressHeader}>
        <Text style={styles.progressTitle}>Downloading Database</Text>
        <Text style={styles.progressPercent}>{Math.round(progress)}%</Text>
      </View>
      <View style={styles.progressBarContainer}>
        <View style={styles.progressBarBackground}>
          <View 
            style={[
              styles.progressBarFill, 
              { width: `${progress}%` }
            ]} 
          />
        </View>
      </View>
      <Text style={styles.progressStatus}>{status}</Text>
    </View>
  );

  const downloadOffline = async () => {
    if (downloading) return;
    setDownloading(true);
    setDownloadProgress(0);
    setDownloadStatus('Initializing...');

    const token = await SecureStore.getItemAsync('token');
    if (!token) {
      setDownloading(false);
      Alert.alert('Login required', 'Please login again.');
      return;
    }

    try {
      // Clear existing data
      // removed legacy sqliteDB usage

      // Use the new rate-limited sync function instead of adaptive strategy
      const result = await runHeadlessOfflineSync();
      
      if (result.success) {
        setDownloadProgress(100);
        setDownloadStatus(`Download completed: ${result.inserted?.toLocaleString() || 0} records`);
        Alert.alert('Success', `Download completed successfully!\nRecords: ${result.inserted?.toLocaleString() || 0}`);
      } else {
        setDownloadStatus(`Download failed: ${result.message}`);
        Alert.alert('Error', `Download failed: ${result.message}`);
      }
      return;
      
      /* removed: legacy adaptive download */
    } catch (error) {
      console.error('Download failed:', error);
      setDownloadStatus('Download failed');
      Alert.alert('Download failed', error.message);
    } finally {
      setTimeout(() => setDownloading(false), 1000);
    }
  };

  const runInstantSearch = async (query, type) => {
    // Strict mode: Offline => ONLY local DB; Online => ONLY server
    if (isOfflineMode) {
      // Ensure we have local data count
      if (!localCount || localCount <= 0) {
      try {
        const fresh = await countVehicles();
        if (typeof fresh === 'number' && fresh >= 0) setLocalCount(fresh);
      } catch (_) {}
      }
      if (!localCount || localCount <= 0) {
        Alert.alert('Offline Search', 'No local data available. Please run Sync first.');
        return;
      }
      try {
        let results = [];
        if (type === 'reg') {
          if (/^\d{4}$/.test(query)) {
            results = await searchByRegSuffix(query);
            if (!results || results.length === 0) {
              // fallback to LIKE on full regNo if regSuffix not populated
              results = await searchByRegNoSuffixLike(query);
            }
          } else {
            results = [];
          }
        } else if (type === 'chassis') {
          results = await searchByChassis(query);
        }
        if (results.length > 0) {
          navigation.navigate('SearchResults', { q: query, type, fromDashboard: true, instantSearch: true, preloadedData: results, offline: true });
        } else {
          Alert.alert('No Results', `No vehicles found in offline data for ${type === 'reg' ? 'registration ending in' : 'chassis containing'} ${query}`);
        }
      } catch (error) {
        Alert.alert('Search Error', 'Error searching offline data: ' + error.message);
      }
      return;
    }

    // Online mode
    try {
      const token = await SecureStore.getItemAsync('token');
      const res = await axios.get(`${getBaseURL()}/api/tenant/data/search`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { q: query, type, limit: 1000 }
      });
      const serverResults = res.data?.data || [];
      if (serverResults.length > 0) {
        navigation.navigate('SearchResults', { q: query, type, fromDashboard: true, instantSearch: true, preloadedData: serverResults, offline: false });
      } else {
        Alert.alert('No Results', `No vehicles found on server for ${type === 'reg' ? 'registration ending in' : 'chassis containing'} ${query}`);
      }
    } catch (error) {
      Alert.alert('Search Failed', 'Unable to connect to server. Please check your internet connection.');
    }
  };

  const runProgressiveSearch = async (input) => {
    if (localCount <= 0) {
      setProgressiveResults([]);
      setPredictions([]);
      return;
    }

    try {
      let results = [];
      if (/^\d{2,3}$/.test(input)) {
        results = await searchByRegSuffixPartial(input);
      } else if (/^\d{4}$/.test(input)) {
        results = await searchByRegSuffix(input);
      }
      setProgressiveResults((results || []).slice(0, 20));
      setPredictions([]);
      console.log(`Progressive search for ${input}: ${results?.length || 0} results`);
    } catch (error) {
      console.error('Progressive search error:', error);
      setProgressiveResults([]);
      setPredictions([]);
    }
  };

  useEffect(() => {
    const regValue = String(searchValue || '').trim();
    const chassisVal = String(chassisValue || '').trim();
    
    if (!regValue && !chassisVal) {
      setProgressiveResults([]);
      setPredictions([]);
      return;
    }
    
    // 4-digit registration search - Navigate to SearchResultsScreen
    if (/^\d{4}$/.test(regValue)) {
      runInstantSearch(regValue, 'reg');
    }
    // Chassis search (3+ characters) - Navigate to SearchResultsScreen
    else if (chassisVal.length >= 3) {
      runInstantSearch(chassisVal, 'chassis');
    }
    // Progressive search for 2+ digits (local only)
    else if (localCount > 0 && regValue.length >= 2) {
      runProgressiveSearch(regValue);
    } else {
      setProgressiveResults([]);
      setPredictions([]);
    }
  }, [searchValue, chassisValue, localCount]);

  const incrementalSync = async () => {
    setDownloading(true);
    setDownloadStatus('Checking for updates...');
    setDownloadProgress(5);

    const token = await SecureStore.getItemAsync('token');
    if (!token) {
      setDownloading(false);
      Alert.alert('Login required', 'Please login again.');
      return;
    }

    try {
      const storedSyncTime = await SecureStore.getItemAsync('lastSyncTime');
      const lastSync = storedSyncTime || new Date(0).toISOString();
      
      setDownloadStatus(`Checking for updates since ${new Date(lastSync).toLocaleString()}...`);
      setDownloadProgress(10);

      const statsRes = await axios.get(`${getBaseURL()}/api/tenant/data/offline-stats`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { since: lastSync },
        timeout: 15000
      });

      const newCount = statsRes.data?.newRecords || 0;
      
      if (newCount === 0) {
        setDownloadProgress(100);
        setDownloadStatus('Already up to date!');
        setTimeout(() => setDownloading(false), 1000);
        return;
      }

      setDownloadStatus(`Downloading ${newCount} new records...`);
      setDownloadProgress(20);

      const newDataRes = await axios.get(`${getBaseURL()}/api/tenant/data/incremental-sync`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { since: lastSync },
        timeout: 60000
      });

      const newRecords = newDataRes.data?.data || [];
      
      if (newRecords.length === 0) {
        setDownloadProgress(100);
        setDownloadStatus('No new data found');
        setTimeout(() => setDownloading(false), 1000);
        return;
      }

      setDownloadStatus('Updating database...');
      setDownloadProgress(50);

      // Insert new records into SQLite
      // legacy insert path removed

      const updatedCount = await countVehicles();
      setLocalCount(updatedCount);
      setLastDownloadedAt(new Date().toLocaleString());
      setLastSyncTime(new Date().toISOString());

      await SecureStore.setItemAsync('lastSyncTime', new Date().toISOString());

      setDownloadProgress(100);
      setDownloadStatus(`Updated with ${newRecords.length} new records!`);
      
      Alert.alert('Update Complete', `Added ${newRecords.length} new records. Total: ${updatedCount.toLocaleString()}`);
      
    } catch (error) {
      setDownloadStatus('Update failed');
      Alert.alert('Update Failed', 'Incremental update failed. Try full download.');
    } finally {
      setTimeout(() => setDownloading(false), 1000);
    }
  };

  const syncViaJsonDump = async () => {
    if (downloading) return;
    setDownloading(true);
    setDownloadProgress(2);
    setDownloadStatus('Requesting dump...');

    try {
      const token = await SecureStore.getItemAsync('token');
      if (!token) {
        setDownloading(false);
        Alert.alert('Login required', 'Please login again.');
        return;
      }

      const res = await axios.get(`${getBaseURL()}/api/tenant/data/offline-dump`, {
        headers: { Authorization: `Bearer ${token}`, 'Accept-Encoding': 'gzip, deflate' },
        timeout: 1200000,
        maxContentLength: 500 * 1024 * 1024,
        maxBodyLength: 500 * 1024 * 1024
      });

      if (!res?.data?.success) {
        throw new Error(res?.data?.message || 'Failed to get dump');
      }

      const payload = res.data;
      const items = payload?.data || [];
      const tenant = payload?.tenant || 'tenant';
      const total = payload?.totalRecords || items.length || 0;

      setDownloadProgress(10);
      setDownloadStatus(`Saving ${total.toLocaleString()} records...`);

      const filename = `offline_dump_${tenant}_${Date.now()}.json`;
      const target = `${FileSystem.documentDirectory}${filename}`;
      const jsonString = JSON.stringify({ tenant, totalRecords: total, data: items });
      await FileSystem.writeAsStringAsync(target, jsonString);

      setDownloadProgress(20);
      setDownloadStatus('Importing to offline search...');

      await initDatabase();
      let inserted = 0;
      const CHUNK = 2000;
      for (let i = 0; i < items.length; i += CHUNK) {
        const chunk = items.slice(i, i + CHUNK);
        try {
          inserted += await bulkInsertVehicles(chunk, { reindex: false });
        } catch (e) {
          console.log('Insert chunk failed, continuing:', e?.message || e);
        }
        const processed = Math.min(i + CHUNK, items.length);
        const pct = 20 + Math.round((processed / items.length) * 70);
        setDownloadProgress(pct);
        setDownloadStatus(`Imported ${processed.toLocaleString()} / ${items.length.toLocaleString()}`);
        await new Promise((r) => setTimeout(r, 0));
      }

      setDownloadStatus('Rebuilding search index...');
      setDownloadProgress(95);
      await rebuildSearchIndex();

      const nowIso = new Date().toISOString();
      await SecureStore.setItemAsync('lastSyncTime', nowIso);
      await SecureStore.setItemAsync('offline_metadata', JSON.stringify({ totalRecords: inserted, downloadedAt: nowIso, tenant, method: 'json_dump' }));

      const updatedCount = await countVehicles();
      setLocalCount(typeof updatedCount === 'number' ? updatedCount : 0);
      setLastDownloadedAt(new Date().toLocaleString());
      setLastSyncTime(nowIso);

      setDownloadProgress(100);
      setDownloadStatus(`Sync complete: ${inserted.toLocaleString()} records.`);
      Alert.alert('Sync Complete', `Downloaded and imported ${inserted.toLocaleString()} records.`);
    } catch (e) {
      console.error('JSON sync failed:', e);
      setDownloadStatus(e?.message || 'Sync failed');
      Alert.alert('Sync Failed', e?.message || 'Unable to sync');
    } finally {
      setTimeout(() => setDownloading(false), 800);
    }
  };

  const refreshLocalCount = async () => {
    try {
      const count = await countVehicles();
      setLocalCount(count);
      console.log(`Refreshed local count: ${count}`);
    } catch (error) {
      console.error('Error refreshing count:', error);
    }
  };

  // DEBUG: print SQLite field stats and sample search counts in dev builds
  useEffect(() => {
    (async () => {
      try {
        if (__DEV__ && localCount > 0) {
          const { getSearchableFieldStats } = require('../utils/db');
          const stats = await getSearchableFieldStats();
          console.log('DB Field Stats:', stats);
          const samplePartial = await searchByRegSuffixPartial('85');
          console.log('Sample partial reg search (85) count:', samplePartial?.length || 0);
          const samplePartial3 = await searchByRegSuffixPartial('852');
          console.log('Sample partial reg search (852) count:', samplePartial3?.length || 0);
          const sampleChassis = await searchByChassis('ABC');
          console.log('Sample chassis search (ABC) count:', sampleChassis?.length || 0);
        }
      } catch (e) {
        console.log('Debug stats error:', e?.message || e);
      }
    })();
  }, [localCount]);

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => setDrawerOpen(true)} style={styles.menuBtn}>
          <Text style={styles.menuIcon}>≡</Text>
        </TouchableOpacity>
        <View style={styles.titleWrap}>
          <Text style={styles.appTitle}>RapidRepo</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
          <Text style={styles.link}>👤</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('OfflineData')} style={{ marginLeft: 12 }}>
          <Text style={styles.link}>📥</Text>
        </TouchableOpacity>
      </View>

      {/* Brand + search */}
      <View style={styles.brandBlock}>
        <Image source={require('../assets/icon.png')} style={styles.logoImage} resizeMode="cover" />
        <Text style={styles.orgName}>{agent?.tenantName || 'Your Organization'}</Text>
        <View style={styles.searchRow}>
          <TextInput
            style={[styles.input, { flex: 0.5 }]}
            value={chassisValue}
            onChangeText={(t) => {
              const clean = String(t || '').toUpperCase().slice(0, 20);
              setChassisValue(clean);
              // Trigger search when chassis number is 3+ characters
              if (clean.length >= 3) {
                runInstantSearch(clean, 'chassis');
              } else {
                setProgressiveResults([]);
                setPredictions([]);
              }
            }}
            placeholder="Chassis Number"
            autoCapitalize="characters"
          />
          <TextInput
            style={[styles.input, { flex: 0.5 }]}
            value={searchValue}
            onChangeText={(t) => {
              const digits = String(t || '').replace(/\D/g, '').slice(0, 4);
              setSearchValue(digits);
              // Trigger search based on input length
              if (digits.length === 4) {
                runInstantSearch(digits, 'reg');
              } else if (digits.length >= 2) {
                runProgressiveSearch(digits);
              } else {
                setProgressiveResults([]);
                setPredictions([]);
              }
            }}
            placeholder="4-Digit Reg (1234)"
            keyboardType="numeric"
            maxLength={4}
          />
        </View>
        <Text style={styles.searchHint}>
          Enter chassis number (3+ chars) or 4-digit registration number
        </Text>
      </View>

      {/* Progress Bar removed to simplify dashboard */}
      {downloading && (
        <ProgressBar progress={downloadProgress || 0} status={downloadStatus || ''} />
      )}

      {/* Info cards removed to keep dashboard minimal */}

      {/* Progressive Results - Show while typing */}
      {progressiveResults.length > 0 && searchValue.length >= 2 && searchValue.length < 4 && (
        <View style={styles.progressiveContainer}>
          <Text style={styles.progressiveTitle}>
            Found {progressiveResults.length} vehicles starting with "{searchValue}"
          </Text>
          <FlatList
            data={progressiveResults.slice(0, 6)}
            numColumns={2}
            keyExtractor={(item, index) => String(item.id || item._id || item.regNo || item.chassisNo || index)}
            contentContainerStyle={{ gap: 8 }}
            columnWrapperStyle={{ gap: 8 }}
            renderItem={({ item }) => (
              <View style={[styles.tile, { flex: 1, backgroundColor: '#E8F4FD' }]}>
                <View>
                  <Text style={styles.tileTitle}>{item.regNo || '—'}</Text>
                  <Text style={styles.muted}>Chassis: {item.chassisNo || '—'}</Text>
                  <Text style={styles.muted}>Loan: {item.loanNo || '—'}</Text>
                </View>
              </View>
            )}
          />
        </View>
      )}

      {/* Predictions - Show next likely digits */}
      {predictions.length > 0 && searchValue.length >= 2 && searchValue.length < 4 && (
        <View style={styles.predictionsContainer}>
          <Text style={styles.predictionsTitle}>Next likely digits:</Text>
          <View style={styles.predictionsRow}>
            {predictions.map((pred, index) => (
              <TouchableOpacity
                key={index}
                style={styles.predictionButton}
                onPress={() => setSearchValue(searchValue + pred.digit)}
              >
                <Text style={styles.predictionDigit}>{pred.digit}</Text>
                <Text style={styles.predictionCount}>({pred.count})</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Quick tiles */}
      <View style={styles.grid}>
        <TouchableOpacity style={styles.tile}>
          <Text style={styles.tileTitle}>Holds</Text>
          <Text style={styles.tileIcon}>⏸️</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tile}>
          <Text style={styles.tileTitle}>In Yard</Text>
          <Text style={styles.tileIcon}>📦</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={[styles.tile, { width: '100%' }]}>
        <Text style={styles.tileTitle}>Release</Text>
        <Text style={styles.tileIcon}>↩️</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.tile, { width: '100%', marginTop: 10 }]} onPress={() => navigation.navigate('JSONExport')}>
        <Text style={styles.tileTitle}>Export JSON (Offline Dump)</Text>
        <Text style={styles.tileIcon}>🗂️</Text>
      </TouchableOpacity>

      {/* Bottom bar with offline/online toggle and sync */}
      <View style={styles.bottomBar}>
        <View style={styles.modeGroup}>
          <TouchableOpacity
            style={[styles.modeBtn, isOfflineMode && styles.modeBtnActive]}
            onPress={() => setIsOfflineMode(true)}
          >
            <Text style={[styles.modeBtnText, isOfflineMode && styles.modeBtnTextActive]}>Offline</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, !isOfflineMode && styles.modeBtnActive]}
            onPress={() => setIsOfflineMode(false)}
          >
            <Text style={[styles.modeBtnText, !isOfflineMode && styles.modeBtnTextActive]}>Online</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.downloadButtonsContainer}>
          <TouchableOpacity
            style={[styles.downloadButton, styles.incrementalButton, downloading && { opacity: 0.6 }]}
            onPress={syncViaJsonDump}
            disabled={downloading}
          >
            <Text style={styles.bottomButtonText}>{downloading ? 'Syncing...' : 'Sync Data'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.downloadButton, styles.refreshButton]}
            onPress={refreshLocalCount}
          >
            <Text style={styles.bottomButtonText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Simple left drawer */}
      <Modal visible={drawerOpen} transparent animationType="slide" onRequestClose={() => setDrawerOpen(false)}>
        <View style={styles.drawerOverlay}>
          <View style={styles.drawer}>
            <Text style={styles.drawerTitle}>Menu</Text>
            <TouchableOpacity style={styles.drawerItem} onPress={() => { setDrawerOpen(false); }}>
              <Text style={styles.drawerItemText}>Dashboard</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.drawerItem} onPress={() => { setDrawerOpen(false); navigation.navigate('IDCard'); }}>
              <Text style={styles.drawerItemText}>My ID Card</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.drawerItem} onPress={() => { setDrawerOpen(false); navigation.navigate('Sync'); }}>
              <Text style={styles.drawerItemText}>Data Sync</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.drawerItem} onPress={logout}>
              <Text style={styles.drawerItemText}>Logout</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setDrawerOpen(false)} />
        </View>
      </Modal>

    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#10121A', paddingHorizontal: 10 },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  menuBtn: { paddingHorizontal: 6, paddingVertical: 4 },
  menuIcon: { color: '#fff', fontSize: 22, fontWeight: '900' },
  titleWrap: { flex: 1, alignItems: 'center' },
  appTitle: { color: '#fff', fontSize: 24, fontWeight: '800' },
  link: { color: '#9ecbff', fontSize: 14 },
  brandBlock: { alignItems: 'center', marginBottom: 10 },
  logoImage: { width: 120, height: 120, borderRadius: 30, marginTop: 2 },
  orgName: { color: '#fff', fontSize: 20, fontWeight: '700', marginTop: 12 },
  searchRow: { flexDirection: 'row', gap: 8, width: '100%', marginTop: 12 },
  input: { backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  searchHint: {
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic'
  },
  infoCard: { 
    backgroundColor: '#fff', 
    borderRadius: 16, 
    padding: 14, 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginBottom: 12 
  },
  infoKey: { color: '#333', fontWeight: '700' },
  infoVal: { color: '#555' },
  progressContainer: { 
    backgroundColor: '#1A1D29', 
    borderRadius: 16, 
    padding: 20, 
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2D3748'
  },
  progressHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 12 
  },
  progressTitle: { 
    color: '#fff', 
    fontSize: 16, 
    fontWeight: '700' 
  },
  progressPercent: { 
    color: '#FFD548', 
    fontSize: 18, 
    fontWeight: '800' 
  },
  progressBarContainer: { 
    marginBottom: 8 
  },
  progressBarBackground: { 
    height: 8, 
    backgroundColor: '#2D3748', 
    borderRadius: 4, 
    overflow: 'hidden' 
  },
  progressBarFill: { 
    height: '100%', 
    backgroundColor: '#FFD548', 
    borderRadius: 4,
    shadowColor: '#FFD548',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3
  },
  progressStatus: { 
    color: '#9CA3AF', 
    fontSize: 12, 
    textAlign: 'center' 
  },
  progressiveContainer: {
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#0EA5E9'
  },
  progressiveTitle: {
    color: '#0369A1',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center'
  },
  predictionsContainer: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F59E0B'
  },
  predictionsTitle: {
    color: '#92400E',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center'
  },
  predictionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8
  },
  predictionButton: {
    backgroundColor: '#F59E0B',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    minWidth: 50
  },
  predictionDigit: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700'
  },
  predictionCount: {
    color: '#fff',
    fontSize: 10,
    opacity: 0.8
  },
  grid: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  tile: { 
    flex: 1, 
    backgroundColor: '#fff', 
    borderRadius: 16, 
    padding: 18, 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    flexDirection: 'row' 
  },
  tileTitle: { color: '#111', fontSize: 18, fontWeight: '700' },
  tileIcon: { fontSize: 22 },
  muted: { color: '#666', fontSize: 12 },
  bottomBar: { 
    position: 'absolute', 
    bottom: 12, 
    left: 16, 
    right: 16, 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12 
  },
  modeGroup: { flex: 1, flexDirection: 'row', gap: 8 },
  modeBtn: {
    flex: 1,
    backgroundColor: '#1F2433',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2D3748'
  },
  modeBtnActive: {
    backgroundColor: '#FFD548',
    borderColor: '#FFD548'
  },
  modeBtnText: {
    color: '#9CA3AF',
    fontWeight: '700'
  },
  modeBtnTextActive: {
    color: '#111111'
  },
  downloadButtonsContainer: {
    flexDirection: 'row',
    gap: 8,
    flex: 1
  },
  downloadButton: { 
    backgroundColor: '#222636', 
    paddingVertical: 16, 
    borderRadius: 28, 
    alignItems: 'center', 
    paddingHorizontal: 18,
    flex: 1
  },
  incrementalButton: {
    backgroundColor: '#10B981'
  },
  fullDownloadButton: {
    backgroundColor: '#222636'
  },
  refreshButton: {
    backgroundColor: '#6366F1'
  },
  bottomButtonText: { color: '#fff', fontWeight: '800', letterSpacing: 1 },
  drawerOverlay: { flex: 1, flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.4)' },
  drawer: { width: 260, backgroundColor: '#fff', paddingTop: 40, paddingHorizontal: 16 },
  drawerTitle: { fontSize: 18, fontWeight: '800', marginBottom: 16 },
  drawerItem: { paddingVertical: 12 },
  drawerItemText: { fontSize: 16, color: '#111' }
});
