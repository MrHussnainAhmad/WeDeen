import { api } from './http';
import type { AuthResponse } from '@/types';

export async function register(payload: { name: string; email: string; password: string; confirmPassword: string }) {
  const { data } = await api.post<AuthResponse>('/auth/register', payload);
  return data;
}

export async function login(payload: { email: string; password: string }) {
  const { data } = await api.post<AuthResponse>('/auth/login', payload);
  return data;
}

export async function me(token: string) {
  const { data } = await api.get<{ user: AuthResponse['user'] }>('/auth/me', {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
}

export async function forgotPassword(payload: { email: string }) {
  const { data } = await api.post<{ success: boolean; message: string }>('/auth/forgot-password', payload);
  return data;
}

export async function updatePassword(token: string, payload: { currentPassword: string; newPassword: string; confirmPassword: string }) {
  const { data } = await api.put<{ success: boolean }>('/auth/password', payload, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
}

export async function deleteAccount(token: string) {
  const { data } = await api.delete<{ success: boolean }>('/auth/account', {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
}
