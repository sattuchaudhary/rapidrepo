import React, { useMemo, useState, useEffect } from 'react';
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
  Checkbox,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel
} from '@mui/material';
import {
  Visibility as ViewIcon,
  Delete as DeleteIcon,
  DirectionsCar as FourWheelerIcon,
  CloudDownload as DownloadIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const FourWheelerData = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [search, setSearch] = useState('');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [total, setTotal] = useState(0);
  const [selectedRows, setSelectedRows] = useState([]);
  const [exporting, setExporting] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportColumns, setExportColumns] = useState({
    regNo: true,
    chassisNo: true,
    branch: false,
    engineNo: false,
    make: true,
    bank: true,
    loanNo: false,
    customerName: false,
    status: false
  });

  // Fetch data from API
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/tenant/data/four-wheeler?page=${page + 1}&limit=${rowsPerPage}&search=${search}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setData(response.data.data);
        setTotal(response.data.pagination.total);
      } else {
        setError(response.data.message || 'Failed to fetch data');
      }
    } catch (err) {
      console.error('Error fetching four wheeler data:', err);
      setError(err.response?.data?.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  // Fetch data on component mount and when page/rowsPerPage/search changes
  useEffect(() => {
    fetchData();
  }, [page, rowsPerPage, search]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (page !== 0) setPage(0); // Reset to first page when searching
      else fetchData();
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  const handleViewDetails = (row) => {
    // Navigate to vehicle data details page
    navigate(`/app/tenant/files/vehicle-data/${row._id}`);
  };

  const handleDeleteUpload = async (row) => {
    if (!row?._id) return;
    if (!window.confirm(`Delete file "${row.fileName}" and all its vehicle rows?`)) return;
    try {
      const token = localStorage.getItem('token');
      const safeId = encodeURIComponent(row._id);
      await axios.delete(`/api/tenant/data/file/${safeId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Refresh list
      fetchData();
    } catch (e) {
      console.error('Delete upload failed:', e);
      alert(e?.response?.data?.message || 'Failed to delete file');
    }
  };

  const handleSelectAll = (event) => {
    if (event.target.checked) {
      setSelectedRows(data.map(row => row._id));
    } else {
      setSelectedRows([]);
    }
  };

  const handleSelectRow = (event, id) => {
    if (event.target.checked) {
      setSelectedRows([...selectedRows, id]);
    } else {
      setSelectedRows(selectedRows.filter(rowId => rowId !== id));
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
    if (selectedRows.length > 0) {
      setExportDialogOpen(true);
      return;
    }
    try {
      setExporting(true);
      const headers = ['Bank Name','Filename','User name','Upload date','Total Record','Hold','InYard','Release','Status'];
      const csvRows = [headers.join(',')];
      data.forEach(r => {
        csvRows.push([
          escapeCsv(r.bankName),
          escapeCsv(r.fileName),
          escapeCsv(r.user),
          escapeCsv(r.uploadDate),
          escapeCsv(r.total),
          escapeCsv(r.hold),
          escapeCsv(r.inYard),
          escapeCsv(r.release),
          escapeCsv(r.status)
        ].join(','));
      });
      const csvContent = '\uFEFF' + csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const ts = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
      link.download = `four-wheeler-export-${ts}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const fetchAllVehiclesForUploads = async (uploadIds) => {
    const token = localStorage.getItem('token');
    const all = [];
    for (const id of uploadIds) {
      try {
        const safeId = encodeURIComponent(id);
        const res = await axios.get(`/api/tenant/data/file/${safeId}?page=1&limit=100000`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const rows = res?.data?.data || [];
        all.push(...rows);
      } catch (e) {}
    }
    return all;
  };

  const performBulkExport = async () => {
    try {
      setExporting(true);
      const ids = selectedRows.length ? selectedRows : data.map(r => r._id);
      const vehicles = await fetchAllVehiclesForUploads(ids);
      const chosen = exportColumns;
      const headers = [];
      if (chosen.regNo) headers.push('Registration No');
      if (chosen.chassisNo) headers.push('Chesis No');
      if (chosen.branch) headers.push('Branch');
      if (chosen.engineNo) headers.push('Engine No');
      if (chosen.make) headers.push('Make');
      if (chosen.bank) headers.push('Bank');
      if (chosen.loanNo) headers.push('Loan No');
      if (chosen.customerName) headers.push('Customer Name');
      if (chosen.status) headers.push('Status');
      const rows = [headers.join(',')];
      vehicles.forEach(v => {
        const cols = [];
        if (chosen.regNo) cols.push(escapeCsv(v.regNo));
        if (chosen.chassisNo) cols.push(escapeCsv(v.chassisNo));
        if (chosen.branch) cols.push(escapeCsv(v.branch));
        if (chosen.engineNo) cols.push(escapeCsv(v.engineNo));
        if (chosen.make) cols.push(escapeCsv(v.make));
        if (chosen.bank) cols.push(escapeCsv(v.bank));
        if (chosen.loanNo) cols.push(escapeCsv(v.loanNo));
        if (chosen.customerName) cols.push(escapeCsv(v.customerName));
        if (chosen.status) cols.push(escapeCsv(v.status));
        rows.push(cols.join(','));
      });
      const csvContent = '\uFEFF' + rows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const ts = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
      link.download = `four-wheeler-bulk-export-${ts}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
      setExportDialogOpen(false);
    }
  };

  return (
    <Box>
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FourWheelerIcon sx={{ color: 'primary.main' }} />
          <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
            Four Wheeler Data Management
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button 
            variant="outlined" 
            color="primary"
            startIcon={<DownloadIcon />}
            disabled={exporting || (!data || data.length === 0)}
            onClick={handleExportCSV}
          >
            Export CSV
          </Button>
          <Button 
            variant="contained" 
            color="primary"
            disabled={exporting || (!data || data.length === 0)}
            onClick={() => setExportDialogOpen(true)}
          >
            Export Selected
          </Button>
        </Box>
      </Box>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={6}>
            <Typography variant="body2">
              File Upload feature is available through "Mobile Upload" option
            </Typography>
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              size="small"
              label="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </Grid>
        </Grid>
      </Paper>

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
                    <TableCell padding="checkbox">
                      <Checkbox
                        indeterminate={selectedRows.length > 0 && selectedRows.length < data.length}
                        checked={data.length > 0 && selectedRows.length === data.length}
                        onChange={handleSelectAll}
                      />
                    </TableCell>
                    <TableCell>#</TableCell>
                    <TableCell>Bank Name</TableCell>
                    <TableCell>Filename</TableCell>
                    <TableCell>User name</TableCell>
                    <TableCell>Upload date</TableCell>
                    <TableCell align="right">Total Record</TableCell>
                    <TableCell align="right">Hold</TableCell>
                    <TableCell align="right">InYard</TableCell>
                    <TableCell align="right">Release</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="center">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} align="center">
                        <Typography variant="body2" color="text.secondary">
                          No data found. Upload some files through Mobile Upload to see data here.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.map((row) => (
                      <TableRow key={row._id} hover>
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={selectedRows.includes(row._id)}
                            onChange={(event) => handleSelectRow(event, row._id)}
                          />
                        </TableCell>
                        <TableCell>{row.id}</TableCell>
                        <TableCell>{row.bankName}</TableCell>
                        <TableCell>{row.fileName}</TableCell>
                        <TableCell>{row.user}</TableCell>
                        <TableCell>{row.uploadDate}</TableCell>
                        <TableCell align="right">{row.total}</TableCell>
                        <TableCell align="right">{row.hold}</TableCell>
                        <TableCell align="right">{row.inYard}</TableCell>
                        <TableCell align="right">{row.release}</TableCell>
                        <TableCell>{row.status === 'ok' ? '✔' : '—'}</TableCell>
                        <TableCell align="center">
                          <IconButton 
                            size="small" 
                            color="primary" 
                            title="View Details"
                            onClick={() => handleViewDetails(row)}
                          >
                            <ViewIcon />
                          </IconButton>
                          <IconButton size="small" color="error" title="Delete" onClick={() => handleDeleteUpload(row)}>
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
      {/* Bulk Export Dialog */}
      <Dialog open={exportDialogOpen} onClose={() => setExportDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Select Columns to Export</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            <FormControlLabel control={<Checkbox checked={exportColumns.regNo} onChange={(e)=>setExportColumns(v=>({...v, regNo: e.target.checked}))} />} label="Registration No" />
            <FormControlLabel control={<Checkbox checked={exportColumns.chassisNo} onChange={(e)=>setExportColumns(v=>({...v, chassisNo: e.target.checked}))} />} label="Chesis No" />
            <FormControlLabel control={<Checkbox checked={exportColumns.branch} onChange={(e)=>setExportColumns(v=>({...v, branch: e.target.checked}))} />} label="Branch" />
            <FormControlLabel control={<Checkbox checked={exportColumns.engineNo} onChange={(e)=>setExportColumns(v=>({...v, engineNo: e.target.checked}))} />} label="Engine No" />
            <FormControlLabel control={<Checkbox checked={exportColumns.make} onChange={(e)=>setExportColumns(v=>({...v, make: e.target.checked}))} />} label="Make" />
            <FormControlLabel control={<Checkbox checked={exportColumns.bank} onChange={(e)=>setExportColumns(v=>({...v, bank: e.target.checked}))} />} label="Bank" />
            <FormControlLabel control={<Checkbox checked={exportColumns.loanNo} onChange={(e)=>setExportColumns(v=>({...v, loanNo: e.target.checked}))} />} label="Loan No" />
            <FormControlLabel control={<Checkbox checked={exportColumns.customerName} onChange={(e)=>setExportColumns(v=>({...v, customerName: e.target.checked}))} />} label="Customer Name" />
            <FormControlLabel control={<Checkbox checked={exportColumns.status} onChange={(e)=>setExportColumns(v=>({...v, status: e.target.checked}))} />} label="Status" />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExportDialogOpen(false)}>Close</Button>
          <Button onClick={performBulkExport} disabled={exporting} variant="contained">Export</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default FourWheelerData;






