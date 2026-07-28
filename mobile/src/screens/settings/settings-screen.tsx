import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Muted, Screen, SectionTitle, Title } from '../../components/screen';
import { Button, SegmentedControl } from '../../components/ui';
import { useI18n } from '../../i18n/i18n-context';
import { useAuth } from '../../services/auth/auth-context';
import { colors, radius, spacing } from '../../theme';

export function SettingsScreen() {
  const { language, setLanguage, t } = useI18n();
  const { user, logout } = useAuth();
  const accountLabel =
    user?.role === 'MERCHANT' || user?.role === 'ADMIN'
      ? t('settings.businessAccount')
      : t('settings.personalAccount');

  return (
    <Screen scroll>
      <Title>{t('settings.title')}</Title>
      <Card>
        <SectionTitle>{t('settings.language')}</SectionTitle>
        <Muted>{t('settings.languageHint')}</Muted>
        <SegmentedControl
          onChange={(value) => void setLanguage(value)}
          options={[
            { value: 'tr', label: t('settings.turkish') },
            { value: 'en', label: t('settings.english') },
          ]}
          value={language}
        />
      </Card>
      <Card>
        <SectionTitle>{t('settings.account')}</SectionTitle>
        <View style={styles.profile}>
          <View style={styles.avatar}>
            <Ionicons color={colors.tealDark} name="person" size={26} />
          </View>
          <View style={styles.profileText}>
            <Text style={styles.name}>{user?.name}</Text>
            <Text style={styles.email}>{user?.email}</Text>
            <Text style={styles.role}>{accountLabel}</Text>
          </View>
        </View>
      </Card>
      <Button icon="log-out-outline" onPress={() => void logout()} tone="danger">
        {t('common.logout')}
      </Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  avatar: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.tealLight,
  },
  profileText: { flex: 1, gap: 3 },
  name: { color: colors.ink, fontSize: 17, fontWeight: '800' },
  email: { color: colors.inkSoft, fontSize: 13 },
  role: { color: colors.tealDark, fontSize: 12, fontWeight: '700' },
});
