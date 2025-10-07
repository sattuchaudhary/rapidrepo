import React, { useState, useEffect } from 'react';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Avatar,
  Menu,
  MenuItem,
  Divider,
  Button,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Collapse,
  Card,
  CardContent,
  Grid,
  Chip,
  CheckCircle,
  Alert,
  CircularProgress,
  TextField,
  InputAdornment
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  Folder as FileIcon,
  Smartphone as MobileIcon,
  Share as ShareIcon,
  DirectionsBus as BusIcon,
  Notifications as NotificationIcon,
  BarChart as BarChartIcon,
  PieChart as PieChartIcon,
  Send as SendIcon,
  Assessment as ReportIcon,
  Settings as SettingsIcon,
  ExpandLess,
  ExpandMore,
  Visibility as ViewIcon,
  Wifi as WifiIcon,
  Phone as PhoneIcon,
  DirectionsCar as CarIcon,
  TwoWheeler as MotorcycleIcon,
  LocalShipping as TruckIcon,
  Search as SearchIcon
} from '@mui/icons-material';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import ClientManagement from './ClientManagement';
import OfficeStaffList from './OfficeStaffList';
import RepoAgentList from './RepoAgentList';
import UserDetailView from './UserDetailView';
import PendingApprovals from './PendingApprovals';
import MobileUpload from './MobileUpload';
import { useNavigate, useLocation } from 'react-router-dom';
import TwoWheelerData from './files/TwoWheelerData';
import FourWheelerData from './files/FourWheelerData';
import CVData from './files/CVData';
import VehicleDataDetails from './files/VehicleDataDetails';
import UserStatistics from './UserStatistics';
import Notifications from './Notifications';
import SearchResults from './SearchResults';
import TenantProfile from './TenantProfile';
import TenantSettings from './TenantSettings';
import PaymentSettings from './PaymentSettings';
import PaymentApprovals from './PaymentApprovals';
import SubscriptionsList from './SubscriptionsList';
import ModernDashboard from './ModernDashboard';

const TenantAdminPanel = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, user } = useAuth();
  const [headerSearch, setHeaderSearch] = useState('');

  // Normalize and validate registration number input
  const sanitizeRegInput = (value) => {
    const noSpaces = String(value || '').replace(/\s+/g, '');
    const alnum = noSpaces.replace(/[^a-zA-Z0-9]/g, '');
    return alnum.toUpperCase();
  };

  const isValidRegQuery = (value) => {
    const q = sanitizeRegInput(value);
    // Allow either exactly 4 digits (suffix search) or a full registration number format
    const isFourDigits = /^\d{4}$/.test(q);
    // Broad but reasonable India registration pattern without spaces/dashes
    const fullReg = /^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{4}$/; 
    const isFullReg = fullReg.test(q);
    return isFourDigits || isFullReg;
  };
  const [open, setOpen] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState({
    userManagement: true,
    fileManagement: false,
    dataSharing: false,
    settings: false
  });
  const [anchorEl, setAnchorEl] = useState(null);

  const handleProfileMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    try {
      handleProfileMenuClose();
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
      navigate('/login');
    }
  };

  const drawerWidth = 280;

  const menuItems = [
    {
      text: 'Dashboard',
      icon: <DashboardIcon />,
      path: '/app/tenant',
      active: location.pathname === '/app/tenant'
    },
    {
      text: 'Client Management',
      icon: <PeopleIcon />,
      path: '/app/tenant/clients',
      active: location.pathname === '/app/tenant/clients'
    },
    {
      text: 'User Management',
      icon: <PeopleIcon />,
      path: '/app/tenant/users',
      expandable: true,
      subItems: [
        { text: 'Office Staff List', path: '/app/tenant/users/staff' },
        { text: 'Repo Agent List', path: '/app/tenant/users/agents' },
        { text: 'Pending Approvals', path: '/app/tenant/users/pending' }
      ]
    },
    {
      text: 'File Management',
      icon: <FileIcon />,
      path: '/app/tenant/files',
      expandable: true,
      subItems: [
        { text: 'Two Wheeler Data', path: '/app/tenant/files/two-wheeler' },
        { text: 'Four Wheeler Data', path: '/app/tenant/files/four-wheeler' },
        { text: 'CV Data', path: '/app/tenant/files/cv' }
      ]
    },
    {
      text: 'Mobile Upload',
      icon: <MobileIcon />,
      path: '/app/tenant/mobile-upload'
    },
    {
      text: 'Data Sharing',
      icon: <ShareIcon />,
      path: '/app/tenant/data-sharing',
      expandable: true
    },
    {
      text: 'Bank Vehicle Data',
      icon: <BusIcon />,
      path: '/app/tenant/bank-vehicles'
    },
    {
      text: 'Notification',
      icon: <NotificationIcon />,
      path: '/app/tenant/notifications'
    },
    {
      text: 'User Statistics',
      icon: <BarChartIcon />,
      path: '/app/tenant/user-stats'
    },
    {
      text: 'Data Analytics',
      icon: <PieChartIcon />,
      path: '/app/tenant/analytics'
    },
    {
      text: 'Send Message',
      icon: <SendIcon />,
      path: '/app/tenant/messages'
    },
    {
      text: 'Reports',
      icon: <ReportIcon />,
      path: '/app/tenant/reports'
    },
    {
      text: 'Settings',
      icon: <SettingsIcon />,
      path: '/app/tenant/settings',
      active: location.pathname === '/app/tenant/settings'
    },
    {
      text: 'Payment Settings',
      icon: <SettingsIcon />,
      path: '/app/tenant/payment-settings',
      active: location.pathname === '/app/tenant/payment-settings'
    },
    {
      text: 'Payment Approvals',
      icon: <SettingsIcon />,
      path: '/app/tenant/payment-approvals',
      active: location.pathname === '/app/tenant/payment-approvals'
    },
    {
      text: 'User Subscriptions',
      icon: <SettingsIcon />,
      path: '/app/tenant/subscriptions',
      active: location.pathname === '/app/tenant/subscriptions'
    },
    {
      text: 'Profile',
      icon: <SettingsIcon />,
      path: '/app/tenant/profile'
    }
  ];

  // Live dashboard state
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
    userStats: { officeStaff: 0, repoAgents: 0 }
  });

  useEffect(() => {
    // Only fetch when we're on the dashboard route
    if (location.pathname === '/app/tenant') {
      const fetchStats = async () => {
        try {
          setLoading(true);
          setError('');
          const token = localStorage.getItem('token');
          if (!token) throw new Error('No authentication token found');
          const res = await axios.get('/api/tenant/data/dashboard-stats', {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res.data?.success) {
            setStats(res.data.data || {});
          } else {
            throw new Error(res.data?.message || 'Failed to load dashboard');
          }
        } catch (e) {
          setError(e.response?.data?.message || e.message || 'Failed to load dashboard');
        } finally {
          setLoading(false);
        }
      };
      fetchStats();
    }
  }, [location.pathname]);

  const cardColors = {
    totalRecords: { bg: '#ff6b35', icon: '#ff8a65' },
    onHold: { bg: '#ff9800', icon: '#ffb74d' },
    inYard: { bg: '#2196f3', icon: '#64b5f6' },
    released: { bg: '#4caf50', icon: '#81c784' }
  };

  const handleMenuClick = (path) => {
    navigate(path);
  };

  const toggleMenu = (menuKey) => {
    setExpandedMenus(prev => ({
      ...prev,
      [menuKey]: !prev[menuKey]
    }));
  };

  return (
    <Box sx={{ display: 'flex' }}>
      {/* Top AppBar */}
      <AppBar 
        position="fixed" 
        sx={{ 
          zIndex: (theme) => theme.zIndex.drawer + 1,
          bgcolor: '#424242',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
        }}
      >
        <Toolbar sx={{ justifyContent: 'space-between' }}>
          {/* Left Section - Logo and Menu */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <IconButton
              color="inherit"
              onClick={() => setOpen(!open)}
              edge="start"
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              RapidRepo
            </Typography>
          </Box>

          {/* Center Section - Search and Notifications */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, justifyContent: 'flex-end' }}>
            <Box sx={{ minWidth: 320, maxWidth: 420, width: '100%' }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Registration only: enter last 4 digits or full number"
                value={headerSearch}
                onChange={(e) => setHeaderSearch(sanitizeRegInput(e.target.value))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const q = sanitizeRegInput(headerSearch);
                    if (isValidRegQuery(q)) navigate(`/app/tenant/search?q=${encodeURIComponent(q)}`);
                  }
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: 'grey.500' }} />
                    </InputAdornment>
                  ),
                  sx: {
                    bgcolor: 'white',
                    borderRadius: 1
                  }
                }}
              />
            </Box>
            <Typography variant="body2" sx={{ color: 'white' }}>
              hello, {user?.email || 'user@example.com'}
            </Typography>
            <IconButton sx={{ color: '#4CAF50' }}>
              <WifiIcon />
            </IconButton>
            <IconButton sx={{ color: 'white' }}>
              <PhoneIcon />
            </IconButton>
            <IconButton
              onClick={handleProfileMenuOpen}
              sx={{ p: 0 }}
            >
              <Avatar sx={{ width: 35, height: 35, bgcolor: 'primary.main' }}>
                <Typography variant="caption" sx={{ fontSize: '12px', color: 'white', fontWeight: 'bold' }}>
                  {user?.firstName ? user.firstName.charAt(0).toUpperCase() : 'U'}
                </Typography>
              </Avatar>
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>

      {/* User Profile Dropdown Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleProfileMenuClose}
        PaperProps={{
          sx: {
            mt: 1,
            minWidth: 280,
            borderRadius: 2,
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)'
          }
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        {/* Profile Header */}
        <Box sx={{ p: 3, borderBottom: '1px solid #f0f0f0' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Avatar sx={{ width: 50, height: 50, bgcolor: 'primary.main', mr: 2 }}>
              <Typography variant="h6" sx={{ color: 'white', fontWeight: 'bold' }}>
                {user?.firstName ? user.firstName.charAt(0).toUpperCase() : 'U'}
              </Typography>
            </Avatar>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
                Hello {user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : 'User'}!
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {user?.email || 'No email available'}
              </Typography>
            </Box>
          </Box>
          <Button
            variant="contained"
            size="small"
            sx={{
              bgcolor: '#424242',
              '&:hover': { bgcolor: '#616161' },
              textTransform: 'none',
              borderRadius: 1
            }}
          >
            View Profile
          </Button>
        </Box>

        {/* Menu Items */}
        <Box sx={{ py: 1 }}>
          <MenuItem onClick={handleProfileMenuClose} sx={{ py: 1.5, px: 3 }}>
            <Typography variant="body2">My Profile</Typography>
          </MenuItem>
          <Divider />
          <MenuItem onClick={handleProfileMenuClose} sx={{ py: 1.5, px: 3 }}>
            <Typography variant="body2">Privacy Policy</Typography>
          </MenuItem>
          <Divider />
          <MenuItem onClick={handleProfileMenuClose} sx={{ py: 1.5, px: 3 }}>
            <Typography variant="body2">Help</Typography>
          </MenuItem>
          <Divider />
          <MenuItem onClick={handleProfileMenuClose} sx={{ py: 1.5, px: 3 }}>
            <Typography variant="body2">Payment history</Typography>
          </MenuItem>
          <Divider />
          <MenuItem 
            onClick={handleLogout}
            sx={{ py: 1.5, px: 3 }}
          >
            <Typography variant="body2" sx={{ color: 'error.main' }}>Log off</Typography>
          </MenuItem>
        </Box>
      </Menu>

      {/* Left Sidebar */}
      <Drawer
        variant="permanent"
        sx={{
          
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            bgcolor: '#f5f5f5',
            borderRight: '1px solid #e0e0e0'
          }
        }}
      >
        <Toolbar />
        <Box sx={{ overflow: 'auto', mt: 2 }}>
          <List>
            {menuItems.map((item, index) => (
              <Box key={index}>
                <ListItem disablePadding>
                  <ListItemButton
                    onClick={() => {
                      if (item.expandable) {
                        toggleMenu(item.text.toLowerCase().replace(/\s+/g, ''));
                      } else {
                        handleMenuClick(item.path);
                      }
                    }}
                    sx={{
                      bgcolor: item.active ? 'rgba(66, 66, 66, 0.1)' : 'transparent',
                      '&:hover': {
                        bgcolor: 'rgba(66, 66, 66, 0.05)'
                      },
                      borderRadius: 1,
                      mx: 1,
                      mb: 0.5
                    }}
                  >
                    <ListItemIcon sx={{ color: item.active ? 'primary.main' : 'text.secondary' }}>
                      {item.icon}
                    </ListItemIcon>
                    <ListItemText 
                      primary={item.text} 
                      sx={{ 
                        color: item.active ? 'primary.main' : 'text.primary',
                        fontWeight: item.active ? 'bold' : 'normal'
                      }}
                    />
                    {item.expandable && (
                      expandedMenus[item.text.toLowerCase().replace(/\s+/g, '')] ? 
                        <ExpandLess /> : <ExpandMore />
                    )}
                  </ListItemButton>
                </ListItem>

                {/* Submenu Items */}
                {item.expandable && expandedMenus[item.text.toLowerCase().replace(/\s+/g, '')] && (
                  <Collapse in={expandedMenus[item.text.toLowerCase().replace(/\s+/g, '')]} timeout="auto" unmountOnExit>
                    <List component="div" disablePadding>
                      {item.subItems?.map((subItem, subIndex) => (
                        <ListItemButton
                          key={subIndex}
                          onClick={() => handleMenuClick(subItem.path)}
                          sx={{
                            pl: 4,
                            bgcolor: location.pathname === subItem.path ? 'rgba(66, 66, 66, 0.1)' : 'transparent',
                            '&:hover': {
                              bgcolor: 'rgba(66, 66, 66, 0.05)'
                            },
                            borderRadius: 1,
                            mx: 1,
                            mb: 0.5
                          }}
                        >
                          <ListItemText 
                            primary={subItem.text} 
                            sx={{ 
                              color: location.pathname === subItem.path ? 'primary.main' : 'text.primary',
                              fontWeight: location.pathname === subItem.path ? 'bold' : 'normal'
                            }}
                          />
                        </ListItemButton>
                      ))}
                    </List>
                  </Collapse>
                )}
              </Box>
            ))}
          </List>
        </Box>
      </Drawer>

      {/* Main Content Area */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          bgcolor: '#f7f7f7',
          minHeight: '100vh',
          
          
          
        }}
      >
        <Box sx={{ px: 1, py: 2 }}>
          <Box
            sx={{
              bgcolor: '#ffffff',
              borderRadius: 2,
              p: 2,
              border: '1px solid #e0e0e0',
              boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
              minHeight: 'calc(100vh - 120px)',
              width: '100%'
            }}
          >
          {/* Render different content based on current route */}
          {location.pathname === '/app/tenant' && (
            <>
              <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', mb: 2 }}>
                Dashboard
              </Typography>
              <ModernDashboard stats={stats} loading={loading} error={error} />
            </>
          )}

          {location.pathname === '/app/tenant/users/staff' && (
            <OfficeStaffList />
          )}

          {location.pathname === '/app/tenant/users/agents' && (
            <RepoAgentList />
          )}

          {/* Detail routes */}
          {location.pathname.startsWith('/app/tenant/users/staff/') && (
            <UserDetailView type="staff" />
          )}
          {location.pathname.startsWith('/app/tenant/users/agents/') && (
            <UserDetailView type="agent" />
          )}

          {location.pathname === '/app/tenant/users/pending' && (
            <PendingApprovals />
          )}

            {location.pathname === '/app/tenant/clients' && (
              <ClientManagement />
            )}
            {location.pathname === '/app/tenant/files/two-wheeler' && (
              <TwoWheelerData />
            )}
            {location.pathname === '/app/tenant/files/four-wheeler' && (
              <FourWheelerData />
            )}
            {location.pathname === '/app/tenant/files/cv' && (
              <CVData />
            )}
            {location.pathname === '/app/tenant/mobile-upload' && (
              <MobileUpload />
            )}
            {location.pathname.startsWith('/app/tenant/files/vehicle-data/') && (
              <VehicleDataDetails />
            )}
            {location.pathname === '/app/tenant/user-stats' && (
              <UserStatistics />
            )}
            {location.pathname === '/app/tenant/notifications' && (
              <Notifications />
            )}
          {location.pathname.startsWith('/app/tenant/search') && (
            <SearchResults />
          )}
          {location.pathname === '/app/tenant/profile' && (
            <TenantProfile />
          )}
          {location.pathname === '/app/tenant/settings' && (
            <TenantSettings />
          )}
          {location.pathname === '/app/tenant/payment-settings' && (
            <PaymentSettings />
          )}
          {location.pathname === '/app/tenant/payment-approvals' && (
            <PaymentApprovals />
          )}
          {location.pathname === '/app/tenant/subscriptions' && (
            <SubscriptionsList />
          )}
          
          {/* Fallback for unmatched routes */}
          {!location.pathname.startsWith('/app/tenant/') && location.pathname !== '/app/tenant' && (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="h5" color="error" gutterBottom>
                Route Not Found
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Current path: {location.pathname}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                Available routes: Dashboard, Settings, Profile, etc.
              </Typography>
            </Box>
          )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default TenantAdminPanel;
