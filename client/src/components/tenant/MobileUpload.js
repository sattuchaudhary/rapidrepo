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
  AccordionDetails
} from '@mui/material';
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
  Timeline as ProgressIcon
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';
import { toast } from 'react-toastify';

const MobileUpload = () => {
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

  // Load banks on component mount
  useEffect(() => {
    fetchBanks();
    fetchUploadHistory();
  }, []);

    const fetchBanks = async () => {
      try {
        const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:5000/api/tenant/clients', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setBanks(response.data.data);
        console.log('Banks loaded:', response.data.data);
      } else {
        console.error('Failed to load banks:', response.data.message);
        toast.error('Failed to load banks');
      }
    } catch (error) {
      console.error('Error fetching banks:', error);
      toast.error('Failed to load banks. Please check your connection.');
    }
  };

  const fetchUploadHistory = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:5000/api/tenant/mobile/history', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setUploadHistory(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching upload history:', error);
    }
  };

  const handleFileSelect = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  };

  const processFile = (selectedFile) => {
    // Validate file type
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ];
    
    if (!allowedTypes.includes(selectedFile.type)) {
      toast.error('Please select a valid Excel or CSV file');
      return;
    }

    // Validate file size (40MB limit)
    if (selectedFile.size > 40 * 1024 * 1024) {
      toast.error('File size must be less than 40MB');
      return;
    }

    setFile(selectedFile);
    setActiveStep(1);
    toast.success('File selected successfully');
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragOver(false);
    
    const files = event.dataTransfer.files;
    if (files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleUpload = async () => {
    if (!vehicleType || !file) {
      toast.error('Please select vehicle type and file');
      return;
    }

    try {
      setIsUploading(true);
      setUploadProgress(0);
      setUploadStatus('Uploading...');

      const formData = new FormData();
      formData.append('vehicleType', vehicleType);
      formData.append('bankId', selectedBank);
      formData.append('bankName', banks.find(b => b.id === selectedBank)?.name || '');
      formData.append('file', file);

      const token = localStorage.getItem('token');
      const response = await axios.post('http://localhost:5000/api/tenant/mobile/upload', formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(progress);
        }
      });

      if (response.data.success) {
        setUploadStatus('Upload completed successfully');
        setSuccessCount(response.data.inserted || 0);
        setErrorCount(response.data.errors?.length || 0);
        setErrors(response.data.errors || []);
        setWarnings(response.data.warnings || []);
        setActiveStep(2);
        toast.success(`Successfully uploaded ${response.data.inserted} records`);
        fetchUploadHistory();
      } else {
        throw new Error(response.data.message || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus('Upload failed');
      setErrorCount(1);
      setErrors([error.response?.data?.message || 'Upload failed']);
      toast.error('Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handlePreview = async () => {
    if (!file) return;

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('preview', 'true');

      const token = localStorage.getItem('token');
      const response = await axios.post('http://localhost:5000/api/tenant/mobile/preview', formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data.success) {
        setPreviewData(response.data.data);
        setShowPreview(true);
      }
    } catch (error) {
      console.error('Preview error:', error);
      toast.error('Failed to preview data');
    }
  };

  const downloadTemplate = (type) => {
    const templates = {
      TwoWheeler: 'two_wheeler_template.xlsx',
      FourWheeler: 'four_wheeler_template.xlsx',
      Commercial: 'commercial_template.xlsx'
    };

    const link = document.createElement('a');
    link.href = `/templates/${templates[type]}`;
    link.download = templates[type];
    link.click();
    
    toast.success('Template downloaded successfully');
  };

  const getVehicleIcon = (type) => {
    switch (type) {
      case 'TwoWheeler': return <TwoWheelerIcon />;
      case 'FourWheeler': return <FourWheelerIcon />;
      case 'Commercial': return <CommercialIcon />;
      default: return <FileIcon />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Completed': return 'success';
      case 'Failed': return 'error';
      case 'Processing': return 'warning';
      default: return 'default';
    }
  };

  const steps = [
    'Select Vehicle Type & Bank',
    'Upload File',
    'Review & Confirm',
    'Upload Complete'
  ];

  return (
    <Box sx={{ p: 3, bgcolor: 'grey.50', minHeight: '100vh' }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', color: 'primary.main' }}>
          <UploadIcon sx={{ mr: 2, verticalAlign: 'middle' }} />
          Mobile Upload
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          Upload vehicle data files in Excel or CSV format
        </Typography>
      </Box>

      {/* Main Content */}
      <Grid container spacing={3}>
        {/* Left Side - Upload Form */}
        <Grid item xs={12} md={8}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              {/* Progress Stepper */}
              <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
                {steps.map((label, index) => (
                  <Step key={label}>
                    <StepLabel>{label}</StepLabel>
                  </Step>
                ))}
              </Stepper>

              {/* Step 1: Vehicle Type & Bank Selection */}
              {activeStep === 0 && (
                <Box>
                  <Typography variant="h6" gutterBottom>
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
                        >
                          <MenuItem value="TwoWheeler">
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <TwoWheelerIcon />
                              Two Wheeler
                            </Box>
                          </MenuItem>
                          <MenuItem value="FourWheeler">
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <FourWheelerIcon />
                              Four Wheeler
                            </Box>
                          </MenuItem>
                          <MenuItem value="Commercial">
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <CommercialIcon />
                              Commercial Vehicle
                            </Box>
                          </MenuItem>
              </Select>
            </FormControl>
          </Grid>

                    <Grid item xs={12} md={6}>
                      <FormControl fullWidth>
                        <InputLabel>Select Bank (Optional)</InputLabel>
                        <Select
                          value={selectedBank}
                          onChange={(e) => setSelectedBank(e.target.value)}
                          label="Select Bank (Optional)"
                          disabled={banks.length === 0}
                        >
                          {banks.length === 0 ? (
                            <MenuItem disabled>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <BankIcon />
                                Loading banks...
                              </Box>
                            </MenuItem>
                          ) : (
                            banks.map((bank) => (
                              <MenuItem key={bank.id} value={bank.id}>
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

                  <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
                    <Button
                      variant="contained"
                      onClick={() => setActiveStep(1)}
                      disabled={!vehicleType}
                      sx={{ 
                        bgcolor: !vehicleType ? 'grey.300' : 'primary.main',
                        '&:hover': {
                          bgcolor: !vehicleType ? 'grey.300' : 'primary.dark'
                        }
                      }}
                    >
                      Next: Upload File
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={() => downloadTemplate(vehicleType)}
                      disabled={!vehicleType}
                      startIcon={<DownloadTemplateIcon />}
                    >
                      Download Template
                    </Button>
                  </Box>
                </Box>
              )}

              {/* Step 2: File Upload */}
              {activeStep === 1 && (
                <Box>
                  <Typography variant="h6" gutterBottom>
                    Step 2: Upload File
                  </Typography>

                  <Box
                    sx={{
                      border: `2px dashed ${isDragOver ? 'primary.main' : '#ccc'}`,
                      borderRadius: 2,
                      p: 4,
                      textAlign: 'center',
                      bgcolor: isDragOver ? 'primary.50' : 'grey.50',
                      mb: 3,
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        borderColor: 'primary.main',
                        bgcolor: 'primary.50'
                      }
                    }}
                    onClick={() => document.getElementById('file-input').click()}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    <UploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                    <Typography variant="h6" gutterBottom>
                      {file ? file.name : (isDragOver ? 'Drop file here' : 'Click to Choose File or Drag & Drop')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Supported formats: Excel (.xlsx, .xls), CSV (.csv)
                    </Typography>
                    {file && (
                      <Typography variant="body2" color="success.main" sx={{ mb: 2 }}>
                        ✓ File selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                      </Typography>
                    )}
                    <Button
                      variant="contained"
                      component="label"
                      startIcon={<UploadIcon />}
                      onClick={(e) => e.stopPropagation()}
                    >
              Choose File
                      <input
                        id="file-input"
                        hidden
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        onChange={handleFileSelect}
                      />
                    </Button>
                  </Box>

                  {file && (
                    <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                      <Button
                        variant="outlined"
                        onClick={handlePreview}
                        startIcon={<ViewIcon />}
                      >
                        Preview Data
                      </Button>
                      <Button
                        variant="contained"
                        onClick={handleUpload}
                        disabled={isUploading}
                        startIcon={<UploadIcon />}
                      >
                        Upload File
                      </Button>
                    </Box>
                  )}

                  <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
                    <Button
                      variant="outlined"
                      onClick={() => setActiveStep(0)}
                    >
                      Back
                    </Button>
                  </Box>
                </Box>
              )}

              {/* Step 3: Upload Progress */}
              {activeStep === 2 && (
                <Box>
                  <Typography variant="h6" gutterBottom>
                    Step 3: Upload Progress
                  </Typography>

                  {isUploading && (
                    <Box sx={{ mb: 3 }}>
                      <LinearProgress variant="determinate" value={uploadProgress} />
                      <Typography variant="body2" sx={{ mt: 1 }}>
                        {uploadProgress}% Complete
                      </Typography>
                    </Box>
                  )}

                  <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                    <Chip
                      icon={<SuccessIcon />}
                      label={`${successCount} Success`}
                      color="success"
                    />
                    <Chip
                      icon={<ErrorIcon />}
                      label={`${errorCount} Errors`}
                      color="error"
                    />
                  </Box>

                  {errors.length > 0 && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Upload Errors:
                      </Typography>
                      <List dense>
                        {errors.map((error, index) => (
                          <ListItem key={index}>
                            <ListItemIcon>
                              <ErrorIcon color="error" />
                            </ListItemIcon>
                            <ListItemText primary={error} />
                          </ListItem>
                        ))}
                      </List>
                    </Alert>
                  )}

                  {warnings.length > 0 && (
                    <Alert severity="warning" sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Warnings:
                      </Typography>
                      <List dense>
                        {warnings.map((warning, index) => (
                          <ListItem key={index}>
                            <ListItemIcon>
                              <WarningIcon color="warning" />
                            </ListItemIcon>
                            <ListItemText primary={warning} />
                          </ListItem>
                        ))}
                      </List>
                    </Alert>
                  )}

                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <Button
                      variant="contained"
                      onClick={() => {
                        setActiveStep(0);
                        setFile(null);
                        setSelectedBank('');
                        setVehicleType('');
                        setErrors([]);
                        setWarnings([]);
                        setSuccessCount(0);
                        setErrorCount(0);
                      }}
                    >
                      Upload Another File
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={() => setShowHistory(true)}
                      startIcon={<HistoryIcon />}
                    >
                      View Upload History
            </Button>
                  </Box>
                </Box>
              )}
            </CardContent>
          </Card>
          </Grid>

        {/* Right Side - Info & Stats */}
        <Grid item xs={12} md={4}>
          {/* Upload Guidelines */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <InfoIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Upload Guidelines
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemIcon>
                    <SuccessIcon sx={{ color: 'success.main' }} />
                  </ListItemIcon>
                  <ListItemText primary="Use provided Excel templates" />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <SuccessIcon sx={{ color: 'success.main' }} />
                  </ListItemIcon>
                  <ListItemText primary="Maximum file size: 40MB" />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <SuccessIcon sx={{ color: 'success.main' }} />
                  </ListItemIcon>
                  <ListItemText primary="Supported formats: .xlsx, .xls, .csv" />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <SuccessIcon sx={{ color: 'success.main' }} />
                  </ListItemIcon>
                  <ListItemText primary="Required fields must be filled" />
                </ListItem>
              </List>
            </CardContent>
          </Card>

          {/* Recent Uploads */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <HistoryIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Recent Uploads
              </Typography>
              {uploadHistory.slice(0, 5).map((upload, index) => (
                <Box key={index} sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Avatar sx={{ mr: 2, bgcolor: 'primary.main' }}>
                    {getVehicleIcon(upload.vehicleType)}
                  </Avatar>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" fontWeight="bold">
                      {upload.fileName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(upload.uploadDate).toLocaleDateString()}
                    </Typography>
                  </Box>
                  <Chip
                    label={upload.status}
                    color={getStatusColor(upload.status)}
                    size="small"
                  />
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Data Preview Dialog */}
      <Dialog open={showPreview} onClose={() => setShowPreview(false)} maxWidth="xl" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <ViewIcon />
            Data Preview
            <Chip 
              label={`${previewData.length} records`} 
              color="primary" 
              size="small" 
            />
          </Box>
        </DialogTitle>
        <DialogContent>
          <TableContainer sx={{ maxHeight: 600 }}>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Registration Number</TableCell>
                  <TableCell>Customer Name</TableCell>
                  <TableCell>Vehicle Make</TableCell>
                  <TableCell>Bank Name</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {previewData.map((row, index) => (
                  <TableRow key={index} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight="bold">
                        {row.registrationNumber}
                      </Typography>
                    </TableCell>
                    <TableCell>{row.customerName}</TableCell>
                    <TableCell>
                      <Chip 
                        label={row.vehicleMake} 
                        color="primary" 
                        size="small" 
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={row.bankName} 
                        color="secondary" 
                        size="small" 
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={row.status || 'Valid'}
                        color={row.status === 'Error' ? 'error' : 'success'}
                        size="small"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPreview(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Upload History Dialog */}
      <Dialog open={showHistory} onClose={() => setShowHistory(false)} maxWidth="md" fullWidth>
        <DialogTitle>Upload History</DialogTitle>
        <DialogContent>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>File Name</TableCell>
                  <TableCell>Vehicle Type</TableCell>
                  <TableCell>Bank</TableCell>
                  <TableCell>Upload Date</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Records</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {uploadHistory.map((upload, index) => (
                  <TableRow key={index}>
                    <TableCell>{upload.fileName}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {getVehicleIcon(upload.vehicleType)}
                        {upload.vehicleType}
                      </Box>
                    </TableCell>
                    <TableCell>{upload.bankName}</TableCell>
                    <TableCell>{new Date(upload.uploadDate).toLocaleString()}</TableCell>
                    <TableCell>
                      <Chip
                        label={upload.status}
                        color={getStatusColor(upload.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{upload.totalRecords}</TableCell>
                    <TableCell>
                      <IconButton size="small">
                        <ViewIcon />
                      </IconButton>
                      <IconButton size="small">
                        <DownloadIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowHistory(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MobileUpload;