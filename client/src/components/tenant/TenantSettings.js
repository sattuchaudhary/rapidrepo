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
  Grid
} from '@mui/material';
import { Settings as SettingsIcon, Save as SaveIcon } from '@mui/icons-material';
import axios from 'axios';

const TenantSettings = () => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [settings, setSettings] = useState({
    dataMultiplier: 1
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

      {/* Settings Cards */}
      <Grid container spacing={3}>
        {/* Mobile App Settings */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', mb: 3 }}>
                Mobile App Display Settings
              </Typography>
              
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
                  <MenuItem value={4}>4x (Show quadruple count)</MenuItem>
                </Select>
              </FormControl>

              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                This setting controls how the local record count is displayed in the mobile app. 
                If you have 10,000 actual records:
              </Typography>
              
              <Box sx={{ pl: 2, mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  • 1x multiplier → Shows 10,000 records
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  • 2x multiplier → Shows 20,000 records
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  • 4x multiplier → Shows 40,000 records
                </Typography>
              </Box>

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
            </CardContent>
          </Card>
        </Grid>

        {/* Future Settings */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', mb: 3 }}>
                Additional Settings
              </Typography>
              
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                More configuration options will be available here in future updates.
              </Typography>

              <Box sx={{ 
                bgcolor: 'grey.100', 
                p: 2, 
                borderRadius: 1,
                textAlign: 'center'
              }}>
                <Typography variant="body2" color="text.secondary">
                  Coming Soon...
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Divider sx={{ my: 3 }} />

      {/* Save Button */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
          onClick={saveSettings}
          disabled={saving}
          size="large"
          sx={{ 
            px: 4,
            py: 1.5,
            fontWeight: 'bold'
          }}
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </Box>
    </Box>
  );
};

export default TenantSettings;
