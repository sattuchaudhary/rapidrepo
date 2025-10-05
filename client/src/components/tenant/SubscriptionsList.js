import React, { useEffect, useState } from 'react';
import { Box, Typography, Card, CardContent, Button, Alert, Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import axios from 'axios';

const SubscriptionsList = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      setLoading(true); setError('');
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/subscriptions', { headers: { Authorization: `Bearer ${token}` } });
      setItems(res?.data?.data || []);
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Failed to load subscriptions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 2 }}>User Subscriptions</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Card>
        <CardContent>
          <Button variant="outlined" onClick={load} disabled={loading} sx={{ mb: 2 }}>{loading ? 'Refreshing...' : 'Refresh'}</Button>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Mobile User ID</TableCell>
                <TableCell>User Type</TableCell>
                <TableCell>Start</TableCell>
                <TableCell>End</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((it) => {
                const active = it.endDate && new Date(it.endDate) > new Date();
                return (
                  <TableRow key={`${it.mobileUserId}`}>
                    <TableCell>{it.mobileUserId}</TableCell>
                    <TableCell>{it.userType}</TableCell>
                    <TableCell>{it.startDate ? new Date(it.startDate).toLocaleString() : '-'}</TableCell>
                    <TableCell>{it.endDate ? new Date(it.endDate).toLocaleString() : '-'}</TableCell>
                    <TableCell>{active ? 'Active' : 'Expired'}</TableCell>
                  </TableRow>
                );
              })}
              {items.length === 0 && (
                <TableRow><TableCell colSpan={5} align="center">No subscriptions yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </Box>
  );
};

export default SubscriptionsList;


