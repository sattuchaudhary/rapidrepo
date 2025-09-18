import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as SecureStore from 'expo-secure-store';
import LoginScreen from './screens/LoginScreen';
import DashboardScreen from './screens/DashboardScreen';
import SearchResultsScreen from './screens/SearchResultsScreen';
import ProfileScreen from './screens/ProfileScreen';
import IDCardScreen from './screens/IDCardScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
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
  return (
    <NavigationContainer>
      {!isBootstrapping && (
        <Stack.Navigator initialRouteName={isLoggedIn ? 'Dashboard' : 'Login'}>
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ headerShown: false }} />
          <Stack.Screen name="SearchResults" component={SearchResultsScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Profile" component={ProfileScreen} options={{ headerShown: false }} />
          <Stack.Screen name="IDCard" component={IDCardScreen} options={{ headerShown: false }} />
        </Stack.Navigator>
      )}
      <StatusBar style="auto" />
    </NavigationContainer>
  );
}
