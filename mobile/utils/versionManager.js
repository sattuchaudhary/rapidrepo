import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { getBaseURL } from './config';

const VERSION_KEY = 'app_version';
const LAST_CHECK_KEY = 'last_version_check';
const UPDATE_DISMISSED_KEY = 'update_dismissed';

class VersionManager {
  constructor() {
    this.currentVersion = '1.0.0'; // Current app version from package.json
    this.baseURL = getBaseURL();
  }

  // Get current app version
  getCurrentVersion() {
    return this.currentVersion;
  }

  // Check for updates from server
  async checkForUpdates() {
    try {
      const token = await SecureStore.getItemAsync('token');
      if (!token) return null;

      const response = await fetch(`${this.baseURL}/api/mobile/version-check`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to check for updates');
      }

      const data = await response.json();
      
      // Store last check time
      await SecureStore.setItemAsync(LAST_CHECK_KEY, Date.now().toString());
      
      return data;
    } catch (error) {
      console.error('Version check failed:', error);
      return null;
    }
  }

  // Check if update is available
  async isUpdateAvailable() {
    const updateInfo = await this.checkForUpdates();
    if (!updateInfo) return false;

    const { latestVersion, forceUpdate, updateMessage, downloadUrl } = updateInfo;
    
    // Compare versions
    const currentVersionParts = this.currentVersion.split('.').map(Number);
    const latestVersionParts = latestVersion.split('.').map(Number);
    
    const isNewer = latestVersionParts.some((part, index) => 
      part > (currentVersionParts[index] || 0)
    );

    return {
      isAvailable: isNewer,
      forceUpdate,
      updateMessage,
      downloadUrl,
      latestVersion,
      currentVersion: this.currentVersion
    };
  }

  // Check if user has dismissed this version update
  async isUpdateDismissed(version) {
    try {
      const dismissedVersion = await SecureStore.getItemAsync(UPDATE_DISMISSED_KEY);
      return dismissedVersion === version;
    } catch (error) {
      return false;
    }
  }

  // Mark update as dismissed
  async dismissUpdate(version) {
    try {
      await SecureStore.setItemAsync(UPDATE_DISMISSED_KEY, version);
    } catch (error) {
      console.error('Failed to dismiss update:', error);
    }
  }

  // Check if enough time has passed since last check (to avoid frequent checks)
  async shouldCheckForUpdates() {
    try {
      const lastCheck = await SecureStore.getItemAsync(LAST_CHECK_KEY);
      if (!lastCheck) return true;

      const lastCheckTime = parseInt(lastCheck);
      const now = Date.now();
      const hoursSinceLastCheck = (now - lastCheckTime) / (1000 * 60 * 60);

      // Check every 6 hours
      return hoursSinceLastCheck >= 6;
    } catch (error) {
      return true;
    }
  }

  // Get update info for display
  async getUpdateInfo() {
    const shouldCheck = await this.shouldCheckForUpdates();
    if (!shouldCheck) return null;

    const updateInfo = await this.isUpdateAvailable();
    if (!updateInfo || !updateInfo.isAvailable) return null;

    // Check if user has already dismissed this version
    const isDismissed = await this.isUpdateDismissed(updateInfo.latestVersion);
    if (isDismissed && !updateInfo.forceUpdate) return null;

    return updateInfo;
  }

  // Clear dismissed update (for testing)
  async clearDismissedUpdate() {
    try {
      await SecureStore.deleteItemAsync(UPDATE_DISMISSED_KEY);
    } catch (error) {
      console.error('Failed to clear dismissed update:', error);
    }
  }
}

export default new VersionManager();
