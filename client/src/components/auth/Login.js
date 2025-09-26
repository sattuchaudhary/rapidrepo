import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Alert
} from '@mui/material';
import { useAuth } from '../../contexts/AuthContext';
import './Login.css';

const Login = () => {
  const [formData, setFormData] = useState({
    identifier: '', // Can be email or phone
    password: ''
  });
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const result = await login(formData.identifier, formData.password);
    if (result.success) {
      // Navigate to the specified redirect URL
      navigate('/app/dashboard');
    } else {
      setError(result.message);
    }
  };

  return (
    <div className="login-page">
      {/* Header */}
      <header className="login-header">
        <div className="container">
          <div className="nav-brand">
            <h2>RAPIDREPO</h2>
          </div>
          <div className="header-actions">
            <button className="back-to-home" onClick={() => navigate('/')}>
              ← Back to Home
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="login-main">
        <div className="login-container">
          <div className="login-card">
            <div className="login-header-content">
              <div className="login-logo">
                <div className="logo-icon">🚀</div>
                <h1>Welcome Back</h1>
                <p>Sign in to your Rapidrepo account</p>
              </div>
            </div>

            <div className="login-form-container">
              {error && (
                <Alert severity="error" className="error-alert">
                  {error}
                </Alert>
              )}

              <Box component="form" onSubmit={handleSubmit} className="login-form">
                <div className="form-group">
                  <TextField
                    fullWidth
                    id="identifier"
                    label="Email or Phone Number"
                    name="identifier"
                    autoComplete="email"
                    autoFocus
                    value={formData.identifier}
                    onChange={handleChange}
                    helperText="Enter your email address or phone number"
                    className="custom-input"
                  />
                </div>
                
                <div className="form-group">
                  <TextField
                    fullWidth
                    name="password"
                    label="Password"
                    type="password"
                    id="password"
                    autoComplete="current-password"
                    value={formData.password}
                    onChange={handleChange}
                    className="custom-input"
                  />
                </div>

                <Button
                  type="submit"
                  fullWidth
                  className="login-btn"
                >
                  Sign In to Rapidrepo
                </Button>
              </Box>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="login-footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-section">
              <h4>RAPIDREPO</h4>
              <p>Transforming vehicle repossession with technology</p>
            </div>
            <div className="footer-section">
              <h4>Quick Links</h4>
              <ul>
                <li><a href="/#home">Home</a></li>
                <li><a href="/#about">About</a></li>
                <li><a href="/#features">Features</a></li>
                <li><a href="/#pricing">Pricing</a></li>
              </ul>
            </div>
            <div className="footer-section">
              <h4>Contact</h4>
              <p>Email: info@rapidrepo.com</p>
              <p>Phone: +91 9997679791</p>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; 2025 Rapidrepo. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Login;
