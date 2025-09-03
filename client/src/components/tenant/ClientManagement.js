import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Button,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Snackbar,
  CircularProgress,
  TablePagination
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Business as BusinessIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import axios from 'axios';


const ClientManagement = () => {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Dialog states
  const [openDialog, setOpenDialog] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  
  // Form states
  const [formData, setFormData] = useState({
    name: ''
  });
  
  // Search and filter states
  const [searchName, setSearchName] = useState('');
  
  // Pagination states
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [submitting, setSubmitting] = useState(false);

  // Sample data for demonstration
  // const sampleClients = [
  //   { id: 1, name: 'tatkal pan india 3', createdOn: 'Jul 09, 2025' },
  //   { id: 2, name: 'tatkal pan india 2', createdOn: 'Jul 09, 2025' },
  //   { id: 3, name: 'tatkal pan india 1', createdOn: 'Jul 09, 2025' },
  //   { id: 4, name: 'L&T self kishan right off', createdOn: 'May 14, 2025' },
  //   { id: 5, name: 'idfc self woff', createdOn: 'May 07, 2025' },
  //   { id: 6, name: 'TATA CAPITAL UK AND MEERUT', createdOn: 'Apr 11, 2025' },
  //   { id: 7, name: 'kanha assocate 1', createdOn: 'Apr 09, 2025' },
  //   { id: 8, name: 'self hero all', createdOn: 'Mar 07, 2025' },
  //   { id: 9, name: 'TATA MACHINE', createdOn: 'Mar 05, 2025' },
  //   { id: 10, name: 'HERO 4-12 NCR', createdOn: 'Feb 16, 2025' }
  // ];

  const fetchClients = useCallback(async () => {
    try {
      setLoading(true);
      setError(''); // Clear previous errors
      
      const token = localStorage.getItem('token');
      if (!token) {
        setError('No authentication token found. Please login again.');
        return;
      }
      
      const response = await axios.get('http://localhost:5000/api/tenant/clients', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setClients(response.data.data || []);
      } else {
        setError('Failed to fetch clients: Invalid response format');
        setClients([]);
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
      setError(`Failed to fetch clients: ${errorMessage}`);
      setClients([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const handleOpenDialog = (client = null) => {
    if (client) {
      setEditingClient(client);
      setFormData({
        name: client.name
      });
    } else {
      setEditingClient(null);
      setFormData({
        name: ''
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingClient(null);
    setFormData({
      name: ''
    });
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      
      // Validate required fields
      if (!formData.name.trim()) {
        setError('Name is required field');
        return;
      }

      if (editingClient) {
        const token = localStorage.getItem('token');
        const response = await axios.put(`http://localhost:5000/api/tenant/clients/${editingClient._id || editingClient.id}`,
          { name: formData.name },
          { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
        );
        if (response.data.success) {
          setSuccess('Client updated successfully');
          fetchClients();
          setTimeout(() => setSuccess(''), 3000);
        }
      } else {
        const token = localStorage.getItem('token');
        const response = await axios.post('http://localhost:5000/api/tenant/clients',
          { name: formData.name },
          { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
        );
        if (response.data.success) {
          setSuccess('Client created successfully');
          fetchClients();
          setTimeout(() => setSuccess(''), 3000);
        }
      }
      
      handleCloseDialog();
    } catch (error) {
      setError(`Failed to save client: ${error.response?.data?.message || error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClient = async (clientId) => {
    if (!window.confirm('Are you sure you want to delete this client?')) return;
    
    try {
      setLoading(true);
      
      // Call backend API to delete client database
      const token = localStorage.getItem('token');
      const response = await axios.delete(`http://localhost:5000/api/tenant/clients/${clientId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setSuccess('Client deleted successfully');
        // Refresh client list from database
        fetchClients();
        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (error) {
      console.error('Error deleting client:', error);
      setError(`Failed to delete client: ${error.response?.data?.message || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Filter clients based on search
  const filteredClients = clients.filter(client => {
    const nameMatch = client.name.toLowerCase().includes(searchName.toLowerCase());
    return nameMatch;
  });

  // Paginate clients
  const paginatedClients = filteredClients.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );



  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <BusinessIcon sx={{ fontSize: 32, color: 'primary.main' }} />
        <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
          Clients
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

      {/* Actions and Search */}
      <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
          sx={{ 
            borderRadius: 2,
            bgcolor: '#424242',
            '&:hover': { bgcolor: '#616161' }
          }}
        >
          Add Client
        </Button>
        
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={fetchClients}
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

        <TextField
          size="small"
          placeholder="Name"
          value={searchName}
          onChange={(e) => setSearchName(e.target.value)}
          sx={{ minWidth: 200 }}
        />


      </Box>

      {/* Clients Table */}
      <Paper sx={{ width: '100%', overflow: 'hidden' }}>
        <TableContainer>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>Id</TableCell>
                <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>Created On</TableCell>
                <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }} align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                    <CircularProgress size={24} />
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      Loading clients...
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : paginatedClients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      {clients.length === 0 ? 'No clients found. Create your first client!' : 'No clients match your search criteria.'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedClients.map((client) => (
                  <TableRow key={client._id || client.id} hover>
                    <TableCell>{client._id || client.id}</TableCell>
                    <TableCell>
                      <Typography variant="subtitle2" fontWeight="bold">
                        {client.name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {client.createdOn ? 
                        (typeof client.createdOn === 'string' ? 
                          client.createdOn : 
                          new Date(client.createdOn).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: '2-digit', 
                            year: 'numeric' 
                          })
                        ) : 
                        'N/A'
                      }
                    </TableCell>
                    <TableCell align="center">
                      <Box display="flex" gap={1} justifyContent="center">
                        <IconButton
                          size="small"
                          onClick={() => handleOpenDialog(client)}
                          color="primary"
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteClient(client._id || client.id)}
                          color="error"
                        >
                          <DeleteIcon />
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
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={filteredClients.length}
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
      <Box sx={{ mt: 2, textAlign: 'right' }}>
        <Typography variant="body2" color="text.secondary">
          {filteredClients.length} records found
        </Typography>
      </Box>

      {/* Create/Edit Client Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingClient ? 'Edit Client' : 'Add New Client'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <TextField
              fullWidth
              label="Name *"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              placeholder="Enter client name"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={handleCloseDialog}
            startIcon={<CancelIcon />}
            sx={{ color: 'grey.600' }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            variant="contained"
            startIcon={submitting ? <CircularProgress size={20} /> : <SaveIcon />}
            disabled={submitting}
            sx={{ 
              bgcolor: '#424242',
              '&:hover': { bgcolor: '#616161' }
            }}
          >
            {submitting ? 'Saving...' : (editingClient ? 'Update' : 'Save')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Notifications */}
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError('')}
      >
        <Alert severity="error" onClose={() => setError('')}>
          {error}
        </Alert>
      </Snackbar>

      <Snackbar
        open={!!success}
        autoHideDuration={6000}
        onClose={() => setSuccess('')}
      >
        <Alert severity="success" onClose={() => setSuccess('')}>
          {success}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ClientManagement;
