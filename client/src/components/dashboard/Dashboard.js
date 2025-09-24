import React from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardHeader
} from '@mui/material';
import { useAuth } from '../../contexts/AuthContext';

const Dashboard = () => {
  const { user } = useAuth();

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Welcome, {user?.firstName}!
      </Typography>
      
      <Grid container spacing={3}>
        <Grid item xs={12} md={6} lg={3}>
          <Card>
            <CardHeader title="Total Users" />
            <CardContent>
              <Typography variant="h3">150</Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={6} lg={3}>
          <Card>
            <CardHeader title="Active Tenants" />
            <CardContent>
              <Typography variant="h3">25</Typography>
            </CardContent>
          </Card>
        </Grid>

        
        
        <Grid item xs={12} md={6} lg={3}>
          <Card>
            <CardHeader title="Total Revenue" />
            <CardContent>
              <Typography variant="h3">$15,000</Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={6} lg={3}>
          <Card>
            <CardHeader title="Growth Rate" />
            <CardContent>
              <Typography variant="h3">+12%</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
