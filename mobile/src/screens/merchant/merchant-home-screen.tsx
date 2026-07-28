import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Muted, Screen, SectionTitle, Title } from '../../components/screen';
import { ActionTile, BalanceCard, Button, InfoBanner } from '../../components/ui';
import { env } from '../../config/env';
import { localizedApiError } from '../../i18n/api-error';
import { useI18n } from '../../i18n/i18n-context';
import type { MerchantStackParams } from '../../navigation/types';
import { api } from '../../services/api/api-client';
import { useAuth } from '../../services/auth/auth-context';
import { colors, radius, spacing } from '../../theme';

type MerchantProfile = {
  merchant: { id: string; name: string };
  wallet: { balance: number; currency: 'TRY' };
};

export function MerchantHomeScreen({
  navigation,
}: NativeStackScreenProps<MerchantStackParams, 'MerchantHome'>) {
  const { user } = useAuth();
  const { t } = useI18n();
  const [profile, setProfile] = useState<MerchantProfile>();
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      const response = await api.get<MerchantProfile>('/merchant/me');
      setProfile(response.data);
      setError('');
    } catch (caught) {
      setError(localizedApiError(caught, t));
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
          <Title>{profile?.merchant.name ?? user?.name}</Title>
          <Muted>{t('home.businessSubtitle')}</Muted>
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
        balance={profile?.wallet.balance}
        currency={profile?.wallet.currency}
        footer={
          <Pressable onPress={() => void refresh()} style={styles.refresh}>
            <Ionicons color={colors.white} name="refresh" size={16} />
            <Text style={styles.refreshText}>{t('home.refresh')}</Text>
          </Pressable>
        }
        label={t('home.receivedBalance')}
      />
      {error ? <InfoBanner tone="warning">{error}</InfoBanner> : null}
      <SectionTitle>{t('home.quickActions')}</SectionTitle>
      <View style={styles.gridRow}>
        <ActionTile
          accent="coral"
          icon="phone-portrait-outline"
          onPress={() => navigation.navigate('AmountEntry')}
          subtitle="NFC + QR"
          title={t('home.receive')}
        />
        <ActionTile
          accent="teal"
          icon="analytics-outline"
          onPress={() => navigation.navigate('MerchantHistory')}
          title={t('common.history')}
        />
      </View>
      {env.diagnostics ? (
        <Button
          icon="hardware-chip-outline"
          onPress={() => navigation.navigate('NfcDiagnostics')}
          tone="ghost"
        >
          NFC Diagnostics
        </Button>
      ) : null}
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
