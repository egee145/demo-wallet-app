import { NotificationType } from '../generated/prisma/client.js';

export type NotificationLanguage = 'tr' | 'en';

export type PushContent = {
  title: string;
  body: string;
  route: 'CardManagement' | 'UserHistory';
  data: Record<string, string>;
};

function stringValue(data: unknown, key: string): string | undefined {
  if (!data || typeof data !== 'object') {
    return undefined;
  }
  const value = (data as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : undefined;
}

function formatTry(value: string, language: NotificationLanguage): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return value;
  }
  return new Intl.NumberFormat(language === 'tr' ? 'tr-TR' : 'en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function buildPushContent(
  type: NotificationType,
  data: unknown,
  language: NotificationLanguage,
): PushContent {
  if (type === NotificationType.NFC_CARD_TRANSFERRED) {
    return language === 'tr'
      ? {
          title: 'NFC kartınız devredildi',
          body: 'Kartınız başka bir hesaba tanımlandı. Cüzdan bakiyeniz değişmedi.',
          route: 'CardManagement',
          data: {},
        }
      : {
          title: 'Your NFC card was transferred',
          body: 'Your card was linked to another account. Your wallet balance did not change.',
          route: 'CardManagement',
          data: {},
        };
  }

  const amount = stringValue(data, 'amount') ?? '0.00';
  const transactionId = stringValue(data, 'transactionId');
  return {
    title: language === 'tr' ? 'Kart işlemi' : 'Card payment',
    body:
      language === 'tr'
        ? `Kartınızdan ${formatTry(amount, language)} TL işlem yapıldı.`
        : `A TRY ${formatTry(amount, language)} payment was made with your card.`,
    route: 'UserHistory',
    data: transactionId ? { transactionId } : {},
  };
}
