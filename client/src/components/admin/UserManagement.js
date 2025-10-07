import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Alert,
  Snackbar,
  CircularProgress,
  TablePagination,
  InputAdornment,
  Switch,
  FormControlLabel
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Visibility as ViewIcon,
  Block as BlockIcon,
  CheckCircle as ActiveIcon
} from '@mui/icons-material';
import axios from 'axios';


const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Dialog states
  const [openDialog, setOpenDialog] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [viewUser, setViewUser] = useState(null);
  
  // Form states
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    role: 'user',
    tenantId: '',
    isActive: true
  });
  
  // Filter states
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  // Pagination states
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalUsers, setTotalUsers] = useState(0);
  
  // Tenants for dropdown
  const [tenants, setTenants] = useState([]);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page + 1,
        limit: rowsPerPage,
        search,
        role: roleFilter,
        isActive: statusFilter
      });

      const response = await axios.get(`/api/admin/users?${params}`);
      setUsers(response.data.data.users);
      setTotalUsers(response.data.data.pagination.totalUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      setError('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, search, roleFilter, statusFilter]);

  const fetchTenants = useCallback(async () => {
    try {
      const response = await axios.get('/api/tenants?limit=100');
      setTenants(response.data.data.tenants);
    } catch (error) {
      console.error('Error fetching tenants:', error);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchTenants();
  }, [fetchUsers, fetchTenants]);

  const handleOpenDialog = (user = null) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        password: '',
        role: user.role,
        tenantId: user.tenantId?._id || '',
        isActive: user.isActive
      });
    } else {
      setEditingUser(null);
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        role: 'user',
        tenantId: '',
        isActive: true
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingUser(null);
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      role: 'user',
      tenantId: '',
      isActive: true
    });
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      
      if (editingUser) {
        // Update user
        const updateData = { ...formData };
        if (!updateData.password) delete updateData.password;
        
        await axios.put(`/api/admin/users/${editingUser._id}`, updateData);
        setSuccess('User updated successfully');
      } else {
        // Create user
        await axios.post('/api/admin/users', formData);
        setSuccess('User created successfully');
      }
      
      handleCloseDialog();
      fetchUsers();
    } catch (error) {
      console.error('Error saving user:', error);
      setError(error.response?.data?.message || 'Failed to save user');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    
    try {
      setLoading(true);
      await axios.delete(`/api/admin/users/${userId}`);
      setSuccess('User deleted successfully');
      fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      setError(error.response?.data?.message || 'Failed to delete user');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (userId, currentStatus) => {
    try {
      setLoading(true);
      await axios.put(`/api/admin/users/${userId}`, {
        isActive: !currentStatus
      });
      setSuccess(`User ${currentStatus ? 'deactivated' : 'activated'} successfully`);
      fetchUsers();
    } catch (error) {
      console.error('Error updating user status:', error);
      setError('Failed to update user status');
    } finally {
      setLoading(false);
    }
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'super_admin': return 'error';
      case 'admin': return 'warning';
      case 'user': return 'primary';
      default: return 'default';
    }
  };

  const getStatusIcon = (isActive) => {
    return isActive ? <ActiveIcon color="success" /> : <BlockIcon color="error" />;
  };

  if (loading && users.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', color: 'primary.main' }}>
          User Management
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          Manage all users across your multi-tenant platform
        </Typography>
      </Box>

      {/* Actions and Filters */}
      <Box sx={{ 
        mb: 3, 
        display: 'flex', 
        gap: 2, 
        flexWrap: 'wrap', 
        alignItems: 'center',
        flexDirection: { xs: 'column', sm: 'row' },
        '& > *': { minWidth: { xs: '100%', sm: 'auto' } }
      }}>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
          sx={{ borderRadius: 2, width: { xs: '100%', sm: 'auto' } }}
        >
          Add New User
        </Button>

        <TextField
          size="small"
          placeholder="Search users..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          sx={{ minWidth: { xs: '100%', sm: 250 } }}
        />

        <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 120 } }}>
          <InputLabel>Role</InputLabel>
          <Select
            value={roleFilter}
            label="Role"
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <MenuItem value="">All Roles</MenuItem>
            <MenuItem value="super_admin">Super Admin</MenuItem>
            <MenuItem value="admin">Admin</MenuItem>
            <MenuItem value="user">User</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 120 } }}>
          <InputLabel>Status</InputLabel>
          <Select
            value={statusFilter}
            label="Status"
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <MenuItem value="">All Status</MenuItem>
            <MenuItem value="true">Active</MenuItem>
            <MenuItem value="false">Inactive</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* Users Table */}
      <Paper sx={{ width: '100%', overflow: 'hidden' }}>
        <TableContainer sx={{ maxHeight: { xs: 400, md: 600 } }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontSize: { xs: '0.75rem', md: '0.875rem' } }}>Name</TableCell>
                <TableCell sx={{ fontSize: { xs: '0.75rem', md: '0.875rem' }, display: { xs: 'none', sm: 'table-cell' } }}>Email</TableCell>
                <TableCell sx={{ fontSize: { xs: '0.75rem', md: '0.875rem' } }}>Role</TableCell>
                <TableCell sx={{ fontSize: { xs: '0.75rem', md: '0.875rem' }, display: { xs: 'none', md: 'table-cell' } }}>Tenant</TableCell>
                <TableCell sx={{ fontSize: { xs: '0.75rem', md: '0.875rem' } }}>Status</TableCell>
                <TableCell sx={{ fontSize: { xs: '0.75rem', md: '0.875rem' }, display: { xs: 'none', lg: 'table-cell' } }}>Created</TableCell>
                <TableCell align="center" sx={{ fontSize: { xs: '0.75rem', md: '0.875rem' } }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user._id} hover>
                  <TableCell sx={{ fontSize: { xs: '0.75rem', md: '0.875rem' } }}>
                    <Box>
                      <Typography variant="subtitle2" fontWeight="bold" sx={{ fontSize: { xs: '0.75rem', md: '0.875rem' } }}>
                        {user.firstName} {user.lastName}
                      </Typography>
                      <Typography variant="caption" sx={{ display: { xs: 'block', sm: 'none' }, fontSize: '0.7rem' }}>
                        {user.email}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ fontSize: { xs: '0.75rem', md: '0.875rem' }, display: { xs: 'none', sm: 'table-cell' } }}>
                    {user.email}
                  </TableCell>
                  <TableCell sx={{ fontSize: { xs: '0.75rem', md: '0.875rem' } }}>
                    <Chip
                      label={user.role.replace('_', ' ').toUpperCase()}
                      color={getRoleColor(user.role)}
                      size="small"
                      sx={{ fontSize: { xs: '0.7rem', md: '0.75rem' } }}
                    />
                  </TableCell>
                  <TableCell sx={{ fontSize: { xs: '0.75rem', md: '0.875rem' }, display: { xs: 'none', md: 'table-cell' } }}>
                    {user.tenantId ? user.tenantId.name : 'No Tenant'}
                  </TableCell>
                  <TableCell sx={{ fontSize: { xs: '0.75rem', md: '0.875rem' } }}>
                    <Box display="flex" alignItems="center" gap={1}>
                      {getStatusIcon(user.isActive)}
                      <Typography variant="body2" sx={{ fontSize: { xs: '0.7rem', md: '0.75rem' } }}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ fontSize: { xs: '0.75rem', md: '0.875rem' }, display: { xs: 'none', lg: 'table-cell' } }}>
                    {new Date(user.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell align="center" sx={{ fontSize: { xs: '0.75rem', md: '0.875rem' } }}>
                    <Box display="flex" gap={0.5} justifyContent="center" flexWrap="wrap">
                      <IconButton
                        size="small"
                        onClick={() => setViewUser(user)}
                        color="info"
                        sx={{ minWidth: 'auto', padding: { xs: '4px', md: '8px' } }}
                      >
                        <ViewIcon sx={{ fontSize: { xs: '1rem', md: '1.25rem' } }} />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleOpenDialog(user)}
                        color="primary"
                        sx={{ minWidth: 'auto', padding: { xs: '4px', md: '8px' } }}
                      >
                        <EditIcon sx={{ fontSize: { xs: '1rem', md: '1.25rem' } }} />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleToggleStatus(user._id, user.isActive)}
                        color={user.isActive ? 'warning' : 'success'}
                        sx={{ minWidth: 'auto', padding: { xs: '4px', md: '8px' } }}
                      >
                        {user.isActive ? <BlockIcon sx={{ fontSize: { xs: '1rem', md: '1.25rem' } }} /> : <ActiveIcon sx={{ fontSize: { xs: '1rem', md: '1.25rem' } }} />}
                      </IconButton>
                      {user.role !== 'super_admin' && (
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteUser(user._id)}
                          color="error"
                          sx={{ minWidth: 'auto', padding: { xs: '4px', md: '8px' } }}
                        >
                          <DeleteIcon sx={{ fontSize: { xs: '1rem', md: '1.25rem' } }} />
                        </IconButton>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        
        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={totalUsers}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={(event, newPage) => setPage(newPage)}
          onRowsPerPageChange={(event) => {
            setRowsPerPage(parseInt(event.target.value, 10));
            setPage(0);
          }}
        />
      </Paper>

      {/* Create/Edit User Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingUser ? 'Edit User' : 'Add New User'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                fullWidth
                label="First Name"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                required
              />
              <TextField
                fullWidth
                label="Last Name"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                required
              />
            </Box>
            
            <TextField
              fullWidth
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
            
            {!editingUser && (
              <TextField
                fullWidth
                label="Password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
              />
            )}
            
            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormControl fullWidth>
                <InputLabel>Role</InputLabel>
                <Select
                  value={formData.role}
                  label="Role"
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                >
                  <MenuItem value="user">User</MenuItem>
                  <MenuItem value="admin">Admin</MenuItem>
                  <MenuItem value="super_admin">Super Admin</MenuItem>
                </Select>
              </FormControl>
              
              <FormControl fullWidth>
                <InputLabel>Tenant</InputLabel>
                <Select
                  value={formData.tenantId}
                  label="Tenant"
                  onChange={(e) => setFormData({ ...formData, tenantId: e.target.value })}
                  disabled={formData.role === 'super_admin'}
                >
                  <MenuItem value="">No Tenant</MenuItem>
                  {tenants.map((tenant) => (
                    <MenuItem key={tenant._id} value={tenant._id}>
                      {tenant.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            
            <FormControlLabel
              control={
                <Switch
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                />
              }
              label="Active User"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button 
            onClick={handleSubmit} 
            variant="contained"
            disabled={loading}
          >
            {loading ? <CircularProgress size={20} /> : (editingUser ? 'Update' : 'Create')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* View User Dialog */}
      <Dialog open={!!viewUser} onClose={() => setViewUser(null)} maxWidth="sm" fullWidth>
        <DialogTitle>User Details</DialogTitle>
        <DialogContent>
          {viewUser && (
            <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  fullWidth
                  label="First Name"
                  value={viewUser.firstName}
                  InputProps={{ readOnly: true }}
                />
                <TextField
                  fullWidth
                  label="Last Name"
                  value={viewUser.lastName}
                  InputProps={{ readOnly: true }}
                />
              </Box>
              
              <TextField
                fullWidth
                label="Email"
                value={viewUser.email}
                InputProps={{ readOnly: true }}
              />
              
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  fullWidth
                  label="Role"
                  value={viewUser.role.replace('_', ' ').toUpperCase()}
                  InputProps={{ readOnly: true }}
                />
                
                <TextField
                  fullWidth
                  label="Tenant"
                  value={viewUser.tenantId ? viewUser.tenantId.name : 'No Tenant'}
                  InputProps={{ readOnly: true }}
                />
              </Box>
              
              <TextField
                fullWidth
                label="Status"
                value={viewUser.isActive ? 'Active' : 'Inactive'}
                InputProps={{ readOnly: true }}
              />
              
              <TextField
                fullWidth
                label="Created At"
                value={new Date(viewUser.createdAt).toLocaleString()}
                InputProps={{ readOnly: true }}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewUser(null)}>Close</Button>
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

export default UserManagement;
