
import React, { useState } from 'react';
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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import BackIcon from '../components/svg/BackIcon';
import * as api from '../services/api';

interface VerificationCodeScreenProps {
  onVerificationSuccess: () => void;
  onBack: () => void;
  email: string;
}

const VerificationCodeScreen: React.FC<VerificationCodeScreenProps> = ({ onVerificationSuccess, onBack, email }) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  const handleVerifyPress = async () => {
    if (!code || code.length !== 6) {
      setError('Please enter a valid 6-digit code.');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      await api.verifyEmail(code);
      setIsLoading(false);
      onVerificationSuccess();
    } catch (err) {
      setIsLoading(false);
      const message = (err instanceof Error) ? err.message : 'An unknown error occurred.';
      setError(message);
    }
  };

  const handleResendCode = async () => {
    setResendLoading(true);
    setError('');
    try {
      await api.requestVerificationEmail(); // This function should now trigger sending a code
      Alert.alert('Code Resent', 'A new verification code has been sent to your email.');
    } catch (err) {
      const message = (err instanceof Error) ? err.message : 'An unknown error occurred.';
      Alert.alert('Error', `Could not resend code: ${message}`);
    }
    setResendLoading(false);
  };

  return (
    <LinearGradient
      colors={['#FAE9CF', '#CCA479', '#CDA67A', '#6A462F']}
      locations={[0, 0.34, 0.5, 0.87]}
      style={styles.container}
      start={{ x: 0, y: 0.2 }}
      end={{ x: 1, y: 0.8 }}
    >
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
            <Animated.View entering={FadeInDown.duration(500)} style={styles.formContainer}>
              <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.7}>
                <BackIcon width={33} height={33} />
              </TouchableOpacity>
              <Text style={styles.title}>Verify Your Email</Text>
              <Text style={styles.subtitle}>
                We've sent a 6-digit code to {email}. Please enter it below.
              </Text>

              {error ? (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <Animated.View style={styles.inputShadow} entering={FadeInDown.duration(500).delay(100)}>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder="123456"
                    placeholderTextColor="rgba(0, 0, 0, 0.4)"
                    keyboardType="number-pad"
                    maxLength={6}
                    value={code}
                    onChangeText={setCode}
                  />
                </View>
              </Animated.View>

              <TouchableOpacity
                style={[styles.verifyButton, isLoading && styles.buttonDisabled]}
                onPress={handleVerifyPress}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Verify</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.resendButton, resendLoading && styles.buttonDisabled]}
                onPress={handleResendCode}
                disabled={resendLoading}
              >
                {resendLoading ? (
                  <ActivityIndicator color="#4A3120" />
                ) : (
                  <Text style={styles.resendButtonText}>Resend Code</Text>
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
  scrollContainer: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  formContainer: {
    backgroundColor: '#F2ECE7',
    borderRadius: 41,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  backButton: { 
    position: 'absolute', 
    top: 16, 
    left: 16, 
    zIndex: 10,
    width: 33,
    height: 33,
  },
  title: { fontFamily: 'IgraSans', fontSize: 22, color: '#4A3120', marginBottom: 10 },
  subtitle: { fontFamily: 'REM', fontSize: 14, color: '#4A3120', textAlign: 'center', marginBottom: 20 },
  inputShadow: {
    borderRadius: 41,
    backgroundColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 8,
    marginBottom: 20,
    width: '100%',
  },
  inputContainer: { borderRadius: 41, overflow: 'hidden', backgroundColor: '#E0D6CC' },
  input: {
    borderRadius: 41,
    paddingHorizontal: 16,
    paddingVertical: 20,
    fontFamily: 'IgraSans',
    fontSize: 14,
    textAlign: 'center',
    letterSpacing: 2,
    ...Platform.select({
      android: {
        overflow: 'hidden',
      },
    }),
  },
  verifyButton: {
    backgroundColor: '#4A3120',
    borderRadius: 41,
    paddingVertical: 22,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    marginBottom: 15,
  },
  resendButton: {
    backgroundColor: 'transparent',
    borderRadius: 41,
    paddingVertical: 22,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4A3120',
  },
  buttonText: { fontFamily: 'IgraSans', fontSize: 20, color: '#F2ECE7' },
  resendButtonText: { fontFamily: 'IgraSans', fontSize: 20, color: '#4A3120' },
  buttonDisabled: { opacity: 0.7 },
  errorContainer: {
    backgroundColor: 'rgba(255, 100, 100, 0.2)',
    padding: 10,
    borderRadius: 10,
    marginBottom: 20,
    width: '100%',
  },
  errorText: { fontFamily: 'REM', fontSize: 14, color: '#D9534F', textAlign: 'center' },
});

export default VerificationCodeScreen;
