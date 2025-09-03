import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  IconButton,
  Chip,
  CircularProgress,
  Alert,
  TablePagination,
  TextField
} from '@mui/material';
import {
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  Visibility as ViewIcon,
  AccessTime as ClockIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import axios from 'axios';


const PendingApprovals = () => {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  useEffect(() => {
    fetchPendingApprovals();
  }, []);

  const fetchPendingApprovals = async () => {
    try {
      setLoading(true);
      setError('');
      
      const token = localStorage.getItem('token');
      if (!token) {
        setError('No authentication token found. Please login again.');
        return;
      }
      
      console.log('Fetching pending approvals from API...');
      const response = await axios.get('http://localhost:5000/api/tenant/users/pending', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('API Response:', response.data);
      
      if (response.data.success) {
        setPendingUsers(response.data.data || []);
        console.log(`Loaded ${response.data.data?.length || 0} pending approvals from database`);
      } else {
        setError('Failed to fetch pending approvals: Invalid response format');
        setPendingUsers([]);
      }
    } catch (error) {
      console.error('Error fetching pending approvals:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
      setError(`Failed to fetch pending approvals: ${errorMessage}`);
      setPendingUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (userId) => {
    try {
      const token = localStorage.getItem('token');
      
      const response = await axios.put(`http://localhost:5000/api/tenant/users/${userId}/approve`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setSuccess('User approved successfully');
        fetchPendingApprovals(); // Refresh data
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (error) {
      console.error('Error approving user:', error);
      setError(`Failed to approve user: ${error.response?.data?.message || error.message}`);
    }
  };

  const handleReject = async (userId) => {
    try {
      const token = localStorage.getItem('token');
      
      const response = await axios.put(`http://localhost:5000/api/tenant/users/${userId}/reject`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setSuccess('User rejected successfully');
        fetchPendingApprovals(); // Refresh data
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (error) {
      console.error('Error rejecting user:', error);
      setError(`Failed to reject user: ${error.response?.data?.message || error.message}`);
    }
  };

  // Paginate pending users
  const paginatedPendingUsers = pendingUsers.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <ClockIcon sx={{ fontSize: 32, color: 'primary.main' }} />
        <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
          Pending Approvals
        </Typography>
      </Box>

      {/* Error Message */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Success Message */}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      {/* Actions */}
      <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={fetchPendingApprovals}
          disabled={loading}
          sx={{ 
            borderRadius: 2,
            borderColor: '#424242',
            color: '#424242',
            '&:hover': { 
              borderColor: '#616161',
              bgcolor: 'rgba(66, 66, 66, 0.04)'
            }
          }}
        >
          Refresh
        </Button>

        <Box sx={{ ml: 'auto', display: 'flex', gap: 2, alignItems: 'center' }}>
          <Typography variant="body2">Show:</Typography>
          <TextField
            select
            size="small"
            value={rowsPerPage}
            onChange={(e) => setRowsPerPage(parseInt(e.target.value))}
            sx={{ minWidth: 80 }}
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </TextField>
        </Box>
      </Box>

      {/* Pending Approvals Table */}
      <Paper sx={{ width: '100%', overflow: 'hidden' }}>
        <TableContainer>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>Id</TableCell>
                <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>Email</TableCell>
                <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>Phone</TableCell>
                <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>Address</TableCell>
                <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>OTP Verification</TableCell>
                <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>Payment Status</TableCell>
                <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }} align="center">Approve</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                    <CircularProgress size={24} />
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      Loading pending approvals...
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : paginatedPendingUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      {pendingUsers.length === 0 ? 'No pending approvals found.' : 'No approvals match your criteria.'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedPendingUsers.map((pendingUser) => (
                  <TableRow key={pendingUser._id || pendingUser.id} hover>
                    <TableCell>{pendingUser._id || pendingUser.id}</TableCell>
                    <TableCell>
                      <Typography variant="subtitle2" fontWeight="bold">
                        {pendingUser.fullName || pendingUser.name || 'N/A'}
                      </Typography>
                    </TableCell>
                    <TableCell>{pendingUser.email || 'N/A'}</TableCell>
                    <TableCell>{pendingUser.mobile || pendingUser.phone || 'N/A'}</TableCell>
                    <TableCell>{pendingUser.address || 'N/A'}</TableCell>
                    <TableCell>
                      <Chip 
                        label="Verified" 
                        size="small" 
                        color="success" 
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={pendingUser.paymentStatus || 'Pending'} 
                        size="small" 
                        color={pendingUser.paymentStatus === 'paid' ? 'success' : 'warning'} 
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Box display="flex" gap={1} justifyContent="center">
                        <IconButton 
                          size="small" 
                          color="primary"
                          onClick={() => handleApprove(pendingUser._id || pendingUser.id)}
                        >
                          <ApproveIcon />
                        </IconButton>
                        <IconButton 
                          size="small" 
                          color="error"
                          onClick={() => handleReject(pendingUser._id || pendingUser.id)}
                        >
                          <RejectIcon />
                        </IconButton>
                        <IconButton size="small" color="primary">
                          <ViewIcon />
                        </IconButton>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        
        <TablePagination
          rowsPerPageOptions={[10, 25, 50]}
          component="div"
          count={pendingUsers.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={(event, newPage) => setPage(newPage)}
          onRowsPerPageChange={(event) => {
            setRowsPerPage(parseInt(event.target.value, 10));
            setPage(0);
          }}
        />
      </Paper>

      {/* Record Count */}
      <Box sx={{ mt: 2, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          {pendingUsers.length} records found
        </Typography>
      </Box>
    </Box>
  );
};

export default PendingApprovals;
