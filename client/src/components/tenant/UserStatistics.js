import React, { useEffect, useState } from 'react';
import { Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, CircularProgress } from '@mui/material';
import axios from 'axios';

const UserStatistics = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true); setError('');
      const token = localStorage.getItem('token');
      const res = await axios.get('http://localhost:5000/api/tenant/users/agents/stats/search', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
      });
      setRows(res.data?.data || []);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load statistics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Schedule auto-refresh at next local midnight, then every 24h
    const now = new Date();
    const nextMidnight = new Date(now);
    nextMidnight.setHours(24, 0, 0, 0); // today 24:00 -> next day 00:00
    const msUntilMidnight = nextMidnight.getTime() - now.getTime();

    const midnightTimeout = setTimeout(() => {
      fetchData();
      // After first trigger, set daily interval
      const dailyInterval = setInterval(fetchData, 24 * 60 * 60 * 1000);
      // Store interval id on window to allow cleanup below
      // Using a symbol-like key to avoid collisions
      window.__tenantUserStatsDailyInterval = dailyInterval;
    }, msUntilMidnight);

    return () => {
      clearTimeout(midnightTimeout);
      if (window.__tenantUserStatsDailyInterval) {
        clearInterval(window.__tenantUserStatsDailyInterval);
        delete window.__tenantUserStatsDailyInterval;
      }
    };
  }, []);

  return (
    <Box>
      <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', mb: 2 }}>
        User Statistics
      </Typography>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 800 }}>Name</TableCell>
              <TableCell sx={{ fontWeight: 800 }}>No. of Vehicle Searched</TableCell>
              <TableCell sx={{ fontWeight: 800 }}>Total Hours Spent on App</TableCell>
              <TableCell sx={{ fontWeight: 800 }}>Login Count</TableCell>
              <TableCell sx={{ fontWeight: 800 }}>No. of times data synced</TableCell>
              <TableCell sx={{ fontWeight: 800 }}>Whatsapp usage count</TableCell>
              <TableCell sx={{ fontWeight: 800 }}>Last Searched</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} align="center"><CircularProgress size={20} /></TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">No data</TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={String(row.userId || row.name)}>
                  <TableCell>{row.name}</TableCell>
                  <TableCell>{row.vehiclesSearched || 0}</TableCell>
                  <TableCell>{(row.totalHours || 0).toFixed ? (row.totalHours || 0).toFixed(2) : row.totalHours || 0}</TableCell>
                  <TableCell>{row.loginCount || 0}</TableCell>
                  <TableCell>{row.dataSyncs || 0}</TableCell>
                  <TableCell>{row.whatsappCount || 0}</TableCell>
                  <TableCell>{row.lastSearchedAt ? new Date(row.lastSearchedAt).toLocaleString() : '-'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default UserStatistics;


























