import { StatusBar } from 'expo-status-bar';
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
import SyncScreen from './screens/SyncScreen';
import OfflineDataBrowser from './screens/OfflineDataBrowser';
import GlobalSyncOverlay from './components/GlobalSyncOverlay';
import JSONExportScreen from './screens/JSONExportScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const appState = useRef(AppState.currentState);
  const sessionIdRef = useRef(null);
  const startedAtRef = useRef(null);
  useEffect(() => {
    (async () => {
      try {
        const token = await SecureStore.getItemAsync('token');
        setIsLoggedIn(!!token);
      } finally {
        setIsBootstrapping(false);
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
  return (
    <NavigationContainer>
      {!isBootstrapping && (
        <Stack.Navigator initialRouteName={isLoggedIn ? 'Dashboard' : 'Login'}>
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ headerShown: false }} />
          <Stack.Screen name="SearchResults" component={SearchResultsScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Profile" component={ProfileScreen} options={{ headerShown: false }} />
          <Stack.Screen name="IDCard" component={IDCardScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Sync" component={SyncScreen} options={{ headerShown: false }} />
          <Stack.Screen name="OfflineData" component={OfflineDataBrowser} options={{ headerShown: true, title: 'Offline Data' }} />
          <Stack.Screen name="JSONExport" component={JSONExportScreen} options={{ headerShown: true, title: 'Export JSON' }} />
        </Stack.Navigator>
      )}
      <GlobalSyncOverlay />
      <StatusBar style="auto" />
    </NavigationContainer>
  );
}
