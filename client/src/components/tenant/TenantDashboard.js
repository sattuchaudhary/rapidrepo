import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  IconButton,
  Button,
  Chip,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Visibility as ViewIcon,
  Schedule as ClockIcon,
  Pause as PauseIcon,
  KeyboardArrowDown as DownIcon,
  KeyboardArrowUp as UpIcon,
  DirectionsCar as CarIcon,
  TwoWheeler as BikeIcon,
  LocalShipping as TruckIcon,
  People as PeopleIcon,
  LocationOn as LocationIcon,
  PieChart as PieChartIcon,
  BarChart as BarChartIcon
} from '@mui/icons-material';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';

const TenantDashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [stats, setStats] = useState({
    totalRecords: 0,
    onHold: 0,
    inYard: 0,
    released: 0,
    totalVehicles: 0,
    twoWheeler: 0,
    fourWheeler: 0,
    cvData: 0,
    associatedBanks: [],
    userStats: {
      officeStaff: 0,
      repoAgents: 0
    }
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      // TODO: Replace with actual API calls when backend is ready
      // For now, using dummy data based on the image
      setStats({
        totalRecords: 1250,
        onHold: 89,
        inYard: 156,
        released: 1005,
        totalVehicles: 892,
        twoWheeler: 234,
        fourWheeler: 456,
        cvData: 202,
        associatedBanks: [
          { name: 'MAS FINANCIAL SERVICES', count: 3095 }
        ],
        userStats: {
          officeStaff: 4,
          repoAgents: 53
        }
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'totalRecords': return 'orange';
      case 'onHold': return 'green';
      case 'inYard': return 'red';
      case 'released': return 'blue';
      default: return 'primary';
    }
  };

  const getVehicleColor = (type) => {
    switch (type) {
      case 'totalData': return 'blue';
      case 'twoWheeler': return 'orange';
      case 'fourWheeler': return 'green';
      case 'cvData': return 'red';
      default: return 'primary';
    }
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
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', color: 'primary.main' }}>
          <DashboardIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Dashboard
        </Typography>
        <Typography variant="subtitle1" color="text.secondary" gutterBottom>
          Welcome back, <strong>{user?.firstName} {user?.lastName}</strong>! Here's your tenant overview.
        </Typography>
      </Box>

      {/* Overview Cards - Top Row */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ 
            height: '100%', 
            background: 'linear-gradient(135deg, #fff 0%, #f8f9fa 100%)',
            border: '1px solid #e0e0e0'
          }}>
            <CardContent sx={{ textAlign: 'center', p: 3 }}>
              <Box sx={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                width: 60,
                height: 60,
                borderRadius: '50%',
                bgcolor: 'orange.main',
                mb: 2
              }}>
                <ClockIcon sx={{ color: 'white', fontSize: 30 }} />
              </Box>
              <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', color: 'text.primary' }}>
                {stats.totalRecords.toLocaleString()}
              </Typography>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                Total Records
              </Typography>
              <IconButton size="small" color="primary">
                <ViewIcon />
              </IconButton>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ 
            height: '100%', 
            background: 'linear-gradient(135deg, #fff 0%,rgb(163, 202, 147) 100%)',
            border: '1px solid #e0e0e0'
          }}>
            <CardContent sx={{ textAlign: 'center', p: 3 }}>
              <Box sx={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                width: 60,
                height: 60,
                borderRadius: '50%',
                bgcolor: 'green.main',
                mb: 2
              }}>
                <PauseIcon sx={{ color: 'white', fontSize: 30 }} />
              </Box>
              <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', color: 'text.primary' }}>
                {stats.onHold.toLocaleString()}
              </Typography>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                On Hold
              </Typography>
              <IconButton size="small" color="primary">
                <ViewIcon />
              </IconButton>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ 
            height: '100%', 
            background: 'linear-gradient(135deg, #fff 0%, #f8f9fa 100%)',
            border: '1px solid #e0e0e0'
          }}>
            <CardContent sx={{ textAlign: 'center', p: 3 }}>
              <Box sx={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                width: 60,
                height: 60,
                borderRadius: '50%',
                bgcolor: 'red.main',
                mb: 2
              }}>
                <DownIcon sx={{ color: 'white', fontSize: 30 }} />
              </Box>
              <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', color: 'text.primary' }}>
                {stats.inYard.toLocaleString()}
              </Typography>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                In Yard
              </Typography>
              <IconButton size="small" color="primary">
                <ViewIcon />
              </IconButton>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ 
            height: '100%', 
            background: 'linear-gradient(135deg, #fff 0%, #f8f9fa 100%)',
            border: '1px solid #e0e0e0'
          }}>
            <CardContent sx={{ textAlign: 'center', p: 3 }}>
              <Box sx={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                width: 60,
                height: 60,
                borderRadius: '50%',
                bgcolor: 'blue.main',
                mb: 2
              }}>
                <UpIcon sx={{ color: 'white', fontSize: 30 }} />
              </Box>
              <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', color: 'text.primary' }}>
                {stats.released.toLocaleString()}
              </Typography>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                Released
              </Typography>
              <IconButton size="small" color="primary">
                <ViewIcon />
              </IconButton>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Personal Vehicle Data Section */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', mb: 3 }}>
          Personal Vehicle Data
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ 
              background: 'linear-gradient(135deg, #fff 0%, #f8f9fa 100%)',
              border: '1px solid #e0e0e0'
            }}>
              <CardContent sx={{ textAlign: 'center', p: 3 }}>
                <Box sx={{ 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  width: 50,
                  height: 50,
                  borderRadius: '50%',
                  bgcolor: 'blue.main',
                  mb: 2
                }}>
                  <CarIcon sx={{ color: 'white', fontSize: 25 }} />
                </Box>
                <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold' }}>
                  {stats.totalVehicles.toLocaleString()}
                </Typography>
                <Typography variant="body1" color="text.secondary" gutterBottom>
                  Total Data
                </Typography>
                <IconButton size="small" color="primary">
                  <ViewIcon />
                </IconButton>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ 
              background: 'linear-gradient(135deg, #fff 0%, #f8f9fa 100%)',
              border: '1px solid #e0e0e0'
            }}>
              <CardContent sx={{ textAlign: 'center', p: 3 }}>
                <Box sx={{ 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  width: 50,
                  height: 50,
                  borderRadius: '50%',
                  bgcolor: 'orange.main',
                  mb: 2
                }}>
                  <BikeIcon sx={{ color: 'white', fontSize: 25 }} />
                </Box>
                <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold' }}>
                  {stats.twoWheeler.toLocaleString()}
                </Typography>
                <Typography variant="body1" color="text.secondary" gutterBottom>
                  Two Wheeler
                </Typography>
                <IconButton size="small" color="primary">
                  <ViewIcon />
                </IconButton>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ 
              background: 'linear-gradient(135deg, #fff 0%, #f8f9fa 100%)',
              border: '1px solid #e0e0e0'
            }}>
              <CardContent sx={{ textAlign: 'center', p: 3 }}>
                <Box sx={{ 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  width: 50,
                  height: 50,
                  borderRadius: '50%',
                  bgcolor: 'green.main',
                  mb: 2
                }}>
                  <CarIcon sx={{ color: 'white', fontSize: 25 }} />
                </Box>
                <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold' }}>
                  {stats.fourWheeler.toLocaleString()}
                </Typography>
                <Typography variant="body1" color="text.secondary" gutterBottom>
                  Four Wheeler
                </Typography>
                <IconButton size="small" color="primary">
                  <ViewIcon />
                </IconButton>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ 
              background: 'linear-gradient(135deg, #fff 0%, #f8f9fa 100%)',
              border: '1px solid #e0e0e0'
            }}>
              <CardContent sx={{ textAlign: 'center', p: 3 }}>
                <Box sx={{ 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  width: 50,
                  height: 50,
                  borderRadius: '50%',
                  bgcolor: 'red.main',
                  mb: 2
                }}>
                  <TruckIcon sx={{ color: 'white', fontSize: 25 }} />
                </Box>
                <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold' }}>
                  {stats.cvData.toLocaleString()}
                </Typography>
                <Typography variant="body1" color="text.secondary" gutterBottom>
                  CV Data
                </Typography>
                <IconButton size="small" color="primary">
                  <ViewIcon />
                </IconButton>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>

      {/* Main Content and Right Sidebar */}
      <Grid container spacing={4}>
        {/* Left Column - Associated Banks */}
        <Grid item xs={12} md={8}>
          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', mb: 3 }}>
              Associated Banks
            </Typography>
            <Grid container spacing={3}>
              {stats.associatedBanks.map((bank, index) => (
                <Grid item xs={12} sm={6} key={index}>
                  <Card sx={{ 
                    background: 'linear-gradient(135deg, #fff 0%, #f8f9fa 100%)',
                    border: '1px solid #e0e0e0',
                    height: '100%'
                  }}>
                    <CardContent sx={{ p: 3 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <Box sx={{ 
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          width: 40,
                          height: 40,
                          borderRadius: '50%',
                          bgcolor: 'grey.400',
                          mr: 2
                        }}>
                          <PeopleIcon sx={{ color: 'white', fontSize: 20 }} />
                        </Box>
                        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                          {bank.name}
                        </Typography>
                      </Box>
                      <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                        {bank.count.toLocaleString()}
                      </Typography>
                      <Button
                        variant="contained"
                        startIcon={<LocationIcon />}
                        sx={{ 
                          mt: 2,
                          bgcolor: 'grey.700',
                          '&:hover': { bgcolor: 'grey.800' }
                        }}
                      >
                        Track Location
                      </Button>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        </Grid>

        {/* Right Column - Statistics */}
        <Grid item xs={12} md={4}>
          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', mb: 3 }}>
              Vehicle Search Statistics
            </Typography>
            <Card sx={{ 
              background: 'linear-gradient(135deg, #fff 0%, #f8f9fa 100%)',
              border: '1px solid #e0e0e0'
            }}>
              <CardContent sx={{ textAlign: 'center', p: 3 }}>
                <Box sx={{ 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  width: 120,

                  height: 120,
                  borderRadius: '50%',
                  bgcolor: 'grey.100',
                  mb: 2,
                  border: '4px solid #e0e0e0'
                }}>
                  <PieChartIcon sx={{ color: 'grey.600', fontSize: 50 }} />
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Data visualization coming soon
                </Typography>
              </CardContent>
            </Card>
          </Box>

          <Box>
            <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', mb: 3 }}>
              Total Users
            </Typography>
            <Card sx={{ 
              background: 'linear-gradient(135deg, #fff 0%, #f8f9fa 100%)',
              border: '1px solid #e0e0e0'
            }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ mb: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="body1" color="text.secondary">
                      Office Staff
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                      {stats.userStats.officeStaff}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body1" color="text.secondary">
                      Repo Agents
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                      {stats.userStats.repoAgents}
                    </Typography>
                  </Box>
                </Box>
                <Button
                  variant="outlined"
                  startIcon={<BarChartIcon />}
                  fullWidth
                  sx={{ mt: 2 }}
                >
                  View Details
                </Button>
              </CardContent>
            </Card>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

export default TenantDashboard;
