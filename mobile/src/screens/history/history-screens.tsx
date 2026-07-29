import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Card, Screen, SectionTitle, Title } from '../../components/screen';
import { Button, Loading, Pill } from '../../components/ui';
import { localizedApiError } from '../../i18n/api-error';
import { useI18n } from '../../i18n/i18n-context';
import { api } from '../../services/api/api-client';
import { colors, radius, spacing } from '../../theme';

type HistoryItem = {
  id: string;
  direction: 'IN' | 'OUT';
  amount: number;
  currency: 'TRY';
  paymentMethod: 'NFC' | 'QR';
  createdAt: string;
};

type HistoryPage = {
  items: HistoryItem[];
  nextCursor: string | null;
};

type TopUpItem = {
  id: string;
  amount: number;
  currency: 'TRY';
  maskedCard: string;
  status: 'COMPLETED';
  createdAt: string;
};

function HistoryScreen({
  endpoint,
  titleKey,
  includeTopUps = false,
}: {
  endpoint: string;
  titleKey: string;
  includeTopUps?: boolean;
}) {
  const { language, t } = useI18n();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [topUps, setTopUps] = useState<TopUpItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (next?: string) => {
      setLoading(true);
      setError('');
      try {
        const historyRequest = api
          .get<HistoryPage>(endpoint, {
            params: { limit: 20, ...(next ? { cursor: next } : {}) },
          })
          .then((response) => {
            setItems((current) =>
              next ? [...current, ...response.data.items] : response.data.items,
            );
            setCursor(response.data.nextCursor);
          });
        const topUpRequest =
          includeTopUps && !next
            ? api
                .get<{ items: TopUpItem[] }>('/wallet/top-ups')
                .then((response) => setTopUps(response.data.items))
            : Promise.resolve();
        const results = await Promise.allSettled([historyRequest, topUpRequest]);
        const failure = results.find((result) => result.status === 'rejected');
        if (failure?.status === 'rejected') {
          throw failure.reason;
        }
      } catch (caught) {
        setError(localizedApiError(caught, t));
      } finally {
        setLoading(false);
      }
    },
    [endpoint, includeTopUps, t],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const formatDate = (value: string) =>
    new Intl.DateTimeFormat(language === 'tr' ? 'tr-TR' : 'en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));

  return (
    <Screen scroll>
      <Title>{t(titleKey)}</Title>
      {includeTopUps && topUps.length > 0 ? (
        <>
          <SectionTitle>{t('history.topUps')}</SectionTitle>
          {topUps.map((item) => (
            <Card key={item.id} style={styles.item}>
              <View style={[styles.icon, styles.topUpIcon]}>
                <Ionicons color={colors.success} name="add" size={22} />
              </View>
              <View style={styles.itemText}>
                <Text style={styles.amountIn}>
                  +{item.amount.toFixed(2)} {item.currency}
                </Text>
                <Text style={styles.meta}>
                  {item.maskedCard} • {formatDate(item.createdAt)}
                </Text>
              </View>
              <Pill tone="success">{t('topup.completed')}</Pill>
            </Card>
          ))}
          <SectionTitle>{t('history.payments')}</SectionTitle>
        </>
      ) : null}
      {items.map((item) => {
        const outgoing = item.direction === 'OUT';
        return (
          <Card key={item.id} style={styles.item}>
            <View style={[styles.icon, outgoing ? styles.outIcon : styles.inIcon]}>
              <Ionicons
                color={outgoing ? colors.coral : colors.success}
                name={outgoing ? 'arrow-up' : 'arrow-down'}
                size={21}
              />
            </View>
            <View style={styles.itemText}>
              <Text style={outgoing ? styles.amountOut : styles.amountIn}>
                {outgoing ? '−' : '+'}
                {item.amount.toFixed(2)} {item.currency}
              </Text>
              <Text style={styles.meta}>
                {item.paymentMethod} • {formatDate(item.createdAt)}
              </Text>
            </View>
          </Card>
        );
      })}
      {!loading && items.length === 0 && topUps.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons color={colors.inkMuted} name="receipt-outline" size={38} />
          <Text style={styles.emptyText}>{t('history.empty')}</Text>
        </View>
      ) : null}
      {loading ? <Loading /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {cursor && !loading ? (
        <Button onPress={() => void load(cursor)} tone="secondary">
          {t('history.more')}
        </Button>
      ) : null}
    </Screen>
  );
}

export const UserHistoryScreen = () => (
  <HistoryScreen endpoint="/wallet/history" includeTopUps titleKey="history.walletTitle" />
);

export const MerchantHistoryScreen = () => (
  <HistoryScreen endpoint="/merchant/transactions" titleKey="history.merchantTitle" />
);

const styles = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  icon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  topUpIcon: { backgroundColor: colors.successSoft },
  outIcon: { backgroundColor: colors.coralSoft },
  inIcon: { backgroundColor: colors.successSoft },
  itemText: { flex: 1, gap: 4 },
  amountOut: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  amountIn: { color: colors.success, fontSize: 16, fontWeight: '800' },
  meta: { color: colors.inkSoft, fontSize: 12 },
  empty: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxxl },
  emptyText: { color: colors.inkSoft, fontSize: 14 },
  error: { color: colors.danger },
});
