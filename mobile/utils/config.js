import { Platform } from 'react-native';
import Constants from 'expo-constants';

export const getBaseURL = () => {
  const envUrl = process.env.EXPO_PUBLIC_API_URL || process.env.API_URL;
  if (envUrl) return envUrl.replace(/\/$/, '');

  if (Platform.OS === 'web') return 'https://api.rapidbuddy.cloud';

  // Try to get the host from Expo's debugger host
  const hostUri =
    Constants?.expoConfig?.hostUri ||
    Constants?.manifest2?.extra?.expoGo?.debuggerHost ||
    Constants?.manifest?.debuggerHost || '';
  
  if (hostUri) {
    const host = String(hostUri).split(':')[0];
    const isIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(host);
    if (isIp) return `https://api.rapidbuddy.cloud`;
  }

  // Production API URL
  return 'https://api.rapidbuddy.cloud';
};








