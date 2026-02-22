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
  // Light #CDA67A -> Dark #261E1A
  primary: '#261E1A',
  // Light #C8A688 -> Similar mapping to primaryVariant
  accent: '#3D322B',

  // Background Colors
  background: {
    // Light #F2ECE7 -> Dark #806B59
    primary: '#806B59',
    // Light #E2CCB2 -> Derived dark shade
    secondary: '#52453C',
    // Light #EDE7E2 -> Dark #EDE7E2 (logo/buttons - unchanged)
    tertiary: '#EDE7E2',
    // Light #F3E6D6 -> Derived dark shade
    elevated: '#52453C',
    // Light #E0D6CC -> Derived dark shade
    input: '#52453C',
    overlay: 'rgba(205, 166, 122, 0.4)',
    loading: '#52453C',
  },

  // Surface Colors
  surface: {
    elevated: '#52453C',
    item: '#EDE7E2',
    cartItem: '#52453C',
    button: '#52453C',
    selection: '#382E28',
    friend: '#52453C',
    gradientOverlay: 'rgba(205, 166, 122, 0.5)',
  },

  // Text Colors
  text: {
    // Light #000000 -> Dark #FFFFFF (inverted)
    primary: '#FFFFFF',
    // Light #4A3120 -> Dark #4A3120 (unchanged - logo/buttons)
    secondary: '#4A3120',
    // Light #6A462F -> Dark #6A462F (unchanged)
    tertiary: '#6A462F',
    disabled: 'rgba(255, 255, 255, 0.4)',
    placeholderDark: 'rgba(255, 255, 255, 1)',
    // Light #FFFFFF -> Dark #000000 (inverted)
    inverse: '#000000',
  },

  // Button Colors
  button: {
    // Light #4A3120 -> Dark #4A3120 (logo/buttons - unchanged)
    primary: '#4A3120',
    // Light #F2ECE7 -> Dark #EDE7E2 (logo/buttons)
    primaryText: '#EDE7E2',
    secondary: '#52453C',
    secondaryText: '#FFFFFF',
    disabled: 'rgba(205, 166, 122, 0.4)',
    disabledText: 'rgba(255, 255, 255, 0.37)',
    checkout: '#4A3E33',
    checkoutText: '#FFFFFF',
    delete: '#E2B4B3',
    cancel: '#261E1A',
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
    default: 'rgba(205, 166, 122, 0.4)',
    light: '#52453C',
    error: 'rgba(255, 100, 100, 0.7)',
    success: 'rgba(0, 170, 0, 0.7)',
    checking: 'rgba(255, 165, 0, 0.7)',
    transparent: 'transparent',
    subtle: 'rgba(106, 70, 47, 0.15)',
  },

  // Size Selection
  size: {
    available: '#52453C',
    unavailable: '#2B231F',
    userSize: '#261E1A',
    selected: '#4A3120',
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
    background: '#806B59',
  },

  // Gradients
  gradients: {
    main: ['#52453C', '#382E28', '#261E1A', '#1A1512'],
    mainLocations: [0, 0.34, 0.5, 0.87],
    overlay: ['rgba(205, 166, 122, 0.5)', 'transparent'],
    overlayLocations: [0.2, 1],
    regenerateButtonBorder: ['#FC8CAF', '#9EA7FF', '#A3FFD0'],
    regenerateButton: ['#E222F0', '#4747E4', '#E66D7B'],
    registerButton: ['#DCD3DE', '#9535EA', '#E222F0'],
    friendUsername: ['#FFFFFF8F', '#FF10FB59', '#0341EA6B'],
    titleOval: ['#52453C4D', '#52453C'],
    titleOvalContainer: ['#52453C', '#382E28'],
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
