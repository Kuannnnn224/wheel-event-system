import axios from 'axios';
import type { AwardOverrideRule, Player, ProbabilityConfig, ProbabilityImportPreview, ProbabilityImportUpload, StageConfig } from './types';

const TOKEN_KEY = 'wheel-admin-token';

interface ApiErrorPayload {
  message?: string | string[];
  error?: string;
}

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

export function getApiErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError<ApiErrorPayload>(error)) {
    if (!error.response) {
      return error.message || fallback;
    }

    const responseMessage = error.response.data?.message;

    if (Array.isArray(responseMessage) && responseMessage.length > 0) {
      return responseMessage.join('、');
    }

    if (typeof responseMessage === 'string' && responseMessage.trim()) {
      return responseMessage;
    }

    if (typeof error.response.data?.error === 'string' && error.response.data.error.trim()) {
      return error.response.data.error;
    }

    return fallback;
  }

  return error instanceof Error ? error.message : fallback;
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

export async function fetchProbabilityConfig() {
  const { data } = await api.get<ProbabilityConfig>('/probability/config');
  return data;
}

export async function previewProbabilityImport(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post<ProbabilityImportPreview>('/probability/imports/preview', formData);
  return data;
}

export async function applyProbabilityImport(uploadId: string) {
  const { data } = await api.post<{
    upload: ProbabilityImportUpload;
    diff: ProbabilityImportPreview['diff'];
    dailyPayoutLimitPoints: number;
    stages: StageConfig[];
  }>(
    '/probability/imports/apply',
    { uploadId },
  );
  return data;
}

export async function fetchProbabilityImports() {
  const { data } = await api.get<ProbabilityImportUpload[]>('/probability/imports');
  return data;
}

export async function downloadProbabilityImport(upload: ProbabilityImportUpload) {
  const { data } = await api.post<{ downloadUrl: string }>(`/probability/imports/${upload.id}/download-token`);
  const url = new URL(data.downloadUrl, api.defaults.baseURL).toString();
  const link = document.createElement('a');
  link.href = url;
  link.download = upload.originalFilename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export async function fetchPlayerByExternalId(externalId: string) {
  const { data } = await api.get<{ player: Player | null }>('/players', { params: { externalId } });
  return data.player;
}

export async function fetchAwardOverrides(externalId?: string) {
  const { data } = await api.get<{ rules: AwardOverrideRule[] }>('/award-overrides', {
    params: { externalId: externalId || undefined },
  });
  return data.rules;
}

export async function createAwardOverrides(values: { externalId: string; stageNumbers: number[]; reason?: string }) {
  const { data } = await api.post<{ rules: AwardOverrideRule[] }>('/award-overrides', values);
  return data.rules;
}

export async function cancelAwardOverride(id: string) {
  const { data } = await api.patch<{ rule: AwardOverrideRule }>(`/award-overrides/${id}/cancel`);
  return data.rule;
}
