import { createTheme, ThemeOptions } from '@mui/material/styles';

interface ColorSet {
  main: string;
  light: string;
  dark: string;
  secondary: string;
  secondaryLight: string;
  secondaryDark: string;
}

const BUSINESS_COLORS: Record<string, ColorSet> = {
  it_support: {
    main: '#2563eb', light: '#60a5fa', dark: '#1d4ed8',
    secondary: '#7c3aed', secondaryLight: '#a78bfa', secondaryDark: '#6d28d9',
  },
  professional_studio: {
    main: '#059669', light: '#34d399', dark: '#047857',
    secondary: '#0891b2', secondaryLight: '#67e8f9', secondaryDark: '#0e7490',
  },
  agency: {
    main: '#7c3aed', light: '#a78bfa', dark: '#6d28d9',
    secondary: '#db2777', secondaryLight: '#f9a8d4', secondaryDark: '#be185d',
  },
  other: {
    main: '#ea580c', light: '#fb923c', dark: '#c2410c',
    secondary: '#ca8a04', secondaryLight: '#fcd34d', secondaryDark: '#a16207',
  },
};

const DEFAULT_COLORS = BUSINESS_COLORS.it_support;

const hexToRgb = (hex: string) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
};

const getDesignTokens = (mode: 'light' | 'dark', c: ColorSet = DEFAULT_COLORS): ThemeOptions => ({
  palette: {
    mode,
    primary: {
      main: c.main,
      light: c.light,
      dark: c.dark,
      contrastText: '#ffffff',
    },
    secondary: {
      main: c.secondary,
      light: c.secondaryLight,
      dark: c.secondaryDark,
      contrastText: '#ffffff',
    },
    error: {
      main: '#ef4444',
      light: '#fca5a5',
      dark: '#b91c1c',
    },
    warning: {
      main: '#f59e0b',
      light: '#fcd34d',
      dark: '#b45309',
    },
    info: {
      main: '#0ea5e9',
      light: '#7dd3fc',
      dark: '#0369a1',
    },
    success: {
      main: '#10b981',
      light: '#6ee7b7',
      dark: '#059669',
    },
    background: {
      default: mode === 'light' ? '#f8faff' : '#0f1117',
      paper:   mode === 'light' ? '#ffffff'  : '#1a1d27',
    },
    text: {
      primary:   mode === 'light' ? '#111827' : '#f9fafb',
      secondary: mode === 'light' ? '#6b7280' : '#9ca3af',
    },
    divider: mode === 'light' ? '#f3f4f6' : '#1f2937',
  },
  typography: {
    fontFamily: '"Plus Jakarta Sans", "Inter", "Helvetica", "Arial", sans-serif',
    h1: { fontSize: '2.5rem', fontWeight: 800, letterSpacing: '-0.02em' },
    h2: { fontSize: '2rem',   fontWeight: 800, letterSpacing: '-0.02em' },
    h3: { fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.01em' },
    h4: { fontSize: '1.5rem',  fontWeight: 700, letterSpacing: '-0.01em' },
    h5: { fontSize: '1.25rem', fontWeight: 700 },
    h6: { fontSize: '1rem',    fontWeight: 700 },
    subtitle1: { fontSize: '1rem',     fontWeight: 600 },
    subtitle2: { fontSize: '0.875rem', fontWeight: 600 },
    body1: { fontSize: '0.9375rem', letterSpacing: 0 },
    body2: { fontSize: '0.875rem',  letterSpacing: 0 },
    button: { textTransform: 'none', fontWeight: 700, letterSpacing: 0 },
    caption: { fontSize: '0.75rem', fontWeight: 500 },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '10px',
          padding: '8px 18px',
          fontWeight: 700,
          boxShadow: 'none',
          '&:hover': { boxShadow: 'none' },
        },
        contained: {
          background: `linear-gradient(135deg, ${c.main}, ${c.secondary})`,
          '&:hover': {
            background: `linear-gradient(135deg, ${c.dark}, ${c.secondaryDark})`,
          },
        },
        containedPrimary: {
          background: `linear-gradient(135deg, ${c.main}, ${c.secondary})`,
          '&:hover': {
            background: `linear-gradient(135deg, ${c.dark}, ${c.secondaryDark})`,
          },
        },
        outlined: {
          borderWidth: '1.5px',
          '&:hover': { borderWidth: '1.5px' },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: mode === 'light'
            ? '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.03)'
            : 'none',
          border: mode === 'light' ? '1px solid #f3f4f6' : '1px solid #1f2937',
          borderRadius: '16px',
          transition: 'box-shadow 0.2s, transform 0.2s',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: 'none',
          borderBottom: mode === 'light' ? '1px solid #f3f4f6' : '1px solid #1f2937',
          backgroundColor: mode === 'light' ? 'rgba(255,255,255,0.85)' : 'rgba(26,29,39,0.85)',
          backdropFilter: 'blur(16px)',
          color: mode === 'light' ? '#111827' : '#f9fafb',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRight: mode === 'light' ? '1px solid #f3f4f6' : '1px solid #1f2937',
          backgroundColor: mode === 'light' ? '#ffffff' : '#1a1d27',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: mode === 'light' ? '1px solid #f3f4f6' : '1px solid #1f2937',
          fontSize: '0.875rem',
        },
        head: {
          fontWeight: 700,
          backgroundColor: mode === 'light' ? '#f8faff' : '#0f1117',
          color: mode === 'light' ? '#6b7280' : '#9ca3af',
          fontSize: '0.75rem',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: '8px',
          fontWeight: 600,
          fontSize: '0.75rem',
        },
        filled: {
          '&.MuiChip-colorPrimary': {
            background: mode === 'light'
              ? `rgba(${hexToRgb(c.main)}, 0.12)`
              : `rgba(${hexToRgb(c.main)}, 0.2)`,
            color: c.main,
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: '10px',
            '& fieldset': {
              borderColor: mode === 'light' ? '#e5e7eb' : '#374151',
              borderWidth: '1.5px',
            },
            '&:hover fieldset': {
              borderColor: mode === 'light' ? '#9ca3af' : '#6b7280',
            },
            '&.Mui-focused fieldset': {
              borderColor: c.main,
              borderWidth: '2px',
            },
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
        elevation1: {
          boxShadow: mode === 'light'
            ? '0 4px 20px rgba(0,0,0,0.08)'
            : '0 4px 20px rgba(0,0,0,0.4)',
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: '10px',
          marginBottom: '2px',
          '&.Mui-selected': {
            background: `linear-gradient(135deg, ${c.main}, ${c.secondary})`,
            color: '#ffffff',
            '& .MuiListItemIcon-root': { color: '#ffffff' },
            '& .MuiListItemText-primary': { color: '#ffffff' },
            '&:hover': {
              background: `linear-gradient(135deg, ${c.dark}, ${c.secondaryDark})`,
            },
          },
          '&:hover': {
            backgroundColor: mode === 'light' ? '#f3f4f6' : '#1f2937',
          },
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: mode === 'light' ? '#f3f4f6' : '#1f2937',
        },
      },
    },
    MuiAvatar: {
      styleOverrides: {
        root: {
          background: `linear-gradient(135deg, ${c.main}, ${c.secondary})`,
        },
      },
    },
    MuiBadge: {
      styleOverrides: {
        badge: {
          fontWeight: 700,
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          borderRadius: '8px',
          fontSize: '0.75rem',
          fontWeight: 600,
          backgroundColor: mode === 'light' ? '#111827' : '#f9fafb',
          color: mode === 'light' ? '#f9fafb' : '#111827',
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: '12px',
          fontWeight: 500,
        },
      },
    },
  },
});

export function createAppTheme(mode: 'light' | 'dark', businessType?: string | null) {
  const colors = (businessType ? BUSINESS_COLORS[businessType] : undefined) ?? DEFAULT_COLORS;
  return createTheme(getDesignTokens(mode, colors));
}

export const lightTheme = createAppTheme('light');
export const darkTheme  = createAppTheme('dark');
