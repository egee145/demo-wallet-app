import { useEffect, useRef, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Card, Muted, Row, Screen, Title } from '../../components/screen';
import { BalanceCard, Button, InfoBanner, Loading, Pill } from '../../components/ui';
import type { PaymentSession, WalletSummary } from '../../domain/types';
import { localizedApiError } from '../../i18n/api-error';
import { useI18n } from '../../i18n/i18n-context';
import type { UserStackParams } from '../../navigation/types';
import { api } from '../../services/api/api-client';
import { parseQrSessionId } from '../../services/qr/qr-session.parser';
import { idempotencyStore } from '../../services/storage/idempotency-store';
import { colors, radius, spacing } from '../../theme';

export function QrScannerScreen({
  navigation,
}: NativeStackScreenProps<UserStackParams, 'QrScanner'>) {
  const { t } = useI18n();
  const [permission, requestPermission] = useCameraPermissions();
  const [error, setError] = useState('');
  const latched = useRef(false);
  const permissionRequested = useRef(false);

  useEffect(() => {
    if (
      permission &&
      !permission.granted &&
      permission.canAskAgain &&
      !permissionRequested.current
    ) {
      permissionRequested.current = true;
      void requestPermission().catch(() => setError(t('errors.CAMERA_PERMISSION_FAILED')));
    }
  }, [permission, requestPermission, t]);

  const scan = ({ data }: BarcodeScanningResult) => {
    if (latched.current) {
      return;
    }
    try {
      const sessionId = parseQrSessionId(data);
      latched.current = true;
      navigation.replace('PaymentSessionDetail', { sessionId });
    } catch {
      setError(t('errors.INVALID_QR_PAYLOAD'));
    }
  };

  if (!permission) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  if (!permission.granted) {
    return (
      <Screen>
        <View style={styles.permissionIcon}>
          <Ionicons color={colors.tealDark} name="camera-outline" size={36} />
        </View>
        <Title>{t('payment.scanTitle')}</Title>
        <Muted>
          {t(permission.canAskAgain ? 'payment.cameraPermission' : 'payment.cameraSettings')}
        </Muted>
        <Button
          icon={permission.canAskAgain ? 'camera-outline' : 'settings-outline'}
          onPress={() =>
            void (permission.canAskAgain
              ? requestPermission().catch(() => setError(t('errors.CAMERA_PERMISSION_FAILED')))
              : Linking.openSettings())
          }
        >
          {t(permission.canAskAgain ? 'payment.requestPermission' : 'payment.openAppSettings')}
        </Button>
        {error ? <InfoBanner tone="warning">{error}</InfoBanner> : null}
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.heading}>
        <Title>{t('payment.scanTitle')}</Title>
        <Muted>{t('payment.scanSubtitle')}</Muted>
      </View>
      <View style={styles.cameraShell}>
        <CameraView
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={scan}
          style={styles.camera}
        />
        <View pointerEvents="none" style={styles.scanFrame}>
          <View style={[styles.corner, styles.topLeft]} />
          <View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} />
          <View style={[styles.corner, styles.bottomRight]} />
        </View>
      </View>
      {error ? <InfoBanner tone="warning">{error}</InfoBanner> : null}
    </Screen>
  );
}

export function PaymentSessionDetailScreen({
  route,
  navigation,
}: NativeStackScreenProps<UserStackParams, 'PaymentSessionDetail'>) {
  const { t } = useI18n();
  const { sessionId } = route.params;
  const [session, setSession] = useState<PaymentSession>();
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void api
      .get<PaymentSession>(`/payments/session/${sessionId}`)
      .then((response) => setSession(response.data))
      .catch((caught) => setError(localizedApiError(caught, t)));
  }, [sessionId, t]);

  const pay = async () => {
    const operation = `payment:qr:${sessionId}`;
    setSubmitting(true);
    setError('');
    try {
      const key = await idempotencyStore.getOrCreate(operation);
      const response = await api.post<{ success: true; transactionId: string }>(
        '/payments/qr',
        { paymentSessionId: sessionId },
        { headers: { 'Idempotency-Key': key } },
      );
      await idempotencyStore.clear(operation);
      navigation.replace('UserPaymentResult', {
        sessionId,
        transactionId: response.data.transactionId,
      });
    } catch (caught) {
      setError(localizedApiError(caught, t));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <Title>{t('payment.confirmTitle')}</Title>
      {session ? (
        <Card>
          <View style={styles.merchantIcon}>
            <Ionicons color={colors.tealDark} name="storefront-outline" size={28} />
          </View>
          <Text style={styles.merchantName}>{session.merchant.name}</Text>
          <Text style={styles.paymentAmount}>
            {session.amount.toFixed(2)}{' '}
            <Text style={styles.paymentCurrency}>{session.currency}</Text>
          </Text>
          <Row style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('common.status')}</Text>
            <Pill tone={session.status === 'WAITING' ? 'success' : 'warning'}>
              {t(`payment.status.${session.status}`)}
            </Pill>
          </Row>
          <Row style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('payment.expires')}</Text>
            <Text style={styles.detailValue}>
              {new Date(session.expiresAt).toLocaleTimeString()}
            </Text>
          </Row>
          {session.status === 'WAITING' ? (
            <Button
              disabled={submitting}
              icon="shield-checkmark-outline"
              onPress={() => void pay()}
            >
              {t(submitting ? 'payment.sending' : 'payment.confirm')}
            </Button>
          ) : null}
        </Card>
      ) : error ? (
        <InfoBanner tone="warning">{error}</InfoBanner>
      ) : (
        <Loading />
      )}
      {error && session ? <InfoBanner tone="warning">{error}</InfoBanner> : null}
    </Screen>
  );
}

export function UserPaymentResultScreen({
  route,
  navigation,
}: NativeStackScreenProps<UserStackParams, 'UserPaymentResult'>) {
  const { t } = useI18n();
  const [wallet, setWallet] = useState<WalletSummary>();

  useEffect(() => {
    void api.get<WalletSummary>('/wallet/me').then((response) => setWallet(response.data));
  }, []);

  return (
    <Screen>
      <View style={styles.successIcon}>
        <Ionicons color={colors.success} name="checkmark" size={44} />
      </View>
      <Title>{t('payment.completed')}</Title>
      <Muted>{t('payment.completedBody')}</Muted>
      <BalanceCard
        balance={wallet?.balance}
        currency={wallet?.currency ?? 'TRY'}
        label={t('payment.updatedBalance')}
      />
      <Text style={styles.reference}>#{route.params.transactionId.slice(0, 8).toUpperCase()}</Text>
      <Button icon="wallet-outline" onPress={() => navigation.popToTop()}>
        {t('common.backHome')}
      </Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { gap: spacing.sm },
  permissionIcon: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    backgroundColor: colors.tealLight,
    marginTop: spacing.xxxl,
  },
  cameraShell: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: radius.xl,
    backgroundColor: colors.ink,
  },
  camera: { flex: 1 },
  scanFrame: {
    position: 'absolute',
    top: '20%',
    right: '12%',
    bottom: '20%',
    left: '12%',
  },
  corner: { position: 'absolute', width: 46, height: 46, borderColor: colors.white },
  topLeft: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 14 },
  topRight: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 14 },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 14,
  },
  bottomRight: {
    right: 0,
    bottom: 0,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderBottomRightRadius: 14,
  },
  merchantIcon: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.tealLight,
  },
  merchantName: { color: colors.ink, fontSize: 18, fontWeight: '800' },
  paymentAmount: { color: colors.ink, fontSize: 36, fontWeight: '800', marginVertical: spacing.sm },
  paymentCurrency: { color: colors.inkSoft, fontSize: 16 },
  detailRow: { justifyContent: 'space-between' },
  detailLabel: { color: colors.inkSoft, fontSize: 13 },
  detailValue: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  successIcon: {
    width: 86,
    height: 86,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.successSoft,
    marginTop: spacing.xxxl,
  },
  reference: { color: colors.inkMuted, fontSize: 12, textAlign: 'center' },
});
