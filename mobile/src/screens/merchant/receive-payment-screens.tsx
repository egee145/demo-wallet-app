import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import QRCode from 'react-native-qrcode-svg';

import { Card, Muted, Screen, Title } from '../../components/screen';
import { BalanceCard, Button, Field, InfoBanner, Loading, Pill } from '../../components/ui';
import { paymentReducer } from '../../domain/payment-machine';
import type { CreatedPaymentSession, PaymentSession } from '../../domain/types';
import { localizedApiError } from '../../i18n/api-error';
import { useI18n } from '../../i18n/i18n-context';
import type { MerchantStackParams } from '../../navigation/types';
import { api, apiErrorCode } from '../../services/api/api-client';
import { subscribeToPaymentSession } from '../../services/api/payment-socket';
import { getNfcReader, type NfcReadResult } from '../../services/nfc';
import {
  getNfcErrorCode,
  localizedNfcError,
  type NfcErrorCode,
} from '../../services/nfc/nfc-error';
import { idempotencyStore } from '../../services/storage/idempotency-store';
import { colors, radius, spacing } from '../../theme';

const AMOUNT_PATTERN = /^(?:0|[1-9]\d{0,5})(?:\.\d{1,2})?$/;

export function AmountEntryScreen({
  navigation,
}: NativeStackScreenProps<MerchantStackParams, 'AmountEntry'>) {
  const { t } = useI18n();
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!AMOUNT_PATTERN.test(amount) || Number(amount) < 0.01 || Number(amount) > 999999.99) {
      setError(t('topup.invalidAmount'));
      return;
    }

    const canonicalAmount = Number(amount).toFixed(2);
    const operation = `session:create:${canonicalAmount}`;
    setLoading(true);
    setError('');
    try {
      const key = await idempotencyStore.getOrCreate(operation);
      const response = await api.post<CreatedPaymentSession>(
        '/payments/session',
        { amount: Number(amount) },
        { headers: { 'Idempotency-Key': key } },
      );
      await idempotencyStore.clear(operation);
      navigation.replace('MerchantPaymentSession', { session: response.data });
    } catch (caught) {
      setError(localizedApiError(caught, t));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <View style={styles.heading}>
        <Title>{t('payment.receiveTitle')}</Title>
        <Muted>{t('payment.receiveSubtitle')}</Muted>
      </View>
      <Card>
        <View style={styles.amountIcon}>
          <Ionicons color={colors.tealDark} name="cash-outline" size={28} />
        </View>
        <Field
          accessibilityLabel={t('payment.amount')}
          error={error || undefined}
          keyboardType="decimal-pad"
          label={t('payment.amount')}
          onChangeText={(value) => {
            setAmount(value.replace(',', '.'));
            setError('');
          }}
          placeholder="50.00"
          value={amount}
        />
        {loading ? (
          <Loading />
        ) : (
          <Button icon="arrow-forward" onPress={() => void submit()}>
            {t('payment.start')}
          </Button>
        )}
      </Card>
    </Screen>
  );
}

export function MerchantPaymentSessionScreen({
  route,
  navigation,
}: NativeStackScreenProps<MerchantStackParams, 'MerchantPaymentSession'>) {
  const { t } = useI18n();
  const { session } = route.params;
  const [state, dispatch] = useReducer(paymentReducer, { status: 'WAITING' });
  const [seconds, setSeconds] = useState(() =>
    Math.max(0, Math.ceil((Date.parse(session.expiresAt) - Date.now()) / 1000)),
  );
  const [nfcErrorCode, setNfcErrorCode] = useState<NfcErrorCode>();
  const active = useRef(true);
  const submitting = useRef(false);
  const settled = useRef(false);
  const lastTag = useRef<{ identity: string; at: number } | undefined>(undefined);

  const submitCard = useCallback(
    async (card: NfcReadResult) => {
      if (!card.tagId) {
        dispatch({ type: 'RECOVERABLE_ERROR', message: 'INVALID_NFC_TAG_UID' });
        return;
      }
      const identity = `${card.userId}:${card.tagId}`;
      const previous = lastTag.current;
      if (
        submitting.current ||
        (previous?.identity === identity && Date.now() - previous.at < 2_000)
      ) {
        return;
      }

      lastTag.current = { identity, at: Date.now() };
      submitting.current = true;
      dispatch({ type: 'SUBMIT', userId: card.userId });
      const operation = `payment:nfc:${session.id}:${identity}`;
      try {
        const key = await idempotencyStore.getOrCreate(operation);
        const response = await api.post<{ success: true; transactionId: string }>(
          '/payments/nfc',
          { paymentSessionId: session.id, userId: card.userId, tagUid: card.tagId },
          { headers: { 'Idempotency-Key': key } },
        );
        await idempotencyStore.clear(operation);
        settled.current = true;
        dispatch({ type: 'PAID', transactionId: response.data.transactionId });
        navigation.replace('MerchantPaymentResult', {
          sessionId: session.id,
          transactionId: response.data.transactionId,
        });
      } catch (caught) {
        const message = localizedApiError(caught, t);
        const code = apiErrorCode(caught);
        dispatch(
          code === 'NETWORK' || code === 'TIMEOUT'
            ? { type: 'NETWORK_UNKNOWN', message }
            : { type: 'RECOVERABLE_ERROR', message },
        );
      } finally {
        submitting.current = false;
      }
    },
    [navigation, session.id, t],
  );

  const finishFromNotification = useCallback(
    (transactionId: string) => {
      if (settled.current) {
        return;
      }
      settled.current = true;
      dispatch({ type: 'PAID', transactionId });
      void getNfcReader().cancel();
      navigation.replace('MerchantPaymentResult', { sessionId: session.id, transactionId });
    },
    [navigation, session.id],
  );

  useEffect(() => {
    let disposed = false;
    let unsubscribe: (() => void) | undefined;
    void subscribeToPaymentSession(session.id, (event) => {
      if (event.status === 'PAID' && event.transactionId) {
        finishFromNotification(event.transactionId);
      }
    }).then((cleanup) => {
      if (disposed) {
        cleanup();
      } else {
        unsubscribe = cleanup;
      }
    });

    const polling = setInterval(() => {
      if (settled.current) {
        return;
      }
      void api
        .get<PaymentSession>(`/payments/session/${session.id}`)
        .then((response) => {
          if (response.data.status === 'PAID' && response.data.transactionId) {
            finishFromNotification(response.data.transactionId);
          } else if (response.data.status === 'EXPIRED') {
            dispatch({ type: 'EXPIRE' });
          } else if (response.data.status === 'CANCELLED') {
            dispatch({ type: 'CANCEL' });
          }
        })
        .catch(() => {
          // The authoritative state is retried on the next polling interval.
        });
    }, 2_000);

    return () => {
      disposed = true;
      unsubscribe?.();
      clearInterval(polling);
    };
  }, [finishFromNotification, session.id]);

  const listen = useCallback(async () => {
    if (!active.current || submitting.current || Date.parse(session.expiresAt) <= Date.now()) {
      return;
    }
    try {
      setNfcErrorCode(undefined);
      dispatch({ type: 'WAIT' });
      const result = await getNfcReader().readUserId();
      if (active.current) {
        dispatch({ type: 'TAG', userId: result.userId });
        await submitCard(result);
      }
    } catch (caught) {
      if (active.current && caught instanceof Error && caught.message !== 'NFC_CANCELLED') {
        const code = getNfcErrorCode(caught);
        setNfcErrorCode(code);
        dispatch({
          type: 'RECOVERABLE_ERROR',
          message: code ? localizedNfcError(caught, t) : localizedApiError(caught, t),
        });
      }
    }
  }, [session.expiresAt, submitCard, t]);

  useFocusEffect(
    useCallback(() => {
      active.current = true;
      void listen();
      return () => {
        active.current = false;
        void getNfcReader().cancel();
      };
    }, [listen]),
  );

  useEffect(() => {
    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((Date.parse(session.expiresAt) - Date.now()) / 1000));
      setSeconds(remaining);
      if (remaining === 0) {
        dispatch({ type: 'EXPIRE' });
        void getNfcReader().cancel();
      }
    }, 1_000);
    return () => clearInterval(timer);
  }, [session.expiresAt]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next !== 'active') {
        active.current = false;
        void getNfcReader().cancel();
      } else if (Date.parse(session.expiresAt) > Date.now()) {
        active.current = true;
        void api.get(`/payments/session/${session.id}`).then(() => listen());
      }
    });
    return () => subscription.remove();
  }, [listen, session.expiresAt, session.id]);

  const cancel = async () => {
    active.current = false;
    await getNfcReader().cancel();
    await api.post(`/payments/session/${session.id}/cancel`);
    dispatch({ type: 'CANCEL' });
    navigation.popToTop();
  };

  const openNfcSettings = async () => {
    const opened = await getNfcReader().openNfcSettings();
    if (!opened) {
      dispatch({
        type: 'RECOVERABLE_ERROR',
        message: t('errors.NFC_SETTINGS_UNAVAILABLE'),
      });
    }
  };

  const statusTone =
    state.status === 'PAID'
      ? 'success'
      : state.status === 'EXPIRED' || state.status === 'CANCELLED'
        ? 'danger'
        : state.status === 'NETWORK_UNKNOWN'
          ? 'warning'
          : 'neutral';

  return (
    <Screen scroll>
      <View style={styles.heading}>
        <Title>{t('payment.waitingTitle')}</Title>
        <Muted>{t('payment.waitingSubtitle')}</Muted>
      </View>
      <Card style={styles.sessionCard}>
        <View style={styles.sessionTop}>
          <Text style={styles.sessionAmount}>
            {session.amount.toFixed(2)}{' '}
            <Text style={styles.sessionCurrency}>{session.currency}</Text>
          </Text>
          <Pill tone={seconds < 30 ? 'warning' : 'neutral'}>
            {t('payment.timeLeft', { seconds })}
          </Pill>
        </View>
        <View style={styles.qrShell}>
          <QRCode
            backgroundColor={colors.white}
            color={colors.ink}
            size={218}
            value={session.qrPayload}
          />
        </View>
        <Pill tone={statusTone}>{t(`payment.status.${state.status}`)}</Pill>
        {'message' in state ? <InfoBanner tone="warning">{state.message}</InfoBanner> : null}
        {nfcErrorCode === 'NFC_DISABLED' ? (
          <Button icon="settings-outline" onPress={() => void openNfcSettings()} tone="secondary">
            {t('nfc.openSettings')}
          </Button>
        ) : null}
        {state.status === 'RECOVERABLE_ERROR' || state.status === 'NETWORK_UNKNOWN' ? (
          <Button icon="refresh" onPress={() => void listen()} tone="secondary">
            {t('payment.retryReader')}
          </Button>
        ) : null}
        <Button icon="close-circle-outline" onPress={() => void cancel()} tone="ghost">
          {t('payment.cancelSession')}
        </Button>
      </Card>
    </Screen>
  );
}

export function MerchantPaymentResultScreen({
  route,
  navigation,
}: NativeStackScreenProps<MerchantStackParams, 'MerchantPaymentResult'>) {
  const { t } = useI18n();
  const [balance, setBalance] = useState<number>();

  useEffect(() => {
    void api
      .get<{ wallet: { balance: number } }>('/merchant/me')
      .then((response) => setBalance(response.data.wallet.balance));
  }, []);

  return (
    <Screen>
      <View style={styles.successIcon}>
        <Ionicons color={colors.success} name="checkmark" size={44} />
      </View>
      <Title>{t('payment.received')}</Title>
      <Muted>{t('payment.receivedBody')}</Muted>
      <BalanceCard balance={balance} currency="TRY" label={t('payment.updatedBalance')} />
      <Text style={styles.reference}>#{route.params.transactionId.slice(0, 8).toUpperCase()}</Text>
      <Button icon="home-outline" onPress={() => navigation.popToTop()}>
        {t('common.backHome')}
      </Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { gap: spacing.sm },
  amountIcon: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.tealLight,
  },
  sessionCard: { alignItems: 'center', gap: spacing.lg },
  sessionTop: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sessionAmount: { color: colors.ink, fontSize: 28, fontWeight: '800' },
  sessionCurrency: { color: colors.inkSoft, fontSize: 14 },
  qrShell: {
    borderWidth: 10,
    borderColor: colors.white,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    padding: spacing.sm,
    shadowColor: colors.ink,
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 4,
  },
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
