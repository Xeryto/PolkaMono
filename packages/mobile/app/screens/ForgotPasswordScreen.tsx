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
  Alert
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Logo from '../assets/Logo.svg';
import BackIcon from '../assets/Back.svg';
import { Dimensions } from 'react-native';
import * as api from '../services/api';

const { width, height } = Dimensions.get('window');

const LOGO_SIZE = Math.min(width, height) * 0.3;

interface ForgotPasswordScreenProps {
  onBack: () => void;
  onSuccess: () => void;
}

const ForgotPasswordScreen: React.FC<ForgotPasswordScreenProps> = ({ onBack, onSuccess }) => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const validateEmail = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      setError('Email is required');
      return false;
    } else if (!emailRegex.test(email)) {
      setError('Invalid email format');
      return false;
    }
    setError('');
    return true;
  };

  const handleSendLinkPress = async () => {
    if (!validateEmail()) return;

    setIsLoading(true);
    try {
      await api.requestPasswordReset(email);
      setIsLoading(false);
      setIsSuccess(true);
    } catch (err) {
      setIsLoading(false);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    }
  };

  return (
    <LinearGradient
      colors={['#FAE9CF', '#CCA479', '#CDA67A', '#6A462F']}
      locations={[0, 0.34, 0.50, 0.87]}
      style={styles.container}
      start={{ x: 0, y: 0.2 }}
      end={{ x: 1, y: 0.8 }}
    >
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContainer}
            keyboardShouldPersistTaps="handled"
          >
            <Animated.View 
              entering={FadeInDown.duration(500)}
              style={styles.formContainer}
            >
              <TouchableOpacity
                style={styles.backButton}
                onPress={onBack}
                activeOpacity={0.7}
              >
                <BackIcon width={33} height={33} />
              </TouchableOpacity>
              
              <View style={styles.logoContainer}>
                <Logo width={LOGO_SIZE} height={LOGO_SIZE} />
              </View>
              
              {isSuccess ? (
                <View style={styles.successContainer}>
                  <Text style={styles.successText}>If an account with that email exists, a password reset link has been sent.</Text>
                </View>
              ) : (
                <>
                  <Text style={styles.title}>Reset Password</Text>
                  <Text style={styles.subtitle}>Enter your email address below and we'll send you a link to reset your password.</Text>
                  
                  {error ? (
                    <View style={styles.errorContainer}>
                      <Text style={styles.errorGeneralText}>{error}</Text>
                    </View>
                  ) : null}
                  
                  <Animated.View style={styles.inputShadow} entering={FadeInDown.duration(500).delay(50)}>
                    <View style={styles.inputContainer}>
                      <TextInput
                        style={[styles.input, error ? styles.inputError : null]}
                        placeholder="Email"
                        placeholderTextColor="rgba(0, 0, 0, 1)"
                        autoCapitalize="none"
                        autoComplete="email"
                        keyboardType="email-address"
                        value={email}
                        onChangeText={setEmail}
                      />
                    </View>
                    {error ? (
                      <Text style={styles.errorText}>{error}</Text>
                    ) : null}
                  </Animated.View>
                  
                  <TouchableOpacity
                    style={[{alignItems: 'center', marginTop: 20, width: '100%'}]}
                    onPress={handleSendLinkPress}
                    disabled={isLoading}
                  >
                    <Animated.View entering={FadeInDown.duration(500).delay(100)} style={[styles.sendButton, isLoading ? styles.sendButtonDisabled : null]}>
                      {isLoading ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.sendButtonText}>Send Reset Link</Text>
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

const styles = StyleSheet.create({
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
    justifyContent: 'center',
    padding: 24,
  },
  formContainer: {
    width: '100%',
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
    top: 20,
    left: 20,
    zIndex: 10,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 8,
    marginBottom: 40,
  },
  title: {
    fontFamily: 'IgraSans',
    fontSize: 24,
    color: '#4A3120',
    marginBottom: 10,
  },
  subtitle: {
    fontFamily: 'REM',
    fontSize: 14,
    color: '#6A462F',
    textAlign: 'center',
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  inputContainer: {
    borderRadius: 41,
    overflow: 'hidden',
    backgroundColor: '#E0D6CC',
    width: '100%',
  },
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
  input: {
    borderRadius: 41,
    paddingHorizontal: 16,
    paddingVertical: 20,
    fontFamily: 'IgraSans',
    fontSize: 14,
  },
  inputError: {
    borderColor: 'rgba(255, 100, 100, 0.7)',
    borderWidth: 1,
  },
  errorText: {
    fontFamily: 'REM',
    fontSize: 12,
    color: '#FF6464',
    marginTop: 4,
    marginLeft: 16,
  },
  errorContainer: {
    backgroundColor: 'rgba(255, 100, 100, 0.2)',
    padding: 10,
    borderRadius: 10,
    marginBottom: 20,
    width: '100%',
  },
  errorGeneralText: {
    fontFamily: 'REM',
    fontSize: 14,
    color: '#FF6464',
    textAlign: 'center',
  },
  sendButton: {
    backgroundColor: '#4A3120',
    borderRadius: 41,
    paddingVertical: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    width: '100%',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: 'rgba(205, 166, 122, 0.4)',
  },
  sendButtonText: {
    fontFamily: 'IgraSans',
    fontSize: 20,
    color: '#F2ECE7',
  },
  successContainer: {
    padding: 20,
    alignItems: 'center',
  },
  successText: {
    fontFamily: 'REM',
    fontSize: 16,
    color: '#4A3120',
    textAlign: 'center',
  },
});

export default ForgotPasswordScreen;