import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Avatar,
  Chip
} from '@mui/material';
import { useAuth } from '../../contexts/AuthContext';

const Profile = () => {
  const { user } = useAuth();

  const formatRole = (role) => {
    return role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Profile
      </Typography>
      <Typography variant="subtitle1" color="text.secondary" gutterBottom>
        Manage your account information.
      </Typography>
      
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <Avatar sx={{ width: 64, height: 64, mr: 3, bgcolor: 'secondary.main' }}>
              {user?.firstName?.charAt(0)?.toUpperCase()}
            </Avatar>
            <Box>
              <Typography variant="h5" gutterBottom>
                {user?.firstName} {user?.lastName}
              </Typography>
              <Typography color="text.secondary" gutterBottom>
                {user?.email}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Chip
                  label={formatRole(user?.role)}
                  color={user?.role === 'super_admin' ? 'error' : 'primary'}
                  size="small"
                />
                <Chip
                  label={user?.isActive ? 'Active' : 'Inactive'}
                  color={user?.isActive ? 'success' : 'default'}
                  size="small"
                />
              </Box>
            </Box>
          </Box>
          
          <Typography variant="h6" gutterBottom>
            Profile Management Coming Soon
          </Typography>
          <Typography color="text.secondary">
            This feature will allow you to update your profile information, change password, and manage account settings.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default Profile;
