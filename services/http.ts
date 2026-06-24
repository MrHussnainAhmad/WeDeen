import axios from 'axios';

const DEPLOYED_API_BASE_URL = 'https://wedeen-backend.vercel.app/api';

const getApiBaseUrl = () => {
  const configuredUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  return configuredUrl || DEPLOYED_API_BASE_URL;
};

const API_BASE_URL = getApiBaseUrl();

// Log the API base URL in development to help debug
if (__DEV__) {
  console.log('[WeDeen HTTP] Base API URL:', API_BASE_URL);
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 12000
});

export const ummahApi = axios.create({
  baseURL: process.env.EXPO_PUBLIC_UMMAH_API_URL || 'https://api.alquran.cloud/v1',
  timeout: 12000
});
