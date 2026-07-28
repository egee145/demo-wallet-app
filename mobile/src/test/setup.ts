jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('@react-native-async-storage/async-storage', () => {
  const storage = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn((key: string) => Promise.resolve(storage.get(key) ?? null)),
      setItem: jest.fn((key: string, value: string) => {
        storage.set(key, value);
        return Promise.resolve();
      }),
      removeItem: jest.fn((key: string) => {
        storage.delete(key);
        return Promise.resolve();
      }),
      clear: jest.fn(() => {
        storage.clear();
        return Promise.resolve();
      }),
    },
  };
});

jest.mock('expo-crypto', () => {
  let sequence = 0;
  return {
    randomUUID: jest.fn(() => {
      sequence += 1;
      return `00000000-0000-4000-8000-${sequence.toString().padStart(12, '0')}`;
    }),
  };
});
