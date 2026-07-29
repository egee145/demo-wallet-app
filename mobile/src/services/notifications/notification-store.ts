import AsyncStorage from '@react-native-async-storage/async-storage';

const PUSH_TOKEN_KEY = '@hepantalya/push-token';
const DISMISSED_PREFIX = '@hepantalya/dismissed-notifications/';

export const notificationStore = {
  loadPushToken(): Promise<string | null> {
    return AsyncStorage.getItem(PUSH_TOKEN_KEY);
  },

  savePushToken(token: string): Promise<void> {
    return AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
  },

  clearPushToken(): Promise<void> {
    return AsyncStorage.removeItem(PUSH_TOKEN_KEY);
  },

  async isDismissed(userId: string, notificationId: string): Promise<boolean> {
    const values = await this.dismissedIds(userId);
    return values.includes(notificationId);
  },

  async markDismissed(userId: string, notificationId: string): Promise<void> {
    const values = await this.dismissedIds(userId);
    if (!values.includes(notificationId)) {
      values.push(notificationId);
    }
    await AsyncStorage.setItem(`${DISMISSED_PREFIX}${userId}`, JSON.stringify(values.slice(-100)));
  },

  async dismissedIds(userId: string): Promise<string[]> {
    const value = await AsyncStorage.getItem(`${DISMISSED_PREFIX}${userId}`);
    if (!value) {
      return [];
    }
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === 'string')
        : [];
    } catch {
      return [];
    }
  },
};
