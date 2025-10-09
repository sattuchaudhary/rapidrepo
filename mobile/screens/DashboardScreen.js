import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, TextInput, FlatList, Image, Modal, Alert, Animated, StatusBar, useColorScheme, Appearance } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';


import * as SQLite from 'expo-sqlite';
import axios from 'axios';
import { getBaseURL } from '../utils/config';
import * as FileSystem from 'expo-file-system/legacy';
import { singleClickPerFileSync, getPerFileSyncStatus } from '../utils/fileSync';
import UpdateNotification from '../components/UpdateNotification';
import versionManager from '../utils/versionManager';
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

// Background sync disabled
import { countVehicles, searchByRegSuffix, searchByChassis, searchByRegSuffixPartial, searchByRegNoSuffixLike, initDatabase, bulkInsertVehicles, rebuildSearchIndex, clearVehicles } from '../utils/db';
import { simpleSync, markSyncCompleted } from '../utils/simpleSync';
import { smartSync, getIncrementalSyncStatus } from '../utils/incrementalSync';
import { singleBatchSync } from '../utils/hybridSync';
import { getCachedAgent, getCachedSettings, preloadCriticalData } from '../utils/fastInit';

// Main Dashboard Component
export default function DashboardScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [colorScheme, setColorScheme] = useState(useColorScheme());
  const isDark = colorScheme === 'dark';
  const theme = {
    bg: isDark ? '#10121A' : '#f8fafc',
    textPrimary: isDark ? '#ffffff' : '#111827',
    textSecondary: isDark ? 'rgba(255,255,255,0.7)' : '#64748b',
    inputBg: isDark ? '#0f172a' : '#ffffff',
    inputBorder: isDark ? '#1f2937' : '#e2e8f0',
    drawerBg: isDark ? '#111827' : '#ffffff',
    drawerText: isDark ? '#e5e7eb' : '#111827',
    drawerMuted: isDark ? '#9CA3AF' : '#6B7280',
    cardBg: isDark ? 'rgba(255,255,255,0.08)' : '#ffffff',
    cardBorder: isDark ? 'rgba(255,255,255,0.15)' : '#e2e8f0',
    statLabel: isDark ? 'rgba(255,255,255,0.8)' : '#64748b',
    bottomBarBg: isDark ? 'rgba(17, 24, 39, 0.95)' : 'rgba(255,255,255,0.95)',
    bottomBarBorder: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0',
    modeSectionTitle: isDark ? '#9CA3AF' : '#64748b',
    modeToggleContainer: isDark ? 'rgba(31, 41, 55, 0.8)' : '#f1f5f9',
    modeToggleText: isDark ? '#9CA3AF' : '#64748b',
  };
  const [agent, setAgent] = useState(null);
  const [searchValue, setSearchValue] = useState('');
  const [chassisValue, setChassisValue] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerTranslate = useState(new Animated.Value(-260))[0];
  const overlayOpacity = useState(new Animated.Value(0))[0];
  const contentFade = useState(new Animated.Value(0))[0];
  const contentSlide = useState(new Animated.Value(16))[0];
  const [localCount, setLocalCount] = useState(0);
  const [dataMultiplier, setDataMultiplier] = useState(1);
  const [progressiveResults, setProgressiveResults] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [lastDownloadedAt, setLastDownloadedAt] = useState(null);
  const [isOfflineMode, setIsOfflineMode] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadStatus, setDownloadStatus] = useState('Ready');
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [isSyncComplete, setIsSyncComplete] = useState(false);
  const [needsSync, setNeedsSync] = useState(false);
  const [spinnerRotation] = useState(new Animated.Value(0));
  const [syncProgress, setSyncProgress] = useState({
    currentBatch: 0,
    totalBatches: 0,
    currentOffset: 0,
    hasMore: false,
    totalRecords: 0,
    downloadedRecords: 0
  });
  const headerIconColor = isDark ? '#FFFFFF' : '#111827';
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [availableUpdateInfo, setAvailableUpdateInfo] = useState(null);
  
  // Use shared utils/db for offline store used by sync

  // Listen for theme changes
  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme: newColorScheme }) => {
      setColorScheme(newColorScheme);
    });
    return () => subscription?.remove();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        // Use fast cached data for immediate UI update
        const [cachedAgent, cachedSettings] = await Promise.all([
          getCachedAgent(),
          getCachedSettings()
        ]);
        
        // Set cached data immediately for instant UI
        if (cachedAgent) setAgent(cachedAgent);
        if (cachedSettings) {
          setIsSyncComplete(cachedSettings.syncComplete);
          if (cachedSettings.lastSyncTime) {
            setLastDownloadedAt(new Date(cachedSettings.lastSyncTime).toLocaleString());
            setLastSyncTime(cachedSettings.lastSyncTime);
          }
          if (cachedSettings.syncProgress) {
            try {
              const progress = JSON.parse(cachedSettings.syncProgress);
              setSyncProgress(progress);
            } catch (error) {
              console.error('Error parsing cached sync progress:', error);
            }
          }
        }
        
        // Defer heavy database operations
        setTimeout(async () => {
          try {
            // Initialize shared DB and load count
            const count = await countVehicles();
            setLocalCount(typeof count === 'number' ? count : 0);
            console.log(`SQLite loaded with ${count} records`);
          } catch (error) {
            console.error('Error loading database data:', error);
          }
        }, 200);

        // Defer server operations even more
        setTimeout(async () => {
          try {
            // Load data multiplier setting from server
            await loadMultiplierFromServer();
            // Subscription check: if expired, redirect to Payment screen
            try {
              const token = await SecureStore.getItemAsync('token');
              if (token) {
                const res = await axios.get(`${getBaseURL()}/api/tenants/subscription/remaining`, {
                  headers: { Authorization: `Bearer ${token}` },
                  timeout: 8000
                });
                const remainingMs = res?.data?.data?.remainingMs || 0;
                if (remainingMs <= 0) {
                  navigation.replace('Payment');
                  return;
                }
              }
            } catch (_) {}
            
            // Check for new records on app startup
            await checkForNewRecords();
          } catch (error) {
            console.error('Error loading server data:', error);
          }
        }, 1500);
        
      } catch (error) {
        console.error('Error loading data:', error);
      }
    })();
  }, []);

  // Check for app updates on dashboard load
  useEffect(() => {
    (async () => {
      try {
        const info = await versionManager.getUpdateInfo();
        if (info && info.isAvailable) {
          setAvailableUpdateInfo(info);
          setShowUpdateModal(true);
        }
      } catch (e) {
        // silent
      }
    })();
  }, []);

  const loadMultiplierFromServer = async () => {
    try {
      const token = await SecureStore.getItemAsync('token');
      if (!token) {
        console.log('📊 No token found, using default multiplier');
        setDataMultiplier(1); // Default to 1x if no token
        return;
      }

      // console.log('📊 Attempting to load multiplier from server...');
      const res = await axios.get(`${getBaseURL()}/api/tenants/settings`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000
      });

      if (res.data?.success && res.data.data?.dataMultiplier) {
        setDataMultiplier(res.data.data.dataMultiplier);
        console.log(`📊 Loaded data multiplier: ${res.data.data.dataMultiplier}x`);
      } else {
        console.log('📊 No multiplier setting found, using default');
        setDataMultiplier(1); // Default to 1x if no setting found
      }
    } catch (error) {
      console.error('📊 Error loading multiplier from server:', error.response?.status, error.response?.data || error.message);
      
      // If token is invalid, user should re-login
      if (error.response?.status === 401) {
        console.log('📊 Token invalid - user may need to re-login');
        // Could optionally redirect to login here
        // navigation.replace('Login');
      }
      
      setDataMultiplier(1); // Default to 1x on error
    }
  };

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

      Alert.alert('Sync Disabled', 'Offline sync is disabled in this build.');
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
    // INSTANT SEARCH - No loading states, immediate navigation
    try {
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
            // Clear inputs and previews on successful navigate
            setSearchValue('');
            setChassisValue('');
            setProgressiveResults([]);
            setPredictions([]);
            // INSTANT navigation - no delays
            navigation.navigate('SearchResults', { q: query, type, fromDashboard: true, instantSearch: true, preloadedData: results, offline: true });
          } else {
            Alert.alert('No Results', `No vehicles found in offline data for ${type === 'reg' ? 'registration ending in' : 'chassis containing'} ${query}`);
          }
        } catch (error) {
          Alert.alert('Search Error', 'Error searching offline data: ' + error.message);
        }
        return;
      }

      // Online mode - INSTANT navigation with preloaded data
      try {
        const token = await SecureStore.getItemAsync('token');
        const res = await axios.get(`${getBaseURL()}/api/tenant/data/search`, {
          headers: { Authorization: `Bearer ${token}` },
          params: { q: query, type, limit: 1000 }
        });
        const serverResults = res.data?.data || [];
        if (serverResults.length > 0) {
          // Clear inputs and previews on successful navigate
          setSearchValue('');
          setChassisValue('');
          setProgressiveResults([]);
          setPredictions([]);
          // INSTANT navigation - no delays
          navigation.navigate('SearchResults', { q: query, type, fromDashboard: true, instantSearch: true, preloadedData: serverResults, offline: false });
        } else {
          Alert.alert('No Results', `No vehicles found on server for ${type === 'reg' ? 'registration ending in' : 'chassis containing'} ${query}`);
        }
      } catch (error) {
        Alert.alert('Search Failed', 'Unable to connect to server. Please check your internet connection.');
      }
    } catch (error) {
      console.error('Search error:', error);
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

  // Disable instant/progressive search while typing to improve performance
  useEffect(() => {
    const regValue = String(searchValue || '').trim();
    const chassisVal = String(chassisValue || '').trim();

    if (/^\d{4}$/.test(regValue)) {
      runInstantSearch(regValue, 'reg');
    } else if (chassisVal.length >= 3) {
      runInstantSearch(chassisVal, 'chassis');
    }
  }, [searchValue, chassisValue]);

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
    setShowLoadingOverlay(true);
    setLoadingMessage('Checking for updates...');
    setDownloadProgress(0);
    setDownloadStatus('Checking for new records...');

    try {
      // First check if we need sync by comparing server vs local count
      const token = await SecureStore.getItemAsync('token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      // Get server total count
      const serverStatsRes = await axios.get(`${getBaseURL()}/api/bulk-download/simple-dump`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { limit: 1, offset: 0 },
        timeout: 30000
      });

      if (!serverStatsRes.data.success) {
        throw new Error('Failed to get server stats');
      }

      const serverTotal = serverStatsRes.data.totalRecords;
      const localCount = await countVehicles();
      
      console.log(`📊 Server total: ${serverTotal}, Local count: ${localCount}`);

      // Check if we need to sync - now using 1 record threshold
      const difference = Math.abs(serverTotal - localCount);
      
      if (difference <= 1) {
        setDownloadProgress(100);
        setDownloadStatus('Already up to date!');
        setShowLoadingOverlay(false);
        setTimeout(() => setDownloading(false), 1000);
        Alert.alert('Sync Status', `Already up to date!\n\nServer: ${serverTotal.toLocaleString()} records\nLocal: ${localCount.toLocaleString()} records`);
        return;
      }

      // Calculate total batches needed
      const batchSize = 100000; // 1 lakh records per batch
      const totalBatches = Math.ceil(serverTotal / batchSize);
      
      // Determine a smart starting offset:
      // - If we have stored progress, use that
      // - Otherwise, derive from current local count to avoid re-downloading completed batches
      const derivedOffsetFromLocal = Math.floor((localCount || 0) / batchSize) * batchSize;
      const currentOffset = (syncProgress.currentOffset && syncProgress.currentOffset > 0)
        ? syncProgress.currentOffset
        : derivedOffsetFromLocal;
      const currentBatch = Math.floor(currentOffset / batchSize) + 1;

      setLoadingMessage(`Downloading batch ${currentBatch} of ${totalBatches}...`);
      setDownloadStatus(`Downloading ${batchSize.toLocaleString()} records per batch...`);

      // Use single batch sync for manual control
      const { singleBatchSync } = await import('../utils/simpleSync');
      const result = await singleBatchSync(currentOffset, (progressData) => {
        setDownloadProgress(progressData.percentage || 0);
        setDownloadStatus(`Batch ${currentBatch}/${totalBatches}: ${progressData.processed || 0}/${progressData.total || 0} records - ${progressData.percentage || 0}% complete`);
      });
      
      if (result.success) {
        setDownloadProgress(100);
        setDownloadStatus(`Batch ${currentBatch} completed successfully!`);
        
        // Update sync progress
        const newProgress = {
          currentBatch: currentBatch,
          totalBatches: totalBatches,
          currentOffset: result.nextOffset,
          hasMore: result.hasMore,
          totalRecords: result.totalRecords,
          downloadedRecords: (syncProgress.downloadedRecords || 0) + result.inserted
        };
        setSyncProgress(newProgress);
        
        // Persist sync progress
        await SecureStore.setItemAsync('sync_progress', JSON.stringify(newProgress));
        
        // Refresh local count
        const updatedCount = await countVehicles();
        setLocalCount(typeof updatedCount === 'number' ? updatedCount : 0);
        setLastDownloadedAt(new Date().toLocaleString());
        setLastSyncTime(new Date().toISOString());
        
        // Check if this was the last batch
        if (!result.hasMore) {
          setIsSyncComplete(true);
          await SecureStore.setItemAsync('sync_complete_flag', 'true');
          await SecureStore.setItemAsync('lastSyncTime', new Date().toISOString());
          
          // Reset sync progress
          const resetProgress = {
            currentBatch: 0,
            totalBatches: 0,
            currentOffset: 0,
            hasMore: false,
            totalRecords: 0,
            downloadedRecords: 0
          };
          setSyncProgress(resetProgress);
          await SecureStore.setItemAsync('sync_progress', JSON.stringify(resetProgress));
          
          Alert.alert('Sync Complete!', `All batches downloaded successfully!\n\nTotal records: ${updatedCount.toLocaleString()}\nBatches processed: ${currentBatch}`);
        } else {
          // More batches to go
          Alert.alert('Batch Complete!', `Batch ${currentBatch} of ${totalBatches} completed!\n\nDownloaded: ${result.inserted.toLocaleString()} records\nTotal so far: ${updatedCount.toLocaleString()}\n\nClick Sync Data again to download next batch.`, [
            { text: 'OK' }
          ]);
        }
        
        // Force refresh the count display
        await refreshLocalCount();
      } else {
        throw new Error(result.message || 'Batch sync failed');
      }

    } catch (error) {
      console.error('Sync error:', error);
      Alert.alert('Sync Error', error.message || 'Failed to sync data');
      setDownloadStatus('Sync failed');
    } finally {
      setShowLoadingOverlay(false);
      setLoadingMessage('');
      setTimeout(() => setDownloading(false), 1000);
    }
  };

  const syncPerFile = async () => {
    if (downloading) return;
    setDownloading(true);
    setShowLoadingOverlay(true);
    setLoadingMessage('Preparing sync...');
    setDownloadProgress(0);
    setDownloadStatus('Listing files...');

    try {
      const res = await singleClickPerFileSync((p) => {
        try {
          // Use the enhanced progress tracking with percentage calculation
          const percentage = p?.percentage || 0;
          setDownloadProgress(percentage);
          
          if (p?.currentFile) {
            setDownloadStatus(`Downloading: ${p.currentFile} (${p.downloadedRecords || 0}/${p.totalRecords || 0} records)`);
          } else {
            setDownloadStatus('Downloading...');
          }
        } catch (_) {}
      }, 50000);

      const updatedCount = await countVehicles();
      setLocalCount(typeof updatedCount === 'number' ? updatedCount : 0);
      setLastDownloadedAt(new Date().toLocaleString());
      setLastSyncTime(new Date().toISOString());
      setDownloadProgress(100);
      setDownloadStatus('Sync complete');

      // Auto-close modal when 100% is reached - no completion alert
      setTimeout(() => {
        setShowLoadingOverlay(false);
        setLoadingMessage('');
        setDownloading(false);
      }, 1000);
    } catch (error) {
      console.error('Per-file sync failed:', error);
      setDownloadStatus('Sync failed');
      Alert.alert('Sync Failed', error?.message || 'Unable to sync');
    } finally {
      await refreshLocalCount();
    }
  };


  const refreshLocalCount = async () => {
    try {
      const count = await countVehicles();
      setLocalCount(count);
      console.log(`Refreshed local count: ${count}`);
      
      // Reload multiplier setting from server in case it was changed
      await loadMultiplierFromServer();
      
      // Auto-check for new records
      await checkForNewRecords();
    } catch (error) {
      console.error('Error refreshing count:', error);
    }
  };

  const checkForNewRecords = async () => {
    try {
      // Lightweight local heuristic to avoid noisy network retries
      const local = await countVehicles();
      const shouldSync = !local || local <= 0; // if no local data, recommend sync
      setNeedsSync(!!shouldSync);
      if (shouldSync) {
        console.log(`📊 Local-only sync check: no local data (${local}), needsSync=true`);
      }
      // Note: actual per-file status will be determined during sync; we allow manual trigger regardless
    } catch (error) {
      // On any error, keep sync available to the user
      setNeedsSync(true);
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

  useEffect(() => {
    if (drawerOpen) {
      drawerTranslate.setValue(-260);
      overlayOpacity.setValue(0);
      Animated.parallel([
        Animated.timing(drawerTranslate, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(overlayOpacity, { toValue: 1, duration: 250, useNativeDriver: true })
      ]).start();
    }
  }, [drawerOpen]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(contentFade, { toValue: 1, duration: 450, useNativeDriver: true }),
      Animated.timing(contentSlide, { toValue: 0, duration: 450, useNativeDriver: true })
    ]).start();
  }, []);

  // Spinner rotation animation
  useEffect(() => {
    if (showLoadingOverlay) {
      const startRotation = () => {
        spinnerRotation.setValue(0);
        Animated.loop(
          Animated.timing(spinnerRotation, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          })
        ).start();
      };
      startRotation();
    }
  }, [showLoadingOverlay, spinnerRotation]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}> 
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.bg} />
      <LinearGradient colors={isDark ? ["#0b1220", "#0b2a6f", "#0b1220"] : ["#e2e8f0", "#cbd5e1", "#e2e8f0"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFillObject} />
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => setDrawerOpen(true)} style={[styles.menuBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)' }]}>
          <Text style={[styles.menuIcon, { color: headerIconColor, fontSize: 24 }]}>≡</Text>
        </TouchableOpacity>
        <View style={styles.titleWrap}>
          <Text style={[styles.appTitle, { color: theme.textPrimary }]}>RapidRepo</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
          <Text style={[styles.link, { color: headerIconColor, fontSize: 22 }]}>👤</Text>
        </TouchableOpacity>
      </View>

      {/* Brand + search */}
      <Animated.View style={[styles.brandBlock, { opacity: contentFade, transform: [{ translateY: contentSlide }] }]}>
        <View style={styles.brandBadgeWrap}>
          <View style={styles.brandBadgeOuter}>
            <View style={styles.brandBadgeInner}>
              <Text style={{ fontSize: 36 }}>🚗</Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { borderColor: isDark ? '#0b1220' : '#e5e7eb' }]}>
            <Text style={styles.statusBadgeText}>{isOfflineMode ? 'Offline' : 'Online'}</Text>
          </View>
        </View>
        <Text style={[styles.orgName, { color: theme.textPrimary }]}>{agent?.tenantName || 'Your Organization'}</Text>
        <View style={styles.searchRow}>
          <View style={[styles.inputWrap, { flex: 0.5 }]}>
            <TextInput
              style={[styles.input, { paddingRight: 36, backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textPrimary }]}
              value={chassisValue}
              onChangeText={(t) => {
                const clean = String(t || '').toUpperCase().slice(0, 20);
                setChassisValue(clean);
              }}
              placeholder="Chassis Number"
              autoCapitalize="characters"
            />
            <Text style={styles.inputIcon}>🔍</Text>
          </View>
          <View style={[styles.inputWrap, { flex: 0.5 }]}>
            <TextInput
              style={[styles.input, { paddingRight: 36, backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textPrimary }]}
              value={searchValue}
              onChangeText={(t) => {
                const digits = String(t || '').replace(/\D/g, '').slice(0, 4);
                setSearchValue(digits);
              }}
              placeholder="4-Digit Reg"
              keyboardType="numeric"
              maxLength={4}
            />
            <Text style={styles.inputIcon}>🔍</Text>
          </View>
        </View>
        <Text style={[styles.searchHint, { color: theme.textSecondary }]}>
          Enter chassis number (3+ chars) or 4-digit registration number
        </Text>
      </Animated.View>

      {/* Stats cards */}
      <Animated.View style={[styles.statsGrid, { opacity: contentFade, transform: [{ translateY: contentSlide }] }]}>
        <View style={[styles.statCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
          <View>
            <Text style={[styles.statLabel, { color: theme.statLabel }]}>Local Records</Text>
            <Text style={[styles.statValue, { color: theme.textPrimary }]}>{String((localCount || 0) * dataMultiplier)}</Text>
          </View>
          <View style={styles.statIconBox}><Text style={{ fontSize: 18 }}>🗃️</Text></View>
        </View>
        <View style={[styles.statCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
          <View>
            <Text style={[styles.statLabel, { color: theme.statLabel }]}>Sync Status</Text>
            <Text style={[styles.statValue, { color: theme.textPrimary }]}>{isOfflineMode ? 'Offline' : 'Online'}</Text>
          </View>
          <View style={styles.statIconBox}><Text style={{ fontSize: 18 }}>{isOfflineMode ? '📴' : '📶'}</Text></View>
        </View>
      </Animated.View>

      {/* Sync Progress Card - Show only when sync is in progress */}
      {syncProgress.currentBatch > 0 && (
        <Animated.View style={[styles.syncProgressCard, { opacity: contentFade, transform: [{ translateY: contentSlide }] }]}>
          <View style={styles.syncProgressHeader}>
            <Text style={styles.syncProgressTitle}>Sync Progress</Text>
            <Text style={styles.syncProgressBatch}>Batch {syncProgress.currentBatch} of {syncProgress.totalBatches}</Text>
          </View>
          <View style={styles.syncProgressBarContainer}>
            <View style={styles.syncProgressBar}>
              <View 
                style={[
                  styles.syncProgressFill, 
                  { width: `${(syncProgress.currentBatch / syncProgress.totalBatches) * 100}%` }
                ]} 
              />
            </View>
            <Text style={styles.syncProgressText}>
              {syncProgress.downloadedRecords.toLocaleString()} records downloaded
            </Text>
          </View>
        </Animated.View>
      )}

      {/* Progress Bar - Hidden when overlay is shown */}
      {downloading && !showLoadingOverlay && (
        <ProgressBar progress={downloadProgress || 0} status={downloadStatus || ''} />
      )}

      {/* Info cards removed to keep dashboard minimal */}

      

      {/* Quick Actions */}
      <Animated.View style={[styles.grid, { opacity: contentFade, transform: [{ translateY: contentSlide }] }]}>
        <LinearGradient colors={["#F97316", "#EF4444"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.tileGradient}>
          <TouchableOpacity style={styles.tileContent}>
            <View>
              <Text style={styles.tileTitle}>Holds</Text>
              <Text style={styles.tileSubtitle}>Manage holds</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.tileIcon}>⏸️</Text>
              <Text style={styles.chev}>›</Text>
            </View>
          </TouchableOpacity>
        </LinearGradient>
        <LinearGradient colors={["#A855F7", "#4F46E5"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.tileGradient}>
          <TouchableOpacity style={styles.tileContent}>
            <View>
              <Text style={styles.tileTitle}>In Yard</Text>
              <Text style={styles.tileSubtitle}>Yard inventory</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.tileIcon}>📦</Text>
              <Text style={styles.chev}>›</Text>
            </View>
          </TouchableOpacity>
        </LinearGradient>
      </Animated.View>
      

      {/* Bottom bar with offline/online toggle and sync */}
      {/* <View style={styles.bottomBar}>
        <View style={styles.modeGroup}>
          <TouchableOpacity
            style={[styles.modeBtn, isOfflineMode && styles.modeBtnActive]}
            onPress={() => setIsOfflineMode(true)}
          >
            <Text style={[styles.modeBtnText, isOfflineMode && styles.modeBtnTextActive]}>Offline Mode</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, !isOfflineMode && styles.modeBtnActive]}
            onPress={() => setIsOfflineMode(false)}
          >
            <Text style={[styles.modeBtnText, !isOfflineMode && styles.modeBtnTextActive]}>Online Mode</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.downloadButtonsContainer}>
          <LinearGradient colors={["#10B981", "#059669"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.actionBtnGradient, downloading && { opacity: 0.7 }]}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={syncViaJsonDump}
              disabled={downloading}
            >
              <Text style={styles.bottomButtonText}>{downloading ? '⏳ Syncing...' : '✅ Sync Data'}</Text>
            </TouchableOpacity>
          </LinearGradient>
          <LinearGradient colors={["#3B82F6", "#4F46E5"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.actionBtnGradient}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={refreshLocalCount}
            >
              <Text style={styles.bottomButtonText}>🔄 Refresh</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </View> */}


      {/* Bottom bar with improved layout */}
      <View style={[styles.bottomBar, { backgroundColor: theme.bottomBarBg, borderTopColor: theme.bottomBarBorder, paddingBottom: insets.bottom + 12 }]}>
        {/* Mode Toggle Section */}
        <View style={styles.modeSection}>
          <Text style={[styles.modeSectionTitle, { color: theme.modeSectionTitle }]}>Connection Mode</Text>
          <View style={[styles.modeToggleContainer, { backgroundColor: theme.modeToggleContainer }]}>
            <TouchableOpacity
              style={[styles.modeToggleBtn, isOfflineMode && styles.modeToggleBtnActive]}
              onPress={() => setIsOfflineMode(true)}
            >
              <View style={styles.modeToggleContent}>
                <Text style={styles.modeToggleIcon}>📴</Text>
                <Text style={[styles.modeToggleText, { color: isOfflineMode ? '#111827' : theme.modeToggleText }]}>
                  Offline
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeToggleBtn, !isOfflineMode && styles.modeToggleBtnActive]}
              onPress={() => setIsOfflineMode(false)}
            >
              <View style={styles.modeToggleContent}>
                <Text style={styles.modeToggleIcon}>📶</Text>
                <Text style={[styles.modeToggleText, { color: !isOfflineMode ? '#111827' : theme.modeToggleText }]}>
                  Online
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Action Buttons Section removed (handled by Bulk Download screen) */}
      </View>

      {/* Loading Overlay */}
      {showLoadingOverlay && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingContainer}>
            <Animated.View style={[
              styles.loadingSpinner,
              {
                transform: [{
                  rotate: spinnerRotation.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '360deg']
                  })
                }]
              }
            ]}>
              <Text style={styles.loadingSpinnerText}>⏳</Text>
            </Animated.View>
            <Text style={styles.loadingTitle}>Downloading</Text>
            <Text style={styles.loadingMessage}>Please Wait...</Text>
            <View style={styles.loadingProgressContainer}>
              <View style={styles.loadingProgressBar}>
                <View 
                  style={[
                    styles.loadingProgressFill, 
                    { width: `${downloadProgress}%` }
                  ]} 
                />
              </View>
            </View>
          </View>
        </View>
      )}
      {/* Update Notification Modal */}
      {showUpdateModal && (
        <UpdateNotification
          visible={showUpdateModal}
          onClose={() => setShowUpdateModal(false)}
          updateInfo={availableUpdateInfo}
        />
      )}

      {/* Simple left drawer */}
      <Modal visible={drawerOpen} transparent animationType="none" onRequestClose={() => setDrawerOpen(false)}>
        <Animated.View style={[styles.drawerOverlay, { opacity: overlayOpacity }] }>
          <Animated.View style={[styles.drawer, { transform: [{ translateX: drawerTranslate }], backgroundColor: theme.drawerBg }] }>
            <View style={styles.drawerHeader}>
              <View style={styles.avatar}>
                <Text style={[styles.avatarText, { color: isDark ? '#c7d2fe' : '#3730A3' }]}>{String((agent?.name || 'A')[0] || 'A').toUpperCase()}</Text>
              </View>
              <View style={{ marginLeft: 12 }}>
                <Text style={[styles.drawerAgentName, { color: theme.drawerText }]}>{agent?.name || 'Agent'}</Text>
                <Text style={[styles.drawerAgentSub, { color: theme.drawerMuted }]}>{agent?.tenantName || 'Organization'}</Text>
              </View>
            </View>
            <Text style={[styles.drawerTitle, { color: theme.drawerMuted }]}>Menu</Text>
            <TouchableOpacity style={[styles.drawerItem, { backgroundColor: 'transparent' }]} onPress={() => { setDrawerOpen(false); }}>
              <Text style={[styles.drawerItemText, { color: theme.drawerText }]}>🏠  Dashboard</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.drawerItem, { backgroundColor: 'transparent' }]} onPress={() => { setDrawerOpen(false); navigation.navigate('IDCard'); }}>
              <Text style={[styles.drawerItemText, { color: theme.drawerText }]}>🆔  My ID Card</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.drawerItem, { backgroundColor: 'transparent' }]} onPress={() => { setDrawerOpen(false); navigation.navigate('BulkDownload'); }}>
              <Text style={[styles.drawerItemText, { color: theme.drawerText }]}>⬇️  Bulk Offline Download</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.drawerItem, { backgroundColor: 'transparent' }]} onPress={() => { setDrawerOpen(false); navigation.navigate('Settings'); }}>
              <Text style={[styles.drawerItemText, { color: theme.drawerText }]}>⚙️  Settings</Text>
            </TouchableOpacity>
            <View style={[styles.drawerDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F3F4F6' }]} />
            <TouchableOpacity style={[styles.drawerItem, { backgroundColor: isDark ? 'rgba(239,68,68,0.12)' : '#FEF2F2' }]} onPress={logout}>
              <Text style={[styles.drawerItemText, { color: isDark ? '#FCA5A5' : '#B91C1C' }]}>🚪  Logout</Text>
            </TouchableOpacity>
          </Animated.View>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setDrawerOpen(false)} />
        </Animated.View>
      </Modal>

    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#10121A', paddingHorizontal: 10, paddingBottom: 0 },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  menuBtn: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 8 },
  menuIcon: { color: '#fff', fontSize: 18, fontWeight: '900' },
  titleWrap: { flex: 1, alignItems: 'center' },
  appTitle: { color: '#fff', fontSize: 24, fontWeight: '900', letterSpacing: 1 },
  link: { color: '#9ecbff', fontSize: 14 },
  brandBlock: { alignItems: 'center', marginBottom: 14 },
  brandBadgeWrap: { width: 112, height: 112, marginTop: 2 },
  brandBadgeOuter: { flex: 1, borderRadius: 28, padding: 4, backgroundColor: 'rgba(59,130,246,0.5)' },
  brandBadgeInner: { flex: 1, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.95)', alignItems: 'center', justifyContent: 'center' },
  statusBadge: { position: 'absolute', right: -6, bottom: -6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, backgroundColor: '#10B981', borderWidth: 3, borderColor: '#0b1220' },
  statusBadgeText: { color: '#fff', fontWeight: '800', fontSize: 10, textTransform: 'uppercase' },
  orgName: { color: '#fff', fontSize: 22, fontWeight: '900', marginTop: 10 },
  searchRow: { flexDirection: 'row', gap: 8, width: '100%', marginTop: 12 },
  inputWrap: { position: 'relative' },
  input: { backgroundColor: '#ffffff', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  inputIcon: { position: 'absolute', right: 10, top: '50%', marginTop: -10 },
  searchHint: {
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic'
  },
  statsGrid: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  statCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginBottom: 4 },
  statValue: { color: '#fff', fontSize: 20, fontWeight: '900' },
  statIconBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(59,130,246,0.2)', alignItems: 'center', justifyContent: 'center' },
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
  tileGradient: { flex: 1, borderRadius: 18 },
  tileContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 18, paddingHorizontal: 18 },
  tileTitle: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
  tileSubtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2 },
  tileIcon: { fontSize: 24, color: '#fff', marginRight: 6 },
  chev: { color: '#fff', fontSize: 26, marginLeft: 6 },
  muted: { color: '#666', fontSize: 12 },
  bottomBar: { 
    // position: 'absolute', 
    // bottom: 12, 
    // left: 16, 
    // right: 16, 
    // flexDirection: 'row', 
    // alignItems: 'center', 
    // gap: 12 

    position: 'absolute', 
    bottom: 0, 
    left: 0, 
    right: 0, 
    backgroundColor: 'rgba(17, 24, 39, 0.95)',
    backdropFilter: 'blur(20px)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12
  },
   modeSection: {
    marginBottom: 16
  },
    modeSectionTitle: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    textAlign: 'center'
  },
    modeToggleContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(31, 41, 55, 0.8)',
    borderRadius: 16,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)'
  },
      modeToggleBtn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease'
  },
    modeToggleBtnActive: {
    backgroundColor: '#FACC15',
    shadowColor: '#FACC15',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3
  },
    modeToggleContent: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  
  bottomBar: { 
    position: 'absolute', 
    bottom: 0, 
    left: 0, 
    right: 0, 
    backgroundColor: 'rgba(17, 24, 39, 0.95)',
    backdropFilter: 'blur(20px)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 16,
    paddingTop: 16
  },
  
  // Mode Toggle Section
  modeSection: {
    marginBottom: 16
  },
  modeSectionTitle: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    textAlign: 'center'
  },
  modeToggleContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(31, 41, 55, 0.8)',
    borderRadius: 16,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)'
  },
  modeToggleBtn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease'
  },
  modeToggleBtnActive: {
    backgroundColor: '#FACC15',
    shadowColor: '#FACC15',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3
  },
  modeToggleContent: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  modeToggleIcon: {
    fontSize: 16,
    marginBottom: 4
  },
  modeToggleText: {
    color: '#9CA3AF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5
  },
  modeToggleTextActive: {
    color: '#111827'
  },





  modeGroup: { flex: 1, flexDirection: 'row', gap: 12 },
  modeBtn: {
    flex: 1,
    backgroundColor: '#111827',
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: 'center',
    borderWidth: 0
  },
  modeBtnActive: {
    backgroundColor: '#FACC15'
  },
  modeBtnText: {
    color: '#FFFFFF',
    fontWeight: '900'
  },
  modeBtnTextActive: {
    color: '#111827'
  },
  downloadButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
    flex: 1
  },






    // Action Buttons Section
  actionSection: {
    flexDirection: 'row',
    gap: 12
  },
  fullWidthActionGradient: {
    flex: 1,
    borderRadius: 16,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6
  },
  fullWidthActionBtn: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center'
  },

    actionBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12
  },

    actionBtnIcon: {
    fontSize: 20
  },

    actionBtnTextContainer: {
    alignItems: 'flex-start'
  },

    actionBtnTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3
  },

    actionBtnSubtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 9,
    fontWeight: '500',
    marginTop: 1
  },
  
  
  actionBtnGradient: { flex: 1, borderRadius: 24 },
  actionBtn: { paddingVertical: 18, paddingHorizontal: 18, alignItems: 'center' },
  bottomButtonText: { color: '#fff', fontWeight: '900', letterSpacing: 1 },
  drawerOverlay: { flex: 1, flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.4)' },
  drawer: { width: 280, backgroundColor: '#ffffff', paddingTop: 40, paddingHorizontal: 16, borderTopRightRadius: 16, borderBottomRightRadius: 16 },
  drawerHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#E0E7FF', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#3730A3', fontWeight: '800' },
  drawerAgentName: { fontSize: 16, fontWeight: '800', color: '#111827' },
  drawerAgentSub: { fontSize: 12, color: '#6B7280' },
  drawerTitle: { fontSize: 12, fontWeight: '800', color: '#9CA3AF', marginBottom: 8, marginTop: 8 },
  drawerItem: { paddingVertical: 12, paddingHorizontal: 8, borderRadius: 10 },
  drawerDivider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 8 },
  drawerItemText: { fontSize: 16, color: '#111827', fontWeight: '700' },
  // Loading Overlay Styles
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  loadingContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    minWidth: 280,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  loadingSpinner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  loadingSpinnerText: {
    fontSize: 30,
  },
  loadingTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  loadingMessage: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
  loadingProgressContainer: {
    width: '100%',
    alignItems: 'center',
  },
  loadingProgressBar: {
    width: '100%',
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 10,
  },
  loadingProgressFill: {
    height: '100%',
    backgroundColor: '#3B82F6',
    borderRadius: 4,
  },
  // Sync Progress Card Styles
  syncProgressCard: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  syncProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  syncProgressTitle: {
    color: '#3B82F6',
    fontSize: 16,
    fontWeight: '700',
  },
  syncProgressBatch: {
    color: '#1D4ED8',
    fontSize: 14,
    fontWeight: '600',
  },
  syncProgressBarContainer: {
    alignItems: 'center',
  },
  syncProgressBar: {
    width: '100%',
    height: 8,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  syncProgressFill: {
    height: '100%',
    backgroundColor: '#3B82F6',
    borderRadius: 4,
  },
  syncProgressText: {
    color: '#1D4ED8',
    fontSize: 12,
    fontWeight: '500',
  }
});
