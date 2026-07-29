import { notificationStore } from './notification-store';

describe('notification store', () => {
  it('persists a dismissal once and never returns duplicates', async () => {
    const userId = 'user-notification-test';
    await notificationStore.markDismissed(userId, 'notification-1');
    await notificationStore.markDismissed(userId, 'notification-1');

    expect(await notificationStore.isDismissed(userId, 'notification-1')).toBe(true);
    expect(await notificationStore.dismissedIds(userId)).toEqual(['notification-1']);
  });

  it('stores and clears the current Expo push token', async () => {
    await notificationStore.savePushToken('ExpoPushToken[test-token]');
    expect(await notificationStore.loadPushToken()).toBe('ExpoPushToken[test-token]');
    await notificationStore.clearPushToken();
    expect(await notificationStore.loadPushToken()).toBeNull();
  });
});
