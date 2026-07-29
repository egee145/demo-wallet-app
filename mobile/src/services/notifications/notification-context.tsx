import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type PropsWithChildren,
} from 'react';
import { Alert, AppState, Linking } from 'react-native';
import type { UserNotification } from '../../domain/types';
import { useI18n } from '../../i18n/i18n-context';
import {
  flushNotificationNavigation,
  queueNotificationNavigation,
} from '../../navigation/root-navigation';
import { api } from '../api/api-client';
import { useAuth } from '../auth/auth-context';
import { Notifications, registerPushDevice } from './notification-service';
import { routeFromNotificationData } from './notification-routing';
import { notificationStore } from './notification-store';

type NotificationContextValue = {
  refreshUnread: () => Promise<void>;
};

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

export function NotificationProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const { language, t } = useI18n();
  const presented = useRef(new Set<string>());
  const permissionAlertShown = useRef(false);

  const dismiss = useCallback(
    async (notificationId: string) => {
      if (!user) {
        return;
      }
      await notificationStore.markDismissed(user.id, notificationId);
      try {
        await api.post(`/notifications/${notificationId}/dismiss`);
      } catch {
        // Local dismissal prevents repeated prompts while the backend is temporarily unreachable.
      } finally {
        presented.current.delete(notificationId);
      }
    },
    [user],
  );

  const refreshUnread = useCallback(async () => {
    if (!user || user.role !== 'USER') {
      return;
    }
    try {
      const response = await api.get<{ items: UserNotification[] }>('/notifications/unread');
      const dismissed = new Set(await notificationStore.dismissedIds(user.id));
      const notification = response.data.items.find(
        (item) =>
          item.type === 'NFC_CARD_TRANSFERRED' &&
          !dismissed.has(item.id) &&
          !presented.current.has(item.id),
      );
      if (!notification) {
        return;
      }
      presented.current.add(notification.id);
      Alert.alert(
        t('notifications.cardTransferredTitle'),
        t('notifications.cardTransferredBody'),
        [
          {
            text: t('common.done'),
            onPress: () => {
              void dismiss(notification.id);
            },
          },
        ],
        { cancelable: false },
      );
    } catch {
      // A durable server record lets the app retry on the next foreground event.
    }
  }, [dismiss, t, user]);

  useEffect(() => {
    if (!user || user.role !== 'USER') {
      presented.current.clear();
      return;
    }
    void registerPushDevice(language)
      .then((result) => {
        if (result === 'permission-denied' && !permissionAlertShown.current) {
          permissionAlertShown.current = true;
          Alert.alert(t('notifications.permissionTitle'), t('notifications.permissionBody'), [
            { text: t('common.cancel'), style: 'cancel' },
            {
              text: t('payment.openAppSettings'),
              onPress: () => {
                void Linking.openSettings();
              },
            },
          ]);
        }
      })
      .catch(() => {
        // Registration is retried on the next authenticated launch/foreground.
      });
    void refreshUnread();
    const timer = setTimeout(() => flushNotificationNavigation(user.role), 0);
    return () => clearTimeout(timer);
  }, [language, refreshUnread, t, user]);

  useEffect(() => {
    const received = Notifications.addNotificationReceivedListener(() => {
      void refreshUnread();
    });
    const response = Notifications.addNotificationResponseReceivedListener((event) => {
      const route = routeFromNotificationData(event.notification.request.content.data);
      if (route) {
        queueNotificationNavigation(route);
        if (user) {
          flushNotificationNavigation(user.role);
        }
      }
    });
    void Notifications.getLastNotificationResponseAsync().then((event) => {
      const route = routeFromNotificationData(event?.notification.request.content.data);
      if (route) {
        queueNotificationNavigation(route);
        if (user) {
          flushNotificationNavigation(user.role);
        }
      }
    });
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void refreshUnread();
      }
    });
    return () => {
      received.remove();
      response.remove();
      appState.remove();
    };
  }, [refreshUnread, user]);

  const value = useMemo(() => ({ refreshUnread }), [refreshUnread]);
  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications(): NotificationContextValue {
  const value = useContext(NotificationContext);
  if (!value) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return value;
}
