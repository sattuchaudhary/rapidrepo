import React from 'react';
import { Box, Typography, Paper } from '@mui/material';

const AgentDashboard = () => {
  return (
    <Box>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>
          Repo Agent Dashboard
        </Typography>
        <Typography color="text.secondary">
          Welcome! Here you will see agent-specific actions and data.
        </Typography>
      </Paper>
    </Box>
  );
};

export default AgentDashboard;



