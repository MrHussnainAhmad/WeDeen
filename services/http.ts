import axios from 'axios';
import Constants from 'expo-constants';

const DEPLOYED_BACKEND_ROOT =
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  'https://wedeen-backend-i3s4ch1ht-mrhussnainahmads-projects.vercel.app';
const DEPLOYED_API_BASE = DEPLOYED_BACKEND_ROOT.replace(/\/+$/, '').replace(/\/api$/, '') + '/api';

function resolveLocalCandidates() {
  const hostUri = Constants.expoConfig?.hostUri ?? Constants.manifest2?.extra?.expoClient?.hostUri;
  const host = hostUri?.split(':')?.[0];
  const candidates: string[] = [];
  if (host) candidates.push(`http://${host}:5000`);
  candidates.push('http://localhost:5000');
  candidates.push('http://10.0.2.2:5000');
  return candidates;
}

export const api = axios.create({
  // Temporary default; request interceptor resolves final base URL.
  baseURL: DEPLOYED_API_BASE,
  timeout: 12000
});

let resolvedApiBasePromise: Promise<string> | null = null;

async function canReach(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1200);
  try {
    const res = await fetch(`${url}/health`, { method: 'GET', signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function resolveApiBaseUrl() {
  if (!__DEV__) {
    return DEPLOYED_API_BASE;
  }
  const localCandidates = resolveLocalCandidates();
  for (const candidate of localCandidates) {
    // Prefer localhost:5000 when available.
    if (await canReach(candidate)) {
      return `${candidate}/api`;
    }
  }
  return DEPLOYED_API_BASE;
}

api.interceptors.request.use(async (config) => {
  if (!resolvedApiBasePromise) {
    resolvedApiBasePromise = resolveApiBaseUrl();
  }
  const baseURL = await resolvedApiBasePromise;
  config.baseURL = baseURL;
  return config;
});

export const ummahApi = axios.create({
  baseURL: process.env.EXPO_PUBLIC_UMMAH_API_URL || 'https://api.alquran.cloud/v1',
  timeout: 12000
});
