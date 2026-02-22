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
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import Logo from "../components/svg/Logo";
import VK from "../components/svg/VK";
import BackIcon from "../components/svg/BackIcon";
import { Dimensions } from "react-native";
import * as api from "../services/api";
import {
  ANIMATION_DURATIONS,
  ANIMATION_DELAYS,
  getStaggeredDelay,
} from "../lib/animations";
import { useTheme } from "../lib/ThemeContext";
import type { ThemeColors } from "../lib/theme";

const { width, height } = Dimensions.get("window");

const LOGO_SIZE = Math.min(width, height) * 0.3; // 25% of the smallest dimension

interface LoginScreenProps {
  onLogin: () => void;
  onBack: () => void;
  onForgotPassword: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({
  onLogin,
  onBack,
  onForgotPassword,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({
    usernameOrEmail: "",
    password: "",
    general: "",
  });
  const [isLoading, setIsLoading] = useState(false);

  // Validate form
  const validateForm = () => {
    let valid = true;
    const newErrors = { usernameOrEmail: "", password: "", general: "" };

    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d).+$/;
    const illegalCharRegex = /[^a-zA-Z0-9#$-_!]/; // Only allow letters, numbers, and #$-_!
    const emailRegex = /^[a-zA-Z0-9#$-_!]+@[a-zA-Z0-9-]+\.[a-zA-Z]{2,}$/; // Basic email validation

    // Validate username/email
    if (!usernameOrEmail.trim()) {
      newErrors.usernameOrEmail = "ник или email обязателен";
      valid = false;
    } else if (illegalCharRegex.test(usernameOrEmail)) {
      newErrors.usernameOrEmail = "ник или email содержит недопустимые символы";
      valid = false;
    } else if (usernameOrEmail.includes("@")) {
      // If it contains '@', it should match email format
      if (!emailRegex.test(usernameOrEmail)) {
        newErrors.usernameOrEmail = "неверный формат email";
        valid = false;
      }
    } else {
      // If it doesn't contain '@', it's considered a username, so no @ allowed
      if (usernameOrEmail.includes("@")) {
        newErrors.usernameOrEmail = "ник не может содержать символ @";
        valid = false;
      }
    }

    // Validate password
    if (!password) {
      newErrors.password = "пароль обязателен";
      valid = false;
    } else if (password.length < 6) {
      newErrors.password = "пароль должен быть не менее 6 символов";
      valid = false;
    } else if (!passwordRegex.test(password)) {
      newErrors.password = "пароль должен содержать буквы и цифры";
      valid = false;
    }

    setErrors(newErrors);
    return valid;
  };

  // Handle login
  const handleLoginPress = async () => {
    if (!validateForm()) return;

    setIsLoading(true);

    try {
      // Use the new API for login with username/email support
      const response = await api.loginUser(usernameOrEmail, password);

      setIsLoading(false);

      // After successful login, check email verification status
      onLogin(); // Notify parent component
    } catch (error) {
      setIsLoading(false);

      let errorMessage = "ошибка входа. попробуйте позже.";
      if (error instanceof Error) {
        errorMessage = error.message;
      }

      setErrors({
        ...errors,
        general: errorMessage,
      });
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
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
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
                      errors.usernameOrEmail ? styles.inputError : null,
                    ]}
                    placeholder="ник/email"
                    placeholderTextColor={theme.text.placeholderDark}
                    autoCapitalize="none"
                    autoComplete="email"
                    keyboardType="email-address"
                    value={usernameOrEmail}
                    onChangeText={setUsernameOrEmail}
                  />
                </View>
                {errors.usernameOrEmail ? (
                  <Text style={styles.errorText}>{errors.usernameOrEmail}</Text>
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
                      errors.password ? styles.inputError : null,
                    ]}
                    placeholder="пароль"
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

              <TouchableOpacity
                style={[{ alignItems: "center", marginTop: 10, width: "100%" }]}
                onPress={handleLoginPress}
                disabled={isLoading}
              >
                <Animated.View
                  entering={FadeInDown.duration(
                    ANIMATION_DURATIONS.MEDIUM
                  ).delay(ANIMATION_DELAYS.MEDIUM)}
                  style={[
                    styles.loginButton,
                    isLoading ? styles.loginButtonDisabled : null,
                  ]}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.loginButtonText}>войти</Text>
                  )}
                </Animated.View>
              </TouchableOpacity>

              <Animated.View
                style={styles.forgotPasswordButton}
                entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
                  ANIMATION_DELAYS.LARGE
                )}
              >
                <TouchableOpacity onPress={onForgotPassword}>
                  <Text style={styles.forgotPasswordText}>забыли пароль?</Text>
                </TouchableOpacity>
              </Animated.View>

              <Animated.View
                style={styles.socialContainer}
                entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
                  ANIMATION_DELAYS.EXTENDED
                )}
              >
                <TouchableOpacity
                  style={styles.vkButton}
                  onPress={() =>
                    Alert.alert(
                      "vk вход",
                      "vk вход будет реализован в будущем обновлении."
                    )
                  }
                >
                  <VK width={30} height={30} />
                </TouchableOpacity>
              </Animated.View>
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
      height: "100%",
      backgroundColor: theme.background.primary,
      borderRadius: 41,
      padding: 24,
      justifyContent: "flex-end",
      shadowColor: theme.shadow.default,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 5,
      //overflow: 'hidden',
    },
    backButton: {
      position: "absolute",
      top: 20,
      left: 20,
      zIndex: 10,
      width: 33,
      height: 33,
    },
    inputContainer: {
      borderRadius: 41,
      overflow: "hidden",
      backgroundColor: theme.background.input,
    },
    inputShadow: {
      borderRadius: 41,
      backgroundColor: "transparent",
      shadowColor: theme.shadow.default,
      shadowOffset: {
        width: 0,
        height: 4,
      },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 8,
      marginBottom: 20,
    },
    input: {
      borderRadius: 41,
      paddingHorizontal: 16,
      paddingVertical: 20,
      fontFamily: "IgraSans",
      fontSize: 14,
      color: theme.text.primary,
      ...Platform.select({
        android: {
          overflow: "hidden",
        },
      }),
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
    },
    errorGeneralText: {
      fontFamily: "REM",
      fontSize: 14,
      color: theme.status.errorText,
      textAlign: "center",
    },
    loginButton: {
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
    loginButtonDisabled: {
      backgroundColor: theme.button.disabled,
    },
    loginButtonText: {
      fontFamily: "IgraSans",
      fontSize: 20,
      color: theme.button.primaryText,
    },
    forgotPasswordButton: {
      alignSelf: "center",
      marginTop: 16,
    },
    forgotPasswordText: {
      fontFamily: "IgraSans",
      fontSize: 12,
      color: theme.text.primary,
    },
    logoContainer: {
      alignItems: "center",
      justifyContent: "center",
      shadowColor: theme.shadow.default,
      shadowOffset: {
        width: 0,
        height: 4,
      },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 8,
      marginBottom: 120,
    },
    socialContainer: {
      marginTop: 20,
      //marginBottom: 10,
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
    },
    vkButton: {
      width: 69,
      height: 69,
      borderRadius: 41,
      backgroundColor: theme.background.input,
      justifyContent: "center",
      alignItems: "center",
      shadowColor: theme.shadow.default,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 5,
      //overflow: 'hidden',
    },
  });

export default LoginScreen;
