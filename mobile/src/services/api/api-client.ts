import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { env } from '../../config/env';
import type { TokenResponse } from '../../domain/types';
import { accessTokenExpiresWithin } from '../auth/access-token';
import { tokenStore } from '../storage/token-store';

const ACCESS_TOKEN_REFRESH_WINDOW_SECONDS = 30;
let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;
let authFailure: (() => void) | undefined;

export const api = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

export function configureApiAuth(options: {
  token?: string | null;
  onAuthFailure?: () => void;
}): void {
  accessToken = options.token ?? null;
  authFailure = options.onAuthFailure;
}

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  if (accessToken && accessTokenExpiresWithin(accessToken, ACCESS_TOKEN_REFRESH_WINDOW_SECONDS)) {
    const nextAccess = await refreshAccessTokenSingleFlight();
    if (!nextAccess) {
      authFailure?.();
      throw new AxiosError('Access token refresh failed.', 'AUTH_REFRESH_FAILED', config);
    }
  }
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as
      | (InternalAxiosRequestConfig & { _refreshed?: boolean })
      | undefined;
    if (error.response?.status !== 401 || !config || config._refreshed) {
      throw error;
    }

    config._refreshed = true;
    const nextAccess = await refreshAccessTokenSingleFlight();
    if (!nextAccess) {
      authFailure?.();
      throw error;
    }
    config.headers.Authorization = `Bearer ${nextAccess}`;
    return api.request(config);
  },
);

function refreshAccessTokenSingleFlight(): Promise<string | null> {
  refreshPromise ??= refreshAccessToken().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

async function refreshAccessToken(): Promise<string | null> {
  const stored = await tokenStore.load();
  if (!stored) {
    return null;
  }
  try {
    const response = await axios.post<TokenResponse>(
      `${env.apiBaseUrl}/auth/refresh`,
      { refreshToken: stored.refreshToken },
      { timeout: 10000 },
    );
    await tokenStore.save(response.data);
    accessToken = response.data.accessToken;
    return response.data.accessToken;
  } catch {
    await tokenStore.clear();
    accessToken = null;
    return null;
  }
}

export function apiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string; code?: string } | undefined;
    if (data?.message) {
      return data.message;
    }
    if (error.code === 'ECONNABORTED') {
      return 'Sunucu yanıt vermedi. Aynı işlem anahtarıyla tekrar deneyebilirsiniz.';
    }
    if (!error.response) {
      return 'Sunucuya ulaşılamıyor. Ağ bağlantısını ve API adresini kontrol edin.';
    }
  }
  return 'Beklenmeyen bir hata oluştu.';
}

export function apiErrorCode(error: unknown): string | undefined {
  if (!axios.isAxiosError(error)) {
    return undefined;
  }
  const data = error.response?.data as { code?: string } | undefined;
  if (data?.code) {
    return data.code;
  }
  if (error.code === 'ECONNABORTED') {
    return 'TIMEOUT';
  }
  if (!error.response) {
    return 'NETWORK';
  }
  return undefined;
}
