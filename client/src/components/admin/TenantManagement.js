import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Pagination,
  Grid,
  Divider
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon
} from '@mui/icons-material';
import axios from 'axios';
import { toast } from 'react-toastify';

const TenantManagement = () => {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'agency', // agency, nbfc, bank
    subscriptionPlan: 'basic',
    maxUsers: 10,
    // Tenant Admin Details
    adminFirstName: '',
    adminLastName: '',
    adminEmail: '',
    adminPassword: ''
  });

  const fetchTenants = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage,
        limit: 10,
        search: searchTerm
      });
      
      const response = await axios.get(`/api/tenants?${params}`);
      setTenants(response.data.data.tenants);
      setTotalPages(response.data.data.pagination.totalPages);
    } catch (error) {
      console.error('Error fetching tenants:', error);
      setError('Failed to load tenants');
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchTerm]);

  useEffect(() => {
    fetchTenants();
  }, [fetchTenants]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      if (editingTenant) {
        // For editing, don't include admin details
        const { adminFirstName, adminLastName, adminEmail, adminPassword, ...editData } = formData;
        await axios.put(`/api/tenants/${editingTenant._id}`, editData);
        toast.success('Tenant updated successfully!');
      } else {
        // For creating new tenant with admin
        await axios.post('/api/tenants', formData);
        toast.success('Tenant created successfully with admin account!');
      }
      
      setDialogOpen(false);
      setEditingTenant(null);
      resetForm();
      fetchTenants();
    } catch (error) {
      console.error('Error saving tenant:', error);
      const message = error.response?.data?.message || 'Failed to save tenant';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (tenant) => {
    setEditingTenant(tenant);
    setFormData({
      name: tenant.name,
      type: tenant.type || 'agency',
      subscriptionPlan: tenant.subscription?.plan || 'basic',
      maxUsers: tenant.subscription?.maxUsers || 10,
      // Don't populate admin details for editing
      adminFirstName: '',
      adminLastName: '',
      adminEmail: '',
      adminPassword: ''
    });
    setDialogOpen(true);
  };

  const handleDelete = async (tenantId) => {
    if (!window.confirm('Are you sure you want to delete this tenant? This action cannot be undone.')) return;
    
    try {
      await axios.delete(`/api/tenants/${tenantId}`);
      toast.success('Tenant deleted successfully!');
      fetchTenants();
    } catch (error) {
      console.error('Error deleting tenant:', error);
      const message = error.response?.data?.message || 'Failed to delete tenant';
      toast.error(message);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'agency',
      subscriptionPlan: 'basic',
      maxUsers: 10,
      adminFirstName: '',
      adminLastName: '',
      adminEmail: '',
      adminPassword: ''
    });
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingTenant(null);
    resetForm();
  };

  const formatPlan = (plan) => {
    return plan.charAt(0).toUpperCase() + plan.slice(1);
  };

  const getPlanColor = (plan) => {
    switch (plan) {
      case 'enterprise': return 'error';
      case 'premium': return 'warning';
      case 'basic': return 'info';
      default: return 'default';
    }
  };

  const formatType = (type) => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'bank': return 'error';
      case 'nbfc': return 'warning';
      case 'agency': return 'info';
      default: return 'default';
    }
  };

  if (loading && tenants.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          Tenant Management
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setDialogOpen(true)}
        >
          Add Tenant
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
            <TextField
              placeholder="Search tenants..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
              }}
              sx={{ flexGrow: 1 }}
            />
          </Box>

          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Subscription Plan</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Created By</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tenants.map((tenant) => (
                  <TableRow key={tenant._id}>
                    <TableCell>
                      <Typography variant="subtitle2">
                        {tenant.name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={formatType(tenant.type || 'agency')}
                        color={getTypeColor(tenant.type)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={formatPlan(tenant.subscription?.plan || 'basic')}
                        color={getPlanColor(tenant.subscription?.plan)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={tenant.isActive ? 'Active' : 'Inactive'}
                        color={tenant.isActive ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {tenant.createdBy ? 
                        `${tenant.createdBy.firstName} ${tenant.createdBy.lastName}` : 
                        'Unknown'
                      }
                    </TableCell>
                    <TableCell>
                      {new Date(tenant.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => handleEdit(tenant)}
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDelete(tenant._id)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {totalPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
              <Pagination
                count={totalPages}
                page={currentPage}
                onChange={(e, page) => setCurrentPage(page)}
                color="primary"
              />
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Tenant Dialog */}
      <Dialog open={dialogOpen} onClose={handleDialogClose} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingTenant ? 'Edit Tenant' : 'Add New Tenant'}
        </DialogTitle>
        <Box component="form" onSubmit={handleSubmit}>
          <DialogContent>
            <Grid container spacing={2}>
              {/* Tenant Details Section */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom sx={{ color: 'primary.main' }}>
                  Tenant Details
                </Typography>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Tenant Name"
                  name="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="e.g., ABC Finance Ltd."
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth required>
                  <InputLabel>Tenant Type</InputLabel>
                  <Select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    label="Tenant Type"
                  >
                    <MenuItem value="agency">Agency</MenuItem>
                    <MenuItem value="nbfc">NBFC</MenuItem>
                    <MenuItem value="bank">Bank</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Subscription Plan</InputLabel>
                  <Select
                    value={formData.subscriptionPlan}
                    onChange={(e) => setFormData({ ...formData, subscriptionPlan: e.target.value })}
                    label="Subscription Plan"
                  >
                    <MenuItem value="basic">Basic</MenuItem>
                    <MenuItem value="premium">Premium</MenuItem>
                    <MenuItem value="enterprise">Enterprise</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Max Users"
                  name="maxUsers"
                  type="number"
                  value={formData.maxUsers}
                  onChange={(e) => setFormData({ ...formData, maxUsers: parseInt(e.target.value) })}
                  inputProps={{ min: 1, max: 1000 }}
                />
              </Grid>

              {/* Only show admin details for new tenant creation */}
              {!editingTenant && (
                <>
                  <Grid item xs={12}>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="h6" gutterBottom sx={{ color: 'secondary.main' }}>
                      Tenant Admin Account
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      This account will be created as the admin for this tenant
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Admin First Name"
                      name="adminFirstName"
                      value={formData.adminFirstName}
                      onChange={(e) => setFormData({ ...formData, adminFirstName: e.target.value })}
                      required
                    />
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Admin Last Name"
                      name="adminLastName"
                      value={formData.adminLastName}
                      onChange={(e) => setFormData({ ...formData, adminLastName: e.target.value })}
                      required
                    />
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Admin Email"
                      name="adminEmail"
                      type="email"
                      value={formData.adminEmail}
                      onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
                      required
                    />
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Admin Password"
                      name="adminPassword"
                      type="password"
                      value={formData.adminPassword}
                      onChange={(e) => setFormData({ ...formData, adminPassword: e.target.value })}
                      required
                      inputProps={{ minLength: 6 }}
                    />
                  </Grid>
                </>
              )}
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleDialogClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={loading}>
              {loading ? 'Saving...' : (editingTenant ? 'Update' : 'Create')}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
};

export default TenantManagement;
