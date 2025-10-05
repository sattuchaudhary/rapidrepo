import React, { useEffect, useState } from 'react';
import { Box, Typography, Card, CardContent, Button, Alert, Table, TableBody, TableCell, TableHead, TableRow, Chip } from '@mui/material';
import axios from 'axios';

const PaymentApprovals = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/payments?status=pending', { headers: { Authorization: `Bearer ${token}` } });
      setItems(res?.data?.data || []);
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Failed to load payments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const approve = async (id) => {
    try {
      setSuccess(''); setError('');
      const token = localStorage.getItem('token');
      await axios.post(`/api/payments/${id}/approve`, {}, { headers: { Authorization: `Bearer ${token}` } });
      setSuccess('Payment approved');
      load();
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Approval failed');
    }
  };

  const reject = async (id) => {
    try {
      setSuccess(''); setError('');
      const token = localStorage.getItem('token');
      await axios.post(`/api/payments/${id}/reject`, {}, { headers: { Authorization: `Bearer ${token}` } });
      setSuccess('Payment rejected');
      load();
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Rejection failed');
    }
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 2 }}>Payment Approvals</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
      <Card>
        <CardContent>
          <Button variant="outlined" onClick={load} disabled={loading} sx={{ mb: 2 }}>{loading ? 'Refreshing...' : 'Refresh'}</Button>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Mobile User ID</TableCell>
                <TableCell>Plan</TableCell>
                <TableCell>Amount</TableCell>
                <TableCell>Txn ID</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map(p => (
                <TableRow key={p._id}>
                  <TableCell>{new Date(p.createdAt).toLocaleString()}</TableCell>
                  <TableCell>{p.submittedByMobileId || '-'}</TableCell>
                  <TableCell>{p.planPeriod}</TableCell>
                  <TableCell>{p.amount}</TableCell>
                  <TableCell>{p.transactionId}</TableCell>
                  <TableCell>{p.status}</TableCell>
                  <TableCell>
                    <Button size="small" variant="contained" color="success" onClick={() => approve(p._id)} sx={{ mr: 1 }}>Approve</Button>
                    <Button size="small" variant="outlined" color="error" onClick={() => reject(p._id)}>Reject</Button>
                  </TableCell>
                </TableRow>
              ))}
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center">No pending requests</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </Box>
  );
};

export default PaymentApprovals;


