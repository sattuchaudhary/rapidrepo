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
  TextField,
  IconButton,
  Chip,
  CircularProgress,
  Alert,
  TablePagination,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Person as PersonIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  Map as MapIcon,
  TrackChanges as TrackIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import axios from 'axios';


const RepoAgentList = () => {
  const [agents, setAgents] = useState([]);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dialogError, setDialogError] = useState('');
  const [searchEmail, setSearchEmail] = useState('');
  const [searchName, setSearchName] = useState('');
  const [searchMobile, setSearchMobile] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  
  // Add Repo Agent Dialog State
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phoneNumber: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    password: '',
    confirmPassword: '',
    panCardNo: '',
    aadhaarNumber: '',
    aadharCardFront: null,
    aadharCardBack: null,
    policeVerification: null,
    panCardPhoto: null,
    draCertificate: null,
    profilePhoto: null
  });
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  
  // Data Mapping Dialog State
  const [openMappingDialog, setOpenMappingDialog] = useState(false);
  const [fieldMapping, setFieldMapping] = useState({
    regNo: true,
    chassisNo: true,
    loanNo: true,
    bank: true,
    make: true,
    customerName: true,
    engineNo: true,
    emiAmount: true,
    address: true,
    branch: true,
    pos: true,
    model: true,
    productName: true,
    bucket: true,
    season: true,
    inYard: false,
    yardName: false,
    yardLocation: false,
    status: true,
    uploadDate: false,
    fileName: false
  });

  useEffect(() => {
    fetchRepoAgents();
  }, []);

  const fetchRepoAgents = async () => {
    try {
      setLoading(true);
      setError('');
      
      const token = localStorage.getItem('token');
      if (!token) {
        setError('No authentication token found. Please login again.');
        return;
      }
      
      console.log('Fetching repo agents from API...');
      const response = await axios.get('http://localhost:5000/api/tenant/users/agents', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('API Response:', response.data);
      
      if (response.data.success) {
        setAgents(response.data.data || []);
        console.log(`Loaded ${response.data.data?.length || 0} repo agents from database`);
      } else {
        setError('Failed to fetch repo agents: Invalid response format');
        setAgents([]);
      }
    } catch (error) {
      console.error('Error fetching repo agents:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
      setError(`Failed to fetch repo agents: ${errorMessage}`);
      setAgents([]);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusToggle = async (agentId, currentStatus) => {
    try {
      const token = localStorage.getItem('token');
      const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
      const response = await axios.put(`http://localhost:5000/api/tenant/users/agents/${agentId}/status`, { status: newStatus }, { headers: { Authorization: `Bearer ${token}` } });
      
      if (response.data.success) {
        setSuccess(`Agent status updated to ${newStatus}`);
        fetchRepoAgents(); // Refresh data
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (error) {
      console.error('Error updating agent status:', error);
      setError(`Failed to update status: ${error.response?.data?.message || error.message}`);
    }
  };

  const handleDeleteAgent = async (agentId) => {
    if (!window.confirm('Are you sure you want to delete this repo agent?')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`http://localhost:5000/api/tenant/users/agents/${agentId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuccess('Repo agent deleted successfully');
      fetchRepoAgents();
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error deleting repo agent:', error);
      setError(error.response?.data?.message || 'Failed to delete repo agent');
    }
  };

  // Add Repo Agent Dialog Handlers
  const handleOpenAddDialog = () => {
    setOpenAddDialog(true);
    setFormErrors({});
    setDialogError('');
    setFormData({
      name: '',
      email: '',
      phoneNumber: '',
      address: '',
      city: '',
      state: '',
      zipCode: '',
      password: '',
      confirmPassword: '',
      panCardNo: '',
      aadhaarNumber: '',
      aadharCardFront: null,
      aadharCardBack: null,
      policeVerification: null,
      panCardPhoto: null,
      draCertificate: null,
      profilePhoto: null
    });
  };

  const handleCloseAddDialog = () => {
    setOpenAddDialog(false);
    setFormErrors({});
    setDialogError('');
    setFormData({
      name: '',
      email: '',
      phoneNumber: '',
      address: '',
      city: '',
      state: '',
      zipCode: '',
      password: '',
      confirmPassword: '',
      panCardNo: '',
      aadhaarNumber: '',
      aadharCardFront: null,
      aadharCardBack: null,
      policeVerification: null,
      panCardPhoto: null,
      draCertificate: null,
      profilePhoto: null
    });
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleFileChange = (field, file) => {
    setFormData(prev => ({ ...prev, [field]: file }));
  };

  const validateForm = () => {
    const errors = {};
    
    if (!formData.name.trim()) errors.name = 'Name is required';
    if (!formData.email.trim()) errors.email = 'Email is required';
    if (!formData.phoneNumber.trim()) errors.phoneNumber = 'Phone number is required';
    if (!formData.address.trim()) errors.address = 'Address is required';
    if (!formData.city.trim()) errors.city = 'City is required';
    if (!formData.state.trim()) errors.state = 'State is required';
    if (!formData.zipCode.trim()) errors.zipCode = 'Zip code is required';
    if (!formData.password) errors.password = 'Password is required';
    if (!formData.confirmPassword) errors.confirmPassword = 'Please enter confirm password';
    
    if (formData.password && formData.confirmPassword && formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }
    
    if (formData.password && formData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }
    
    // Optional validation for PAN and Aadhaar if provided
    if (formData.panCardNo && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(formData.panCardNo)) {
      errors.panCardNo = 'Please enter a valid PAN card number';
    }
    
    if (formData.aadhaarNumber && !/^\d{12}$/.test(formData.aadhaarNumber)) {
      errors.aadhaarNumber = 'Please enter a valid 12-digit Aadhaar number';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    
    try {
      setSubmitting(true);
      setError('');
      setDialogError('');
      
      const submitData = {
        name: formData.name,
        email: formData.email,
        phoneNumber: formData.phoneNumber,
        address: formData.address,
        city: formData.city,
        state: formData.state,
        zipCode: formData.zipCode,
        password: formData.password,
        panCardNo: formData.panCardNo,
        aadhaarNumber: formData.aadhaarNumber,
        role: 'Repo Agent'
      };
      
      console.log('Submitting repo agent data:', submitData);
      
      const token = localStorage.getItem('token');
      const response = await axios.post('http://localhost:5000/api/tenant/users/agents', submitData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Response from server:', response.data);
      
      if (response.data.success) {
        setSuccess('Repo agent added successfully!');
        handleCloseAddDialog();
        fetchRepoAgents(); // Refresh the list
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (error) {
      console.error('Error adding repo agent:', error);
      if (error.response?.data?.errors && Array.isArray(error.response.data.errors)) {
        const errorMessages = error.response.data.errors.join(', ');
        setDialogError(`Validation errors: ${errorMessages}`);
      } else {
        setDialogError(error.response?.data?.message || error.message || 'Failed to add repo agent');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Filter agents based on search
  const filteredAgents = agents.filter(agent => {
    const emailMatch = agent.email?.toLowerCase().includes(searchEmail.toLowerCase()) || !searchEmail;
    const nameMatch = (agent.fullName || agent.name || '').toLowerCase().includes(searchName.toLowerCase()) || !searchName;
    const mobileValue = agent.phoneNumber || agent.mobile || agent.phone || '';
    const mobileMatch = String(mobileValue).includes(searchMobile) || !searchMobile;
    return emailMatch && nameMatch && mobileMatch;
  });

  // Paginate agents
  const paginatedAgents = filteredAgents.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <PersonIcon sx={{ fontSize: 32, color: 'primary.main' }} />
        <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
          Repo Agent List
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
          startIcon={<MapIcon />}
          onClick={() => setOpenMappingDialog(true)}
          sx={{ 
            borderRadius: 2,
            bgcolor: '#424242',
            '&:hover': { bgcolor: '#616161' }
          }}
        >
          Data Mapping
        </Button>
        
        <Button
          variant="outlined"
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
          Export
        </Button>
        
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleOpenAddDialog}
          sx={{ 
            borderRadius: 2,
            bgcolor: '#424242',
            '&:hover': { bgcolor: '#616161' }
          }}
        >
          Add Repo Agent
        </Button>
        
        <Button
          variant="outlined"
          startIcon={<TrackIcon />}
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
          Track All Repo Agent
        </Button>
        
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={fetchRepoAgents}
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

      {/* Search Filters */}
      <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <TextField
          size="small"
          placeholder="Email"
          value={searchEmail}
          onChange={(e) => setSearchEmail(e.target.value)}
          sx={{ minWidth: 200 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
        <TextField
          size="small"
          placeholder="Full Name"
          value={searchName}
          onChange={(e) => setSearchName(e.target.value)}
          sx={{ minWidth: 200 }}
        />
        <TextField
          size="small"
          placeholder="Mobile Number"
          value={searchMobile}
          onChange={(e) => setSearchMobile(e.target.value)}
          sx={{ minWidth: 200 }}
        />
      </Box>

      {/* Repo Agent List Table */}
      <Paper sx={{ width: '100%', overflow: 'hidden' }}>
        <TableContainer>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>S.No</TableCell>
                <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>Agent ID</TableCell>
                <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>City</TableCell>
                <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>State</TableCell>
                <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>Email</TableCell>
                <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>Phone No.</TableCell>
                <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>Created On</TableCell>
                <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>OTP Verification</TableCell>
                <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }} align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={11} align="center" sx={{ py: 4 }}>
                    <CircularProgress size={24} />
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      Loading repo agents...
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : paginatedAgents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      {agents.length === 0 ? 'No repo agents found. Add your first agent!' : 'No agents match your search criteria.'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedAgents.map((agent, index) => (
                  <TableRow key={agent._id || agent.id} hover>
                    <TableCell>{page * rowsPerPage + index + 1}</TableCell>
                    <TableCell>{agent.agentCode || agent.agentId || agent._id || agent.id}</TableCell>
                    <TableCell>
                      <Typography variant="subtitle2" fontWeight="bold">
                        {agent.fullName || agent.name || 'N/A'}
                      </Typography>
                    </TableCell>
                    <TableCell>{agent.city || 'N/A'}</TableCell>
                    <TableCell>{agent.state || 'N/A'}</TableCell>
                    <TableCell>{agent.email || 'N/A'}</TableCell>
                    <TableCell>{agent.phoneNumber || agent.mobile || agent.phone || 'N/A'}</TableCell>
                    <TableCell>
                      {agent.createdAt ? 
                        new Date(agent.createdAt).toLocaleDateString('en-US', { 
                          month: 'numeric', 
                          day: 'numeric', 
                          year: 'numeric' 
                        }) : 'N/A'
                      }
                    </TableCell>
                    <TableCell>
                      <Box sx={{ width: 16, height: 16, bgcolor: 'success.main', borderRadius: 1 }} />
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={agent.status === 'active' ? 'Active' : 'Inactive'} 
                        size="small" 
                        color={agent.status === 'active' ? 'success' : 'error'} 
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Box display="flex" gap={1} justifyContent="center">
                        <IconButton size="small" color="primary" onClick={() => navigate(`/app/tenant/users/agents/${agent._id || agent.id}`)}>
                          <ViewIcon />
                        </IconButton>
                        <IconButton size="small" color="primary" onClick={() => navigate(`/app/tenant/users/agents/${agent._id || agent.id}?edit=1`)}>
                          <EditIcon />
                        </IconButton>
                        <IconButton 
                          size="small" 
                          onClick={() => handleStatusToggle(agent._id || agent.id, agent.status)}
                        >
                          {agent.status === 'active' ? <PauseIcon /> : <PlayIcon />}
                        </IconButton>
                        <IconButton size="small" color="primary">
                          <MapIcon />
                        </IconButton>
                        <IconButton size="small" color="error" onClick={() => handleDeleteAgent(agent._id || agent.id)}>
                          <DeleteIcon />
                        </IconButton>
                        <IconButton size="small" color="primary">
                          <TrackIcon />
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
          count={filteredAgents.length}
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
          {filteredAgents.length} records found
        </Typography>
      </Box>

      {/* Add Repo Agent Dialog */}
      <Dialog 
        open={openAddDialog} 
        onClose={handleCloseAddDialog}
        maxWidth={false}
        fullWidth
        PaperProps={{
          sx: {
            width: { xs: '100%', md: '80vw' },
            maxWidth: 1200,
            m: 0,
            borderRadius: 3,
            overflow: 'hidden'
          }
        }}
      >
        <DialogTitle sx={{ 
          bgcolor: 'background.paper',
          color: 'text.primary',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          position: 'sticky',
          top: 0,
          zIndex: 1,
          borderBottom: '1px solid',
          borderColor: 'divider',
          py: 2
        }}>
          <PersonIcon />
          Add Repo Agent
        </DialogTitle>
        
        <DialogContent sx={{ p: 3, maxHeight: '70vh', overflowY: 'auto' }}>
          {dialogError && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setDialogError('')}>
              {dialogError}
            </Alert>
          )}
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 3, rowGap: 3 }}>
            {/* Left Column */}
            <Box>
              <TextField
                fullWidth
                label="Role"
                value="Repo Agent"
                disabled
                sx={{ mb: 2 }}
              />
              
              <TextField
                fullWidth
                label="Email *"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                error={!!formErrors.email}
                helperText={formErrors.email}
                sx={{ mb: 2 }}
              />
              
              <TextField
                fullWidth
                label="Address *"
                value={formData.address}
                onChange={(e) => handleInputChange('address', e.target.value)}
                error={!!formErrors.address}
                helperText={formErrors.address}
                multiline
                rows={2}
                sx={{ mb: 2 }}
              />
              
              <TextField
                fullWidth
                label="State *"
                value={formData.state}
                onChange={(e) => handleInputChange('state', e.target.value)}
                error={!!formErrors.state}
                helperText={formErrors.state}
                sx={{ mb: 2 }}
              />
              
              <TextField
                fullWidth
                label="Password *"
                type="password"
                value={formData.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                error={!!formErrors.password}
                helperText={formErrors.password || 'Minimum 6 characters'}
                sx={{ mb: 2 }}
              />
              
              <TextField
                fullWidth
                label="Pan Card No."
                value={formData.panCardNo}
                onChange={(e) => handleInputChange('panCardNo', e.target.value.toUpperCase())}
                error={!!formErrors.panCardNo}
                helperText={formErrors.panCardNo || 'Format: ABCDE1234F (optional)'}
                sx={{ mb: 2 }}
              />
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ mb: 1, fontWeight: 'medium' }}>
                  Aadhar Card Front
                </Typography>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => handleFileChange('aadharCardFront', e.target.files[0])}
                  style={{ width: '100%' }}
                />
              </Box>
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ mb: 1, fontWeight: 'medium' }}>
                  Police Verification Certificate
                </Typography>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => handleFileChange('policeVerification', e.target.files[0])}
                  style={{ width: '100%' }}
                />
              </Box>
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ mb: 1, fontWeight: 'medium' }}>
                  Pan Card Photo
                </Typography>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => handleFileChange('panCardPhoto', e.target.files[0])}
                  style={{ width: '100%' }}
                />
              </Box>
            </Box>
            
            {/* Right Column */}
            <Box>
              <TextField
                fullWidth
                label="Name *"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                error={!!formErrors.name}
                helperText={formErrors.name}
                sx={{ mb: 2 }}
              />
              
              <TextField
                fullWidth
                label="Phone Number *"
                value={formData.phoneNumber}
                onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                error={!!formErrors.phoneNumber}
                helperText={formErrors.phoneNumber || 'Enter 10-digit mobile number'}
                sx={{ mb: 2 }}
              />
              
              <TextField
                fullWidth
                label="City *"
                value={formData.city}
                onChange={(e) => handleInputChange('city', e.target.value)}
                error={!!formErrors.city}
                helperText={formErrors.city}
                sx={{ mb: 2 }}
              />
              
              <TextField
                fullWidth
                label="Zip Code *"
                value={formData.zipCode}
                onChange={(e) => handleInputChange('zipCode', e.target.value)}
                error={!!formErrors.zipCode}
                helperText={formErrors.zipCode}
                sx={{ mb: 2 }}
              />
              
              <TextField
                fullWidth
                label="Confirm Password *"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                error={!!formErrors.confirmPassword}
                helperText={formErrors.confirmPassword}
                sx={{ mb: 2 }}
              />
              
              <TextField
                fullWidth
                label="Aadhar Card Number"
                value={formData.aadhaarNumber}
                onChange={(e) => handleInputChange('aadhaarNumber', e.target.value)}
                error={!!formErrors.aadhaarNumber}
                helperText={formErrors.aadhaarNumber || '12 digits (optional)'}
                sx={{ mb: 2 }}
              />
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ mb: 1, fontWeight: 'medium' }}>
                  Aadhar Card Back
                </Typography>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => handleFileChange('aadharCardBack', e.target.files[0])}
                  style={{ width: '100%' }}
                />
              </Box>
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ mb: 1, fontWeight: 'medium' }}>
                  DRA Certificate
                </Typography>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => handleFileChange('draCertificate', e.target.files[0])}
                  style={{ width: '100%' }}
                />
              </Box>
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ mb: 1, fontWeight: 'medium' }}>
                  Profile Photo
                </Typography>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileChange('profilePhoto', e.target.files[0])}
                  style={{ width: '100%' }}
                />
              </Box>
            </Box>
          </Box>
        </DialogContent>
        
        <DialogActions sx={{ p: 2, gap: 2, borderTop: '1px solid', borderColor: 'divider' }}>
          <Button
            variant="outlined"
            onClick={handleCloseAddDialog}
            disabled={submitting}
            sx={{ minWidth: 100 }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={submitting}
            sx={{ 
              minWidth: 100,
              bgcolor: '#424242',
              '&:hover': { bgcolor: '#616161' }
            }}
          >
            {submitting ? <CircularProgress size={20} /> : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Data Mapping Dialog */}
      <Dialog open={openMappingDialog} onClose={() => setOpenMappingDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Mobile App Field Configuration</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Select which fields to show in the mobile app's search result detail modal for repo agents.
          </Typography>
          
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>Basic Information</Typography>
              <FormControlLabel 
                control={<Checkbox checked={fieldMapping.regNo} onChange={(e) => setFieldMapping({...fieldMapping, regNo: e.target.checked})} />} 
                label="Registration Number" 
              />
              <FormControlLabel 
                control={<Checkbox checked={fieldMapping.chassisNo} onChange={(e) => setFieldMapping({...fieldMapping, chassisNo: e.target.checked})} />} 
                label="Chassis Number" 
              />
              <FormControlLabel 
                control={<Checkbox checked={fieldMapping.loanNo} onChange={(e) => setFieldMapping({...fieldMapping, loanNo: e.target.checked})} />} 
                label="Loan Number" 
              />
              <FormControlLabel 
                control={<Checkbox checked={fieldMapping.bank} onChange={(e) => setFieldMapping({...fieldMapping, bank: e.target.checked})} />} 
                label="Bank Name" 
              />
              <FormControlLabel 
                control={<Checkbox checked={fieldMapping.make} onChange={(e) => setFieldMapping({...fieldMapping, make: e.target.checked})} />} 
                label="Vehicle Make" 
              />
              <FormControlLabel 
                control={<Checkbox checked={fieldMapping.customerName} onChange={(e) => setFieldMapping({...fieldMapping, customerName: e.target.checked})} />} 
                label="Customer Name" 
              />
              <FormControlLabel 
                control={<Checkbox checked={fieldMapping.engineNo} onChange={(e) => setFieldMapping({...fieldMapping, engineNo: e.target.checked})} />} 
                label="Engine Number" 
              />
              <FormControlLabel 
                control={<Checkbox checked={fieldMapping.model} onChange={(e) => setFieldMapping({...fieldMapping, model: e.target.checked})} />} 
                label="Vehicle Model" 
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>Financial & Location</Typography>
              <FormControlLabel 
                control={<Checkbox checked={fieldMapping.emiAmount} onChange={(e) => setFieldMapping({...fieldMapping, emiAmount: e.target.checked})} />} 
                label="EMI Amount" 
              />
              <FormControlLabel 
                control={<Checkbox checked={fieldMapping.address} onChange={(e) => setFieldMapping({...fieldMapping, address: e.target.checked})} />} 
                label="Address" 
              />
              <FormControlLabel 
                control={<Checkbox checked={fieldMapping.branch} onChange={(e) => setFieldMapping({...fieldMapping, branch: e.target.checked})} />} 
                label="Branch" 
              />
              <FormControlLabel 
                control={<Checkbox checked={fieldMapping.pos} onChange={(e) => setFieldMapping({...fieldMapping, pos: e.target.checked})} />} 
                label="POS" 
              />
              <FormControlLabel 
                control={<Checkbox checked={fieldMapping.productName} onChange={(e) => setFieldMapping({...fieldMapping, productName: e.target.checked})} />} 
                label="Product Name" 
              />
              <FormControlLabel 
                control={<Checkbox checked={fieldMapping.bucket} onChange={(e) => setFieldMapping({...fieldMapping, bucket: e.target.checked})} />} 
                label="Bucket" 
              />
              <FormControlLabel 
                control={<Checkbox checked={fieldMapping.season} onChange={(e) => setFieldMapping({...fieldMapping, season: e.target.checked})} />} 
                label="Season" 
              />
              <FormControlLabel 
                control={<Checkbox checked={fieldMapping.status} onChange={(e) => setFieldMapping({...fieldMapping, status: e.target.checked})} />} 
                label="Status" 
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>Yard Information</Typography>
              <FormControlLabel 
                control={<Checkbox checked={fieldMapping.inYard} onChange={(e) => setFieldMapping({...fieldMapping, inYard: e.target.checked})} />} 
                label="In Yard" 
              />
              <FormControlLabel 
                control={<Checkbox checked={fieldMapping.yardName} onChange={(e) => setFieldMapping({...fieldMapping, yardName: e.target.checked})} />} 
                label="Yard Name" 
              />
              <FormControlLabel 
                control={<Checkbox checked={fieldMapping.yardLocation} onChange={(e) => setFieldMapping({...fieldMapping, yardLocation: e.target.checked})} />} 
                label="Yard Location" 
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>System Information</Typography>
              <FormControlLabel 
                control={<Checkbox checked={fieldMapping.uploadDate} onChange={(e) => setFieldMapping({...fieldMapping, uploadDate: e.target.checked})} />} 
                label="Upload Date" 
              />
              <FormControlLabel 
                control={<Checkbox checked={fieldMapping.fileName} onChange={(e) => setFieldMapping({...fieldMapping, fileName: e.target.checked})} />} 
                label="File Name" 
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenMappingDialog(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={async () => {
              try {
                const token = localStorage.getItem('token');
                await axios.post('http://localhost:5000/api/tenants/field-mapping', fieldMapping, {
                  headers: { Authorization: `Bearer ${token}` }
                });
                setOpenMappingDialog(false);
                setSuccess('Field mapping configuration saved successfully!');
              } catch (error) {
                setError('Failed to save field mapping configuration');
              }
            }}
          >
            Save Configuration
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RepoAgentList;

