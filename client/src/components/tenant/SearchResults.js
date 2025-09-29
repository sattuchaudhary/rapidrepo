import React, { useEffect, useMemo, useState } from 'react';
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
  TablePagination,
  CircularProgress,
  Alert,
  TextField,
  Grid,
  Chip,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  Visibility as ViewIcon,
  TwoWheeler as TwoWheelerIcon,
  DirectionsCar as FourWheelerIcon,
  LocalShipping as CommercialIcon,
  Search as SearchIcon
} from '@mui/icons-material';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';

const SearchResults = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const [query, setQuery] = useState(params.get('q') || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [vehicleDetail, setVehicleDetail] = useState(null);

  const sanitizeRegInput = (value) => {
    const noSpaces = String(value || '').replace(/\s+/g, '');
    const alnum = noSpaces.replace(/[^a-zA-Z0-9]/g, '');
    return alnum.toUpperCase();
  };

  const isValidRegQuery = (value) => {
    const q = sanitizeRegInput(value);
    const isFourDigits = /^\d{4}$/.test(q);
    const fullReg = /^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{4}$/;
    return isFourDigits || fullReg.test(q);
  };

  const fetchResults = async () => {
    try {
      setLoading(true);
      setError('');
      const token = localStorage.getItem('token');
      const clean = sanitizeRegInput(query);
      const qs = new URLSearchParams({ q: clean, type: 'reg', limit: '400' });
      const res = await axios.get(`http://localhost:5000/api/tenant/data/search?${qs}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        setData(res.data.data || []);
      } else {
        throw new Error(res.data?.message || 'Search failed');
      }
    } catch (e) {
      setError(e.response?.data?.message || e.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const newQ = params.get('q') || '';
    setQuery(sanitizeRegInput(newQ));
  }, [params]);

  useEffect(() => {
    if (isValidRegQuery(query)) {
      fetchResults();
    } else {
      setData([]);
    }
  }, [query]);

  const getVehicleIcon = (vehicleType) => {
    switch (vehicleType) {
      case 'TwoWheeler': return <TwoWheelerIcon fontSize="small" />;
      case 'FourWheeler': return <FourWheelerIcon fontSize="small" />;
      case 'Commercial': return <CommercialIcon fontSize="small" />;
      default: return <TwoWheelerIcon fontSize="small" />;
    }
  };

  const openDetail = async (id) => {
    try {
      setDetailError('');
      setDetailLoading(true);
      setDetailOpen(true);
      const token = localStorage.getItem('token');
      const res = await axios.get(`http://localhost:5000/api/tenant/data/vehicle/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        setVehicleDetail(res.data.data);
      } else {
        throw new Error(res.data?.message || 'Failed to load details');
      }
    } catch (e) {
      setDetailError(e.response?.data?.message || e.message || 'Failed to load details');
    } finally {
      setDetailLoading(false);
    }
  };

  const updateStatus = async (id, status) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`http://localhost:5000/api/tenant/data/vehicle/${id}/status`, { status }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (vehicleDetail?._id === id) {
        setVehicleDetail({ ...vehicleDetail, status });
      }
    } catch (e) {
      alert(e.response?.data?.message || e.message || 'Failed to update status');
    }
  };

  return (
    <Box>
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SearchIcon color="primary" />
          <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
            Global Search
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, minWidth: 360 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Registration only: 4 digits or full number"
            value={query}
            onChange={(e) => setQuery(sanitizeRegInput(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const q = sanitizeRegInput(query);
                if (isValidRegQuery(q)) navigate(`/app/tenant/search?q=${encodeURIComponent(q)}`);
              }
            }}
          />
          <Button
            variant="contained"
            onClick={() => {
              const q = sanitizeRegInput(query);
              if (isValidRegQuery(q)) navigate(`/app/tenant/search?q=${encodeURIComponent(q)}`);
            }}
          >
            Search
          </Button>
        </Box>
      </Box>

      <Paper>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ m: 2 }}>
            {error}
          </Alert>
        )}

        {!loading && !error && (
          <>
            <TableContainer>
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Type</TableCell>
                    <TableCell>Reg No</TableCell>
                    <TableCell>Chassis No</TableCell>
                    <TableCell>Loan No</TableCell>
                    <TableCell>Bank</TableCell>
                    <TableCell>Make</TableCell>
                    <TableCell>Customer</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center">
                        <Typography variant="body2" color="text.secondary">
                          No results
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    data
                      .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                      .map((row) => (
                        <TableRow key={`${row._id}`} hover onClick={() => openDetail(row._id)} sx={{ cursor: 'pointer' }}>
                          <TableCell>
                            <Chip icon={getVehicleIcon(row.vehicleType)} label={row.vehicleType} size="small" />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" fontWeight="bold" color="primary">{row.regNo || '-'}</Typography>
                          </TableCell>
                          <TableCell>{row.chassisNo || '-'}</TableCell>
                          <TableCell>{row.loanNo || '-'}</TableCell>
                          <TableCell>{row.bank || '-'}</TableCell>
                          <TableCell>{row.make || '-'}</TableCell>
                          <TableCell>{row.customerName || '-'}</TableCell>
                        </TableRow>
                      ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              rowsPerPageOptions={[10, 25, 50, 100]}
              component="div"
              count={data.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={(event, newPage) => setPage(newPage)}
              onRowsPerPageChange={(event) => {
                setRowsPerPage(parseInt(event.target.value, 10));
                setPage(0);
              }}
            />
          </>
        )}
      </Paper>

      {/* Detail Modal */}
      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Vehicle Detail</DialogTitle>
        <DialogContent dividers>
          {detailLoading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          )}
          {detailError && (
            <Alert severity="error" sx={{ mb: 2 }}>{detailError}</Alert>
          )}
          {!!vehicleDetail && !detailLoading && (
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Typography variant="body2" color="text.secondary">Registration Number:</Typography>
                <Typography variant="body1" fontWeight="medium">{vehicleDetail.regNo || '-'}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Agreement Number:</Typography>
                <Typography variant="body1" fontWeight="medium">{vehicleDetail.loanNo || '-'}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Make:</Typography>
                <Typography variant="body1" fontWeight="medium">{vehicleDetail.make || '-'}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Engine Number:</Typography>
                <Typography variant="body1" fontWeight="medium">{vehicleDetail.engineNo || '-'}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>EMI Amount:</Typography>
                <Typography variant="body1" fontWeight="medium">{vehicleDetail.emiAmount || '-'}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Bucket:</Typography>
                <Typography variant="body1" fontWeight="medium">{vehicleDetail.bucket || '-'}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>File Name:</Typography>
                <Typography variant="body1" fontWeight="medium">{vehicleDetail.fileName || '-'}</Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="body2" color="text.secondary">Status:</Typography>
                <Chip label={vehicleDetail.status || 'Unknown'} size="small" color={vehicleDetail.status === 'Released' ? 'success' : 'warning'} />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Customer Name:</Typography>
                <Typography variant="body1" fontWeight="medium">{vehicleDetail.customerName || '-'}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Bank Name:</Typography>
                <Typography variant="body1" fontWeight="medium">{vehicleDetail.bank || '-'}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Chassis Number:</Typography>
                <Typography variant="body1" fontWeight="medium">{vehicleDetail.chassisNo || '-'}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Model:</Typography>
                <Typography variant="body1" fontWeight="medium">{vehicleDetail.model || '-'}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Upload Date:</Typography>
                <Typography variant="body1" fontWeight="medium">{vehicleDetail.uploadDate ? new Date(vehicleDetail.uploadDate).toLocaleDateString() : '-'}</Typography>
              </Grid>
              {/* Dynamic extra fields from raw document */}
              {vehicleDetail?.raw && (
                <Grid item xs={12}>
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>Additional Fields</Typography>
                    <Grid container spacing={1}>
                      {Object.entries(vehicleDetail.raw)
                        .filter(([k]) => ![
                          '_id','__v','registrationNumber','chassisNumber','agreementNumber','bankName','vehicleMake','customerName','address','branchName','status','engineNumber','engineNo','productName','emiAmount','pos','POS','model','vehicleModel','uploadDate','createdAt','bucket','season','seasoning','fileName'
                        ].includes(k))
                        .map(([key, value]) => (
                          <Grid key={key} item xs={12} md={4}>
                            <Typography variant="body2" color="text.secondary">{key}:</Typography>
                            <Typography variant="body1" fontWeight="medium">{String(value ?? '-')}</Typography>
                          </Grid>
                        ))}
                    </Grid>
                  </Box>
                </Grid>
              )}
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          {!!vehicleDetail && (
            <Box sx={{ display: 'flex', gap: 1, px: 2, py: 1 }}>
              <Button color="inherit" variant="contained" onClick={() => updateStatus(vehicleDetail._id, 'Pending')}>Pending</Button>
              <Button color="warning" variant="contained" onClick={() => updateStatus(vehicleDetail._id, 'Hold')}>Hold</Button>
              <Button color="secondary" variant="contained" onClick={() => updateStatus(vehicleDetail._id, 'In Yard')}>In Yard</Button>
              <Button color="success" variant="contained" onClick={() => updateStatus(vehicleDetail._id, 'Released')}>Release</Button>
              <Button color="error" variant="contained" onClick={() => updateStatus(vehicleDetail._id, 'Cancelled')}>Cancel</Button>
              <Box sx={{ flex: 1 }} />
              <Button onClick={() => setDetailOpen(false)}>Close</Button>
            </Box>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SearchResults;



