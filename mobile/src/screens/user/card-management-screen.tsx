import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Muted, Screen, Title } from '../../components/screen';
import { Button, InfoBanner, Loading, Pill } from '../../components/ui';
import { isSameNfcTag } from '../../domain/nfc-card-transfer';
import type { NfcCardClaimStatus, NfcCardSummary } from '../../domain/types';
import { localizedApiError } from '../../i18n/api-error';
import { useI18n } from '../../i18n/i18n-context';
import { api } from '../../services/api/api-client';
import { useAuth } from '../../services/auth/auth-context';
import { getNfcReader } from '../../services/nfc';
import {
  getNfcErrorCode,
  localizedNfcError,
  type NfcErrorCode,
} from '../../services/nfc/nfc-error';
import { colors, radius, spacing } from '../../theme';

export function CardManagementScreen() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [summary, setSummary] = useState<NfcCardSummary>();
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [working, setWorking] = useState(false);
  const [nfcErrorCode, setNfcErrorCode] = useState<NfcErrorCode>();

  const load = useCallback(async () => {
    try {
      const response = await api.get<NfcCardSummary>('/wallet/card');
      setSummary(response.data);
      setError('');
    } catch (caught) {
      setError(localizedApiError(caught, t));
    }
  }, [t]);

  useEffect(() => {
    void load();
    return () => {
      void getNfcReader().cancel();
    };
  }, [load]);

  const showError = (caught: unknown) => {
    setMessage('');
    const code = getNfcErrorCode(caught);
    setNfcErrorCode(code);
    setError(code ? localizedNfcError(caught, t) : localizedApiError(caught, t));
  };

  const writeAndBind = async (inspectedTagUid: string, transferConfirmed: boolean) => {
    if (!user) {
      return;
    }
    setWorking(true);
    setError('');
    setNfcErrorCode(undefined);
    setMessage(t(transferConfirmed ? 'card.holdAgain' : 'card.hold'));
    try {
      const provisioned = await getNfcReader().provisionUserId(user.id);
      if (!provisioned.verified || !provisioned.tagId) {
        throw new Error('NFC_CARD_VERIFICATION_FAILED');
      }
      if (!isSameNfcTag(inspectedTagUid, provisioned.tagId)) {
        throw new Error('NFC_CARD_CHANGED');
      }
      const response = await api.post<NfcCardSummary>('/wallet/card', {
        tagUid: provisioned.tagId,
        label: 'HepAntalya Card',
        transferConfirmed,
      });
      setSummary(response.data);
      setMessage(t(transferConfirmed ? 'card.transferSuccess' : 'card.success'));
    } catch (caught) {
      showError(caught);
    } finally {
      setWorking(false);
      await getNfcReader().cancel();
    }
  };

  const inspect = async () => {
    setWorking(true);
    setError('');
    setNfcErrorCode(undefined);
    setMessage(t('card.inspectHold'));
    try {
      const diagnostics = await getNfcReader().readDiagnostics();
      if (!diagnostics.tagId) {
        throw new Error('NFC_CARD_VERIFICATION_FAILED');
      }
      const inspectedTagUid = diagnostics.tagId;
      const response = await api.post<NfcCardClaimStatus>('/wallet/card/inspect', {
        tagUid: inspectedTagUid,
      });
      await getNfcReader().cancel();

      if (response.data.transferRequired) {
        setWorking(false);
        setMessage('');
        Alert.alert(t('card.transferConfirmTitle'), t('card.transferConfirmBody'), [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('card.transferConfirmAction'),
            onPress: () => void writeAndBind(inspectedTagUid, true),
          },
        ]);
        return;
      }

      await writeAndBind(inspectedTagUid, false);
    } catch (caught) {
      showError(caught);
      setWorking(false);
      await getNfcReader().cancel();
    }
  };

  const confirm = () => {
    Alert.alert(t('card.confirmTitle'), t('card.confirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('card.confirmAction'), onPress: () => void inspect() },
    ]);
  };

  const openNfcSettings = async () => {
    const opened = await getNfcReader().openNfcSettings();
    if (!opened) {
      setError(t('errors.NFC_SETTINGS_UNAVAILABLE'));
    }
  };

  return (
    <Screen>
      <Title>{t('card.title')}</Title>
      <Muted>{t('card.subtitle')}</Muted>
      {!summary && !error ? <Loading /> : null}
      {summary ? (
        <Card>
          <View style={styles.cardVisual}>
            <View style={styles.cardIcon}>
              <Ionicons color={colors.white} name="wifi" size={30} />
            </View>
            <Text style={styles.cardBrand}>HEPANTALYA</Text>
            <Text style={styles.cardCaption}>NFC • WALLET</Text>
          </View>
          <View style={styles.statusRow}>
            <View>
              <Text style={styles.statusTitle}>
                {t(summary.bound ? 'card.bound' : 'card.notBound')}
              </Text>
              {summary.card ? <Text style={styles.statusLabel}>{summary.card.label}</Text> : null}
            </View>
            <Pill tone={summary.bound ? 'success' : 'warning'}>
              {summary.bound ? t('common.active') : '—'}
            </Pill>
          </View>
        </Card>
      ) : null}
      {working ? <InfoBanner>{t('card.hold')}</InfoBanner> : null}
      {message ? <InfoBanner tone="success">{message}</InfoBanner> : null}
      {error ? <InfoBanner tone="warning">{error}</InfoBanner> : null}
      {nfcErrorCode === 'NFC_DISABLED' ? (
        <Button icon="settings-outline" onPress={() => void openNfcSettings()} tone="secondary">
          {t('nfc.openSettings')}
        </Button>
      ) : null}
      <Button disabled={working} icon="wifi-outline" onPress={confirm}>
        {t(summary?.bound ? 'card.replace' : 'card.action')}
      </Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardVisual: {
    minHeight: 170,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    borderRadius: radius.lg,
    backgroundColor: colors.ink,
    padding: spacing.xl,
  },
  cardIcon: {
    position: 'absolute',
    top: spacing.xl,
    right: spacing.xl,
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.teal,
  },
  cardBrand: { color: colors.white, fontSize: 21, fontWeight: '800', letterSpacing: 1.5 },
  cardCaption: { color: colors.inkMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1.4 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  statusLabel: { color: colors.inkSoft, fontSize: 13, marginTop: 3 },
});
