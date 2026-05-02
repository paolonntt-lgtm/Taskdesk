import { createTheme, ThemeOptions } from '@mui/material/styles';

const getDesignTokens = (mode: 'light' | 'dark'): ThemeOptions => ({
  palette: {
    mode,
    primary: {
      main: '#0f62fe', // IBM Blue
      light: '#4589ff',
      dark: '#0043ce',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#8a3ffc', // Purple
      light: '#a56eff',
      dark: '#6929c4',
      contrastText: '#ffffff',
    },
    error: {
      main: '#da1e28',
      light: '#ff8389',
      dark: '#a2191f',
    },
    warning: {
      main: '#f1c21b',
      light: '#f8d053',
      dark: '#b28600',
    },
    info: {
      main: '#0043ce',
    },
    success: {
      main: '#24a148',
    },
    background: {
      default: mode === 'light' ? '#f4f4f4' : '#161616',
      paper: mode === 'light' ? '#ffffff' : '#262626',
    },
    text: {
      primary: mode === 'light' ? '#161616' : '#f4f4f4',
      secondary: mode === 'light' ? '#525252' : '#c6c6c6',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontSize: '2.5rem', fontWeight: 600 },
    h2: { fontSize: '2rem', fontWeight: 600 },
    h3: { fontSize: '1.75rem', fontWeight: 600 },
    h4: { fontSize: '1.5rem', fontWeight: 600 },
    h5: { fontSize: '1.25rem', fontWeight: 600 },
    h6: { fontSize: '1rem', fontWeight: 600 },
    subtitle1: { fontSize: '1rem', fontWeight: 500 },
    subtitle2: { fontSize: '0.875rem', fontWeight: 500 },
    body1: { fontSize: '1rem', letterSpacing: '0.00938em' },
    body2: { fontSize: '0.875rem', letterSpacing: '0.01071em' },
    button: { textTransform: 'none', fontWeight: 500 },
  },
  shape: {
    borderRadius: 4,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '4px',
          padding: '8px 16px',
        },
        contained: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: mode === 'light' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
          border: mode === 'light' ? '1px solid #e0e0e0' : '1px solid #393939',
          borderRadius: '8px',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: 'none',
          borderBottom: mode === 'light' ? '1px solid #e0e0e0' : '1px solid #393939',
          backgroundColor: mode === 'light' ? '#ffffff' : '#262626',
          color: mode === 'light' ? '#161616' : '#f4f4f4',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRight: mode === 'light' ? '1px solid #e0e0e0' : '1px solid #393939',
          backgroundColor: mode === 'light' ? '#ffffff' : '#262626',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: mode === 'light' ? '1px solid #e0e0e0' : '1px solid #393939',
        },
        head: {
          fontWeight: 600,
          backgroundColor: mode === 'light' ? '#f4f4f4' : '#161616',
        },
      },
    },
  },
});

export const lightTheme = createTheme(getDesignTokens('light'));
export const darkTheme = createTheme(getDesignTokens('dark'));
