import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Logo from './components/svg/Logo';
import { useTheme } from './lib/ThemeContext';
import type { ThemeColors } from './lib/theme';

const { width, height } = Dimensions.get('window');
const LOGO_SIZE = Math.min(width, height) * 0.3; // 30% of the smallest dimension

interface SimpleAuthLoadingScreenProps {
  // No onFinish prop needed since this screen is purely for display during status checks
}

const SimpleAuthLoadingScreen: React.FC<SimpleAuthLoadingScreenProps> = () => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <Logo width={LOGO_SIZE} height={LOGO_SIZE} />
      </View>

      <Text style={styles.poweredByText}>
        Powered by AI
      </Text>


      <Text style={[styles.poweredByText, styles.bottomText, { position: 'absolute', bottom: height*0.05 }]}>
        ПОЛКА
      </Text>
    </View>
  );
};

const createStyles = (theme: ThemeColors) => StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.background.loading,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    position: 'absolute',
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  poweredByText: {
    fontFamily: 'IgraSans',
    fontSize: 13,
    color: theme.text.secondary,
    marginTop: 20,
    textAlign: 'center',
    width: '100%',
    paddingHorizontal: 20,
  },
  bottomText: {
    textAlign: 'center',
    width: '100%',
    paddingHorizontal: 20,
    left: 0,
    right: 0,
  },
  loadingText: {
    fontFamily: 'REM',
    fontSize: 16,
    color: theme.text.secondary,
    marginTop: 30,
  }
});

export default SimpleAuthLoadingScreen;
