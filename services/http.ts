import axios from 'axios';
import Constants from 'expo-constants';

function resolveBackendUrl() {
  if (process.env.EXPO_PUBLIC_BACKEND_URL) {
    return process.env.EXPO_PUBLIC_BACKEND_URL;
  }

  const hostUri = Constants.expoConfig?.hostUri ?? Constants.manifest2?.extra?.expoClient?.hostUri;
  const host = hostUri?.split(':')?.[0];
  if (host) {
    return `http://${host}:5000/api`;
  }

  // Android emulator fallback.
  return 'http://10.0.2.2:5000/api';
}

export const api = axios.create({
  baseURL: resolveBackendUrl(),
  timeout: 12000
});

export const ummahApi = axios.create({
  baseURL: process.env.EXPO_PUBLIC_UMMAH_API_URL || 'https://api.alquran.cloud/v1',
  timeout: 12000
});
