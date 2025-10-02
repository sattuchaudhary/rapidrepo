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
import GlobalSyncOverlay from './components/GlobalSyncOverlay';
import UpdateNotification from './components/UpdateNotification';
import versionManager from './utils/versionManager';
import { startSmartBackgroundSync } from './utils/smartBackgroundSync';

const Stack = createNativeStackNavigator();

export default function App() {
  const [isBootstrapping, setIsBootstrapping] = useState(true);
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
        const token = await SecureStore.getItemAsync('token');
        setIsLoggedIn(!!token);
      } finally {
        setIsBootstrapping(false);
        SplashScreen.hideAsync().catch(() => {});
      }
    })();
  }, []);

  // App usage session tracking
  useEffect(() => {
    let isActive = true;

    const startSession = async () => {
      try {
        const token = await SecureStore.getItemAsync('token');
        if (!token) return;
        const res = await axios.post(`${getBaseURL()}/api/history/usage/start`, {
          platform: 'mobile',
          metadata: { appState: appState.current }
        }, { headers: { Authorization: `Bearer ${token}` } });
        sessionIdRef.current = res.data?.data?.sessionId || null;
        startedAtRef.current = Date.now();
      } catch (_) {}
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

    // On mount, start session if logged in
    if (isLoggedIn) {
      startSession();
    }

    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      isActive = false;
      sub && sub.remove && sub.remove();
      // End any ongoing session
      endSession();
    };
  }, [isLoggedIn]);

  // Check for updates when app starts or user logs in
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

    // Check for updates after a short delay to allow app to fully load
    const timer = setTimeout(checkForUpdates, 2000);
    return () => clearTimeout(timer);
  }, [isLoggedIn]);

  // Start smart background sync when user logs in
  useEffect(() => {
    if (isLoggedIn) {
      console.log('🚀 Starting smart background sync...');
      startSmartBackgroundSync();
    }
  }, [isLoggedIn]);

  const handleUpdateModalClose = () => {
    setShowUpdateModal(false);
    setUpdateInfo(null);
  };

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
