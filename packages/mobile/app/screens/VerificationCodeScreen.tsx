import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
  Pressable,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Clipboard from "expo-clipboard";
import Animated, { FadeInDown } from "react-native-reanimated";
import BackIcon from "../components/svg/BackIcon";
import * as api from "../services/api";
import {
  ANIMATION_DURATIONS,
  ANIMATION_DELAYS,
  ANIMATION_EASING,
} from "../lib/animations";

interface VerificationCodeScreenProps {
  onVerificationSuccess: () => void;
  onBack: () => void;
  email: string;
}

const VerificationCodeScreen: React.FC<VerificationCodeScreenProps> = ({
  onVerificationSuccess,
  onBack,
  email,
}) => {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(60); // 60 seconds countdown
  const inputRef = useRef<TextInput>(null);

  const handleVerifyPress = async () => {
    if (!code || code.length !== 6) {
      setError("Please enter a valid 6-digit code.");
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      await api.verifyEmail(code);
      setIsLoading(false);
      onVerificationSuccess();
    } catch (err) {
      setIsLoading(false);
      const message =
        err instanceof Error ? err.message : "An unknown error occurred.";
      setError(message);
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0) return; // Prevent resend during cooldown
    setResendLoading(true);
    setError("");
    try {
      await api.requestVerificationEmail(); // This function should now trigger sending a code
      setResendCooldown(60); // Start the 60-second cooldown
      Alert.alert(
        "Код отправлен повторно",
        "Новый код подтверждения был отправлен на ваш email."
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "An unknown error occurred.";
      Alert.alert("Ошибка", `Не удалось отправить код повторно: ${message}`);
    }
    setResendLoading(false);
  };

  // Countdown timer effect
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => {
        setResendCooldown((prev) => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleLongPress = async () => {
    try {
      const clipboardText = await Clipboard.getStringAsync();
      // Extract only numbers from clipboard text
      const numbersOnly = clipboardText.replace(/\D/g, "");
      if (numbersOnly.length > 0) {
        // Limit to 6 digits
        const codeToSet = numbersOnly.slice(0, 6);
        setCode(codeToSet);
        inputRef.current?.focus();
      }
    } catch (err) {
      // Silently fail if clipboard access fails
      console.warn("Failed to access clipboard:", err);
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
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContainer}
            keyboardShouldPersistTaps="handled"
          >
            <Animated.View
              entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM)}
              style={styles.formContainer}
            >
              <TouchableOpacity
                style={styles.backButton}
                onPress={onBack}
                activeOpacity={0.7}
              >
                <BackIcon width={33} height={33} />
              </TouchableOpacity>
              <Text style={styles.title}>Подтвердите почту</Text>
              <Text style={styles.subtitle}>
                Мы отправили 6-значный код на {email}. Пожалуйста, введите его
                ниже.
              </Text>

              {error ? (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <View style={styles.codeContainerWrapper}>
                <Pressable
                  style={styles.codePressable}
                  onLongPress={handleLongPress}
                  onPress={() => inputRef.current?.focus()}
                >
                  <Animated.View
                    style={styles.codeContainer}
                    entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
                      ANIMATION_DELAYS.STANDARD
                    )}
                  >
                    {[0, 1, 2, 3, 4, 5].map((index) => (
                      <View
                        key={index}
                        style={[
                          styles.codeSlot,
                          code[index] && styles.codeSlotFilled,
                          index === code.length && styles.codeSlotActive,
                        ]}
                      >
                        <Text style={styles.codeText}>{code[index] || ""}</Text>
                      </View>
                    ))}
                  </Animated.View>
                </Pressable>
                <TextInput
                  ref={inputRef}
                  style={styles.hiddenInput}
                  value={code}
                  onChangeText={setCode}
                  keyboardType="number-pad"
                  maxLength={6}
                  autoFocus
                />
              </View>

              <TouchableOpacity
                style={[
                  styles.verifyButton,
                  isLoading && styles.buttonDisabled,
                ]}
                onPress={handleVerifyPress}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Подтвердить</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.resendButton,
                  (resendLoading || resendCooldown > 0) && styles.resendButtonDisabled,
                ]}
                onPress={handleResendCode}
                disabled={resendLoading || resendCooldown > 0}
              >
                {resendLoading ? (
                  <ActivityIndicator color="#4A3120" />
                ) : resendCooldown > 0 ? (
                  <Text style={[styles.resendButtonText, styles.resendButtonTextDisabled]}>
                    Повторить через {resendCooldown}с
                  </Text>
                ) : (
                  <Text style={styles.resendButtonText}>
                    Отправить код повторно
                  </Text>
                )}
              </TouchableOpacity>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  keyboardView: { flex: 1 },
  scrollContainer: { flexGrow: 1, justifyContent: "center", padding: 24 },
  formContainer: {
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
  backButton: {
    position: "absolute",
    top: 16,
    left: 16,
    zIndex: 10,
    width: 33,
    height: 33,
  },
  title: {
    fontFamily: "IgraSans",
    fontSize: 22,
    color: "#4A3120",
    marginBottom: 10,
  },
  subtitle: {
    fontFamily: "REM",
    fontSize: 14,
    color: "#4A3120",
    textAlign: "center",
    marginBottom: 20,
  },
  codeContainerWrapper: {
    width: "100%",
    marginBottom: 20,
    position: "relative",
  },
  codePressable: {
    width: "100%",
  },
  codeContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
  },
  codeSlot: {
    width: 45,
    height: 55,
    backgroundColor: "#E0D6CC",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "transparent",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  codeSlotFilled: {
    borderColor: "#4A3120",
    backgroundColor: "#F2ECE7",
  },
  codeSlotActive: {
    borderColor: "#4A3120",
    borderWidth: 3,
  },
  codeText: {
    fontFamily: "IgraSans",
    fontSize: 24,
    color: "#4A3120",
    textAlign: "center",
  },
  hiddenInput: {
    position: "absolute",
    left: -9999,
    opacity: 0,
    width: 1,
    height: 1,
  },
  verifyButton: {
    backgroundColor: "#4A3120",
    borderRadius: 41,
    paddingVertical: 22,
    width: "100%",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    marginBottom: 15,
  },
  resendButton: {
    backgroundColor: "transparent",
    borderRadius: 41,
    paddingVertical: 22,
    width: "100%",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#4A3120",
  },
  resendButtonDisabled: {
    opacity: 0.5,
    borderColor: "#9E9E9E",
  },
  buttonText: { fontFamily: "IgraSans", fontSize: 20, color: "#F2ECE7" },
  resendButtonText: { fontFamily: "IgraSans", fontSize: 20, color: "#4A3120" },
  resendButtonTextDisabled: { color: "#9E9E9E" },
  buttonDisabled: { opacity: 0.7 },
  errorContainer: {
    backgroundColor: "rgba(255, 100, 100, 0.2)",
    padding: 10,
    borderRadius: 10,
    marginBottom: 20,
    width: "100%",
  },
  errorText: {
    fontFamily: "REM",
    fontSize: 14,
    color: "#D9534F",
    textAlign: "center",
  },
});

export default VerificationCodeScreen;
