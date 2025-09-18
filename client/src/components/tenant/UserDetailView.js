import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Box, Grid, Paper, Typography, Chip, Button, CircularProgress, Alert, TextField, MenuItem } from '@mui/material';
import axios from 'axios';

const LabelValue = ({ label, value }) => (
  <Box sx={{ mb: 2 }}>
    <Typography variant="caption" color="text.secondary">{label}</Typography>
    <Typography variant="body1" sx={{ fontWeight: 500 }}>{value || 'N/A'}</Typography>
  </Box>
);

const UserDetailView = ({ type }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        const id = location.pathname.split('/').pop();
        const url = type === 'staff'
          ? `http://localhost:5000/api/tenant/users/staff/${id}`
          : `http://localhost:5000/api/tenant/users/agents/${id}`;
        const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
        if (res.data.success) setData(res.data.data);
        else setError('Failed to fetch details');
      } catch (e) {
        setError(e.response?.data?.message || e.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [location.pathname, type]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setEditing(params.get('edit') === '1');
  }, [location.search]);

  const handleSave = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const id = location.pathname.split('/').pop();
      const url = type === 'staff'
        ? `http://localhost:5000/api/tenant/users/staff/${id}`
        : `http://localhost:5000/api/tenant/users/agents/${id}`;
      const payload = { ...data };
      delete payload._id; delete payload.__v; delete payload.createdAt; delete payload.updatedAt;
      const res = await axios.put(url, payload, { headers: { Authorization: `Bearer ${token}` } });
      if (res.data.success) {
        setData(res.data.data);
        setEditing(false);
      } else setError('Failed to update');
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>
    );
  }

  if (!data) return null;

  const header = type === 'staff' ? (data.staffCode || data.staffId) : (data.agentCode || data.agentId);

  return (
    <Box sx={{ p: 3, width: '100%' }}>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
          {type === 'staff' ? 'Office Staff' : 'Repo Agent'} Details
        </Typography>
        <Box>
          <Button variant="outlined" onClick={() => navigate(-1)} sx={{ mr: 1 }}>Back</Button>
          {!editing ? (
            <Button variant="contained" onClick={() => setEditing(true)} sx={{ mr: 1 }}>Edit</Button>
          ) : (
            <Button variant="contained" onClick={handleSave} sx={{ mr: 1 }}>Save</Button>
          )}
          <Chip label={data.status || 'active'} color={(data.status === 'inactive') ? 'error' : 'success'} />
        </Box>
      </Box>

      <Paper sx={{ p: 3, width: '100%' }}>
        <Grid container spacing={3} columns={{ xs: 12, md: 12 }}>
          <Grid item xs={12} md={6}>
            <LabelValue label="ID" value={header} />
            {!editing ? (
              <LabelValue label="Name" value={data.name} />
            ) : (
              <TextField fullWidth label="Name" value={data.name || ''} onChange={(e)=>setData({...data, name:e.target.value})} sx={{ mb:2 }} />
            )}
            {!editing ? (
              <LabelValue label="Phone Number" value={data.phoneNumber} />
            ) : (
              <TextField fullWidth label="Phone Number" value={data.phoneNumber || ''} onChange={(e)=>setData({...data, phoneNumber:e.target.value})} sx={{ mb:2 }} />
            )}
            {type === 'agent' && (!editing ? (
              <LabelValue label="Email" value={data.email} />
            ) : (
              <TextField fullWidth label="Email" value={data.email || ''} onChange={(e)=>setData({...data, email:e.target.value})} sx={{ mb:2 }} />
            ))}
            {!editing ? (
              <LabelValue label="Address" value={data.address} />
            ) : (
              <TextField fullWidth label="Address" value={data.address || ''} onChange={(e)=>setData({...data, address:e.target.value})} sx={{ mb:2 }} />
            )}
            {!editing ? (
              <LabelValue label="City" value={data.city} />
            ) : (
              <TextField fullWidth label="City" value={data.city || ''} onChange={(e)=>setData({...data, city:e.target.value})} sx={{ mb:2 }} />
            )}
            {!editing ? (
              <LabelValue label="State" value={data.state} />
            ) : (
              <TextField fullWidth label="State" value={data.state || ''} onChange={(e)=>setData({...data, state:e.target.value})} sx={{ mb:2 }} />
            )}
            {!editing ? (
              <LabelValue label="Zip code" value={data.zipCode} />
            ) : (
              <TextField fullWidth label="Zip code" value={data.zipCode || ''} onChange={(e)=>setData({...data, zipCode:e.target.value})} sx={{ mb:2 }} />
            )}
          </Grid>
          <Grid item xs={12} md={6}>
            {!editing ? (
              <LabelValue label="PAN Card No." value={data.panCardNo} />
            ) : (
              <TextField fullWidth label="PAN Card No." value={data.panCardNo || ''} onChange={(e)=>setData({...data, panCardNo:e.target.value})} sx={{ mb:2 }} />
            )}
            {!editing ? (
              <LabelValue label="Aadhaar Number" value={data.aadhaarNumber} />
            ) : (
              <TextField fullWidth label="Aadhaar Number" value={data.aadhaarNumber || ''} onChange={(e)=>setData({...data, aadhaarNumber:e.target.value})} sx={{ mb:2 }} />
            )}
            {!editing ? (
              <LabelValue label="Status" value={data.status} />
            ) : (
              <TextField select fullWidth label="Status" value={data.status || 'active'} onChange={(e)=>setData({...data, status:e.target.value})} sx={{ mb:2 }}>
                <MenuItem value="active">active</MenuItem>
                <MenuItem value="inactive">inactive</MenuItem>
                <MenuItem value="pending">pending</MenuItem>
              </TextField>
            )}
            <LabelValue label="OTP Verified" value={data.otpVerified ? 'Yes' : 'No'} />
            <LabelValue label="Created On" value={data.createdAt ? new Date(data.createdAt).toLocaleString() : 'N/A'} />
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
};

export default UserDetailView;


