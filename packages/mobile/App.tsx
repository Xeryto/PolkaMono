import React, { useState, useEffect, useRef } from 'react';
import * as Font from 'expo-font';
import { StatusBar, Pressable, SafeAreaView, StyleSheet, Text, View, Animated, Dimensions, Easing, Platform, Alert, Modal, Button } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MainPage from './app/MainPage';
import CartPage from './app/Cart';
import SearchPage from './app/Search';
import FavoritesPage from './app/Favorites';
import SettingsPage from './app/Settings';
import LoadingScreen from './app/LoadingScreen';
import AuthLoadingScreen from './app/AuthLoadingScreen';
import SimpleAuthLoadingScreen from './app/SimpleAuthLoadingScreen';
import WelcomeScreen from './app/screens/WelcomeScreen';
import ConfirmationScreen from './app/screens/ConfirmationScreen';
import BrandSearchScreen from './app/screens/BrandSearchScreen';
import StylesSelectionScreen from './app/screens/StylesSelectionScreen';
import ForgotPasswordScreen from './app/screens/ForgotPasswordScreen';
import ResetPasswordScreen from './app/screens/ResetPasswordScreen';
import CheckYourEmailScreen from './app/screens/CheckYourEmailScreen';

import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as cartStorage from './app/cartStorage';
import * as api from './app/services/api';
import { useSession } from './app/hooks/useSession';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import { sessionManager } from './app/services/api';

import Cart from './app/assets/Cart.svg'; // Adjust the path as needed
import Search from './app/assets/Search.svg'; // Adjust the path as needed
import Logo from './app/assets/Logo.svg'; // Adjust the path as needed
import Heart from './app/assets/Heart.svg'; // Adjust the path as needed
import Settings from './app/assets/Settings.svg'; // Adjust the path as needed

// Extend global namespace for cart storage
declare global {
  interface CartItem {
    id: string;
    name: string;
    brand_name: string;
    price: string;
    image: any;
    images: any[];
    size: string;
    quantity: number;
    isLiked?: boolean;
    variants?: { size: string; stock_quantity: number; }[];
    description: string;
    color: string;
    materials: string;
    returnPolicy: string;
    brand_return_policy: string;
  }
  
  var cartStorage: cartStorage.CartStorage;
}

// Define types for improved navigation
type ScreenName = 'Home' | 'Cart' | 'Search' | 'Favorites' | 'Settings';
type NavigationListener = () => void;

interface SimpleNavigation {
  navigate: (screen: string, params?: any) => void;
  goBack: () => void;
  addListener: (event: string, callback: NavigationListener) => () => void;
  setParams?: (params: any) => void;
}

interface NavButtonProps {
  onPress: () => void;
  children: React.ReactNode;
  isActive?: boolean;
}

// Prevent the splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

const loadFonts = async () => {
  await Font.loadAsync({
    'IgraSans': require('./app/assets/fonts/IgraSans.otf'), // Adjust the path as needed
    'REM': require('./app/assets/fonts/REM-Regular.ttf'), // Adjust the path as needed
  });
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    backgroundColor: 'transparent',
  },
  gradient: {
    flex: 1,
  },
  screenContainer: {
    height: Platform.OS === 'android' ? '88%' : '92%',
    width: '100%',
  },
  navbar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: 'rgba(205, 166, 122, 0.2)', // #CDA67A with 20% opacity
    height: '12%',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    paddingBottom: 15,
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 15,
  },
  activeNavItem: {
    // Slight visual indicator for active nav item
    opacity: 1,
    //transform: [{scale: 1.05}] // Reduced from 1.1 for subtlety
  },
  icon: {
    width: 20,
    height: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3E6D6',
  },
});

export default function App() {
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [showLoading, setShowLoading] = useState(true);
  const [showAuthLoading, setShowAuthLoading] = useState(false);
  const [isAppReady, setIsAppReady] = useState(false);
  
  
  // Use the new session management hook
  const { isAuthenticated, isLoading: sessionLoading, error: sessionError, login, logout, isEmailVerified } = useSession();
  
  // Profile completion states
  const [profileCompletionStatus, setProfileCompletionStatus] = useState<api.ProfileCompletionStatus | null>(null);
  const [showConfirmationScreen, setShowConfirmationScreen] = useState(false);
  const [showBrandSearchScreen, setShowBrandSearchScreen] = useState(false);
  const [showStylesSelectionScreen, setShowStylesSelectionScreen] = useState(false);
  const [gender, setGender] = useState<'male' | 'female' | null>(null);
  const [selectedBrands, setSelectedBrands] = useState<number[]>([]);
  const [showForgotPasswordScreen, setShowForgotPasswordScreen] = useState(false);
  const [showResetPasswordScreen, setShowResetPasswordScreen] = useState(false);
  const [resetToken, setResetToken] = useState<string | null>(null);
  
  const [currentScreen, setCurrentScreen] = useState<ScreenName>('Home');
  const [previousScreen, setPreviousScreen] = useState<ScreenName | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [cartInitialized, setCartInitialized] = useState(false);
  const [comingFromSignup, setComingFromSignup] = useState(false); // Track if user is coming from signup
  
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [profileStatusRefreshKey, setProfileStatusRefreshKey] = useState(0);

  console.log('App Render: fontsLoaded=', fontsLoaded, ', isAppReady=', isAppReady, ', isAuthenticated=', isAuthenticated, ', isEmailVerified=', isEmailVerified, ', profileCompletionStatus=', profileCompletionStatus);

  const handleProfileCompletion = async (completionStatus: api.ProfileCompletionStatus) => {
    console.log(completionStatus);
    if (completionStatus && !completionStatus.isComplete && completionStatus.requiredScreens && completionStatus.requiredScreens.length > 0) {
      if (completionStatus.requiredScreens.includes('confirmation')) {
        setShowConfirmationScreen(true);
        
        setShowLoading(false); // Hide loading screen

      } else if (completionStatus.requiredScreens.includes('brand_selection')) {
        setGender(await getUserGender());
        setShowBrandSearchScreen(true);
        setIsAppReady(true); // Set app ready when showing brand selection screen
        setShowLoading(false); // Hide loading screen

      } else if (completionStatus.requiredScreens.includes('style_selection')) {
        setGender(await getUserGender());
        setShowStylesSelectionScreen(true);
        setIsAppReady(true); // Set app ready when showing style selection screen
        setShowLoading(false); // Hide loading screen

      } else {
        setComingFromSignup(false);
        setShowLoading(false);
        setIsAppReady(true); // Set app ready if no specific screen is required

      }
    } else {
      setComingFromSignup(false);
      setShowLoading(false);
    }
  };
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  
  // Navigation event listeners
  const navigationListeners = useRef<Record<string, Set<NavigationListener>>>({
    beforeRemove: new Set(),
  }).current;

  // Keep track of screen params
  const [screenParams, setScreenParams] = useState<Record<ScreenName, any>>({
    Home: {},
    Cart: {},
    Search: {},
    Favorites: {},
    Settings: {}
  });

  

  

  // Initialize cart from storage
  useEffect(() => {
    const initCart = async () => {
      try {
        // Initialize cart from persistent storage
        const savedItems = await cartStorage.initializeCart();
        
        // Create cart storage with saved items
        global.cartStorage = cartStorage.createCartStorage(savedItems);
        
        setCartInitialized(true);
        console.log('App - Cart initialized from storage with items:', savedItems.length);
      } catch (error) {
        console.error('Error initializing cart:', error);
        // Fallback to empty cart
        global.cartStorage = cartStorage.createCartStorage([]);
        setCartInitialized(true);
      }
    };

    initCart();
  }, []);

  useEffect(() => {
    if (fontsLoaded && !sessionLoading) {
      if (isAuthenticated) {
        // User is authenticated and fonts are loaded, app is ready to show main content or profile completion
        setIsAppReady(true);
      } else {
        // User is not authenticated and fonts are loaded, app is ready to show welcome screen
        setIsAppReady(true);
      }
    }
  }, [fontsLoaded, isAuthenticated, sessionLoading]);

  // Check profile completion status when authentication changes
  useEffect(() => {
    const checkProfileStatus = async () => {
      if (sessionLoading) {
        return;
      }

      if (isAuthenticated) {
        
        console.log('App - User is authenticated. Checking profile status...');
        try {
          const userProfile = await api.getCurrentUser();
          console.log('App - User profile:', userProfile);
          const completionStatus = await api.getProfileCompletionStatus();
          console.log('App - Profile completion status:', completionStatus);
          setProfileCompletionStatus(completionStatus);

          if (!userProfile.is_email_verified) {
            console.log('App - Email not verified. Showing CheckYourEmailScreen.');

            setShowLoading(false);
            return;
          }

          // If email IS verified, ensure the check email screen is not shown


          // The user's new requirement is to show the main app even if profile is incomplete
          // The completion screens should be displayed on next reload or relogin, or via explicit user action.
          console.log('App - Profile incomplete. Allowing access to main app for now.');
          setComingFromSignup(false); // Assuming this means "not coming from a fresh signup that requires immediate completion"
          setShowLoading(false);

        } catch (error) {
          console.error('Error checking profile completion or email verification:', error);
          setComingFromSignup(false);
          setShowLoading(false);
        }
      } else {
        console.log('App - User not authenticated, clearing cart.');
        await cartStorage.clearCart();
        setIsInitialLoad(false);
      }
    };

    checkProfileStatus();
  }, [isAuthenticated, sessionLoading, profileStatusRefreshKey, fontsLoaded]); // Add fontsLoaded to dependencies
  
  // Helper function to get user style preference
  const getUserGender = async (): Promise<'male' | 'female'> => {
    try {
      const user = await api.getCurrentUser();
      return user.gender || 'male';
    } catch (error) {
      console.error('Error getting user gender:', error);
      return 'male'; // Default to male if error
    }
  };
  
  // Helper function to get user selected brands
  const getUserSelectedBrands = async (): Promise<number[]> => {
    try {
      const user = await api.getCurrentUser();
      return user.favorite_brands?.map(brand => brand.id) || [];
    } catch (error) {
      console.error('Error getting user selected brands:', error);
      return []; // Default to empty array if error
    }
  };

  // Helper function to get user favorite styles
  const getUserFavoriteStyles = async (): Promise<string[]> => {
    try {
      const user = await api.getCurrentUser();
      return user.favorite_styles?.map(style => style.id) || [];
    } catch (error) {
      console.error('Error getting user favorite styles:', error);
      return []; // Default to empty array if error
    }
  };

  useEffect(() => {
    const loadResources = async () => {
      try {
        await loadFonts();
      } catch (e) {
        console.warn(e);
      } finally {
        setFontsLoaded(true);
        // Hide the splash screen after loading resources
        await SplashScreen.hideAsync();
      }
    };

    loadResources();
  }, []);

  useEffect(() => {
    const handleDeepLink = (event: { url: string }) => {
      const { path, queryParams } = Linking.parse(event.url);
      if (path === 'reset-password' && queryParams?.token) {
        setResetToken(queryParams.token as string);
        setShowResetPasswordScreen(true);
      } else if (path === 'verify-email' && queryParams?.token) {
        // Handle email verification
        api.verifyEmail(queryParams.token as string).then(async () => {
          // Refresh the session to get the updated email verification status
          await login();
          setProfileStatusRefreshKey(prev => prev + 1); // Trigger profile status re-check
        });
      }
    };

    const urlSub = Linking.addEventListener('url', handleDeepLink);

    return () => {
      urlSub.remove();
    };
  }, []);

  const handleLoadingFinish = () => {
    setShowLoading(false);
    
    // Ensure we start on the Home screen after login
    setCurrentScreen('Home');
  };

  const handleAuthLoadingFinish = () => {
    // Hide the auth loading screen
    setShowAuthLoading(false);
    console.log('Auth loading screen finished, hiding it');
    
    // If the user just logged in, make sure we're on the Home screen
    if (isAuthenticated) {
      setCurrentScreen('Home');
      // Explicitly hide the check email screen if authenticated
      
    }
  };

  const handleForgotPassword = () => {
    // Implement navigation to ForgotPasswordScreen or show a modal
    console.log('Navigating to Forgot Password screen');
    // For now, we'll just log it. You'll need to add actual navigation here.
  };

  const handleEmailNotVerified = async () => {
    console.log('User email not verified. Prompting user to check email.');
    Alert.alert(
      'Email Not Verified',
      'Your email is not verified. Please check your inbox for a verification link. Would you like us to resend it?',
      [
        { text: 'Resend', onPress: handleResendEmail },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleLogin = async () => {
    try {
      console.log('App - User logged in, triggering session check.');
      
      // The useSession hook's useEffect will handle the screen navigation
      // based on the updated isAuthenticated and isEmailVerified states.
      await login(); 
    } catch (error) {
      console.error('Error during login process:', error);
      // Error handling for login itself (e.g., invalid credentials) should be in LoginScreen
      // This catch block is for unexpected errors during the session update.
      setComingFromSignup(false);
      setShowLoading(false);
      setIsAppReady(true);
    }
  };

  const handleRegister = async (username: string, email: string, password: string) => {
    try {
      console.log('App - Attempting to register user...');
      await api.registerUser(username, email, password);
      console.log('App - User registered, triggering session re-check.');
      await login(); // Re-fetch user profile and update session state
      console.log('App - User registered, showing check email screen');
    } catch (error) {
      console.error('Error during registration flow:', error);
      const message = (error instanceof Error)
        ? error.message
        : (typeof error === 'object' && error !== null && 'message' in error)
          ? String((error as any).message)
          : 'An error occurred during registration.';
      Alert.alert('Registration Error', message);
    }
  };

  const handleLogout = async () => {
    try {
      console.log('App - User logging out');
      
      // Clear cart
      await cartStorage.clearCart();
      
      // Clear session
      await api.logoutUser();
      
      // First show the auth loading screen before setting isAuthenticated to false
      // This ensures a smooth transition between states
      setShowAuthLoading(true);
      
      // Small delay to ensure auth loading screen is visible before changing logged in state
      setTimeout(() => {
        console.log('App - User logged out, cart cleared');
      }, 50);
      
      // Reset all profile completion states
      setCurrentScreen('Home');
      setShowConfirmationScreen(false);
      setShowBrandSearchScreen(false);
      setShowStylesSelectionScreen(false);
      setProfileCompletionStatus(null);
      setGender(null);
      setSelectedBrands([]);
      
    } catch (error) {
      console.error('Error during logout:', error);
      // Even if logout fails, clear local state
      setCurrentScreen('Home');
      setShowAuthLoading(true);
      setTimeout(() => {
        console.log('App - User logged out (with error), cart cleared');
      }, 50);
    }
  };
  
  // Handle confirmation screen completion
  const handleConfirmationComplete = async (choice: 'male' | 'female') => {
    console.log(`User selected gender: ${choice}`);
    
    // Save the gender
    setGender(choice);
    
    try {
      // Update the user's profile with the selected gender
      await api.updateUserProfile({ gender: choice });

      // Check if brands selection is needed
      const completionStatus = await api.getProfileCompletionStatus();
      console.log('Profile completion status after gender update:', JSON.stringify(completionStatus));
      
      if (completionStatus.requiredScreens.includes('brand_selection')) {
        setShowConfirmationScreen(false);
        setShowBrandSearchScreen(true);
      } else if (completionStatus.requiredScreens.includes('style_selection')) {
        setShowConfirmationScreen(false);
        setShowStylesSelectionScreen(true);
      } else {
        // Profile is complete, go to main app
        setShowConfirmationScreen(false);
        setShowLoading(false); // ✅ Set loading to false to show main app
        setComingFromSignup(true);
      }
    } catch (error) {
      console.error('Error updating gender:', error);
      // In case of error, proceed to brands selection
      setShowConfirmationScreen(false);
      setShowBrandSearchScreen(true);
    }
  };
  
  // Handle brand search completion
  const handleBrandSearchComplete = async (brands: number[]) => {
    console.log(`User selected brands: ${brands.join(', ')}`);
    
    // Save the selected brands
    setSelectedBrands(brands);
    
    try {
      // Update the user's profile with the selected brands
      await api.updateUserBrands(brands);

      // Re-check profile completion status to see what's next
      const completionStatus = await api.getProfileCompletionStatus();
      
      if (completionStatus.requiredScreens.includes('style_selection')) {
        setShowBrandSearchScreen(false);
        setShowStylesSelectionScreen(true);
      } else {
        // Profile is now complete, go to main app
        setShowBrandSearchScreen(false);
        setShowLoading(false);
        setComingFromSignup(true);
      }
    } catch (error) {
      console.error('Error updating selected brands:', error);
      // In case of error, fallback to showing the main app
      setShowBrandSearchScreen(false);
      setShowLoading(false);
    }
  };
  
  // Handle styles selection completion
  const handleStylesSelectionComplete = async (styles: string[]) => {
    console.log(`User selected styles: ${styles.join(', ')}`);
    
    try {
      // Update the user's profile with the selected styles
      await api.updateUserStyles(styles);

      // Store styles in screenParams for the main page
      setScreenParams(prev => ({
        ...prev,
        Home: {
          ...prev.Home,
          gender: gender,
          selected_brands: selectedBrands,
          favorite_styles: styles
        }
      }));
      
      // Complete profile flow
      setShowStylesSelectionScreen(false);
      // Re-check profile completion status to ensure correct navigation
      const completionStatus = await api.getProfileCompletionStatus();
      console.log('Profile completion status after styles update:', JSON.stringify(completionStatus));
      if (completionStatus.isComplete) {
        setShowLoading(false); // Set loading to false to show main app
        setComingFromSignup(true);

      } else {
        // This case should ideally not happen if styles complete the profile
        // but as a fallback, ensure loading is off and app is ready
        setShowLoading(false);
        setIsAppReady(true);

      }
    } catch (error) {
      console.error('Error updating favorite styles:', error);
      // Even in case of error, complete the profile flow
      setShowStylesSelectionScreen(false);
      setShowLoading(false); // ✅ Set loading to false to show main app
      setComingFromSignup(true);
    }
  };

  const handleResendEmail = async () => {
    try {
      await api.requestVerificationEmail();
      Alert.alert('Success', 'Verification email resent!');
    } catch (error) {
      console.error('Error resending verification email:', error);
      Alert.alert('Error', 'Failed to resend verification email.');
    }
  };

  // Notify listeners before screen change
  const notifyBeforeRemove = () => {
    navigationListeners.beforeRemove.forEach(listener => listener());
  };

  // Improved screen transition with proper lifecycle
  const handleNavPress = (screen: ScreenName, params?: any) => {
    // Special case: If pressing Home while already on Home, refresh cards instead of navigating
    if (screen === 'Home' && currentScreen === 'Home') {
      // Update params with a refreshCards signal and timestamp to ensure it's unique each time
      setScreenParams(prev => ({
        ...prev,
        Home: {
          ...prev.Home,
          refreshCards: true,
          refreshTimestamp: Date.now()
        }
      }));
      // Skip the screen transition animation
      return;
    }
    
    if (screen === currentScreen && !params) return;
    
    setIsTransitioning(true);
    setPreviousScreen(currentScreen);
    
    // Update params for the target screen if provided
    if (params) {
      setScreenParams(prev => ({
        ...prev,
        [screen]: params
      }));
    }
    
    // Notify current screen it's about to be removed
    notifyBeforeRemove();
    
    // Fade out current screen
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 150, // Faster fade out
      useNativeDriver: true
    }).start(() => {
      // Change screen
      setCurrentScreen(screen);
      
      // Reset slide position for entrance animation
      slideAnim.setValue(30); // Reduced from 50 for subtler animation
      
      // Slide and fade in new screen
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
          easing: Easing.out(Easing.ease)
        })
      ]).start(() => {
        setIsTransitioning(false);
      });
    });
  };

  // Enhanced navigation object with proper listeners and params support
  const navigation: SimpleNavigation = {
    navigate: (screen: string, params?: any) => handleNavPress(screen as ScreenName, params),
    goBack: () => handleNavPress('Home'),
    addListener: (event: string, callback: NavigationListener) => {
      if (!navigationListeners[event]) {
        navigationListeners[event] = new Set();
      }
      navigationListeners[event].add(callback);
      
      // Return unsubscribe function
      return () => {
        navigationListeners[event].delete(callback);
      };
    },
    setParams: (params: any) => {
      // Update params for the current screen
      setScreenParams(prev => ({
        ...prev,
        [currentScreen]: {
          ...prev[currentScreen],
          ...params
        }
      }));
    }
  };

  const NavButton = ({ onPress, children, isActive }: NavButtonProps) => {
    // Animation values for press effect and shadow
    const [scale] = useState(new Animated.Value(1));
    const [shadowOpacity] = useState(new Animated.Value(isActive ? 0.5 : 0));
    
    // Update shadow opacity when active state changes
    useEffect(() => {
      Animated.timing(shadowOpacity, {
        toValue: isActive ? 0.5 : 0,
        duration: 150,
        useNativeDriver: false, // Shadow opacity can't use native driver
        easing: Easing.inOut(Easing.ease)
      }).start();
    }, [isActive, shadowOpacity]);
    
    const handlePressIn = () => {
      Animated.timing(scale, {
        toValue: 0.9,
        duration: 80,
        useNativeDriver: true,
        easing: Easing.inOut(Easing.ease)
      }).start();
    };
    
    const handlePressOut = () => {
      Animated.timing(scale, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
        easing: Easing.inOut(Easing.ease)
      }).start();
      
      // Call the actual onPress handler
      onPress();
    };
    
    // Create animated shadow style that will change with shadowOpacity value
    const animatedShadowStyle = {
      shadowColor: 'rgba(0, 0, 0, 1)',
      shadowOffset: { width: 0, height: 4 },
      shadowRadius: 4,
      shadowOpacity: shadowOpacity,
      elevation: shadowOpacity.interpolate({
        inputRange: [0, 0.5],
        outputRange: [0, 3]
      }),
      backgroundColor: 'transparent',
      borderRadius: 18
    };
    
    return (
      <Pressable 
        style={[styles.navItem, isActive ? styles.activeNavItem : null]} 
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isTransitioning} // Prevent navigation during transitions
      >
        <Animated.View style={[
          { transform: [{ scale }] },
          animatedShadowStyle
        ]}>
          {children}
        </Animated.View>
      </Pressable>
    );
  };
  if (!isAppReady) {
    return <LoadingScreen onFinish={() => {}} />;
  }

  

  // If not logged in, show the welcome screen
  if (!isAuthenticated) {
    return (
      <GestureHandlerRootView style={{flex: 1}}>
        {/* Always render WelcomeScreen as the base layer */}
        <WelcomeScreen 
          onLogin={handleLogin} 
          onRegister={handleRegister} 
          onForgotPassword={handleForgotPassword} // Pass the prop
          onEmailNotVerified={handleEmailNotVerified} // Pass the new prop
        />
        
        {/* Overlay the AuthLoadingScreen on top while it's active */}
        {showAuthLoading && (
          <AuthLoadingScreen onFinish={handleAuthLoadingFinish} />
        )}
      </GestureHandlerRootView>
    );
  }
  
  // If logged in but email is not verified, show the check email screen
  if (isAuthenticated && !isEmailVerified) {
    return (
      <GestureHandlerRootView style={{flex: 1}}>
        <CheckYourEmailScreen 
          onBackToLogin={() => {
            // If user goes back from here, they are essentially logging out
            logout();
          }}
          onResendEmail={async () => {
            try {
              await api.requestVerificationEmail();
              Alert.alert('Success', 'Verification email resent!');
            } catch (error) {
              console.error('Error resending verification email:', error);
              Alert.alert('Error', 'Failed to resend verification email.');
            }
          }}
        />
      </GestureHandlerRootView>
    );
  }

  // If logged in, email verified, but profile is incomplete, show the appropriate completion screen
  if (isAuthenticated && profileCompletionStatus && !profileCompletionStatus.isComplete) {
    if (showConfirmationScreen) {
      return (
        <GestureHandlerRootView style={{flex: 1}}>
          <ConfirmationScreen 
            onComplete={handleConfirmationComplete} 
            onBack={() => {
              // Go back to welcome screen (logout)
              logout();
            }}
          />
        </GestureHandlerRootView>
      );
    }
    
    if (showBrandSearchScreen) {
      return (
        <GestureHandlerRootView style={{flex: 1}}>
          <BrandSearchScreen 
            initialBrands={selectedBrands}
            onComplete={handleBrandSearchComplete}
            onBack={() => {
              // Go back to confirmation screen
              setShowBrandSearchScreen(false);
              setShowConfirmationScreen(true);
            }}
          />
        </GestureHandlerRootView>
      );
    }
    
    if (showStylesSelectionScreen) {
      return (
        <GestureHandlerRootView style={{flex: 1}}>
          <StylesSelectionScreen 
            gender={gender!}
            onComplete={handleStylesSelectionComplete}
            onBack={() => {
              // Go back to brand search screen
              setShowStylesSelectionScreen(false);
              setShowBrandSearchScreen(true);
            }}
          />
        </GestureHandlerRootView>
      );
    }
  }

  // User is logged in and app is ready, show the main app
  if (isAuthenticated && !sessionLoading && isAppReady) {
    return (
      <GestureHandlerRootView style={{flex: 1}}>
        <LinearGradient
          colors={[
            '#FAE9CF',
            '#CCA479',
            '#CDA67A',
            '#6A462F'
          ]}
          locations={[0, 0.34, 0.50, 0.87]}
          style={styles.gradient}
          start={{ x: 0, y: 0.2 }}
          end={{ x: 1, y: 0.8 }}
        >
          <SafeAreaView style={styles.container}>
            {/* Always render the main app with appropriate animation */}
            <Animated.View 
              style={[
                styles.screenContainer,
                comingFromSignup 
                  ? {opacity: 1, transform: [{translateY: 0}]} // No animation when coming from signup
                  : {opacity: fadeAnim, transform: [{translateY: slideAnim}]} // Normal animation otherwise
              ]}
            >
              {currentScreen === 'Home' && <MainPage navigation={navigation} route={{ params: screenParams.Home }} />}
              {currentScreen === 'Cart' && <CartPage navigation={navigation} />}
              {currentScreen === 'Search' && <SearchPage navigation={navigation} />}
              {currentScreen === 'Favorites' && <FavoritesPage navigation={navigation} />}
              {currentScreen === 'Settings' && (
                <SettingsPage 
                  navigation={navigation} 
                  onLogout={handleLogout} // Pass logout handler to Settings
                />
              )}
            </Animated.View>

            <View style={styles.navbar}>
              <NavButton 
                onPress={() => handleNavPress('Cart')} 
                isActive={currentScreen === 'Cart'}
              >
                <Cart width={32.75} height={32} />
              </NavButton>

              <NavButton 
                onPress={() => handleNavPress('Search')} 
                isActive={currentScreen === 'Search'}
              >
                <Search width={24.75} height={24.75} />
              </NavButton>

              <NavButton 
                onPress={() => handleNavPress('Home')} 
                isActive={currentScreen === 'Home'}
              >
                <Logo width={21} height={28}/>
              </NavButton>

              <NavButton 
                onPress={() => handleNavPress('Favorites')} 
                isActive={currentScreen === 'Favorites'}
              >
                <Heart width={28.74} height={25.07} />
              </NavButton>

              <NavButton 
                onPress={() => handleNavPress('Settings')} 
                isActive={currentScreen === 'Settings'}
              >
                <Settings width={30.25} height={30.25} />
              </NavButton>
            </View>
            
            {/* Conditionally render the loading screen on top only for returning users */}
            {showLoading && !comingFromSignup && (
              <LoadingScreen onFinish={handleLoadingFinish} />
            )}
          </SafeAreaView>
        </LinearGradient>
      </GestureHandlerRootView>
    );
  }

  return <LoadingScreen onFinish={() => {}} />;
}