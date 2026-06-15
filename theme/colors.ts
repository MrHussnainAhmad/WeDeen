// WeDeen design tokens — "Emerald & Gold Heritage"
// Backward compatible: original keys (bg, card, text, muted, primary, border) preserved.

export const colors = {
  // Surfaces
  bg: '#F6F1E7',          // warm ivory "paper"
  bgDeep: '#EFE7D6',      // slightly deeper paper for contrast bands
  card: '#FFFFFF',
  cardAlt: '#FBF7EE',     // cream card for nested blocks

  // Text
  text: '#1B2A23',        // near-black green
  muted: '#6A7B72',       // muted sage
  faint: '#9AA8A0',       // very soft labels

  // Brand — emerald
  primary: '#0B6B4F',     // deep emerald
  primaryDark: '#084A37', // forest
  primaryDeep: '#063528', // darkest emerald (gradients/headers)
  primarySoft: '#E7F1EC', // emerald wash
  primaryTint: '#D2E6DD', // emerald border tint

  // Accent — gold
  gold: '#C59B27',        // antique gold
  goldDeep: '#A37E16',    // darker gold for text on light
  goldSoft: '#FAF3E1',    // gold wash
  goldBorder: '#E9D9AE',  // gold hairline

  // Lines
  border: '#E6DECB',      // warm hairline
  borderSoft: '#EFE9DA',

  // States
  danger: '#A8321F',
  dangerSoft: '#FBEAE6',
  success: '#0B6B4F',

  // On-dark
  onDark: '#FFFFFF',
  onDarkMuted: 'rgba(255,255,255,0.78)',
  onDarkFaint: 'rgba(255,255,255,0.16)',
};

export const fonts = {
  arabic: 'KFGQPCNastaleeq',
  urdu: 'NotoNastaliqUrdu',
  sans: 'NotoSans',
  serif: 'NotoSerif',     // for elegant English headings
  serifDisplay: 'Lora',   // display serif
};

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};

// Soft, warm shadow used across cards for a crafted, layered feel.
export const shadow = {
  card: {
    shadowColor: '#3A2E12',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
  soft: {
    shadowColor: '#3A2E12',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  raised: {
    shadowColor: '#063528',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 8,
  },
};

export const gradients = {
  emerald: ['#0B6B4F', '#084A37', '#063528'] as const,
  emeraldSoft: ['#0E7556', '#0B6B4F'] as const,
};
