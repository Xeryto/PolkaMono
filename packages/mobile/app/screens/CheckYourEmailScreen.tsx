import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";
import Logo from "../components/svg/Logo";
import { Dimensions } from "react-native";
import {
  ANIMATION_DURATIONS,
  ANIMATION_DELAYS,
  ANIMATION_EASING,
} from "../lib/animations";

const { width, height } = Dimensions.get("window");

const LOGO_SIZE = Math.min(width, height) * 0.3;

interface CheckYourEmailScreenProps {
  onBackToLogin: () => void;
  onResendEmail: () => Promise<void>;
}

const CheckYourEmailScreen: React.FC<CheckYourEmailScreenProps> = ({
  onBackToLogin,
  onResendEmail,
}) => {
  const [isResending, setIsResending] = React.useState(false);

  const handleResendEmail = async () => {
    setIsResending(true);
    try {
      await onResendEmail();
    } finally {
      setIsResending(false);
    }
  };
  return (
    <LinearGradient
      colors={["#FAE9CF", "#CCA479", "#CDA67A", "#6A462F"]}
      locations={[0, 0.34, 0.5, 0.87]}
      style={styles.container}
      start={{ x: 0, y: 0.2 }}
      end={{ x: 1, y: 0.8 }}
    >
      <SafeAreaView style={styles.safeArea}>
        <Animated.View
          entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM)}
          style={styles.contentContainer}
        >
          <View style={styles.logoContainer}>
            <Logo width={LOGO_SIZE} height={LOGO_SIZE} />
          </View>

          <Text style={styles.title}>Check Your Email</Text>
          <Text style={styles.subtitle}>
            We've sent a verification link to your email address. Please click
            the link to verify your account before logging in.
          </Text>

          <TouchableOpacity
            style={styles.resendButton}
            onPress={handleResendEmail}
            disabled={isResending}
          >
            <Animated.View
              entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
                ANIMATION_DELAYS.LARGE
              )}
              style={styles.buttonView}
            >
              <Text style={styles.buttonText}>
                {isResending ? "Resending..." : "Resend Email"}
              </Text>
            </Animated.View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.backButton} onPress={onBackToLogin}>
            <Animated.View
              entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
                ANIMATION_DELAYS.STANDARD
              )}
              style={styles.buttonView}
            >
              <Text style={styles.buttonText}>Back to Login</Text>
            </Animated.View>
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  contentContainer: {
    width: "90%",
    backgroundColor: "#F2ECE7",
    borderRadius: 41,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  logoContainer: {
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 8,
    marginBottom: 40,
  },
  title: {
    fontFamily: "IgraSans",
    fontSize: 24,
    color: "#4A3120",
    marginBottom: 20,
  },
  subtitle: {
    fontFamily: "REM",
    fontSize: 16,
    color: "#6A462F",
    textAlign: "center",
    marginBottom: 40,
    paddingHorizontal: 20,
  },
  backButton: {
    alignItems: "center",
    width: "100%",
    marginTop: 10,
  },
  resendButton: {
    alignItems: "center",
    width: "100%",
  },
  buttonView: {
    backgroundColor: "#4A3120",
    borderRadius: 41,
    paddingVertical: 22,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    width: "100%",
    alignItems: "center",
  },
  buttonText: {
    fontFamily: "IgraSans",
    fontSize: 20,
    color: "#F2ECE7",
  },
});

export default CheckYourEmailScreen;
