import type { PropsWithChildren } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, shadows, spacing } from '../theme';

export const Screen = ({
  children,
  scroll = false,
  style,
}: PropsWithChildren<{ scroll?: boolean; style?: ViewStyle }>) => {
  const content = <View style={[styles.content, style]}>{children}</View>;
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.decorTop} />
      <View style={styles.decorSide} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboard}
      >
        {scroll ? (
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {content}
          </ScrollView>
        ) : (
          content
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export const Title = ({ children }: PropsWithChildren) => (
  <Text style={styles.title}>{children}</Text>
);

export const Eyebrow = ({ children }: PropsWithChildren) => (
  <Text style={styles.eyebrow}>{children}</Text>
);

export const SectionTitle = ({ children }: PropsWithChildren) => (
  <Text style={styles.sectionTitle}>{children}</Text>
);

export const Muted = ({ children }: PropsWithChildren) => (
  <Text style={styles.muted}>{children}</Text>
);

export const Card = ({
  children,
  style,
}: PropsWithChildren<{
  style?: ViewStyle;
}>) => <View style={[styles.card, style]}>{children}</View>;

export const Row = ({ children, style }: PropsWithChildren<{ style?: ViewStyle }>) => (
  <View style={[styles.row, style]}>{children}</View>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  keyboard: { flex: 1 },
  scroll: { flexGrow: 1, paddingBottom: spacing.xxxl },
  content: { flex: 1, gap: spacing.lg, padding: spacing.xl },
  decorTop: {
    position: 'absolute',
    top: -100,
    right: -90,
    width: 260,
    height: 260,
    borderRadius: 150,
    backgroundColor: 'rgba(0,140,122,0.06)',
  },
  decorSide: {
    position: 'absolute',
    left: -110,
    top: 310,
    width: 180,
    height: 180,
    borderRadius: 100,
    backgroundColor: 'rgba(255,107,93,0.05)',
  },
  title: {
    color: colors.ink,
    fontSize: 30,
    fontWeight: '800',
    lineHeight: 36,
    letterSpacing: -0.6,
  },
  eyebrow: {
    color: colors.teal,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: '800' },
  muted: { color: colors.inkSoft, fontSize: 15, lineHeight: 22 },
  card: {
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    padding: spacing.xl,
    ...shadows.card,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
