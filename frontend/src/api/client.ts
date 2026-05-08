import axios from 'axios';
import type { Player, StageConfig } from './types';

const TOKEN_KEY = 'wheel-admin-token';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export async function login(username: string, password: string) {
  const { data } = await api.post('/auth/login', { username, password });
  setStoredToken(data.accessToken);
  return data;
}

export async function fetchStages() {
  const { data } = await api.get<StageConfig[]>('/probability/stages');
  return data;
}

export async function saveStages(stages: StageConfig[]) {
  const { data } = await api.put<StageConfig[]>('/probability/stages', { stages });
  return data;
}

export async function fetchPlayerByExternalId(externalId: string) {
  const { data } = await api.get<{ player: Player | null }>('/players', { params: { externalId } });
  return data.player;
}
