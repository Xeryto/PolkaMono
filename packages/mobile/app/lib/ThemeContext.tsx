import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getTheme, setColorScheme, ColorScheme } from './theme';
import type { ThemeColors } from './theme';

type ThemeMode = 'system' | 'light' | 'dark';

interface ThemeContextType {
  theme: ThemeColors;
  themeMode: ThemeMode;
  colorScheme: ColorScheme;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  showTransitionOverlay: boolean;
  hideTransitionOverlay: () => void;
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
  const [showTransitionOverlay, setShowTransitionOverlay] = useState(false);

  useEffect(() => {
    loadThemePreference();
  }, []);

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
        if (savedMode === 'system') {
          const systemScheme = Appearance.getColorScheme() ?? 'light';
          const scheme = systemScheme === 'dark' ? 'dark' : 'light';
          applyColorSchemeImmediate(scheme);
          setTimeout(() => {
            const recheckScheme = Appearance.getColorScheme();
            if (recheckScheme) applyColorSchemeImmediate(recheckScheme === 'dark' ? 'dark' : 'light');
          }, 0);
        } else {
          applyColorSchemeImmediate(savedMode as ColorScheme);
        }
      } else {
        const systemScheme = Appearance.getColorScheme() ?? 'light';
        const scheme = systemScheme === 'dark' ? 'dark' : 'light';
        applyColorSchemeImmediate(scheme);
        setTimeout(() => {
          const recheckScheme = Appearance.getColorScheme();
          if (recheckScheme) applyColorSchemeImmediate(recheckScheme === 'dark' ? 'dark' : 'light');
        }, 0);
      }
    } catch (error) {
      console.error('Error loading theme preference:', error);
      applyColorSchemeImmediate('light');
    }
  };

  const applyColorSchemeImmediate = (scheme: ColorScheme) => {
    setColorScheme(scheme);
    setColorSchemeState(scheme);
    setTheme(getTheme());
  };

  // Apply theme + show overlay in one React batch. The overlay appears instantly
  // at full opacity (covering the old theme), then fades itself out.
  const applyColorScheme = (scheme: ColorScheme, mode?: ThemeMode) => {
    setColorScheme(scheme);
    setColorSchemeState(scheme);
    if (mode !== undefined) setThemeModeState(mode);
    setTheme(getTheme());
    setShowTransitionOverlay(true);
  };

  const setThemeMode = async (mode: ThemeMode) => {
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
      const targetScheme: ColorScheme = mode === 'system'
        ? (Appearance.getColorScheme() === 'dark' ? 'dark' : 'light')
        : mode as ColorScheme;
      applyColorScheme(targetScheme, mode);
    } catch (error) {
      console.error('Error saving theme preference:', error);
    }
  };

  const hideTransitionOverlay = useCallback(() => {
    setShowTransitionOverlay(false);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, themeMode, colorScheme, setThemeMode, showTransitionOverlay, hideTransitionOverlay }}>
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
