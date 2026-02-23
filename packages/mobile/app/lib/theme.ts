/**
 * Polka Mobile App - Theme System
 *
 * Centralized color management system with support for light and dark modes.
 * All colors used throughout the app are defined here for easy maintenance
 * and consistent theming.
 */

export type ColorScheme = 'light' | 'dark';

export interface ThemeColors {
  // Primary/Brand Colors
  primary: string;
  accent: string;

  // Background Colors
  background: {
    primary: string;        // Main app background
    secondary: string;      // Secondary surfaces
    tertiary: string;       // Cards, items
    elevated: string;       // Raised surfaces
    input: string;          // Input fields
    overlay: string;        // Overlay backgrounds
    loading: string;        // Loading screen
  };

  // Surface Colors (for cards, containers, etc.)
  surface: {
    elevated: string;
    item: string;
    cartItem: string;
    button: string;
    selection: string;
    friend: string;
    gradientOverlay: string;
  };

  // Text Colors
  text: {
    primary: string;         // Main text
    secondary: string;       // Secondary text
    tertiary: string;        // Tertiary/hint text
    disabled: string;        // Disabled text
    placeholderDark: string; // Dark placeholder
    inverse: string;         // Text on dark backgrounds
    grey: string;            // Grey text for icons/muted elements
  };

  // Button Colors
  button: {
    primary: string;
    primaryText: string;
    secondary: string;
    secondaryText: string;
    disabled: string;
    disabledText: string;
    checkout: string;
    checkoutText: string;
    delete: string;
    cancel: string;
    registerBackground: string;
    registerText: string;
  };

  // Interactive/Action Colors
  interactive: {
    accept: string;
    reject: string;
    remove: string;
    inactive: string;
    ripple: string;
  };

  // Status Colors
  status: {
    success: string;
    error: string;
    errorBorder: string;
    errorText: string;
    errorBackground: string;
    warning: string;
    checking: string;
  };

  // Social/Friend Features
  social: {
    acceptLight: string;
    rejectLight: string;
  };

  // Shadow Color
  shadow: {
    default: string;
  };

  // Border Colors
  border: {
    default: string;
    light: string;
    error: string;
    success: string;
    checking: string;
    transparent: string;
    subtle: string;
  };

  // Size Selection
  size: {
    available: string;
    unavailable: string;
    userSize: string;
    selected: string;
    text: string;
  };

  // Gender Selection
  gender: {
    male: string;
    maleSelected: string;
    maleText: string;
    maleTextSelected: string;
    female: string;
    femaleSelected: string;
    femaleText: string;
    femaleTextSelected: string;
    circle: string;
    circleSelected: string;
  };

  // Product Colors (for clothing items)
  product: {
    black: string;
    blue: string;
    brown: string;
    green: string;
    grey: string;
    orange: string;
    pink: string;
    purple: string;
    red: string;
    white: string;
    yellow: string;
    multiColor: string; // For gradient representation
  };

  // Modal/Overlay
  modal: {
    backdrop: string;
    background: string;
  };

  // Gradients (for LinearGradient components)
  gradients: {
    main: string[];
    mainLocations: number[];
    overlay: string[];
    overlayLocations: number[];
    regenerateButtonBorder: string[];
    regenerateButton: string[];
    registerButton: string[];
    friendUsername: string[];
    titleOval: string[];
    titleOvalContainer: string[];
  };
}

// Light Theme Colors
const lightColors: ThemeColors = {
  // Primary/Brand Colors
  primary: '#CDA67A',
  accent: '#C8A688',

  // Background Colors
  background: {
    primary: '#F2ECE7',
    secondary: '#E2CCB2',
    tertiary: '#EDE7E2',
    elevated: '#F3E6D6',
    input: '#E0D6CC',
    overlay: 'rgba(205, 166, 122, 0.4)',
    loading: '#F3E6D6',
  },

  // Surface Colors
  surface: {
    elevated: '#DCBF9D',
    item: '#EDE7E2',
    cartItem: '#E2CCB2',
    button: '#E2CCB2',
    selection: '#DCC1A5',
    friend: '#F5ECE1',
    gradientOverlay: 'rgba(205, 166, 122, 0.5)',
  },

  // Text Colors
  text: {
    primary: '#000000',
    secondary: '#4A3120',
    tertiary: '#6A462F',
    disabled: 'rgba(0, 0, 0, 0.4)',
    placeholderDark: 'rgba(0, 0, 0, 1)',
    inverse: '#FFFFFF',
    grey: '#808080',
  },

  // Button Colors
  button: {
    primary: '#4A3120',
    primaryText: '#F2ECE7',
    secondary: '#DCBF9D',
    secondaryText: '#000000',
    disabled: 'rgba(205, 166, 122, 0.4)',
    disabledText: 'rgba(0, 0, 0, 0.37)',
    checkout: '#98907E',
    checkoutText: '#FFFFF5',
    delete: '#E2B4B3',
    cancel: '#C8A688',
    registerBackground: '#DCD3DE',
    registerText: '#A000B0',
  },

  // Interactive/Action Colors
  interactive: {
    accept: '#A8E6BB',
    reject: '#E9A5AA',
    remove: 'rgba(230, 109, 123, 0.54)',
    inactive: '#BDBDBD',
    ripple: 'rgba(205, 166, 122, 0.3)',
  },

  // Status Colors
  status: {
    success: '#00AA00',
    error: '#D32F2F',
    errorBorder: 'rgba(255, 100, 100, 0.7)',
    errorText: '#FF6464',
    errorBackground: 'rgba(255, 100, 100, 0.2)',
    warning: '#FFA500',
    checking: '#FFA500',
  },

  // Social/Friend Features
  social: {
    acceptLight: '#A3FFD0',
    rejectLight: '#FC8CAF',
  },

  // Shadow Color
  shadow: {
    default: '#000000',
  },

  // Border Colors
  border: {
    default: 'rgba(205, 166, 122, 0.4)',
    light: '#eee',
    error: 'rgba(255, 100, 100, 0.7)',
    success: 'rgba(0, 170, 0, 0.7)',
    checking: 'rgba(255, 165, 0, 0.7)',
    transparent: 'transparent',
    subtle: 'rgba(106, 70, 47, 0.15)',
  },

  // Size Selection
  size: {
    available: '#E2CCB2',
    unavailable: '#BFBBB8',
    userSize: '#CDA67A',
    selected: '#4A3120',
    text: '#000000',
  },

  // Gender Selection
  gender: {
    male: '#E0D6CC',
    maleSelected: '#4A3120',
    maleText: '#9A7859',
    maleTextSelected: '#9A7859',
    female: '#9A7859',
    femaleSelected: '#9A7859',
    femaleText: '#E0D6CC',
    femaleTextSelected: '#E0D6CC',
    circle: '#DEC2A1',
    circleSelected: '#C5A077',
  },

  // Product Colors
  product: {
    black: '#000000',
    blue: '#0000FF',
    brown: '#964B00',
    green: '#008000',
    grey: '#808080',
    orange: '#FFA500',
    pink: '#FFC0CB',
    purple: '#800080',
    red: '#FF0000',
    white: '#FFFFFF',
    yellow: '#FFFF00',
    multiColor: 'linear-gradient(to right, red, orange, yellow, green, blue, indigo, violet)',
  },

  // Modal/Overlay
  modal: {
    backdrop: 'rgba(0, 0, 0, 0.5)',
    background: '#F2ECE7',
  },

  // Gradients
  gradients: {
    main: ['#FAE9CF', '#CCA479', '#CDA67A', '#6A462F'],
    mainLocations: [0, 0.34, 0.5, 0.87],
    overlay: ['rgba(205, 166, 122, 0.5)', 'transparent'],
    overlayLocations: [0.2, 1],
    regenerateButtonBorder: ['#FC8CAF', '#9EA7FF', '#A3FFD0'],
    regenerateButton: ['#E222F0', '#4747E4', '#E66D7B'],
    registerButton: ['#DCD3DE', '#9535EA', '#E222F0'],
    friendUsername: ['#FFFFFF8F', '#FF10FB59', '#0341EA6B'],
    titleOval: ['#F5ECE14D', '#F5ECE1'],
    titleOvalContainer: ['#F5ECE1', '#DFCAB5'],
  },
};

// Dark Theme Colors - Based on color mapping table
const darkColors: ThemeColors = {
  // Primary/Brand Colors
  primary: '#806B59',
  accent: '#806B59',

  // Background Colors
  background: {
    primary: '#261E1A',
    secondary: '#3D3028',
    tertiary: '#261E1A',
    elevated: '#3D3028',
    input: '#3D3028',
    overlay: 'rgba(205, 166, 122, 0.4)',
    loading: '#261E1A',
  },

  // Surface Colors
  surface: {
    elevated: '#3D3028',
    item: '#3D3028',
    cartItem: '#3D3028',
    button: '#3D3028',
    selection: '#261E1A',
    friend: '#3D3028',
    gradientOverlay: 'rgba(38, 30, 26, 0.5)',
  },

  // Text Colors
  text: {
    primary: '#F5EDE4',
    secondary: '#C4A882',
    tertiary: '#B89B78',
    disabled: 'rgba(245, 237, 228, 0.65)',
    placeholderDark: 'rgba(245, 237, 228, 1)',
    inverse: '#F5EDE4',
    grey: '#9A8878',
  },

  // Button Colors
  button: {
    primary: '#806B59',
    primaryText: '#F5EDE4',
    secondary: '#3D3028',
    secondaryText: '#F5EDE4',
    disabled: 'rgba(205, 166, 122, 0.4)',
    disabledText: 'rgba(255, 255, 255, 0.37)',
    checkout: '#3D3028',
    checkoutText: '#F5EDE4',
    delete: '#E2B4B3',
    cancel: '#3D3028',
    registerBackground: '#DCD3DE',
    registerText: '#A000B0',
  },

  // Interactive/Action Colors
  interactive: {
    accept: '#A8E6BB',
    reject: '#E9A5AA',
    remove: 'rgba(202, 78, 94, 1)',
    inactive: '#BDBDBD',
    ripple: 'rgba(205, 166, 122, 0.3)',
  },

  // Status Colors
  status: {
    success: '#00AA00',
    error: '#D32F2F',
    errorBorder: 'rgba(255, 100, 100, 0.7)',
    errorText: '#FF6464',
    errorBackground: 'rgba(255, 100, 100, 0.2)',
    warning: '#FFA500',
    checking: '#FFA500',
  },

  // Social/Friend Features
  social: {
    acceptLight: '#A3FFD0',
    rejectLight: '#FC8CAF',
  },

  // Shadow Color
  shadow: {
    default: '#000000',
  },

  // Border Colors
  border: {
    default: 'rgba(128, 107, 89, 0.4)',
    light: '#3D3028',
    error: 'rgba(255, 100, 100, 0.7)',
    success: 'rgba(0, 170, 0, 0.7)',
    checking: 'rgba(255, 165, 0, 0.7)',
    transparent: 'transparent',
    subtle: 'rgba(61, 48, 40, 0.6)',
  },

  // Size Selection
  size: {
    available: '#3D3028',
    unavailable: '#261E1A',
    userSize: '#806B59',
    selected: '#806B59',
    text: '#FFFFFF',
  },

  // Gender Selection
  gender: {
    male: '#52453C',
    maleSelected: '#4A3120',
    maleText: '#6A462F',
    maleTextSelected: '#6A462F',
    female: '#6A462F',
    femaleSelected: '#6A462F',
    femaleText: '#52453C',
    femaleTextSelected: '#52453C',
    circle: '#382E28',
    circleSelected: '#6A462F',
  },

  // Product Colors (unchanged - these remain consistent across themes)
  product: {
    black: '#000000',
    blue: '#0000FF',
    brown: '#964B00',
    green: '#008000',
    grey: '#808080',
    orange: '#FFA500',
    pink: '#FFC0CB',
    purple: '#800080',
    red: '#FF0000',
    white: '#FFFFFF',
    yellow: '#FFFF00',
    multiColor: 'linear-gradient(to right, red, orange, yellow, green, blue, indigo, violet)',
  },

  // Modal/Overlay
  modal: {
    backdrop: 'rgba(0, 0, 0, 0.5)',
    background: '#261E1A',
  },

  // Gradients
  gradients: {
    main: ['#3D3028', '#261E1A', '#1F1713', '#130E0B'],
    mainLocations: [0, 0.34, 0.5, 0.87],
    overlay: ['rgba(128, 107, 89, 0.25)', 'transparent'],
    overlayLocations: [0.2, 1],
    regenerateButtonBorder: ['#FC8CAF', '#9EA7FF', '#A3FFD0'],
    regenerateButton: ['#E222F0', '#4747E4', '#E66D7B'],
    registerButton: ['#DCD3DE', '#9535EA', '#E222F0'],
    friendUsername: ['#FFFFFF8F', '#FF10FB59', '#0341EA6B'],
    titleOval: ['#3D30284D', '#3D3028'],
    titleOvalContainer: ['#3D3028', '#261E1A'],
  },
};

// Theme management
let currentColorScheme: ColorScheme = 'light';

export const getTheme = (): ThemeColors => {
  return currentColorScheme === 'light' ? lightColors : darkColors;
};

export const setColorScheme = (scheme: ColorScheme): void => {
  currentColorScheme = scheme;
};

export const getCurrentColorScheme = (): ColorScheme => {
  return currentColorScheme;
};

// Helper function to get specific color by path
export const getColor = (path: string): string => {
  const theme = getTheme();
  const keys = path.split('.');
  let value: any = theme;

  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key];
    } else {
      console.warn(`Color path "${path}" not found in theme`);
      return '#000000'; // Fallback color
    }
  }

  return typeof value === 'string' ? value : '#000000';
};

// Export color themes
export const theme = {
  light: lightColors,
  dark: darkColors,
};

// Export default (light theme)
export default lightColors;
