const appEnv = process.env.EXPO_PUBLIC_APP_ENV ?? 'development';
const diagnostics = __DEV__ && process.env.EXPO_PUBLIC_ENABLE_NFC_DIAGNOSTICS === 'true';
const requestedProvisionUserId = process.env.EXPO_PUBLIC_NFC_PROVISION_USER_ID;

type MobileEnvironment = {
  readonly appEnv: string;
  readonly apiBaseUrl: string;
  readonly wsBaseUrl: string;
  readonly diagnostics: boolean;
  readonly mockNfc: boolean;
  readonly nfcProvisionUserId?: string;
};

export const env: MobileEnvironment = {
  appEnv,
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://10.0.2.2:3000/api',
  wsBaseUrl: process.env.EXPO_PUBLIC_WS_BASE_URL ?? 'http://10.0.2.2:3000/payments',
  diagnostics,
  mockNfc: __DEV__ && process.env.EXPO_PUBLIC_USE_MOCK_NFC === 'true',
  nfcProvisionUserId:
    __DEV__ && diagnostics && requestedProvisionUserId ? requestedProvisionUserId : undefined,
};

if (
  appEnv === 'production' &&
  (env.diagnostics || env.mockNfc || requestedProvisionUserId !== undefined)
) {
  throw new Error('Production build cannot enable NFC diagnostics, provisioning or mock NFC');
}
