import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";
import Logo from "../components/svg/Logo";
import BackIcon from "../components/svg/BackIcon";
import { Dimensions } from "react-native";
import * as api from "../services/api";
import {
  ANIMATION_DURATIONS,
  ANIMATION_DELAYS,
  ANIMATION_EASING,
} from "../lib/animations";
import { useTheme } from "../lib/ThemeContext";
import type { ThemeColors } from "../lib/theme";

const { width, height } = Dimensions.get("window");

const LOGO_SIZE = Math.min(width, height) * 0.3;

interface ResetPasswordScreenProps {
  onBack: () => void;
  onSuccess: () => void;
  identifier: string; // Can be username or email
  code: string;
}

const ResetPasswordScreen: React.FC<ResetPasswordScreenProps> = ({
  onBack,
  onSuccess,
  identifier,
  code,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState({
    password: "",
    confirmPassword: "",
    general: "",
  });
  const [isLoading, setIsLoading] = useState(false);

  const validateForm = () => {
    let valid = true;
    const newErrors = { password: "", confirmPassword: "", general: "" };

    const illegalCharRegex = /[^a-zA-Z0-9#$-_!]/; // Only allow letters, numbers, and #$-_!
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d).+$/;

    // Validate password
    if (!password) {
      newErrors.password = "пароль обязателен";
      valid = false;
    } else if (password.length < 6) {
      newErrors.password = "Пароль должен быть не менее 6 символов";
      valid = false;
    } else if (!passwordRegex.test(password)) {
      newErrors.password = "пароль должен содержать буквы и цифры";
      valid = false;
    } else if (password.includes(" ")) {
      newErrors.password = "Пароль не должен содержать пробелов";
      valid = false;
    } else if (illegalCharRegex.test(password)) {
      newErrors.password = "пароль содержит недопустимые символы";
      valid = false;
    }

    // Validate password confirmation
    if (!confirmPassword) {
      newErrors.confirmPassword = "Пожалуйста, подтвердите пароль";
      valid = false;
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = "пароли не совпадают";
      valid = false;
    }

    setErrors(newErrors);
    return valid;
  };

  const handleResetPasswordPress = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      // Use the new code-based reset API
      await api.resetPasswordWithCode(identifier, code, password);
      setIsLoading(false);
      Alert.alert("Успех", "Ваш пароль был успешно сброшен.", [
        { text: "ОК", onPress: onSuccess },
      ]);
    } catch (err) {
      setIsLoading(false);
      let errorMessage = "произошла неожиданная ошибка.";

      if (err instanceof Error) {
        if (err.message.includes("You cannot reuse a previous password")) {
          errorMessage = "Вы не можете использовать предыдущий пароль.";
        } else if (
          err.message.includes("You cannot reuse your current password")
        ) {
          errorMessage = "Вы не можете использовать текущий пароль.";
        } else {
          errorMessage = err.message;
        }
      }

      setErrors((prev) => ({ ...prev, general: errorMessage }));
    }
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
                <BackIcon width={22} height={22} />
              </TouchableOpacity>

              <View style={styles.logoContainer}>
                <Logo width={LOGO_SIZE} height={LOGO_SIZE} />
              </View>

              <Text style={styles.title}>Установить новый пароль</Text>

              {errors.general ? (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorGeneralText}>{errors.general}</Text>
                </View>
              ) : null}

              <Animated.View
                style={styles.inputShadow}
                entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
                  ANIMATION_DELAYS.SMALL
                )}
              >
                <View style={styles.inputContainer}>
                  <TextInput
                    style={[
                      styles.input,
                      errors.password ? styles.inputError : null,
                    ]}
                    placeholder="новый пароль"
                    placeholderTextColor={theme.text.placeholderDark}
                    secureTextEntry
                    value={password}
                    onChangeText={setPassword}
                  />
                </View>
                {errors.password ? (
                  <Text style={styles.errorText}>{errors.password}</Text>
                ) : null}
              </Animated.View>

              <Animated.View
                style={styles.inputShadow}
                entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
                  ANIMATION_DELAYS.STANDARD
                )}
              >
                <View style={styles.inputContainer}>
                  <TextInput
                    style={[
                      styles.input,
                      errors.confirmPassword ? styles.inputError : null,
                    ]}
                    placeholder="подтвердите новый пароль"
                    placeholderTextColor={theme.text.placeholderDark}
                    secureTextEntry
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                  />
                </View>
                {errors.confirmPassword ? (
                  <Text style={styles.errorText}>{errors.confirmPassword}</Text>
                ) : null}
              </Animated.View>

              <TouchableOpacity
                style={[{ alignItems: "center", marginTop: 20, width: "100%" }]}
                onPress={handleResetPasswordPress}
                disabled={isLoading}
              >
                <Animated.View
                  entering={FadeInDown.duration(
                    ANIMATION_DURATIONS.MEDIUM
                  ).delay(ANIMATION_DELAYS.MEDIUM)}
                  style={[
                    styles.resetButton,
                    isLoading ? styles.resetButtonDisabled : null,
                  ]}
                >
                  {isLoading ? (
                    <ActivityIndicator color={theme.button.primaryText} />
                  ) : (
                    <Text style={styles.resetButtonText}>Сбросить пароль</Text>
                  )}
                </Animated.View>
              </TouchableOpacity>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
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
    },
    keyboardView: {
      flex: 1,
    },
    scrollContainer: {
      flexGrow: 1,
      justifyContent: "center",
      padding: 24,
    },
    formContainer: {
      width: "100%",
      backgroundColor: theme.background.primary,
      borderRadius: 41,
      padding: 24,
      alignItems: "center",
      shadowColor: theme.shadow.default,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 5,
    },
    backButton: {
      position: "absolute",
      top: 20,
      left: 20,
      zIndex: 10,
    },
    logoContainer: {
      alignItems: "center",
      justifyContent: "center",
      shadowColor: theme.shadow.default,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 8,
      marginBottom: 40,
    },
    title: {
      fontFamily: "IgraSans",
      fontSize: 24,
      color: theme.text.secondary,
      marginBottom: 30,
      textAlign: "center",
    },
    inputContainer: {
      borderRadius: 41,
      overflow: "hidden",
      backgroundColor: theme.background.input,
      width: "100%",
    },
    inputShadow: {
      borderRadius: 41,
      backgroundColor: "transparent",
      shadowColor: theme.shadow.default,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 8,
      marginBottom: 20,
      width: "100%",
    },
    input: {
      borderRadius: 41,
      paddingHorizontal: 16,
      paddingVertical: 20,
      fontFamily: "IgraSans",
      fontSize: 14,
      color: theme.text.primary,
    },
    inputError: {
      borderColor: theme.border.error,
      borderWidth: 1,
    },
    errorText: {
      fontFamily: "REM",
      fontSize: 12,
      color: theme.status.errorText,
      marginTop: 4,
      marginLeft: 16,
    },
    errorContainer: {
      backgroundColor: theme.status.errorBackground,
      padding: 10,
      borderRadius: 10,
      marginBottom: 20,
      width: "100%",
    },
    errorGeneralText: {
      fontFamily: "REM",
      fontSize: 14,
      color: theme.status.errorText,
      textAlign: "center",
    },
    resetButton: {
      backgroundColor: theme.button.primary,
      borderRadius: 41,
      paddingVertical: 22,
      shadowColor: theme.shadow.default,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 5,
      width: "100%",
      alignItems: "center",
    },
    resetButtonDisabled: {
      backgroundColor: theme.button.disabled,
    },
    resetButtonText: {
      fontFamily: "IgraSans",
      fontSize: 20,
      color: theme.button.primaryText,
    },
  });

export default ResetPasswordScreen;
