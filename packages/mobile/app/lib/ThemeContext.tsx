import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { Animated, Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getTheme, setColorScheme, ColorScheme } from './theme';
import type { ThemeColors } from './theme';

type ThemeMode = 'system' | 'light' | 'dark';

interface ThemeContextType {
  theme: ThemeColors;
  themeMode: ThemeMode;
  colorScheme: ColorScheme;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  fadeAnim: Animated.Value;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = '@polka_theme_mode';

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [colorScheme, setColorSchemeState] = useState<ColorScheme>('light');
  const [theme, setTheme] = useState<ThemeColors>(getTheme());
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Load saved theme preference on mount
  useEffect(() => {
    loadThemePreference();
  }, []);

  // Listen to system theme changes
  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme: systemScheme }) => {
      if (themeMode === 'system') {
        const scheme = systemScheme === 'dark' ? 'dark' : 'light';
        applyColorScheme(scheme);
      }
    });

    return () => subscription.remove();
  }, [themeMode]);

  const loadThemePreference = async () => {
    try {
      const savedMode = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (savedMode && (savedMode === 'system' || savedMode === 'light' || savedMode === 'dark')) {
        setThemeModeState(savedMode as ThemeMode);

        // Apply the appropriate color scheme without animation (initial load)
        if (savedMode === 'system') {
          const systemScheme = Appearance.getColorScheme();
          const scheme = systemScheme === 'dark' ? 'dark' : 'light';
          applyColorSchemeImmediate(scheme);
        } else {
          applyColorSchemeImmediate(savedMode as ColorScheme);
        }
      } else {
        // Default to system theme
        const systemScheme = Appearance.getColorScheme();
        const scheme = systemScheme === 'dark' ? 'dark' : 'light';
        applyColorSchemeImmediate(scheme);
      }
    } catch (error) {
      console.error('Error loading theme preference:', error);
      // Fallback to light theme
      applyColorSchemeImmediate('light');
    }
  };

  // Apply scheme immediately without animation (used for initial load)
  const applyColorSchemeImmediate = (scheme: ColorScheme) => {
    setColorScheme(scheme);
    setColorSchemeState(scheme);
    setTheme(getTheme());
  };

  // Apply scheme with 200ms fade transition (used for user-triggered changes)
  const applyColorScheme = (scheme: ColorScheme) => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 100,
      useNativeDriver: true,
    }).start(() => {
      setColorScheme(scheme);
      setColorSchemeState(scheme);
      setTheme(getTheme());
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }).start();
    });
  };

  const setThemeMode = async (mode: ThemeMode) => {
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
      setThemeModeState(mode);

      // Apply the appropriate color scheme based on mode (with animation)
      if (mode === 'system') {
        const systemScheme = Appearance.getColorScheme();
        const scheme = systemScheme === 'dark' ? 'dark' : 'light';
        applyColorScheme(scheme);
      } else {
        applyColorScheme(mode as ColorScheme);
      }
    } catch (error) {
      console.error('Error saving theme preference:', error);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, themeMode, colorScheme, setThemeMode, fadeAnim }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export default ThemeContext;
