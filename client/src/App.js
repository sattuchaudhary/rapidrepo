import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';

import { useAuth } from './contexts/AuthContext';
import LandingPage from './components/LandingPage';
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import Dashboard from './components/dashboard/Dashboard';
import AdminDashboard from './components/admin/AdminDashboard';
import UserManagement from './components/admin/UserManagement';
import TenantManagement from './components/admin/TenantManagement';
import VersionManagement from './components/admin/VersionManagement';
import Settings from './components/Settings';
import TenantAdminPanel from './components/tenant/TenantAdminPanel';
import Profile from './components/profile/Profile';
import Layout from './components/layout/Layout';
import ProtectedRoute from './components/auth/ProtectedRoute';

function App() {
  const { loading, isAuthenticated, user } = useAuth();

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Routes>
      {/* Landing page - always accessible */}
      <Route path="/" element={<LandingPage />} />
      
      {/* Public routes */}
      <Route
        path="/login"
        element={
          isAuthenticated ? (
            <Navigate to={user?.role === 'super_admin' ? '/app/admin' : user?.role === 'admin' ? '/app/tenant' : '/app/dashboard'} replace />
          ) : (
            <Login />
          )
        }
      />
      <Route
        path="/sattu/chaudhary/192"
        element={
          isAuthenticated ? (
            <Navigate to={user?.role === 'super_admin' ? '/app/admin' : user?.role === 'admin' ? '/app/tenant' : '/app/dashboard'} replace />
          ) : (
            <Register />
          )
        }
      />

      {/* Protected routes */}
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        {/* User dashboard */}
        <Route
          path="dashboard"
          element={
            user?.role === 'super_admin' ? (
              <Navigate to="/app/admin" replace />
            ) : user?.role === 'admin' ? (
              <Navigate to="/app/tenant" replace />
            ) : (
              <Dashboard />
            )
          }
        />

        {/* Admin routes */}
        <Route
          path="admin"
          element={
            user?.role === 'super_admin' ? (
              <AdminDashboard />
            ) : (
              <Navigate to="/app/dashboard" replace />
            )
          }
        />
        <Route
          path="admin/users"
          element={
            user?.role === 'super_admin' ? (
              <UserManagement />
            ) : (
              <Navigate to="/app/dashboard" replace />
            )
          }
        />
        <Route
          path="admin/tenants"
          element={
            user?.role === 'super_admin' ? (
              <TenantManagement />
            ) : (
              <Navigate to="/app/dashboard" replace />
            )
          }
        />
        <Route
          path="admin/version"
          element={
            user?.role === 'super_admin' ? (
              <VersionManagement />
            ) : (
              <Navigate to="/app/dashboard" replace />
            )
          }
        />
        <Route
          path="admin/settings"
          element={
            user?.role === 'super_admin' ? (
              <Settings />
            ) : (
              <Navigate to="/app/dashboard" replace />
            )
          }
        />

        {/* Tenant routes */}
        <Route
          path="tenant"
          element={
            user?.role === 'admin' ? (
              <TenantAdminPanel />
            ) : (
              <Navigate to="/app/dashboard" replace />
            )
          }
        />
        <Route
          path="tenant/*"
          element={
            user?.role === 'admin' ? (
              <TenantAdminPanel />
            ) : (
              <Navigate to="/app/dashboard" replace />
            )
          }
        />

        {/* Settings */}
        <Route path="settings" element={<Settings />} />

        {/* Profile */}
        <Route path="profile" element={<Profile />} />

        {/* Default redirect */}
        <Route
          index
          element={
            <Navigate
              to={user?.role === 'super_admin' ? '/app/admin' : user?.role === 'admin' ? '/app/tenant' : '/app/dashboard'}
              replace
            />
          }
        />
      </Route>

      {/* Catch all route */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
