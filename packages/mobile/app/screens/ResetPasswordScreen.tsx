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
  Pressable,
} from "react-native";
import EyeIcon from "../components/svg/EyeIcon";
import EyeOffIcon from "../components/svg/EyeOffIcon";
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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordKey, setPasswordKey] = useState(0);
  const [confirmPasswordKey, setConfirmPasswordKey] = useState(0);

  const validateForm = () => {
    let valid = true;
    const newErrors = { password: "", confirmPassword: "", general: "" };

    const illegalCharRegex = /[^a-zA-Z0-9#$-_!]/; // Only allow letters, numbers, and #$-_!
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d).+$/;

    // Validate password
    if (!password) {
      newErrors.password = "пароль обязателен";
      valid = false;
    } else if (password.length < 8) {
      newErrors.password = "пароль должен быть не менее 8 символов";
      valid = false;
    } else if (!passwordRegex.test(password)) {
      newErrors.password = "пароль должен содержать буквы и цифры";
      valid = false;
    } else if (password.includes(" ")) {
      newErrors.password = "пароль не должен содержать пробелов";
      valid = false;
    } else if (illegalCharRegex.test(password)) {
      newErrors.password = "пароль содержит недопустимые символы";
      valid = false;
    }

    // Validate password confirmation
    if (!confirmPassword) {
      newErrors.confirmPassword = "пожалуйста, подтвердите пароль";
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
      Alert.alert("успех", "ваш пароль был успешно сброшен.", [
        { text: "ок", onPress: onSuccess },
      ]);
    } catch (err) {
      setIsLoading(false);
      let errorMessage = "произошла неожиданная ошибка.";

      if (err instanceof Error) {
        errorMessage = err.message;
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

              <Text style={styles.title}>установить новый пароль</Text>

              {errors.general ? (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorGeneralText}>{errors.general}</Text>
                </View>
              ) : null}

              <Animated.View
                style={styles.inputShadow}
                entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
                  ANIMATION_DELAYS.SMALL,
                )}
              >
                <View style={styles.inputContainer}>
                  <TextInput
                    key={passwordKey}
                    style={[
                      styles.input,
                      styles.passwordInput,
                      errors.password ? styles.inputError : null,
                    ]}
                    placeholder="новый пароль"
                    placeholderTextColor={theme.text.placeholderDark}
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={setPassword}
                    onBlur={() => setPasswordKey((k) => k + 1)}
                  />
                  <Pressable
                    style={styles.eyeButton}
                    onPress={() => setShowPassword(!showPassword)}
                    hitSlop={8}
                  >
                    {showPassword ? <EyeIcon /> : <EyeOffIcon />}
                  </Pressable>
                </View>
                {errors.password ? (
                  <Text style={styles.errorText}>{errors.password}</Text>
                ) : null}
              </Animated.View>

              <Animated.View
                style={styles.inputShadow}
                entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
                  ANIMATION_DELAYS.STANDARD,
                )}
              >
                <View style={styles.inputContainer}>
                  <TextInput
                    key={confirmPasswordKey}
                    style={[
                      styles.input,
                      styles.passwordInput,
                      errors.confirmPassword ? styles.inputError : null,
                    ]}
                    placeholder="подтвердите новый пароль"
                    placeholderTextColor={theme.text.placeholderDark}
                    secureTextEntry={!showConfirmPassword}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    onBlur={() => setConfirmPasswordKey((k) => k + 1)}
                  />
                  <Pressable
                    style={styles.eyeButton}
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    hitSlop={8}
                  >
                    {showConfirmPassword ? <EyeIcon /> : <EyeOffIcon />}
                  </Pressable>
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
                    ANIMATION_DURATIONS.MEDIUM,
                  ).delay(ANIMATION_DELAYS.MEDIUM)}
                  style={[
                    styles.resetButton,
                    isLoading ? styles.resetButtonDisabled : null,
                  ]}
                >
                  {isLoading ? (
                    <ActivityIndicator color={theme.button.primaryText} />
                  ) : (
                    <Text style={styles.resetButtonText}>сбросить пароль</Text>
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
    passwordInput: {
      paddingRight: 48,
    },
    eyeButton: {
      position: "absolute",
      right: 16,
      top: 0,
      bottom: 0,
      justifyContent: "center",
      padding: 4,
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
