import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { AntDesign } from "@expo/vector-icons";
import { useTheme } from "../lib/ThemeContext";
import type { ThemeColors } from "../lib/theme";

interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
  style?: ViewStyle;
}

/** Map common error types to user-friendly Russian messages */
export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("timeout") || msg.includes("network") || msg.includes("fetch")) {
      return "Не удалось загрузить. Проверьте подключение к интернету";
    }
    if (msg.includes("500") || msg.includes("502") || msg.includes("503") || msg.includes("server")) {
      return "Сервер временно недоступен. Попробуйте позже";
    }
  }
  return "Произошла ошибка. Попробуйте снова";
};

const ErrorBanner = ({ message, onRetry, style }: ErrorBannerProps) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <Animated.View
      entering={FadeInDown.duration(300)}
      style={[styles.container, style]}
    >
      <AntDesign name="warning" size={20} color={theme.status.error} style={styles.icon} />
      <Text style={styles.message}>{message}</Text>
      {onRetry && (
        <TouchableOpacity onPress={onRetry} style={styles.retryButton}>
          <Text style={styles.retryText}>Повторить</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
};

const createStyles = (theme: ThemeColors) =>
  StyleSheet.create({
    container: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.status.errorBackground,
      borderRadius: 12,
      padding: 12,
      marginHorizontal: 16,
      marginVertical: 8,
    },
    icon: {
      marginRight: 10,
    },
    message: {
      flex: 1,
      fontFamily: "REM",
      fontSize: 13,
      color: theme.status.errorText,
    },
    retryButton: {
      marginLeft: 10,
      paddingVertical: 6,
      paddingHorizontal: 12,
      backgroundColor: theme.status.error,
      borderRadius: 8,
    },
    retryText: {
      fontFamily: "IgraSans",
      fontSize: 13,
      color: theme.text.inverse,
    },
  });

export default ErrorBanner;
