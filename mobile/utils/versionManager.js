import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { getBaseURL } from './config';

const VERSION_KEY = 'app_version';
const LAST_CHECK_KEY = 'last_version_check';
const UPDATE_DISMISSED_KEY = 'update_dismissed';

class VersionManager {
  constructor() {
    this.currentVersion = '1.0.1'; // Current app version from package.json
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
    if (!updateInfo || !updateInfo.success) return false;

    const { data } = updateInfo;
    const { latestVersion, forceUpdate, updateMessage, downloadUrl } = data;
    
    // Compare versions properly
    const isNewer = this.compareVersions(latestVersion, this.currentVersion) > 0;

    return {
      isAvailable: isNewer,
      forceUpdate,
      updateMessage,
      downloadUrl,
      latestVersion,
      currentVersion: this.currentVersion
    };
  }

  // Compare two version strings
  compareVersions(version1, version2) {
    const v1Parts = version1.split('.').map(Number);
    const v2Parts = version2.split('.').map(Number);
    
    const maxLength = Math.max(v1Parts.length, v2Parts.length);
    
    for (let i = 0; i < maxLength; i++) {
      const v1Part = v1Parts[i] || 0;
      const v2Part = v2Parts[i] || 0;
      
      if (v1Part > v2Part) return 1;
      if (v1Part < v2Part) return -1;
    }
    
    return 0;
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

  // Force check for updates (bypass time restrictions)
  async forceCheckForUpdates() {
    try {
      console.log('Force checking for updates...');
      const updateInfo = await this.checkForUpdates();
      console.log('Server response:', updateInfo);
      
      if (!updateInfo || !updateInfo.success) {
        console.log('No update info from server');
        return null;
      }

      const { data } = updateInfo;
      const { latestVersion, forceUpdate, updateMessage, downloadUrl } = data;
      
      console.log('Current version:', this.currentVersion);
      console.log('Latest version:', latestVersion);
      
      // Compare versions properly
      const isNewer = this.compareVersions(latestVersion, this.currentVersion) > 0;
      console.log('Is newer version available:', isNewer);

      if (isNewer) {
        return {
          isAvailable: true,
          forceUpdate,
          updateMessage,
          downloadUrl,
          latestVersion,
          currentVersion: this.currentVersion
        };
      }

      return null;
    } catch (error) {
      console.error('Force check failed:', error);
      return null;
    }
  }
}

export default new VersionManager();

