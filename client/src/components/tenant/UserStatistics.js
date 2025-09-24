import React, { useEffect, useState } from 'react';
import { Box, Typography, Card, CardContent, Grid, TextField, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, CircularProgress } from '@mui/material';
import axios from 'axios';

const UserStatistics = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true); setError('');
      const res = await axios.get('http://localhost:5000/api/tenant/users/agents/stats/search', {
        params: { dateStart, dateEnd }
      });
      setRows(res.data?.data || []);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load statistics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  return (
    <Box>
      <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', mb: 2 }}>
        User Statistics
      </Typography>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4} md={3}>
              <TextField
                label="Start Date"
                type="date"
                value={dateStart}
                onChange={(e)=>setDateStart(e.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={4} md={3}>
              <TextField
                label="End Date"
                type="date"
                value={dateEnd}
                onChange={(e)=>setDateEnd(e.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={4} md={3}>
              <Button variant="contained" onClick={fetchData} sx={{ mt: { xs: 1.5, sm: 3 } }}>Apply</Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

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


























