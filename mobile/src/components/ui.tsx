import type { ComponentProps, PropsWithChildren, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius, shadows, spacing } from '../theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

export const Button = ({
  children,
  onPress,
  disabled,
  tone = 'primary',
  icon,
  style,
}: PropsWithChildren<{
  onPress: () => void;
  disabled?: boolean;
  tone?: 'primary' | 'danger' | 'secondary' | 'ghost';
  icon?: IconName;
  style?: ViewStyle;
}>) => (
  <Pressable
    accessibilityRole="button"
    disabled={disabled}
    onPress={onPress}
    style={({ pressed }) => [
      styles.button,
      styles[`${tone}Button`],
      style,
      (pressed || disabled) && styles.dimmed,
    ]}
  >
    {icon ? (
      <Ionicons
        color={tone === 'ghost' || tone === 'secondary' ? colors.tealDark : colors.white}
        name={icon}
        size={20}
      />
    ) : null}
    <Text
      style={[
        styles.buttonText,
        (tone === 'ghost' || tone === 'secondary') && styles.secondaryButtonText,
      ]}
    >
      {children}
    </Text>
  </Pressable>
);

export const Field = ({
  label,
  error,
  icon,
  ...props
}: TextInputProps & { label?: string; error?: string; icon?: IconName }) => (
  <View style={styles.fieldGroup}>
    {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
    <View style={[styles.fieldShell, error ? styles.fieldShellError : null]}>
      {icon ? <Ionicons color={colors.inkMuted} name={icon} size={20} /> : null}
      <TextInput
        {...props}
        autoCapitalize={props.autoCapitalize ?? 'none'}
        placeholderTextColor={colors.inkMuted}
        selectionColor={colors.teal}
        style={[styles.field, props.style]}
      />
    </View>
    {error ? <Text style={styles.fieldError}>{error}</Text> : null}
  </View>
);

export const Loading = () => (
  <View accessibilityLabel="loading" style={styles.loading}>
    <ActivityIndicator color={colors.teal} size="large" />
  </View>
);

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ value: T; label: string; icon?: IconName }>;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            accessibilityRole="button"
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.segment, selected && styles.segmentSelected]}
          >
            {option.icon ? (
              <Ionicons
                color={selected ? colors.white : colors.inkSoft}
                name={option.icon}
                size={18}
              />
            ) : null}
            <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export const ActionTile = ({
  icon,
  title,
  subtitle,
  onPress,
  accent = 'teal',
}: {
  icon: IconName;
  title: string;
  subtitle?: string;
  onPress: () => void;
  accent?: 'teal' | 'coral' | 'amber';
}) => {
  const accentColors = {
    teal: [colors.tealLight, colors.tealDark],
    coral: [colors.coralSoft, colors.coral],
    amber: [colors.amberSoft, colors.amber],
  } as const;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.actionTile, pressed && styles.dimmed]}
    >
      <View style={[styles.actionIcon, { backgroundColor: accentColors[accent][0] }]}>
        <Ionicons color={accentColors[accent][1]} name={icon} size={24} />
      </View>
      <Text style={styles.actionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.actionSubtitle}>{subtitle}</Text> : null}
      <Ionicons color={colors.inkMuted} name="arrow-forward" size={18} />
    </Pressable>
  );
};

export const BalanceCard = ({
  label,
  balance,
  currency,
  footer,
}: {
  label: string;
  balance?: number;
  currency?: string;
  footer?: ReactNode;
}) => (
  <LinearGradient
    colors={[colors.tealDark, colors.teal, '#15A992']}
    end={{ x: 1, y: 1 }}
    start={{ x: 0, y: 0 }}
    style={styles.balanceCard}
  >
    <View style={styles.balanceOrbOne} />
    <View style={styles.balanceOrbTwo} />
    <Text style={styles.balanceLabel}>{label}</Text>
    {balance === undefined ? (
      <ActivityIndicator color={colors.white} size="large" style={{ alignSelf: 'flex-start' }} />
    ) : (
      <Text accessibilityLabel={label} style={styles.balanceValue}>
        {balance.toFixed(2)} <Text style={styles.balanceCurrency}>{currency}</Text>
      </Text>
    )}
    {footer ? <View style={styles.balanceFooter}>{footer}</View> : null}
  </LinearGradient>
);

export const Pill = ({
  children,
  tone = 'neutral',
}: PropsWithChildren<{ tone?: 'neutral' | 'success' | 'warning' | 'danger' }>) => (
  <View style={[styles.pill, styles[`${tone}Pill`]]}>
    <Text style={[styles.pillText, styles[`${tone}PillText`]]}>{children}</Text>
  </View>
);

export const InfoBanner = ({
  children,
  icon = 'information-circle-outline',
  tone = 'info',
}: PropsWithChildren<{ icon?: IconName; tone?: 'info' | 'success' | 'warning' }>) => (
  <View style={[styles.banner, styles[`${tone}Banner`]]}>
    <Ionicons
      color={tone === 'success' ? colors.success : tone === 'warning' ? colors.amber : colors.teal}
      name={icon}
      size={22}
    />
    <Text style={styles.bannerText}>{children}</Text>
  </View>
);

const styles = StyleSheet.create({
  button: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    paddingHorizontal: spacing.xl,
  },
  primaryButton: { backgroundColor: colors.teal },
  dangerButton: { backgroundColor: colors.danger },
  secondaryButton: { backgroundColor: colors.tealLight },
  ghostButton: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },
  dimmed: { opacity: 0.58 },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  secondaryButtonText: { color: colors.tealDark },
  fieldGroup: { gap: 7 },
  fieldLabel: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  fieldShell: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.lg,
  },
  fieldShellError: { borderColor: colors.danger },
  field: { flex: 1, color: colors.ink, fontSize: 16, paddingVertical: spacing.md },
  fieldError: { color: colors.danger, fontSize: 12, lineHeight: 17 },
  loading: { minHeight: 80, alignItems: 'center', justifyContent: 'center' },
  segmented: {
    flexDirection: 'row',
    gap: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.xs,
  },
  segment: {
    minHeight: 44,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
  },
  segmentSelected: { backgroundColor: colors.teal },
  segmentText: { color: colors.inkSoft, fontSize: 14, fontWeight: '700' },
  segmentTextSelected: { color: colors.white },
  actionTile: {
    minHeight: 154,
    flex: 1,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    padding: spacing.lg,
    ...shadows.card,
  },
  actionIcon: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  actionTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  actionSubtitle: { flex: 1, color: colors.inkSoft, fontSize: 12, lineHeight: 17 },
  balanceCard: {
    minHeight: 190,
    overflow: 'hidden',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.xl,
    padding: spacing.xxl,
    ...shadows.card,
  },
  balanceOrbOne: {
    position: 'absolute',
    top: -60,
    right: -40,
    width: 190,
    height: 190,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  balanceOrbTwo: {
    position: 'absolute',
    right: 70,
    bottom: -110,
    width: 170,
    height: 170,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  balanceLabel: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  balanceValue: { color: colors.white, fontSize: 36, fontWeight: '800', letterSpacing: -1 },
  balanceCurrency: { fontSize: 17, fontWeight: '700' },
  balanceFooter: { marginTop: spacing.md },
  pill: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  neutralPill: { backgroundColor: colors.surfaceMuted },
  successPill: { backgroundColor: colors.successSoft },
  warningPill: { backgroundColor: colors.amberSoft },
  dangerPill: { backgroundColor: colors.dangerSoft },
  pillText: { fontSize: 12, fontWeight: '800' },
  neutralPillText: { color: colors.inkSoft },
  successPillText: { color: colors.success },
  warningPillText: { color: '#996000' },
  dangerPillText: { color: colors.danger },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  infoBanner: { backgroundColor: colors.tealLight },
  successBanner: { backgroundColor: colors.successSoft },
  warningBanner: { backgroundColor: colors.amberSoft },
  bannerText: { flex: 1, color: colors.inkSoft, fontSize: 13, lineHeight: 19 },
});
