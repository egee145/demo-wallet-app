import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import type { Language } from '../../i18n/translations';
import { api } from '../api/api-client';
import { notificationStore } from './notification-store';

Notifications.setNotificationHandler({
  handleNotification: () =>
    Promise.resolve({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
});

export type PushRegistrationResult =
  | 'registered'
  | 'permission-denied'
  | 'project-not-configured'
  | 'unsupported';

function expoProjectId(): string | undefined {
  const configured = Constants.expoConfig?.extra?.eas;
  if (configured && typeof configured === 'object' && 'projectId' in configured) {
    const projectId = (configured as { projectId?: unknown }).projectId;
    if (typeof projectId === 'string' && projectId) {
      return projectId;
    }
  }
  return Constants.easConfig?.projectId;
}

export async function registerPushDevice(language: Language): Promise<PushRegistrationResult> {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
    return 'unsupported';
  }
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('wallet-events', {
      name: language === 'tr' ? 'Cüzdan hareketleri' : 'Wallet activity',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 180, 250],
      lightColor: '#00695C',
      sound: 'default',
    });
  }

  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) {
    permission = await Notifications.requestPermissionsAsync();
  }
  if (!permission.granted) {
    return 'permission-denied';
  }

  const projectId = expoProjectId();
  if (!projectId) {
    return 'project-not-configured';
  }

  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  await api.post('/notifications/devices', {
    expoPushToken: token,
    platform: Platform.OS === 'android' ? 'ANDROID' : 'IOS',
    language,
  });
  await notificationStore.savePushToken(token);
  return 'registered';
}

export async function deactivatePushDevice(): Promise<void> {
  const token = await notificationStore.loadPushToken();
  if (!token) {
    return;
  }
  try {
    await api.delete('/notifications/devices', { data: { expoPushToken: token } });
  } finally {
    await notificationStore.clearPushToken();
  }
}

export { Notifications };
