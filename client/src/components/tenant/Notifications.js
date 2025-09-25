import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  IconButton,
  Chip,
  CircularProgress,
  Pagination,
  Stack,
  Tooltip
} from '@mui/material';
import PlaceIcon from '@mui/icons-material/Place';
import ShareIcon from '@mui/icons-material/Share';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import TwoWheelerIcon from '@mui/icons-material/TwoWheeler';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import axios from 'axios';

const vehicleIconFor = (vehicleType) => {
  switch (vehicleType) {
    case 'two_wheeler':
      return <TwoWheelerIcon fontSize="small" />;
    case 'four_wheeler':
      return <DirectionsCarIcon fontSize="small" />;
    case 'cv':
      return <LocalShippingIcon fontSize="small" />;
    default:
      return <DirectionsCarIcon fontSize="small" />;
  }
};

const Notifications = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchNotifications = async (nextPage = 1) => {
    try {
      setLoading(true);
      setError('');
      const token = localStorage.getItem('token');
      const res = await axios.get(`http://localhost:5000/api/history/notifications?page=${nextPage}&pageSize=20`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        const apiItems = res.data.data.items || [];
        // Prefer normalized fields from API if present
        const mapped = apiItems.map((i) => ({
          ...i,
          displayName: i.displayName || (i.metadata?.userName) || 'User',
          vehicleNumber: i.vehicleNumber || i.metadata?.vehicleNumber || i.metadata?.vehicle_no || i.vehicleId,
          loanNumber: i.loanNumber || i.metadata?.loanNumber || i.metadata?.loan_no || 'N/A',
          bucket: (i.bucket !== undefined ? i.bucket : (i.metadata?.bucket ?? 'N/A'))
        }));
        setItems(mapped);
        setTotalPages(res.data.data.totalPages || 1);
        setPage(res.data.data.page || nextPage);
      } else {
        throw new Error(res.data?.message || 'Failed to load notifications');
      }
    } catch (e) {
      setError(e.response?.data?.message || e.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications(1);
  }, []);

  const handlePageChange = (_evt, value) => {
    fetchNotifications(value);
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 2 }}>
        Notifications
      </Typography>
      {loading && (
        <Box display="flex" justifyContent="center" sx={{ my: 3 }}>
          <CircularProgress />
        </Box>
      )}
      {error && (
        <Paper sx={{ p: 2, mb: 2, color: 'error.main' }}>{error}</Paper>
      )}

      <Stack spacing={1}>
        {items.map((n) => {
          const vehicleLabel = n.vehicleNumber || n.metadata?.vehicleNumber || n.metadata?.vehicle_no || n.metadata?.regNo || n.vehicleId;
          return (
          <Paper key={n._id} sx={{ p: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
              <Chip size="small" color="default" icon={<ShareIcon />} label={n.channel?.toUpperCase() || 'SHARE'} />
              <Typography variant="body2">
                <strong>{n.displayName || 'User'}</strong> verified details of vehicle no. <strong>{vehicleLabel}</strong>
                {` with loan no ${n.loanNumber || 'N/A'} and bucket ${n.bucket ?? 'N/A'}`}
              </Typography>
              <Chip size="small" variant="outlined" icon={vehicleIconFor(n.vehicleType)} label={n.vehicleType?.replace('_', ' ') || 'other'} />
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {new Date(n.createdAt).toLocaleString()}
              </Typography>
              <Tooltip title="View Location">
                <span>
                  <IconButton size="small" disabled={!n.metadata?.location}>
                    <PlaceIcon />
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
          </Paper>
        );})}
      </Stack>

      {totalPages > 1 && (
        <Box display="flex" justifyContent="center" sx={{ mt: 2 }}>
          <Pagination count={totalPages} page={page} onChange={handlePageChange} color="primary" />
        </Box>
      )}
    </Box>
  );
};

export default Notifications;


