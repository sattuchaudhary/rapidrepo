import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  IconButton,
  Chip,
  Avatar,
  LinearProgress
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  People as PeopleIcon,
  Business as BusinessIcon,
  Assessment as AssessmentIcon,
  Visibility as ViewIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  LocalShipping as TruckIcon
} from '@mui/icons-material';
import axios from 'axios';

const ModernDashboard = ({ stats, loading, error }) => {
  const [animatedStats, setAnimatedStats] = useState({
    totalRecords: 0,
    onHold: 0,
    inYard: 0,
    released: 0
  });

  // Animate numbers
  useEffect(() => {
    const animateValue = (start, end, duration, key) => {
      const startTime = performance.now();
      const animate = (currentTime) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const current = Math.floor(start + (end - start) * progress);
        
        setAnimatedStats(prev => ({ ...prev, [key]: current }));
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };
      requestAnimationFrame(animate);
    };

    if (stats) {
      animateValue(0, stats.totalRecords, 2000, 'totalRecords');
      animateValue(0, stats.onHold, 2000, 'onHold');
      animateValue(0, stats.inYard, 2000, 'inYard');
      animateValue(0, stats.released, 2000, 'released');
    }
  }, [stats]);

  const cardData = [
    {
      title: 'Total Records',
      value: animatedStats.totalRecords,
      icon: <AssessmentIcon />,
      color: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      shadowColor: 'rgba(102, 126, 234, 0.3)',
      trend: '+12%',
      trendColor: '#10b981'
    },
    {
      title: 'On Hold',
      value: animatedStats.onHold,
      icon: <ScheduleIcon />,
      color: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)',
      shadowColor: 'rgba(245, 158, 11, 0.3)',
      trend: '+5%',
      trendColor: '#f59e0b'
    },
    {
      title: 'In Yard',
      value: animatedStats.inYard,
      icon: <TruckIcon />,
      color: 'linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)',
      shadowColor: 'rgba(59, 130, 246, 0.3)',
      trend: '+8%',
      trendColor: '#3b82f6'
    },
    {
      title: 'Released',
      value: animatedStats.released,
      icon: <CheckCircleIcon />,
      color: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)',
      shadowColor: 'rgba(16, 185, 129, 0.3)',
      trend: '+15%',
      trendColor: '#10b981'
    }
  ];

  if (loading) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '400px',
        flexDirection: 'column',
        gap: 2
      }}>
        <CircularProgress size={60} thickness={4} />
        <Typography variant="h6" color="text.secondary">
          Loading dashboard data...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 3 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 1.5 }}>
        <Typography variant="h5" sx={{ 
          fontWeight: 700, 
          color: '#1e293b',
          mb: 0.25,
          letterSpacing: '-0.025em'
        }}>
          Dashboard Overview
        </Typography>
        <Typography variant="body2" sx={{ 
          color: '#1a232fff',
          fontSize: '0.875rem'
        }}>
          Real-time insights and analytics for your business
        </Typography>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {cardData.map((card, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card sx={{ 
              height: '100%',
              background: card.color,
              border: 'none',
              borderRadius: 4,
              boxShadow: `0 10px 25px ${card.shadowColor}`,
              transition: 'all 0.3s ease',
              position: 'relative',
              overflow: 'hidden',
              '&:hover': {
                transform: 'translateY(-8px)',
                boxShadow: `0 20px 40px ${card.shadowColor}`,
                '& .card-icon': {
                  transform: 'scale(1.1) rotate(5deg)'
                }
              },
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
                borderRadius: 4,
              }
            }}>
              <CardContent sx={{ 
                textAlign: 'center', 
                p: 2.5, 
                position: 'relative', 
                zIndex: 1 
              }}>
                {/* Icon */}
                <Box sx={{ 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  width: 60,
                  height: 60,
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.2)',
                  mb: 2,
                  backdropFilter: 'blur(10px)',
                  border: '2px solid rgba(255, 255, 255, 0.3)',
                  transition: 'all 0.3s ease'
                }} className="card-icon">
                  {React.cloneElement(card.icon, { 
                    sx: { color: 'white', fontSize: 28 } 
                  })}
                </Box>

                {/* Value */}
                <Typography variant="h3" sx={{ 
                  fontWeight: 800, 
                  color: 'white',
                  mb: 0.5,
                  textShadow: '0 2px 4px rgba(0,0,0,0.3)',
                  fontFamily: 'Inter, sans-serif'
                }}>
                  {card.value.toLocaleString()}
                </Typography>

                {/* Title */}
                <Typography variant="body1" sx={{ 
                  mb: 1.5, 
                  fontWeight: 600,
                  color: 'rgba(255, 255, 255, 0.9)',
                  textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                  fontSize: '0.875rem'
                }}>
                  {card.title}
                </Typography>

                {/* Trend */}
                <Box sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  gap: 0.5,
                  mb: 1.5
                }}>
                  <TrendingUpIcon sx={{ 
                    color: card.trendColor, 
                    fontSize: 16 
                  }} />
                  <Typography variant="caption" sx={{ 
                    color: 'rgba(255, 255, 255, 0.8)',
                    fontWeight: 600,
                    fontSize: '0.75rem'
                  }}>
                    {card.trend} from last month
                  </Typography>
                </Box>

                {/* Action Button */}
                <IconButton 
                  size="small" 
                  sx={{ 
                    bgcolor: 'rgba(255, 255, 255, 0.2)',
                    color: 'white',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    '&:hover': {
                      bgcolor: 'rgba(255, 255, 255, 0.3)',
                      transform: 'scale(1.1)'
                    }
                  }}
                >
                  <ViewIcon />
                </IconButton>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Additional Stats */}
      <Grid container spacing={3}>
        {/* Vehicle Data */}
        <Grid item xs={12} md={8}>
          <Card sx={{ 
            borderRadius: 4,
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
            border: '1px solid #e2e8f0'
          }}>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="h6" sx={{ 
                fontWeight: 700, 
                mb: 2,
                color: '#1e293b'
              }}>
                Vehicle Data Summary
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <Box sx={{ 
                    textAlign: 'center',
                    p: 2,
                    borderRadius: 2,
                    background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                    border: '1px solid #e2e8f0'
                  }}>
                    <Avatar sx={{ 
                      bgcolor: '#f59e0b', 
                      width: 45, 
                      height: 45, 
                      mx: 'auto', 
                      mb: 1.5 
                    }}>
                      <TruckIcon sx={{ fontSize: 22 }} />
                    </Avatar>
                    <Typography variant="h5" sx={{ 
                      fontWeight: 700, 
                      color: '#1e293b',
                      mb: 0.5
                    }}>
                      {stats?.twoWheeler || 0}
                    </Typography>
                    <Typography variant="body2" sx={{ 
                      color: '#64748b',
                      fontWeight: 600,
                      fontSize: '0.875rem'
                    }}>
                      Two Wheeler
                    </Typography>
                  </Box>
                </Grid>
                
                <Grid item xs={12} sm={4}>
                  <Box sx={{ 
                    textAlign: 'center',
                    p: 2,
                    borderRadius: 2,
                    background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                    border: '1px solid #e2e8f0'
                  }}>
                    <Avatar sx={{ 
                      bgcolor: '#10b981', 
                      width: 45, 
                      height: 45, 
                      mx: 'auto', 
                      mb: 1.5 
                    }}>
                      <TruckIcon sx={{ fontSize: 22 }} />
                    </Avatar>
                    <Typography variant="h5" sx={{ 
                      fontWeight: 700, 
                      color: '#1e293b',
                      mb: 0.5
                    }}>
                      {stats?.fourWheeler || 0}
                    </Typography>
                    <Typography variant="body2" sx={{ 
                      color: '#64748b',
                      fontWeight: 600,
                      fontSize: '0.875rem'
                    }}>
                      Four Wheeler
                    </Typography>
                  </Box>
                </Grid>
                
                <Grid item xs={12} sm={4}>
                  <Box sx={{ 
                    textAlign: 'center',
                    p: 2,
                    borderRadius: 2,
                    background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                    border: '1px solid #e2e8f0'
                  }}>
                    <Avatar sx={{ 
                      bgcolor: '#ef4444', 
                      width: 45, 
                      height: 45, 
                      mx: 'auto', 
                      mb: 1.5 
                    }}>
                      <TruckIcon sx={{ fontSize: 22 }} />
                    </Avatar>
                    <Typography variant="h5" sx={{ 
                      fontWeight: 700, 
                      color: '#1e293b',
                      mb: 0.5
                    }}>
                      {stats?.cvData || 0}
                    </Typography>
                    <Typography variant="body2" sx={{ 
                      color: '#64748b',
                      fontWeight: 600,
                      fontSize: '0.875rem'
                    }}>
                      CV Data
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* User Stats */}
        <Grid item xs={12} md={4}>
          <Card sx={{ 
            borderRadius: 4,
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
            border: '1px solid #e2e8f0',
            height: '100%'
          }}>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="h6" sx={{ 
                fontWeight: 700, 
                mb: 2,
                color: '#1e293b'
              }}>
                User Statistics
              </Typography>
              
              <Box sx={{ mb: 3 }}>
                <Box sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  mb: 1.5
                }}>
                  <Typography variant="body2" sx={{ 
                    fontWeight: 600,
                    color: '#64748b',
                    fontSize: '0.875rem'
                  }}>
                    Office Staff
                  </Typography>
                  <Chip 
                    label={stats?.userStats?.officeStaff || 0}
                    color="primary"
                    size="small"
                    sx={{ fontWeight: 600 }}
                  />
                </Box>
                <LinearProgress 
                  variant="determinate" 
                  value={75} 
                  sx={{ 
                    height: 6, 
                    borderRadius: 3,
                    bgcolor: '#e2e8f0',
                    '& .MuiLinearProgress-bar': {
                      borderRadius: 3,
                      background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)'
                    }
                  }} 
                />
              </Box>
              
              <Box>
                <Box sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  mb: 1.5
                }}>
                  <Typography variant="body2" sx={{ 
                    fontWeight: 600,
                    color: '#64748b',
                    fontSize: '0.875rem'
                  }}>
                    Repo Agents
                  </Typography>
                  <Chip 
                    label={stats?.userStats?.repoAgents || 0}
                    color="secondary"
                    size="small"
                    sx={{ fontWeight: 600 }}
                  />
                </Box>
                <LinearProgress 
                  variant="determinate" 
                  value={60} 
                  sx={{ 
                    height: 6, 
                    borderRadius: 3,
                    bgcolor: '#e2e8f0',
                    '& .MuiLinearProgress-bar': {
                      borderRadius: 3,
                      background: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)'
                    }
                  }} 
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ModernDashboard;
  