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

  // UI helpers
  const StatusColor = (status) => {
    const s = String(status || '').toLowerCase();
    if (s === 'released' || s === 'ok') return 'success';
    if (s === 'in yard' || s === 'inyard') return 'secondary';
    if (s === 'hold') return 'warning';
    if (s === 'cancelled' || s === 'canceled') return 'error';
    return 'warning';
  };

  const FieldRow = ({ label, value }) => (
    <Box sx={{ display: 'flex', gap: 1, mb: 0.75, alignItems: 'baseline' }}>
      <Typography variant="caption" color="text.secondary" sx={{ minWidth: 140 }}>{label}:</Typography>
      <Typography variant="body2" fontWeight="medium" sx={{ wordBreak: 'break-word' }}>{value}</Typography>
    </Box>
  );

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
      const response = await axios.get(`/api/tenant/data/file/${safeId}?${params}`, {
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
        await axios.delete(`/api/tenant/data/vehicle/${vehicleId}`, {
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
      navigate('/app/tenant/files/two-wheeler');
    } else if (uploadDetails?.vehicleType === 'FourWheeler') {
      navigate('/app/tenant/files/four-wheeler');
    } else if (uploadDetails?.vehicleType === 'Commercial') {
      navigate('/app/tenant/files/cv');
    } else {
      navigate('/app/tenant/files/two-wheeler');
    }
  };

  const handleOpenDetail = async (vehicle) => {
    setDetailError('');
    setDetailOpen(true);
    const vehicleId = vehicle?._id;
    if (!vehicleId) {
      setVehicleDetail(vehicle || null);
      return;
    }
    try {
      setDetailLoading(true);
      const token = localStorage.getItem('token');
      const res = await axios.get(`/api/tenant/data/vehicle/${vehicleId}` , {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res?.data?.success) {
        setVehicleDetail(res.data.data || vehicle);
      } else {
        setVehicleDetail(vehicle || null);
        setDetailError(res?.data?.message || 'Failed to load details');
      }
    } catch (e) {
      console.error('Vehicle detail fetch error:', e);
      setVehicleDetail(vehicle || null);
      setDetailError(e?.response?.data?.message || 'Failed to load details');
    } finally {
      setDetailLoading(false);
    }
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
      const res = await axios.get(`/api/tenant/data/file/${safeId}?${params}`, {
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
              <Typography variant="body1" fontWeight="medium">{total?.toLocaleString?.() || total}</Typography>
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
      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="xl" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>Vehicle Detail</DialogTitle>
        <DialogContent dividers sx={{ bgcolor: 'grey.50', p: 2 }}>
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
              <Grid item xs={12}>
                <Paper variant="outlined" sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="subtitle1" sx={{ flex: 1, fontWeight: 700 }}>Basic Details</Typography>
                  <Chip label={vehicleDetail.status || 'Unknown'} size="small" color={StatusColor(vehicleDetail.status)} sx={{ ml: 'auto' }} />
                </Paper>
              </Grid>

              <Grid item xs={12}>
                <Paper variant="outlined" sx={{ p: 1.5 }}>
                  <Grid container spacing={1}>
                    <Grid item xs={12} md={4}><FieldRow label="Registration Number" value={vehicleDetail.regNo || 'N/A'} /></Grid>
                    <Grid item xs={12} md={4}><FieldRow label="Agreement Number" value={vehicleDetail.agreementNo || vehicleDetail.loanNo || 'N/A'} /></Grid>
                    <Grid item xs={12} md={4}><FieldRow label="Make" value={vehicleDetail.make || 'N/A'} /></Grid>
                    <Grid item xs={12} md={4}><FieldRow label="Engine Number" value={vehicleDetail.engineNo || 'N/A'} /></Grid>
                    <Grid item xs={12} md={4}><FieldRow label="Product Name" value={vehicleDetail.productName || 'N/A'} /></Grid>
                    <Grid item xs={12} md={4}><FieldRow label="EMI Amount" value={vehicleDetail.emiAmount || 'N/A'} /></Grid>
                    <Grid item xs={12} md={4}><FieldRow label="Branch" value={vehicleDetail.branch || 'N/A'} /></Grid>
                    <Grid item xs={12} md={4}><FieldRow label="File Name" value={uploadDetails?.fileName || vehicleDetail.fileName || 'N/A'} /></Grid>
                    <Grid item xs={12} md={4}><FieldRow label="Customer Name" value={vehicleDetail.customerName || 'N/A'} /></Grid>
                    <Grid item xs={12} md={4}><FieldRow label="Bank Name" value={vehicleDetail.bank || 'N/A'} /></Grid>
                    <Grid item xs={12} md={4}><FieldRow label="Chassis Number" value={vehicleDetail.chassisNo || 'N/A'} /></Grid>
                    <Grid item xs={12} md={4}><FieldRow label="Model" value={vehicleDetail.model || 'N/A'} /></Grid>
                    <Grid item xs={12} md={4}><FieldRow label="Upload Date" value={(vehicleDetail.uploadDate || uploadDetails?.createdAt) ? new Date(vehicleDetail.uploadDate || uploadDetails.createdAt).toLocaleDateString() : 'N/A'} /></Grid>
                    <Grid item xs={12} md={4}><FieldRow label="Address" value={vehicleDetail.address || 'N/A'} /></Grid>
                    <Grid item xs={12} md={4}><FieldRow label="POS" value={vehicleDetail.pos || 'N/A'} /></Grid>
                    <Grid item xs={12} md={4}><FieldRow label="Season" value={vehicleDetail.season || 'N/A'} /></Grid>
                  </Grid>
                </Paper>
              </Grid>

              {(vehicleDetail.inYard || vehicleDetail.yardName || vehicleDetail.yardLocation) && (
                <Grid item xs={12}>
                  <Paper variant="outlined" sx={{ p: 1.5 }}>
                    <Typography variant="subtitle2" gutterBottom>Yard Info</Typography>
                    <Grid container>
                      <Grid item xs={12} md={4}><FieldRow label="In Yard" value={vehicleDetail.inYard || 'N/A'} /></Grid>
                      <Grid item xs={12} md={4}><FieldRow label="Yard Name" value={vehicleDetail.yardName || 'N/A'} /></Grid>
                      <Grid item xs={12} md={4}><FieldRow label="Yard Location" value={vehicleDetail.yardLocation || 'N/A'} /></Grid>
                    </Grid>
                  </Paper>
                </Grid>
              )}

              {(vehicleDetail.firstConfirmerName || vehicleDetail.firstConfirmerPhone || vehicleDetail.secondConfirmerName || vehicleDetail.secondConfirmerPhone || vehicleDetail.thirdConfirmerName || vehicleDetail.thirdConfirmerPhone) && (
                <Grid item xs={12}>
                  <Paper variant="outlined" sx={{ p: 1.5 }}>
                    <Typography variant="subtitle2" gutterBottom>Confirmer Details</Typography>
                    <Grid container spacing={1}>
                      <Grid item xs={12} md={4}>
                        <FieldRow label="First Confirmer Name" value={vehicleDetail.firstConfirmerName || 'N/A'} />
                        <FieldRow label="First Confirmer Phone" value={vehicleDetail.firstConfirmerPhone || 'N/A'} />
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <FieldRow label="Second Confirmer Name" value={vehicleDetail.secondConfirmerName || 'N/A'} />
                        <FieldRow label="Second Confirmer Phone" value={vehicleDetail.secondConfirmerPhone || 'N/A'} />
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <FieldRow label="Third Confirmer Name" value={vehicleDetail.thirdConfirmerName || 'N/A'} />
                        <FieldRow label="Third Confirmer Phone" value={vehicleDetail.thirdConfirmerPhone || 'N/A'} />
                      </Grid>
                    </Grid>
                  </Paper>
                </Grid>
              )}

              {vehicleDetail?.raw && (
                <Grid item xs={12}>
                  <Paper variant="outlined" sx={{ p: 1.5 }}>
                    <Typography variant="subtitle2" gutterBottom>Additional Fields</Typography>
                    <Grid container spacing={1}>
                      {Object.entries(vehicleDetail.raw || {})
                        .filter(([k]) => ![
                          '_id','__v','registrationNumber','chassisNumber','agreementNumber','bankName','vehicleMake','customerName','address','branchName','status','engineNumber','engineNo','productName','emiAmount','pos','POS','model','vehicleModel','uploadDate','createdAt','bucket','season','seasoning','fileName'
                        ].includes(k))
                        .map(([key, value]) => (
                          <Grid key={key} item xs={12} md={4}>
                            <FieldRow label={key} value={String(value ?? 'N/A')} />
                          </Grid>
                        ))}
                    </Grid>
                  </Paper>
                </Grid>
              )}
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          {!!vehicleDetail && (
            <Box sx={{ display: 'flex', gap: 1, px: 2, py: 1, width: '100%' }}>
              <Button color="inherit" variant="contained" onClick={async ()=>{
                try { const token = localStorage.getItem('token'); await axios.put(`/api/tenant/data/vehicle/${vehicleDetail._id}/status`, { status: 'Pending' }, { headers: { Authorization: `Bearer ${token}` } }); setVehicleDetail({ ...vehicleDetail, status: 'Pending' }); } catch(e){ alert(e?.response?.data?.message || 'Failed to update status'); }
              }}>Pending</Button>
              <Button color="warning" variant="contained" onClick={async ()=>{
                try { const token = localStorage.getItem('token'); await axios.put(`/api/tenant/data/vehicle/${vehicleDetail._id}/status`, { status: 'Hold' }, { headers: { Authorization: `Bearer ${token}` } }); setVehicleDetail({ ...vehicleDetail, status: 'Hold' }); } catch(e){ alert(e?.response?.data?.message || 'Failed to update status'); }
              }}>Hold</Button>
              <Button color="secondary" variant="contained" onClick={async ()=>{
                try { const token = localStorage.getItem('token'); await axios.put(`/api/tenant/data/vehicle/${vehicleDetail._id}/status`, { status: 'In Yard' }, { headers: { Authorization: `Bearer ${token}` } }); setVehicleDetail({ ...vehicleDetail, status: 'In Yard' }); } catch(e){ alert(e?.response?.data?.message || 'Failed to update status'); }
              }}>In Yard</Button>
              <Button color="success" variant="contained" onClick={async ()=>{
                try { const token = localStorage.getItem('token'); await axios.put(`/api/tenant/data/vehicle/${vehicleDetail._id}/status`, { status: 'Released' }, { headers: { Authorization: `Bearer ${token}` } }); setVehicleDetail({ ...vehicleDetail, status: 'Released' }); } catch(e){ alert(e?.response?.data?.message || 'Failed to update status'); }
              }}>Release</Button>
              <Button color="error" variant="contained" onClick={async ()=>{
                try { const token = localStorage.getItem('token'); await axios.put(`/api/tenant/data/vehicle/${vehicleDetail._id}/status`, { status: 'Cancelled' }, { headers: { Authorization: `Bearer ${token}` } }); setVehicleDetail({ ...vehicleDetail, status: 'Cancelled' }); } catch(e){ alert(e?.response?.data?.message || 'Failed to update status'); }
              }}>Cancel</Button>
              <Box sx={{ flex: 1 }} />
              <Button onClick={() => setDetailOpen(false)}>Close</Button>
            </Box>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default VehicleDataDetails;
