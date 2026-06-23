import axios from 'axios';

const DEPLOYED_API_BASE =
  'https://wedeen-backend-i3s4ch1ht-mrhussnainahmads-projects.vercel.app/api';

export const api = axios.create({
  baseURL: DEPLOYED_API_BASE,
  timeout: 12000
});

export const ummahApi = axios.create({
  baseURL: process.env.EXPO_PUBLIC_UMMAH_API_URL || 'https://api.alquran.cloud/v1',
  timeout: 12000
});
