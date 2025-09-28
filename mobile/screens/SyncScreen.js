import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  RefreshControl,
  ActivityIndicator
} from 'react-native';
import { runHeadlessOfflineSync } from '../utils/offlineSync';
import SyncManager from '../utils/SyncManager';
import { countVehicles, initDatabase } from '../utils/db';
import DownloadProgress from '../components/DownloadProgress';
import { validateProgressData } from '../utils/errorHandler';
import { testDatabase } from '../utils/dbTest';
import { simpleSync, getSyncStatus, markSyncCompleted } from '../utils/simpleSync';
import * as SecureStore from 'expo-secure-store';

const SyncScreen = () => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [localCount, setLocalCount] = useState(0);
  const [lastSync, setLastSync] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [syncMethod, setSyncMethod] = useState('simple'); // 'simple' | 'optimized' | 'legacy' | 'missing_only'
  const [progress, setProgress] = useState(null);
  const [needsSync, setNeedsSync] = useState(false);

  useEffect(() => {
    loadLocalData();
    const unsub = SyncManager.subscribe(async (state) => {
      if (!state.isSyncing && state.result) {
        try { await loadLocalData(); } catch (_) {}
      }
    });
    return unsub;
  }, []);

  const loadLocalData = async () => {
    try {
      // Initialize database first
      await initDatabase();
      
      const count = await countVehicles();
      setLocalCount(count);
      
      // Get sync status
      const syncStatus = await getSyncStatus();
      setNeedsSync(syncStatus.needsSync);
      setLastSync(syncStatus.lastSync);
      
    } catch (error) {
      console.error('Error loading local data:', error);
      // Set default values on error
      setLocalCount(0);
      setLastSync(null);
      setNeedsSync(false);
    }
  };

  const handleSimpleSync = async () => {
    setIsDownloading(true);
    setProgress({ processed: 0, total: 0, percentage: 0 });
    
    try {
      const result = await simpleSync((progressData) => {
        setProgress(progressData);
      });
      
      if (result.success) {
        await markSyncCompleted();
        Alert.alert(
          'Sync Successful',
          `Downloaded ${result.totalDownloaded.toLocaleString()} records in ${result.batchesProcessed} batches!\n\nInserted: ${result.totalInserted.toLocaleString()}\nCleaned: ${result.extraRecordsCleaned.toLocaleString()}`,
          [{ text: 'OK', onPress: loadLocalData }]
        );
      } else {
        Alert.alert('Sync Failed', result.message || 'Unknown error occurred');
      }
    } catch (error) {
      console.error('Simple sync error:', error);
      Alert.alert('Sync Error', error.message || 'Failed to sync data');
    } finally {
      setIsDownloading(false);
      setProgress(null);
    }
  };

  const handleOptimizedSync = async () => {
    setIsDownloading(true);
    try {
      const { started, result } = await SyncManager.start('optimized');
      if (!started) {
        Alert.alert('Sync Running', 'A sync is already in progress.');
      }
      // Completion toast/alert handled by reloading stats on focus or pull-to-refresh
    } catch (error) {
      console.error('Sync error:', error);
      Alert.alert('Sync Error', error.message || 'Failed to sync data');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleLegacySync = async () => {
    setIsDownloading(true);
    setProgress({ processed: 0, total: 0, percentage: 0 });

    try {
      const result = await runHeadlessOfflineSync();

      if (result.success) {
        Alert.alert(
          'Sync Successful',
          `Downloaded ${result.inserted.toLocaleString()} records successfully!`,
          [{ text: 'OK', onPress: loadLocalData }]
        );
      } else {
        Alert.alert('Sync Failed', result.message || 'Unknown error occurred');
      }
    } catch (error) {
      console.error('Sync error:', error);
      Alert.alert('Sync Error', error.message || 'Failed to sync data');
    } finally {
      setIsDownloading(false);
      setProgress(null);
    }
  };

  const handleMissingOnlySync = async () => {
    setIsDownloading(true);
    try {
      const { started, result } = await SyncManager.start('missing_only');
      if (!started) {
        Alert.alert('Sync Running', 'A sync is already in progress.');
      }
    } catch (error) {
      console.error('Sync error:', error);
      Alert.alert('Sync Error', error.message || 'Failed to sync data');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadLocalData();
    setRefreshing(false);
  };

  const handleTestDatabase = async () => {
    try {
      const success = await testDatabase();
      Alert.alert(
        success ? 'Database Test Passed' : 'Database Test Failed',
        success ? 'Database is working correctly!' : 'Database has issues. Check logs for details.'
      );
    } catch (error) {
      Alert.alert('Database Test Error', error.message);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return 'Unknown';
    }
  };

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>Data Sync</Text>
        <Text style={styles.subtitle}>Download vehicle data for offline use</Text>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{localCount.toLocaleString()}</Text>
          <Text style={styles.statLabel}>Local Records</Text>
        </View>
        
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{formatDate(lastSync).split(' ')[0]}</Text>
          <Text style={styles.statLabel}>Last Sync</Text>
        </View>
      </View>

      <View style={styles.methodContainer}>
        <Text style={styles.sectionTitle}>Sync Method</Text>
        
        <TouchableOpacity
          style={[
            styles.methodButton,
            syncMethod === 'simple' && styles.methodButtonActive
          ]}
          onPress={() => setSyncMethod('simple')}
        >
          <Text style={[
            styles.methodButtonText,
            syncMethod === 'simple' && styles.methodButtonTextActive
          ]}>
            Simple (Recommended)
          </Text>
          <Text style={styles.methodDescription}>
            1 lakh records per batch, auto cleanup, most reliable
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.methodButton,
            syncMethod === 'optimized' && styles.methodButtonActive
          ]}
          onPress={() => setSyncMethod('optimized')}
        >
          <Text style={[
            styles.methodButtonText,
            syncMethod === 'optimized' && styles.methodButtonTextActive
          ]}>
            Optimized (Fast)
          </Text>
          <Text style={styles.methodDescription}>
            Uses compression and bulk download for fastest sync
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.methodButton,
            syncMethod === 'legacy' && styles.methodButtonActive
          ]}
          onPress={() => setSyncMethod('legacy')}
        >
          <Text style={[
            styles.methodButtonText,
            syncMethod === 'legacy' && styles.methodButtonTextActive
          ]}>
            Legacy (Compatible)
          </Text>
          <Text style={styles.methodDescription}>
            Uses chunked download for maximum compatibility
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.methodButton,
            syncMethod === 'missing_only' && styles.methodButtonActive
          ]}
          onPress={() => setSyncMethod('missing_only')}
        >
          <Text style={[
            styles.methodButtonText,
            syncMethod === 'missing_only' && styles.methodButtonTextActive
          ]}>
            Missing Only (By ID)
          </Text>
          <Text style={styles.methodDescription}>
            Download only records not present locally; keeps exact parity
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.actionContainer}>
        <TouchableOpacity
          style={[styles.syncButton, isDownloading && styles.syncButtonDisabled]}
          onPress={
            syncMethod === 'simple'
              ? handleSimpleSync
              : syncMethod === 'optimized'
                ? handleOptimizedSync
                : syncMethod === 'legacy'
                  ? handleLegacySync
                  : handleMissingOnlySync
          }
          disabled={isDownloading}
        >
          {isDownloading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.syncButtonText}>
              {isDownloading ? 'Syncing...' : 'Start Sync'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.refreshButton}
          onPress={handleRefresh}
          disabled={isDownloading}
        >
          <Text style={styles.refreshButtonText}>Refresh Stats</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.refreshButton, { backgroundColor: '#FF9800' }]}
          onPress={handleTestDatabase}
          disabled={isDownloading}
        >
          <Text style={styles.refreshButtonText}>Test Database</Text>
        </TouchableOpacity>
      </View>

      {isDownloading && progress && (
        <View style={styles.progressContainer}>
          <Text style={styles.progressTitle}>Sync Progress</Text>
          <DownloadProgress progress={progress} />
          {syncMethod === 'simple' && (
            <View style={styles.simpleProgressInfo}>
              <Text style={styles.progressText}>
                Batch: {progress.currentBatch || 0} records
              </Text>
              <Text style={styles.progressText}>
                Inserted: {progress.inserted || 0} records
              </Text>
            </View>
          )}
        </View>
      )}

      <View style={styles.infoContainer}>
        <Text style={styles.infoTitle}>Sync Information</Text>
        <Text style={styles.infoText}>
          • Simple method: 1 lakh records per batch, most reliable
        </Text>
        <Text style={styles.infoText}>
          • Optimized method downloads all data in one compressed request
        </Text>
        <Text style={styles.infoText}>
          • Legacy method downloads data in smaller chunks
        </Text>
        <Text style={styles.infoText}>
          • Data is stored locally for offline access
        </Text>
        <Text style={styles.infoText}>
          • Sync may take several minutes for large datasets
        </Text>
        {needsSync && (
          <Text style={[styles.infoText, { color: '#FF5722', fontWeight: 'bold' }]}>
            ⚠️ Sync recommended - data may be outdated
          </Text>
        )}
      </View>

      {/* Global overlay handles progress; keep screen light */}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: 'white',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 20,
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  methodContainer: {
    backgroundColor: 'white',
    margin: 20,
    padding: 16,
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  methodButton: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    marginBottom: 12,
  },
  methodButtonActive: {
    borderColor: '#4CAF50',
    backgroundColor: '#f8fff8',
  },
  methodButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  methodButtonTextActive: {
    color: '#4CAF50',
  },
  methodDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  actionContainer: {
    padding: 20,
  },
  syncButton: {
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  syncButtonDisabled: {
    backgroundColor: '#ccc',
  },
  syncButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  refreshButton: {
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  refreshButtonText: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: 'bold',
  },
  infoContainer: {
    backgroundColor: 'white',
    margin: 20,
    padding: 16,
    borderRadius: 8,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  progressContainer: {
    backgroundColor: 'white',
    margin: 20,
    padding: 16,
    borderRadius: 8,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  simpleProgressInfo: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#f0f8ff',
    borderRadius: 6,
  },
  progressText: {
    fontSize: 14,
    color: '#1976D2',
    marginBottom: 4,
  },
});

export default SyncScreen;
