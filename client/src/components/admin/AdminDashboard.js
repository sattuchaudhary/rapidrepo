import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardHeader,
  Button,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  People as PeopleIcon,
  Business as BusinessIcon,
  CheckCircle as HealthIcon,
  Add as AddIcon,
  TrendingUp as TrendingIcon,
  Storage as DatabaseIcon,
  Dashboard as DashboardIcon,
  Settings as SettingsIcon,
  Visibility as ViewIcon
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const AdminDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeTenants: 0,
    totalTenants: 0,
    systemHealth: 100
  });
  const [recentTenants, setRecentTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [statsResponse, tenantsResponse] = await Promise.all([
        axios.get('http://localhost:5000/api/admin/dashboard/stats'),
        axios.get('http://localhost:5000/api/tenants?limit=5')
      ]);

      setStats({
        totalUsers: statsResponse.data.data.totalUsers || 0,
        activeTenants: statsResponse.data.data.activeTenants || 0,
        totalTenants: statsResponse.data.data.totalTenants || 0,
        systemHealth: 100
      });

      setRecentTenants(tenantsResponse.data.data.tenants || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };



  const getHealthIcon = (health) => {
    if (health >= 90) return <HealthIcon color="success" />;
    if (health >= 70) return <HealthIcon color="warning" />;
    return <HealthIcon color="error" />;
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        <Button variant="contained" onClick={fetchDashboardData}>Retry</Button>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header Section */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', color: 'primary.main' }}>
          <DashboardIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Admin Dashboard
        </Typography>
        <Typography variant="subtitle1" color="text.secondary" gutterBottom>
          Welcome back, <strong>{user?.firstName} {user?.lastName}</strong>! Here's your system overview.
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Manage your multi-tenant SaaS platform with real-time insights and controls.
        </Typography>
      </Box>

      {/* Quick Actions */}
      <Box sx={{ mb: 3 }}>
        <Grid container spacing={2}>
          <Grid item>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => navigate('/admin/tenants')}
              sx={{ borderRadius: 2 }}
            >
              Add New Tenant
            </Button>
          </Grid>
          <Grid item>
            <Button
              variant="outlined"
              startIcon={<PeopleIcon />}
              onClick={() => navigate('/admin/users')}
              sx={{ borderRadius: 2 }}
            >
              Manage Users
            </Button>
          </Grid>
          <Grid item>
            <Button
              variant="outlined"
              startIcon={<SettingsIcon />}
              onClick={() => navigate('/admin/settings')}
              sx={{ borderRadius: 2 }}
            >
              System Settings
            </Button>
          </Grid>
        </Grid>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ 
            height: '100%', 
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white'
          }}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                    {stats.totalUsers.toLocaleString()}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    Total Users
                  </Typography>
                </Box>
                <PeopleIcon sx={{ fontSize: 40, opacity: 0.8 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ 
            height: '100%', 
            background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            color: 'white'
          }}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                    {stats.totalTenants}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    Total Tenants
                  </Typography>
                </Box>
                <BusinessIcon sx={{ fontSize: 40, opacity: 0.8 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ 
            height: '100%', 
            background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
            color: 'white'
          }}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                    {stats.activeTenants}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    Active Tenants
                  </Typography>
                </Box>
                <TrendingIcon sx={{ fontSize: 40, opacity: 0.8 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ 
            height: '100%', 
            background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
            color: 'white'
          }}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                    {stats.systemHealth}%
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    System Health
                  </Typography>
                </Box>
                {getHealthIcon(stats.systemHealth)}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Database Structure Info */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardHeader
              title="Database Structure"
              subheader="Multi-tenant architecture overview"
              avatar={<DatabaseIcon color="primary" />}
            />
            <CardContent>
              <Typography variant="body2" color="text.secondary" paragraph>
                Your system uses a sophisticated multi-tenant database architecture:
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemIcon><DatabaseIcon color="primary" /></ListItemIcon>
                  <ListItemText 
                    primary="rapidrepo (Main Database)"
                    secondary="Global users, tenants list, and system data"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon><BusinessIcon color="secondary" /></ListItemIcon>
                  <ListItemText 
                    primary="tenants_db (Tenant Group)"
                    secondary="Logical grouping for all tenant-specific databases"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon><PeopleIcon color="info" /></ListItemIcon>
                  <ListItemText 
                    primary="Individual Tenant Databases"
                    secondary="Separate databases for each tenant with collections: users, logs, vehicle, two_vehicle, four_vehicle, cv_vehicle"
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardHeader
              title="Recent Tenants"
              subheader="Latest tenant registrations"
              avatar={<BusinessIcon color="primary" />}
              action={
                <Button
                  size="small"
                  onClick={() => navigate('/admin/tenants')}
                  startIcon={<ViewIcon />}
                >
                  View All
                </Button>
              }
            />
            <CardContent>
              {recentTenants.length > 0 ? (
                <List dense>
                  {recentTenants.map((tenant, index) => (
                    <React.Fragment key={tenant._id}>
                      <ListItem>
                        <ListItemIcon>
                          <BusinessIcon color="primary" />
                        </ListItemIcon>
                        <ListItemText
                          primary={tenant.name}
                          secondary={
                            <Box>
                              <Chip 
                                label={tenant.type} 
                                size="small" 
                                color="primary" 
                                variant="outlined"
                                sx={{ mr: 1 }}
                              />
                              <Chip 
                                label={tenant.subscription?.plan || 'basic'} 
                                size="small" 
                                color="secondary" 
                                variant="outlined"
                              />
                            </Box>
                          }
                        />
                      </ListItem>
                      {index < recentTenants.length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </List>
              ) : (
                <Typography variant="body2" color="text.secondary" align="center">
                  No tenants found. Create your first tenant to get started!
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Quick Stats */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardHeader
              title="Platform Status"
              avatar={<HealthIcon color="success" />}
            />
            <CardContent>
              <Typography variant="h6" color="success.main" gutterBottom>
                All Systems Operational
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Database connections, API endpoints, and services are running smoothly.
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardHeader
              title="Recent Activity"
              avatar={<TrendingIcon color="info" />}
            />
            <CardContent>
              <Typography variant="h6" color="info.main" gutterBottom>
                {recentTenants.length} New Tenants
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {recentTenants.length > 0 
                  ? `Latest: ${recentTenants[0]?.name}`
                  : 'No recent activity'
                }
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardHeader
              title="Next Steps"
              avatar={<SettingsIcon color="warning" />}
            />
            <CardContent>
              <Typography variant="h6" color="warning.main" gutterBottom>
                System Optimization
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Consider setting up automated backups and monitoring alerts.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default AdminDashboard;
