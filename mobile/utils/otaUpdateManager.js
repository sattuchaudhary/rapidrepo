import * as Updates from 'expo-updates';
import { Alert, Platform } from 'react-native';

class OTAUpdateManager {
  constructor() {
    this.isChecking = false;
  }

  // Check for OTA updates
  async checkForOTAUpdates() {
    if (this.isChecking) return false;
    
    try {
      this.isChecking = true;
      
      // Only check for updates in production builds
      if (!Updates.isEnabled) {
        console.log('OTA updates are not enabled in development');
        return false;
      }

      const update = await Updates.checkForUpdateAsync();
      
      if (update.isAvailable) {
        console.log('OTA update available');
        return {
          isAvailable: true,
          manifest: update.manifest
        };
      } else {
        console.log('No OTA updates available');
        return { isAvailable: false };
      }
    } catch (error) {
      console.error('Error checking for OTA updates:', error);
      return { isAvailable: false, error: error.message };
    } finally {
      this.isChecking = false;
    }
  }

  // Download and install OTA update
  async downloadAndInstallUpdate() {
    try {
      if (!Updates.isEnabled) {
        throw new Error('OTA updates are not enabled');
      }

      const update = await Updates.checkForUpdateAsync();
      
      if (!update.isAvailable) {
        throw new Error('No updates available');
      }

      // Download the update
      await Updates.fetchUpdateAsync();
      
      // Install the update
      await Updates.reloadAsync();
      
      return true;
    } catch (error) {
      console.error('Error downloading/installing OTA update:', error);
      throw error;
    }
  }

  // Show OTA update notification
  showOTAUpdateNotification(updateInfo) {
    const { manifest } = updateInfo;
    
    Alert.alert(
      'App Update Available',
      `A new version of Rapid Repo is available. Would you like to update now?`,
      [
        {
          text: 'Later',
          style: 'cancel'
        },
        {
          text: 'Update Now',
          onPress: () => this.downloadAndInstallUpdate()
        }
      ]
    );
  }

  // Check if running on a development build
  isDevelopmentBuild() {
    return __DEV__ || !Updates.isEnabled;
  }

  // Get current update info
  async getCurrentUpdateInfo() {
    try {
      const updateId = Updates.updateId;
      const channel = Updates.channel;
      const runtimeVersion = Updates.runtimeVersion;
      
      return {
        updateId,
        channel,
        runtimeVersion,
        isEnabled: Updates.isEnabled
      };
    } catch (error) {
      console.error('Error getting update info:', error);
      return null;
    }
  }

  // Force check for updates (for manual checking)
  async forceCheckForUpdates() {
    try {
      if (this.isDevelopmentBuild()) {
        Alert.alert(
          'Development Mode',
          'OTA updates are not available in development mode. Please build a production version to test updates.',
          [{ text: 'OK' }]
        );
        return false;
      }

      const updateInfo = await this.checkForOTAUpdates();
      
      if (updateInfo.isAvailable) {
        this.showOTAUpdateNotification(updateInfo);
        return true;
      } else {
        Alert.alert(
          'No Updates',
          'You are using the latest version of Rapid Repo!',
          [{ text: 'OK' }]
        );
        return false;
      }
    } catch (error) {
      Alert.alert(
        'Update Check Failed',
        'Unable to check for updates. Please try again later.',
        [{ text: 'OK' }]
      );
      return false;
    }
  }
}

export default new OTAUpdateManager();

