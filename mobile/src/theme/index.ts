export const colors = {
  ink: '#102A43',
  inkSoft: '#486581',
  inkMuted: '#829AB1',
  canvas: '#F5F8F7',
  surface: '#FFFFFF',
  surfaceMuted: '#EAF4F1',
  teal: '#008C7A',
  tealDark: '#00695C',
  tealLight: '#D8F3ED',
  coral: '#FF6B5D',
  coralSoft: '#FFE8E4',
  amber: '#F5A524',
  amberSoft: '#FFF3D6',
  success: '#1F9D6A',
  successSoft: '#DDF7EC',
  danger: '#D64545',
  dangerSoft: '#FDE8E8',
  border: '#D9E2EC',
  white: '#FFFFFF',
  black: '#000000',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radius = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999,
} as const;

export const shadows = {
  card: {
    shadowColor: colors.ink,
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
} as const;
