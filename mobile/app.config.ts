import type { ExpoConfig } from 'expo/config';

const isProduction = process.env.EXPO_PUBLIC_APP_ENV === 'production';
const diagnostics = process.env.EXPO_PUBLIC_ENABLE_NFC_DIAGNOSTICS === 'true';
const mockNfc = process.env.EXPO_PUBLIC_USE_MOCK_NFC === 'true';
const provisioningUserId = process.env.EXPO_PUBLIC_NFC_PROVISION_USER_ID;
const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
const wsBaseUrl = process.env.EXPO_PUBLIC_WS_BASE_URL;
const easProjectId =
  process.env.EXPO_PUBLIC_EAS_PROJECT_ID ?? 'b70b8bd2-7d34-4f2f-8460-9206c5c5f5ac';

if (isProduction && (diagnostics || mockNfc || provisioningUserId)) {
  throw new Error('NFC diagnostics, provisioning and mock NFC must be disabled in production');
}

if (isProduction && (!apiBaseUrl?.startsWith('https://') || !wsBaseUrl?.startsWith('https://'))) {
  throw new Error('Production API and WebSocket URLs must use HTTPS');
}

const config: ExpoConfig = {
  name: 'HepAntalya',
  slug: 'hepantalya-wallet',
  owner: 'egee72',
  version: '1.2.2',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  newArchEnabled: true,
  scheme: 'hepantalya',
  icon: './assets/hepantalya-icon.png',
  plugins: [
    [
      'expo-build-properties',
      {
        android: {
          usesCleartextTraffic: !isProduction,
        },
      },
    ],
    'expo-dev-client',
    'expo-secure-store',
    [
      'expo-notifications',
      {
        color: '#00695C',
        defaultChannel: 'wallet-events',
      },
    ],
    [
      'expo-camera',
      {
        cameraPermission: 'Ödeme QR kodunu taramak için kamera erişimi gereklidir.',
        barcodeScannerEnabled: true,
      },
    ],
    'react-native-nfc-manager',
  ],
  android: {
    package: 'com.hepantalya.wallet',
    versionCode: 5,
    googleServicesFile: './google-services.json',
    permissions: [
      'android.permission.NFC',
      'android.permission.CAMERA',
      'android.permission.POST_NOTIFICATIONS',
    ],
    adaptiveIcon: {
      foregroundImage: './assets/hepantalya-icon.png',
      backgroundColor: '#00695C',
    },
  },
  ios: {
    bundleIdentifier: 'com.hepantalya.wallet',
    supportsTablet: false,
  },
  extra: {
    appEnv: process.env.EXPO_PUBLIC_APP_ENV ?? 'development',
    eas: easProjectId ? { projectId: easProjectId } : undefined,
  },
};

export default config;
