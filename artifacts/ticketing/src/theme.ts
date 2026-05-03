import { createTheme, ThemeOptions } from '@mui/material/styles';

const getDesignTokens = (mode: 'light' | 'dark'): ThemeOptions => ({
  palette: {
    mode,
    primary: {
      main: '#2563eb',
      light: '#60a5fa',
      dark: '#1d4ed8',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#7c3aed',
      light: '#a78bfa',
      dark: '#5b21b6',
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
          background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
          '&:hover': {
            background: 'linear-gradient(135deg, #1d4ed8, #6d28d9)',
          },
        },
        containedPrimary: {
          background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
          '&:hover': {
            background: 'linear-gradient(135deg, #1d4ed8, #6d28d9)',
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
            background: 'linear-gradient(135deg, #dbeafe, #ede9fe)',
            color: '#2563eb',
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
              borderColor: '#2563eb',
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
            background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
            color: '#ffffff',
            '& .MuiListItemIcon-root': { color: '#ffffff' },
            '& .MuiListItemText-primary': { color: '#ffffff' },
            '&:hover': {
              background: 'linear-gradient(135deg, #1d4ed8, #6d28d9)',
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
          background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
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

export const lightTheme = createTheme(getDesignTokens('light'));
export const darkTheme  = createTheme(getDesignTokens('dark'));
