import React, { useEffect, useMemo, useState } from 'react';
import { Box, Button, Typography, Grid, Select, MenuItem, InputLabel, FormControl, Paper, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Tooltip } from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import axios from 'axios';

const MobileUpload = () => {
  const [vehicleType, setVehicleType] = useState('');
  const [banks, setBanks] = useState([]);
  const [bankId, setBankId] = useState('');
  const [bankName, setBankName] = useState('');
  const [file, setFile] = useState(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchBanks = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get('http://localhost:5000/api/tenant/clients', { headers: { Authorization: `Bearer ${token}` }});
        if (res.data.success) setBanks(res.data.data);
      } catch (e) {
        console.error('Load banks failed', e);
      }
    };
    fetchBanks();
  }, []);

  useEffect(() => {
    const b = banks.find(b => String(b.id) === String(bankId));
    setBankName(b?.name || '');
  }, [bankId, banks]);

  const onUpload = async () => {
    if (!vehicleType || !file) return;
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const form = new FormData();
      form.append('vehicleType', vehicleType);
      form.append('bankId', bankId);
      form.append('bankName', bankName);
      form.append('file', file);
      const res = await axios.post('http://localhost:5000/api/tenant/mobile/upload', form, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.success) {
        alert(`Uploaded ${res.data.inserted} rows to ${res.data.database}.${res.data.collection}`);
      } else {
        alert(res.data.message || 'Upload failed');
      }
    } catch (e) {
      console.error('Upload error', e);
      alert(e.response?.data?.message || 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="h5" sx={{ fontWeight: 'bold' }}>Mobile Upload</Typography>
        <Tooltip title="Help">
          <Button size="large" startIcon={<HelpOutlineIcon />} onClick={() => setHelpOpen(true)}>Help</Button>
        </Tooltip>
      </Box>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="larges">
              <InputLabel>Select Vehicle Type</InputLabel>
              <Select value={vehicleType} label="Select Vehicle Type" onChange={(e) => setVehicleType(e.target.value)}>
                <MenuItem value={''}>– Select Vehicle Type –</MenuItem>
                <MenuItem value={'TwoWheeler'}>TwoWheeler</MenuItem>
                <MenuItem value={'FourWheeler'}>FourWheeler</MenuItem>
                <MenuItem value={'Commercial'}>CommercialWheeler</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="large">
              <InputLabel>Select a Bank</InputLabel>
              <Select value={bankId} label="Select a Bank" onChange={(e) => setBankId(e.target.value)}>
                <MenuItem value={''}>Select a Bank</MenuItem>
                {banks.map(b => (
                  <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={4}>
            <Button variant="outlined" component="label" sx={{ mr: 2 }}>
              Choose File
              <input hidden type="file" accept=".xlsx,.xls" onChange={(e) => setFile(e.target.files[0] || null)} />
            </Button>
            <Typography variant="body2" component="span">{file?.name || 'No file chosen'}</Typography>
          </Grid>
          <Grid item xs={12} md={2}>
            <Button fullWidth disabled={!vehicleType || !file || loading} variant="contained" onClick={onUpload}>Load File</Button>
          </Grid>
        </Grid>
      </Paper>

      <Paper sx={{ height: 480 }} />

      <Dialog open={helpOpen} onClose={() => setHelpOpen(false)} maxWidth="larg" fullWidth>
        <DialogTitle>Help</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2">Map your Excel columns to these fields as per your screenshot. We accept extra columns; unknown fields are saved under "raw".</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHelpOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MobileUpload;


