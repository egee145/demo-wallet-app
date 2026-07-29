export type NotificationRoute = 'CardManagement' | 'UserHistory';

export function routeFromNotificationData(data: unknown): NotificationRoute | null {
  if (!data || typeof data !== 'object') {
    return null;
  }
  const route = (data as Record<string, unknown>).route;
  return route === 'CardManagement' || route === 'UserHistory' ? route : null;
}
