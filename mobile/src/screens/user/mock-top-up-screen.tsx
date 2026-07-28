import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Card, Muted, Screen, Title } from '../../components/screen';
import { Button, Field, InfoBanner, Pill } from '../../components/ui';
import {
  validateMockTopUp,
  type MockTopUpField,
  type MockTopUpInput,
} from '../../domain/mock-top-up.validation';
import type { MockTopUpResult } from '../../domain/types';
import { localizedApiError } from '../../i18n/api-error';
import { useI18n } from '../../i18n/i18n-context';
import type { UserStackParams } from '../../navigation/types';
import { api } from '../../services/api/api-client';
import { idempotencyStore } from '../../services/storage/idempotency-store';
import { colors, radius, spacing } from '../../theme';

const initial: MockTopUpInput = {
  cardholderName: '',
  cardNumber: '',
  expiry: '',
  cvv: '',
  amount: '',
};

export function MockTopUpScreen({
  navigation,
}: NativeStackScreenProps<UserStackParams, 'MockTopUp'>) {
  const { t } = useI18n();
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Partial<Record<MockTopUpField, string>>>({});
  const [requestError, setRequestError] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MockTopUpResult>();

  const update = (field: keyof MockTopUpInput, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const submit = async () => {
    const nextErrors = validateMockTopUp(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const cardNumber = form.cardNumber.replace(/[ -]/g, '');
    const amount = Number(form.amount);
    const operation = `wallet:topup:${amount.toFixed(2)}:${cardNumber.slice(-4)}`;
    setLoading(true);
    setRequestError('');
    try {
      const key = await idempotencyStore.getOrCreate(operation);
      const response = await api.post<MockTopUpResult>(
        '/wallet/top-up/mock',
        {
          cardholderName: form.cardholderName.trim(),
          cardNumber,
          expiry: form.expiry,
          cvv: form.cvv,
          amount,
        },
        { headers: { 'Idempotency-Key': key } },
      );
      await idempotencyStore.clear(operation);
      setResult(response.data);
    } catch (caught) {
      setRequestError(localizedApiError(caught, t));
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <Screen>
        <View style={styles.successIcon}>
          <Ionicons color={colors.success} name="checkmark" size={42} />
        </View>
        <Title>{t('topup.successTitle')}</Title>
        <Muted>{t('topup.successBody', { amount: result.amount.toFixed(2) })}</Muted>
        <Card>
          <Text style={styles.resultLabel}>{t('topup.newBalance')}</Text>
          <Text style={styles.resultBalance}>
            {result.balance.toFixed(2)} <Text style={styles.resultCurrency}>TRY</Text>
          </Text>
          <Pill tone="success">
            {result.maskedCard} • {t('topup.completed')}
          </Pill>
        </Card>
        <Button icon="wallet-outline" onPress={() => navigation.popToTop()}>
          {t('common.backHome')}
        </Button>
      </Screen>
    );
  }

  const formatCard = (value: string) =>
    value
      .replace(/\D/g, '')
      .slice(0, 19)
      .replace(/(.{4})/g, '$1 ')
      .trim();
  const formatExpiry = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 6);
    return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
  };

  return (
    <Screen scroll>
      <View>
        <Title>{t('topup.title')}</Title>
        <Muted>{t('topup.subtitle')}</Muted>
      </View>
      <InfoBanner icon="flask-outline" tone="warning">
        {t('topup.mockNotice')}
      </InfoBanner>
      <Card>
        <Field
          autoCapitalize="words"
          error={errors.cardholderName ? t(errors.cardholderName) : undefined}
          icon="person-outline"
          label={t('topup.cardholder')}
          onChangeText={(value) => update('cardholderName', value)}
          value={form.cardholderName}
        />
        <Field
          error={errors.cardNumber ? t(errors.cardNumber) : undefined}
          icon="card-outline"
          keyboardType="number-pad"
          label={t('topup.cardNumber')}
          maxLength={23}
          onChangeText={(value) => update('cardNumber', formatCard(value))}
          value={form.cardNumber}
        />
        <View style={styles.fieldRow}>
          <View style={styles.fieldHalf}>
            <Field
              error={errors.expiry ? t(errors.expiry) : undefined}
              keyboardType="number-pad"
              label={t('topup.expiry')}
              maxLength={7}
              onChangeText={(value) => update('expiry', formatExpiry(value))}
              value={form.expiry}
            />
          </View>
          <View style={styles.fieldHalf}>
            <Field
              error={errors.cvv ? t(errors.cvv) : undefined}
              keyboardType="number-pad"
              label={t('topup.cvv')}
              maxLength={4}
              onChangeText={(value) => update('cvv', value.replace(/\D/g, '').slice(0, 4))}
              secureTextEntry
              value={form.cvv}
            />
          </View>
        </View>
        <Field
          error={errors.amount ? t(errors.amount) : undefined}
          icon="cash-outline"
          keyboardType="decimal-pad"
          label={t('topup.amount')}
          onChangeText={(value) => update('amount', value.replace(',', '.'))}
          placeholder="50.00"
          value={form.amount}
        />
        {requestError ? <Text style={styles.error}>{requestError}</Text> : null}
        <Button disabled={loading} icon="add-circle-outline" onPress={() => void submit()}>
          {loading ? t('common.loading') : t('topup.action')}
        </Button>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fieldRow: { flexDirection: 'row', gap: spacing.md },
  fieldHalf: { flex: 1 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 18 },
  successIcon: {
    width: 82,
    height: 82,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.successSoft,
    marginTop: spacing.xxxl,
  },
  resultLabel: { color: colors.inkSoft, fontSize: 13, fontWeight: '700' },
  resultBalance: { color: colors.ink, fontSize: 36, fontWeight: '800' },
  resultCurrency: { fontSize: 16, color: colors.inkSoft },
});
