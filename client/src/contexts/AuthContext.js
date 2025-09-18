import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';

// Create context
const AuthContext = createContext();

// Initial state
const initialState = {
  user: null,
  token: localStorage.getItem('token'),
  isAuthenticated: false,
  loading: true,
  error: null
};

// Action types
const AUTH_ACTIONS = {
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAIL: 'LOGIN_FAIL',
  LOGOUT: 'LOGOUT',
  USER_LOADED: 'USER_LOADED',
  AUTH_ERROR: 'AUTH_ERROR',
  CLEAR_ERROR: 'CLEAR_ERROR',
  SET_LOADING: 'SET_LOADING'
};

// Reducer
const authReducer = (state, action) => {
  switch (action.type) {
    case AUTH_ACTIONS.LOGIN_SUCCESS:
      localStorage.setItem('token', action.payload.token);
      return {
        ...state,
        token: action.payload.token,
        user: action.payload.user,
        isAuthenticated: true,
        loading: false,
        error: null
      };
    
    case AUTH_ACTIONS.USER_LOADED:
      return {
        ...state,
        user: action.payload,
        isAuthenticated: true,
        loading: false,
        error: null
      };
    
    case AUTH_ACTIONS.LOGIN_FAIL:
    case AUTH_ACTIONS.AUTH_ERROR:
    case AUTH_ACTIONS.LOGOUT:
      localStorage.removeItem('token');
      return {
        ...state,
        token: null,
        user: null,
        isAuthenticated: false,
        loading: false,
        error: action.payload
      };
    
    case AUTH_ACTIONS.CLEAR_ERROR:
      return {
        ...state,
        error: null
      };
    
    case AUTH_ACTIONS.SET_LOADING:
      return {
        ...state,
        loading: action.payload
      };
    
    default:
      return state;
  }
};

// Auth Provider Component
export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Set auth token header
  const setAuthToken = (token) => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  };

  // Load user
  const loadUser = useCallback(async () => {
    try {
      if (state.token) {
        setAuthToken(state.token);
        const res = await axios.get('http://localhost:5000/api/unified-auth/profile');
        dispatch({
          type: AUTH_ACTIONS.USER_LOADED,
          payload: res.data.data.user
        });
      } else {
        dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: false });
      }
    } catch (error) {
      console.error('Load user error:', error);
      dispatch({ type: AUTH_ACTIONS.AUTH_ERROR, payload: error.response?.data?.message || 'Authentication failed' });
    }
  }, [state.token]);

  // Unified Login user (works for all user types)
  const login = async (identifier, password) => {
    try {
      dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: true });
      
      const res = await axios.post('http://localhost:5000/api/unified-auth/login', { 
        identifier, 
        password 
      });
      
      dispatch({
        type: AUTH_ACTIONS.LOGIN_SUCCESS,
        payload: res.data.data
      });
      
      toast.success('Login successful!');
      return { 
        success: true, 
        redirectTo: res.data.data.redirectTo,
        userType: res.data.data.user.userType
      };
    } catch (error) {
      const message = error.response?.data?.message || 'Login failed';
      dispatch({ type: AUTH_ACTIONS.LOGIN_FAIL, payload: message });
      toast.error(message);
      return { success: false, message };
    }
  };

  // Register user
  const register = async (userData) => {
    try {
      dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: true });
      
      const res = await axios.post('http://localhost:5000/api/auth/register', userData);
      
      dispatch({
        type: AUTH_ACTIONS.LOGIN_SUCCESS,
        payload: res.data.data
      });
      
      toast.success('Registration successful!');
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'Registration failed';
      dispatch({ type: AUTH_ACTIONS.LOGIN_FAIL, payload: message });
      toast.error(message);
      return { success: false, message };
    }
  };

  // Logout user
  const logout = async () => {
    try {
      if (state.token) {
        await axios.post('http://localhost:5000/api/auth/logout');
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      dispatch({ type: AUTH_ACTIONS.LOGOUT });
      toast.info('Logged out successfully');
    }
  };

  // Update profile
  const updateProfile = async (profileData) => {
    try {
      const res = await axios.put('http://localhost:5000/api/auth/profile', profileData);
      
      dispatch({
        type: AUTH_ACTIONS.USER_LOADED,
        payload: res.data.data.user
      });
      
      toast.success('Profile updated successfully!');
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'Profile update failed';
      toast.error(message);
      return { success: false, message };
    }
  };

  // Change password
  const changePassword = async (passwordData) => {
    try {
      await axios.put('http://localhost:5000/api/auth/change-password', passwordData);
      toast.success('Password changed successfully!');
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'Password change failed';
      toast.error(message);
      return { success: false, message };
    }
  };

  // Clear error
  const clearError = () => {
    dispatch({ type: AUTH_ACTIONS.CLEAR_ERROR });
  };

  // Load user on mount
  useEffect(() => {
    loadUser();
  }, [loadUser]);

  // Set auth token when token changes
  useEffect(() => {
    setAuthToken(state.token);
  }, [state.token]);

  const value = {
    user: state.user,
    token: state.token,
    isAuthenticated: state.isAuthenticated,
    loading: state.loading,
    error: state.error,
    login,
    register,
    logout,
    updateProfile,
    changePassword,
    clearError
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
