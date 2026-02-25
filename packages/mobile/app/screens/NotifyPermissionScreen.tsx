import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import Logo from "../components/svg/Logo";
import { ANIMATION_DURATIONS, ANIMATION_DELAYS } from "../lib/animations";
import { useTheme } from "../lib/ThemeContext";
import type { ThemeColors } from "../lib/theme";

const { width, height } = Dimensions.get("window");
const LOGO_SIZE = Math.min(width, height) * 0.275;

interface NotifyPermissionScreenProps {
  onAllow: () => void;
  onSkip: () => void;
}

const NotifyPermissionScreen: React.FC<NotifyPermissionScreenProps> = ({
  onAllow,
  onSkip,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const handleAllow = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onAllow();
  };

  const handleSkip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSkip();
  };

  return (
    <LinearGradient
      colors={theme.gradients.main as any}
      locations={[0, 0.34, 0.5, 0.87]}
      style={styles.container}
      start={{ x: 0, y: 0.2 }}
      end={{ x: 1, y: 0.8 }}
    >
      <SafeAreaView style={styles.safeArea}>
        <Animated.View
          style={styles.roundedBox}
          entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM)}
        >
          <LinearGradient
            colors={[theme.surface.gradientOverlay, "transparent"]}
            start={{ x: 0.1, y: 1 }}
            end={{ x: 0.9, y: 0.3 }}
            locations={[0.05, 1]}
            style={styles.gradientBackground}
          />
          <Animated.View style={styles.formContainerShadow}>
            <View style={styles.formContainer}>
              <View style={styles.logoContainer}>
                <Logo width={LOGO_SIZE} height={LOGO_SIZE} />
              </View>

              <Animated.View
                style={styles.descriptionContainer}
                entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
                  ANIMATION_DELAYS.SMALL,
                )}
              >
                <Text style={styles.descriptionText}>
                  узнавай первым{"\n"}об отправке заказа
                </Text>
              </Animated.View>

              <View style={styles.buttonsContainer}>
                <Animated.View
                  entering={FadeInDown.duration(
                    ANIMATION_DURATIONS.MEDIUM,
                  ).delay(ANIMATION_DELAYS.MEDIUM)}
                  style={styles.allowButtonShadow}
                >
                  <Pressable
                    style={({ pressed }) => [
                      styles.allowButton,
                      pressed && styles.buttonPressed,
                    ]}
                    onPress={handleAllow}
                    android_ripple={{
                      color: theme.interactive.ripple,
                      borderless: false,
                    }}
                  >
                    <Text style={styles.allowButtonText}>ВКЛЮЧИТЬ</Text>
                  </Pressable>
                </Animated.View>

                <Animated.View
                  entering={FadeInDown.duration(
                    ANIMATION_DURATIONS.MEDIUM,
                  ).delay(ANIMATION_DELAYS.LARGE)}
                >
                  <Pressable
                    style={({ pressed }) => [
                      styles.skipButton,
                      pressed && styles.buttonPressed,
                    ]}
                    onPress={handleSkip}
                  >
                    <Text style={styles.skipButtonText}>позже</Text>
                  </Pressable>
                </Animated.View>
              </View>
            </View>
          </Animated.View>

          <Animated.View style={styles.textContainer}>
            <Text style={styles.text}>УВЕДОМЛЕНИЯ</Text>
          </Animated.View>
        </Animated.View>
      </SafeAreaView>
    </LinearGradient>
  );
};

const createStyles = (theme: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    safeArea: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingTop: Platform.OS === "android" ? 20 : 0,
    },
    roundedBox: {
      width: "88%",
      height: "95%",
      borderRadius: 41,
      backgroundColor: "transparent",
      position: "relative",
      borderWidth: 3,
      borderColor: theme.border.default,
    },
    gradientBackground: {
      borderRadius: 37,
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    formContainerShadow: {
      width: width * 0.88,
      top: -3,
      left: -3,
      height: "90%",
      borderRadius: 41,
      ...Platform.select({
        ios: {
          shadowColor: theme.shadow.default,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.25,
          shadowRadius: 4,
        },
        android: {
          elevation: 6,
        },
      }),
    },
    formContainer: {
      width: "100%",
      height: "100%",
      flexDirection: "column",
      alignItems: "center",
      backgroundColor: theme.background.primary,
      borderRadius: 41,
      ...Platform.select({
        android: {
          overflow: "hidden",
        },
      }),
    },
    logoContainer: {
      alignItems: "center",
      justifyContent: "center",
      marginTop: height * 0.05,
      ...Platform.select({
        ios: {
          shadowColor: theme.shadow.default,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.25,
          shadowRadius: 4,
        },
        android: {
          elevation: 8,
        },
      }),
    },
    descriptionContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 32,
    },
    descriptionText: {
      fontFamily: "IgraSans",
      fontSize: 26,
      color: theme.text.primary,
      textAlign: "center",
      lineHeight: 34,
    },
    buttonsContainer: {
      width: "100%",
      alignItems: "center",
      paddingBottom: 32,
      gap: 12,
    },
    allowButtonShadow: {
      width: "75%",
      borderRadius: 41,
      ...Platform.select({
        ios: {
          shadowColor: theme.shadow.default,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.25,
          shadowRadius: 4,
        },
        android: {
          elevation: 6,
        },
      }),
    },
    allowButton: {
      backgroundColor: theme.button.primary,
      borderRadius: 41,
      paddingVertical: 16,
      alignItems: "center",
      ...Platform.select({
        android: {
          overflow: "hidden",
        },
      }),
    },
    allowButtonText: {
      fontFamily: "IgraSans",
      fontSize: 20,
      color: theme.button.primaryText,
    },
    skipButton: {
      paddingVertical: 10,
      paddingHorizontal: 24,
      alignItems: "center",
    },
    skipButtonText: {
      fontFamily: "IgraSans",
      fontSize: 18,
      color: theme.text.secondary,
    },
    buttonPressed: {
      opacity: 0.7,
    },
    textContainer: {
      position: "absolute",
      bottom: 0,
      marginBottom: 18,
      marginLeft: 27,
    },
    text: {
      fontFamily: "IgraSans",
      fontSize: 38,
      color: theme.text.inverse,
    },
  });

export default NotifyPermissionScreen;
