import { routeFromNotificationData } from './notification-routing';

describe('notification routing', () => {
  it('accepts only the two application-owned notification routes', () => {
    expect(routeFromNotificationData({ route: 'UserHistory' })).toBe('UserHistory');
    expect(routeFromNotificationData({ route: 'CardManagement' })).toBe('CardManagement');
    expect(routeFromNotificationData({ route: 'MerchantHistory' })).toBeNull();
    expect(routeFromNotificationData('UserHistory')).toBeNull();
  });
});
