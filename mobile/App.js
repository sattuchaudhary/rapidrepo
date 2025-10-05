import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import axios from 'axios';
import { getBaseURL } from './utils/config';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as SecureStore from 'expo-secure-store';
import LoginScreen from './screens/LoginScreen';
import DashboardScreen from './screens/DashboardScreen';
import SearchResultsScreen from './screens/SearchResultsScreen';
import ProfileScreen from './screens/ProfileScreen';
import IDCardScreen from './screens/IDCardScreen';
import OfflineDataBrowser from './screens/OfflineDataBrowser';
import SyncScreen from './screens/SyncScreen';
import SettingsScreen from './screens/SettingsScreen';
import JSONExportScreen from './screens/JSONExportScreen';
import PaymentScreen from './screens/PaymentScreen';
import GlobalSyncOverlay from './components/GlobalSyncOverlay';
import UpdateNotification from './components/UpdateNotification';
import FastSplashScreen from './components/FastSplashScreen';
import versionManager from './utils/versionManager';
import { startSmartBackgroundSync } from './utils/smartBackgroundSync';

const Stack = createNativeStackNavigator();

export default function App() {
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [showSplash, setShowSplash] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const appState = useRef(AppState.currentState);
  const sessionIdRef = useRef(null);
  const startedAtRef = useRef(null);
  useEffect(() => {
    SplashScreen.preventAutoHideAsync().catch(() => {});
    (async () => {
      try {
        // Fast token check - don't wait for other operations
        const token = await SecureStore.getItemAsync('token');
        setIsLoggedIn(!!token);
        
        // Hide native splash screen immediately
        SplashScreen.hideAsync().catch(() => {});
        setIsBootstrapping(false);
        
        // Hide custom splash screen after minimum time
        setTimeout(() => {
          setShowSplash(false);
        }, 800);
      } catch (error) {
        console.error('Startup error:', error);
        SplashScreen.hideAsync().catch(() => {});
        setIsBootstrapping(false);
        setShowSplash(false);
      }
    })();
  }, []);

  // App usage session tracking - delayed to not block startup
  useEffect(() => {
    let isActive = true;

    const startSession = async () => {
      try {
        const token = await SecureStore.getItemAsync('token');
        if (!token) return;
        // Add timeout to prevent blocking
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        const res = await axios.post(`${getBaseURL()}/api/history/usage/start`, {
          platform: 'mobile',
          metadata: { appState: appState.current }
        }, { 
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
          timeout: 3000
        });
        clearTimeout(timeoutId);
        sessionIdRef.current = res.data?.data?.sessionId || null;
        startedAtRef.current = Date.now();
      } catch (_) {
        // Silently fail - don't block app startup
      }
    };

    const endSession = async () => {
      try {
        const token = await SecureStore.getItemAsync('token');
        if (!token) return;
        const sid = sessionIdRef.current;
        if (!sid) return;
        await axios.post(`${getBaseURL()}/api/history/usage/end`, {
          sessionId: sid,
          endedAt: new Date().toISOString()
        }, { headers: { Authorization: `Bearer ${token}` } });
        sessionIdRef.current = null;
        startedAtRef.current = null;
      } catch (_) {}
    };

    const handleAppStateChange = async (nextState) => {
      const prev = appState.current;
      appState.current = nextState;
      // Move to active -> start session; move away from active -> end session
      if (prev.match(/inactive|background/) && nextState === 'active') {
        await startSession();
      } else if (prev === 'active' && nextState.match(/inactive|background/)) {
        await endSession();
      }
    };

    // On mount, start session if logged in - with delay to not block startup
    if (isLoggedIn) {
      // Delay session start to not block app startup
      setTimeout(() => {
        startSession();
      }, 1000);
    }

    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      isActive = false;
      sub && sub.remove && sub.remove();
      // End any ongoing session
      endSession();
    };
  }, [isLoggedIn]);

  // Check for updates when app starts or user logs in - delayed to not block startup
  useEffect(() => {
    const checkForUpdates = async () => {
      if (!isLoggedIn) return;
      
      try {
        const updateData = await versionManager.getUpdateInfo();
        if (updateData) {
          setUpdateInfo(updateData);
          setShowUpdateModal(true);
        }
      } catch (error) {
        console.error('Failed to check for updates:', error);
      }
    };

    // Check for updates after a longer delay to allow app to fully load
    const timer = setTimeout(checkForUpdates, 5000);
    return () => clearTimeout(timer);
  }, [isLoggedIn]);

  // Start smart background sync when user logs in - delayed to not block startup
  useEffect(() => {
    if (isLoggedIn) {
      // Delay background sync to not block app startup
      setTimeout(() => {
        console.log('🚀 Starting smart background sync...');
        startSmartBackgroundSync();
      }, 3000);
    }
  }, [isLoggedIn]);

  const handleUpdateModalClose = () => {
    setShowUpdateModal(false);
    setUpdateInfo(null);
  };

  // Show custom splash screen while app is loading
  if (showSplash) {
    return <FastSplashScreen onFinish={() => setShowSplash(false)} />;
  }

  return (
    <NavigationContainer>
      {!isBootstrapping && (
        <Stack.Navigator 
          initialRouteName={isLoggedIn ? 'Dashboard' : 'Login'}
          screenOptions={{
            animation: 'slide_from_right',
            animationDuration: 200,
            gestureEnabled: true,
            gestureDirection: 'horizontal'
          }}
        >
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ headerShown: false }} />
          <Stack.Screen 
            name="SearchResults" 
            component={SearchResultsScreen} 
            options={{ 
              headerShown: false,
              animation: 'slide_from_right',
              animationDuration: 300,
              gestureEnabled: true,
              gestureDirection: 'horizontal'
            }} 
          />
          <Stack.Screen name="Profile" component={ProfileScreen} options={{ headerShown: false }} />
          <Stack.Screen name="IDCard" component={IDCardScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Sync" component={SyncScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Settings" component={SettingsScreen} options={{ headerShown: true, title: 'Sync Settings' }} />
          <Stack.Screen name="OfflineData" component={OfflineDataBrowser} options={{ headerShown: true, title: 'Offline Data' }} />
          <Stack.Screen name="JSONExport" component={JSONExportScreen} options={{ headerShown: true, title: 'Export JSON' }} />
          <Stack.Screen name="Payment" component={PaymentScreen} options={{ headerShown: true, title: 'Subscription Payment' }} />
        </Stack.Navigator>
      )}
      <GlobalSyncOverlay />
      <UpdateNotification
        visible={showUpdateModal}
        onClose={handleUpdateModalClose}
        updateInfo={updateInfo}
      />
      <StatusBar style="light" />
    </NavigationContainer>
  );
}
