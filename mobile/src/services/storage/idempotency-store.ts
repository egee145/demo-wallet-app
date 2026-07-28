import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

const PREFIX = 'hepantalya.idempotency.';

export const idempotencyStore = {
  async getOrCreate(operation: string): Promise<string> {
    const storageKey = `${PREFIX}${operation}`;
    const existing = await AsyncStorage.getItem(storageKey);
    if (existing) {
      return existing;
    }
    const key = Crypto.randomUUID();
    await AsyncStorage.setItem(storageKey, key);
    return key;
  },

  async clear(operation: string): Promise<void> {
    await AsyncStorage.removeItem(`${PREFIX}${operation}`);
  },
};
