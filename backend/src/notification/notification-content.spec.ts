import { NotificationType } from '../generated/prisma/client.js';
import { buildPushContent } from './notification-content.js';

describe('notification push content', () => {
  it('builds the Turkish card-transfer warning without balance data', () => {
    expect(buildPushContent(NotificationType.NFC_CARD_TRANSFERRED, {}, 'tr')).toEqual({
      title: 'NFC kartınız devredildi',
      body: 'Kartınız başka bir hesaba tanımlandı. Cüzdan bakiyeniz değişmedi.',
      route: 'CardManagement',
      data: {},
    });
  });

  it('builds a localized NFC payment message and history route', () => {
    expect(
      buildPushContent(
        NotificationType.NFC_PAYMENT_COMPLETED,
        { amount: '50.25', transactionId: 'transaction-id' },
        'tr',
      ),
    ).toEqual({
      title: 'Kart işlemi',
      body: 'Kartınızdan 50,25 TL işlem yapıldı.',
      route: 'UserHistory',
      data: { transactionId: 'transaction-id' },
    });
  });

  it('does not interpolate untrusted non-string notification values', () => {
    const content = buildPushContent(
      NotificationType.NFC_PAYMENT_COMPLETED,
      { amount: { value: '50.00' } },
      'en',
    );
    expect(content.body).toBe('A TRY 0.00 payment was made with your card.');
    expect(content.data).toEqual({});
  });
});
