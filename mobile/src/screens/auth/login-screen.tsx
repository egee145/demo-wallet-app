import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Card, Eyebrow, Muted, Screen, Title } from '../../components/screen';
import { Button, Field, Loading, SegmentedControl } from '../../components/ui';
import type { AccountType } from '../../domain/types';
import { localizedApiError } from '../../i18n/api-error';
import { useI18n } from '../../i18n/i18n-context';
import { useAuth } from '../../services/auth/auth-context';
import { colors, radius, spacing } from '../../theme';

type Mode = 'LOGIN' | 'REGISTER';
type Errors = Partial<Record<'name' | 'businessName' | 'email' | 'phone' | 'password', string>>;

export function LoginScreen() {
  const { login, register } = useAuth();
  const { language, setLanguage, t } = useI18n();
  const [accountType, setAccountType] = useState<AccountType>('PERSONAL');
  const [mode, setMode] = useState<Mode>('LOGIN');
  const [name, setName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const accountHint = useMemo(
    () => t(accountType === 'PERSONAL' ? 'auth.personalHint' : 'auth.businessHint'),
    [accountType, t],
  );

  const validate = (): boolean => {
    const next: Errors = {};
    if (mode === 'REGISTER' && name.trim().length < 2) {
      next.name = t('auth.invalidName');
    }
    if (mode === 'REGISTER' && accountType === 'BUSINESS' && businessName.trim().length < 2) {
      next.businessName = t('auth.invalidName');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      next.email = t('auth.invalidEmail');
    }
    if (mode === 'REGISTER' && phone.trim() && !/^\+[1-9]\d{7,14}$/.test(phone.trim())) {
      next.phone = t('auth.invalidPhone');
    }
    if (password.length < 12) {
      next.password = t('auth.invalidPassword');
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    if (!validate()) {
      return;
    }
    setLoading(true);
    setError('');
    try {
      if (mode === 'LOGIN') {
        await login(email.trim().toLowerCase(), password, accountType);
      } else {
        await register({
          accountType,
          name: name.trim(),
          ...(accountType === 'BUSINESS' ? { businessName: businessName.trim() } : {}),
          email: email.trim().toLowerCase(),
          ...(phone.trim() ? { phone: phone.trim() } : {}),
          password,
        });
      }
    } catch (caught) {
      setError(localizedApiError(caught, t));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll style={styles.screen}>
      <View style={styles.topBar}>
        <View style={styles.brandMark}>
          <Ionicons color={colors.white} name="wallet" size={24} />
        </View>
        <View style={styles.languageSwitch}>
          {(['tr', 'en'] as const).map((value) => (
            <Pressable
              key={value}
              onPress={() => void setLanguage(value)}
              style={[styles.languageOption, language === value && styles.languageOptionActive]}
            >
              <Text
                style={[
                  styles.languageOptionText,
                  language === value && styles.languageOptionTextActive,
                ]}
              >
                {value.toUpperCase()}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.hero}>
        <Eyebrow>{t('auth.eyebrow')}</Eyebrow>
        <Title>{t('auth.title')}</Title>
        <Muted>{t('auth.subtitle')}</Muted>
      </View>

      <Card style={styles.authCard}>
        <SegmentedControl
          onChange={setAccountType}
          options={[
            { value: 'PERSONAL', label: t('auth.personal'), icon: 'person-outline' },
            { value: 'BUSINESS', label: t('auth.business'), icon: 'storefront-outline' },
          ]}
          value={accountType}
        />
        <Text style={styles.accountHint}>{accountHint}</Text>
        <SegmentedControl
          onChange={setMode}
          options={[
            { value: 'LOGIN', label: t('auth.login') },
            { value: 'REGISTER', label: t('auth.register') },
          ]}
          value={mode}
        />

        {mode === 'REGISTER' ? (
          <>
            <Field
              autoCapitalize="words"
              error={errors.name}
              icon="person-outline"
              label={t('auth.name')}
              onChangeText={setName}
              value={name}
            />
            {accountType === 'BUSINESS' ? (
              <Field
                autoCapitalize="words"
                error={errors.businessName}
                icon="storefront-outline"
                label={t('auth.businessName')}
                onChangeText={setBusinessName}
                value={businessName}
              />
            ) : null}
          </>
        ) : null}

        <Field
          autoCapitalize="none"
          error={errors.email}
          icon="mail-outline"
          keyboardType="email-address"
          label={t('auth.email')}
          onChangeText={setEmail}
          value={email}
        />
        {mode === 'REGISTER' ? (
          <Field
            error={errors.phone}
            icon="call-outline"
            keyboardType="phone-pad"
            label={t('auth.phoneOptional')}
            onChangeText={setPhone}
            value={phone}
          />
        ) : null}
        <Field
          error={errors.password}
          icon="lock-closed-outline"
          label={t('auth.password')}
          onChangeText={setPassword}
          secureTextEntry
          value={password}
        />

        {error ? (
          <View style={styles.errorBox}>
            <Ionicons color={colors.danger} name="alert-circle-outline" size={20} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {loading ? (
          <Loading />
        ) : (
          <Button icon="arrow-forward" onPress={() => void submit()}>
            {t(mode === 'LOGIN' ? 'auth.loginAction' : 'auth.registerAction')}
          </Button>
        )}
      </Card>
      <Text style={styles.footer}>NFC • QR • Secure Wallet</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingTop: spacing.lg },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brandMark: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.teal,
  },
  languageSwitch: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    padding: 3,
  },
  languageOption: { borderRadius: radius.pill, paddingHorizontal: 13, paddingVertical: 7 },
  languageOptionActive: { backgroundColor: colors.ink },
  languageOptionText: { color: colors.inkSoft, fontSize: 12, fontWeight: '800' },
  languageOptionTextActive: { color: colors.white },
  hero: { gap: spacing.sm, paddingVertical: spacing.lg },
  authCard: { gap: spacing.lg },
  accountHint: { color: colors.inkSoft, fontSize: 13, lineHeight: 19 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.dangerSoft,
    padding: spacing.md,
  },
  errorText: { flex: 1, color: colors.danger, fontSize: 13, lineHeight: 18 },
  footer: {
    alignSelf: 'center',
    color: colors.inkMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    paddingVertical: spacing.md,
  },
});
