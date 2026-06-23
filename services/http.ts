import axios from 'axios';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

const getLocalBaseUrl = () => {
  // If explicitly overridden via environment variable, always honor that.
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // Detect the IP address of the computer running Metro.
  // Constants.expoConfig?.hostUri is present when running in Expo Go or development builds.
  // E.g. "192.168.1.10:8081"
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    if (ip && !ip.startsWith('localhost') && !ip.startsWith('127.0.0.1')) {
      return `http://${ip}:5000/api`;
    }
  }

  // Fallbacks if hostUri is not available:
  // - Android emulator uses 10.0.2.2 to access the host machine's localhost.
  // - iOS simulator or web browser uses localhost directly.
  return Platform.OS === 'android' ? 'http://10.0.2.2:5000/api' : 'http://localhost:5000/api';
};

const LOCAL_API_BASE = getLocalBaseUrl();

// Log the API base URL in development to help debug
if (__DEV__) {
  console.log('[WeDeen HTTP] Base API URL:', LOCAL_API_BASE);
}

export const api = axios.create({
  baseURL: LOCAL_API_BASE,
  timeout: 12000
});

export const ummahApi = axios.create({
  baseURL: process.env.EXPO_PUBLIC_UMMAH_API_URL || 'https://api.alquran.cloud/v1',
  timeout: 12000
});
