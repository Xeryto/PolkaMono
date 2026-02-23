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

interface ForgotPasswordScreenProps {
  onBack: () => void;
  onSuccess: (usernameOrEmail: string) => void;
}

const ForgotPasswordScreen: React.FC<ForgotPasswordScreenProps> = ({
  onBack,
  onSuccess,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const validateInput = () => {
    if (!usernameOrEmail.trim()) {
      setError("Username or email is required");
      return false;
    }
    setError("");
    return true;
  };

  const handleSendCodePress = async () => {
    if (!validateInput()) return;

    setIsLoading(true);
    try {
      await api.requestPasswordReset(usernameOrEmail);
      setIsLoading(false);
      setIsSuccess(true);
      // Call onSuccess with the username/email
      onSuccess(usernameOrEmail);
    } catch (err) {
      setIsLoading(false);
      // Still call onSuccess to prevent email enumeration
      onSuccess(usernameOrEmail);
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

              {isSuccess ? (
                <View style={styles.successContainer}>
                  <Text style={styles.successText}>
                    если аккаунт с таким именем пользователя или email
                    существует, код подтверждения был отправлен.
                  </Text>
                </View>
              ) : (
                <>
                  <Text style={styles.title}>сброс пароля</Text>
                  <Text style={styles.subtitle}>
                    введите ваше имя пользователя или email ниже, и мы отправим
                    вам код подтверждения для сброса пароля.
                  </Text>

                  {error ? (
                    <View style={styles.errorContainer}>
                      <Text style={styles.errorGeneralText}>{error}</Text>
                    </View>
                  ) : null}

                  <Animated.View
                    style={styles.inputShadow}
                    entering={FadeInDown.duration(
                      ANIMATION_DURATIONS.MEDIUM
                    ).delay(ANIMATION_DELAYS.SMALL)}
                  >
                    <View style={styles.inputContainer}>
                      <TextInput
                        style={[styles.input, error ? styles.inputError : null]}
                        placeholder="имя пользователя или email"
                        placeholderTextColor={theme.text.placeholderDark}
                        autoCapitalize="none"
                        autoComplete="email"
                        keyboardType="email-address"
                        value={usernameOrEmail}
                        onChangeText={setUsernameOrEmail}
                      />
                    </View>
                    {error ? (
                      <Text style={styles.errorText}>{error}</Text>
                    ) : null}
                  </Animated.View>

                  <TouchableOpacity
                    style={[
                      { alignItems: "center", marginTop: 20, width: "100%" },
                    ]}
                    onPress={handleSendCodePress}
                    disabled={isLoading}
                  >
                    <Animated.View
                      entering={FadeInDown.duration(
                        ANIMATION_DURATIONS.MEDIUM
                      ).delay(ANIMATION_DELAYS.STANDARD)}
                      style={[
                        styles.sendButton,
                        isLoading ? styles.sendButtonDisabled : null,
                      ]}
                    >
                      {isLoading ? (
                        <ActivityIndicator color={theme.button.primaryText} />
                      ) : (
                        <Text style={styles.sendButtonText}>отправить код</Text>
                      )}
                    </Animated.View>
                  </TouchableOpacity>
                </>
              )}
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
      marginBottom: 10,
    },
    subtitle: {
      fontFamily: "REM",
      fontSize: 14,
      color: theme.text.tertiary,
      textAlign: "center",
      marginBottom: 30,
      paddingHorizontal: 20,
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
    sendButton: {
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
    sendButtonDisabled: {
      backgroundColor: theme.button.disabled,
    },
    sendButtonText: {
      fontFamily: "IgraSans",
      fontSize: 20,
      color: theme.button.primaryText,
    },
    successContainer: {
      padding: 20,
      alignItems: "center",
    },
    successText: {
      fontFamily: "REM",
      fontSize: 16,
      color: theme.text.secondary,
      textAlign: "center",
    },
  });

export default ForgotPasswordScreen;
