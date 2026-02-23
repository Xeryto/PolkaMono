import React, { useState, useEffect, useRef, useReducer } from "react";
import * as Font from "expo-font";
import {
  StatusBar,
  Pressable,
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
import {
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { NavigationContainer, useFocusEffect } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import MainPage from "./app/MainPage";
import CartPage from "./app/Cart";
import SearchPage from "./app/Search";
import FavoritesPage from "./app/Favorites";
import SettingsPage from "./app/Settings";
import WallPage from "./app/Wall";
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
import RecentPiecesScreen from "./app/screens/RecentPiecesScreen";
import FriendRecommendationsScreen from "./app/screens/FriendRecommendationsScreen";

import * as SplashScreen from "expo-splash-screen";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as cartStorage from "./app/cartStorage";
import * as api from "./app/services/api";
import { useSession } from "./app/hooks/useSession";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { sessionManager } from "./app/services/api";
import { ANIMATION_DURATIONS } from "./app/lib/animations";
import {
  NetworkTimeoutError,
  NetworkRetryError,
} from "./app/services/networkUtils";
import { ApiError } from "./app/services/apiHelpers";
import { ThemeProvider, useTheme } from "./app/lib/ThemeContext";

import Cart from "./app/components/svg/Cart";
import Search from "./app/components/svg/Search";
import Logo from "./app/components/svg/Logo";
import Heart from "./app/components/svg/Heart";
import Me from "./app/components/svg/Me";

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
type ScreenName =
  | "Home"
  | "Cart"
  | "Search"
  | "Favorites"
  | "Wall"
  | "Settings"
  | "RecentPieces"
  | "FriendRecommendations";
type NavigationListener = () => void;

interface SimpleNavigation {
  navigate: (screen: string, params?: any) => void;
  goBack: () => void;
  addListener: (event: string, callback: NavigationListener) => () => void;
  setParams?: (params: any) => void;
}

// React Navigation types
export type RootStackParamList = {
  Home: {
    refreshCards?: boolean;
    refreshTimestamp?: number;
    addCardItem?: any;
  };
  Cart: undefined;
  Search: undefined;
  Favorites: undefined;
  Wall: undefined;
  RecentPieces: undefined;
  FriendRecommendations: {
    friendId?: string;
    friendUsername?: string;
    friendAvatarUrl?: string | null;
    initialItems?: any[];
    clickedItemIndex?: number;
  };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

interface NavButtonProps {
  onPress: () => void;
  children: React.ReactNode;
  isActive?: boolean;
}

// NavButton component
const NavButton = ({ onPress, children, isActive }: NavButtonProps) => {
  // Animation values for press effect (using native driver)
  const scale = useRef(new Animated.Value(1)).current;
  // Shadow opacity as regular state (not animated) to avoid native driver conflicts
  const [shadowOpacity, setShadowOpacity] = useState(isActive ? 0.5 : 0);

  // Update shadow opacity when active state changes (non-animated)
  useEffect(() => {
    setShadowOpacity(isActive ? 0.5 : 0);
  }, [isActive]);

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
    onPress();
  };

  return (
    <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut}>
      <View
        style={[
          styles.navItem,
          {
            shadowOpacity,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowRadius: 4,
            elevation: isActive ? 5 : 0,
          },
        ]}
      >
        <Animated.View
          style={{
            transform: [{ scale }],
          }}
        >
          {children}
        </Animated.View>
      </View>
    </Pressable>
  );
};

// Prevent the splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

// Screen wrapper component that ensures entering animations trigger
// This forces remounting when screens come into focus so entering animations play
// Ensures old screen is completely unmounted before new one mounts
function ScreenWrapper({
  children,
  screenName,
}: {
  children: React.ReactNode;
  screenName: string;
}) {
  const [renderKey, setRenderKey] = React.useState(0);
  const [isVisible, setIsVisible] = React.useState(true);
  const isMountedRef = React.useRef(false);
  const isFocusedRef = React.useRef(false);
  const timerRef = React.useRef<NodeJS.Timeout | null>(null);

  useFocusEffect(
    React.useCallback(() => {
      // Clear any pending timer
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      const wasFocused = isFocusedRef.current;
      isFocusedRef.current = true;

      // Always remount when screen comes into focus (except on very first mount)
      // This ensures entering animations always play, matching Search's behavior
      if (!isMountedRef.current) {
        // First mount - don't remount yet, let initial render happen
        isMountedRef.current = true;
        return () => {
          // When losing focus, immediately hide to ensure clean unmount
          isFocusedRef.current = false;
          setIsVisible(false);
        };
      }

      // Screen is coming into focus after being unfocused
      if (!wasFocused) {
        // Ensure old instance is hidden first (should already be hidden from cleanup)
        setIsVisible(false);
        // Use a delay to ensure the old component is fully unmounted
        // before mounting the new one
        timerRef.current = setTimeout(() => {
          setRenderKey((prev) => prev + 1);
          setIsVisible(true);
          timerRef.current = null;
        }, 32); // Two frame delay to ensure clean unmount

        return () => {
          if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
          }
          // When losing focus, immediately hide to ensure clean unmount
          isFocusedRef.current = false;
          setIsVisible(false);
        };
      }

      return () => {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        // When losing focus, immediately hide to ensure clean unmount
        isFocusedRef.current = false;
        setIsVisible(false);
      };
    }, []),
  );

  // Don't render anything when hidden to ensure clean unmount
  if (!isVisible) {
    return null;
  }

  // Use key prop to force remount when renderKey changes
  return (
    <React.Fragment key={`${screenName}-${renderKey}`}>
      {children}
    </React.Fragment>
  );
}

const loadFonts = async () => {
  await Font.loadAsync({
    IgraSans: require("./app/assets/fonts/IgraSans.otf"), // Adjust the path as needed
    REM: require("./app/assets/fonts/REM-Regular.ttf"), // Adjust the path as needed
  });
};

// Main Navigator Component with custom tab bar
function MainNavigator({
  onLogout,
  comingFromSignup,
  navigationRef,
  setCurrentRoute,
}: {
  onLogout: () => void;
  comingFromSignup: boolean;
  navigationRef: React.RefObject<any>;
  setCurrentRoute: (route: string) => void;
}) {
  // Create navigation adapter for screens
  const createNavigationAdapter = (nav: any, route: any): SimpleNavigation => {
    return {
      navigate: (screen: string, params?: any) => {
        if (screen === "Home" && route.name === "Home") {
          // Special case: refresh cards when already on Home
          nav.setParams({
            refreshCards: true,
            refreshTimestamp: Date.now(),
          });
          return;
        }
        nav.navigate(screen as keyof RootStackParamList, params);
      },
      goBack: () => nav.navigate("Home"),
      addListener: (event: string, callback: NavigationListener) => {
        if (event === "beforeRemove") {
          return nav.addListener("beforeRemove", callback);
        }
        return () => {};
      },
      setParams: (params: any) => nav.setParams(params),
    };
  };

  return (
    <Stack.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "transparent" },
        animation: "none", // Disable React Navigation animations - screens handle their own transitions with entering/exiting
        presentation: "card", // Ensure proper screen lifecycle for entering/exiting animations
      }}
      screenListeners={{
        state: (e) => {
          const state = e.data.state;
          if (state) {
            const route = state.routes[state.index];
            setCurrentRoute(route.name);
          }
        },
      }}
    >
      <Stack.Screen
        name="Home"
        options={{
          animation: "none",
          presentation: "card",
        }}
      >
        {({ navigation: nav, route }) => (
          <ScreenWrapper screenName="home">
            <MainPage
              key={`home-${route.params?.refreshTimestamp || 0}`}
              navigation={createNavigationAdapter(nav, route)}
              route={route}
            />
          </ScreenWrapper>
        )}
      </Stack.Screen>
      <Stack.Screen
        name="Cart"
        options={{
          animation: "none",
          presentation: "card",
        }}
      >
        {({ navigation: nav, route }) => (
          <ScreenWrapper screenName="cart">
            <CartPage navigation={createNavigationAdapter(nav, route)} />
          </ScreenWrapper>
        )}
      </Stack.Screen>
      <Stack.Screen
        name="Search"
        options={{
          animation: "none",
          presentation: "card",
        }}
      >
        {({ navigation: nav, route }) => (
          <ScreenWrapper screenName="search">
            <SearchPage navigation={createNavigationAdapter(nav, route)} />
          </ScreenWrapper>
        )}
      </Stack.Screen>
      <Stack.Screen
        name="Favorites"
        options={{
          animation: "none",
          presentation: "card",
        }}
      >
        {({ navigation: nav, route }) => (
          <ScreenWrapper screenName="favorites">
            <FavoritesPage navigation={createNavigationAdapter(nav, route)} />
          </ScreenWrapper>
        )}
      </Stack.Screen>
      <Stack.Screen
        name="Wall"
        options={{
          animation: "none",
          presentation: "card",
        }}
      >
        {({ navigation: nav, route }) => (
          <ScreenWrapper screenName="wall">
            <WallPage
              navigation={createNavigationAdapter(nav, route)}
              onLogout={onLogout}
            />
          </ScreenWrapper>
        )}
      </Stack.Screen>
      <Stack.Screen
        name="RecentPieces"
        options={{
          animation: "none",
          presentation: "card",
        }}
      >
        {({ navigation: nav, route }) => (
          <ScreenWrapper screenName="recent-pieces">
            <RecentPiecesScreen
              navigation={createNavigationAdapter(nav, route)}
            />
          </ScreenWrapper>
        )}
      </Stack.Screen>
      <Stack.Screen
        name="FriendRecommendations"
        options={{
          animation: "none",
          presentation: "card",
        }}
      >
        {({ navigation: nav, route }) => {
          const params = route.params || {};
          return (
            <ScreenWrapper
              screenName={`friend-rec-${params.friendId || "default"}`}
            >
              <FriendRecommendationsScreen
                navigation={createNavigationAdapter(nav, route)}
                route={{
                  params: {
                    friendId: params.friendId || "",
                    friendUsername: params.friendUsername || "",
                    friendAvatarUrl: params.friendAvatarUrl,
                    initialItems: params.initialItems || [],
                    clickedItemIndex: params.clickedItemIndex || 0,
                  },
                }}
              />
            </ScreenWrapper>
          );
        }}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

// Main App Navigator wrapper with NavigationContainer and tab bar
function MainAppNavigator({
  onLogout,
  comingFromSignup,
}: {
  onLogout: () => void;
  comingFromSignup: boolean;
}) {
  const { theme } = useTheme();
  const navigationRef = React.useRef<any>(null);
  const [currentRoute, setCurrentRoute] = React.useState<string>("Home");
  const insets = useSafeAreaInsets();

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={{
        dark: false,
        colors: {
          primary: theme.primary,
          background: "transparent",
          card: "transparent",
          text: theme.text.primary,
          border: "transparent",
          notification: theme.primary,
        },
      }}
      onStateChange={(state) => {
        if (state) {
          const route = state.routes[state.index];
          setCurrentRoute(route.name);
        }
      }}
    >
      <LinearGradient
        colors={theme.gradients.main as any}
        locations={theme.gradients.mainLocations as any}
        style={styles.gradient}
        start={{ x: 0, y: 0.2 }}
        end={{ x: 1, y: 0.8 }}
      >
        <SafeAreaView style={styles.container} edges={["top"]}>
          <View style={styles.screenContainer}>
            <MainNavigator
              onLogout={onLogout}
              comingFromSignup={comingFromSignup}
              navigationRef={navigationRef}
              setCurrentRoute={setCurrentRoute}
            />
          </View>

          {/* Custom Bottom Tab Bar - extends to bottom, padding for home indicator */}
          <View
            style={[
              styles.navbar,
              {
                paddingBottom: Math.max(15, insets.bottom),
                backgroundColor: theme.background.overlay,
              },
            ]}
          >
            <NavButton
              onPress={() => {
                navigationRef.current?.navigate("Cart");
              }}
              isActive={currentRoute === "Cart"}
            >
              <Cart width={32.75} height={32} />
            </NavButton>

            <NavButton
              onPress={() => {
                navigationRef.current?.navigate("Search");
              }}
              isActive={currentRoute === "Search"}
            >
              <Search width={24.75} height={24.75} />
            </NavButton>

            <NavButton
              onPress={() => {
                navigationRef.current?.navigate("Home");
              }}
              isActive={currentRoute === "Home"}
            >
              <Logo width={21} height={28} />
            </NavButton>

            <NavButton
              onPress={() => {
                navigationRef.current?.navigate("Favorites");
              }}
              isActive={currentRoute === "Favorites"}
            >
              <Heart width={28.74} height={25.07} />
            </NavButton>

            <NavButton
              onPress={() => {
                navigationRef.current?.navigate("Wall");
              }}
              isActive={currentRoute === "Wall"}
            >
              <Me width={30.25} height={30.25} />
            </NavButton>
          </View>
        </SafeAreaView>
      </LinearGradient>
    </NavigationContainer>
  );
}

function AppContent() {
  const { fadeAnim } = useTheme();
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
  const alertShowingRef = useRef(false); // Use ref for atomic flag checking

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
            "App - Global cart storage reset due to session expiration",
          );
        }
      } catch (error) {
        console.error("Error clearing cart on session expiration:", error);
      }
    };

    const handleTokenInvalidation = async () => {
      // Prevent multiple alerts from showing - check and set atomically using ref
      if (alertShowingRef.current) {
        console.log("App - Alert already showing, skipping duplicate");
        return;
      }

      // Set flag immediately to prevent other simultaneous calls from showing alerts
      alertShowingRef.current = true;

      // Check if user is on an authenticated screen (actively using the app)
      // Only show alert if they're on an authenticated screen
      // If they're on boot/unauthenticated, just navigate silently
      const authenticatedPhases: AppPhase[] = [
        "main",
        "profile_confirm",
        "profile_brands",
        "profile_styles",
        "email_verification",
      ];
      const isOnAuthenticatedScreen = authenticatedPhases.includes(
        currentPhaseRef.current,
      );

      console.log(
        `App - Token invalid, current phase: ${currentPhaseRef.current}, showing alert: ${isOnAuthenticatedScreen}`,
      );

      // Clear session immediately (don't wait for user to press OK)
      await handleSessionExpired();

      // Navigate to welcome screen immediately (don't wait for alert)
      dispatchNav({ type: "SET_PHASE", phase: "unauthenticated" });
      dispatchNav({ type: "SET_OVERLAY", overlay: "none" });

      // Only show alert if user was actively using the app (on authenticated screen)
      if (isOnAuthenticatedScreen) {
        // Show popup alert to user
        Alert.alert(
          "Сессия истекла",
          "Ваша сессия истекла. Пожалуйста, войдите в систему снова.",
          [
            {
              text: "OK",
              onPress: () => {
                alertShowingRef.current = false;
              },
            },
          ],
          {
            onDismiss: () => {
              alertShowingRef.current = false;
            },
          },
        );
      } else {
        console.log(
          "App - User not on authenticated screen, navigating silently without alert",
        );
        // Reset flag since we're not showing an alert
        alertShowingRef.current = false;
      }
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

  // Removed: currentScreen, previousScreen, isTransitioning - now handled by React Navigation
  const [cartInitialized, setCartInitialized] = useState(false);
  const [comingFromSignup, setComingFromSignup] = useState(false); // Track if user is coming from signup

  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isAuthFlowInProgress, setIsAuthFlowInProgress] = useState(false);
  const [isProfileStepSaving, setIsProfileStepSaving] = useState(false);

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
    action: AppNavAction,
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

  // Track current phase in a ref so we can check it in the session expiration handler
  const currentPhaseRef = useRef<AppPhase>("boot");
  useEffect(() => {
    currentPhaseRef.current = navState.phase;
  }, [navState.phase]);

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
        `Authentication error in ${context}, triggering session manager to show alert`,
      );
      // Use session manager to handle login required, which will show alert and clear data
      api.sessionManager.handleLoginRequired();
      return true; // Indicates auth error was handled
    }

    return false; // Not an auth error
  };

  const handleProfileCompletion = async (
    completionStatus: api.ProfileCompletionStatus,
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

  // Navigation event listeners (kept for compatibility with screens that might use beforeRemove)
  const navigationListeners = useRef<Record<string, Set<NavigationListener>>>({
    beforeRemove: new Set(),
  }).current;

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
          savedItems.length,
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
          "App - Unauthenticated at startup, clearing cart and going to Welcome.",
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
      return user.profile?.gender || "male";
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
        "getUserSelectedBrands",
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
        "getUserFavoriteStyles",
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
    // Screen navigation handled by React Navigation
  };

  const handleAuthLoadingFinish = () => {
    dispatchNav({ type: "SET_OVERLAY", overlay: "none" });
    // Screen navigation handled by React Navigation
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
          "User email not verified after login, showing verification screen",
        );
        dispatchNav({ type: "SET_OVERLAY", overlay: "up" });
        transitionTo("email_verification");
        return;
      }

      // Get profile completion status with error handling for international users
      let completionStatus;
      console.log("Attempting to get profile completion status...");
      try {
        completionStatus = await api.getProfileCompletionStatus();
        setProfileCompletionStatus(completionStatus);
        console.log(
          "Profile completion status after login:",
          JSON.stringify(completionStatus),
        );
      } catch (error) {
        console.error(
          "Error getting profile completion status after login:",
          error,
        );
        console.error(
          "Error type:",
          error instanceof Error ? error.constructor.name : typeof error,
        );
        console.error(
          "Error message:",
          error instanceof Error ? error.message : String(error),
        );
        // If we can't get profile completion status, check email verification status
        // and assume user needs to complete onboarding
        const user = await api.getCurrentUser();
        if (!user.is_email_verified) {
          completionStatus = {
            isComplete: false,
            missingFields: [],
            requiredScreens: [
              "confirmation",
            ] as api.ProfileCompletionStatus["requiredScreens"],
          };
        } else {
          // If email is verified but we can't get completion status,
          // assume profile is complete to avoid blocking user
          completionStatus = {
            isComplete: true,
            missingFields: [],
            requiredScreens: [],
          };
        }
        setProfileCompletionStatus(completionStatus);
      }
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
            error.message.includes("Failed to fetch") ||
            error.message.includes("Network request failed") ||
            error.name === "NetworkTimeoutError" ||
            error.name === "NetworkRetryError" ||
            error.name === "TypeError"));

      // Also check if it's an API error that might be network-related
      const isApiError = error instanceof ApiError && error.status === 0;

      if (isNetworkError || isApiError) {
        console.log(
          "Network/API error detected, showing error message and staying on current screen",
        );
        // Show error message to user but don't skip to main screen
        Alert.alert(
          "Проблема с подключением",
          "Не удалось проверить статус профиля. Это может быть связано с медленным интернет-соединением. Попробуйте еще раз или проверьте подключение к интернету.",
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
          ],
        );
        return; // Don't proceed to finally block yet
      }

      // For other errors, proceed with normal login flow
      console.log("Non-network error in login flow, proceeding to main screen");
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
    password: string,
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

      // Get profile completion status with extended timeout for international users
      let completionStatus;
      try {
        completionStatus = await api.getProfileCompletionStatus();
        setProfileCompletionStatus(completionStatus);
        console.log(
          "Profile completion status after registration:",
          JSON.stringify(completionStatus),
        );
      } catch (error) {
        console.error("Error getting profile completion status:", error);
        // If profile completion check fails, assume user needs email verification
        // This prevents skipping essential onboarding steps
        completionStatus = {
          isComplete: false,
          missingFields: [],
          requiredScreens: [
            "confirmation",
          ] as api.ProfileCompletionStatus["requiredScreens"],
        };
        setProfileCompletionStatus(completionStatus);
      }

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
        error,
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
            error.message.includes("Failed to fetch") ||
            error.message.includes("Network request failed") ||
            error.name === "NetworkTimeoutError" ||
            error.name === "NetworkRetryError" ||
            error.name === "TypeError"));

      // Also check if it's an API error that might be network-related
      const isApiError = error instanceof ApiError && error.status === 0;

      if (isNetworkError || isApiError) {
        console.log(
          "Network/API error detected during registration, showing error message and staying on current screen",
        );
        // Show error message to user but don't skip to main screen
        Alert.alert(
          "Проблема с подключением",
          "Не удалось проверить статус профиля после регистрации. Это может быть связано с медленным интернет-соединением. Попробуйте еще раз или проверьте подключение к интернету.",
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
          ],
        );
        return; // Don't proceed to finally block yet
      }

      // For other errors, proceed with normal registration flow
      console.log(
        "Non-network error in registration flow, proceeding to main screen",
      );
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
      setProfileCompletionStatus(null);
      setGender(null);
      setSelectedBrands([]);
      transitionTo("unauthenticated");
    } catch (error) {
      console.error("Error during logout:", error);
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
      await api.updateUserProfileData({ gender: choice });

      // Check next requirements and transition
      const completionStatus = await api.getProfileCompletionStatus();
      console.log(
        "Profile completion status after gender update:",
        JSON.stringify(completionStatus),
      );
      const required = completionStatus.requiredScreens || [];
      if (required.includes("brand_selection")) {
        transitionTo("profile_brands");
        await yieldToReact();
      } else if (required.includes("style_selection")) {
        transitionTo("profile_styles");
        await yieldToReact();
      } else {
        setComingFromSignup(true);
        dispatchNav({ type: "SET_OVERLAY", overlay: "down" });
        transitionTo("main");
        await yieldToReact();
      }
    } catch (error) {
      console.error("Error updating gender:", error);

      const authErrorHandled = await handleAuthError(
        error,
        "handleConfirmationComplete",
      );
      if (authErrorHandled) {
        return;
      }

      // Rethrow so child can show error and reset button
      throw error;
    }
  };

  // Yield so React can commit the phase change and unmount the child before our
  // promise resolves; avoids the child briefly showing "continue" again.
  const yieldToReact = () =>
    new Promise<void>((resolve) => setTimeout(resolve, 0));

  // Handle brand search completion
  const handleBrandSearchComplete = async (brands: number[]) => {
    setIsProfileStepSaving(true);
    console.log(`User selected brands: ${brands.join(", ")}`);
    setSelectedBrands(brands);

    try {
      await api.updateUserBrands(brands);

      const completionStatus = await api.getProfileCompletionStatus();
      const required = completionStatus.requiredScreens || [];
      if (required.includes("style_selection")) {
        transitionTo("profile_styles");
        setIsProfileStepSaving(false);
        await yieldToReact();
      } else {
        setComingFromSignup(true);
        dispatchNav({ type: "SET_OVERLAY", overlay: "down" });
        transitionTo("main");
        setIsProfileStepSaving(false);
        await yieldToReact();
      }
    } catch (error) {
      console.error("Error updating selected brands:", error);
      setIsProfileStepSaving(false);
      const authErrorHandled = await handleAuthError(
        error,
        "handleBrandSearchComplete",
      );
      if (authErrorHandled) {
        return;
      }
      throw error;
    }
  };

  // Handle styles selection completion
  const handleStylesSelectionComplete = async (styles: string[]) => {
    setIsProfileStepSaving(true);
    console.log(`User selected styles: ${styles.join(", ")}`);

    try {
      await api.updateUserStyles(styles);

      setComingFromSignup(true);
      dispatchNav({ type: "SET_OVERLAY", overlay: "down" });
      transitionTo("main");
      setIsProfileStepSaving(false);
      await yieldToReact();
    } catch (error) {
      console.error("Error updating favorite styles:", error);
      setIsProfileStepSaving(false);
      const authErrorHandled = await handleAuthError(
        error,
        "handleStylesSelectionComplete",
      );
      if (authErrorHandled) {
        return;
      }
      throw error;
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
        "Email verification successful, checking profile completion...",
      );

      // Show loading screen immediately to prevent UI flicker
      dispatchNav({ type: "SET_OVERLAY", overlay: "static" });

      // Refresh user profile to get updated email verification status
      const user = await api.getCurrentUser();
      setUserEmail(user.email);

      // Check profile completion status with error handling
      let completionStatus;
      console.log(
        "Attempting to get profile completion status after email verification...",
      );
      try {
        completionStatus = await api.getProfileCompletionStatus();
        setProfileCompletionStatus(completionStatus);
        console.log(
          "Profile completion status after email verification:",
          JSON.stringify(completionStatus),
        );
      } catch (error) {
        console.error(
          "Error getting profile completion status after email verification:",
          error,
        );
        console.error(
          "Error type:",
          error instanceof Error ? error.constructor.name : typeof error,
        );
        console.error(
          "Error message:",
          error instanceof Error ? error.message : String(error),
        );
        // If we can't get profile completion status, assume user needs to complete onboarding
        completionStatus = {
          isComplete: false,
          missingFields: [],
          requiredScreens: [
            "confirmation",
          ] as api.ProfileCompletionStatus["requiredScreens"],
        };
        setProfileCompletionStatus(completionStatus);
      }
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

        // Dismiss loading screen and transition to completion screens
        dispatchNav({ type: "SET_OVERLAY", overlay: "down" });

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
        error,
      );

      // First check if this is an authentication error
      const authErrorHandled = await handleAuthError(
        error,
        "handleEmailVerificationSuccess",
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
            error.message.includes("Failed to fetch") ||
            error.message.includes("Network request failed") ||
            error.name === "NetworkTimeoutError" ||
            error.name === "NetworkRetryError" ||
            error.name === "TypeError"));

      // Also check if it's an API error that might be network-related
      const isApiError = error instanceof ApiError && error.status === 0;

      if (isNetworkError || isApiError) {
        console.log(
          "Network/API error detected after email verification, showing error message and staying on current screen",
        );
        // Show error message to user but don't skip to main screen
        Alert.alert(
          "Проблема с подключением",
          "Не удалось проверить статус профиля после подтверждения email. Это может быть связано с медленным интернет-соединением. Попробуйте еще раз или проверьте подключение к интернету.",
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
          ],
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
      "Password reset verification successful, showing reset form...",
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

  // Notify listeners before screen change (kept for compatibility)
  const notifyBeforeRemove = () => {
    navigationListeners.beforeRemove.forEach((listener) => listener());
  };

  // Old navigation code removed - React Navigation handles navigation now
  // NavButton is defined at the top level of the file

  // User interface based on phase; overlays rendered on top
  return (
    <SafeAreaProvider>
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
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
            isSaving={isProfileStepSaving}
            onBack={() => {
              transitionTo("profile_confirm");
            }}
          />
        )}

        {navState.phase === "profile_styles" && (
          <StylesSelectionScreen
            gender={gender!}
            onComplete={handleStylesSelectionComplete}
            isSaving={isProfileStepSaving}
            onBack={() => {
              transitionTo("profile_brands");
            }}
          />
        )}

        {navState.phase === "main" && (
          <MainAppNavigator
            onLogout={handleLogout}
            comingFromSignup={comingFromSignup}
          />
        )}

        {navState.overlay === "static" && <SimpleAuthLoadingScreen />}
        {navState.overlay === "up" && (
          <AuthLoadingScreen onFinish={handleAuthLoadingFinish} />
        )}
        {navState.overlay === "down" && (
          <LoadingScreen onFinish={handleLoadingFinish} />
        )}
      </GestureHandlerRootView>
      </Animated.View>
    </SafeAreaProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "transparent",
  },
  gradient: {
    flex: 1,
  },
  screenContainer: {
    flex: 1,
    width: "100%",
  },
  navbar: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    minHeight: Dimensions.get("window").height * 0.1,
    paddingTop: 10,
    paddingBottom: 15,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
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
    backgroundColor: "transparent",
  },
});
