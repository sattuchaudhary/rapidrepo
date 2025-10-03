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
        params: { limit: 'all' },
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
    <Box sx={{ width: '100%', p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex',   gap: 2 }}>
        <BusinessIcon sx={{ fontSize: 32, color: 'primary.main' }} />
        <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
          Clients
        </Typography>
      </Box>

      {/* Error Message */}
      {error && (
        <Alert severity="error" sx={{ mb: 8 }} onClose={() => setError('')}>
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
          sx={{ minWidth: 400 }}
        />


      </Box>

      {/* Clients Table */}
      <Paper sx={{ width: '100%', overflow: 'hidden' }}>
        <TableContainer>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>Client ID</TableCell>
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
                    <TableCell>{client.clientId || client._id || client.id}</TableCell>
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




// import React, { useState, useEffect, useCallback, useMemo } from 'react';
// import {
//   Box,
//   Typography,
//   IconButton,
//   Button,
//   TextField,
//   Card,
//   CardContent,
//   CardActions,
//   Grid,
//   Dialog,
//   DialogTitle,
//   DialogContent,
//   DialogActions,
//   Alert,
//   Snackbar,
//   CircularProgress,
//   Pagination,
//   Chip,
//   InputAdornment,
//   Skeleton,
//   Fade,
//   Zoom,
//   Tooltip,
//   Menu,
//   MenuItem,
//   Divider,
//   Avatar,
//   Stack,
//   Paper,
//   Tab,
//   Tabs
// } from '@mui/material';
// import {
//   Add as AddIcon,
//   Edit as EditIcon,
//   Delete as DeleteIcon,
//   Business as BusinessIcon,
//   Save as SaveIcon,
//   Cancel as CancelIcon,
//   Refresh as RefreshIcon,
//   Search as SearchIcon,
//   FilterList as FilterIcon,
//   GridView as GridViewIcon,
//   ViewList as ViewListIcon,
//   MoreVert as MoreVertIcon,
//   Email as EmailIcon,
//   Phone as PhoneIcon,
//   LocationOn as LocationIcon,
//   CalendarToday as CalendarIcon,
//   TrendingUp as TrendingUpIcon,
//   FileDownload as DownloadIcon,
//   Upload as UploadIcon
// } from '@mui/icons-material';

// // Custom hook for debounced search
// const useDebounce = (value, delay) => {
//   const [debouncedValue, setDebouncedValue] = useState(value);

//   useEffect(() => {
//     const handler = setTimeout(() => {
//       setDebouncedValue(value);
//     }, delay);

//     return () => {
//       clearTimeout(handler);
//     };
//   }, [value, delay]);

//   return debouncedValue;
// };

// // Custom hook for client management
// const useClients = () => {
//   const [clients, setClients] = useState([]);
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState('');
//   const [success, setSuccess] = useState('');

//   // Sample enhanced data
//   const sampleClients = [
//     { 
//       id: 1, 
//       name: 'Tatkal Pan India Services', 
//       email: 'contact@tatkalpan.com',
//       phone: '+91 98765 43210',
//       location: 'Mumbai, Maharashtra',
//       category: 'Financial Services',
//       status: 'Active',
//       projectsCount: 8,
//       lastActivity: '2 days ago',
//       createdOn: new Date('2025-07-09'),
//       revenue: '₹2.5L'
//     },
//     { 
//       id: 2, 
//       name: 'L&T Construction Ltd', 
//       email: 'projects@lt.com',
//       phone: '+91 98765 43211',
//       location: 'Delhi, NCR',
//       category: 'Construction',
//       status: 'Active',
//       projectsCount: 12,
//       lastActivity: '1 week ago',
//       createdOn: new Date('2025-05-14'),
//       revenue: '₹8.2L'
//     },
//     { 
//       id: 3, 
//       name: 'IDFC Bank Solutions', 
//       email: 'info@idfcbank.com',
//       phone: '+91 98765 43212',
//       location: 'Bangalore, Karnataka',
//       category: 'Banking',
//       status: 'Inactive',
//       projectsCount: 5,
//       lastActivity: '2 weeks ago',
//       createdOn: new Date('2025-05-07'),
//       revenue: '₹1.8L'
//     },
//     { 
//       id: 4, 
//       name: 'TATA Capital Finance', 
//       email: 'support@tatacapital.com',
//       phone: '+91 98765 43213',
//       location: 'Pune, Maharashtra',
//       category: 'Financial Services',
//       status: 'Active',
//       projectsCount: 15,
//       lastActivity: '3 days ago',
//       createdOn: new Date('2025-04-11'),
//       revenue: '₹5.6L'
//     },
//     { 
//       id: 5, 
//       name: 'Hero MotoCorp Ltd', 
//       email: 'business@hero.com',
//       phone: '+91 98765 43214',
//       location: 'Gurgaon, Haryana',
//       category: 'Automotive',
//       status: 'Active',
//       projectsCount: 20,
//       lastActivity: '1 day ago',
//       createdOn: new Date('2025-02-16'),
//       revenue: '₹12.3L'
//     },
//     { 
//       id: 6, 
//       name: 'Kanha Associates', 
//       email: 'hello@kanha.com',
//       phone: '+91 98765 43215',
//       location: 'Indore, MP',
//       category: 'Consulting',
//       status: 'Active',
//       projectsCount: 6,
//       lastActivity: '5 days ago',
//       createdOn: new Date('2025-04-09'),
//       revenue: '₹3.2L'
//     }
//   ];

//   const fetchClients = useCallback(async () => {
//     try {
//       setLoading(true);
//       setError('');
      
//       // Simulate API call
//       await new Promise(resolve => setTimeout(resolve, 1000));
//       setClients(sampleClients);
      
//     } catch (error) {
//       setError(`Failed to fetch clients: ${error.message}`);
//       setClients([]);
//     } finally {
//       setLoading(false);
//     }
//   }, []);

//   const addClient = useCallback(async (clientData) => {
//     try {
//       const newClient = {
//         ...clientData,
//         id: Date.now(),
//         createdOn: new Date(),
//         status: 'Active',
//         projectsCount: 0,
//         lastActivity: 'Just now',
//         revenue: '₹0'
//       };
//       setClients(prev => [newClient, ...prev]);
//       setSuccess('Client added successfully!');
//       setTimeout(() => setSuccess(''), 3000);
//     } catch (error) {
//       setError(`Failed to add client: ${error.message}`);
//     }
//   }, []);

//   const updateClient = useCallback(async (clientId, clientData) => {
//     try {
//       setClients(prev => prev.map(client => 
//         client.id === clientId ? { ...client, ...clientData } : client
//       ));
//       setSuccess('Client updated successfully!');
//       setTimeout(() => setSuccess(''), 3000);
//     } catch (error) {
//       setError(`Failed to update client: ${error.message}`);
//     }
//   }, []);

//   const deleteClient = useCallback(async (clientId) => {
//     try {
//       setClients(prev => prev.filter(client => client.id !== clientId));
//       setSuccess('Client deleted successfully!');
//       setTimeout(() => setSuccess(''), 3000);
//     } catch (error) {
//       setError(`Failed to delete client: ${error.message}`);
//     }
//   }, []);

//   return {
//     clients,
//     loading,
//     error,
//     success,
//     fetchClients,
//     addClient,
//     updateClient,
//     deleteClient,
//     setError,
//     setSuccess
//   };
// };

// // Client Card Component
// const ClientCard = ({ client, onEdit, onDelete, onViewDetails }) => {
//   const [anchorEl, setAnchorEl] = useState(null);

//   const getStatusColor = (status) => {
//     switch (status) {
//       case 'Active': return 'success';
//       case 'Inactive': return 'error';
//       default: return 'default';
//     }
//   };

//   const getCategoryColor = (category) => {
//     switch (category) {
//       case 'Financial Services': return '#1976d2';
//       case 'Construction': return '#f57c00';
//       case 'Banking': return '#388e3c';
//       case 'Automotive': return '#d32f2f';
//       case 'Consulting': return '#7b1fa2';
//       default: return '#616161';
//     }
//   };

//   return (
//     <Zoom in timeout={300}>
//       <Card 
//         sx={{ 
//           height: '100%',
//           display: 'flex',
//           flexDirection: 'column',
//           position: 'relative',
//           transition: 'all 0.3s ease',
//           '&:hover': {
//             transform: 'translateY(-4px)',
//             boxShadow: '0 8px 25px rgba(0,0,0,0.15)',
//           }
//         }}
//       >
//         <CardContent sx={{ flexGrow: 1, pb: 1 }}>
//           {/* Header */}
//           <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
//             <Box display="flex" alignItems="center" gap={1.5}>
//               <Avatar 
//                 sx={{ 
//                   bgcolor: getCategoryColor(client.category),
//                   width: 48,
//                   height: 48
//                 }}
//               >
//                 <BusinessIcon />
//               </Avatar>
//               <Box>
//                 <Typography variant="h6" fontWeight="bold" sx={{ lineHeight: 1.2 }}>
//                   {client.name}
//                 </Typography>
//                 <Typography variant="body2" color="text.secondary">
//                   ID: {client.id}
//                 </Typography>
//               </Box>
//             </Box>
//             <IconButton 
//               size="small" 
//               onClick={(e) => setAnchorEl(e.currentTarget)}
//             >
//               <MoreVertIcon />
//             </IconButton>
//           </Box>

//           {/* Status and Category */}
//           <Stack direction="row" spacing={1} mb={2}>
//             <Chip 
//               label={client.status} 
//               color={getStatusColor(client.status)} 
//               size="small"
//             />
//             <Chip 
//               label={client.category} 
//               variant="outlined" 
//               size="small"
//               sx={{ 
//                 borderColor: getCategoryColor(client.category),
//                 color: getCategoryColor(client.category)
//               }}
//             />
//           </Stack>

//           {/* Contact Info */}
//           <Stack spacing={1} mb={2}>
//             <Box display="flex" alignItems="center" gap={1}>
//               <EmailIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
//               <Typography variant="body2" color="text.secondary">
//                 {client.email}
//               </Typography>
//             </Box>
//             <Box display="flex" alignItems="center" gap={1}>
//               <PhoneIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
//               <Typography variant="body2" color="text.secondary">
//                 {client.phone}
//               </Typography>
//             </Box>
//             <Box display="flex" alignItems="center" gap={1}>
//               <LocationIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
//               <Typography variant="body2" color="text.secondary">
//                 {client.location}
//               </Typography>
//             </Box>
//           </Stack>

//           {/* Metrics */}
//           <Grid container spacing={2}>
//             <Grid item xs={6}>
//               <Paper sx={{ p: 1, textAlign: 'center', bgcolor: 'primary.50' }}>
//                 <Typography variant="h6" color="primary" fontWeight="bold">
//                   {client.projectsCount}
//                 </Typography>
//                 <Typography variant="caption" color="text.secondary">
//                   Projects
//                 </Typography>
//               </Paper>
//             </Grid>
//             <Grid item xs={6}>
//               <Paper sx={{ p: 1, textAlign: 'center', bgcolor: 'success.50' }}>
//                 <Typography variant="h6" color="success.main" fontWeight="bold">
//                   {client.revenue}
//                 </Typography>
//                 <Typography variant="caption" color="text.secondary">
//                   Revenue
//                 </Typography>
//               </Paper>
//             </Grid>
//           </Grid>
//         </CardContent>

//         <CardActions sx={{ px: 2, pb: 2 }}>
//           <Box display="flex" justifyContent="space-between" alignItems="center" width="100%">
//             <Typography variant="caption" color="text.secondary">
//               Last activity: {client.lastActivity}
//             </Typography>
//             <Stack direction="row" spacing={0.5}>
//               <Tooltip title="Edit Client">
//                 <IconButton size="small" onClick={() => onEdit(client)} color="primary">
//                   <EditIcon fontSize="small" />
//                 </IconButton>
//               </Tooltip>
//               <Tooltip title="Delete Client">
//                 <IconButton size="small" onClick={() => onDelete(client.id)} color="error">
//                   <DeleteIcon fontSize="small" />
//                 </IconButton>
//               </Tooltip>
//             </Stack>
//           </Box>
//         </CardActions>

//         {/* Action Menu */}
//         <Menu
//           anchorEl={anchorEl}
//           open={Boolean(anchorEl)}
//           onClose={() => setAnchorEl(null)}
//         >
//           <MenuItem onClick={() => { onEdit(client); setAnchorEl(null); }}>
//             <EditIcon sx={{ mr: 1, fontSize: 18 }} />
//             Edit
//           </MenuItem>
//           <MenuItem onClick={() => { onViewDetails(client); setAnchorEl(null); }}>
//             <TrendingUpIcon sx={{ mr: 1, fontSize: 18 }} />
//             View Details
//           </MenuItem>
//           <Divider />
//           <MenuItem 
//             onClick={() => { onDelete(client.id); setAnchorEl(null); }}
//             sx={{ color: 'error.main' }}
//           >
//             <DeleteIcon sx={{ mr: 1, fontSize: 18 }} />
//             Delete
//           </MenuItem>
//         </Menu>
//       </Card>
//     </Zoom>
//   );
// };

// // Loading Skeleton Component
// const ClientCardSkeleton = () => (
//   <Card sx={{ height: 300 }}>
//     <CardContent>
//       <Box display="flex" alignItems="center" gap={1.5} mb={2}>
//         <Skeleton variant="circular" width={48} height={48} />
//         <Box flex={1}>
//           <Skeleton variant="text" width="80%" height={24} />
//           <Skeleton variant="text" width="40%" height={16} />
//         </Box>
//       </Box>
//       <Stack spacing={1}>
//         <Skeleton variant="rectangular" height={20} />
//         <Skeleton variant="rectangular" height={20} />
//         <Skeleton variant="rectangular" height={20} />
//       </Stack>
//     </CardContent>
//   </Card>
// );

// // Enhanced Client Form Component
// const ClientForm = ({ open, onClose, onSubmit, editingClient, loading }) => {
//   const [formData, setFormData] = useState({
//     name: '',
//     email: '',
//     phone: '',
//     location: '',
//     category: 'Financial Services'
//   });

//   const [errors, setErrors] = useState({});

//   useEffect(() => {
//     if (editingClient) {
//       setFormData({
//         name: editingClient.name || '',
//         email: editingClient.email || '',
//         phone: editingClient.phone || '',
//         location: editingClient.location || '',
//         category: editingClient.category || 'Financial Services'
//       });
//     } else {
//       setFormData({
//         name: '',
//         email: '',
//         phone: '',
//         location: '',
//         category: 'Financial Services'
//       });
//     }
//     setErrors({});
//   }, [editingClient, open]);

//   const validateForm = () => {
//     const newErrors = {};
//     if (!formData.name.trim()) newErrors.name = 'Name is required';
//     if (!formData.email.trim()) newErrors.email = 'Email is required';
//     if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
//       newErrors.email = 'Email is invalid';
//     }
//     if (!formData.phone.trim()) newErrors.phone = 'Phone is required';
//     if (!formData.location.trim()) newErrors.location = 'Location is required';
    
//     setErrors(newErrors);
//     return Object.keys(newErrors).length === 0;
//   };

//   const handleSubmit = () => {
//     if (validateForm()) {
//       onSubmit(formData);
//     }
//   };

//   const categories = [
//     'Financial Services',
//     'Construction',
//     'Banking',
//     'Automotive',
//     'Consulting',
//     'Technology',
//     'Healthcare',
//     'Education'
//   ];

//   return (
//     <Dialog 
//       open={open} 
//       onClose={onClose} 
//       maxWidth="md" 
//       fullWidth
//       TransitionComponent={Fade}
//     >
//       <DialogTitle sx={{ pb: 1 }}>
//         <Box display="flex" alignItems="center" gap={2}>
//           <Avatar sx={{ bgcolor: 'primary.main' }}>
//             {editingClient ? <EditIcon /> : <AddIcon />}
//           </Avatar>
//           <Typography variant="h5" fontWeight="bold">
//             {editingClient ? 'Edit Client' : 'Add New Client'}
//           </Typography>
//         </Box>
//       </DialogTitle>
      
//       <DialogContent>
//         <Grid container spacing={3} sx={{ mt: 1 }}>
//           <Grid item xs={12} sm={6}>
//             <TextField
//               fullWidth
//               label="Client Name"
//               value={formData.name}
//               onChange={(e) => setFormData({ ...formData, name: e.target.value })}
//               error={!!errors.name}
//               helperText={errors.name}
//               required
//             />
//           </Grid>
          
//           <Grid item xs={12} sm={6}>
//             <TextField
//               fullWidth
//               select
//               label="Category"
//               value={formData.category}
//               onChange={(e) => setFormData({ ...formData, category: e.target.value })}
//             >
//               {categories.map((category) => (
//                 <MenuItem key={category} value={category}>
//                   {category}
//                 </MenuItem>
//               ))}
//             </TextField>
//           </Grid>
          
//           <Grid item xs={12} sm={6}>
//             <TextField
//               fullWidth
//               label="Email"
//               type="email"
//               value={formData.email}
//               onChange={(e) => setFormData({ ...formData, email: e.target.value })}
//               error={!!errors.email}
//               helperText={errors.email}
//               required
//             />
//           </Grid>
          
//           <Grid item xs={12} sm={6}>
//             <TextField
//               fullWidth
//               label="Phone"
//               value={formData.phone}
//               onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
//               error={!!errors.phone}
//               helperText={errors.phone}
//               required
//             />
//           </Grid>
          
//           <Grid item xs={12}>
//             <TextField
//               fullWidth
//               label="Location"
//               value={formData.location}
//               onChange={(e) => setFormData({ ...formData, location: e.target.value })}
//               error={!!errors.location}
//               helperText={errors.location}
//               required
//             />
//           </Grid>
//         </Grid>
//       </DialogContent>
      
//       <DialogActions sx={{ px: 3, pb: 3 }}>
//         <Button 
//           onClick={onClose}
//           startIcon={<CancelIcon />}
//           size="large"
//         >
//           Cancel
//         </Button>
//         <Button 
//           onClick={handleSubmit}
//           variant="contained"
//           startIcon={loading ? <CircularProgress size={20} /> : <SaveIcon />}
//           disabled={loading}
//           size="large"
//           sx={{
//             bgcolor: 'primary.main',
//             '&:hover': { bgcolor: 'primary.dark' }
//           }}
//         >
//           {loading ? 'Saving...' : (editingClient ? 'Update' : 'Save')}
//         </Button>
//       </DialogActions>
//     </Dialog>
//   );
// };

// // Main Component
// const ImprovedClientManagement = () => {
//   const {
//     clients,
//     loading,
//     error,
//     success,
//     fetchClients,
//     addClient,
//     updateClient,
//     deleteClient,
//     setError,
//     setSuccess
//   } = useClients();

//   // UI States
//   const [viewMode, setViewMode] = useState('grid');
//   const [searchQuery, setSearchQuery] = useState('');
//   const [selectedCategory, setSelectedCategory] = useState('all');
//   const [selectedStatus, setSelectedStatus] = useState('all');
//   const [openDialog, setOpenDialog] = useState(false);
//   const [editingClient, setEditingClient] = useState(null);
//   const [submitting, setSubmitting] = useState(false);
//   const [currentPage, setCurrentPage] = useState(1);
//   const [tabValue, setTabValue] = useState(0);

//   // Debounced search
//   const debouncedSearch = useDebounce(searchQuery, 300);

//   // Load clients on mount
//   useEffect(() => {
//     fetchClients();
//   }, [fetchClients]);

//   // Filter and search logic
//   const filteredClients = useMemo(() => {
//     return clients.filter(client => {
//       const matchesSearch = client.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
//                            client.email.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
//                            client.location.toLowerCase().includes(debouncedSearch.toLowerCase());
      
//       const matchesCategory = selectedCategory === 'all' || client.category === selectedCategory;
//       const matchesStatus = selectedStatus === 'all' || client.status === selectedStatus;
      
//       return matchesSearch && matchesCategory && matchesStatus;
//     });
//   }, [clients, debouncedSearch, selectedCategory, selectedStatus]);

//   // Pagination
//   const itemsPerPage = 12;
//   const totalPages = Math.ceil(filteredClients.length / itemsPerPage);
//   const paginatedClients = filteredClients.slice(
//     (currentPage - 1) * itemsPerPage,
//     currentPage * itemsPerPage
//   );

//   // Get unique categories and statuses
//   const categories = [...new Set(clients.map(client => client.category))];
//   const statuses = [...new Set(clients.map(client => client.status))];

//   // Handlers
//   const handleOpenDialog = (client = null) => {
//     setEditingClient(client);
//     setOpenDialog(true);
//   };

//   const handleCloseDialog = () => {
//     setOpenDialog(false);
//     setEditingClient(null);
//   };

//   const handleSubmit = async (formData) => {
//     try {
//       setSubmitting(true);
//       if (editingClient) {
//         await updateClient(editingClient.id, formData);
//       } else {
//         await addClient(formData);
//       }
//       handleCloseDialog();
//     } catch (error) {
//       setError(`Failed to save client: ${error.message}`);
//     } finally {
//       setSubmitting(false);
//     }
//   };

//   const handleDeleteClient = async (clientId) => {
//     if (window.confirm('Are you sure you want to delete this client?')) {
//       await deleteClient(clientId);
//     }
//   };

//   const handleViewDetails = (client) => {
//     // Placeholder for view details functionality
//     console.log('View details for:', client);
//   };

//   // Stats calculation
//   const stats = useMemo(() => {
//     const total = clients.length;
//     const active = clients.filter(c => c.status === 'Active').length;
//     const totalRevenue = clients.reduce((sum, client) => {
//       const revenue = parseFloat(client.revenue.replace(/[₹,L]/g, '')) || 0;
//       return sum + revenue;
//     }, 0);

//     return { total, active, totalRevenue: `₹${totalRevenue.toFixed(1)}L` };
//   }, [clients]);

//   return (
//     <Box sx={{ p: 3, bgcolor: 'grey.50', minHeight: '100vh' }}>
//       {/* Header Section */}
//       <Paper 
//         elevation={0} 
//         sx={{ 
//           p: 4, 
//           mb: 3, 
//           background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
//           color: 'white',
//           borderRadius: 3
//         }}
//       >
//         <Box display="flex" alignItems="center" gap={3} mb={3}>
//           <Avatar sx={{ width: 64, height: 64, bgcolor: 'rgba(255,255,255,0.2)' }}>
//             <BusinessIcon sx={{ fontSize: 36 }} />
//           </Avatar>
//           <Box>
//             <Typography variant="h3" fontWeight="bold" gutterBottom>
//               Client Management
//             </Typography>
//             <Typography variant="h6" sx={{ opacity: 0.9 }}>
//               Manage your clients efficiently and track their progress
//             </Typography>
//           </Box>
//         </Box>

//         {/* Stats Cards */}
//         <Grid container spacing={2}>
//           <Grid item xs={12} sm={4}>
//             <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'rgba(255,255,255,0.1)' }}>
//               <Typography variant="h4" fontWeight="bold" color="inherit">
//                 {stats.total}
//               </Typography>
//               <Typography variant="body2" color="inherit" sx={{ opacity: 0.8 }}>
//                 Total Clients
//               </Typography>
//             </Paper>
//           </Grid>
//           <Grid item xs={12} sm={4}>
//             <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'rgba(255,255,255,0.1)' }}>
//               <Typography variant="h4" fontWeight="bold" color="inherit">
//                 {stats.active}
//               </Typography>
//               <Typography variant="body2" color="inherit" sx={{ opacity: 0.8 }}>
//                 Active Clients
//               </Typography>
//             </Paper>
//           </Grid>
//           <Grid item xs={12} sm={4}>
//             <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'rgba(255,255,255,0.1)' }}>
//               <Typography variant="h4" fontWeight="bold" color="inherit">
//                 {stats.totalRevenue}
//               </Typography>
//               <Typography variant="body2" color="inherit" sx={{ opacity: 0.8 }}>
//                 Total Revenue
//               </Typography>
//             </Paper>
//           </Grid>
//         </Grid>
//       </Paper>

//       {/* Action Bar */}
//       <Paper sx={{ p: 3, mb: 3, borderRadius: 2 }}>
//         <Grid container spacing={2} alignItems="center">
//           <Grid item xs={12} md={6}>
//             <TextField
//               fullWidth
//               placeholder="Search clients by name, email, or location..."
//               value={searchQuery}
//               onChange={(e) => setSearchQuery(e.target.value)}
//               InputProps={{
//                 startAdornment: (
//                   <InputAdornment position="start">
//                     <SearchIcon />
//                   </InputAdornment>
//                 ),
//               }}
//               sx={{ 
//                 '& .MuiOutlinedInput-root': {
//                   borderRadius: 3
//                 }
//               }}
//             />
//           </Grid>
          
//           <Grid item xs={12} md={6}>
//             <Stack direction="row" spacing={2} justifyContent="flex-end">
//               <TextField
//                 select
//                 size="small"
//                 label="Category"
//                 value={selectedCategory}
//                 onChange={(e) => setSelectedCategory(e.target.value)}
//                 sx={{ minWidth: 120 }}
//               >
//                 <MenuItem value="all">All Categories</MenuItem>
//                 {categories.map((category) => (
//                   <MenuItem key={category} value={category}>
//                     {category}
//                   </MenuItem>
//                 ))}
//               </TextField>

//               <TextField
//                 select
//                 size="small"
//                 label="Status"
//                 value={selectedStatus}
//                 onChange={(e) => setSelectedStatus(e.target.value)}
//                 sx={{ minWidth: 100 }}
//               >
//                 <MenuItem value="all">All Status</MenuItem>
//                 {statuses.map((status) => (
//                   <MenuItem key={status} value={status}>
//                     {status}
//                   </MenuItem>
//                 ))}
//               </TextField>

//               <Tooltip title={viewMode === 'grid' ? 'List View' : 'Grid View'}>
//                 <IconButton
//                   onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
//                   sx={{ 
//                     bgcolor: 'primary.main', 
//                     color: 'white',
//                     '&:hover': { bgcolor: 'primary.dark' }
//                   }}
//                 >
//                   {viewMode === 'grid' ? <ViewListIcon /> : <GridViewIcon />}
//                 </IconButton>
//               </Tooltip>

//               <Button
//                 variant="contained"
//                 startIcon={<AddIcon />}
//                 onClick={() => handleOpenDialog()}
//                 sx={{
//                   bgcolor: 'success.main',
//                   '&:hover': { bgcolor: 'success.dark' },
//                   borderRadius: 2,
//                   px: 3
//                 }}
//                 size="large"
//               >
//                 Add Client
//               </Button>
//             </Stack>
//           </Grid>
//         </Grid>
//       </Paper>

//       {/* Alerts */}
//       {error && (
//         <Alert 
//           severity="error" 
//           sx={{ mb: 3, borderRadius: 2 }} 
//           onClose={() => setError('')}
//         >
//           {error}
//         </Alert>
//       )}

//       {success && (
//         <Alert 
//           severity="success" 
//           sx={{ mb: 3, borderRadius: 2 }} 
//           onClose={() => setSuccess('')}
//         >
//           {success}
//         </Alert>
//       )}

//       {/* Content */}
//       {loading ? (
//         <Grid container spacing={3}>
//           {Array.from({ length: 6 }).map((_, index) => (
//             <Grid item xs={12} sm={6} md={4} key={index}>
//               <ClientCardSkeleton />
//             </Grid>
//           ))}
//         </Grid>
//       ) : filteredClients.length === 0 ? (
//         <Paper sx={{ p: 8, textAlign: 'center', borderRadius: 3 }}>
//           <BusinessIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
//           <Typography variant="h5" gutterBottom color="text.secondary">
//             {clients.length === 0 ? 'No clients yet' : 'No matching clients'}
//           </Typography>
//           <Typography variant="body1" color="text.secondary" mb={3}>
//             {clients.length === 0 
//               ? 'Get started by adding your first client'
//               : 'Try adjusting your search or filters'
//             }
//           </Typography>
//           {clients.length === 0 && (
//             <Button
//               variant="contained"
//               startIcon={<AddIcon />}
//               onClick={() => handleOpenDialog()}
//               size="large"
//             >
//               Add Your First Client
//             </Button>
//           )}
//         </Paper>
//       ) : (
//         <>
//           <Grid container spacing={3}>
//             {paginatedClients.map((client) => (
//               <Grid item xs={12} sm={6} lg={4} key={client.id}>
//                 <ClientCard
//                   client={client}
//                   onEdit={handleOpenDialog}
//                   onDelete={handleDeleteClient}
//                   onViewDetails={handleViewDetails}
//                 />
//               </Grid>
//             ))}
//           </Grid>

//           {/* Pagination */}
//           {totalPages > 1 && (
//             <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
//               <Pagination
//                 count={totalPages}
//                 page={currentPage}
//                 onChange={(event, page) => setCurrentPage(page)}
//                 color="primary"
//                 size="large"
//                 showFirstButton
//                 showLastButton
//                 sx={{
//                   '& .MuiPaginationItem-root': {
//                     borderRadius: 2
//                   }
//                 }}
//               />
//             </Box>
//           )}

//           {/* Results Info */}
//           <Box sx={{ mt: 3, textAlign: 'center' }}>
//             <Typography variant="body2" color="text.secondary">
//               Showing {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, filteredClients.length)} of {filteredClients.length} clients
//             </Typography>
//           </Box>
//         </>
//       )}

//       {/* Quick Actions FAB */}
//       <Box sx={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1000 }}>
//         <Stack spacing={2}>
//           <Tooltip title="Refresh Data" placement="left">
//             <IconButton
//               sx={{
//                 bgcolor: 'primary.main',
//                 color: 'white',
//                 width: 56,
//                 height: 56,
//                 '&:hover': { bgcolor: 'primary.dark' }
//               }}
//               onClick={fetchClients}
//             >
//               <RefreshIcon />
//             </IconButton>
//           </Tooltip>
          
//           <Tooltip title="Export Data" placement="left">
//             <IconButton
//               sx={{
//                 bgcolor: 'info.main',
//                 color: 'white',
//                 width: 56,
//                 height: 56,
//                 '&:hover': { bgcolor: 'info.dark' }
//               }}
//               onClick={() => {
//                 // Export functionality placeholder
//                 console.log('Exporting data...');
//               }}
//             >
//               <DownloadIcon />
//             </IconButton>
//           </Tooltip>
//         </Stack>
//       </Box>

//       {/* Client Form Dialog */}
//       <ClientForm
//         open={openDialog}
//         onClose={handleCloseDialog}
//         onSubmit={handleSubmit}
//         editingClient={editingClient}
//         loading={submitting}
//       />

//       {/* Success/Error Snackbars */}
//       <Snackbar
//         open={!!error}
//         autoHideDuration={6000}
//         onClose={() => setError('')}
//         anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
//       >
//         <Alert 
//           severity="error" 
//           onClose={() => setError('')}
//           sx={{ 
//             width: '100%',
//             borderRadius: 2,
//             boxShadow: 3
//           }}
//         >
//           {error}
//         </Alert>
//       </Snackbar>

//       <Snackbar
//         open={!!success}
//         autoHideDuration={4000}
//         onClose={() => setSuccess('')}
//         anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
//       >
//         <Alert 
//           severity="success" 
//           onClose={() => setSuccess('')}
//           sx={{ 
//             width: '100%',
//             borderRadius: 2,
//             boxShadow: 3
//           }}
//         >
//           {success}
//         </Alert>
//       </Snackbar>

//       {/* Additional Features Section */}
//       <Paper sx={{ mt: 4, p: 3, borderRadius: 3 }}>
//         <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
//           <TrendingUpIcon color="primary" />
//           Quick Stats & Analytics
//         </Typography>
        
//         <Grid container spacing={3} sx={{ mt: 1 }}>
//           <Grid item xs={12} sm={3}>
//             <Box textAlign="center" sx={{ p: 2, bgcolor: 'primary.50', borderRadius: 2 }}>
//               <Typography variant="h4" color="primary.main" fontWeight="bold">
//                 {clients.filter(c => c.category === 'Financial Services').length}
//               </Typography>
//               <Typography variant="body2" color="text.secondary">
//                 Financial Services
//               </Typography>
//             </Box>
//           </Grid>
          
//           <Grid item xs={12} sm={3}>
//             <Box textAlign="center" sx={{ p: 2, bgcolor: 'success.50', borderRadius: 2 }}>
//               <Typography variant="h4" color="success.main" fontWeight="bold">
//                 {clients.reduce((sum, c) => sum + c.projectsCount, 0)}
//               </Typography>
//               <Typography variant="body2" color="text.secondary">
//                 Total Projects
//               </Typography>
//             </Box>
//           </Grid>
          
//           <Grid item xs={12} sm={3}>
//             <Box textAlign="center" sx={{ p: 2, bgcolor: 'warning.50', borderRadius: 2 }}>
//               <Typography variant="h4" color="warning.main" fontWeight="bold">
//                 {Math.round(clients.reduce((sum, c) => sum + c.projectsCount, 0) / clients.length || 0)}
//               </Typography>
//               <Typography variant="body2" color="text.secondary">
//                 Avg Projects/Client
//               </Typography>
//             </Box>
//           </Grid>
          
//           <Grid item xs={12} sm={3}>
//             <Box textAlign="center" sx={{ p: 2, bgcolor: 'info.50', borderRadius: 2 }}>
//               <Typography variant="h4" color="info.main" fontWeight="bold">
//                 {new Set(clients.map(c => c.location.split(',')[1]?.trim())).size}
//               </Typography>
//               <Typography variant="body2" color="text.secondary">
//                 States/Regions
//               </Typography>
//             </Box>
//           </Grid>
//         </Grid>
//       </Paper>

//       {/* Recent Activity Section */}
//       <Paper sx={{ mt: 4, p: 3, borderRadius: 3 }}>
//         <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
//           <CalendarIcon color="primary" />
//           Recent Activity
//         </Typography>
        
//         <Box sx={{ mt: 2 }}>
//           {clients
//             .sort((a, b) => new Date(b.createdOn) - new Date(a.createdOn))
//             .slice(0, 5)
//             .map((client, index) => (
//               <Box 
//                 key={client.id}
//                 sx={{ 
//                   display: 'flex', 
//                   alignItems: 'center', 
//                   gap: 2, 
//                   py: 1.5,
//                   borderBottom: index < 4 ? '1px solid' : 'none',
//                   borderColor: 'grey.200'
//                 }}
//               >
//                 <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
//                   <BusinessIcon sx={{ fontSize: 18 }} />
//                 </Avatar>
//                 <Box flex={1}>
//                   <Typography variant="body2" fontWeight="medium">
//                     {client.name}
//                   </Typography>
//                   <Typography variant="caption" color="text.secondary">
//                     Last activity: {client.lastActivity}
//                   </Typography>
//                 </Box>
//                 <Chip 
//                   label={client.status} 
//                   size="small" 
//                   color={client.status === 'Active' ? 'success' : 'error'}
//                 />
//               </Box>
//             ))
//           }
//         </Box>
//       </Paper>

//       {/* Footer Actions */}
//       <Box sx={{ mt: 6, textAlign: 'center' }}>
//         <Stack direction="row" spacing={2} justifyContent="center" flexWrap="wrap">
//           <Button 
//             variant="outlined" 
//             startIcon={<UploadIcon />}
//             sx={{ borderRadius: 2 }}
//           >
//             Import Clients
//           </Button>
//           <Button 
//             variant="outlined" 
//             startIcon={<DownloadIcon />}
//             sx={{ borderRadius: 2 }}
//           >
//             Export to Excel
//           </Button>
//           <Button 
//             variant="outlined" 
//             startIcon={<EmailIcon />}
//             sx={{ borderRadius: 2 }}
//           >
//             Send Report
//           </Button>
//         </Stack>
        
//         <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
//           Last updated: {new Date().toLocaleString()}
//         </Typography>
//       </Box>
//     </Box>
//   );
// };

// export default ImprovedClientManagement;