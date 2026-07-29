import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Muted, Screen, SectionTitle, Title } from '../../components/screen';
import { ActionTile, BalanceCard, InfoBanner } from '../../components/ui';
import type { NfcCardSummary, WalletSummary } from '../../domain/types';
import { localizedApiError } from '../../i18n/api-error';
import { useI18n } from '../../i18n/i18n-context';
import type { UserStackParams } from '../../navigation/types';
import { api } from '../../services/api/api-client';
import { useAuth } from '../../services/auth/auth-context';
import { colors, radius, spacing } from '../../theme';

export function UserHomeScreen({
  navigation,
}: NativeStackScreenProps<UserStackParams, 'UserHome'>) {
  const { user } = useAuth();
  const { t } = useI18n();
  const [wallet, setWallet] = useState<WalletSummary>();
  const [card, setCard] = useState<NfcCardSummary>();
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setError('');
    const walletRequest = api
      .get<WalletSummary>('/wallet/me')
      .then((response) => setWallet(response.data));
    const cardRequest = api
      .get<NfcCardSummary>('/wallet/card')
      .then((response) => setCard(response.data));
    const results = await Promise.allSettled([walletRequest, cardRequest]);
    const failure = results.find((result) => result.status === 'rejected');
    if (failure?.status === 'rejected') {
      setError(localizedApiError(failure.reason, t));
    } else {
      setError('');
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  return (
    <Screen scroll>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Title>{t('home.hello', { name: user?.name.split(' ')[0] ?? '' })}</Title>
          <Muted>{t('home.personalSubtitle')}</Muted>
        </View>
        <Pressable
          accessibilityLabel={t('common.settings')}
          onPress={() => navigation.navigate('Settings')}
          style={styles.settings}
        >
          <Ionicons color={colors.ink} name="settings-outline" size={23} />
        </Pressable>
      </View>

      <BalanceCard
        balance={wallet?.balance}
        currency={wallet?.currency}
        footer={
          <Pressable onPress={() => void refresh()} style={styles.refresh}>
            <Ionicons color={colors.white} name="refresh" size={16} />
            <Text style={styles.refreshText}>{t('home.refresh')}</Text>
          </Pressable>
        }
        label={t('home.availableBalance')}
      />

      {error ? <InfoBanner tone="warning">{error}</InfoBanner> : null}
      <SectionTitle>{t('home.quickActions')}</SectionTitle>
      <View style={styles.gridRow}>
        <ActionTile
          accent="teal"
          icon="qr-code-outline"
          onPress={() => navigation.navigate('QrScanner')}
          title={t('home.payQr')}
        />
        <ActionTile
          accent="coral"
          icon="add-circle-outline"
          onPress={() => navigation.navigate('MockTopUp')}
          title={t('home.topUp')}
        />
      </View>
      <View style={styles.gridRow}>
        <ActionTile
          accent="amber"
          icon="wifi-outline"
          onPress={() => navigation.navigate('CardManagement')}
          subtitle={t(card?.bound ? 'home.cardBound' : 'home.cardMissing')}
          title={t('home.myCard')}
        />
        <ActionTile
          accent="teal"
          icon="receipt-outline"
          onPress={() => navigation.navigate('UserHistory')}
          title={t('common.history')}
        />
      </View>
      <InfoBanner icon="shield-checkmark-outline" tone={card?.bound ? 'success' : 'info'}>
        {t(card?.bound ? 'home.cardBound' : 'home.cardMissing')}
      </InfoBanner>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerText: { flex: 1, gap: spacing.xs },
  settings: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.white,
  },
  refresh: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  refreshText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  gridRow: { flexDirection: 'row', gap: spacing.md },
});
