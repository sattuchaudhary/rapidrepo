import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './VersionManagement.css';

const VersionManagement = () => {
  const [versionConfig, setVersionConfig] = useState({
    currentVersion: '1.0.0',
    latestVersion: '1.0.0',
    forceUpdate: false,
    updateMessage: '',
    downloadUrl: {
      android: '',
      ios: '',
      web: ''
    },
    minSupportedVersion: '1.0.0',
    releaseNotes: []
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [newReleaseNote, setNewReleaseNote] = useState('');

  useEffect(() => {
    fetchVersionConfig();
  }, []);

  const fetchVersionConfig = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/mobile/version-config', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setVersionConfig(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch version config:', error);
      setMessage('Failed to fetch version configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/mobile/update-version', versionConfig, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setMessage('Version configuration updated successfully!');
        setVersionConfig(response.data.data);
      } else {
        setMessage('Failed to update version configuration');
      }
    } catch (error) {
      console.error('Failed to update version config:', error);
      setMessage('Failed to update version configuration');
    } finally {
      setSaving(false);
    }
  };

  const addReleaseNote = () => {
    if (newReleaseNote.trim()) {
      setVersionConfig(prev => ({
        ...prev,
        releaseNotes: [...prev.releaseNotes, newReleaseNote.trim()]
      }));
      setNewReleaseNote('');
    }
  };

  const removeReleaseNote = (index) => {
    setVersionConfig(prev => ({
      ...prev,
      releaseNotes: prev.releaseNotes.filter((_, i) => i !== index)
    }));
  };

  const handleInputChange = (field, value) => {
    setVersionConfig(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleDownloadUrlChange = (platform, value) => {
    setVersionConfig(prev => ({
      ...prev,
      downloadUrl: {
        ...prev.downloadUrl,
        [platform]: value
      }
    }));
  };

  if (loading) {
    return (
      <div className="version-management">
        <div className="loading">Loading version configuration...</div>
      </div>
    );
  }

  return (
    <div className="version-management">
      <div className="version-header">
        <h2>Mobile App Version Management</h2>
        <p>Manage app versions and update notifications for mobile users</p>
      </div>

      {message && (
        <div className={`message ${message.includes('success') ? 'success' : 'error'}`}>
          {message}
        </div>
      )}

      <div className="version-form">
        <div className="form-section">
          <h3>Version Information</h3>
          
          <div className="form-group">
            <label>Current Version:</label>
            <input
              type="text"
              value={versionConfig.currentVersion}
              onChange={(e) => handleInputChange('currentVersion', e.target.value)}
              placeholder="e.g., 1.0.0"
            />
          </div>

          <div className="form-group">
            <label>Latest Version:</label>
            <input
              type="text"
              value={versionConfig.latestVersion}
              onChange={(e) => handleInputChange('latestVersion', e.target.value)}
              placeholder="e.g., 1.1.0"
            />
          </div>

          <div className="form-group">
            <label>Minimum Supported Version:</label>
            <input
              type="text"
              value={versionConfig.minSupportedVersion}
              onChange={(e) => handleInputChange('minSupportedVersion', e.target.value)}
              placeholder="e.g., 1.0.0"
            />
          </div>

          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={versionConfig.forceUpdate}
                onChange={(e) => handleInputChange('forceUpdate', e.target.checked)}
              />
              Force Update (Critical update - users must update)
            </label>
          </div>
        </div>

        <div className="form-section">
          <h3>Update Message</h3>
          <div className="form-group">
            <label>Update Message:</label>
            <textarea
              value={versionConfig.updateMessage}
              onChange={(e) => handleInputChange('updateMessage', e.target.value)}
              placeholder="Enter update message to show to users..."
              rows="3"
            />
          </div>
        </div>

        <div className="form-section">
          <h3>Download URLs</h3>
          
          <div className="form-group">
            <label>Android (Play Store):</label>
            <input
              type="url"
              value={versionConfig.downloadUrl.android}
              onChange={(e) => handleDownloadUrlChange('android', e.target.value)}
              placeholder="https://play.google.com/store/apps/details?id=com.rapidbuddy.rapidrepo"
            />
          </div>

          <div className="form-group">
            <label>iOS (App Store):</label>
            <input
              type="url"
              value={versionConfig.downloadUrl.ios}
              onChange={(e) => handleDownloadUrlChange('ios', e.target.value)}
              placeholder="https://apps.apple.com/app/rapid-repo/id123456789"
            />
          </div>

          <div className="form-group">
            <label>Web:</label>
            <input
              type="url"
              value={versionConfig.downloadUrl.web}
              onChange={(e) => handleDownloadUrlChange('web', e.target.value)}
              placeholder="https://rapidbuddy.cloud"
            />
          </div>
        </div>

        <div className="form-section">
          <h3>Release Notes</h3>
          
          <div className="release-notes-list">
            {versionConfig.releaseNotes.map((note, index) => (
              <div key={index} className="release-note-item">
                <span>{note}</span>
                <button
                  type="button"
                  onClick={() => removeReleaseNote(index)}
                  className="remove-note-btn"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <div className="add-release-note">
            <input
              type="text"
              value={newReleaseNote}
              onChange={(e) => setNewReleaseNote(e.target.value)}
              placeholder="Add a new release note..."
              onKeyPress={(e) => e.key === 'Enter' && addReleaseNote()}
            />
            <button type="button" onClick={addReleaseNote} className="add-note-btn">
              Add
            </button>
          </div>
        </div>

        <div className="form-actions">
          <button
            onClick={handleSave}
            disabled={saving}
            className="save-btn"
          >
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default VersionManagement;

