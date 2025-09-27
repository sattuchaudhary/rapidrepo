const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

// Version management configuration
const VERSION_CONFIG = {
  currentVersion: '1.0.0',
  latestVersion: '1.0.0', // Update this when new version is released
  forceUpdate: false, // Set to true for critical updates
  updateMessage: 'New features and bug fixes available!',
  downloadUrl: {
    android: 'https://play.google.com/store/apps/details?id=com.rapidbuddy.rapidrepo',
    ios: 'https://apps.apple.com/app/rapid-repo/id123456789', // Replace with actual App Store URL
    web: 'https://rapidbuddy.cloud'
  },
  minSupportedVersion: '1.0.0', // Minimum version that can still use the app
  releaseNotes: [
    'Bug fixes and performance improvements',
    'Enhanced user interface',
    'New search functionality',
    'Improved offline sync'
  ]
};

// Get version information
router.get('/version-check', auth, async (req, res) => {
  try {
    const { platform = 'android' } = req.query;
    
    const response = {
      success: true,
      data: {
        currentVersion: VERSION_CONFIG.currentVersion,
        latestVersion: VERSION_CONFIG.latestVersion,
        forceUpdate: VERSION_CONFIG.forceUpdate,
        updateMessage: VERSION_CONFIG.updateMessage,
        downloadUrl: VERSION_CONFIG.downloadUrl[platform] || VERSION_CONFIG.downloadUrl.android,
        minSupportedVersion: VERSION_CONFIG.minSupportedVersion,
        releaseNotes: VERSION_CONFIG.releaseNotes,
        platform,
        checkTime: new Date().toISOString()
      }
    };

    res.json(response);
  } catch (error) {
    console.error('Version check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check version',
      error: error.message
    });
  }
});

// Update version configuration (Admin only)
router.post('/update-version', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const {
      latestVersion,
      forceUpdate,
      updateMessage,
      downloadUrl,
      minSupportedVersion,
      releaseNotes
    } = req.body;

    // Update version configuration
    if (latestVersion) VERSION_CONFIG.latestVersion = latestVersion;
    if (typeof forceUpdate === 'boolean') VERSION_CONFIG.forceUpdate = forceUpdate;
    if (updateMessage) VERSION_CONFIG.updateMessage = updateMessage;
    if (downloadUrl) VERSION_CONFIG.downloadUrl = { ...VERSION_CONFIG.downloadUrl, ...downloadUrl };
    if (minSupportedVersion) VERSION_CONFIG.minSupportedVersion = minSupportedVersion;
    if (releaseNotes) VERSION_CONFIG.releaseNotes = releaseNotes;

    res.json({
      success: true,
      message: 'Version configuration updated successfully',
      data: VERSION_CONFIG
    });
  } catch (error) {
    console.error('Version update error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update version configuration',
      error: error.message
    });
  }
});

// Get current version configuration (Admin only)
router.get('/version-config', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    res.json({
      success: true,
      data: VERSION_CONFIG
    });
  } catch (error) {
    console.error('Version config error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get version configuration',
      error: error.message
    });
  }
});

module.exports = router;
