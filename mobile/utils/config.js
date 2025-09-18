import { Platform } from 'react-native';
import Constants from 'expo-constants';

export const getBaseURL = () => {
  const envUrl = process.env.EXPO_PUBLIC_API_URL || process.env.API_URL;
  if (envUrl) return envUrl.replace(/\/$/, '');

  if (Platform.OS === 'web') return 'http://localhost:5000';

  const hostUri =
    Constants?.expoConfig?.hostUri ||
    Constants?.manifest2?.extra?.expoGo?.debuggerHost ||
    Constants?.manifest?.debuggerHost || '';
  const host = String(hostUri).split(':')[0];
  const isIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(host);
  if (isIp) return `http://${host}:5000`;

  if (Platform.OS === 'android') return 'http://192.168.1.34:5000';
  return 'http://192.168.1.34:5000';
};








