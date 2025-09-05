import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Easing } from 'react-native';
import Logo from './assets/Logo.svg';

interface LoadingScreenProps {
  onFinish: () => void;
}

const { width, height } = Dimensions.get('window');
const LOGO_SIZE_LARGE = Math.min(width, height) * 0.3; // 30% of the smallest dimension
const LOGO_SIZE_SMALL = Math.min(width, height) * 0.3 * 0.86; // Size in the navbar, derived from large size

const LoadingScreen: React.FC<LoadingScreenProps> = ({ onFinish }) => {
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
    const timer = setTimeout(() => {
      safelyFinish();
    }, 1500); // Call onFinish after 1.5 seconds

    return () => clearTimeout(timer);
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

      <Animated.Text style={[styles.poweredByText, { opacity: fadeAnim, position: 'absolute', bottom: height*0.05 }]}>
        ПОЛКА
      </Animated.Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#F3E6D6',
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
    color: '#4A3120',
    marginTop: 20,
  },
});

export default LoadingScreen; 