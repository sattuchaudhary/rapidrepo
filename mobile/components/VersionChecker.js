import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import versionManager from '../utils/versionManager';
import otaUpdateManager from '../utils/otaUpdateManager';

const VersionChecker = ({ onUpdateAvailable }) => {
  const [checking, setChecking] = useState(false);

  const handleCheckForUpdates = async () => {
    setChecking(true);
    
    try {
      console.log('Checking for updates...');
      console.log('Current version:', versionManager.getCurrentVersion());
      
      // First check for OTA updates
      const otaUpdate = await otaUpdateManager.forceCheckForUpdates();
      
      if (otaUpdate) {
        console.log('OTA update available');
        setChecking(false);
        return;
      }
      
      console.log('No OTA update, checking app store updates...');
      
      // If no OTA update, check for app store updates
      const updateInfo = await versionManager.forceCheckForUpdates();
      
      console.log('Update info:', updateInfo);
      
      if (updateInfo) {
        console.log('App store update available');
        onUpdateAvailable(updateInfo);
      } else {
        console.log('No app store updates available');
        Alert.alert(
          'No Updates',
          `You are using the latest version of Rapid Repo!\n\nCurrent Version: ${versionManager.getCurrentVersion()}`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Version check failed:', error);
      Alert.alert(
        'Check Failed',
        `Unable to check for updates. Please try again later.\n\nError: ${error.message}`,
        [{ text: 'OK' }]
      );
    } finally {
      setChecking(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.checkButton}
        onPress={handleCheckForUpdates}
        disabled={checking}
      >
        <LinearGradient
          colors={['#4CAF50', '#45a049']}
          style={styles.gradient}
        >
          {checking ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.buttonText}>Check for Updates</Text>
          )}
        </LinearGradient>
      </TouchableOpacity>
      
      <Text style={styles.versionText}>
        Current Version: {versionManager.getCurrentVersion()}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    padding: 20,
  },
  checkButton: {
    borderRadius: 25,
    overflow: 'hidden',
    marginBottom: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  gradient: {
    paddingHorizontal: 30,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  versionText: {
    color: '#888',
    fontSize: 12,
  },
});

export default VersionChecker;
