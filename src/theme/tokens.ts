import { Appearance } from 'react-native';

// "Vivo andino": fondo luminoso, esmeralda vivo y acentos de textil
// (fucsia, naranja, amarillo sol). El modo noche mantiene el pulso.
// El esquema se decide al arrancar siguiendo al sistema; un cambio de tema
// del SO se aplica al reiniciar (los StyleSheet estáticos se congelan).
const light = {
  primary: '#12A150',
  primaryLight: '#3DBE74',
  primaryFaint: '#E3F6EB',
  accent: '#FF8A3D',
  accentFaint: '#FFEDDE',
  festive: '#F4478F',
  festiveFaint: '#FDE4EF',
  gold: '#E8A712',
  goldFaint: '#FFF3D6',
  sand: '#FBFAF7',
  surface: '#FFFFFF',
  ink: '#1B2620',
  inkMuted: '#5D6E64',
  inkFaint: '#9AA8A0',
  border: '#E4E7E2',
  success: '#12A150',
  warning: '#E8A712',
  danger: '#E0442A',
  dangerFaint: '#FCE7E2',
  donation: '#12A150',
  overlay: 'rgba(20, 30, 24, 0.55)',
};

const dark: typeof light = {
  primary: '#34D57E',
  primaryLight: '#3DBE74',
  primaryFaint: '#153426',
  accent: '#FF9D5C',
  accentFaint: '#3C2716',
  festive: '#FF6BA9',
  festiveFaint: '#3C1B2B',
  gold: '#FFC53D',
  goldFaint: '#3A2F14',
  sand: '#111514',
  surface: '#1C2420',
  ink: '#ECF2ED',
  inkMuted: '#93A79A',
  inkFaint: '#63756A',
  border: '#2B352F',
  success: '#34D57E',
  warning: '#FFC53D',
  danger: '#FF7A5C',
  dangerFaint: '#3D2019',
  donation: '#34D57E',
  overlay: 'rgba(0, 0, 0, 0.65)',
};

export const colorScheme: 'light' | 'dark' = Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';

export const colors = colorScheme === 'dark' ? dark : light;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
} as const;

export const fonts = {
  heading: 'Baloo2_700Bold',
  headingSemi: 'Baloo2_600SemiBold',
  body: 'DMSans_400Regular',
  bodyMedium: 'DMSans_500Medium',
  bodySemi: 'DMSans_700Bold',
} as const;

export const fontSizes = {
  xxl: 28,
  xl: 22,
  lg: 18,
  md: 16,
  sm: 14,
  xs: 12,
} as const;

export const shadows = {
  card: {
    shadowColor: '#1B2620',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: colorScheme === 'dark' ? 0.4 : 0.07,
    shadowRadius: 10,
    elevation: 2,
  },
} as const;
