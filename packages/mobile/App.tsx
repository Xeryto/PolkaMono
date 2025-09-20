import React, { useState, useEffect, useRef, useReducer } from "react";
import * as Font from "expo-font";
import {
  StatusBar,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  Animated,
  Dimensions,
  Easing,
  Platform,
  Alert,
  Modal,
  Button,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import MainPage from "./app/MainPage";
import CartPage from "./app/Cart";
import SearchPage from "./app/Search";
import FavoritesPage from "./app/Favorites";
import SettingsPage from "./app/Settings";
import LoadingScreen from "./app/LoadingScreen";
import AuthLoadingScreen from "./app/AuthLoadingScreen";
import SimpleAuthLoadingScreen from "./app/SimpleAuthLoadingScreen";
import WelcomeScreen from "./app/screens/WelcomeScreen";
import ConfirmationScreen from "./app/screens/ConfirmationScreen";
import BrandSearchScreen from "./app/screens/BrandSearchScreen";
import StylesSelectionScreen from "./app/screens/StylesSelectionScreen";
import ForgotPasswordScreen from "./app/screens/ForgotPasswordScreen";
import ResetPasswordScreen from "./app/screens/ResetPasswordScreen";
import VerificationCodeScreen from "./app/screens/VerificationCodeScreen";
import PasswordResetVerificationScreen from "./app/screens/PasswordResetVerificationScreen";

import * as SplashScreen from "expo-splash-screen";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as cartStorage from "./app/cartStorage";
import * as api from "./app/services/api";
import { useSession } from "./app/hooks/useSession";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { sessionManager } from "./app/services/api";
import {
  NetworkTimeoutError,
  NetworkRetryError,
} from "./app/services/networkUtils";

import Cart from "./app/components/svg/Cart";
import Search from "./app/components/svg/Search";
import Logo from "./app/components/svg/Logo";
import Heart from "./app/components/svg/Heart";
import Settings from "./app/components/svg/Settings";

// Extend global namespace for cart storage
declare global {
  interface CartItem {
    id: string;
    name: string;
    brand_name: string;
    price: string;
    images: any[];
    size: string;
    quantity: number;
    isLiked?: boolean;
    variants?: { size: string; stock_quantity: number }[];
    description: string;
    color: string;
    materials: string;
    returnPolicy: string;
    brand_return_policy: string;
  }

  var cartStorage: cartStorage.CartStorage;
}

// Define types for improved navigation
type ScreenName = "Home" | "Cart" | "Search" | "Favorites" | "Settings";
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
    IgraSans: require("./app/assets/fonts/IgraSans.otf"), // Adjust the path as needed
    REM: require("./app/assets/fonts/REM-Regular.ttf"), // Adjust the path as needed
  });
};

export default function App() {
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [showLoading, setShowLoading] = useState(true);
  const [showAuthLoading, setShowAuthLoading] = useState(false);
  const [isAppReady, setIsAppReady] = useState(false);

  // Use the new session management hook
  const {
    isAuthenticated,
    isLoading: sessionLoading,
    error: sessionError,
    login,
    logout,
  } = useSession();

  // Handle session expiration and clearing
  useEffect(() => {
    const handleSessionExpired = async () => {
      console.log("App - Session expired, clearing cart");
      try {
        // Clear cart storage
        await cartStorage.clearCart();

        // Clear global cart storage
        if (global.cartStorage) {
          global.cartStorage = cartStorage.createCartStorage([]);
          console.log(
            "App - Global cart storage reset due to session expiration"
          );
        }
      } catch (error) {
        console.error("Error clearing cart on session expiration:", error);
      }
    };

    const handleTokenInvalidation = async () => {
      console.log(
        "App - Token invalid, showing alert and navigating to welcome"
      );

      // Show popup alert to user
      Alert.alert(
        "Сессия истекла",
        "Ваша сессия истекла. Пожалуйста, войдите в систему снова.",
        [
          {
            text: "OK",
            onPress: async () => {
              // Clear all stored data
              await handleSessionExpired();

              // Navigate to welcome screen
              transitionTo("unauthenticated", "up");
            },
          },
        ]
      );
    };

    // Listen for session events
    const unsubscribe = api.sessionManager.addListener((event) => {
      if (
        event === "session_cleared" ||
        event === "token_expired" ||
        event === "login_required"
      ) {
        if (event === "login_required") {
          // Show alert for login required (token invalidation)
          handleTokenInvalidation();
        } else {
          // For other events, just clear session without alert
          handleSessionExpired();
        }
      }
    });

    return unsubscribe;
  }, []);

  // Profile completion states
  const [profileCompletionStatus, setProfileCompletionStatus] =
    useState<api.ProfileCompletionStatus | null>(null);
  const [showConfirmationScreen, setShowConfirmationScreen] = useState(false);
  const [showBrandSearchScreen, setShowBrandSearchScreen] = useState(false);
  const [showStylesSelectionScreen, setShowStylesSelectionScreen] =
    useState(false);
  const [gender, setGender] = useState<"male" | "female" | null>(null);
  const [selectedBrands, setSelectedBrands] = useState<number[]>([]);
  const [userEmail, setUserEmail] = useState<string>("");
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState<string>("");
  const [passwordResetCode, setPasswordResetCode] = useState<string>("");

  const [currentScreen, setCurrentScreen] = useState<ScreenName>("Home");
  const [previousScreen, setPreviousScreen] = useState<ScreenName | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [cartInitialized, setCartInitialized] = useState(false);
  const [comingFromSignup, setComingFromSignup] = useState(false); // Track if user is coming from signup

  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isAuthFlowInProgress, setIsAuthFlowInProgress] = useState(false);

  type AppPhase =
    | "boot"
    | "unauthenticated"
    | "email_verification"
    | "forgot_password"
    | "password_reset_verification"
    | "password_reset"
    | "profile_confirm"
    | "profile_brands"
    | "profile_styles"
    | "main";
  type Overlay = "none" | "static" | "up" | "down";

  interface AppNavState {
    phase: AppPhase;
    overlay: Overlay;
  }

  type AppNavAction =
    | { type: "SET_PHASE"; phase: AppPhase }
    | { type: "SET_OVERLAY"; overlay: Overlay }
    | { type: "TRANSITION"; phase: AppPhase; overlay?: Overlay };

  const navReducer = (
    state: AppNavState,
    action: AppNavAction
  ): AppNavState => {
    switch (action.type) {
      case "SET_PHASE":
        return { ...state, phase: action.phase };
      case "SET_OVERLAY":
        return { ...state, overlay: action.overlay };
      case "TRANSITION":
        return {
          phase: action.phase,
          overlay: action.overlay ?? state.overlay,
        };
      default:
        return state;
    }
  };

  const [navState, dispatchNav] = useReducer(navReducer, {
    phase: "boot",
    overlay: "static",
  });

  const transitionTo = (phase: AppPhase, overlay?: Overlay) => {
    dispatchNav({ type: "TRANSITION", phase, overlay });
  };

  // Helper function to handle authentication errors consistently
  const handleAuthError = async (error: any, context: string) => {
    console.error(`Auth error in ${context}:`, error);

    // Check if this is an authentication error
    const isAuthError =
      error instanceof Error &&
      (error.message.includes("401") ||
        error.message.includes("unauthorized") ||
        error.message.includes("authentication") ||
        error.message.includes("token") ||
        error.message.includes("session"));

    if (isAuthError) {
      console.log(
        `Authentication error in ${context}, triggering session manager to show alert`
      );
      // Use session manager to handle login required, which will show alert and clear data
      api.sessionManager.handleLoginRequired();
      return true; // Indicates auth error was handled
    }

    return false; // Not an auth error
  };

  const handleProfileCompletion = async (
    completionStatus: api.ProfileCompletionStatus
  ) => {
    if (
      !completionStatus.isComplete &&
      completionStatus.requiredScreens.length > 0
    ) {
      if (completionStatus.requiredScreens.includes("confirmation")) {
        setShowConfirmationScreen(true);
      } else if (completionStatus.requiredScreens.includes("brand_selection")) {
        setGender(await getUserGender());
        setShowBrandSearchScreen(true);
      } else if (completionStatus.requiredScreens.includes("style_selection")) {
        setGender(await getUserGender());
        setSelectedBrands(await getUserSelectedBrands());
        setShowStylesSelectionScreen(true);
      } else {
        setComingFromSignup(false);
        setShowLoading(false);
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
    Settings: {},
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
        console.log(
          "App - Cart initialized from storage with items:",
          savedItems.length
        );
      } catch (error) {
        console.error("Error initializing cart:", error);
        // Fallback to empty cart
        global.cartStorage = cartStorage.createCartStorage([]);
        setCartInitialized(true);
      }
    };

    initCart();
  }, []);

  // Bootstrap and phase transitions
  useEffect(() => {
    const run = async () => {
      if (!fontsLoaded || sessionLoading) {
        transitionTo("boot", "static");
        return;
      }

      if (!isAuthenticated) {
        console.log(
          "App - Unauthenticated at startup, clearing cart and going to Welcome."
        );
        await cartStorage.clearCart();
        transitionTo("unauthenticated", "up");
        return;
      }

      try {
        console.log("Checking user profile and email verification...");
        // Try to get user from session manager first to avoid duplicate API calls
        let user = await sessionManager.getCurrentUser();
        if (!user) {
          // Fallback to API call if session manager doesn't have user
          user = await api.getCurrentUser();
        }
        setUserEmail(user.email);

        // Check email verification first
        if (!user.is_email_verified) {
          console.log("User email not verified, showing verification screen");
          transitionTo("email_verification", "up");
          return;
        }

        console.log("Checking profile completion status...");
        const completionStatus = await api.getProfileCompletionStatus();
        setProfileCompletionStatus(completionStatus);
        const required = completionStatus.requiredScreens || [];
        if (!completionStatus.isComplete && required.length > 0) {
          // Preload data for the next screen to prevent timing issues
          const preloadPromises = [];
          if (required.includes("brand_selection")) {
            preloadPromises.push(api.getBrands());
          }
          if (required.includes("style_selection")) {
            preloadPromises.push(api.getStyles());
          }

          // Wait for preloading to complete before transitioning
          if (preloadPromises.length > 0) {
            console.log("Preloading data for profile completion screens...");
            await Promise.all(preloadPromises);
            console.log("Data preloading completed");
          }

          // Keep static loading screen until we're ready to show the completion screen
          if (required.includes("confirmation")) {
            transitionTo("profile_confirm", "up");
          } else if (required.includes("brand_selection")) {
            setGender(await getUserGender());
            transitionTo("profile_brands", "up");
          } else if (required.includes("style_selection")) {
            setGender(await getUserGender());
            setSelectedBrands(await getUserSelectedBrands());
            transitionTo("profile_styles", "up");
          } else {
            transitionTo("main", "down");
          }
        } else {
          transitionTo("main", "down");
        }
      } catch (error) {
        console.error("Error checking user profile:", error);

        // Check if this is an authentication error
        const authErrorHandled = await handleAuthError(error, "bootstrap");
        if (authErrorHandled) {
          return; // Auth error handled, user logged out
        }

        // For other errors, proceed to main screen
        transitionTo("main", "down");
      }
    };

    run();
  }, [fontsLoaded, isAuthenticated, sessionLoading]);

  // Helper function to get user style preference
  const getUserGender = async (): Promise<"male" | "female"> => {
    try {
      const user = await api.getCurrentUser();
      return user.gender || "male";
    } catch (error) {
      const authErrorHandled = await handleAuthError(error, "getUserGender");
      if (authErrorHandled) {
        return "male"; // Return default, but user will be logged out
      }
      return "male"; // Default to male if error
    }
  };

  // Helper function to get user selected brands
  const getUserSelectedBrands = async (): Promise<number[]> => {
    try {
      const user = await api.getCurrentUser();
      return user.favorite_brands?.map((brand) => brand.id) || [];
    } catch (error) {
      const authErrorHandled = await handleAuthError(
        error,
        "getUserSelectedBrands"
      );
      if (authErrorHandled) {
        return []; // Return default, but user will be logged out
      }
      return []; // Default to empty array if error
    }
  };

  // Helper function to get user favorite styles
  const getUserFavoriteStyles = async (): Promise<string[]> => {
    try {
      const user = await api.getCurrentUser();
      return user.favorite_styles?.map((style) => style.id) || [];
    } catch (error) {
      const authErrorHandled = await handleAuthError(
        error,
        "getUserFavoriteStyles"
      );
      if (authErrorHandled) {
        return []; // Return default, but user will be logged out
      }
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

  const handleLoadingFinish = () => {
    dispatchNav({ type: "SET_OVERLAY", overlay: "none" });
    setCurrentScreen("Home");
  };

  const handleAuthLoadingFinish = () => {
    dispatchNav({ type: "SET_OVERLAY", overlay: "none" });
    if (isAuthenticated) {
      setCurrentScreen("Home");
    }
  };

  const handleLogin = async () => {
    // Prevent multiple simultaneous login flows
    if (isAuthFlowInProgress) {
      console.log("Login flow already in progress, skipping...");
      return;
    }

    try {
      setIsAuthFlowInProgress(true);
      console.log("App - User logged in, checking profile completion status");

      // Show loading screen immediately to prevent UI flicker
      dispatchNav({ type: "SET_OVERLAY", overlay: "static" });

      // Use the login function from the useSession hook to update the auth state
      await login();

      // Check email verification first
      const user = await api.getCurrentUser();
      setUserEmail(user.email);

      if (!user.is_email_verified) {
        console.log(
          "User email not verified after login, showing verification screen"
        );
        dispatchNav({ type: "SET_OVERLAY", overlay: "up" });
        transitionTo("email_verification");
        return;
      }

      // Get profile completion status
      const completionStatus = await api.getProfileCompletionStatus();
      setProfileCompletionStatus(completionStatus);
      console.log(
        "Profile completion status after login:",
        JSON.stringify(completionStatus)
      );
      const required = completionStatus.requiredScreens || [];

      if (!completionStatus.isComplete && required.length > 0) {
        // Preload data for the next screen to prevent timing issues
        const preloadPromises = [];
        if (required.includes("brand_selection")) {
          preloadPromises.push(api.getBrands());
        }
        if (required.includes("style_selection")) {
          preloadPromises.push(api.getStyles());
        }

        // Wait for preloading to complete before transitioning
        if (preloadPromises.length > 0) {
          console.log("Preloading data for profile completion screens...");
          await Promise.all(preloadPromises);
          console.log("Data preloading completed");
        }

        // Keep static loading screen until we're ready to show the completion screen
        if (required.includes("confirmation")) {
          transitionTo("profile_confirm");
        } else if (required.includes("brand_selection")) {
          setGender(await getUserGender());
          transitionTo("profile_brands");
        } else if (required.includes("style_selection")) {
          setGender(await getUserGender());
          setSelectedBrands(await getUserSelectedBrands());
          transitionTo("profile_styles");
        }
      } else {
        dispatchNav({ type: "SET_OVERLAY", overlay: "down" });
        transitionTo("main");
      }
    } catch (error) {
      console.error("Error checking profile completion after login:", error);

      // First check if this is an authentication error
      const authErrorHandled = await handleAuthError(error, "handleLogin");
      if (authErrorHandled) {
        return; // Auth error handled, user logged out
      }

      // Check if this is a network/timeout error that should be retried
      const isNetworkError =
        error instanceof NetworkTimeoutError ||
        error instanceof NetworkRetryError ||
        (error instanceof Error &&
          (error.message.includes("timeout") ||
            error.message.includes("network") ||
            error.message.includes("fetch") ||
            error.name === "NetworkTimeoutError" ||
            error.name === "NetworkRetryError"));

      if (isNetworkError) {
        console.log(
          "Network error detected, showing error message and staying on current screen"
        );
        // Show error message to user but don't skip to main screen
        Alert.alert(
          "Проблема с подключением",
          "Не удалось проверить статус профиля. Проверьте подключение к интернету и попробуйте еще раз.",
          [
            {
              text: "Попробовать снова",
              onPress: () => {
                // Retry the login flow
                handleLogin();
              },
            },
            {
              text: "Пропустить",
              style: "cancel",
              onPress: () => {
                // Only skip to main if user explicitly chooses to
                setComingFromSignup(false);
                dispatchNav({ type: "SET_OVERLAY", overlay: "down" });
                transitionTo("main");
              },
            },
          ]
        );
        return; // Don't proceed to finally block yet
      }

      // For other errors, proceed with normal login flow
      setComingFromSignup(false);
      dispatchNav({ type: "SET_OVERLAY", overlay: "down" });
      transitionTo("main");
    } finally {
      setIsAuthFlowInProgress(false);
    }
  };

  const handleRegister = async (
    username: string,
    email: string,
    password: string
  ) => {
    // Prevent multiple simultaneous registration flows
    if (isAuthFlowInProgress) {
      console.log("Registration flow already in progress, skipping...");
      return;
    }

    try {
      setIsAuthFlowInProgress(true);
      await api.registerUser(username, email, password);
      console.log("App - User registered, checking profile completion status");

      // Show loading screen immediately to prevent UI flicker
      dispatchNav({ type: "SET_OVERLAY", overlay: "static" });

      await login(); // Automatically log in the user after registration

      // Check email verification first (new users need to verify email)
      const user = await api.getCurrentUser();
      setUserEmail(user.email);

      if (!user.is_email_verified) {
        console.log("New user needs email verification after registration");
        setComingFromSignup(true);
        dispatchNav({ type: "SET_OVERLAY", overlay: "up" });
        transitionTo("email_verification");
        return;
      }

      // Get profile completion status
      const completionStatus = await api.getProfileCompletionStatus();
      setProfileCompletionStatus(completionStatus);
      console.log(
        "Profile completion status after registration:",
        JSON.stringify(completionStatus)
      );
      const required = completionStatus.requiredScreens || [];
      if (!completionStatus.isComplete && required.length > 0) {
        setComingFromSignup(true);

        // Preload data for the next screen to prevent timing issues
        const preloadPromises = [];
        if (required.includes("brand_selection")) {
          preloadPromises.push(api.getBrands());
        }
        if (required.includes("style_selection")) {
          preloadPromises.push(api.getStyles());
        }

        // Wait for preloading to complete before transitioning
        if (preloadPromises.length > 0) {
          console.log("Preloading data for profile completion screens...");
          await Promise.all(preloadPromises);
          console.log("Data preloading completed");
        }

        // Keep static loading screen until we're ready to show the completion screen
        if (required.includes("confirmation")) {
          transitionTo("profile_confirm");
        } else if (required.includes("brand_selection")) {
          setGender(await getUserGender());
          transitionTo("profile_brands");
        } else if (required.includes("style_selection")) {
          setGender(await getUserGender());
          setSelectedBrands(await getUserSelectedBrands());
          transitionTo("profile_styles");
        }
      } else {
        dispatchNav({ type: "SET_OVERLAY", overlay: "down" });
        transitionTo("main");
      }
    } catch (error) {
      console.error(
        "Error checking profile completion after registration:",
        error
      );

      // First check if this is an authentication error
      const authErrorHandled = await handleAuthError(error, "handleRegister");
      if (authErrorHandled) {
        return; // Auth error handled, user logged out
      }

      // Check if this is a network/timeout error that should be retried
      const isNetworkError =
        error instanceof NetworkTimeoutError ||
        error instanceof NetworkRetryError ||
        (error instanceof Error &&
          (error.message.includes("timeout") ||
            error.message.includes("network") ||
            error.message.includes("fetch") ||
            error.name === "NetworkTimeoutError" ||
            error.name === "NetworkRetryError"));

      if (isNetworkError) {
        console.log(
          "Network error detected during registration, showing error message and staying on current screen"
        );
        // Show error message to user but don't skip to main screen
        Alert.alert(
          "Проблема с подключением",
          "Не удалось проверить статус профиля после регистрации. Проверьте подключение к интернету и попробуйте еще раз.",
          [
            {
              text: "Попробовать снова",
              onPress: () => {
                // Retry the registration flow
                handleRegister(username, email, password);
              },
            },
            {
              text: "Пропустить",
              style: "cancel",
              onPress: () => {
                // Only skip to main if user explicitly chooses to
                setComingFromSignup(false);
                dispatchNav({ type: "SET_OVERLAY", overlay: "down" });
                transitionTo("main");
              },
            },
          ]
        );
        return; // Don't proceed to finally block yet
      }

      // For other errors, proceed with normal registration flow
      setComingFromSignup(false);
      dispatchNav({ type: "SET_OVERLAY", overlay: "down" });
      transitionTo("main");
    } finally {
      setIsAuthFlowInProgress(false);
    }
  };

  const handleLogout = async () => {
    try {
      console.log("App - User logging out");

      // Clear cart
      await cartStorage.clearCart();

      // Clear global cart storage
      if (global.cartStorage) {
        global.cartStorage = cartStorage.createCartStorage([]);
        console.log("App - Global cart storage reset during logout");
      }

      // Clear data cache
      api.clearDataCache();

      // Clear session
      await api.logoutUser();

      // Show up animation and move to unauthenticated
      dispatchNav({ type: "SET_OVERLAY", overlay: "up" });

      // Small delay to ensure auth loading screen is visible before changing logged in state
      setTimeout(() => {
        console.log("App - User logged out, cart cleared");
      }, 50);

      // Reset states
      setCurrentScreen("Home");
      setProfileCompletionStatus(null);
      setGender(null);
      setSelectedBrands([]);
      transitionTo("unauthenticated");
    } catch (error) {
      console.error("Error during logout:", error);
      setCurrentScreen("Home");
      dispatchNav({ type: "SET_OVERLAY", overlay: "up" });
    }
  };

  // Handle confirmation screen completion
  const handleConfirmationComplete = async (choice: "male" | "female") => {
    console.log(`User selected gender: ${choice}`);

    // Save the gender
    setGender(choice);

    try {
      // Update the user's profile with the selected gender
      await api.updateUserProfile({ gender: choice });

      // Check next requirements and transition
      const completionStatus = await api.getProfileCompletionStatus();
      console.log(
        "Profile completion status after gender update:",
        JSON.stringify(completionStatus)
      );
      const required = completionStatus.requiredScreens || [];
      if (required.includes("brand_selection")) {
        transitionTo("profile_brands");
      } else if (required.includes("style_selection")) {
        transitionTo("profile_styles");
      } else {
        setComingFromSignup(true);
        dispatchNav({ type: "SET_OVERLAY", overlay: "down" });
        transitionTo("main");
      }
    } catch (error) {
      console.error("Error updating gender:", error);

      // Check if this is an authentication error
      const authErrorHandled = await handleAuthError(
        error,
        "handleConfirmationComplete"
      );
      if (authErrorHandled) {
        return; // Auth error handled, user logged out
      }

      // For other errors, continue to next screen
      transitionTo("profile_brands");
    }
  };

  // Handle brand search completion
  const handleBrandSearchComplete = async (brands: number[]) => {
    console.log(`User selected brands: ${brands.join(", ")}`);

    // Save the selected brands
    setSelectedBrands(brands);

    try {
      // Update the user's profile with the selected brands
      await api.updateUserBrands(brands);

      // Re-check profile completion status to see what's next
      const completionStatus = await api.getProfileCompletionStatus();
      const required = completionStatus.requiredScreens || [];
      if (required.includes("style_selection")) {
        transitionTo("profile_styles");
      } else {
        setComingFromSignup(true);
        dispatchNav({ type: "SET_OVERLAY", overlay: "down" });
        transitionTo("main");
      }
    } catch (error) {
      console.error("Error updating selected brands:", error);

      // Check if this is an authentication error
      const authErrorHandled = await handleAuthError(
        error,
        "handleBrandSearchComplete"
      );
      if (authErrorHandled) {
        return; // Auth error handled, user logged out
      }

      // For other errors, continue to main screen
      dispatchNav({ type: "SET_OVERLAY", overlay: "down" });
      transitionTo("main");
    }
  };

  // Handle styles selection completion
  const handleStylesSelectionComplete = async (styles: string[]) => {
    console.log(`User selected styles: ${styles.join(", ")}`);

    try {
      // Update the user's profile with the selected styles
      await api.updateUserStyles(styles);

      // Store styles in screenParams for the main page
      setScreenParams((prev) => ({
        ...prev,
        Home: {
          ...prev.Home,
          gender: gender,
          selected_brands: selectedBrands,
          favorite_styles: styles,
        },
      }));

      // Complete profile flow
      setComingFromSignup(true);
      dispatchNav({ type: "SET_OVERLAY", overlay: "down" });
      transitionTo("main");
    } catch (error) {
      console.error("Error updating favorite styles:", error);

      // Check if this is an authentication error
      const authErrorHandled = await handleAuthError(
        error,
        "handleStylesSelectionComplete"
      );
      if (authErrorHandled) {
        return; // Auth error handled, user logged out
      }

      // For other errors, continue to main screen
      setComingFromSignup(true);
      dispatchNav({ type: "SET_OVERLAY", overlay: "down" });
      transitionTo("main");
    }
  };

  const handleEmailVerificationSuccess = async () => {
    // Prevent multiple simultaneous verification flows
    if (isAuthFlowInProgress) {
      console.log("Email verification flow already in progress, skipping...");
      return;
    }

    try {
      setIsAuthFlowInProgress(true);
      console.log(
        "Email verification successful, checking profile completion..."
      );

      // Show loading screen immediately to prevent UI flicker
      dispatchNav({ type: "SET_OVERLAY", overlay: "static" });

      // Refresh user profile to get updated email verification status
      const user = await api.getCurrentUser();
      setUserEmail(user.email);

      // Check profile completion status
      const completionStatus = await api.getProfileCompletionStatus();
      setProfileCompletionStatus(completionStatus);
      const required = completionStatus.requiredScreens || [];

      if (!completionStatus.isComplete && required.length > 0) {
        // Preload data for the next screen to prevent timing issues
        const preloadPromises = [];
        if (required.includes("brand_selection")) {
          preloadPromises.push(api.getBrands());
        }
        if (required.includes("style_selection")) {
          preloadPromises.push(api.getStyles());
        }

        // Wait for preloading to complete before transitioning
        if (preloadPromises.length > 0) {
          console.log("Preloading data for profile completion screens...");
          await Promise.all(preloadPromises);
          console.log("Data preloading completed");
        }

        // Keep static loading screen until we're ready to show the completion screen
        if (required.includes("confirmation")) {
          transitionTo("profile_confirm");
        } else if (required.includes("brand_selection")) {
          setGender(await getUserGender());
          transitionTo("profile_brands");
        } else if (required.includes("style_selection")) {
          setGender(await getUserGender());
          setSelectedBrands(await getUserSelectedBrands());
          transitionTo("profile_styles");
        }
      } else {
        dispatchNav({ type: "SET_OVERLAY", overlay: "down" });
        transitionTo("main");
      }
    } catch (error) {
      console.error(
        "Error checking profile completion after email verification:",
        error
      );

      // First check if this is an authentication error
      const authErrorHandled = await handleAuthError(
        error,
        "handleEmailVerificationSuccess"
      );
      if (authErrorHandled) {
        return; // Auth error handled, user logged out
      }

      // Check if this is a network/timeout error that should be retried
      const isNetworkError =
        error instanceof NetworkTimeoutError ||
        error instanceof NetworkRetryError ||
        (error instanceof Error &&
          (error.message.includes("timeout") ||
            error.message.includes("network") ||
            error.message.includes("fetch") ||
            error.name === "NetworkTimeoutError" ||
            error.name === "NetworkRetryError"));

      if (isNetworkError) {
        console.log(
          "Network error detected after email verification, showing error message and staying on current screen"
        );
        // Show error message to user but don't skip to main screen
        Alert.alert(
          "Проблема с подключением",
          "Не удалось проверить статус профиля после подтверждения email. Проверьте подключение к интернету и попробуйте еще раз.",
          [
            {
              text: "Попробовать снова",
              onPress: () => {
                // Retry the email verification success flow
                handleEmailVerificationSuccess();
              },
            },
            {
              text: "Пропустить",
              style: "cancel",
              onPress: () => {
                // Only skip to main if user explicitly chooses to
                dispatchNav({ type: "SET_OVERLAY", overlay: "down" });
                transitionTo("main");
              },
            },
          ]
        );
        return; // Don't proceed to finally block yet
      }

      // For other errors, proceed with normal flow
      dispatchNav({ type: "SET_OVERLAY", overlay: "down" });
      transitionTo("main");
    } finally {
      setIsAuthFlowInProgress(false);
    }
  };

  const handleForgotPassword = async (usernameOrEmail: string) => {
    console.log("Password reset requested for:", usernameOrEmail);
    setForgotPasswordEmail(usernameOrEmail);
    dispatchNav({ type: "SET_OVERLAY", overlay: "up" });
    transitionTo("password_reset_verification");
  };

  const handlePasswordResetVerificationSuccess = async (code: string) => {
    console.log(
      "Password reset verification successful, showing reset form..."
    );
    setPasswordResetCode(code);
    transitionTo("password_reset");
  };

  const handlePasswordResetSuccess = async () => {
    console.log("Password reset successful, returning to login...");
    // Clear forgot password state
    setForgotPasswordEmail("");
    setPasswordResetCode("");
    // Return to welcome screen
    transitionTo("unauthenticated");
  };

  // Notify listeners before screen change
  const notifyBeforeRemove = () => {
    navigationListeners.beforeRemove.forEach((listener) => listener());
  };

  // Improved screen transition with proper lifecycle
  const handleNavPress = (screen: ScreenName, params?: any) => {
    // Special case: If pressing Home while already on Home, refresh cards instead of navigating
    if (screen === "Home" && currentScreen === "Home") {
      // Update params with a refreshCards signal and timestamp to ensure it's unique each time
      setScreenParams((prev) => ({
        ...prev,
        Home: {
          ...prev.Home,
          refreshCards: true,
          refreshTimestamp: Date.now(),
        },
      }));
      // Skip the screen transition animation
      return;
    }

    if (screen === currentScreen && !params) return;

    setIsTransitioning(true);
    setPreviousScreen(currentScreen);

    // Update params for the target screen if provided
    if (params) {
      setScreenParams((prev) => ({
        ...prev,
        [screen]: params,
      }));
    }

    // Notify current screen it's about to be removed
    notifyBeforeRemove();

    // Fade out current screen
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 150, // Faster fade out
      useNativeDriver: true,
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
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
          easing: Easing.out(Easing.ease),
        }),
      ]).start(() => {
        setIsTransitioning(false);
      });
    });
  };

  // Enhanced navigation object with proper listeners and params support
  const navigation: SimpleNavigation = {
    navigate: (screen: string, params?: any) =>
      handleNavPress(screen as ScreenName, params),
    goBack: () => handleNavPress("Home"),
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
      setScreenParams((prev) => ({
        ...prev,
        [currentScreen]: {
          ...prev[currentScreen],
          ...params,
        },
      }));
    },
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
        easing: Easing.inOut(Easing.ease),
      }).start();
    }, [isActive, shadowOpacity]);

    const handlePressIn = () => {
      Animated.timing(scale, {
        toValue: 0.9,
        duration: 80,
        useNativeDriver: true,
        easing: Easing.inOut(Easing.ease),
      }).start();
    };

    const handlePressOut = () => {
      Animated.timing(scale, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
        easing: Easing.inOut(Easing.ease),
      }).start();

      // Call the actual onPress handler
      onPress();
    };

    // Create animated shadow style that will change with shadowOpacity value
    const animatedShadowStyle = {
      shadowColor: "rgba(0, 0, 0, 1)",
      shadowOffset: { width: 0, height: 4 },
      shadowRadius: 4,
      shadowOpacity: shadowOpacity,
      elevation: shadowOpacity.interpolate({
        inputRange: [0, 0.5],
        outputRange: [0, 3],
      }),
      backgroundColor: "transparent",
      borderRadius: 18,
    };

    return (
      <Pressable
        style={[styles.navItem, isActive ? styles.activeNavItem : null]}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isTransitioning} // Prevent navigation during transitions
      >
        <Animated.View
          style={[{ transform: [{ scale }] }, animatedShadowStyle]}
        >
          {children}
        </Animated.View>
      </Pressable>
    );
  };

  // User interface based on phase; overlays rendered on top
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {navState.phase === "boot" && <SimpleAuthLoadingScreen />}

      {navState.phase === "unauthenticated" && (
        <WelcomeScreen
          onLogin={handleLogin}
          onRegister={handleRegister}
          onForgotPassword={() => transitionTo("forgot_password")}
        />
      )}

      {navState.phase === "email_verification" && (
        <VerificationCodeScreen
          email={userEmail}
          onVerificationSuccess={handleEmailVerificationSuccess}
          onBack={() => {
            logout();
          }}
        />
      )}

      {navState.phase === "forgot_password" && (
        <ForgotPasswordScreen
          onBack={() => transitionTo("unauthenticated")}
          onSuccess={(usernameOrEmail: string) =>
            handleForgotPassword(usernameOrEmail)
          }
        />
      )}

      {navState.phase === "password_reset_verification" && (
        <PasswordResetVerificationScreen
          email={forgotPasswordEmail}
          onVerificationSuccess={handlePasswordResetVerificationSuccess}
          onBack={() => transitionTo("forgot_password")}
        />
      )}

      {navState.phase === "password_reset" && (
        <ResetPasswordScreen
          onBack={() => transitionTo("password_reset_verification")}
          onSuccess={handlePasswordResetSuccess}
          identifier={forgotPasswordEmail}
          code={passwordResetCode}
        />
      )}

      {navState.phase === "profile_confirm" && (
        <ConfirmationScreen
          onComplete={handleConfirmationComplete}
          onBack={() => {
            logout();
          }}
        />
      )}

      {navState.phase === "profile_brands" && (
        <BrandSearchScreen
          initialBrands={selectedBrands}
          onComplete={handleBrandSearchComplete}
          onBack={() => {
            transitionTo("profile_confirm");
          }}
        />
      )}

      {navState.phase === "profile_styles" && (
        <StylesSelectionScreen
          gender={gender!}
          onComplete={handleStylesSelectionComplete}
          onBack={() => {
            transitionTo("profile_brands");
          }}
        />
      )}

      {navState.phase === "main" && (
        <LinearGradient
          colors={["#FAE9CF", "#CCA479", "#CDA67A", "#6A462F"]}
          locations={[0, 0.34, 0.5, 0.87]}
          style={styles.gradient}
          start={{ x: 0, y: 0.2 }}
          end={{ x: 1, y: 0.8 }}
        >
          <SafeAreaView style={styles.container}>
            <Animated.View
              style={[
                styles.screenContainer,
                comingFromSignup
                  ? { opacity: 1, transform: [{ translateY: 0 }] }
                  : {
                      opacity: fadeAnim,
                      transform: [{ translateY: slideAnim }],
                    },
              ]}
            >
              {currentScreen === "Home" && (
                <MainPage
                  navigation={navigation}
                  route={{ params: screenParams.Home }}
                />
              )}
              {currentScreen === "Cart" && <CartPage navigation={navigation} />}
              {currentScreen === "Search" && (
                <SearchPage navigation={navigation} />
              )}
              {currentScreen === "Favorites" && (
                <FavoritesPage navigation={navigation} />
              )}
              {currentScreen === "Settings" && (
                <SettingsPage navigation={navigation} onLogout={handleLogout} />
              )}
            </Animated.View>

            <View style={styles.navbar}>
              <NavButton
                onPress={() => handleNavPress("Cart")}
                isActive={currentScreen === "Cart"}
              >
                <Cart width={32.75} height={32} />
              </NavButton>

              <NavButton
                onPress={() => handleNavPress("Search")}
                isActive={currentScreen === "Search"}
              >
                <Search width={24.75} height={24.75} />
              </NavButton>

              <NavButton
                onPress={() => handleNavPress("Home")}
                isActive={currentScreen === "Home"}
              >
                <Logo width={21} height={28} />
              </NavButton>

              <NavButton
                onPress={() => handleNavPress("Favorites")}
                isActive={currentScreen === "Favorites"}
              >
                <Heart width={28.74} height={25.07} />
              </NavButton>

              <NavButton
                onPress={() => handleNavPress("Settings")}
                isActive={currentScreen === "Settings"}
              >
                <Settings width={30.25} height={30.25} />
              </NavButton>
            </View>
          </SafeAreaView>
        </LinearGradient>
      )}

      {navState.overlay === "static" && <SimpleAuthLoadingScreen />}
      {navState.overlay === "up" && (
        <AuthLoadingScreen onFinish={handleAuthLoadingFinish} />
      )}
      {navState.overlay === "down" && (
        <LoadingScreen onFinish={handleLoadingFinish} />
      )}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
    backgroundColor: "transparent",
  },
  gradient: {
    flex: 1,
  },
  screenContainer: {
    height: Platform.OS === "android" ? "88%" : "92%",
    width: "100%",
  },
  navbar: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    backgroundColor: "rgba(205, 166, 122, 0.2)", // #CDA67A with 20% opacity
    height: "12%",
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    paddingBottom: 15,
  },
  navItem: {
    alignItems: "center",
    justifyContent: "center",
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
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F3E6D6",
  },
});
