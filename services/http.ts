import axios from 'axios';

// The local backend defaults to port 5000 (see ../backend/.env.example).
const API_BASE_URL = 'http://localhost:5000/api';

// Log the API base URL in development to help debug
if (__DEV__) {
  console.log('[Muslim Deen: Quran & Prayer HTTP] Base API URL:', API_BASE_URL);
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 12000
});

export const ummahApi = axios.create({
  baseURL: process.env.EXPO_PUBLIC_UMMAH_API_URL || 'https://api.alquran.cloud/v1',
  timeout: 12000
});
