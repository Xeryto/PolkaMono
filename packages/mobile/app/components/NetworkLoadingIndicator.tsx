import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { ActivityIndicator } from 'react-native';
import { useTheme } from '../lib/ThemeContext';
import type { ThemeColors } from '../lib/theme';

interface NetworkLoadingIndicatorProps {
  isLoading: boolean;
  error?: Error | null;
  onRetry?: () => void;
  timeout?: number;
  showTimeoutWarning?: boolean;
  message?: string;
}

const NetworkLoadingIndicator: React.FC<NetworkLoadingIndicatorProps> = ({
  isLoading,
  error,
  onRetry,
  timeout = 10000,
  showTimeoutWarning = true,
  message = 'Загрузка...'
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [showTimeoutMessage, setShowTimeoutMessage] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const fadeAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    let interval: NodeJS.Timeout;
    let timeoutId: NodeJS.Timeout;

    if (isLoading) {
      setElapsedTime(0);
      setShowTimeoutMessage(false);

      // Start timer
      interval = setInterval(() => {
        setElapsedTime(prev => {
          const newTime = prev + 100;
          // Show timeout warning at 70% of timeout
          if (showTimeoutWarning && newTime >= timeout * 0.7 && !showTimeoutMessage) {
            setShowTimeoutMessage(true);
            Animated.timing(fadeAnim, {
              toValue: 1,
              duration: 300,
              useNativeDriver: true,
            }).start();
          }
          return newTime;
        });
      }, 100);

      // Set timeout
      timeoutId = setTimeout(() => {
        setShowTimeoutMessage(true);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      }, timeout);
    } else {
      setShowTimeoutMessage(false);
      setElapsedTime(0);
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }

    return () => {
      if (interval) clearInterval(interval);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isLoading, timeout, showTimeoutWarning, fadeAnim, showTimeoutMessage]);

  if (!isLoading && !error) {
    return null;
  }

  const progress = Math.min((elapsedTime / timeout) * 100, 100);

  return (
    <View style={styles.container}>
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={theme.text.secondary} />
          <Text style={styles.loadingText}>{message}</Text>

          {/* Progress bar */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${progress}%` }
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {Math.round(progress)}%
            </Text>
          </View>

          {/* Timeout warning */}
          {showTimeoutMessage && (
            <Animated.View style={[styles.timeoutWarning, { opacity: fadeAnim }]}>
              <Text style={styles.timeoutText}>
                Запрос выполняется дольше обычного...
              </Text>
              <Text style={styles.timeoutSubtext}>
                Проверьте подключение к интернету
              </Text>
            </Animated.View>
          )}
        </View>
      )}

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            {error.message || 'Произошла ошибка'}
          </Text>
          {onRetry && (
            <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
              <Text style={styles.retryText}>Повторить</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};

const createStyles = (theme: ThemeColors) => StyleSheet.create({
  container: {
    padding: 16,
    alignItems: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    width: '100%',
  },
  loadingText: {
    fontFamily: 'REM-Regular',
    fontSize: 14,
    color: theme.text.secondary,
    marginTop: 8,
    textAlign: 'center',
  },
  progressContainer: {
    width: '100%',
    marginTop: 12,
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: theme.border.light,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.text.secondary,
    borderRadius: 2,
  },
  progressText: {
    fontFamily: 'REM-Regular',
    fontSize: 12,
    color: theme.text.tertiary,
    marginTop: 4,
  },
  timeoutWarning: {
    marginTop: 12,
    padding: 12,
    backgroundColor: theme.status.warning,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.status.warning,
    width: '100%',
  },
  timeoutText: {
    fontFamily: 'REM-Regular',
    fontSize: 14,
    color: theme.text.secondary,
    textAlign: 'center',
    fontWeight: '500',
  },
  timeoutSubtext: {
    fontFamily: 'REM-Regular',
    fontSize: 12,
    color: theme.text.secondary,
    textAlign: 'center',
    marginTop: 4,
  },
  errorContainer: {
    alignItems: 'center',
    width: '100%',
  },
  errorText: {
    fontFamily: 'REM-Regular',
    fontSize: 14,
    color: theme.status.error,
    textAlign: 'center',
    marginBottom: 12,
  },
  retryButton: {
    backgroundColor: theme.button.primary,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 6,
  },
  retryText: {
    fontFamily: 'REM-Regular',
    fontSize: 14,
    color: theme.text.inverse,
    fontWeight: '500',
  },
});

export default NetworkLoadingIndicator;
