import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Alert,
  CircularProgress,
  Divider,
  Grid,
  ListItem,
  ListItemIcon,
  ListItemText,
  List,
  Collapse
} from '@mui/material';
import { 
  Settings as SettingsIcon,
  Save as SaveIcon,
  ExpandLess,
  ExpandMore,
  Storage as StorageIcon,
  Person as PersonIcon,
  Construction as ConstructionIcon
} from '@mui/icons-material';
import axios from 'axios';
import AgencyConfirmer from './AgencyConfirmer';

const TenantSettings = () => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [settings, setSettings] = useState({
    dataMultiplier: 1
  });
  const [expandedSettings, setExpandedSettings] = useState({
    syncMultiplier: true,
    agencyConfirmer: false,
    comingSoon: false
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      setError('');
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No authentication token found');
      
      const res = await axios.get('http://localhost:5000/api/tenants/settings', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.data?.success) {
        setSettings(res.data.data || { dataMultiplier: 1 });
      } else {
        throw new Error(res.data?.message || 'Failed to load settings');
      }
    } catch (e) {
      setError(e.response?.data?.message || e.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No authentication token found');
      
      const res = await axios.put('http://localhost:5000/api/tenants/settings', settings, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.data?.success) {
        setSuccess('Settings saved successfully!');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        throw new Error(res.data?.message || 'Failed to save settings');
      }
    } catch (e) {
      setError(e.response?.data?.message || e.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleMultiplierChange = (event) => {
    setSettings(prev => ({
      ...prev,
      dataMultiplier: event.target.value
    }));
  };

  const toggleSettingExpansion = (settingKey) => {
    setExpandedSettings(prev => ({
      syncMultiplier: false,
      agencyConfirmer: false,
      comingSoon: false,
      [settingKey]: !prev[settingKey]
    }));
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" sx={{ py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <SettingsIcon sx={{ mr: 2, color: 'primary.main' }} />
        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
          Tenant Settings
        </Typography>
      </Box>

      {/* Error/Success Messages */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 3 }}>
          {success}
        </Alert>
      )}

      {/* Settings Dropdown List */}
      <Card sx={{ mb: 3 }}>
        <List component="nav">
          {/* Sync Multiplier Label */}
          <ListItem 
            button 
            onClick={() => toggleSettingExpansion('syncMultiplier')}
            sx={{
              '&:hover': { backgroundColor: 'action.hover' }
            }}
          >
            <ListItemIcon>
              <StorageIcon sx={{ color: 'primary.main' }} />
            </ListItemIcon>
            <ListItemText primary="Sync Multiplier Label" />
            {expandedSettings.syncMultiplier ? <ExpandLess /> : <ExpandMore />}
          </ListItem>
          
          <Collapse in={expandedSettings.syncMultiplier} timeout="auto" unmountOnExit>
            <Box sx={{ px: 4, pb: 3 }}>
              <FormControl fullWidth sx={{ mb: 3 }}>
                <InputLabel id="multiplier-label">Data Count Multiplier</InputLabel>
                <Select
                  labelId="multiplier-label"
                  value={settings.dataMultiplier}
                  label="Data Count Multiplier"
                  onChange={handleMultiplierChange}
                >
                  <MenuItem value={1}>1x (Show actual count)</MenuItem>
                  <MenuItem value={2}>2x (Show double count)</MenuItem>
                  <MenuItem value={3}>3x (Show triple count)</MenuItem>
                  <MenuItem value={4}>4x (Show quadruple count)</MenuItem>
                  <MenuItem value={5}>5x (Show 5 times count)</MenuItem>
                  <MenuItem value={6}>6x (Show 6 times count)</MenuItem>
                </Select>
              </FormControl>

              <Box sx={{ 
                bgcolor: 'info.light', 
                color: 'info.contrastText', 
                p: 2, 
                borderRadius: 1,
                mb: 2
              }}>
                <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                  Current Setting: {settings.dataMultiplier}x multiplier
                </Typography>
                <Typography variant="body2">
                  Mobile apps will show {settings.dataMultiplier === 1 ? 'actual' : `${settings.dataMultiplier} times the actual`} record count
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  variant="contained"
                  startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
                  onClick={saveSettings}
                  disabled={saving}
                  size="large"
                  sx={{ px: 4, py: 1.5, fontWeight: 'bold' }}
                >
                  {saving ? 'Saving...' : 'Save Settings'}
                </Button>
              </Box>
            </Box>
          </Collapse>

          {/* Agency Confirmer */}
          <ListItem 
            button 
            onClick={() => toggleSettingExpansion('agencyConfirmer')}
            sx={{
              '&:hover': { backgroundColor: 'action.hover' }
            }}
          >
            <ListItemIcon>
              <PersonIcon sx={{ color: 'primary.main' }} />
            </ListItemIcon>
            <ListItemText primary="Agency Confirmer" />
            {expandedSettings.agencyConfirmer ? <ExpandLess /> : <ExpandMore />}
          </ListItem>
          
          <Collapse in={expandedSettings.agencyConfirmer} timeout="auto" unmountOnExit>
            <Box sx={{ px: 4, pb: 3 }}>
              <AgencyConfirmer />
            </Box>
          </Collapse>

          {/* Coming Soon */}
          <ListItem 
            button 
            onClick={() => toggleSettingExpansion('comingSoon')}
            sx={{
              '&:hover': { backgroundColor: 'action.hover' }
            }}
          >
            <ListItemIcon>
              <ConstructionIcon sx={{ color: 'text.secondary' }} />
            </ListItemIcon>
            <ListItemText primary="Coming Soon" />
            {expandedSettings.comingSoon ? <ExpandLess /> : <ExpandMore />}
          </ListItem>
          
          <Collapse in={expandedSettings.comingSoon} timeout="auto" unmountOnExit>
            <Box sx={{ px: 4, pb: 3 }}>
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                More configuration options will be available here in future updates.
              </Typography>
            </Box>
          </Collapse>
        </List>
      </Card>
    </Box>
  );
};

export default TenantSettings;
