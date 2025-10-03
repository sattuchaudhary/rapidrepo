import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Grid,
  IconButton,
  Tooltip
} from '@mui/material';
import { 
  Person as PersonIcon, 
  Save as SaveIcon,
  Phone as PhoneIcon,
  PersonAdd as PersonAddIcon 
} from '@mui/icons-material';
import axios from 'axios';

const AgencyConfirmer = () => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [confirmers, setConfirmers] = useState([
    { name: '', phoneNumber: '8800011171' },
    { name: '', phoneNumber: '' },
    { name: '', phoneNumber: '' },
    { name: '', phoneNumber: '' },
    { name: '', phoneNumber: '' }
  ]);

  useEffect(() => {
    loadConfirmers();
  }, []);

  const loadConfirmers = async () => {
    try {
      setLoading(true);
      setError('');
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No authentication token found');
      
      const res = await axios.get('http://localhost:5000/api/tenant/agency-confirmers', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.data?.success) {
        const data = res.data.data || [];
        // Merge with defaults to ensure we always have 5 slots
        const mergedConfirmers = [
          ...Array(5).fill({ name: '', phoneNumber: '' }).map((_, index) => ({
            name: data[index]?.name || '',
            phoneNumber: data[index]?.phoneNumber || (index === 0 ? '8800011171' : '')
          }))
        ];
        setConfirmers(mergedConfirmers);
      } else {
        throw new Error(res.data?.message || 'Failed to load agency confirmers');
      }
    } catch (e) {
      console.error('Error loading confirmers:', e);
      // Don't show error to user, just keep default values
    } finally {
      setLoading(false);
    }
  };

  const saveConfirmers = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No authentication token found');
      
      // Validate data - only take non-empty confirmers
      const validConfirmers = confirmers.filter(c => c.name.trim() && c.phoneNumber.trim());
      
      // Validate phone numbers
      for (let confirmer of validConfirmers) {
        if (!/^\d{10}$/.test(confirmer.phoneNumber)) {
          throw new Error(`${confirmer.name || 'Confirmer'}: Phone number must be exactly 10 digits`);
        }
      }
      
      const res = await axios.put('http://localhost:5000/api/tenant/agency-confirmers', 
        { agencyConfirmers: validConfirmers },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (res.data?.success) {
        setSuccess('Agency confirmers saved successfully!');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        throw new Error(res.data?.message || 'Failed to save agency confirmers');
      }
    } catch (e) {
      setError(e.response?.data?.message || e.message || 'Failed to save agency confirmers');
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (index, field, value) => {
    const updatedConfirmers = [...confirmers];
    updatedConfirmers[index] = {
      ...updatedConfirmers[index],
      [field]: value
    };
    setConfirmers(updatedConfirmers);
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
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          backgroundColor: '#f5f5f5',
          padding: '8px 12px',
          borderRadius: '8px',
          mr: 2
        }}>
          <PersonIcon sx={{ mr: 1, color: 'primary.main', fontSize: '20px' }} />
        </Box>
        <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#333' }}>
          Agency Confirmers
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

      {/* Form Card */}
      <Card sx={{ 
        backgroundColor: '#ffffff',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        borderRadius: '12px'
      }}>
        <CardContent sx={{ p: 4 }}>
          <Grid container spacing={3}>
            {confirmers.map((confirmer, index) => (
              <Grid item xs={12} key={index}>
                <Box sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 2,
                  p: 2,
                  border: index < confirmers.length - 1 ? '1px solid #e0e0e0' : 'none',
                  borderBottom: index < confirmers.length - 1 ? '1px solid #e0e0e0' : 'none',
                  borderRadius: index === 0 ? '8px 8px 0 0' : index === confirmers.length - 1 ? '0 0 8px 8px' : 'none'
                }}>
                  <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center',
                    minWidth: '120px',
                    mr: 2
                  }}>
                    <PersonAddIcon sx={{ mr: 1, color: 'text.secondary' }} />
                    <Typography variant="body1" sx={{ fontWeight: 'medium', fontSize: '14px' }}>
                      Confirmer By{index + 1}:
                    </Typography>
                  </Box>
                  
                  <TextField
                    fullWidth
                    variant="outlined"
                    size="small"
                    placeholder="Enter confirmer name"
                    value={confirmer.name}
                    onChange={(e) => handleInputChange(index, 'name', e.target.value)}
                    sx={{
                      maxWidth: '300px',
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '6px',
                        backgroundColor: '#ffffff'
                      }
                    }}
                  />
                  
                  <Box sx={{ minWidth: '140px', mx: 2 }}>
                    <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1, fontSize: '12px' }}>
                      Confirmer Phone No{index + 1}:
                    </Typography>
                    <TextField
                      fullWidth
                      variant="outlined"
                      size="small"
                      placeholder="Enter phone number"
                      value={confirmer.phoneNumber}
                      onChange={(e) => handleInputChange(index, 'phoneNumber', e.target.value)}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: '6px',
                          backgroundColor: '#ffffff'
                        }
                      }}
                    />
                  </Box>
                </Box>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>

      {/* Save Button */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'flex-end', 
        mt: 3,
        pt: 2,
        borderTop: '1px solid #e0e0e0'
      }}>
        <Button
          variant="contained"
          startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
          onClick={saveConfirmers}
          disabled={saving}
          size="large"
          sx={{ 
            px: 4,
            py: 1.5,
            fontWeight: 'bold',
            backgroundColor: '#424242', // Dark gray as per image
            '&:hover': {
              backgroundColor: '#333333'
            },
            borderRadius: '8px'
          }}
        >
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </Box>
    </Box>
  );
};

export default AgencyConfirmer;

