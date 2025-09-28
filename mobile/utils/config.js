import { Platform } from 'react-native';
import Constants from 'expo-constants';

export const getBaseURL = () => {
  // Check for environment variable first
  const envUrl = process.env.EXPO_PUBLIC_API_URL || process.env.API_URL;
  if (envUrl) {
    console.log('Using environment URL:', envUrl);
    return envUrl.replace(/\/$/, '');
  }

  // Check app.json extra config
  const appConfigUrl = Constants?.expoConfig?.extra?.apiUrl;
  if (appConfigUrl) {
    console.log('Using app.json API URL:', appConfigUrl);
    return appConfigUrl.replace(/\/$/, '');
  }

  // For web platform
  if (Platform.OS === 'web') {
    console.log('Using web platform URL');
    return 'https://api.rapidbuddy.cloud';
  }

  // For development, try to get the host from Expo's debugger host
  const hostUri =
    Constants?.expoConfig?.hostUri ||
    Constants?.manifest2?.extra?.expoGo?.debuggerHost ||
    Constants?.manifest?.debuggerHost || '';
  
  if (hostUri) {
    const host = String(hostUri).split(':')[0];
    const isIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(host);
    console.log('Development host detected:', host, 'isIP:', isIp);
    
    // For development, use VPS URL
    if (isIp) {
      console.log('Using VPS URL for development');
      return 'https://api.rapidbuddy.cloud';
    }
  }

  // Default production API URL
  console.log('Using default production URL');
  return 'https://api.rapidbuddy.cloud';
};








