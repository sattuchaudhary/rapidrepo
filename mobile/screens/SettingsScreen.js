import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ScrollView,
  Alert,
  ActivityIndicator
} from 'react-native';
import { getSyncStats, setAutoSyncEnabled, forceSync } from '../utils/smartBackgroundSync';
import { debugFileComparison } from '../utils/fileSync';

const SettingsScreen = () => {
  const [autoSyncEnabled, setAutoSyncEnabledState] = useState(false);
  const [syncStats, setSyncStats] = useState({
    enabled: true,
    lastSync: null,
    syncCount: 0,
    isRunning: false
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const stats = await getSyncStats();
      setSyncStats(stats);
      setAutoSyncEnabledState(stats.enabled);
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const handleAutoSyncToggle = async (value) => {
    try {
      await setAutoSyncEnabled(value);
      setAutoSyncEnabledState(value);
      await loadSettings();
      
      Alert.alert('Sync Disabled', 'Offline sync is disabled in this build.');
    } catch (error) {
      console.error('Error toggling auto sync:', error);
      Alert.alert('Error', 'Failed to update auto sync setting');
    }
  };


  const handleForceSync = async () => {
    if (syncStats.isRunning) {
      Alert.alert('Sync Running', 'Background sync is already in progress');
      return;
    }

    Alert.alert('Sync Disabled', 'Offline sync is disabled in this build.');
  };

  const handleDebugFiles = async () => {
    try {
      await debugFileComparison();
      Alert.alert(
        'Debug Complete',
        'File comparison details have been logged to console. Check the console for detailed information about which files need download.'
      );
    } catch (error) {
      Alert.alert('Debug Error', error.message);
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
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Sync Settings</Text>
        <Text style={styles.subtitle}>Manage background data synchronization</Text>
      </View>

      {/* Auto Sync Toggle */}
      <View style={styles.section}>
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Auto Background Sync</Text>
            <Text style={styles.settingDescription}>
              Automatically sync data in background when conditions are met
            </Text>
          </View>
          <Switch
            value={autoSyncEnabled}
            onValueChange={handleAutoSyncToggle}
            trackColor={{ false: '#767577', true: '#4CAF50' }}
            thumbColor={autoSyncEnabled ? '#ffffff' : '#f4f3f4'}
          />
        </View>
      </View>

      {/* Sync Statistics */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sync Statistics</Text>
        
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Status:</Text>
          <Text style={[styles.statValue, { color: syncStats.isRunning ? '#FF9800' : '#4CAF50' }]}>
            {syncStats.isRunning ? 'Running' : 'Idle'}
          </Text>
        </View>

        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Last Sync:</Text>
          <Text style={styles.statValue}>{formatDate(syncStats.lastSync)}</Text>
        </View>

        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Total Syncs:</Text>
          <Text style={styles.statValue}>{syncStats.syncCount}</Text>
        </View>
      </View>


      {/* Manual Sync */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Manual Sync</Text>
        
        <TouchableOpacity
          style={[styles.forceSyncButton, isLoading && styles.forceSyncButtonDisabled]}
          onPress={handleForceSync}
          disabled={isLoading || syncStats.isRunning}
        >
          {isLoading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.forceSyncButtonText}>
              {syncStats.isRunning ? 'Sync Running...' : 'Force Sync Now'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.forceSyncButton, { backgroundColor: '#FF9800', marginTop: 8 }]}
          onPress={handleDebugFiles}
        >
          <Text style={styles.forceSyncButtonText}>Debug File Comparison</Text>
        </TouchableOpacity>
      </View>

      {/* Smart Sync Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sync</Text>
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Offline sync is disabled in this build.</Text>
        </View>
      </View>
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
  section: {
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
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  settingDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
  },
  statValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  forceSyncButton: {
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  forceSyncButtonDisabled: {
    backgroundColor: '#ccc',
  },
  forceSyncButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  infoCard: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 6,
    marginBottom: 12,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
});

export default SettingsScreen;
