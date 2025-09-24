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
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormHelperText
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Business as BusinessIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  Person as PersonIcon
} from '@mui/icons-material';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';


const OfficeStaffList = () => {
  const [staff, setStaff] = useState([]);
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
  
  // Add Office Staff Dialog
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phoneNumber: '',
    role: '',
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

  useEffect(() => {
    fetchOfficeStaff();
  }, []);

  const fetchOfficeStaff = async () => {
    try {
      setLoading(true);
      setError('');
      
      const token = localStorage.getItem('token');
      if (!token) {
        setError('No authentication token found. Please login again.');
        return;
      }
      
      console.log('Fetching office staff from API...');
      const response = await axios.get('http://localhost:5000/api/tenant/users/staff', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('API Response:', response.data);
      console.log('Current staff state before update:', staff);
      
      if (response.data.success) {
        const newStaff = response.data.data || [];
        setStaff(newStaff);
        console.log(`Updated staff state with ${newStaff.length} members:`, newStaff);
      } else {
        setError('Failed to fetch office staff: Invalid response format');
        setStaff([]);
      }
    } catch (error) {
      console.error('Error fetching office staff:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
      setError(`Failed to fetch office staff: ${errorMessage}`);
      setStaff([]);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusToggle = async (staffId, currentStatus) => {
    try {
      const token = localStorage.getItem('token');
      const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
      const response = await axios.put(`http://localhost:5000/api/tenant/users/staff/${staffId}/status`, { status: newStatus }, { headers: { Authorization: `Bearer ${token}` } });
      
      if (response.data.success) {
        setSuccess(`Staff status updated to ${newStatus}`);
        fetchOfficeStaff(); // Refresh data
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (error) {
      console.error('Error updating staff status:', error);
      setError(`Failed to update status: ${error.response?.data?.message || error.message}`);
    }
  };

  const handleDeleteStaff = async (staffId) => {
    if (!window.confirm('Are you sure you want to delete this office staff?')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`http://localhost:5000/api/tenant/users/staff/${staffId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuccess('Office staff deleted successfully');
      fetchOfficeStaff();
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error deleting office staff:', error);
      setError(error.response?.data?.message || 'Failed to delete office staff');
    }
  };

  // Add Office Staff Functions
  const handleOpenAddDialog = () => {
    setOpenAddDialog(true);
    setFormErrors({});
    setDialogError('');
  };

  const handleCloseAddDialog = () => {
    setOpenAddDialog(false);
    setDialogError('');
    setFormData({
      name: '',
      phoneNumber: '',
      role: '',
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

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error when user starts typing
    if (formErrors[name]) {
      setFormErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleFileChange = (e, fieldName) => {
    const file = e.target.files[0];
    setFormData(prev => ({
      ...prev,
      [fieldName]: file
    }));
  };

  const validateForm = () => {
    const errors = {};
    
    if (!formData.name.trim()) errors.name = 'Please enter name';
    if (!formData.email.trim()) errors.email = 'Please enter email';
    if (formData.email && !/^[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}$/.test(formData.email)) errors.email = 'Invalid email';
    if (!formData.phoneNumber.trim()) errors.phoneNumber = 'Please enter phone number';
    if (!formData.role) errors.role = 'Please select a role';
    if (!formData.address.trim()) errors.address = 'Please enter address';
    if (!formData.city.trim()) errors.city = 'Please enter city';
    if (!formData.state.trim()) errors.state = 'Please enter state';
    if (!formData.zipCode.trim()) errors.zipCode = 'Please enter zip code';
    if (!formData.password) errors.password = 'Please enter password';
    if (!formData.confirmPassword) errors.confirmPassword = 'Please enter confirm password';
    
    if (formData.password && formData.confirmPassword && formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }
    
    // Optional validation for PAN and Aadhaar
    if (formData.panCardNo && formData.panCardNo.trim()) {
      const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
      if (!panRegex.test(formData.panCardNo.toUpperCase())) {
        errors.panCardNo = 'PAN should be in format: ABCDE1234F';
      }
    }
    
    if (formData.aadhaarNumber && formData.aadhaarNumber.trim()) {
      const aadhaarRegex = /^[0-9]{12}$/;
      if (!aadhaarRegex.test(formData.aadhaarNumber)) {
        errors.aadhaarNumber = 'Aadhaar should be 12 digits';
      }
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    
    try {
      setLoading(true);
      setDialogError('');
      
      // Prepare data for submission (excluding file objects for now)
      const submitData = {
        name: formData.name,
        email: formData.email,
        phoneNumber: formData.phoneNumber,
        role: formData.role,
        address: formData.address,
        city: formData.city,
        state: formData.state,
        zipCode: formData.zipCode,
        password: formData.password,
        panCardNo: formData.panCardNo,
        aadhaarNumber: formData.aadhaarNumber
      };
      
      console.log('Submitting office staff data:', submitData);
      
      const token = localStorage.getItem('token');
      const response = await axios.post('http://localhost:5000/api/tenant/users/staff', submitData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Response from server:', response.data);
      
      if (response.data.success) {
        setSuccess('Office staff added successfully!');
        handleCloseAddDialog();
        console.log('Refreshing office staff list...');
        fetchOfficeStaff(); // Refresh the list
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (error) {
      console.error('Error adding office staff:', error);
      if (error.response?.data?.errors && Array.isArray(error.response.data.errors)) {
        const errorMessages = error.response.data.errors.join(', ');
        setDialogError(`Validation errors: ${errorMessages}`);
      } else {
        setDialogError(error.response?.data?.message || error.message || 'Failed to add office staff');
      }
    } finally {
      setLoading(false);
    }
  };

  // Filter staff based on search
  const filteredStaff = staff.filter(staffMember => {
    const emailMatch = staffMember.email?.toLowerCase().includes(searchEmail.toLowerCase()) || !searchEmail;
    const nameMatch = (staffMember.fullName || staffMember.name || '').toLowerCase().includes(searchName.toLowerCase()) || !searchName;
    const mobileValue = staffMember.phoneNumber || staffMember.mobile || staffMember.phone || '';
    const mobileMatch = String(mobileValue).includes(searchMobile) || !searchMobile;
    return emailMatch && nameMatch && mobileMatch;
  });

  // Paginate staff
  const paginatedStaff = filteredStaff.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <BusinessIcon sx={{ fontSize: 32, color: 'primary.main' }} />
        <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
          Office Staff List
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
          onClick={handleOpenAddDialog}
          sx={{ 
            borderRadius: 2,
            bgcolor: '#424242',
            '&:hover': { bgcolor: '#616161' }
          }}
        >
          Add Office Staff
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
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={fetchOfficeStaff}
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
          placeholder="Email"
          value={searchEmail}
          onChange={(e) => setSearchEmail(e.target.value)}
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

      {/* Staff List Table */}
      <Paper sx={{ width: '100%', overflow: 'hidden' }}>
        <TableContainer>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>S.No</TableCell>
                <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>Staff ID</TableCell>
                <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>City</TableCell>
                <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>State</TableCell>
                <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>Mobile no.</TableCell>
                <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>Role</TableCell>
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
                      Loading office staff...
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : paginatedStaff.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      {staff.length === 0 ? 'No office staff found. Add your first staff member!' : 'No staff match your search criteria.'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedStaff.map((staffMember, index) => (
                  <TableRow key={staffMember._id || staffMember.id} hover>
                    <TableCell>{page * rowsPerPage + index + 1}</TableCell>
                    <TableCell>{staffMember.staffCode || staffMember.staffId || staffMember._id || staffMember.id}</TableCell>
                    <TableCell>
                      <Typography variant="subtitle2" fontWeight="bold">
                        {staffMember.fullName || staffMember.name || 'N/A'}
                      </Typography>
                    </TableCell>
                    <TableCell>{staffMember.city || 'N/A'}</TableCell>
                    <TableCell>{staffMember.state || 'N/A'}</TableCell>
                    <TableCell>{staffMember.phoneNumber || staffMember.mobile || staffMember.phone || 'N/A'}</TableCell>
                    <TableCell>
                      <Chip 
                        label={staffMember.role || 'officestaff'} 
                        size="small" 
                        color="primary" 
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      {staffMember.createdAt ? 
                        new Date(staffMember.createdAt).toLocaleDateString('en-US', { 
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
                        label={staffMember.status === 'active' ? 'Active' : 'Inactive'} 
                        size="small" 
                        color={staffMember.status === 'active' ? 'success' : 'error'} 
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Box display="flex" gap={1} justifyContent="center">
                        <IconButton size="small" color="primary" onClick={() => navigate(`/tenant/users/staff/${staffMember._id || staffMember.id}`)}>
                          <ViewIcon />
                        </IconButton>
                        <IconButton 
                          size="small" 
                          onClick={() => handleStatusToggle(staffMember._id || staffMember.id, staffMember.status)}
                        >
                          {staffMember.status === 'active' ? <PauseIcon /> : <PlayIcon />}
                        </IconButton>
                        <IconButton size="small" color="primary" onClick={() => navigate(`/tenant/users/staff/${staffMember._id || staffMember.id}?edit=1`)}>
                          <EditIcon />
                        </IconButton>
                        <IconButton size="small" color="error" onClick={() => handleDeleteStaff(staffMember._id || staffMember.id)}>
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
          rowsPerPageOptions={[10, 25, 50]}
          component="div"
          count={filteredStaff.length}
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
          {filteredStaff.length} records found
        </Typography>
      </Box>

      {/* Add Office Staff Dialog */}
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
            overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)'
          }
        }}
      >
        <DialogTitle sx={{ 
          bgcolor: 'background.paper',
          color: 'text.primary',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 'bold',
          position: 'sticky',
          top: 0,
          zIndex: 1,
          borderBottom: '1px solid',
          borderColor: 'divider',
          py: 2
        }}>
          Add Office Staff
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
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Role *</InputLabel>
                <Select
                  name="role"
                  value={formData.role}
                  onChange={handleInputChange}
                  label="Role *"
                  error={!!formErrors.role}
                >
                  <MenuItem value="">-Select a Role-</MenuItem>
                  <MenuItem value="Sub Admin">Sub Admin</MenuItem>
                  <MenuItem value="Vehicle Confirmer">Vehicle Confirmer</MenuItem>
                  <MenuItem value="Manager">Manager</MenuItem>
                  <MenuItem value="Supervisor">Supervisor</MenuItem>
                  <MenuItem value="Staff">Staff</MenuItem>
                </Select>
                {formErrors.role && <FormHelperText error>{formErrors.role}</FormHelperText>}
              </FormControl>

              <TextField
                fullWidth
                label="Address *"
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                sx={{ mb: 2 }}
                error={!!formErrors.address}
                helperText={formErrors.address}
              />

              <TextField
                fullWidth
                label="State *"
                name="state"
                value={formData.state}
                onChange={handleInputChange}
                sx={{ mb: 2 }}
                error={!!formErrors.state}
                helperText={formErrors.state}
              />

              <TextField
                fullWidth
                label="Password *"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleInputChange}
                sx={{ mb: 2 }}
                error={!!formErrors.password}
                helperText={formErrors.password}
              />

              <TextField
                fullWidth
                label="Pan Card No."
                name="panCardNo"
                value={formData.panCardNo}
                onChange={handleInputChange}
                sx={{ mb: 2 }}
                error={!!formErrors.panCardNo}
                helperText={formErrors.panCardNo || "Format: ABCDE1234F (optional)"}
              />

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                  Aadhar Card Front
                </Typography>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => handleFileChange(e, 'aadharCardFront')}
                  style={{ width: '100%' }}
                />
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                  Police Verification
                </Typography>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => handleFileChange(e, 'policeVerification')}
                  style={{ width: '100%' }}
                />
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                  Pan Card Photo
                </Typography>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => handleFileChange(e, 'panCardPhoto')}
                  style={{ width: '100%' }}
                />
              </Box>
            </Box>

            {/* Right Column */}
            <Box>
              <TextField
                fullWidth
                label="Name *"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                sx={{ mb: 2 }}
                error={!!formErrors.name}
                helperText={formErrors.name}
              />

              <TextField
                fullWidth
                label="Email *"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                sx={{ mb: 2 }}
                error={!!formErrors.email}
                helperText={formErrors.email}
              />

              <TextField
                fullWidth
                label="Phone Number *"
                name="phoneNumber"
                value={formData.phoneNumber}
                onChange={handleInputChange}
                sx={{ mb: 2 }}
                error={!!formErrors.phoneNumber}
                helperText={formErrors.phoneNumber || "Enter 10-digit mobile number"}
              />

              <TextField
                fullWidth
                label="City *"
                name="city"
                value={formData.city}
                onChange={handleInputChange}
                sx={{ mb: 2 }}
                error={!!formErrors.city}
                helperText={formErrors.city}
              />

              <TextField
                fullWidth
                label="Zip Code *"
                name="zipCode"
                value={formData.zipCode}
                onChange={handleInputChange}
                sx={{ mb: 2 }}
                error={!!formErrors.zipCode}
                helperText={formErrors.zipCode}
              />

              <TextField
                fullWidth
                label="Confirm Password *"
                name="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                sx={{ mb: 2 }}
                error={!!formErrors.confirmPassword}
                helperText={formErrors.confirmPassword}
              />

              <TextField
                fullWidth
                label="Aadhaar Number"
                name="aadhaarNumber"
                value={formData.aadhaarNumber}
                onChange={handleInputChange}
                sx={{ mb: 2 }}
                error={!!formErrors.aadhaarNumber}
                helperText={formErrors.aadhaarNumber || "12 digits (optional)"}
              />

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                  Aadhar Card Back
                </Typography>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => handleFileChange(e, 'aadharCardBack')}
                  style={{ width: '100%' }}
                />
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                  DRA Certificate
                </Typography>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => handleFileChange(e, 'draCertificate')}
                  style={{ width: '100%' }}
                />
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                  Profile Photo
                </Typography>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => handleFileChange(e, 'profilePhoto')}
                  style={{ width: '100%' }}
                />
              </Box>
            </Box>
          </Box>
        </DialogContent>

        <DialogActions sx={{ p: 2, justifyContent: 'center', gap: 2, borderTop: '1px solid', borderColor: 'divider' }}>
          <Button
            variant="outlined"
            onClick={handleCloseAddDialog}
            sx={{ 
              minWidth: 120,
              borderRadius: 2,
              borderColor: '#424242',
              color: '#424242',
              '&:hover': { 
                borderColor: '#616161',
                bgcolor: 'rgba(66, 66, 66, 0.04)'
              }
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={loading}
            sx={{ 
              minWidth: 120,
              borderRadius: 2,
              bgcolor: '#424242',
              '&:hover': { bgcolor: '#616161' }
            }}
          >
            {loading ? <CircularProgress size={20} /> : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default OfficeStaffList;

