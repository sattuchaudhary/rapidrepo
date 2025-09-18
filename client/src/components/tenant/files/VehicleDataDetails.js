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
  IconButton,
  Button,
  TextField,
  Grid,
  TablePagination,
  CircularProgress,
  Alert,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Breadcrumbs,
  Link,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Delete as DeleteIcon,
  TwoWheeler as TwoWheelerIcon,
  DirectionsCar as FourWheelerIcon,
  LocalShipping as CommercialIcon,
  CloudDownload as DownloadIcon
} from '@mui/icons-material';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import axios from 'axios';

const VehicleDataDetails = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { uploadId: routeUploadId } = useParams();
  const fallbackUploadId = React.useMemo(() => {
    try {
      const parts = (location?.pathname || '').split('/');
      return parts[parts.length - 1] || '';
    } catch (_) {
      return '';
    }
  }, [location?.pathname]);
  const uploadId = routeUploadId || fallbackUploadId;
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [search, setSearch] = useState('');
  const [chassisNumber, setChassisNumber] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [total, setTotal] = useState(0);
  const [uploadDetails, setUploadDetails] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [vehicleDetail, setVehicleDetail] = useState(null);

  // Fetch data from API
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        page: (page + 1).toString(),
        limit: rowsPerPage.toString(),
        search: search,
        chassisNumber: chassisNumber,
        registrationNumber: registrationNumber
      });

      const safeId = encodeURIComponent(uploadId || '');
      const response = await axios.get(`http://localhost:5000/api/tenant/data/file/${safeId}?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setData(response.data.data);
        setTotal(response.data.pagination.total);
        setUploadDetails(response.data.uploadDetails);
      } else {
        setError(response.data.message || 'Failed to fetch data');
      }
    } catch (err) {
      console.error('Error fetching vehicle data:', err);
      setError(err.response?.data?.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  // Fetch data on component mount and when parameters change
  useEffect(() => {
    if (uploadId) {
      fetchData();
    }
  }, [uploadId, page, rowsPerPage, search, chassisNumber, registrationNumber]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (page !== 0) setPage(0); // Reset to first page when searching
      else fetchData();
    }, 500);
    return () => clearTimeout(timer);
  }, [search, chassisNumber, registrationNumber]);

  const handleDelete = async (vehicleId) => {
    if (window.confirm('Are you sure you want to delete this vehicle record?')) {
      try {
        const token = localStorage.getItem('token');
        await axios.delete(`http://localhost:5000/api/tenant/data/vehicle/${vehicleId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        fetchData(); // Refresh data
      } catch (err) {
        console.error('Error deleting vehicle:', err);
        alert('Failed to delete vehicle record');
      }
    }
  };

  const getVehicleIcon = (vehicleType) => {
    switch (vehicleType) {
      case 'TwoWheeler': return <TwoWheelerIcon />;
      case 'FourWheeler': return <FourWheelerIcon />;
      case 'Commercial': return <CommercialIcon />;
      default: return <TwoWheelerIcon />;
    }
  };

  const handleBackToDataManagement = () => {
    if (uploadDetails?.vehicleType === 'TwoWheeler') {
      navigate('/tenant/files/two-wheeler');
    } else if (uploadDetails?.vehicleType === 'FourWheeler') {
      navigate('/tenant/files/four-wheeler');
    } else if (uploadDetails?.vehicleType === 'Commercial') {
      navigate('/tenant/files/cv');
    } else {
      navigate('/tenant/files/two-wheeler');
    }
  };

  const handleOpenDetail = (vehicle) => {
    setDetailError('');
    setDetailLoading(false);
    setVehicleDetail(vehicle || null);
    setDetailOpen(true);
  };

  const escapeCsv = (value) => {
    const str = value === null || value === undefined ? '' : String(value);
    if (/[",\n]/.test(str)) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  };

  const handleExportCSV = async () => {
    try {
      setExporting(true);
      const token = localStorage.getItem('token');
      // Fetch all filtered rows for this upload in one go (up to 100k)
      const params = new URLSearchParams({
        page: '1',
        limit: '100000',
        search,
        chassisNumber,
        registrationNumber
      });
      const safeId = encodeURIComponent(uploadId || '');
      const res = await axios.get(`http://localhost:5000/api/tenant/data/file/${safeId}?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const rows = res?.data?.data || [];
      const headers = ['Bank','Reg No','Loan No','Customer Name','Make','Chassis No','Engine No','Status'];
      const csvRows = [headers.join(',')];
      rows.forEach(v => {
        csvRows.push([
          escapeCsv(v.bank),
          escapeCsv(v.regNo),
          escapeCsv(v.loanNo),
          escapeCsv(v.customerName),
          escapeCsv(v.make),
          escapeCsv(v.chassisNo),
          escapeCsv(v.engineNo),
          escapeCsv(v.status)
        ].join(','));
      });
      const csvContent = '\uFEFF' + csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const ts = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
      const base = uploadDetails?.fileName || 'vehicle-data';
      link.download = `${base}-export-${ts}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  
  return (
    <Box>
      {/* Header with Breadcrumbs */}
      <Box sx={{ mb: 2 }}>
        <Breadcrumbs sx={{ mb: 1 }}>
          <Link 
            color="inherit" 
            href="#" 
            onClick={(e) => {
              e.preventDefault();
              handleBackToDataManagement();
            }}
            sx={{ textDecoration: 'none', cursor: 'pointer' }}
          >
            Data Management
          </Link>
          <Typography color="text.primary">Vehicle Data</Typography>
        </Breadcrumbs>
        
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {uploadDetails && getVehicleIcon(uploadDetails.vehicleType)}
            <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
              Vehicle Data
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button 
              variant="outlined" 
              color="primary"
              startIcon={<DownloadIcon />}
              disabled={exporting || total === 0}
              onClick={handleExportCSV}
            >
              Export CSV
            </Button>
            <Button 
              variant="outlined" 
              startIcon={<BackIcon />}
              onClick={handleBackToDataManagement}
            >
              Back to data management
            </Button>
          </Box>
        </Box>
      </Box>

      {/* File Information */}
      {uploadDetails && (
        <Paper sx={{ p: 2, mb: 2, bgcolor: 'grey.50' }}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={3}>
              <Typography variant="body2" color="text.secondary">File Name</Typography>
              <Typography variant="body1" fontWeight="medium">{uploadDetails.fileName}</Typography>
            </Grid>
            <Grid item xs={12} md={3}>
              <Typography variant="body2" color="text.secondary">Bank Name</Typography>
              <Typography variant="body1" fontWeight="medium">{uploadDetails.bankName}</Typography>
            </Grid>
            <Grid item xs={12} md={3}>
              <Typography variant="body2" color="text.secondary">Vehicle Type</Typography>
              <Typography variant="body1" fontWeight="medium">{uploadDetails.vehicleType}</Typography>
            </Grid>
            <Grid item xs={12} md={3}>
              <Typography variant="body2" color="text.secondary">Total Records</Typography>
              <Typography variant="body1" fontWeight="medium">{uploadDetails.totalRecords?.toLocaleString()}</Typography>
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* Search and Filter Controls */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              size="small"
              label="Chassis Number"
              value={chassisNumber}
              onChange={(e) => setChassisNumber(e.target.value)}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              size="small"
              label="Registration Number"
              value={registrationNumber}
              onChange={(e) => setRegistrationNumber(e.target.value)}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              size="small"
              label="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Show entries</InputLabel>
              <Select
                value={rowsPerPage}
                onChange={(e) => {
                  setRowsPerPage(e.target.value);
                  setPage(0);
                }}
                label="Show entries"
              >
                <MenuItem value={10}>10</MenuItem>
                <MenuItem value={25}>25</MenuItem>
                <MenuItem value={50}>50</MenuItem>
                <MenuItem value={100}>100</MenuItem>
                <MenuItem value={1000}>1,000</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      {/* Data Table */}
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
                    <TableCell>Bank</TableCell>
                    <TableCell>Reg No</TableCell>
                    <TableCell>Loan No</TableCell>
                    <TableCell>Customer Name</TableCell>
                    <TableCell>Make</TableCell>
                    <TableCell>Chassis No</TableCell>
                    <TableCell>Engine No</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="center">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} align="center">
                        <Typography variant="body2" color="text.secondary">
                          No vehicle data found for this file.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.map((vehicle) => (
                      <TableRow key={vehicle._id} hover onClick={() => handleOpenDetail(vehicle)} sx={{ cursor: 'pointer' }}>
                        <TableCell>
                          <Typography variant="body2" fontWeight="medium">
                            {vehicle.bank}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight="bold" color="primary">
                            {vehicle.regNo}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {vehicle.loanNo}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight="medium">
                            {vehicle.customerName}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={vehicle.make} 
                            color="primary" 
                            size="small" 
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {vehicle.chassisNo}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {vehicle.engineNo}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={vehicle.status}
                            color="warning"
                            size="small"
                          />
                        </TableCell>
                        <TableCell align="center">
                          <IconButton 
                            size="small" 
                            color="primary" 
                            title="View Details"
                            onClick={(e) => { e.stopPropagation(); handleOpenDetail(vehicle); }}
                          >
                            <BackIcon style={{ transform: 'rotate(180deg)' }} />
                          </IconButton>
                          <IconButton 
                            size="small" 
                            color="error" 
                            title="Delete"
                            onClick={(e) => { e.stopPropagation(); handleDelete(vehicle._id); }}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              rowsPerPageOptions={[10, 25, 50, 100]}
              component="div"
              count={total}
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

      {/* Vehicle detail drawer/dialog */}
      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="lg" fullWidth>
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
                <Typography variant="body1" fontWeight="medium">{vehicleDetail.agreementNo || vehicleDetail.loanNo || '-'}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Make:</Typography>
                <Typography variant="body1" fontWeight="medium">{vehicleDetail.make || '-'}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Engine Number:</Typography>
                <Typography variant="body1" fontWeight="medium">{vehicleDetail.engineNo || '-'}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Product Name:</Typography>
                <Typography variant="body1" fontWeight="medium">{vehicleDetail.productName || '-'}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>EMI Amount:</Typography>
                <Typography variant="body1" fontWeight="medium">{vehicleDetail.emiAmount || '-'}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Branch:</Typography>
                <Typography variant="body1" fontWeight="medium">{vehicleDetail.branch || '-'}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>File Name:</Typography>
                <Typography variant="body1" fontWeight="medium">{uploadDetails?.fileName || '-'}</Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="body2" color="text.secondary">Status:</Typography>
                <Chip label={vehicleDetail.status || 'Unknown'} size="small" color={vehicleDetail.status === 'ok' ? 'success' : 'warning'} />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Customer Name:</Typography>
                <Typography variant="body1" fontWeight="medium">{vehicleDetail.customerName || '-'}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Bank Name:</Typography>
                <Typography variant="body1" fontWeight="medium">{vehicleDetail.bank || '-'}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Chassis Number:</Typography>
                <Typography variant="body1" fontWeight="medium">{vehicleDetail.chassisNo || '-'}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Model:</Typography>
                <Typography variant="body1" fontWeight="medium">{vehicleDetail.model || '-'}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Upload Date:</Typography>
                <Typography variant="body1" fontWeight="medium">{uploadDetails?.createdAt ? new Date(uploadDetails.createdAt).toLocaleDateString() : '-'}</Typography>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default VehicleDataDetails;
