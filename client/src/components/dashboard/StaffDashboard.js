import React from 'react';
import { Box, Typography, Paper } from '@mui/material';

const StaffDashboard = () => {
  return (
    <Box>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>
          Office Staff Dashboard
        </Typography>
        <Typography color="text.secondary">
          Welcome! Here you will see staff-specific actions and data.
        </Typography>
      </Paper>
    </Box>
  );
};

export default StaffDashboard;



