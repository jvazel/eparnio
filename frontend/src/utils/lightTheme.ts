/**
 * Référentiel figé et immuable des Design Tokens, couleurs et classes du Thème Clair par défaut (Finzee / Eparnio).
 * Sert de source de vérité et de garde-fou anti-régression avant toute extension vers le thème sombre.
 */
export const LIGHT_THEME_TOKENS = {
  surfaces: {
    appBackground: '#F6F7FB',
    appBackgroundClass: 'bg-[#F6F7FB]',
    cardBackground: '#FFFFFF',
    cardBackgroundClass: 'bg-white',
    cardBorder: 'rgba(241, 245, 249, 0.8)',
    cardBorderClass: 'border-slate-100/80',
    cardShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.05)',
    cardShadowClass: 'shadow-card',
    sheetBackground: '#FFFFFF',
    sheetBackdrop: 'rgba(15, 23, 42, 0.5)',
    subtleSurface: '#F8FAFC',
    subtleSurfaceClass: 'bg-slate-50',
    mutedSurface: '#F1F5F9',
    mutedSurfaceClass: 'bg-slate-100'
  },
  text: {
    primary: '#0F172A',
    primaryDarkAlt: '#111827',
    primaryClass: 'text-slate-900',
    secondary: '#334155',
    secondaryClass: 'text-slate-700',
    muted: '#64748B',
    mutedAlt: '#6B7280',
    mutedClass: 'text-slate-500',
    inactiveNav: '#94A3B8',
    inactiveNavClass: 'text-slate-400'
  },
  brand: {
    violetPrimary: '#7C3AED',
    allocationFixedViolet: '#8B5CF6',
    avatarViolet: '#8B3DFF',
    actionBlue: '#1D7DFA',
    gaugeBlue: '#3B82F6',
    gaugeTrack: '#E5E7EB'
  },
  semantic: {
    successGreen: '#22C55E',
    warningAmber: '#F59E0B',
    dangerRed: '#EF4444'
  },
  creationSwatches: [
    '#FCE96A',
    '#075985',
    '#16A34A',
    '#6EE7B7',
    '#38BDF8',
    '#4F46E5',
    '#F472B6',
    '#34D399',
    '#FB923C',
    '#F87171',
    '#E879F9',
    '#FBBF24',
    '#14B8A6',
    '#8B5CF6',
    '#EC4899',
    '#64748B',
    '#EF4444',
    '#F97316',
    '#84CC16',
    '#06B6D4',
    '#3B82F6',
    '#A855F7',
    '#F43F5E',
    '#78716C'
  ],
  pastelEnvelopes: {
    mint: { background: '#CBEAD6', ring: '#16A34A', altRing: '#15803D' },
    glacier: { background: '#D6F0F3', ring: '#0EA5E9', deepRing: '#0284C7' },
    powderPink: { background: '#F8D4E6', ring: '#EC4899' },
    vanilla: { background: '#FEF0C7', ring: '#F59E0B' },
    lavender: { background: '#EDE9FE', ring: '#7C3AED' }
  },
  cashFlowBadges: {
    income: 'bg-blue-50 text-blue-600',
    fixed: 'bg-violet-50 text-violet-600',
    variable: 'bg-indigo-50 text-indigo-600',
    savings: 'bg-sky-50 text-sky-600',
    remaining: 'bg-emerald-50 text-emerald-600'
  }
} as const;
