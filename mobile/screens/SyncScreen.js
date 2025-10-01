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
import { countVehicles, initDatabase } from '../utils/db';
import * as SecureStore from 'expo-secure-store';

const SyncScreen = () => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [localCount, setLocalCount] = useState(0);
  const [lastSync, setLastSync] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [needsSync, setNeedsSync] = useState(false);

  useEffect(() => {
    loadLocalData();
    return () => {};
  }, []);

  const loadLocalData = async () => {
    try {
      // Initialize database first
      await initDatabase();
      
      const count = await countVehicles();
      setLocalCount(count);
      
      setNeedsSync(false);
      setLastSync(null);
      
      // Log cleanup results if any
      if (perFile.cleanupResult && (perFile.cleanupResult.deletedFiles > 0 || perFile.cleanupResult.deletedRecords > 0)) {
        console.log(`🧹 Auto cleanup completed: ${perFile.cleanupResult.deletedFiles} files, ${perFile.cleanupResult.deletedRecords} records removed`);
      }
      
    } catch (error) {
      console.error('Error loading local data:', error);
      // Set default values on error
      setLocalCount(0);
      setLastSync(null);
      setNeedsSync(false);
    }
  };

  const handleSyncDisabled = async () => {
    Alert.alert('Sync Disabled', 'Offline sync is disabled in this build.');
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
        <Text style={styles.sectionTitle}>Sync Disabled</Text>
        <Text style={styles.methodDescription}>This build has offline sync turned off.</Text>
      </View>

      <View style={styles.actionContainer}>
        <TouchableOpacity
          style={[styles.syncButton, isDownloading && styles.syncButtonDisabled, needsSync ? { backgroundColor: '#EF4444' } : { backgroundColor: '#10B981' }]}
          onPress={handleSyncDisabled}
          disabled={isDownloading}
        >
          {isDownloading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.syncButtonText}>
              {isDownloading ? 'Syncing...' : (needsSync ? 'Sync Data' : 'Complete')}
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

      {false && <View />}

      <View style={styles.infoContainer}>
        <Text style={styles.infoTitle}>Sync Information</Text>
        <Text style={styles.infoText}>
          • Simple method: 1 lakh records per batch, most reliable
        </Text>
        <Text style={styles.infoText}>• Offline sync features are disabled.</Text>
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
