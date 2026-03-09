import React, { useRef, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Easing } from 'react-native';
import Logo from './components/svg/Logo';
import { useTheme } from './lib/ThemeContext';
import type { ThemeColors } from './lib/theme';
import { ANIMATION_DURATIONS } from './lib/animations';

interface LoadingScreenProps {
  onFinish: () => void;
}

const { width, height } = Dimensions.get('window');
const LOGO_SIZE_LARGE = Math.min(width, height) * 0.3; // 30% of the smallest dimension
const LOGO_SIZE_SMALL = 21; // Size in the navbar

const LoadingScreen: React.FC<LoadingScreenProps> = ({ onFinish }) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const positionY = useRef(new Animated.Value(0)).current;
  const bgFadeAnim = useRef(new Animated.Value(1)).current;
  const hasFinished = useRef(false);

  // Function to safely complete the loading animation
  const safelyFinish = () => {
    if (!hasFinished.current) {
      hasFinished.current = true;
      onFinish();
    }
  };

  useEffect(() => {
    const initialDelay = Animated.delay(ANIMATION_DURATIONS.SHORT);

    const jumpUp = Animated.timing(positionY, {
      toValue: -height * 0.05,
      duration: ANIMATION_DURATIONS.SHORT,
      useNativeDriver: true,
      easing: Easing.out(Easing.cubic),
    });

    const navbarPosition = height*2.5;

    const fadeOutLogo = Animated.timing(fadeAnim, {
      toValue: 0,
      duration: ANIMATION_DURATIONS.LONG,
      useNativeDriver: true,
      easing: Easing.linear,
    });

    const fadeOutBg = Animated.timing(bgFadeAnim, {
      toValue: 0,
      duration: ANIMATION_DURATIONS.MEDIUM,
      useNativeDriver: true,
      easing: Easing.linear,
    });

    const shrink = Animated.timing(scaleAnim, {
      toValue: LOGO_SIZE_SMALL / LOGO_SIZE_LARGE,
      duration: ANIMATION_DURATIONS.MEDIUM,
      useNativeDriver: true,
      easing: Easing.linear,
    });

    const moveDown = Animated.timing(positionY, {
      toValue: navbarPosition,
      duration: ANIMATION_DURATIONS.MEDIUM,
      useNativeDriver: true,
      easing: Easing.in(Easing.cubic),
    });

    // Run the animations in sequence with careful timing
    Animated.sequence([
      initialDelay,
      jumpUp,
      Animated.parallel([fadeOutLogo, shrink, moveDown, fadeOutBg])
    ]).start(() => {
      safelyFinish();
    });

    // Safety timeout in case animation fails to complete
    const safetyTimeout = setTimeout(() => {
      safelyFinish();
    }, 2000); // 5 second timeout

    // Clean up on unmount
    return () => clearTimeout(safetyTimeout);
  }, []);

  return (
    <Animated.View
      style={[
        styles.container,
        { opacity: bgFadeAnim }
      ]}
    >
      <Animated.View
        style={[
          styles.logoContainer,
          {
            opacity: fadeAnim,
            transform: [
              { scale: scaleAnim },
              { translateY: positionY }
            ]
          }
        ]}
      >
        <Logo width={LOGO_SIZE_LARGE} height={LOGO_SIZE_LARGE} />
      </Animated.View>

      <Animated.Text
        style={[
          styles.poweredByText,
          { opacity: fadeAnim }
        ]}
      >
        Powered by AI
      </Animated.Text>

      <Animated.Text
        style={[styles.brandText, { opacity: fadeAnim }]}
        adjustsFontSizeToFit
        numberOfLines={1}
      >
        ПОТОК
      </Animated.Text>
    </Animated.View>
  );
};

const createStyles = (theme: ThemeColors) => StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.background.loading,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
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
  brandText: {
    fontFamily: 'IgraSans',
    fontSize: 200,
    color: theme.text.secondary,
    textAlign: 'center',
    width: LOGO_SIZE_LARGE * 0.75,
    position: 'absolute',
    bottom: height * 0.05,
  },
});

export default LoadingScreen;
