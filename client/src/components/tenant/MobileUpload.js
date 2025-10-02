
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
  Timeline as ProgressIcon
} from '@mui/icons-material';
import SaveIcon from '@mui/icons-material/Save';
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
  const [headers, setHeaders] = useState([]);
  const [headerMapping, setHeaderMapping] = useState({});
  const [loadingMapping, setLoadingMapping] = useState(false);
  const [rawRows, setRawRows] = useState([]);
  const [columnMapping, setColumnMapping] = useState({}); // fileColumn -> standardField
  const [isLoadingBanks, setIsLoadingBanks] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isLoadingUpload, setIsLoadingUpload] = useState(false);
  const [currentAction, setCurrentAction] = useState('');

  const standardFields = [
    'location','bankName','agreementNumber','customerName','vehicleMake','registrationNumber','engineNumber','chassisNumber','emiAmount','pos','bucketStatus','address','branchName','firstConfirmedName','firstConfirmerPhone','secondConfirmedName','secondConfirmerPhone','thirdConfirmerName','thirdConfirmerPhone','zone','areaOffice','region','allocation','vehicleModel','productName'
  ];

  const hasMappedFields = React.useMemo(() => {
    if (!headers.length) return false;
    // Allow upload when at least one column is mapped
    return headers.some(h => !!columnMapping[h]);
  }, [columnMapping, headers]);

  // Load banks on component mount
  useEffect(() => {
    fetchBanks();
    fetchUploadHistory();
  }, []);

    const fetchBanks = async () => {
      try {
        setIsLoadingBanks(true);
        setCurrentAction('Loading banks...');
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
    } finally {
      setIsLoadingBanks(false);
      setCurrentAction('');
    }
  };

  const fetchUploadHistory = async () => {
    try {
      setIsLoadingHistory(true);
      setCurrentAction('Loading upload history...');
      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:5000/api/tenant/mobile/history', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setUploadHistory(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching upload history:', error);
    } finally {
      setIsLoadingHistory(false);
      setCurrentAction('');
    }
  };

  const handleFileSelect = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
    // Reset the input value to allow selecting the same file again
    event.target.value = '';
  };

  const processFile = (selectedFile) => {
    // Clear previous file data to fix the issue where previous file data loads
    setFile(null);
    setHeaders([]);
    setRawRows([]);
    setColumnMapping({});
    setHeaderMapping({});
    setPreviewData([]);
    
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

    // Validate file size (120MB limit)
    if (selectedFile.size > 120 * 1024 * 1024) {
      toast.error('File size must be less than 120MB');
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
    if (!vehicleType || !file || !selectedBank) {
      toast.error('Please select vehicle type, bank and file');
      return;
    }

    try {
      setIsUploading(true);
      setIsLoadingUpload(true);
      setCurrentAction('Uploading file...');
      setUploadProgress(0);
      setUploadStatus('Uploading...');

      const formData = new FormData();
      formData.append('vehicleType', vehicleType);
      formData.append('bankId', selectedBank);
      formData.append('bankName', banks.find(b => String(b._id) === String(selectedBank))?.name || '');
      formData.append('file', file);
      // Convert header dropdown selections to std->file mapping before send
      // Only include fields that are explicitly mapped (not empty/null)
      const stdToFileFromColumns = {};
      Object.entries(columnMapping).forEach(([fileCol, std]) => { 
        if (std && std.trim() !== '') {
          stdToFileFromColumns[std] = fileCol; 
        }
      });
      
      // Use column mapping if available, otherwise fall back to header mapping
      const finalMapping = Object.keys(stdToFileFromColumns).length > 0 ? stdToFileFromColumns : headerMapping;
      
      // Only send mapping if there are actually mapped fields
      if (Object.keys(finalMapping).length > 0) {
        formData.append('mapping', JSON.stringify(finalMapping));
        console.log('Sending field mapping:', finalMapping);
      } else {
        console.log('No field mapping provided - will use automatic mapping');
      }

      const token = localStorage.getItem('token');
      const response = await axios.post('http://localhost:5000/api/tenant/mobile/upload', formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        },
        timeout: 1200000, // 20 minutes timeout
        maxContentLength: 10 * 1024 * 1024 * 1024, // 10GB (practically unlimited)
        maxBodyLength: 10 * 1024 * 1024 * 1024, // 10GB (practically unlimited)
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
        
        // Add mapping summary to warnings if available
        if (response.data.mappingSummary) {
          setWarnings(prev => [`Mapping Info: ${response.data.mappingSummary}`, ...prev]);
        }
        
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
      setIsLoadingUpload(false);
      setCurrentAction('');
    }
  };

  const handlePreview = async () => {
    if (!file) return;

    try {
      setIsLoadingPreview(true);
      setCurrentAction('Loading file preview...');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('preview', 'true');
      
      // Use the same mapping logic as upload for consistency
      const stdToFileFromColumns = {};
      Object.entries(columnMapping).forEach(([fileCol, std]) => { 
        if (std && std.trim() !== '') {
          stdToFileFromColumns[std] = fileCol; 
        }
      });
      
      const finalMapping = Object.keys(stdToFileFromColumns).length > 0 ? stdToFileFromColumns : headerMapping;
      if (Object.keys(finalMapping).length > 0) {
        formData.append('mapping', JSON.stringify(finalMapping));
        console.log('Preview using field mapping:', finalMapping);
      }

      const token = localStorage.getItem('token');
      const response = await axios.post('http://localhost:5000/api/tenant/mobile/preview', formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data.success) {
        setPreviewData(response.data.data);
        setHeaders(response.data.headers || []);
        setRawRows(response.data.rawRows || []);
        // Inline grid UX: keep dialog closed; show table below instead
        setShowPreview(false);
        toast.success('File loaded');
        // Initialize column mapping from existing std->file mapping if present
        if (Object.keys(headerMapping).length > 0 && (response.data.headers || []).length) {
          const inverted = {};
          Object.entries(headerMapping).forEach(([std, fileCol]) => { inverted[fileCol] = std; });
          setColumnMapping(inverted);
        } else {
          setColumnMapping({});
        }
      }
    } catch (error) {
      console.error('Preview error:', error);
      toast.error('Failed to preview data');
    } finally {
      setIsLoadingPreview(false);
      setCurrentAction('');
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
    'Upload & Map Headers',
    'Review & Confirm',
    'Upload Complete'
  ];

  return (
    <Box sx={{ 
      p: 1.5, 
      bgcolor: 'grey.50', 
      minHeight: '100vh',
      '@keyframes spin': {
        '0%': { transform: 'rotate(0deg)' },
        '100%': { transform: 'rotate(360deg)' }
      }
    }}>
      {/* Global Loading Indicator */}
      {(isLoadingBanks || isLoadingHistory || isLoadingPreview || isLoadingUpload) && (
        <Box sx={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          zIndex: 9999, 
          bgcolor: 'rgba(0,0,0,0.7)', 
          display: 'flex', 
          flexDirection: 'column',
          alignItems: 'center', 
          justifyContent: 'center',
          minHeight: '100vh'
        }}>
          <Box sx={{ 
            bgcolor: 'white', 
            p: 3, 
            borderRadius: 2, 
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2
          }}>
            <RefreshIcon sx={{ fontSize: 40, animation: 'spin 1s linear infinite', color: 'primary.main' }} />
            <Typography variant="h6" color="primary.main">
              {currentAction || 'Processing...'}
            </Typography>
            {isLoadingUpload && (
              <Box sx={{ width: '100%', mt: 1 }}>
                <LinearProgress />
                <Typography variant="body2" sx={{ mt: 1, textAlign: 'center' }}>
                  {uploadProgress}% Complete
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      )}

      {/* Main Content */}
      <Grid container spacing={3}>
        {/* Left Side - Upload Form */}
        <Grid item xs={12} md={8}>
          <Card sx={{ mb: 1 }}>
            <CardContent sx={{ py: 1, px: 2 }}>
              {/* Compact layout - no stepper */}

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
                        <InputLabel>Select Bank *</InputLabel>
                        <Select
                          value={selectedBank}
                          onChange={(e) => setSelectedBank(e.target.value)}
                          label="Select Bank *"
                          disabled={banks.length === 0 || isLoadingBanks}
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

                  <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
                    <Button
                      variant="contained"
                      onClick={() => setActiveStep(1)}
                      disabled={!vehicleType || !selectedBank}
                      sx={{ 
                        bgcolor: (!vehicleType || !selectedBank) ? 'grey.300' : 'primary.main',
                        '&:hover': {
                          bgcolor: (!vehicleType || !selectedBank) ? 'grey.300' : 'primary.dark'
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

              {/* Step 2: File Upload + Header Mapping */}
              {activeStep === 1 && (
                <Box>
                  {/* Controls row - appear progressively */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
                    {/* Vehicle type and bank are selected on previous step; ensure file input only after both are chosen */}
                    {vehicleType && selectedBank ? (
                      <>
                    <Button
                      variant="contained"
                      component="label"
                          size="small"
                      startIcon={<UploadIcon />}
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
                        <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
                          {file ? `${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)` : 'Supported: .xlsx .xls .csv'}
                        </Typography>
                  {file && (
                          <>
                            <Button 
                              variant="contained" 
                              size="small" 
                              onClick={handlePreview}
                              disabled={isLoadingPreview}
                              startIcon={isLoadingPreview ? <RefreshIcon sx={{ animation: 'spin 1s linear infinite' }} /> : <ViewIcon />}
                            >
                              {isLoadingPreview ? 'Loading...' : 'Load File'}
                            </Button>
                            <Button 
                              variant="contained" 
                              size="small" 
                              onClick={handleUpload} 
                              disabled={isUploading || !hasMappedFields || isLoadingUpload}
                              startIcon={isLoadingUpload ? <RefreshIcon sx={{ animation: 'spin 1s linear infinite' }} /> : <UploadIcon />}
                            >
                              {isLoadingUpload ? 'Uploading...' : 'Upload File'}
                            </Button>
                          </>
                        )}
                      </>
                    ) : (
                      <Typography variant="body2" color="text.secondary">Select vehicle type and bank first</Typography>
                    )}
                  </Box>
                  <Typography variant="caption" color="text.secondary">Step: 1 Select • 2 Load • 3 Map • 4 Upload</Typography>
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
                      disabled={isLoadingHistory}
                    >
                      {isLoadingHistory ? 'Loading History...' : 'View Upload History'}
            </Button>
                  </Box>
                </Box>
              )}
            </CardContent>
          </Card>
          </Grid>

        {/* Right Side - Info & Stats */}
        <Grid item xs={12} md={4}></Grid>
      </Grid>

      {/* Inline Header mapping + Raw grid */}
      {activeStep === 1 && rawRows.length > 0 && (
        <Box sx={{ mt: 2 }}>
          {/* Mapping Summary */}
          <Paper sx={{ p: 2, mb: 2 }}>
            <Typography variant="h6" gutterBottom>
              Column Mapping Summary
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="success.main">
                    {Object.values(columnMapping).filter(v => v).length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Mapped Columns
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={4}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="warning.main">
                    {headers.length - Object.values(columnMapping).filter(v => v).length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Unmapped Columns (will be ignored)
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={4}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="primary.main">
                    {headers.length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Columns
                  </Typography>
                </Box>
              </Grid>
            </Grid>
            {!hasMappedFields && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                Please map at least one column to proceed with upload.
              </Alert>
            )}
          </Paper>
          
          <Paper>
            <TableContainer sx={{ maxHeight: 500 }}>
            <Table stickyHeader>
              <TableHead>
                  <TableRow>
                    {headers.map(h => (
                      <TableCell key={h}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
                            {h}
                          </Typography>
                          <Autocomplete
                            size="small"
                            options={['', ...standardFields]} // Include empty option to allow unmapping
                            value={columnMapping[h] || ''}
                            onChange={(e, val) => setColumnMapping({ ...columnMapping, [h]: val || '' })}
                            renderInput={(params) => (
                              <TextField 
                                {...params} 
                                label={columnMapping[h] ? "Mapped to" : "Not mapped"} 
                                variant="outlined"
                                color={columnMapping[h] ? "success" : "warning"}
                              />
                            )}
                            renderOption={(props, option) => (
                              <li {...props}>
                                {option === '' ? (
                                  <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                                    Don't map (ignore column)
                                  </Typography>
                                ) : (
                                  <Box>
                                    <Typography variant="body2">{option}</Typography>
                                    {(option === 'registrationNumber' || option.includes('Phone') || option === 'engineNumber' || option === 'chassisNumber') && (
                                      <Typography variant="caption" color="info.main" sx={{ fontSize: '0.65rem', display: 'block' }}>
                                        ✨ Auto-formatted (removes spaces/hyphens)
                                      </Typography>
                                    )}
                                  </Box>
                                )}
                              </li>
                            )}
                          />
                          {!columnMapping[h] ? (
                            <Typography variant="caption" color="warning.main" sx={{ fontSize: '0.7rem' }}>
                              ⚠️ This column will be ignored
                            </Typography>
                          ) : (
                            (columnMapping[h] === 'registrationNumber' || columnMapping[h].includes('Phone') || columnMapping[h] === 'engineNumber' || columnMapping[h] === 'chassisNumber') && (
                              <Typography variant="caption" color="info.main" sx={{ fontSize: '0.7rem' }}>
                                ✨ Data will be auto-formatted
                              </Typography>
                            )
                          )}
                        </Box>
                      </TableCell>
                    ))}
                  </TableRow>
              </TableHead>
              <TableBody>
                  {rawRows.map((r, idx) => (
                    <TableRow key={idx}>
                      {headers.map(h => (
                        <TableCell key={h}>{String(r[h] ?? '')}</TableCell>
                      ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          </Paper>
        </Box>
      )}

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
