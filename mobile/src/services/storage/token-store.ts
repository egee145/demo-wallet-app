import * as SecureStore from 'expo-secure-store';
import type { TokenResponse } from '../../domain/types';

const ACCESS_TOKEN = 'hepantalya.access-token';
const REFRESH_TOKEN = 'hepantalya.refresh-token';
const USER = 'hepantalya.user';

export const tokenStore = {
  async save(tokens: TokenResponse): Promise<void> {
    await Promise.all([
      SecureStore.setItemAsync(ACCESS_TOKEN, tokens.accessToken),
      SecureStore.setItemAsync(REFRESH_TOKEN, tokens.refreshToken),
      SecureStore.setItemAsync(USER, JSON.stringify(tokens.user)),
    ]);
  },

  async load(): Promise<TokenResponse | null> {
    const [accessToken, refreshToken, user] = await Promise.all([
      SecureStore.getItemAsync(ACCESS_TOKEN),
      SecureStore.getItemAsync(REFRESH_TOKEN),
      SecureStore.getItemAsync(USER),
    ]);
    if (!accessToken || !refreshToken || !user) {
      return null;
    }
    return {
      accessToken,
      refreshToken,
      user: JSON.parse(user) as TokenResponse['user'],
    };
  },

  async clear(): Promise<void> {
    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS_TOKEN),
      SecureStore.deleteItemAsync(REFRESH_TOKEN),
      SecureStore.deleteItemAsync(USER),
    ]);
  },
};
