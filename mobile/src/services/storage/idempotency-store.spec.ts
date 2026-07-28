import AsyncStorage from '@react-native-async-storage/async-storage';
import { idempotencyStore } from './idempotency-store';

describe('idempotencyStore', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('reuses the same key while an operation is pending', async () => {
    const first = await idempotencyStore.getOrCreate('payment:qr:session-a');
    const retry = await idempotencyStore.getOrCreate('payment:qr:session-a');

    expect(retry).toBe(first);
  });

  it('creates a new key only after the terminal result clears the operation', async () => {
    const first = await idempotencyStore.getOrCreate('payment:nfc:session-a:user-a');
    await idempotencyStore.clear('payment:nfc:session-a:user-a');
    const next = await idempotencyStore.getOrCreate('payment:nfc:session-a:user-a');

    expect(next).not.toBe(first);
  });
});
