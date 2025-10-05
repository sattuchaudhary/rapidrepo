import React, { useEffect, useState } from 'react';
import { Box, Typography, TextField, Button, Card, CardContent, Alert } from '@mui/material';
import axios from 'axios';

const PaymentSettings = () => {
  const [upiId, setUpiId] = useState('');
  const [payeeName, setPayeeName] = useState('');
  const [qrCodeImageUrl, setQrCodeImageUrl] = useState('');
  const [instructions, setInstructions] = useState('');
  const [saving, setSaving] = useState(false);
  const [planPrices, setPlanPrices] = useState({ weekly: 0, monthly: 0, quarterly: 0, yearly: 0 });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadSettings = async () => {
    try {
      setError('');
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/tenants/settings', { headers: { Authorization: `Bearer ${token}` } });
      const cfg = res?.data?.data?.paymentConfig || {};
      setUpiId(cfg.upiId || '');
      setPayeeName(cfg.payeeName || '');
      setQrCodeImageUrl(cfg.qrCodeImageUrl || '');
      setInstructions(cfg.instructions || '');
      setPlanPrices(cfg.planPrices || { weekly: 0, monthly: 0, quarterly: 0, yearly: 0 });
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Failed to load settings');
    }
  };

  useEffect(() => { loadSettings(); }, []);

  const save = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');
      const token = localStorage.getItem('token');
      await axios.put('/api/tenants/settings', {
        paymentConfig: { upiId, payeeName, qrCodeImageUrl, instructions, planPrices }
      }, { headers: { Authorization: `Bearer ${token}` } });
      setSuccess('Payment settings updated');
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const uploadQR = async (e) => {
    try {
      const file = e.target.files?.[0];
      if (!file) return;
      setError(''); setSuccess('');
      const token = localStorage.getItem('token');
      const form = new FormData();
      form.append('file', file);
      const res = await axios.post('/api/uploads/tenant-qr', form, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
      });
      const url = res?.data?.url;
      if (url) setQrCodeImageUrl(url);
      setSuccess('QR uploaded');
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Upload failed');
    }
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 2 }}>Payment Settings</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
      <Card>
        <CardContent>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <TextField label="Payee Name" value={payeeName} onChange={(e) => setPayeeName(e.target.value)} fullWidth />
            <TextField label="UPI ID" value={upiId} onChange={(e) => setUpiId(e.target.value)} fullWidth />
            <TextField label="QR Code Image URL" value={qrCodeImageUrl} onChange={(e) => setQrCodeImageUrl(e.target.value)} fullWidth />
            <TextField label="Instructions" value={instructions} onChange={(e) => setInstructions(e.target.value)} fullWidth multiline minRows={3} />
            <TextField type="number" label="Weekly Price" value={planPrices.weekly} onChange={(e) => setPlanPrices({ ...planPrices, weekly: Number(e.target.value) || 0 })} fullWidth />
            <TextField type="number" label="Monthly Price" value={planPrices.monthly} onChange={(e) => setPlanPrices({ ...planPrices, monthly: Number(e.target.value) || 0 })} fullWidth />
            <TextField type="number" label="Quarterly Price" value={planPrices.quarterly} onChange={(e) => setPlanPrices({ ...planPrices, quarterly: Number(e.target.value) || 0 })} fullWidth />
            <TextField type="number" label="Yearly Price" value={planPrices.yearly} onChange={(e) => setPlanPrices({ ...planPrices, yearly: Number(e.target.value) || 0 })} fullWidth />
          </Box>
          <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
            <Button variant="contained" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
            <Button variant="outlined" onClick={loadSettings}>Reload</Button>
            <Button variant="outlined" component="label">
              Upload QR Image
              <input hidden type="file" accept="image/*" onChange={uploadQR} />
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default PaymentSettings;


