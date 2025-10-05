import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  LinearProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Tooltip,
  Stepper,
  Step,
  StepLabel,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Avatar,
  Badge,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Fade,
  Slide,
  Zoom
} from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';
import {
  CloudUpload as UploadIcon,
  FileDownload as DownloadIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Refresh as RefreshIcon,
  GetApp as DownloadTemplateIcon,
  Assessment as AnalyticsIcon,
  History as HistoryIcon,
  Settings as SettingsIcon,
  ExpandMore as ExpandMoreIcon,
  TwoWheeler as TwoWheelerIcon,
  DirectionsCar as FourWheelerIcon,
  LocalShipping as CommercialIcon,
  Business as BankIcon,
  Description as FileIcon,
  Timeline as ProgressIcon,
  DragIndicator as DragIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import SaveIcon from '@mui/icons-material/Save';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';
import { toast } from 'react-toastify';

const ModernMobileUpload = () => {
  const { user } = useAuth();
  const [activeStep, setActiveStep] = useState(0);
  const [vehicleType, setVehicleType] = useState('');
  const [selectedBank, setSelectedBank] = useState('');
  const [banks, setBanks] = useState([]);
  const [file, setFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [previewData, setPreviewData] = useState([]);
  const [uploadHistory, setUploadHistory] = useState([]);
  const [errors, setErrors] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [successCount, setSuccessCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const [headers, setHeaders] = useState([]);
  const [headerMapping, setHeaderMapping] = useState({});
  const [loadingMapping, setLoadingMapping] = useState(false);
  const [rawRows, setRawRows] = useState([]);
  const [columnMapping, setColumnMapping] = useState({});
  const [isLoadingBanks, setIsLoadingBanks] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isLoadingUpload, setIsLoadingUpload] = useState(false);
  const [currentAction, setCurrentAction] = useState('');
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [passwordValue, setPasswordValue] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [pendingAction, setPendingAction] = useState('');

  const standardFields = [
    'reg_Number','cust_Name','location','bankName','Loan_No','Make','engineNumber','chassisNumber','emiAmount','pos','bkts','address','branchName','1st_Name','1st_Phone','2nd_Name','2nd_Phone','3rd_Name','3rd_Phone','zone','areaOffice','region','allocation','Model','productName'
  ];

  const steps = [
    'Select Vehicle Type & Bank',
    'Upload & Map Headers',
    'Review & Confirm',
    'Upload Complete'
  ];

  const vehicleTypes = [
    { value: 'TwoWheeler', label: 'Two Wheeler', icon: <TwoWheelerIcon />, color: '#f59e0b' },
    { value: 'FourWheeler', label: 'Four Wheeler', icon: <FourWheelerIcon />, color: '#10b981' },
    { value: 'Commercial', label: 'Commercial Vehicle', icon: <CommercialIcon />, color: '#ef4444' }
  ];

  const getVehicleTypeConfig = (type) => {
    return vehicleTypes.find(vt => vt.value === type) || vehicleTypes[0];
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Completed': return 'success';
      case 'Failed': return 'error';
      case 'Processing': return 'warning';
      default: return 'default';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Completed': return <SuccessIcon />;
      case 'Failed': return <ErrorIcon />;
      case 'Processing': return <RefreshIcon />;
      default: return <InfoIcon />;
    }
  };

  return (
    <Box sx={{ 
      p: 3, 
      bgcolor: '#f8fafc', 
      minHeight: '100vh',
      position: 'relative'
    }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ 
          fontWeight: 700, 
          color: '#1e293b',
          mb: 1,
          letterSpacing: '-0.025em'
        }}>
          Mobile Data Upload
        </Typography>
        <Typography variant="body1" sx={{ 
          color: '#64748b',
          fontSize: '1.1rem'
        }}>
          Upload and manage vehicle data with intelligent mapping
        </Typography>
      </Box>

      {/* Main Content */}
      <Grid container spacing={4}>
        {/* Left Side - Upload Form */}
        <Grid item xs={12} lg={8}>
          <Card sx={{ 
            borderRadius: 4,
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
            border: '1px solid #e2e8f0',
            overflow: 'hidden'
          }}>
            {/* Card Header */}
            <Box sx={{
              background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)',
              p: 3,
              color: 'white'
            }}>
              <Typography variant="h6" sx={{ 
                fontWeight: 600,
                textShadow: '0 1px 2px rgba(0,0,0,0.3)'
              }}>
                Upload Process
              </Typography>
              <Typography variant="body2" sx={{ 
                opacity: 0.9,
                textShadow: '0 1px 2px rgba(0,0,0,0.3)'
              }}>
                Follow the steps to upload your data
              </Typography>
            </Box>

            <CardContent sx={{ p: 4 }}>
              {/* Stepper */}
              <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
                {steps.map((label, index) => (
                  <Step key={label}>
                    <StepLabel
                      sx={{
                        '& .MuiStepLabel-label': {
                          fontSize: '0.875rem',
                          fontWeight: 600
                        }
                      }}
                    >
                      {label}
                    </StepLabel>
                  </Step>
                ))}
              </Stepper>

              {/* Step Content */}
              {activeStep === 0 && (
                <Fade in={activeStep === 0}>
                  <Box>
                    <Typography variant="h6" sx={{ 
                      fontWeight: 600, 
                      mb: 3,
                      color: '#1e293b'
                    }}>
                      Step 1: Select Vehicle Type & Bank
                    </Typography>
                    
                    <Grid container spacing={3}>
                      <Grid item xs={12} md={6}>
                        <FormControl fullWidth>
                          <InputLabel>Vehicle Type *</InputLabel>
                          <Select
                            value={vehicleType}
                            onChange={(e) => setVehicleType(e.target.value)}
                            label="Vehicle Type *"
                            disabled={isLoadingPreview || isLoadingUpload || isUploading}
                          >
                            {vehicleTypes.map((type) => (
                              <MenuItem key={type.value} value={type.value}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                  <Box sx={{ 
                                    color: type.color,
                                    display: 'flex',
                                    alignItems: 'center'
                                  }}>
                                    {type.icon}
                                  </Box>
                                  <Typography sx={{ fontWeight: 500 }}>
                                    {type.label}
                                  </Typography>
                                </Box>
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>

                      <Grid item xs={12} md={6}>
                        <FormControl fullWidth>
                          <InputLabel>Select Bank *</InputLabel>
                          <Select
                            value={selectedBank}
                            onChange={(e) => setSelectedBank(e.target.value)}
                            label="Select Bank *"
                            disabled={banks.length === 0 || isLoadingBanks || isLoadingPreview || isLoadingUpload || isUploading}
                          >
                            {isLoadingBanks ? (
                              <MenuItem disabled>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <RefreshIcon sx={{ animation: 'spin 1s linear infinite' }} />
                                  Loading banks...
                                </Box>
                              </MenuItem>
                            ) : banks.length === 0 ? (
                              <MenuItem disabled>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <BankIcon />
                                  No banks available
                                </Box>
                              </MenuItem>
                            ) : (
                              banks.map((bank) => (
                                <MenuItem key={bank._id} value={bank._id}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <BankIcon />
                                    {bank.name}
                                  </Box>
                                </MenuItem>
                              ))
                            )}
                          </Select>
                        </FormControl>
                      </Grid>
                    </Grid>

                    <Box sx={{ 
                      mt: 4, 
                      display: 'flex', 
                      gap: 2, 
                      flexDirection: { xs: 'column', sm: 'row' }
                    }}>
                      <Button
                        variant="contained"
                        onClick={() => setActiveStep(1)}
                        disabled={!vehicleType || !selectedBank || isLoadingPreview || isLoadingUpload || isUploading}
                        sx={{ 
                          py: 1.5,
                          px: 3,
                          borderRadius: 2,
                          background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)',
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
                          '&:hover': {
                            background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
                            transform: 'translateY(-2px)',
                            boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)'
                          },
                          '&:disabled': {
                            background: '#e2e8f0',
                            color: '#94a3b8'
                          }
                        }}
                      >
                        Next: Upload File
                      </Button>
                      <Button
                        variant="outlined"
                        onClick={() => downloadTemplate(vehicleType)}
                        disabled={!vehicleType || isLoadingPreview || isLoadingUpload || isUploading}
                        startIcon={<DownloadTemplateIcon />}
                        sx={{
                          py: 1.5,
                          px: 3,
                          borderRadius: 2,
                          borderColor: '#6366f1',
                          color: '#6366f1',
                          '&:hover': {
                            borderColor: '#4f46e5',
                            backgroundColor: 'rgba(99, 102, 241, 0.04)',
                            transform: 'translateY(-1px)'
                          }
                        }}
                      >
                        Download Template
                      </Button>
                    </Box>
                  </Box>
                </Fade>
              )}

              {/* Additional steps would go here */}
              {activeStep > 0 && (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography variant="h6" color="text.secondary">
                    Step {activeStep + 1} content will be implemented here
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Right Side - Info Panel */}
        <Grid item xs={12} lg={4}>
          <Card sx={{ 
            borderRadius: 4,
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
            border: '1px solid #e2e8f0',
            height: 'fit-content'
          }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ 
                fontWeight: 600, 
                mb: 3,
                color: '#1e293b'
              }}>
                Upload Guidelines
              </Typography>

              <List sx={{ p: 0 }}>
                <ListItem sx={{ px: 0, py: 1 }}>
                  <ListItemIcon>
                    <CheckCircleIcon sx={{ color: '#10b981' }} />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Supported Formats"
                    secondary="Excel (.xlsx), CSV files"
                    primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: 600 }}
                    secondaryTypographyProps={{ fontSize: '0.75rem' }}
                  />
                </ListItem>
                <ListItem sx={{ px: 0, py: 1 }}>
                  <ListItemIcon>
                    <CheckCircleIcon sx={{ color: '#10b981' }} />
                  </ListItemIcon>
                  <ListItemText 
                    primary="File Size Limit"
                    secondary="Maximum 120MB per file"
                    primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: 600 }}
                    secondaryTypographyProps={{ fontSize: '0.75rem' }}
                  />
                </ListItem>
                <ListItem sx={{ px: 0, py: 1 }}>
                  <ListItemIcon>
                    <CheckCircleIcon sx={{ color: '#10b981' }} />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Required Fields"
                    secondary="Registration Number is mandatory"
                    primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: 600 }}
                    secondaryTypographyProps={{ fontSize: '0.75rem' }}
                  />
                </ListItem>
                <ListItem sx={{ px: 0, py: 1 }}>
                  <ListItemIcon>
                    <CheckCircleIcon sx={{ color: '#10b981' }} />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Data Validation"
                    secondary="Automatic validation and mapping"
                    primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: 600 }}
                    secondaryTypographyProps={{ fontSize: '0.75rem' }}
                  />
                </ListItem>
              </List>

              <Divider sx={{ my: 3 }} />

              <Typography variant="h6" sx={{ 
                fontWeight: 600, 
                mb: 2,
                color: '#1e293b'
              }}>
                Quick Actions
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Button
                  variant="outlined"
                  startIcon={<HistoryIcon />}
                  onClick={() => setShowHistory(true)}
                  sx={{
                    borderRadius: 2,
                    borderColor: '#6366f1',
                    color: '#6366f1',
                    '&:hover': {
                      borderColor: '#4f46e5',
                      backgroundColor: 'rgba(99, 102, 241, 0.04)'
                    }
                  }}
                >
                  View Upload History
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<AnalyticsIcon />}
                  sx={{
                    borderRadius: 2,
                    borderColor: '#10b981',
                    color: '#10b981',
                    '&:hover': {
                      borderColor: '#059669',
                      backgroundColor: 'rgba(16, 185, 129, 0.04)'
                    }
                  }}
                >
                  View Analytics
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Loading Overlay */}
      {(isLoadingBanks || isLoadingHistory || isLoadingPreview || isLoadingUpload) && (
        <Box sx={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          zIndex: 9999, 
          bgcolor: 'rgba(0,0,0,0.7)', 
          display: 'flex', 
          flexDirection: 'column',
          alignItems: 'center', 
          justifyContent: 'center'
        }}>
          <Card sx={{ 
            p: 4, 
            borderRadius: 4,
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
            minWidth: 300
          }}>
            <RefreshIcon sx={{ 
              fontSize: 40, 
              animation: 'spin 1s linear infinite', 
              color: '#6366f1' 
            }} />
            <Typography variant="h6" sx={{ color: '#1e293b', fontWeight: 600 }}>
              {currentAction || 'Processing...'}
            </Typography>
            {isLoadingUpload && (
              <Box sx={{ width: '100%', mt: 1 }}>
                <LinearProgress 
                  sx={{
                    borderRadius: 2,
                    height: 8,
                    '& .MuiLinearProgress-bar': {
                      borderRadius: 2,
                      background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)'
                    }
                  }}
                />
                <Typography variant="body2" sx={{ mt: 1, textAlign: 'center', color: '#64748b' }}>
                  {uploadProgress}% Complete
                </Typography>
              </Box>
            )}
          </Card>
        </Box>
      )}

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </Box>
  );
};

export default ModernMobileUpload;





