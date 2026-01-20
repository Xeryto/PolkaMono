import React, { useState, useRef, useEffect, useCallback } from "react";
import { ActivityIndicator } from "react-native";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  Dimensions,
  TouchableOpacity,
  Animated as RNAnimated,
  TextInput,
  FlatList,
  Keyboard,
  Platform,
  Linking,
  Alert,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Switch,
  LayoutAnimation,
  UIManager,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOutDown,
  withSequence,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  runOnJS,
  Easing as ReanimatedEasing,
} from "react-native-reanimated";
import BackIcon from "./components/svg/BackIcon";
import LogOut from "./components/svg/LogOut";
import PenIcon from "./components/svg/PenIcon";
import Scroll from "./components/svg/Scroll";
import * as Haptics from "expo-haptics";
import Tick from "./assets/Tick";
import { AnimatedCircularProgress } from "react-native-circular-progress";
import * as api from "./services/api";
import { apiWrapper } from "./services/apiWrapper";
import {
  ANIMATION_DURATIONS,
  ANIMATION_DELAYS,
  ANIMATION_EASING,
  getStaggeredDelay,
  getFadeInDownAnimation,
  getFadeOutDownAnimation,
} from "./lib/animations";
import AvatarEditScreen from "./screens/AvatarEditScreen";

const { width, height } = Dimensions.get("window");

// Helper function to calculate translateX based on label width
// Defined outside component since it doesn't depend on component state
// Marked as worklet for react-native-reanimated
const calculateTranslateX = (labelPos: number, labelWidth: number) => {
  "worklet";
  const ovalWidth = width * 0.88;
  const leftPadding = 20;
  const rightPadding = 20;
  // Ensure labelWidth is valid
  const validLabelWidth = Math.max(labelWidth || 30, 30);
  // Calculate translation: move from left position to right position
  // We want the label to be positioned on the right but not too close to the edge
  // Leave extra space on the right for better visual balance
  const extraRightSpacing = 40; // Extra space from the right edge
  const rightEdgePosition = ovalWidth - rightPadding - extraRightSpacing;
  const rightStartPosition = rightEdgePosition - validLabelWidth;
  const translationDistance = rightStartPosition - leftPadding;
  // Apply the labelPos (0 to 1) to the translation distance
  return labelPos * Math.max(0, translationDistance);
};

// Define a simpler navigation type that our custom navigation can satisfy
interface SimpleNavigation {
  navigate: (screen: string, params?: any) => void;
  goBack: () => void;
  setBottomText?: (text: string) => void;
}

interface SettingsProps {
  navigation: SimpleNavigation;
  onLogout?: () => void;
  embedded?: boolean; // If true, render only content without outer container
  initialSection?:
    | "payment"
    | "support"
    | "shopping"
    | "my_info"
    | "notifications"
    | "privacy"
    | "documents"
    | null; // Initial section to show when embedded
}

// Using unified CardItem from types/product.d.ts

interface StatItem {
  label: string;
  value: string;
}

// Enable LayoutAnimation on Android
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Helper function to get privacy label - defined outside component
const getPrivacyLabel = (option: "nobody" | "friends" | "everyone"): string => {
  switch (option) {
    case "nobody":
      return "никто";
    case "friends":
      return "друзья";
    case "everyone":
      return "все";
    default:
      return "";
  }
};

// Animated Privacy Text Component - defined outside Settings component to maintain state
const AnimatedPrivacyText = ({
  value,
  itemId,
  textStyle,
}: {
  value: "nobody" | "friends" | "everyone";
  itemId: string;
  textStyle: any;
}) => {
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(1);
  const [displayLabel, setDisplayLabel] = useState(() =>
    getPrivacyLabel(value)
  );
  const prevValueRef = useRef<"nobody" | "friends" | "everyone">(value);
  const isAnimatingRef = useRef(false);
  const isInitialMount = useRef(true);
  const [animationComplete, setAnimationComplete] = useState(0);
  const [lastAnimatedValue, setLastAnimatedValue] = useState<
    "nobody" | "friends" | "everyone"
  >(value);
  const targetValueRef = useRef<"nobody" | "friends" | "everyone">(value);

  // Completion handler - only updates state
  const handleAnimationComplete = useCallback(
    (animatedValue: "nobody" | "friends" | "everyone") => {
      setLastAnimatedValue(animatedValue);
      setAnimationComplete((prev) => prev + 1);
    },
    []
  );

  // Function to start animation - extracted to avoid dependency issues
  const startAnimation = useCallback(
    (targetValue: "nobody" | "friends" | "everyone") => {
      if (isAnimatingRef.current) {
        // Store target value if animation is in progress
        targetValueRef.current = targetValue;
        return;
      }

      isAnimatingRef.current = true;
      const newLabel = getPrivacyLabel(targetValue);

      // First: Animate old text to shrink (don't translate yet)
      scale.value = withTiming(
        0.5,
        {
          duration: ANIMATION_DURATIONS.MEDIUM,
          easing: ReanimatedEasing.out(ReanimatedEasing.cubic),
        },
        () => {
          // After shrink completes, then slide right
          translateX.value = withTiming(
            width * 0.4,
            {
              duration: ANIMATION_DURATIONS.MEDIUM,
              easing: ReanimatedEasing.in(ReanimatedEasing.cubic),
            },
            () => {
              // After old text slides out, update label and reset for new text
              runOnJS(setDisplayLabel)(newLabel);
              opacity.value = 0;
              translateX.value = -width * 0.4;
              scale.value = 0.5;

              // Small delay before new text appears, then animate in
              translateX.value = withDelay(
                150,
                withTiming(0, {
                  duration: ANIMATION_DURATIONS.MEDIUM,
                  easing: ReanimatedEasing.out(ReanimatedEasing.cubic),
                })
              );

              scale.value = withDelay(
                150,
                withTiming(1, {
                  duration: ANIMATION_DURATIONS.MEDIUM,
                  easing: ReanimatedEasing.out(ReanimatedEasing.cubic),
                })
              );

              opacity.value = withDelay(
                150,
                withTiming(
                  1,
                  {
                    duration: ANIMATION_DURATIONS.MEDIUM,
                  },
                  () => {
                    runOnJS(handleAnimationComplete)(targetValue);
                  }
                )
              );
            }
          );
        }
      );
    },
    [handleAnimationComplete]
  );

  useEffect(() => {
    // Skip animation on initial mount
    if (isInitialMount.current) {
      isInitialMount.current = false;
      prevValueRef.current = value;
      targetValueRef.current = value;
      return;
    }

    // Update target value ref
    targetValueRef.current = value;

    // Handle animation completion
    if (animationComplete > 0) {
      // Animation just completed, update prevValue
      prevValueRef.current = lastAnimatedValue;
      isAnimatingRef.current = false;

      // Check if we need to animate to new target
      if (targetValueRef.current !== lastAnimatedValue) {
        startAnimation(targetValueRef.current);
        return;
      }
    }

    // Check if we need to start new animation
    if (
      prevValueRef.current !== targetValueRef.current &&
      !isAnimatingRef.current
    ) {
      startAnimation(targetValueRef.current);
    }
  }, [value, startAnimation, animationComplete, lastAnimatedValue]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }, { translateX: translateX.value }],
      opacity: opacity.value,
    };
  });

  return (
    <Animated.Text style={[textStyle, animatedStyle]}>
      {displayLabel}
    </Animated.Text>
  );
};

const Settings = ({
  navigation,
  onLogout,
  embedded = false,
  initialSection = null,
}: SettingsProps) => {
  const [selectedSize, setSelectedSize] = useState("M");
  const [activeSection, setActiveSection] = useState<
    | "payment"
    | "support"
    | "shopping"
    | "my_info"
    | "notifications"
    | "privacy"
    | "documents"
    | "delete_account"
    | null
  >(initialSection || null);

  // Update activeSection when initialSection prop changes
  useEffect(() => {
    if (initialSection !== null && initialSection !== activeSection) {
      setActiveSection(initialSection);
    }
  }, [initialSection]);
  const [showSizeSelection, setShowSizeSelection] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [popularBrands, setPopularBrands] = useState<string[]>([]);
  const [showBrandSearch, setShowBrandSearch] = useState(false);
  const [showAvatarEdit, setShowAvatarEdit] = useState(false);
  const [supportMessage, setSupportMessage] = useState("");
  const [showThankYou, setShowThankYou] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showScrollHint, setShowScrollHint] = useState(true);

  // NEW: User profile state
  const [userProfile, setUserProfile] = useState<api.UserProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  // User statistics state
  const [userStats, setUserStats] = useState<api.UserStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [statsLastLoaded, setStatsLastLoaded] = useState<number>(0);

  // Swipe count from session storage (for real-time updates)
  const [swipeCount, setSwipeCount] = useState<number>(0);

  // Shopping information state
  const [shoppingInfo, setShoppingInfo] = useState({
    address: "",
    phoneNumber: "", // Phone number without country code
    deliveryEmail: "",
    city: "",
    postalCode: "",
    fullName: "",
    street: "",
    houseNumber: "",
    apartmentNumber: "",
    index: "",
  });
  const phoneCountryCode = "+7"; // Fixed to Russian country code
  const [isLoadingShoppingInfo, setIsLoadingShoppingInfo] = useState(false);
  const [shoppingInfoError, setShoppingInfoError] = useState<string | null>(
    null
  );
  const [isSavingShoppingInfo, setIsSavingShoppingInfo] = useState(false);
  const [deliveryScreenView, setDeliveryScreenView] = useState<
    "main" | "address"
  >("main");

  // Focus state for address fields
  const [focusedAddressField, setFocusedAddressField] = useState<string | null>(
    null
  );

  // Animated values for address label positions (0 = left, 1 = right)
  const streetLabelPos = useSharedValue(0);
  const houseNumberLabelPos = useSharedValue(0);
  const cityLabelPos = useSharedValue(0);
  const apartmentNumberLabelPos = useSharedValue(0);
  const indexLabelPos = useSharedValue(0);

  // Shared values for address label widths (will be measured)
  const streetLabelWidth = useSharedValue(0);
  const houseNumberLabelWidth = useSharedValue(0);
  const cityLabelWidth = useSharedValue(0);
  const apartmentNumberLabelWidth = useSharedValue(0);
  const indexLabelWidth = useSharedValue(0);

  // Animated values for phone and delivery email label positions
  const phoneLabelPos = useSharedValue(0);
  const deliveryEmailLabelPos = useSharedValue(0);

  // Shared values for phone and delivery email label widths
  const phoneLabelWidth = useSharedValue(0);
  const deliveryEmailLabelWidth = useSharedValue(0);

  // My Info state
  const [myInfo, setMyInfo] = useState({
    gender: "" as "male" | "female" | "",
    firstName: "",
    lastName: "",
    username: "",
    email: "",
  });
  const [originalUsername, setOriginalUsername] = useState(""); // Store original username to check if changed
  const [isLoadingMyInfo, setIsLoadingMyInfo] = useState(false);
  const [isSavingMyInfo, setIsSavingMyInfo] = useState(false);
  const [myInfoError, setMyInfoError] = useState<string | null>(null);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(
    null
  );
  const [usernameError, setUsernameError] = useState("");

  // Focus state for floating labels
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [focusedShoppingField, setFocusedShoppingField] = useState<
    string | null
  >(null);

  // Animated values for label positions (0 = left, 1 = right)
  const firstNameLabelPos = useSharedValue(0);
  const lastNameLabelPos = useSharedValue(0);
  const usernameLabelPos = useSharedValue(0);
  const emailLabelPos = useSharedValue(0);

  // Shared values for label widths (will be measured)
  const firstNameLabelWidth = useSharedValue(0);
  const lastNameLabelWidth = useSharedValue(0);
  const usernameLabelWidth = useSharedValue(0);
  const emailLabelWidth = useSharedValue(0);

  // Update label positions based on focus/text state
  useEffect(() => {
    const shouldMoveRight = focusedField === "firstName" || !!myInfo.firstName;
    firstNameLabelPos.value = withTiming(shouldMoveRight ? 1 : 0, {
      duration: 300,
      easing: ReanimatedEasing.out(ReanimatedEasing.ease),
    });
  }, [focusedField, myInfo.firstName]);

  useEffect(() => {
    const shouldMoveRight = focusedField === "lastName" || !!myInfo.lastName;
    lastNameLabelPos.value = withTiming(shouldMoveRight ? 1 : 0, {
      duration: 300,
      easing: ReanimatedEasing.out(ReanimatedEasing.ease),
    });
  }, [focusedField, myInfo.lastName]);

  useEffect(() => {
    const shouldMoveRight = focusedField === "username" || !!myInfo.username;
    usernameLabelPos.value = withTiming(shouldMoveRight ? 1 : 0, {
      duration: 300,
      easing: ReanimatedEasing.out(ReanimatedEasing.ease),
    });
  }, [focusedField, myInfo.username]);

  useEffect(() => {
    const shouldMoveRight = focusedField === "email" || !!myInfo.email;
    emailLabelPos.value = withTiming(shouldMoveRight ? 1 : 0, {
      duration: 300,
      easing: ReanimatedEasing.out(ReanimatedEasing.ease),
    });
  }, [focusedField, myInfo.email]);

  // Update address label positions based on focus/text state
  useEffect(() => {
    const shouldMoveRight =
      focusedAddressField === "street" || !!shoppingInfo.street;
    streetLabelPos.value = withTiming(shouldMoveRight ? 1 : 0, {
      duration: 300,
      easing: ReanimatedEasing.out(ReanimatedEasing.ease),
    });
  }, [focusedAddressField, shoppingInfo.street]);

  useEffect(() => {
    const shouldMoveRight =
      focusedAddressField === "houseNumber" || !!shoppingInfo.houseNumber;
    houseNumberLabelPos.value = withTiming(shouldMoveRight ? 1 : 0, {
      duration: 300,
      easing: ReanimatedEasing.out(ReanimatedEasing.ease),
    });
  }, [focusedAddressField, shoppingInfo.houseNumber]);

  useEffect(() => {
    const shouldMoveRight =
      focusedAddressField === "city" || !!shoppingInfo.city;
    cityLabelPos.value = withTiming(shouldMoveRight ? 1 : 0, {
      duration: 300,
      easing: ReanimatedEasing.out(ReanimatedEasing.ease),
    });
  }, [focusedAddressField, shoppingInfo.city]);

  useEffect(() => {
    const shouldMoveRight =
      focusedAddressField === "apartmentNumber" ||
      !!shoppingInfo.apartmentNumber;
    apartmentNumberLabelPos.value = withTiming(shouldMoveRight ? 1 : 0, {
      duration: 300,
      easing: ReanimatedEasing.out(ReanimatedEasing.ease),
    });
  }, [focusedAddressField, shoppingInfo.apartmentNumber]);

  useEffect(() => {
    const shouldMoveRight =
      focusedAddressField === "index" || !!shoppingInfo.index;
    indexLabelPos.value = withTiming(shouldMoveRight ? 1 : 0, {
      duration: 300,
      easing: ReanimatedEasing.out(ReanimatedEasing.ease),
    });
  }, [focusedAddressField, shoppingInfo.index]);

  // Update phone and email label positions
  useEffect(() => {
    const shouldMoveRight =
      focusedShoppingField === "phoneNumber" || !!shoppingInfo.phoneNumber;
    phoneLabelPos.value = withTiming(shouldMoveRight ? 1 : 0, {
      duration: 300,
      easing: ReanimatedEasing.out(ReanimatedEasing.ease),
    });
  }, [focusedShoppingField, shoppingInfo.phoneNumber]);

  useEffect(() => {
    const shouldMoveRight =
      focusedShoppingField === "deliveryEmail" || !!shoppingInfo.deliveryEmail;
    deliveryEmailLabelPos.value = withTiming(shouldMoveRight ? 1 : 0, {
      duration: 300,
      easing: ReanimatedEasing.out(ReanimatedEasing.ease),
    });
  }, [focusedShoppingField, shoppingInfo.deliveryEmail]);

  // Create animated styles at component level (hooks must be at top level)
  const firstNameAnimatedStyle = useAnimatedStyle(() => {
    const translateX = calculateTranslateX(
      firstNameLabelPos.value,
      firstNameLabelWidth.value || 30 // Fallback width for "Имя"
    );
    return {
      transform: [{ translateX }],
    };
  });

  const lastNameAnimatedStyle = useAnimatedStyle(() => {
    const translateX = calculateTranslateX(
      lastNameLabelPos.value,
      lastNameLabelWidth.value || 60 // Fallback width for "Фамилия"
    );
    return {
      transform: [{ translateX }],
    };
  });

  const usernameAnimatedStyle = useAnimatedStyle(() => {
    const translateX = calculateTranslateX(
      usernameLabelPos.value,
      usernameLabelWidth.value || 70 // Fallback width for "Никнейм"
    );
    return {
      transform: [{ translateX }],
    };
  });

  const emailAnimatedStyle = useAnimatedStyle(() => {
    const translateX = calculateTranslateX(
      emailLabelPos.value,
      emailLabelWidth.value || 50 // Fallback width for "Email"
    );
    return {
      transform: [{ translateX }],
    };
  });

  // Address field animated styles
  const streetAnimatedStyle = useAnimatedStyle(() => {
    const translateX = calculateTranslateX(
      streetLabelPos.value,
      streetLabelWidth.value || 50 // Fallback width for "улица"
    );
    return {
      transform: [{ translateX }],
    };
  });

  const houseNumberAnimatedStyle = useAnimatedStyle(() => {
    const translateX = calculateTranslateX(
      houseNumberLabelPos.value,
      houseNumberLabelWidth.value || 80 // Fallback width for "номер дома"
    );
    return {
      transform: [{ translateX }],
    };
  });

  const cityAnimatedStyle = useAnimatedStyle(() => {
    const translateX = calculateTranslateX(
      cityLabelPos.value,
      cityLabelWidth.value || 40 // Fallback width for "город"
    );
    return {
      transform: [{ translateX }],
    };
  });

  const apartmentNumberAnimatedStyle = useAnimatedStyle(() => {
    const translateX = calculateTranslateX(
      apartmentNumberLabelPos.value,
      apartmentNumberLabelWidth.value || 120 // Fallback width for "номер квартиры"
    );
    return {
      transform: [{ translateX }],
    };
  });

  const indexAnimatedStyle = useAnimatedStyle(() => {
    const translateX = calculateTranslateX(
      indexLabelPos.value,
      indexLabelWidth.value || 50 // Fallback width for "индекс"
    );
    return {
      transform: [{ translateX }],
    };
  });

  // Phone and delivery email animated styles
  const phoneAnimatedStyle = useAnimatedStyle(() => {
    const translateX = calculateTranslateX(
      phoneLabelPos.value,
      phoneLabelWidth.value || 60 // Fallback width for "телефон"
    );
    return {
      transform: [{ translateX }],
    };
  });

  const deliveryEmailAnimatedStyle = useAnimatedStyle(() => {
    const translateX = calculateTranslateX(
      deliveryEmailLabelPos.value,
      deliveryEmailLabelWidth.value || 50 // Fallback width for "email"
    );
    return {
      transform: [{ translateX }],
    };
  });

  // Helper function to set focused field
  const setFocusedFieldWithAnimation = (field: string | null) => {
    setFocusedField(field);
  };

  // Helper function to set focused address field
  const setFocusedAddressFieldWithAnimation = (field: string | null) => {
    setFocusedAddressField(field);
  };

  // Helper function to set focused shopping field (for phone/email)
  const setFocusedShoppingFieldWithAnimation = (field: string | null) => {
    setFocusedShoppingField(field);
  };

  // Debounce timer for username checking
  const usernameTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Notifications state
  const [orderNotifications, setOrderNotifications] = useState(true);
  const [marketingNotifications, setMarketingNotifications] = useState(true);

  // Privacy settings
  type PrivacyOption = "nobody" | "friends" | "everyone";
  const [sizePrivacy, setSizePrivacy] = useState<PrivacyOption>("friends");
  const [recommendationsPrivacy, setRecommendationsPrivacy] =
    useState<PrivacyOption>("friends");
  const [likesPrivacy, setLikesPrivacy] = useState<PrivacyOption>("friends");

  // Cache duration: 5 minutes
  const STATS_CACHE_DURATION = 5 * 60 * 1000;

  // Animation values
  const sizeContainerWidth = useRef(new RNAnimated.Value(height * 0.1)).current;
  const sizeTextOpacity = useRef(new RNAnimated.Value(0)).current;
  const sizeIndicatorOpacity = useRef(new RNAnimated.Value(1)).current;
  const searchResultsTranslateY = useRef(new RNAnimated.Value(0)).current;
  const searchResultsOpacity = useRef(new RNAnimated.Value(0)).current;

  // Generate stats from real data with fallback to mock data
  const getStats = (): StatItem[] => {
    if (userStats) {
      return [
        { label: "куплено", value: userStats.items_purchased.toString() },
        { label: "пролистано", value: swipeCount.toString() }, // Use session storage count for real-time updates
      ];
    }

    // Fallback to mock data while loading or on error
    return [
      { label: "куплено", value: "0" },
      {
        label: "пролистано",
        value: swipeCount > 0 ? swipeCount.toString() : "0",
      },
    ];
  };

  const stats = getStats();

  const sizeOptions = ["XS", "S", "M", "L", "XL"];

  // Load swipe count from session storage
  const loadSwipeCount = async () => {
    try {
      const count = await api.getCurrentSwipeCount();
      setSwipeCount(count);
      console.log("Settings - Loaded swipe count from session storage:", count);
    } catch (error) {
      console.error("Error loading swipe count:", error);
      setSwipeCount(0);
    }
  };

  // Load user profile on component mount
  useEffect(() => {
    loadUserProfile();
    loadBrands();
    loadUserStats();
    loadSwipeCount();
  }, []);

  const getBottomText = useCallback(() => {
    switch (activeSection) {
      case "shopping":
        return "АДРЕС";
      case "payment":
        return "ОПЛАТА";
      case "support":
        return "ПОДДЕРЖКА";
      case "my_info":
        return "МОИ ДАННЫЕ";
      case "notifications":
        return "УВЕДОМЛЕНИЯ";
      case "privacy":
        return "ПРИВАТНОСТЬ";
      case "documents":
        return "ДОКУМЕНТЫ";
      case "delete_account":
        return "УДАЛЕНИЕ АККАУНТА";
      default:
        return "НАСТРОЙКИ";
    }
  }, [activeSection]);

  useEffect(() => {
    if (activeSection === "shopping") {
      setDeliveryScreenView("main");
      loadShoppingInfo();
    }
    if (activeSection === "my_info") {
      loadMyInfo();
    }
    if (activeSection === "privacy" || activeSection === "notifications") {
      loadPreferences();
    }
  }, [activeSection]);

  // Load user preferences
  const loadPreferences = async () => {
    try {
      const profile = await apiWrapper.getCurrentUser("SettingsPage");
      const prefs = profile?.preferences;
      if (prefs) {
        setSizePrivacy(prefs.size_privacy || "friends");
        setRecommendationsPrivacy(prefs.recommendations_privacy || "friends");
        setLikesPrivacy(prefs.likes_privacy || "friends");
        setOrderNotifications(prefs.order_notifications ?? true);
        setMarketingNotifications(prefs.marketing_notifications ?? true);
      }
    } catch (error) {
      console.error("Error loading preferences:", error);
    }
  };

  // Update bottom text in parent when embedded
  useEffect(() => {
    if (embedded && navigation?.setBottomText) {
      try {
        const bottomText = getBottomText();
        navigation.setBottomText(bottomText);
      } catch (error) {
        console.error("Error updating bottom text:", error);
      }
    }
  }, [activeSection, embedded, navigation, getBottomText]);

  const loadUserProfile = async () => {
    try {
      setIsLoadingProfile(true);
      const profile = await apiWrapper.getCurrentUser("SettingsPage");
      if (profile) {
        setUserProfile(profile);
        console.log("Settings - User profile loaded:", profile);
        console.log(
          "Settings - Profile favorite_brands:",
          profile.favorite_brands
        );

        // Set selected size from profile object
        if (profile.profile?.selected_size) {
          setSelectedSize(profile.profile.selected_size);
        }

        // Set selected brands from profile
        if (profile.favorite_brands && profile.favorite_brands.length > 0) {
          const brandNames = profile.favorite_brands.map((brand) => brand.name);
          setSelectedBrands(brandNames);
          console.log(
            "Settings - Loaded favorite brands from profile:",
            brandNames
          );
        }
      } else {
        setSelectedBrands([]);
        console.log("Settings - No favorite brands found in profile");
      }
    } catch (error: any) {
      console.error("Error loading user profile:", error);

      // Show appropriate error message based on error type
      if (error.status === 401) {
        console.log("Authentication error loading user profile");
        // Don't show alert for auth errors
      } else if (error.status >= 500) {
        Alert.alert(
          "ошибка сервера",
          "проблема с сервером. попробуйте позже.",
          [{ text: "OK" }]
        );
      } else {
        Alert.alert(
          "ошибка загрузки",
          "не удалось загрузить профиль пользователя.",
          [{ text: "OK" }]
        );
      }
    } finally {
      setIsLoadingProfile(false);
    }
  };

  // Load brands from API
  const loadBrands = async () => {
    try {
      const brands = await apiWrapper.getBrands("SettingsPage");
      setPopularBrands((brands || []).map((brand) => brand.name));
    } catch (error: any) {
      console.error("Error loading brands:", error);

      // Show appropriate error message based on error type
      if (error.status === 401) {
        console.log("Authentication error loading brands");
        // Don't show alert for auth errors
      } else if (error.status >= 500) {
        Alert.alert(
          "ошибка сервера",
          "проблема с сервером. попробуйте позже.",
          [{ text: "OK" }]
        );
      } else {
        Alert.alert(
          "Ошибка загрузки",
          "не удалось загрузить список брендов. попробуйте позже.",
          [{ text: "OK" }]
        );
      }
    }
  };

  // Load user statistics with caching
  const loadUserStats = async (forceRefresh: boolean = false) => {
    const now = Date.now();

    // Check if we have cached data that's still fresh
    if (
      !forceRefresh &&
      userStats &&
      now - statsLastLoaded < STATS_CACHE_DURATION
    ) {
      console.log("Using cached user stats");
      return;
    }

    try {
      setIsLoadingStats(true);
      const stats = await apiWrapper.getUserStats("SettingsPage");
      if (stats) {
        setUserStats(stats);
      }
      setStatsLastLoaded(now);
      console.log("User stats loaded successfully");
    } catch (error: any) {
      console.error("Error loading user stats:", error);

      // Don't show alerts for stats loading errors to avoid interrupting user experience
      // Just log the error and continue with mock data
      if (error.status === 401) {
        console.log("Authentication error loading user stats");
      } else {
        console.log("Failed to load user stats, using fallback data");
      }
    } finally {
      setIsLoadingStats(false);
    }
  };

  // Update user size preference with optimistic updates
  const updateUserSize = async (size: string) => {
    try {
      // Store original state for rollback
      const originalSelectedSize = selectedSize;
      const originalUserProfile = userProfile;

      // Optimistically update local state immediately
      setSelectedSize(size);

      // Update user profile state optimistically
      if (userProfile) {
        setUserProfile({
          ...userProfile,
          profile: {
            ...userProfile.profile,
            selected_size: size,
          },
        });
      }

      // Perform API call in background
      try {
        await api.updateUserProfileData({ selected_size: size });
        console.log("User size updated successfully");
      } catch (apiError: any) {
        console.error("API error updating user size:", apiError);

        // Rollback local changes
        setSelectedSize(originalSelectedSize);
        setUserProfile(originalUserProfile);

        // Show appropriate error message
        if (apiError.status === 401) {
          console.log("Authentication error updating user size");
        } else if (apiError.status >= 500) {
          Alert.alert("ошибка", "проблема с сервером. попробуйте позже.");
        } else {
          Alert.alert(
            "Ошибка",
            "не удалось обновить размер. попробуйте позже."
          );
        }
      }
    } catch (error: any) {
      console.error("Error updating user size:", error);
      Alert.alert("ошибка", "не удалось обновить размер.");
    }
  };

  // Update user favorite brands
  const updateUserBrands = async (brandIds: number[]) => {
    try {
      await api.updateUserBrands(brandIds);
      // Update local state with brand names
      const allBrands = await apiWrapper.getBrands("SettingsPage");
      const selectedBrandNames = (allBrands || [])
        .filter((brand) => brandIds.includes(brand.id))
        .map((brand) => brand.name);
      setSelectedBrands(selectedBrandNames);
    } catch (error) {
      console.error("Error updating user brands:", error);
      Alert.alert(
        "ошибка обновления",
        "не удалось обновить любимые бренды. попробуйте позже.",
        [{ text: "OK" }]
      );
    }
  };

  // Load shopping information
  const loadShoppingInfo = async () => {
    try {
      setIsLoadingShoppingInfo(true);
      setShoppingInfoError(null);

      const shoppingData = await api.getShoppingInfo();
      // Parse phone number: if it starts with +7, remove it for display
      let phoneNumber = shoppingData.phone || "";
      if (phoneNumber.startsWith("+7")) {
        phoneNumber = phoneNumber.substring(2);
      } else if (phoneNumber.startsWith("7")) {
        phoneNumber = phoneNumber.substring(1);
      } else if (phoneNumber.startsWith("8")) {
        phoneNumber = phoneNumber.substring(1);
      }

      // Load separate address fields from API
      setShoppingInfo({
        address: "", // Removed field, kept empty for state structure compatibility
        phoneNumber: phoneNumber,
        deliveryEmail: shoppingData.delivery_email,
        city: shoppingData.city || "",
        postalCode: shoppingData.postal_code || "",
        index: shoppingData.postal_code || "",
        fullName: shoppingData.full_name || "", // Don't fallback to username
        street: shoppingData.street || "",
        houseNumber: shoppingData.house_number || "",
        apartmentNumber: shoppingData.apartment_number || "",
      });
    } catch (error: any) {
      console.error("Error loading shopping information:", error);
      setShoppingInfoError("не удалось загрузить информацию о доставке.");
    } finally {
      setIsLoadingShoppingInfo(false);
    }
  };

  // Save shopping information
  const loadMyInfo = async () => {
    try {
      setIsLoadingMyInfo(true);
      setMyInfoError(null);
      const profile = await apiWrapper.getCurrentUser("SettingsPage");
      if (profile) {
        // Split full_name into first and last name from profile object
        const profileData = profile.profile || {};
        const nameParts = (profileData.full_name || "").trim().split(" ");
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || "";
        const username = profile.username || "";
        const gender = profileData.gender || "";

        setMyInfo({
          gender: gender as "male" | "female" | "",
          firstName,
          lastName,
          username,
          email: profile.email || "",
        });
        setOriginalUsername(username); // Store original username
        setUsernameAvailable(null); // Reset availability check
        setUsernameError("");
      }
    } catch (error: any) {
      console.error("Error loading my info:", error);
      setMyInfoError("не удалось загрузить данные.");
    } finally {
      setIsLoadingMyInfo(false);
    }
  };

  // Debounced username validation
  const debouncedCheckUsername = (username: string) => {
    if (usernameTimeoutRef.current) {
      clearTimeout(usernameTimeoutRef.current);
    }

    // Immediate validation for illegal characters and spaces (like in signup)
    const illegalCharRegex = /[^a-zA-Z0-9#$-_!]/;
    if (username.includes(" ")) {
      setUsernameError("ник не должен содержать пробелов");
      setUsernameAvailable(null);
      return;
    } else if (username.trim() && illegalCharRegex.test(username)) {
      setUsernameError("ник содержит недопустимые символы");
      setUsernameAvailable(null);
      return;
    }

    usernameTimeoutRef.current = setTimeout(async () => {
      // If username hasn't changed, don't check
      if (username.trim() === originalUsername.trim()) {
        setUsernameAvailable(true);
        setUsernameError("");
        return;
      }

      if (username.trim() && username.trim().length >= 3) {
        setIsCheckingUsername(true);
        setUsernameError("");
        try {
          const available = await api.checkUsernameAvailability(
            username.trim()
          );
          setUsernameAvailable(available);
          if (!available) {
            setUsernameError("этот ник уже занят");
          } else {
            setUsernameError("");
          }
        } catch (error) {
          console.error("Error checking username:", error);
          setUsernameAvailable(null);
        } finally {
          setIsCheckingUsername(false);
        }
      } else {
        setUsernameAvailable(null);
        if (username.trim().length > 0 && username.trim().length < 3) {
          setUsernameError("ник должен быть не менее 3 символов");
        } else {
          setUsernameError("");
        }
      }
    }, 500); // 500ms delay
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (usernameTimeoutRef.current) {
        clearTimeout(usernameTimeoutRef.current);
      }
    };
  }, []);

  // Validate if form is valid (same validation as signup for username)
  const isFormValid = useCallback(() => {
    // Check required fields
    if (!myInfo.firstName.trim()) return false;
    if (!myInfo.lastName.trim()) return false;
    if (!myInfo.gender) return false;

    // Validate username (same rules as signup)
    const illegalCharRegex = /[^a-zA-Z0-9#$-_!]/;
    if (!myInfo.username.trim()) return false;
    if (myInfo.username.trim().length < 3) return false;
    if (myInfo.username.includes(" ")) return false;
    if (illegalCharRegex.test(myInfo.username)) return false;
    if (usernameAvailable === false) return false;
    if (
      usernameAvailable === null &&
      isCheckingUsername &&
      myInfo.username.trim() !== originalUsername.trim()
    ) {
      return false;
    }

    return true;
  }, [
    myInfo.firstName,
    myInfo.lastName,
    myInfo.gender,
    myInfo.username,
    usernameAvailable,
    isCheckingUsername,
    originalUsername,
  ]);

  // Validate address form - all fields required except apartmentNumber
  const isAddressFormValid = useCallback(() => {
    if (!shoppingInfo.street.trim()) return false;
    if (!shoppingInfo.houseNumber.trim()) return false;
    if (!shoppingInfo.city.trim()) return false;
    if (!shoppingInfo.index.trim()) return false;
    // apartmentNumber is optional, so we don't check it
    return true;
  }, [
    shoppingInfo.street,
    shoppingInfo.houseNumber,
    shoppingInfo.city,
    shoppingInfo.index,
  ]);

  const saveMyInfo = async () => {
    // Validate required fields
    if (!myInfo.firstName.trim()) {
      Alert.alert("ошибка", "пожалуйста, введите ваше имя.");
      return;
    }

    if (!myInfo.lastName.trim()) {
      Alert.alert("ошибка", "пожалуйста, введите вашу фамилию.");
      return;
    }

    if (!myInfo.gender) {
      Alert.alert("ошибка", "пожалуйста, выберите пол.");
      return;
    }

    // Validate username (same as signup)
    const illegalCharRegex = /[^a-zA-Z0-9#$-_!]/;
    if (!myInfo.username.trim()) {
      setUsernameError("ник обязателен");
      return;
    } else if (myInfo.username.trim().length < 3) {
      setUsernameError("ник должен быть не менее 3 символов");
      return;
    } else if (myInfo.username.includes(" ")) {
      setUsernameError("ник не должен содержать пробелов");
      return;
    } else if (illegalCharRegex.test(myInfo.username)) {
      setUsernameError("ник содержит недопустимые символы");
      return;
    } else if (usernameAvailable === false) {
      setUsernameError("этот ник уже занят");
      return;
    } else if (
      usernameAvailable === null &&
      isCheckingUsername &&
      myInfo.username.trim() !== originalUsername.trim()
    ) {
      setUsernameError("проверяем доступность ника...");
      return;
    }

    try {
      setIsSavingMyInfo(true);
      setMyInfoError(null);

      // Combine first and last name into full_name
      const fullName =
        `${myInfo.firstName.trim()} ${myInfo.lastName.trim()}`.trim();

      // Update username/email (core user data)
      await api.updateUserProfile({
        username: myInfo.username.trim(),
        email: myInfo.email || undefined,
      });

      // Update profile data (name, gender, size, avatar)
      await api.updateUserProfileData({
        full_name: fullName,
        gender: myInfo.gender || undefined,
      });

      // Reload profile to get updated data
      await loadUserProfile();

      // Go back to main settings
      setActiveSection(null);
    } catch (error: any) {
      console.error("Error saving my info:", error);
      setMyInfoError("не удалось сохранить данные.");
      Alert.alert("ошибка", "не удалось сохранить данные. попробуйте позже.");
    } finally {
      setIsSavingMyInfo(false);
    }
  };

  const saveShoppingInfo = async () => {
    try {
      setIsSavingShoppingInfo(true);
      setShoppingInfoError(null);

      // On the first screen (main), only validate phone and email
      if (deliveryScreenView === "main") {
        if (!shoppingInfo.deliveryEmail.trim()) {
          Alert.alert("ошибка", "пожалуйста, введите email для доставки.");
          return;
        }

        if (!shoppingInfo.phoneNumber.trim()) {
          Alert.alert("Ошибка", "Пожалуйста, введите ваш телефон.");
          return;
        }

        // Validate phone number format (must be exactly 10 digits)
        const phoneDigits = shoppingInfo.phoneNumber.replace(/\D/g, "");
        if (phoneDigits.length !== 10) {
          Alert.alert(
            "Ошибка",
            "номер телефона должен содержать 10 цифр (без кода страны +7)."
          );
          return;
        }

        // Save only phone and email on the first screen
        const fullPhoneNumber = phoneCountryCode + phoneDigits;
        // Use updateShoppingInfo with only phone and email (city is optional)
        await api.updateShoppingInfo({
          delivery_email: shoppingInfo.deliveryEmail,
          phone: fullPhoneNumber,
        });

        Alert.alert("успешно", "контактные данные сохранены.");
        return;
      }

      // On the address screen, validate all fields including address details
      // Validate required fields
      if (!shoppingInfo.fullName.trim()) {
        Alert.alert(
          "Ошибка",
          "Пожалуйста, введите ваше полное имя для доставки."
        );
        return;
      }

      if (!shoppingInfo.deliveryEmail.trim()) {
        Alert.alert("ошибка", "пожалуйста, введите email для доставки.");
        return;
      }

      if (!shoppingInfo.phoneNumber.trim()) {
        Alert.alert("Ошибка", "Пожалуйста, введите ваш телефон.");
        return;
      }

      // Validate phone number format (must be exactly 10 digits)
      const phoneDigits = shoppingInfo.phoneNumber.replace(/\D/g, "");
      if (phoneDigits.length !== 10) {
        Alert.alert(
          "Ошибка",
          "номер телефона должен содержать 10 цифр (без кода страны +7)."
        );
        return;
      }

      // Validate street is provided
      if (!shoppingInfo.street || !shoppingInfo.street.trim()) {
        Alert.alert("ошибка", "пожалуйста, введите улицу.");
        return;
      }

      if (!shoppingInfo.city.trim()) {
        Alert.alert("ошибка", "пожалуйста, введите город.");
        return;
      }

      // Validate postal code/index format if provided (must be exactly 6 digits)
      const postalCodeToUse = shoppingInfo.index || shoppingInfo.postalCode;
      if (postalCodeToUse.trim()) {
        const postalDigits = postalCodeToUse.replace(/\D/g, "");
        if (postalDigits.length !== 6) {
          Alert.alert("Ошибка", "Почтовый индекс должен содержать 6 цифр.");
          return;
        }
      }

      // Save shopping information using the new API
      // Update profile for full_name, and shipping_info for delivery details
      const fullPhoneNumber = phoneCountryCode + phoneDigits;

      // Update profile if full_name changed
      if (shoppingInfo.fullName.trim()) {
        await api.updateUserProfileData({
          full_name: shoppingInfo.fullName.trim(),
        });
      }

      // Update shipping info
      await api.updateShoppingInfo({
        delivery_email: shoppingInfo.deliveryEmail,
        phone: fullPhoneNumber,
        street: shoppingInfo.street.trim(),
        house_number: shoppingInfo.houseNumber?.trim() || undefined,
        apartment_number: shoppingInfo.apartmentNumber?.trim() || undefined,
        city: shoppingInfo.city.trim(),
        postal_code:
          postalCodeToUse?.trim() || shoppingInfo.postalCode || undefined,
      });

      Alert.alert("успешно", "информация о доставке сохранена.");
    } catch (error: any) {
      console.error("Error saving shopping information:", error);
      // Check if it's a validation error from the backend
      const errorMessage =
        error?.response?.data?.detail ||
        error?.message ||
        "Не удалось сохранить информацию о доставке.";
      // If it's an array of validation errors, extract the message
      const validationError =
        Array.isArray(errorMessage) && errorMessage[0]
          ? errorMessage[0].msg || errorMessage[0]
          : errorMessage;
      Alert.alert("ошибка", String(validationError));
    } finally {
      setIsSavingShoppingInfo(false);
    }
  };

  // Handle brand selection in wall section with optimistic updates
  const handleBrandSelect = async (brandName: string) => {
    try {
      // Use already loaded brands instead of fetching again
      const brand = popularBrands.find((b) => b === brandName);
      if (!brand) {
        console.error("Brand not found in loaded brands:", brandName);
        Alert.alert("Ошибка", "Бренд не найден.");
        return;
      }

      // Get brand ID from the API brands list
      const allBrands = await apiWrapper.getBrands("SettingsPage");
      const brandObj = (allBrands || []).find((b) => b.name === brandName);
      if (!brandObj) {
        console.error("Brand object not found:", brandName);
        Alert.alert("Ошибка", "Бренд не найден.");
        return;
      }

      const currentBrandIds =
        userProfile?.favorite_brands?.map((b) => b.id) || [];

      // Determine new brand IDs and operation type
      let newBrandIds: number[];
      let isAdding = false;
      if (currentBrandIds.includes(brandObj.id)) {
        newBrandIds = currentBrandIds.filter((id) => id !== brandObj.id);
        isAdding = false;
      } else {
        newBrandIds = [...currentBrandIds, brandObj.id];
        isAdding = true;
      }

      // Store original state for rollback
      const originalSelectedBrands = [...selectedBrands];
      const originalUserProfile = userProfile;

      // Optimistically update local state immediately
      // Maintain the order of selection - append new brands to the end
      let newSelectedBrands: string[];
      if (isAdding) {
        // Add the new brand to the end of the current list
        newSelectedBrands = [...selectedBrands, brandName];
      } else {
        // Remove the brand from the current list
        newSelectedBrands = selectedBrands.filter((name) => name !== brandName);
      }
      setSelectedBrands(newSelectedBrands);

      // Update user profile state optimistically
      if (userProfile) {
        // Maintain the same order as the selectedBrands array
        const updatedFavoriteBrands = newSelectedBrands
          .map((brandName) => {
            const brand = (allBrands || []).find((b) => b.name === brandName);
            return brand
              ? {
                  id: brand.id,
                  name: brand.name,
                  slug: brand.slug,
                  logo: brand.logo,
                  description: brand.description,
                }
              : null;
          })
          .filter((brand) => brand !== null) as any[];

        setUserProfile({
          ...userProfile,
          favorite_brands: updatedFavoriteBrands,
        });
      }

      // Perform API call in background
      try {
        await api.updateUserBrands(newBrandIds);
        console.log("Brand selection updated successfully");
      } catch (apiError: any) {
        console.error("API error updating brands:", apiError);

        // Rollback local changes
        setSelectedBrands(originalSelectedBrands);
        setUserProfile(originalUserProfile);

        // Show appropriate error message
        if (apiError.status === 401) {
          console.log("Authentication error updating brands");
        } else if (apiError.status >= 500) {
          Alert.alert("ошибка", "проблема с сервером. попробуйте позже.");
        } else {
          Alert.alert(
            "Ошибка",
            "не удалось обновить выбор бренда. попробуйте позже."
          );
        }
      }
    } catch (error: any) {
      console.error("Error selecting brand:", error);
      Alert.alert("ошибка", "не удалось обновить список брендов.");
    }
  };

  // Filtered brands based on search query
  const filteredBrands =
    searchQuery.length > 0
      ? popularBrands.filter((brand) =>
          brand.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : popularBrands;

  // Animated style for search results
  const searchResultsAnimatedStyle = {
    transform: [{ translateY: searchResultsTranslateY }],
    opacity: searchResultsOpacity,
  };

  const handleSizePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    RNAnimated.parallel([
      RNAnimated.timing(sizeContainerWidth, {
        toValue: width * 0.5,
        duration: ANIMATION_DURATIONS.STANDARD,
        easing: ANIMATION_EASING.STANDARD,
        useNativeDriver: false,
      }),
      RNAnimated.timing(sizeTextOpacity, {
        toValue: 1,
        duration: ANIMATION_DURATIONS.SHORT,
        useNativeDriver: true,
      }),
      RNAnimated.timing(sizeIndicatorOpacity, {
        toValue: 0,
        duration: ANIMATION_DURATIONS.FAST,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowSizeSelection(true);
    });
  };

  const handleSizeSelect = (size: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    updateUserSize(size); // Update the user's size preference in the API with optimistic updates

    RNAnimated.parallel([
      RNAnimated.timing(sizeContainerWidth, {
        toValue: 45,
        duration: ANIMATION_DURATIONS.STANDARD,
        easing: ANIMATION_EASING.STANDARD,
        useNativeDriver: false,
      }),
      RNAnimated.timing(sizeTextOpacity, {
        toValue: 0,
        duration: ANIMATION_DURATIONS.FAST,
        useNativeDriver: true,
      }),
      RNAnimated.timing(sizeIndicatorOpacity, {
        toValue: 1,
        duration: ANIMATION_DURATIONS.SHORT,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowSizeSelection(false);
    });
  };

  const handleSearch = (text: string) => {
    setSearchQuery(text);
  };

  const handleSearchFocus = () => {
    setIsSearchActive(true);
    RNAnimated.parallel([
      RNAnimated.timing(searchResultsTranslateY, {
        toValue: -height * 0.2,
        duration: ANIMATION_DURATIONS.STANDARD,
        easing: ANIMATION_EASING.STANDARD,
        useNativeDriver: true,
      }),
      RNAnimated.timing(searchResultsOpacity, {
        toValue: 1,
        duration: ANIMATION_DURATIONS.STANDARD,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleCancelSearch = () => {
    setSearchQuery("");
    Keyboard.dismiss();
    setIsSearchActive(false);
    RNAnimated.parallel([
      RNAnimated.timing(searchResultsTranslateY, {
        toValue: 0,
        duration: ANIMATION_DURATIONS.STANDARD,
        easing: ANIMATION_EASING.STANDARD,
        useNativeDriver: true,
      }),
      RNAnimated.timing(searchResultsOpacity, {
        toValue: 0,
        duration: ANIMATION_DURATIONS.STANDARD,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleSupportSend = async () => {
    if (!supportMessage.trim()) return;

    setIsSending(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));

    setShowThankYou(true);
    setSupportMessage("");
    setIsSending(false);

    // Hide thank you message after 2 seconds
    setTimeout(() => {
      setShowThankYou(false);
    }, 2000);
  };

  const renderSizeSelection = () => (
    <View style={styles.sizeSelectionWrapper}>
      <RNAnimated.View
        style={[styles.sizeSelectionContainer, { width: sizeContainerWidth }]}
      >
        <RNAnimated.View
          style={[styles.sizeTextContainer, { opacity: sizeTextOpacity }]}
        >
          {sizeOptions.map((size) => (
            <Pressable
              key={size}
              style={styles.sizeTextWrapper}
              onPress={() => handleSizeSelect(size)}
            >
              <Text
                style={[
                  styles.sizeText,
                  selectedSize === size && styles.selectedSizeText,
                ]}
              >
                {size}
              </Text>
            </Pressable>
          ))}
        </RNAnimated.View>
        <RNAnimated.View
          style={[styles.sizeIndicator, { opacity: sizeIndicatorOpacity }]}
        >
          <Text style={styles.sizeIndicatorText}>{selectedSize}</Text>
        </RNAnimated.View>
      </RNAnimated.View>
    </View>
  );

  const renderBrandBubble = (brand: string) => (
    <Animated.View
      key={`bubble-${brand}`}
      style={{ alignItems: "center", marginRight: 11 }}
    >
      <Text style={styles.brandBubbleText}>{brand}</Text>
    </Animated.View>
  );

  const renderBrandItem = ({ item }: { item: string }) => {
    const isSelected = selectedBrands.includes(item);

    return (
      <Pressable
        style={({ pressed }) => [
          styles.brandItem,
          pressed && styles.pressedItem,
        ]}
        onPress={() => handleBrandSelect(item)}
        android_ripple={{
          color: "rgba(205, 166, 122, 0.3)",
          borderless: false,
        }}
      >
        <View style={styles.brandItemContent}>
          <Text style={styles.brandText}>{item}</Text>

          {isSelected && (
            <View style={styles.tickContainer}>
              <Tick width={20} height={20} />
            </View>
          )}
        </View>
      </Pressable>
    );
  };

  const renderBrandSearch = () => (
    <View style={styles.searchAndResultsContainer}>
      <Animated.View
        style={styles.backButton}
        entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
          ANIMATION_DELAYS.LARGE
        )}
      >
        <TouchableOpacity onPress={() => setShowBrandSearch(false)}>
          <BackIcon width={22} height={22} />
        </TouchableOpacity>
      </Animated.View>

      {/* Selected brands bubbles */}
      <Animated.View
        entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
          ANIMATION_DELAYS.EXTENDED
        )}
        style={styles.selectedBubblesContainer}
      >
        <ScrollView
          horizontal={true}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.selectedBubblesContent}
        >
          {selectedBrands.length > 0 ? (
            selectedBrands.map(renderBrandBubble)
          ) : (
            <Text style={styles.emptyBrandsText}>Выберите бренды</Text>
          )}
        </ScrollView>
      </Animated.View>

      {/* Search Container */}
      <Animated.View
        entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
          ANIMATION_DELAYS.VERY_LARGE
        )}
        style={styles.searchResultsContainer}
      >
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="поиск"
            placeholderTextColor="rgba(0,0,0,1)"
            value={searchQuery}
            onChangeText={handleSearch}
            onFocus={handleSearchFocus}
          />
        </View>
        <FlatList
          data={filteredBrands}
          renderItem={renderBrandItem}
          keyExtractor={(item) => item}
          numColumns={1}
          contentContainerStyle={styles.brandsList}
          showsVerticalScrollIndicator={false}
        />
      </Animated.View>
    </View>
  );

  const renderMainButton = (
    title: string,
    section:
      | "payment"
      | "support"
      | "shopping"
      | "my_info"
      | "notifications"
      | "privacy"
      | "documents",
    delay: number
  ) => (
    <Animated.View
      entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
        ANIMATION_DELAYS.MEDIUM + delay
      )}
      style={styles.mainButtonContainer}
    >
      <Pressable
        style={styles.mainButton}
        onPress={() => setActiveSection(section)}
      >
        <Text style={styles.mainButtonText}>{title}</Text>
      </Pressable>
    </Animated.View>
  );

  const handleMainScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (event.nativeEvent.contentOffset.y > 5 && showScrollHint) {
      setShowScrollHint(false);
    }
  };

  const renderMainButtons = () => {
    const menuItems = [
      { title: "мои данные", section: "my_info" as const, delay: 50 },
      { title: "адрес доставки", section: "shopping" as const, delay: 100 },
      { title: "поддержка", section: "support" as const, delay: 150 },
      { title: "уведомления", section: "notifications" as const, delay: 200 },
      { title: "приватность", section: "privacy" as const, delay: 250 },
      { title: "документы", section: "documents" as const, delay: 300 },
    ];

    return (
      <Animated.View
        entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM)}
        style={{
          width: "100%",
          alignItems: "center",
          justifyContent: "space-between",
          height: "100%",
        }}
      >
        {/* Back Button */}
        <Animated.View
          style={styles.backButton}
          entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
            ANIMATION_DELAYS.LARGE
          )}
        >
          <TouchableOpacity
            onPress={() => {
              if (embedded) {
                navigation.goBack();
              } else {
                navigation.navigate("Wall");
              }
            }}
          >
            <BackIcon width={22} height={22} />
          </TouchableOpacity>
        </Animated.View>

        {/* Profile Section */}
        {/* <Animated.View
          entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
            ANIMATION_DELAYS.STANDARD
          )}
        >
          <Text style={styles.profileName}>Рейтинг стиля</Text>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
            ANIMATION_DELAYS.MEDIUM
          )}
          style={styles.ratingContainer}
        >
          <AnimatedCircularProgress
            size={height * 0.125}
            width={10}
            fill={67}
            tintColor="#B59679"
            backgroundColor="#32261B"
            rotation={225}
            arcSweepAngle={270}
            lineCap="round"
            padding={10}
            delay={200}
          >
            {() => <Text style={styles.ratingText}>67</Text>}
          </AnimatedCircularProgress>
        </Animated.View>
        <View style={styles.ratingContainer}></View> do not remove this section */}

        {/* Scrollable Menu */}
        <View style={styles.scrollableMenuContainer}>
          {showScrollHint && (
            <Animated.View
              entering={FadeIn.duration(ANIMATION_DURATIONS.MEDIUM)}
              exiting={FadeOut.duration(ANIMATION_DURATIONS.STANDARD)}
              style={styles.scrollHintContainer}
            >
              <Text style={styles.scrollHintText}>листай</Text>
              <Scroll width={26} height={26} />
            </Animated.View>
          )}

          <ScrollView
            style={styles.scrollableMenu}
            showsVerticalScrollIndicator={false}
            onScroll={handleMainScroll}
            scrollEventThrottle={16}
          >
            {menuItems.map((item) => (
              <View key={item.section}>
                {renderMainButton(item.title, item.section, item.delay)}
              </View>
            ))}

            {/* Delete Account Button */}
            <Animated.View
              entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
                ANIMATION_DELAYS.MEDIUM + 300
              )}
              style={styles.mainButtonContainer}
            >
              <Pressable
                style={styles.deleteAccountButton}
                onPress={() => {
                  setActiveSection("delete_account");
                }}
              >
                <Text style={styles.deleteAccountButtonText}>
                  удалить аккаунт
                </Text>
              </Pressable>
            </Animated.View>
          </ScrollView>
        </View>
      </Animated.View>
    );
  };

  const renderShoppingContent = () => {
    // Main screen with three oval buttons
    if (deliveryScreenView === "main") {
      return (
        <View style={styles.contentContainer}>
          <Animated.View
            style={styles.backButton}
            entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
              ANIMATION_DELAYS.LARGE
            )}
          >
            <TouchableOpacity onPress={() => setActiveSection(null)}>
              <BackIcon width={22} height={22} />
            </TouchableOpacity>
          </Animated.View>

          {isLoadingShoppingInfo ? (
            <Animated.View
              entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
                ANIMATION_DELAYS.VERY_LARGE
              )}
              style={styles.shoppingFormContainer}
            >
              <Text style={styles.loadingText}>Загрузка...</Text>
            </Animated.View>
          ) : shoppingInfoError ? (
            <Animated.View
              entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
                ANIMATION_DELAYS.VERY_LARGE
              )}
              style={styles.shoppingFormContainer}
            >
              <Text style={styles.errorText}>{shoppingInfoError}</Text>
            </Animated.View>
          ) : (
            <View style={styles.myInfoScrollContainer}>
              <ScrollView
                style={styles.shoppingForm}
                showsVerticalScrollIndicator={false}
              >
                {/* Address Button */}
                <Animated.View
                  entering={FadeInDown.duration(
                    ANIMATION_DURATIONS.MEDIUM
                  ).delay(ANIMATION_DELAYS.VERY_LARGE)}
                  style={styles.myInfoInputContainer}
                >
                  <TouchableOpacity
                    style={styles.myInfoOvalInput}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setDeliveryScreenView("address");
                    }}
                  >
                    <Text style={styles.myInfoOvalInputText}>адрес</Text>
                  </TouchableOpacity>
                </Animated.View>

                {/* Address Summary - only show if all required fields are filled */}
                {(() => {
                  // Check if all required fields are filled
                  const allRequiredFieldsFilled =
                    shoppingInfo.street.trim() &&
                    shoppingInfo.houseNumber.trim() &&
                    shoppingInfo.city.trim() &&
                    shoppingInfo.index.trim();

                  if (!allRequiredFieldsFilled) {
                    return null;
                  }

                  const addressParts = [];
                  addressParts.push(`ул. ${shoppingInfo.street}`);
                  addressParts.push(`д. ${shoppingInfo.houseNumber}`);
                  if (shoppingInfo.apartmentNumber) {
                    addressParts.push(
                      `кв./офис ${shoppingInfo.apartmentNumber}`
                    );
                  }
                  addressParts.push(shoppingInfo.city);
                  addressParts.push(shoppingInfo.index);
                  const addressSummary = addressParts.join(", ");

                  if (addressSummary) {
                    return (
                      <Animated.View
                        entering={FadeInDown.duration(
                          ANIMATION_DURATIONS.MEDIUM
                        ).delay(
                          ANIMATION_DELAYS.VERY_LARGE + ANIMATION_DELAYS.SMALL
                        )}
                        style={[
                          styles.myInfoInputContainer,
                          { marginTop: -10, marginBottom: 10 },
                        ]}
                      >
                        <Text style={styles.addressSummaryText}>
                          {addressSummary}
                        </Text>
                      </Animated.View>
                    );
                  }
                  return null;
                })()}

                {/* Phone Number */}
                <Animated.View
                  entering={FadeInDown.duration(
                    ANIMATION_DURATIONS.MEDIUM
                  ).delay(ANIMATION_DELAYS.VERY_LARGE + ANIMATION_DELAYS.SMALL)}
                  style={styles.myInfoInputContainer}
                >
                  <View style={styles.myInfoOvalInput}>
                    <Animated.View
                      style={[
                        styles.floatingLabelContainer,
                        phoneAnimatedStyle,
                      ]}
                    >
                      <Text
                        style={styles.floatingLabel}
                        onLayout={(event) => {
                          const { width } = event.nativeEvent.layout;
                          if (width > 0) {
                            phoneLabelWidth.value = width;
                          }
                        }}
                      >
                        телефон
                      </Text>
                    </Animated.View>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                        flex: 1,
                      }}
                    >
                      {shoppingInfo.phoneNumber && (
                        <View
                          style={{
                            backgroundColor: "rgba(0,0,0,0.05)",
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            borderRadius: 8,
                          }}
                        >
                          <Text style={{ fontSize: 14, fontWeight: "500" }}>
                            {phoneCountryCode}
                          </Text>
                        </View>
                      )}
                      <TextInput
                        style={[
                          styles.myInfoOvalTextInput,
                          !shoppingInfo.phoneNumber &&
                          focusedShoppingField !== "phoneNumber"
                            ? styles.myInfoOvalTextInputEmpty
                            : null,
                          (focusedShoppingField === "phoneNumber" ||
                            shoppingInfo.phoneNumber) &&
                            styles.myInfoOvalTextInputWithLabel,
                          { flex: 1 },
                        ]}
                        value={shoppingInfo.phoneNumber}
                        onFocus={() =>
                          setFocusedShoppingFieldWithAnimation("phoneNumber")
                        }
                        onBlur={() =>
                          setFocusedShoppingFieldWithAnimation(null)
                        }
                        onChangeText={(text) => {
                          const digitsOnly = text.replace(/\D/g, "");
                          const limited = digitsOnly.substring(0, 10);
                          setShoppingInfo((prev) => ({
                            ...prev,
                            phoneNumber: limited,
                          }));
                        }}
                        keyboardType="phone-pad"
                        maxLength={10}
                        placeholder="XXX XXX XX XX"
                        placeholderTextColor="transparent"
                        onSubmitEditing={() => Keyboard.dismiss()}
                        blurOnSubmit={true}
                        returnKeyType="done"
                      />
                    </View>
                  </View>
                </Animated.View>

                {/* Email */}
                <Animated.View
                  entering={FadeInDown.duration(
                    ANIMATION_DURATIONS.MEDIUM
                  ).delay(
                    ANIMATION_DELAYS.VERY_LARGE + ANIMATION_DELAYS.STANDARD
                  )}
                  style={styles.myInfoInputContainer}
                >
                  <View style={styles.myInfoOvalInput}>
                    <Animated.View
                      style={[
                        styles.floatingLabelContainer,
                        deliveryEmailAnimatedStyle,
                      ]}
                    >
                      <Text
                        style={styles.floatingLabel}
                        onLayout={(event) => {
                          const { width } = event.nativeEvent.layout;
                          if (width > 0) {
                            deliveryEmailLabelWidth.value = width;
                          }
                        }}
                      >
                        email
                      </Text>
                    </Animated.View>
                    <TextInput
                      style={[
                        styles.myInfoOvalTextInput,
                        !shoppingInfo.deliveryEmail &&
                        focusedShoppingField !== "deliveryEmail"
                          ? styles.myInfoOvalTextInputEmpty
                          : null,
                        (focusedShoppingField === "deliveryEmail" ||
                          shoppingInfo.deliveryEmail) &&
                          styles.myInfoOvalTextInputWithLabel,
                      ]}
                      value={shoppingInfo.deliveryEmail}
                      onFocus={() =>
                        setFocusedShoppingFieldWithAnimation("deliveryEmail")
                      }
                      onBlur={() => setFocusedShoppingFieldWithAnimation(null)}
                      onChangeText={(text) => {
                        const cleanedText = text.replace(/\n/g, "");
                        setShoppingInfo((prev) => ({
                          ...prev,
                          deliveryEmail: cleanedText,
                        }));
                      }}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      onSubmitEditing={() => Keyboard.dismiss()}
                      blurOnSubmit={true}
                      returnKeyType="done"
                      multiline
                      numberOfLines={2}
                    />
                  </View>
                </Animated.View>
              </ScrollView>

              <View style={styles.myInfoConfirmButtonContainer}>
                <TouchableOpacity
                  style={[
                    styles.confirmButton,
                    (isSavingShoppingInfo ||
                      !shoppingInfo.phoneNumber.trim() ||
                      !shoppingInfo.deliveryEmail.trim()) &&
                      styles.confirmButtonDisabled,
                  ]}
                  onPress={saveShoppingInfo}
                  disabled={
                    isSavingShoppingInfo ||
                    !shoppingInfo.phoneNumber.trim() ||
                    !shoppingInfo.deliveryEmail.trim()
                  }
                >
                  <Text
                    style={[
                      styles.confirmButtonText,
                      (isSavingShoppingInfo ||
                        !shoppingInfo.phoneNumber.trim() ||
                        !shoppingInfo.deliveryEmail.trim()) &&
                        styles.confirmButtonDisabledText,
                    ]}
                  >
                    {isSavingShoppingInfo ? "сохранение..." : "подтвердить"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      );
    }

    // Detailed address screen
    return (
      <View style={styles.contentContainer}>
        <Animated.View
          style={styles.backButton}
          entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
            ANIMATION_DELAYS.LARGE
          )}
        >
          <TouchableOpacity
            onPress={() => {
              setDeliveryScreenView("main");
            }}
          >
            <BackIcon width={22} height={22} />
          </TouchableOpacity>
        </Animated.View>

        <View style={styles.myInfoScrollContainer}>
          <FlatList
            data={[
              { type: "street", key: "street" },
              { type: "houseNumber", key: "houseNumber" },
              { type: "city", key: "city" },
              { type: "apartmentNumber", key: "apartmentNumber" },
              { type: "index", key: "index" },
            ]}
            renderItem={({ item }) => {
              switch (item.type) {
                case "street":
                  return (
                    <Animated.View
                      entering={FadeInDown.duration(
                        ANIMATION_DURATIONS.MEDIUM
                      ).delay(ANIMATION_DELAYS.VERY_LARGE)}
                      style={styles.myInfoInputContainer}
                    >
                      <View style={styles.myInfoOvalInput}>
                        <Animated.View
                          style={[
                            styles.floatingLabelContainer,
                            streetAnimatedStyle,
                          ]}
                        >
                          <Text
                            style={styles.floatingLabel}
                            onLayout={(event) => {
                              const { width } = event.nativeEvent.layout;
                              if (width > 0) {
                                streetLabelWidth.value = width;
                              }
                            }}
                          >
                            улица
                          </Text>
                        </Animated.View>
                        <TextInput
                          style={[
                            styles.myInfoOvalTextInput,
                            !shoppingInfo.street &&
                            focusedAddressField !== "street"
                              ? styles.myInfoOvalTextInputEmpty
                              : null,
                            (focusedAddressField === "street" ||
                              shoppingInfo.street) &&
                              styles.myInfoOvalTextInputWithLabel,
                          ]}
                          value={shoppingInfo.street}
                          onFocus={() =>
                            setFocusedAddressFieldWithAnimation("street")
                          }
                          onBlur={() =>
                            setFocusedAddressFieldWithAnimation(null)
                          }
                          onChangeText={(text) => {
                            const cleanedText = text.replace(/\n/g, "");
                            setShoppingInfo((prev) => ({
                              ...prev,
                              street: cleanedText,
                            }));
                          }}
                          onSubmitEditing={() => Keyboard.dismiss()}
                          blurOnSubmit={true}
                          returnKeyType="done"
                          multiline
                          numberOfLines={2}
                        />
                      </View>
                    </Animated.View>
                  );
                case "houseNumber":
                  return (
                    <Animated.View
                      entering={FadeInDown.duration(
                        ANIMATION_DURATIONS.MEDIUM
                      ).delay(
                        ANIMATION_DELAYS.VERY_LARGE + ANIMATION_DELAYS.SMALL
                      )}
                      style={styles.myInfoInputContainer}
                    >
                      <View style={styles.myInfoOvalInput}>
                        <Animated.View
                          style={[
                            styles.floatingLabelContainer,
                            houseNumberAnimatedStyle,
                          ]}
                        >
                          <Text
                            style={styles.floatingLabel}
                            onLayout={(event) => {
                              const { width } = event.nativeEvent.layout;
                              if (width > 0) {
                                houseNumberLabelWidth.value = width;
                              }
                            }}
                          >
                            номер дома
                          </Text>
                        </Animated.View>
                        <TextInput
                          style={[
                            styles.myInfoOvalTextInput,
                            !shoppingInfo.houseNumber &&
                            focusedAddressField !== "houseNumber"
                              ? styles.myInfoOvalTextInputEmpty
                              : null,
                            (focusedAddressField === "houseNumber" ||
                              shoppingInfo.houseNumber) &&
                              styles.myInfoOvalTextInputWithLabel,
                          ]}
                          value={shoppingInfo.houseNumber}
                          onFocus={() =>
                            setFocusedAddressFieldWithAnimation("houseNumber")
                          }
                          onBlur={() =>
                            setFocusedAddressFieldWithAnimation(null)
                          }
                          onChangeText={(text) => {
                            const cleanedText = text.replace(/\n/g, "");
                            setShoppingInfo((prev) => ({
                              ...prev,
                              houseNumber: cleanedText,
                            }));
                          }}
                          onSubmitEditing={() => Keyboard.dismiss()}
                          blurOnSubmit={true}
                          returnKeyType="done"
                          multiline
                          numberOfLines={2}
                        />
                      </View>
                    </Animated.View>
                  );
                case "city":
                  return (
                    <Animated.View
                      entering={FadeInDown.duration(
                        ANIMATION_DURATIONS.MEDIUM
                      ).delay(
                        ANIMATION_DELAYS.VERY_LARGE + ANIMATION_DELAYS.STANDARD
                      )}
                      style={styles.myInfoInputContainer}
                    >
                      <View style={styles.myInfoOvalInput}>
                        <Animated.View
                          style={[
                            styles.floatingLabelContainer,
                            cityAnimatedStyle,
                          ]}
                        >
                          <Text
                            style={styles.floatingLabel}
                            onLayout={(event) => {
                              const { width } = event.nativeEvent.layout;
                              if (width > 0) {
                                cityLabelWidth.value = width;
                              }
                            }}
                          >
                            город
                          </Text>
                        </Animated.View>
                        <TextInput
                          style={[
                            styles.myInfoOvalTextInput,
                            !shoppingInfo.city && focusedAddressField !== "city"
                              ? styles.myInfoOvalTextInputEmpty
                              : null,
                            (focusedAddressField === "city" ||
                              shoppingInfo.city) &&
                              styles.myInfoOvalTextInputWithLabel,
                          ]}
                          value={shoppingInfo.city}
                          onFocus={() =>
                            setFocusedAddressFieldWithAnimation("city")
                          }
                          onBlur={() =>
                            setFocusedAddressFieldWithAnimation(null)
                          }
                          onChangeText={(text) => {
                            const cleanedText = text.replace(/\n/g, "");
                            setShoppingInfo((prev) => ({
                              ...prev,
                              city: cleanedText,
                            }));
                          }}
                          onSubmitEditing={() => Keyboard.dismiss()}
                          blurOnSubmit={true}
                          returnKeyType="done"
                          multiline
                          numberOfLines={2}
                        />
                      </View>
                    </Animated.View>
                  );
                case "apartmentNumber":
                  return (
                    <Animated.View
                      entering={FadeInDown.duration(
                        ANIMATION_DURATIONS.MEDIUM
                      ).delay(
                        ANIMATION_DELAYS.VERY_LARGE + ANIMATION_DELAYS.EXTENDED
                      )}
                      style={styles.myInfoInputContainer}
                    >
                      <View style={styles.myInfoOvalInput}>
                        <Animated.View
                          style={[
                            styles.floatingLabelContainer,
                            apartmentNumberAnimatedStyle,
                          ]}
                        >
                          <Text
                            style={styles.floatingLabel}
                            onLayout={(event) => {
                              const { width } = event.nativeEvent.layout;
                              if (width > 0) {
                                apartmentNumberLabelWidth.value = width;
                              }
                            }}
                          >
                            {focusedAddressField === "apartmentNumber" ||
                            shoppingInfo.apartmentNumber
                              ? "кв./офис"
                              : "квартира/офис"}
                          </Text>
                        </Animated.View>
                        <TextInput
                          style={[
                            styles.myInfoOvalTextInput,
                            !shoppingInfo.apartmentNumber &&
                            focusedAddressField !== "apartmentNumber"
                              ? styles.myInfoOvalTextInputEmpty
                              : null,
                            (focusedAddressField === "apartmentNumber" ||
                              shoppingInfo.apartmentNumber) &&
                              styles.myInfoOvalTextInputWithLabel,
                          ]}
                          value={shoppingInfo.apartmentNumber}
                          onFocus={() =>
                            setFocusedAddressFieldWithAnimation(
                              "apartmentNumber"
                            )
                          }
                          onBlur={() =>
                            setFocusedAddressFieldWithAnimation(null)
                          }
                          onChangeText={(text) => {
                            const cleanedText = text.replace(/\n/g, "");
                            setShoppingInfo((prev) => ({
                              ...prev,
                              apartmentNumber: cleanedText,
                            }));
                          }}
                          onSubmitEditing={() => Keyboard.dismiss()}
                          blurOnSubmit={true}
                          returnKeyType="done"
                          multiline
                          numberOfLines={2}
                        />
                      </View>
                    </Animated.View>
                  );
                case "index":
                  return (
                    <Animated.View
                      entering={FadeInDown.duration(
                        ANIMATION_DURATIONS.MEDIUM
                      ).delay(
                        ANIMATION_DELAYS.VERY_LARGE + ANIMATION_DELAYS.LARGE
                      )}
                      style={styles.myInfoInputContainer}
                    >
                      <View style={styles.myInfoOvalInput}>
                        <Animated.View
                          style={[
                            styles.floatingLabelContainer,
                            indexAnimatedStyle,
                          ]}
                        >
                          <Text
                            style={styles.floatingLabel}
                            onLayout={(event) => {
                              const { width } = event.nativeEvent.layout;
                              if (width > 0) {
                                indexLabelWidth.value = width;
                              }
                            }}
                          >
                            индекс
                          </Text>
                        </Animated.View>
                        <TextInput
                          style={[
                            styles.myInfoOvalTextInput,
                            !shoppingInfo.index &&
                            focusedAddressField !== "index"
                              ? styles.myInfoOvalTextInputEmpty
                              : null,
                            (focusedAddressField === "index" ||
                              shoppingInfo.index) &&
                              styles.myInfoOvalTextInputWithLabel,
                          ]}
                          value={shoppingInfo.index}
                          onFocus={() =>
                            setFocusedAddressFieldWithAnimation("index")
                          }
                          onBlur={() =>
                            setFocusedAddressFieldWithAnimation(null)
                          }
                          onChangeText={(text) => {
                            const cleanedText = text
                              .replace(/\D/g, "")
                              .substring(0, 6);
                            setShoppingInfo((prev) => ({
                              ...prev,
                              index: cleanedText,
                            }));
                          }}
                          keyboardType="numeric"
                          maxLength={6}
                          onSubmitEditing={() => Keyboard.dismiss()}
                          blurOnSubmit={true}
                          returnKeyType="done"
                        />
                      </View>
                    </Animated.View>
                  );
                default:
                  return null;
              }
            }}
            keyExtractor={(item) => item.key}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.myInfoFlatListContent}
            style={styles.myInfoFlatList}
          />
          <View style={styles.myInfoConfirmButtonContainer}>
            <TouchableOpacity
              style={[
                styles.confirmButton,
                (isSavingShoppingInfo || !isAddressFormValid()) &&
                  styles.confirmButtonDisabled,
              ]}
              onPress={saveShoppingInfo}
              disabled={isSavingShoppingInfo || !isAddressFormValid()}
            >
              <Text
                style={[
                  styles.confirmButtonText,
                  (isSavingShoppingInfo || !isAddressFormValid()) &&
                    styles.confirmButtonDisabledText,
                ]}
              >
                {isSavingShoppingInfo ? "сохранение..." : "подтвердить"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const renderSupportContent = () => (
    <View style={[styles.contentContainer, { paddingTop: 0 }]}>
      <View style={styles.topContent}>
        <Animated.View
          style={styles.backButtonAlt}
          entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
            ANIMATION_DELAYS.LARGE
          )}
        >
          <TouchableOpacity onPress={() => setActiveSection(null)}>
            <BackIcon width={22} height={22} />
          </TouchableOpacity>
          <View style={styles.searchContainerAlt}>
            {showThankYou ? (
              <Animated.View
                entering={FadeInDown.duration(ANIMATION_DURATIONS.STANDARD)}
                exiting={FadeOutDown.duration(ANIMATION_DURATIONS.STANDARD)}
                style={styles.thankYouContainer}
              >
                <Text style={styles.thankYouText}>cпасибо!</Text>
              </Animated.View>
            ) : (
              <TextInput
                style={styles.searchInput}
                placeholder="ввести бренд"
                placeholderTextColor="rgba(0,0,0,1)"
                value={supportMessage}
                onChangeText={setSupportMessage}
                onSubmitEditing={handleSupportSend}
                returnKeyType="send"
                editable={!isSending}
              />
            )}
          </View>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
            ANIMATION_DELAYS.EXTENDED
          )}
          style={{ marginTop: 20 }}
        >
          <Text style={styles.sectionTitle}>
            хотите видеть больше брендов на платформе?
          </Text>
          <Text style={styles.sectionTitle}>
            напишите и мы постараемся добавить их в скором времени
          </Text>
        </Animated.View>
      </View>

      <Animated.View
        entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
          ANIMATION_DELAYS.VERY_LARGE
        )}
        style={styles.supportContainer}
      >
        <Text style={styles.supportText}>
          в случае любых вопросов напишите на почту{" "}
        </Text>
        <TouchableOpacity
          onPress={() => Linking.openURL("mailto:support@polkamarket.ru")}
        >
          <Text style={styles.supportEmail}>support@polkamarket.ru</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );

  const renderMyInfoContent = () => {
    // Define form items for FlatList
    const formItems = [
      { type: "gender", key: "gender" },
      { type: "firstName", key: "firstName" },
      { type: "lastName", key: "lastName" },
      { type: "username", key: "username" },
      { type: "email", key: "email" },
    ];

    const renderFormItem = ({
      item,
    }: {
      item: { type: string; key: string };
    }) => {
      switch (item.type) {
        case "gender":
          return (
            <Animated.View
              entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
                ANIMATION_DELAYS.VERY_LARGE
              )}
              style={styles.myInfoInputContainer}
            >
              <View style={styles.myInfoOvalInputGender}>
                <View style={styles.genderTextContainer}>
                  <Text style={styles.myInfoOvalInputText}>пол</Text>
                </View>
                <View style={styles.genderCirclesContainer}>
                  <TouchableOpacity
                    style={[
                      styles.genderCircle,
                      myInfo.gender === "male" && styles.genderCircleSelected,
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setMyInfo((prev) => ({ ...prev, gender: "male" }));
                    }}
                  >
                    <Text style={[styles.genderCircleText]}>М</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.genderCircle,
                      myInfo.gender === "female" && styles.genderCircleSelected,
                      { marginLeft: 5 },
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setMyInfo((prev) => ({ ...prev, gender: "female" }));
                    }}
                  >
                    <Text style={[styles.genderCircleText]}>Ж</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Animated.View>
          );
        case "firstName":
          return (
            <Animated.View
              entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
                ANIMATION_DELAYS.VERY_LARGE + ANIMATION_DELAYS.SMALL
              )}
              style={styles.myInfoInputContainer}
            >
              <View style={styles.myInfoOvalInput}>
                <Animated.View
                  style={[
                    styles.floatingLabelContainer,
                    firstNameAnimatedStyle,
                  ]}
                >
                  <Text
                    style={styles.floatingLabel}
                    onLayout={(event) => {
                      const { width } = event.nativeEvent.layout;
                      if (width > 0) {
                        firstNameLabelWidth.value = width;
                      }
                    }}
                  >
                    имя
                  </Text>
                </Animated.View>
                <TextInput
                  style={[
                    styles.myInfoOvalTextInput,
                    !myInfo.firstName && focusedField !== "firstName"
                      ? styles.myInfoOvalTextInputEmpty
                      : null,
                    (focusedField === "firstName" || myInfo.firstName) &&
                      styles.myInfoOvalTextInputWithLabel,
                  ]}
                  value={myInfo.firstName}
                  onFocus={() => setFocusedFieldWithAnimation("firstName")}
                  onBlur={() => setFocusedFieldWithAnimation(null)}
                  onChangeText={(text) => {
                    // Remove newlines - Enter should dismiss keyboard, not create new line
                    const cleanedText = text.replace(/\n/g, "");
                    setMyInfo((prev) => ({ ...prev, firstName: cleanedText }));
                  }}
                  onSubmitEditing={() => {
                    Keyboard.dismiss();
                  }}
                  blurOnSubmit={true}
                  returnKeyType="done"
                  multiline
                  numberOfLines={2}
                />
              </View>
            </Animated.View>
          );
        case "lastName":
          return (
            <Animated.View
              entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
                ANIMATION_DELAYS.VERY_LARGE + ANIMATION_DELAYS.STANDARD
              )}
              style={styles.myInfoInputContainer}
            >
              <View style={styles.myInfoOvalInput}>
                <Animated.View
                  style={[styles.floatingLabelContainer, lastNameAnimatedStyle]}
                >
                  <Text
                    style={styles.floatingLabel}
                    onLayout={(event) => {
                      const { width } = event.nativeEvent.layout;
                      if (width > 0) {
                        lastNameLabelWidth.value = width;
                      }
                    }}
                  >
                    фамилия
                  </Text>
                </Animated.View>
                <TextInput
                  style={[
                    styles.myInfoOvalTextInput,
                    !myInfo.lastName && focusedField !== "lastName"
                      ? styles.myInfoOvalTextInputEmpty
                      : null,
                    (focusedField === "lastName" || myInfo.lastName) &&
                      styles.myInfoOvalTextInputWithLabel,
                  ]}
                  value={myInfo.lastName}
                  onFocus={() => setFocusedFieldWithAnimation("lastName")}
                  onBlur={() => setFocusedFieldWithAnimation(null)}
                  onChangeText={(text) => {
                    // Remove newlines - Enter should dismiss keyboard, not create new line
                    const cleanedText = text.replace(/\n/g, "");
                    setMyInfo((prev) => ({ ...prev, lastName: cleanedText }));
                  }}
                  onSubmitEditing={() => {
                    Keyboard.dismiss();
                  }}
                  blurOnSubmit={true}
                  returnKeyType="done"
                  multiline
                  numberOfLines={2}
                />
              </View>
            </Animated.View>
          );
        case "username":
          return (
            <Animated.View
              entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
                ANIMATION_DELAYS.VERY_LARGE + ANIMATION_DELAYS.EXTENDED
              )}
              style={styles.myInfoInputContainer}
            >
              <View style={styles.usernameInputWrapper}>
                <View
                  style={[
                    styles.myInfoOvalInput,
                    usernameError ? styles.inputError : null,
                    usernameAvailable === true &&
                    !isCheckingUsername &&
                    myInfo.username.trim() !== originalUsername.trim()
                      ? styles.inputSuccess
                      : null,
                    isCheckingUsername ? styles.inputChecking : null,
                  ]}
                >
                  <Animated.View
                    style={[
                      styles.floatingLabelContainer,
                      usernameAnimatedStyle,
                    ]}
                  >
                    <Text
                      style={styles.floatingLabel}
                      onLayout={(event) => {
                        const { width } = event.nativeEvent.layout;
                        if (width > 0) {
                          usernameLabelWidth.value = width;
                        }
                      }}
                    >
                      никнейм
                    </Text>
                  </Animated.View>
                  <TextInput
                    style={[
                      styles.myInfoOvalTextInput,
                      !myInfo.username && focusedField !== "username"
                        ? styles.myInfoOvalTextInputEmpty
                        : null,
                      (focusedField === "username" || myInfo.username) &&
                        styles.myInfoOvalTextInputWithLabel,
                    ]}
                    autoCapitalize="none"
                    value={myInfo.username}
                    onFocus={() => setFocusedFieldWithAnimation("username")}
                    onBlur={() => setFocusedFieldWithAnimation(null)}
                    onChangeText={(text) => {
                      // Remove newlines - Enter should dismiss keyboard, not create new line
                      const cleanedText = text.replace(/\n/g, "");
                      setMyInfo((prev) => ({ ...prev, username: cleanedText }));
                      debouncedCheckUsername(cleanedText);
                    }}
                    onSubmitEditing={() => {
                      Keyboard.dismiss();
                    }}
                    blurOnSubmit={true}
                    returnKeyType="done"
                    multiline
                    numberOfLines={2}
                  />
                  {usernameAvailable === false && !isCheckingUsername && (
                    <Text
                      style={[styles.myInfoStatusText, styles.statusTextError]}
                    >
                      ✗
                    </Text>
                  )}
                </View>
              </View>
              {usernameError ? (
                <Text style={styles.usernameErrorText}>{usernameError}</Text>
              ) : null}
            </Animated.View>
          );
        case "email":
          return (
            <Animated.View
              entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
                ANIMATION_DELAYS.VERY_LARGE + ANIMATION_DELAYS.VERY_LARGE
              )}
              style={styles.myInfoInputContainer}
            >
              <View style={[styles.myInfoOvalInput, styles.disabledOvalInput]}>
                <Animated.View
                  style={[styles.floatingLabelContainer, emailAnimatedStyle]}
                >
                  <Text
                    style={styles.floatingLabel}
                    onLayout={(event) => {
                      const { width } = event.nativeEvent.layout;
                      if (width > 0) {
                        emailLabelWidth.value = width;
                      }
                    }}
                  >
                    email
                  </Text>
                </Animated.View>
                <TextInput
                  style={[
                    styles.myInfoOvalTextInput,
                    (focusedField === "email" || myInfo.email) &&
                      styles.myInfoOvalTextInputWithLabel,
                  ]}
                  value={myInfo.email}
                  editable={false}
                  onSubmitEditing={() => {
                    Keyboard.dismiss();
                  }}
                  blurOnSubmit={true}
                  returnKeyType="done"
                  multiline
                  numberOfLines={2}
                />
              </View>
            </Animated.View>
          );
        default:
          return null;
      }
    };

    return (
      <View style={styles.contentContainer}>
        <Animated.View
          style={styles.backButton}
          entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
            ANIMATION_DELAYS.LARGE
          )}
        >
          <TouchableOpacity onPress={() => setActiveSection(null)}>
            <BackIcon width={22} height={22} />
          </TouchableOpacity>
        </Animated.View>

        {isLoadingMyInfo ? (
          <Animated.View
            entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
              ANIMATION_DELAYS.VERY_LARGE
            )}
            style={styles.shoppingFormContainer}
          >
            <Text style={styles.loadingText}>Загрузка...</Text>
          </Animated.View>
        ) : myInfoError ? (
          <Animated.View
            entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
              ANIMATION_DELAYS.VERY_LARGE
            )}
            style={styles.shoppingFormContainer}
          >
            <Text style={styles.errorText}>{myInfoError}</Text>
          </Animated.View>
        ) : (
          <View style={styles.myInfoScrollContainer}>
            <FlatList
              data={formItems}
              renderItem={renderFormItem}
              keyExtractor={(item) => item.key}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.myInfoFlatListContent}
              style={styles.myInfoFlatList}
            />
            <View style={styles.myInfoConfirmButtonContainer}>
              <TouchableOpacity
                style={[
                  styles.confirmButton,
                  (isSavingMyInfo || !isFormValid()) &&
                    styles.confirmButtonDisabled,
                ]}
                onPress={saveMyInfo}
                disabled={isSavingMyInfo || !isFormValid()}
              >
                <Text
                  style={[
                    styles.confirmButtonText,
                    (isSavingMyInfo || !isFormValid()) &&
                      styles.confirmButtonDisabledText,
                  ]}
                >
                  {isSavingMyInfo ? "сохранение..." : "подтвердить"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  };

  // Handle switch toggle with haptic feedback
  const handleOrderNotificationsChange = async (value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setOrderNotifications(value);
    // Save to API
    try {
      await api.updateUserPreferences({ order_notifications: value });
    } catch (error) {
      console.error("Error saving notification preference:", error);
      // Rollback on error
      setOrderNotifications(!value);
    }
  };

  const handleMarketingNotificationsChange = async (value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMarketingNotifications(value);
    // Save to API
    try {
      await api.updateUserPreferences({ marketing_notifications: value });
    } catch (error) {
      console.error("Error saving notification preference:", error);
      // Rollback on error
      setMarketingNotifications(!value);
    }
  };

  const renderPrivacyContent = () => {
    const privacyOptions: PrivacyOption[] = ["nobody", "friends", "everyone"];

    const privacyItems = [
      {
        id: "size",
        label: "мой размер",
        value: sizePrivacy,
        onChange: setSizePrivacy,
        delay: ANIMATION_DELAYS.VERY_LARGE + ANIMATION_DELAYS.SMALL,
      },
      {
        id: "recommendations",
        label: "мои рекомендации",
        value: recommendationsPrivacy,
        onChange: setRecommendationsPrivacy,
        delay: ANIMATION_DELAYS.VERY_LARGE + ANIMATION_DELAYS.STANDARD,
      },
      {
        id: "likes",
        label: "мои лайки",
        value: likesPrivacy,
        onChange: setLikesPrivacy,
        delay: ANIMATION_DELAYS.VERY_LARGE + ANIMATION_DELAYS.MEDIUM,
      },
    ];

    const renderPrivacyOval = ({
      item,
    }: {
      item: {
        id: string;
        label: string;
        value: PrivacyOption;
        onChange: (value: PrivacyOption) => void;
        delay: number;
      };
    }) => (
      <Animated.View
        entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
          item.delay
        )}
        style={styles.myInfoInputContainer}
      >
        <View style={styles.myInfoOvalInputGender}>
          <View style={styles.privacyRowContainer}>
            <View style={styles.genderTextContainer}>
              <Text style={styles.myInfoOvalInputText}>{item.label}</Text>
            </View>
            <TouchableOpacity
              style={styles.privacyOptionOval}
              onPress={async () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                const currentIndex = privacyOptions.indexOf(item.value);
                const nextIndex = (currentIndex + 1) % privacyOptions.length;
                const newValue = privacyOptions[nextIndex];
                item.onChange(newValue);
                // Save to API
                try {
                  const updateData: any = {};
                  if (item.id === "size") {
                    updateData.size_privacy = newValue;
                  } else if (item.id === "recommendations") {
                    updateData.recommendations_privacy = newValue;
                  } else if (item.id === "likes") {
                    updateData.likes_privacy = newValue;
                  }
                  await api.updateUserPreferences(updateData);
                } catch (error) {
                  console.error("Error saving privacy preference:", error);
                  // Rollback on error
                  item.onChange(item.value);
                }
              }}
            >
              <AnimatedPrivacyText
                key={item.id}
                value={item.value}
                itemId={item.id}
                textStyle={styles.privacyOptionText}
              />
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    );

    return (
      <View style={styles.contentContainer}>
        <Animated.View
          style={styles.backButton}
          entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
            ANIMATION_DELAYS.LARGE
          )}
        >
          <TouchableOpacity onPress={() => setActiveSection(null)}>
            <BackIcon width={22} height={22} />
          </TouchableOpacity>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
            ANIMATION_DELAYS.VERY_LARGE
          )}
          style={styles.privacySectionTitle}
        >
          <Text style={styles.privacySectionTitleText}>кто видит:</Text>
        </Animated.View>

        <FlatList
          data={privacyItems}
          renderItem={renderPrivacyOval}
          keyExtractor={(item) => item.id}
          style={[styles.myInfoFlatList, { left: 0 }]}
          contentContainerStyle={styles.myInfoFlatListContent}
          showsVerticalScrollIndicator={false}
        />
      </View>
    );
  };

  const renderNotificationsContent = () => (
    <View style={styles.contentContainer}>
      <Animated.View
        style={styles.backButton}
        entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
          ANIMATION_DELAYS.LARGE
        )}
      >
        <TouchableOpacity onPress={() => setActiveSection(null)}>
          <BackIcon width={22} height={22} />
        </TouchableOpacity>
      </Animated.View>

      <View style={styles.notificationsContainer}>
        <Animated.View
          entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
            ANIMATION_DELAYS.VERY_LARGE
          )}
          style={styles.notificationItemContainer}
        >
          <View style={styles.notificationItem}>
            <Text style={styles.notificationItemText}>
              уведомления о заказах
            </Text>
            <View style={styles.switchContainer}>
              <Switch
                value={orderNotifications}
                onValueChange={handleOrderNotificationsChange}
                trackColor={{ false: "#D0C0B0", true: "#CDA67A" }}
                thumbColor="#FFF"
                ios_backgroundColor="#D0C0B0"
              />
            </View>
          </View>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
            ANIMATION_DELAYS.VERY_LARGE + ANIMATION_DELAYS.SMALL
          )}
          style={styles.notificationItemContainer}
        >
          <View style={styles.notificationItem}>
            <Text style={styles.notificationItemText}>
              маркетинговые уведомления
            </Text>
            <View style={styles.switchContainer}>
              <Switch
                value={marketingNotifications}
                onValueChange={handleMarketingNotificationsChange}
                trackColor={{ false: "#D0C0B0", true: "#CDA67A" }}
                thumbColor="#FFF"
                ios_backgroundColor="#D0C0B0"
              />
            </View>
          </View>
        </Animated.View>
      </View>
    </View>
  );

  const renderDeleteAccountContent = () => (
    <View style={styles.contentContainer}>
      <Animated.View
        style={styles.backButton}
        entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
          ANIMATION_DELAYS.LARGE
        )}
      >
        <TouchableOpacity onPress={() => setActiveSection(null)}>
          <BackIcon width={22} height={22} />
        </TouchableOpacity>
      </Animated.View>

      <View style={styles.deleteAccountScreenContainer}>
        <Animated.View
          entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
            ANIMATION_DELAYS.EXTENDED
          )}
          style={styles.deleteAccountQuestionContainer}
        >
          <View style={styles.deleteAccountQuestion}>
            <Text style={styles.deleteAccountQuestionText}>
              уверены, что хотите удалить аккаунт?
            </Text>
          </View>
        </Animated.View>

        <View style={styles.deleteAccountButtonsContainer}>
          <Animated.View
            entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
              ANIMATION_DELAYS.VERY_LARGE
            )}
            style={styles.deleteAccountYesButtonContainer}
          >
            <Pressable
              style={styles.deleteAccountYesButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                // TODO: Implement account deletion
                Alert.alert(
                  "уведомление",
                  "функция удаления аккаунта будет доступна в ближайшее время."
                );
              }}
            >
              <Text style={styles.deleteAccountYesButtonText}>да</Text>
            </Pressable>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
              ANIMATION_DELAYS.VERY_LARGE + ANIMATION_DELAYS.SMALL
            )}
            style={styles.deleteAccountNoButtonContainer}
          >
            <Pressable
              style={styles.deleteAccountNoButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setActiveSection(null);
              }}
            >
              <Text style={styles.deleteAccountNoButtonText}>нет</Text>
            </Pressable>
          </Animated.View>
        </View>

        <Animated.View
          entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
            ANIMATION_DELAYS.VERY_LARGE + ANIMATION_DELAYS.MEDIUM
          )}
          style={styles.deleteAccountWarningContainer}
        >
          <Text style={styles.deleteAccountWarningText}>
            это действия нельзя обратить. персональные данные удалятся
          </Text>
        </Animated.View>
      </View>
    </View>
  );

  const renderContent = () => {
    switch (activeSection) {
      case "shopping":
        return renderShoppingContent();
      case "support":
        return renderSupportContent();
      case "my_info":
        return renderMyInfoContent();
      case "notifications":
        return renderNotificationsContent();
      case "privacy":
        return renderPrivacyContent();
      case "delete_account":
        return renderDeleteAccountContent();
      case "payment":
      case "documents":
        // TODO: Implement these sections
        return (
          <View style={styles.contentContainer}>
            <Animated.View
              style={styles.backButton}
              entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
                ANIMATION_DELAYS.LARGE
              )}
            >
              <TouchableOpacity onPress={() => setActiveSection(null)}>
                <BackIcon width={22} height={22} />
              </TouchableOpacity>
            </Animated.View>
            <View style={styles.placeholderContainer}>
              <Text style={styles.placeholderText}>
                {activeSection === "payment" && "оплата"}
                {activeSection === "documents" && "документы"}
              </Text>
              <Text style={styles.placeholderSubtext}>Раздел в разработке</Text>
            </View>
          </View>
        );
      default:
        return renderMainButtons();
    }
  };

  // If embedded, render only content without outer container
  if (embedded) {
    return <View style={styles.embeddedContainer}>{renderContent()}</View>;
  }

  return (
    <View style={styles.container}>
      <Animated.View
        entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM)}
        style={styles.roundedBox}
      >
        <LinearGradient
          colors={["rgba(205, 166, 122, 0.4)", "rgba(205, 166, 122, 0)"]}
          start={{ x: 0, y: 1 }}
          end={{ x: 1, y: 0.3 }}
          style={styles.gradientBackground}
        />

        {/* Content Box */}
        <View style={styles.whiteBox}>{renderContent()}</View>

        {/* Bottom Text */}
        <View style={styles.textContainer}>
          <Text style={styles.text} numberOfLines={1} ellipsizeMode="tail">
            {getBottomText()}
          </Text>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  embeddedContainer: {
    width: "100%",
    height: "100%",
  },
  roundedBox: {
    width: "88%",
    height: "95%",
    borderRadius: 41,
    backgroundColor: "rgba(205, 166, 122, 0)",
    position: "relative",
    borderWidth: 3,
    borderColor: "rgba(205, 166, 122, 0.4)",
  },
  gradientBackground: {
    borderRadius: 37,
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  whiteBox: {
    backgroundColor: "#F2ECE7",
    borderRadius: 41,
    width: width * 0.88,
    top: -3,
    left: -3,
    height: "90%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
    padding: height * 0.025,
    justifyContent: "space-between",
    alignItems: "center",
  },
  textContainer: {
    position: "absolute",
    bottom: 0,
    marginBottom: 12,
    marginLeft: 22,
  },
  text: {
    fontFamily: "Igra Sans",
    fontSize: 34,
    color: "#000",
    textAlign: "left",
  },
  profileSection: {
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "column",
    gap: 10,
    marginTop: 5,
  },
  profileImageWrapper: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  profileImageContainer: {
    width: width * 0.25,
    height: width * 0.25,
    borderRadius: width * 0.125,
    overflow: "hidden",
    //backgroundColor: '#F2ECE7',
    //marginBottom: 15,
  },
  profileImage: {
    width: "100%",
    height: "100%",
    resizeMode: "contain",
  },
  penIconButton: {
    position: "absolute",
    bottom: -20,
    right: -15,
    zIndex: 10,
  },
  penIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "transparent",
    borderWidth: 2,
    borderColor: "rgba(205, 166, 122, 0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  profileName: {
    fontFamily: "IgraSans",
    fontSize: 20,
    color: "#000",
  },
  mainButtonsOverlay: {
    width: "100%",
    justifyContent: "center",
    marginBottom: -15,
    //paddingVertical: 20,
  },
  scrollableMenuContainer: {
    flex: 1,
    position: "relative",
    width: "100%",
    marginTop: 33 + 15,
  },
  scrollHintContainer: {
    position: "absolute",
    bottom: -height * 0.025 - 14 + 5,
    right: 0,
    alignItems: "flex-end",
    zIndex: 10,
    paddingVertical: 8,
    flexDirection: "row",
  },
  scrollHintText: {
    fontFamily: "IgraSans",
    fontSize: 14,
    lineHeight: 26,
    color: "#000",
    flexDirection: "row",
    alignItems: "center",
    marginRight: 8,
  },
  scrollableMenu: {
    width: width * 0.88,
    left: -height * 0.025,
    paddingHorizontal: height * 0.025,
    marginBottom: -height * 0.025,
    borderRadius: 41,
  },
  mainButtonContainer: {
    marginBottom: 15,
  },
  mainButton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#E2CCB2",
    borderRadius: 41,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
    height: height * 0.1,
  },
  notificationsContainer: {
    width: "100%",
    alignContent: "flex-start",
    flex: 1,
  },
  notificationItemContainer: {
    marginBottom: 15,
  },
  notificationItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#E2CCB2",
    borderRadius: 41,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
    height: height * 0.1,
  },
  notificationItemText: {
    fontFamily: "IgraSans",
    fontSize: 20,
    color: "#000",
    flex: 1,
  },
  switchContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  mainButtonText: {
    fontFamily: "IgraSans",
    fontSize: 20,
    color: "#000",
  },
  deleteAccountButton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#E2B4B3",
    borderRadius: 41,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
    height: height * 0.1,
  },
  deleteAccountButtonText: {
    fontFamily: "IgraSans",
    fontSize: 20,
    color: "#000",
  },
  deleteAccountScreenContainer: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  deleteAccountQuestionContainer: {
    width: "100%",
    marginBottom: 40,
  },
  deleteAccountQuestion: {
    width: "100%",
    backgroundColor: "#E2CCB2",
    borderRadius: 41,
    paddingHorizontal: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
    height: height * 0.1,
    justifyContent: "center",
    alignItems: "center",
  },
  deleteAccountQuestionText: {
    textAlign: "center",
    fontFamily: "IgraSans",
    fontSize: 20,
    color: "#000",
    lineHeight: 39,
  },
  deleteAccountButtonsContainer: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 15,
    marginBottom: 40,
  },
  deleteAccountYesButtonContainer: {
    flex: 1,
    marginRight: 7.5,
  },
  deleteAccountNoButtonContainer: {
    flex: 1,
    marginLeft: 7.5,
  },
  deleteAccountYesButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#E2B4B3",
    borderRadius: 41,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
    height: height * 0.1,
  },
  deleteAccountYesButtonText: {
    fontFamily: "IgraSans",
    fontSize: 20,
    color: "#000",
  },
  deleteAccountNoButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#E2CCB2",
    borderRadius: 41,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
    height: height * 0.1,
  },
  deleteAccountNoButtonText: {
    fontFamily: "IgraSans",
    fontSize: 20,
    color: "#000",
  },
  deleteAccountWarningContainer: {
    position: "absolute",
    bottom: 0,
    width: "75%",
    alignItems: "center",
  },
  deleteAccountWarningText: {
    fontFamily: "IgraSans",
    fontSize: 10,
    color: "#000",
    textAlign: "center",
    lineHeight: 17,
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  placeholderText: {
    fontFamily: "IgraSans",
    fontSize: 24,
    color: "#000",
    textAlign: "center",
    marginBottom: 10,
  },
  placeholderSubtext: {
    fontFamily: "IgraSans",
    fontSize: 18,
    color: "#666",
    textAlign: "center",
  },
  contentContainer: {
    width: "100%",
    height: "100%",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 40,
  },
  backButton: {
    position: "absolute",
    top: 0,
    left: 0,
    zIndex: 11,
  },
  backButtonAlt: {
    width: "100%",
    height: height * 0.1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    fontFamily: "IgraSans",
    fontSize: 20,
    color: "#000",
    lineHeight: 39,
  },
  favoriteBrandsSection: {
    width: "100%",
    height: height * 0.1,
    borderRadius: 41,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F2ECE7",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  favoriteBrandsButton: {
    flexDirection: "row",
    width: "100%",
    backgroundColor: "#E2CCB2",
    height: height * 0.1,
    borderRadius: 41,
    justifyContent: "flex-start",
    alignItems: "center",
    padding: 20,
  },
  favoriteBrandsText: {
    fontFamily: "IgraSans",
    fontSize: 20,
    color: "#000",
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    height: 0.175 * height,
    alignItems: "flex-end",
    width: "100%",
    backgroundColor: "#E2CCB2",
    borderRadius: 41,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  statItem: {
    alignItems: "center",
  },
  valueWrapper: {
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#DCBF9D",
    height: height * 0.1,
    borderRadius: 41,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  statValue: {
    fontFamily: "IgraSans",
    fontSize: 20,
    color: "#000",
  },
  statLabel: {
    fontFamily: "IgraSans",
    fontSize: 20,
    color: "#000",
    marginBottom: 5,
    paddingHorizontal: 18,
  },
  sizeSection: {
    width: "100%",
    flexDirection: "row",
    backgroundColor: "#E2CCB2",
    height: height * 0.1,
    borderRadius: 41,
    justifyContent: "flex-start",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  sizeSectionTitle: {
    fontFamily: "IgraSans",
    fontSize: 20,
    color: "#000",
    marginLeft: 20,
    textAlign: "left",
  },
  sizeSelectionWrapper: {
    height: "100%",
    position: "absolute",
    right: 0,
    justifyContent: "center",
  },
  sizeSelectionContainer: {
    height: "100%",
    minWidth: height * 0.1,
    borderRadius: 41,
    backgroundColor: "#DCBF9D",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    position: "absolute",
    right: 0,
  },
  sizeTextContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flex: 1,
  },
  sizeTextWrapper: {
    paddingVertical: 5,
    paddingHorizontal: 0,
    flex: 1,
    alignItems: "center",
  },
  sizeText: {
    color: "black",
    fontFamily: "IgraSans",
    fontSize: 20,
    textAlign: "center",
  },
  selectedSizeText: {
    textDecorationLine: "underline",
    textDecorationColor: "black",
    textDecorationStyle: "solid",
  },
  sizeIndicator: {
    width: height * 0.1,
    height: height * 0.1,
    borderRadius: 41,
    justifyContent: "center",
    alignItems: "center",
    position: "absolute",
    right: 0,
  },
  sizeIndicatorText: {
    color: "black",
    fontFamily: "IgraSans",
    fontSize: 20,
    textAlign: "center",
  },
  bottomText: {
    fontFamily: "IgraSans",
    fontSize: 38,
    color: "white",
    textAlign: "center",
    marginTop: 20,
  },
  // Orders styles
  ordersContainer: {
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    width: "100%",
  },
  ordersList: {
    marginTop: height * 0.05,
    paddingHorizontal: 20,
    borderRadius: 41,
    width: 0.88 * width,
    marginBottom: -20,
  },
  orderItem: {
    marginBottom: 25,
  },
  orderBubble: {
    backgroundColor: "#E2CCB2",
    borderRadius: 41,
    padding: 20,
    justifyContent: "center",
    marginBottom: 20,
    height: 0.1 * height,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  orderNumber: {
    fontFamily: "IgraSans",
    fontSize: 20,
    color: "#000",
  },
  orderSummary: {
    fontFamily: "IgraSans",
    fontSize: 20,
    color: "#000",
    marginLeft: 20,
  },
  // Payment styles
  paymentContainer: {
    padding: 20,
  },
  paymentMethodButton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
  },
  paymentMethodText: {
    fontFamily: "REM",
    fontSize: 16,
    color: "#6A462F",
  },
  paymentInfoText: {
    fontFamily: "REM",
    fontSize: 14,
    color: "#CDA67A",
    textAlign: "center",
  },
  // Support styles
  supportContainer: {
    width: "100%",
    height: height * 0.2,
    justifyContent: "center",
    padding: 10,
    backgroundColor: "#E2CCB2",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    borderRadius: 41,
  },
  supportButton: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
  },
  supportButtonText: {
    fontFamily: "REM",
    fontSize: 16,
    color: "#6A462F",
    textAlign: "center",
  },
  brandSearchContainer: {
    width: "100%",
    height: "100%",
    justifyContent: "flex-start",
    alignItems: "center",
  },
  selectedBubblesContainer: {
    width: "100%",
    height: height * 0.1,
    backgroundColor: "#E2CCB2",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    borderRadius: 41,
    position: "relative",
    overflow: "hidden",
    zIndex: 2,
    marginTop: height * 0.05,
    justifyContent: "center",
  },
  selectedBubblesContent: {
    marginLeft: 20,
    flexDirection: "row",
    alignItems: "center",
  },
  selectedBrandItem: {
    backgroundColor: "#DCC1A5",
    borderRadius: 41,
    paddingHorizontal: 18,
    paddingVertical: 12,
    marginHorizontal: 4,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  selectedBrandText: {
    fontFamily: "IgraSans",
    fontSize: 22,
    color: "#000",
  },
  searchAndResultsContainer: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "space-between",
    position: "relative",
  },
  searchContainer: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#DCBF9D",
    borderRadius: 41,
    paddingHorizontal: 20,
    height: 0.1 * height,
    zIndex: 2,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  topContent: {
    flex: 1,
  },
  searchContainerAlt: {
    width: "100%",
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E2CCB2",
    borderRadius: 41,
    paddingHorizontal: 20,
    height: 0.1 * height,
    marginLeft: 20,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  searchInput: {
    fontFamily: "IgraSans",
    fontSize: 20,
    color: "#000",
  },
  cancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 41,
    backgroundColor: "#CDA67A",
  },
  cancelButtonText: {
    fontFamily: "IgraSans",
    fontSize: 20,
    color: "#000",
  },
  searchResultsContainer: {
    width: "100%",
    height: height * 0.47,
    backgroundColor: "#E2CCB2",
    borderRadius: 41,
    position: "relative",
    zIndex: 1,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  brandsList: {
    marginTop: 5,
  },
  brandItem: {
    padding: 20,
  },
  brandItemContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  brandText: {
    fontFamily: "IgraSans",
    fontSize: 20,
    color: "#000",
  },
  tickContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  pressedItem: {
    opacity: 0.8,
  },
  brandBubbleText: {
    fontFamily: "IgraSans",
    fontSize: 20,
    color: "#000",
  },
  emptyBrandsText: {
    fontFamily: "IgraSans",
    fontSize: 18,
    color: "rgba(0,0,0,0.6)",
    fontStyle: "italic",
    textAlign: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  ratingContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  ratingText: {
    fontFamily: "IgraSans",
    fontSize: 20,
    color: "#000",
  },
  supportText: {
    fontFamily: "IgraSans",
    fontSize: 20,
    color: "#000",
    lineHeight: 39,
  },
  supportEmail: {
    fontFamily: "IgraSans",
    fontSize: 20,
    color: "#000",
    textDecorationLine: "underline",
    lineHeight: 39,
  },
  thankYouContainer: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "flex-start",
  },
  thankYouText: {
    fontFamily: "IgraSans",
    fontSize: 20,
    color: "#000",
  },
  logoutButton: {
    position: "absolute",
    top: 0,
    right: 0,
    zIndex: 11,
  },
  logoutButtonText: {
    fontFamily: "IgraSans",
    fontSize: 20,
    color: "#000",
  },
  // Shopping information styles
  shoppingTitleSection: {
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 30,
  },
  shoppingTitle: {
    fontFamily: "IgraSans",
    fontSize: 24,
    color: "#000",
    textAlign: "center",
  },
  shoppingFormContainer: {
    width: "100%",
    paddingHorizontal: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  shoppingForm: {
    width: 0.88 * width,
    paddingHorizontal: 20,
    borderRadius: 41,
    left: -height * 0.025,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontFamily: "IgraSans",
    fontSize: 18,
    color: "#000",
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: "#E2CCB2",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingRight: 40, // Make room for status indicator
    fontFamily: "IgraSans",
    fontSize: 16,
    color: "#000",
    borderWidth: 1,
    borderColor: "transparent",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  usernameInputWrapper: {
    position: "relative",
  },
  inputError: {
    borderWidth: 2,
    borderColor: "rgba(255, 100, 100, 0.7)",
  },
  inputSuccess: {
    borderWidth: 2,
    borderColor: "rgba(0, 170, 0, 0.4)",
  },
  inputChecking: {
    borderWidth: 2,
    borderColor: "rgba(255, 165, 0, 0.7)",
  },
  statusIndicator: {
    position: "absolute",
    right: 15,
    top: "50%",
    transform: [{ translateY: -10 }],
  },
  statusText: {
    fontFamily: "IgraSans",
    fontSize: 16,
    position: "absolute",
    right: 15,
    top: "50%",
    transform: [{ translateY: -8 }],
  },
  statusTextSuccess: {
    color: "#00AA00",
  },
  statusTextError: {
    color: "#FF0000",
  },
  usernameErrorText: {
    fontFamily: "REM",
    fontSize: 12,
    color: "#FF6464",
    marginTop: 4,
    marginLeft: 4,
  },
  textArea: {
    height: 80,
    textAlignVertical: "top",
  },
  disabledInput: {
    backgroundColor: "#D0C0B0",
    opacity: 0.6,
  },
  saveButtonContainer: {
    marginTop: 20,
    marginBottom: 30,
    alignItems: "flex-end",
  },
  confirmButton: {
    backgroundColor: "#E0D6CC",
    borderRadius: 41,
    paddingVertical: 12.5,
    paddingHorizontal: 25,
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: {
        elevation: 6,
        overflow: "hidden",
      },
    }),
  },
  confirmButtonText: {
    fontFamily: "IgraSans",
    fontSize: 20,
    color: "#000",
  },
  confirmButtonDisabled: {
    opacity: 0.6,
  },
  confirmButtonDisabledText: {
    opacity: 0.37,
  },
  saveButton: {
    backgroundColor: "#CDA67A",
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  saveButtonDisabled: {
    backgroundColor: "#A0A0A0",
    opacity: 0.6,
  },
  saveButtonText: {
    fontFamily: "IgraSans",
    fontSize: 18,
    color: "#FFF",
    fontWeight: "bold",
  },
  loadingText: {
    fontFamily: "IgraSans",
    fontSize: 16,
    color: "#6A462F",
    textAlign: "center",
    marginTop: 20,
  },
  errorText: {
    fontFamily: "IgraSans",
    fontSize: 16,
    color: "#FF6B6B",
    textAlign: "center",
    marginTop: 20,
  },
  // Shopping information display in orders
  shoppingInfoDisplay: {
    backgroundColor: "#E2CCB2",
    borderRadius: 12,
    padding: 16,
    marginVertical: 10,
    marginHorizontal: 20,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  shoppingInfoTitle: {
    fontFamily: "IgraSans",
    fontSize: 18,
    color: "#000",
    marginBottom: 12,
    fontWeight: "bold",
  },
  shoppingInfoContent: {
    gap: 8,
  },
  shoppingInfoText: {
    fontFamily: "IgraSans",
    fontSize: 14,
    color: "#000",
    lineHeight: 20,
  },
  shoppingInfoLabel: {
    fontWeight: "bold",
  },
  // My Info section styles with oval inputs
  myInfoScrollContainer: {
    flex: 1,
    width: "100%",
    position: "relative",
    paddingBottom: 80, // Space for the confirmation button at the bottom
  },
  myInfoFlatList: {
    width: width * 0.88,
    left: -height * 0.025,
    paddingHorizontal: height * 0.025,
    marginBottom: -height * 0.025,
    borderRadius: 41,
  },
  myInfoFlatListContent: {
    paddingBottom: 20,
  },
  myInfoInputContainer: {
    marginBottom: 20,
  },
  myInfoInputLabel: {
    fontFamily: "IgraSans",
    fontSize: 18,
    color: "#000",
    marginBottom: 8,
    textAlign: "center",
  },
  addressSummaryText: {
    fontFamily: "IgraSans",
    fontSize: 14,
    color: "rgba(0,0,0,0.6)",
    textAlign: "left",
    paddingHorizontal: 20,
    lineHeight: 20,
  },
  myInfoOvalInput: {
    backgroundColor: "#E2CCB2",
    borderRadius: 41,
    paddingHorizontal: 20,
    paddingVertical: 12,
    minHeight: height * 0.1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
    position: "relative",
  },
  myInfoOvalInputGender: {
    backgroundColor: "#E2CCB2",
    borderRadius: 41,
    paddingLeft: 20,
    paddingRight: 0,
    paddingVertical: 0,
    height: height * 0.1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
  },
  genderTextContainer: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "center",
    gap: 8,
  },
  myInfoOvalInputText: {
    fontFamily: "IgraSans",
    fontSize: 16,
    color: "#000",
    flex: 1,
  },
  genderValueText: {
    fontFamily: "IgraSans",
    fontSize: 16,
    color: "#000",
  },
  myInfoOvalTextInput: {
    flex: 1,
    fontFamily: "IgraSans",
    fontSize: 16,
    color: "#000",
    padding: 0,
    margin: 0,
    zIndex: 1,
    minWidth: 0,
    textAlignVertical: "center",
  },
  myInfoOvalTextInputEmpty: {
    color: "transparent",
  },
  myInfoOvalTextInputWithLabel: {
    paddingRight: 100, // Space for label on the right
    marginRight: 0,
    textAlignVertical: "top",
    maxHeight: height * 0.1 - 24, // Allow for two lines within the oval
  },
  floatingLabelContainer: {
    position: "absolute",
    left: 20,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    zIndex: 0,
    pointerEvents: "none",
  },
  floatingLabelContainerRight: {
    left: "auto",
    right: 20,
  },
  floatingLabel: {
    fontFamily: "IgraSans",
    fontSize: 16,
    color: "rgba(0,0,0,0.5)",
  },
  floatingLabelRight: {
    color: "rgba(0,0,0,0.5)",
  },
  disabledOvalInput: {
    backgroundColor: "#D0C0B0",
    opacity: 0.6,
  },
  genderCirclesContainer: {
    flexDirection: "row",
    alignItems: "center",
    height: "100%",
  },
  genderCircle: {
    width: height * 0.1, // Account for 2px border on each side
    height: height * 0.1,
    borderRadius: (height * 0.1) / 2,
    backgroundColor: "#DEC2A1",
    justifyContent: "center",
    alignItems: "center",
    opacity: 0.6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
  },
  genderCircleSelected: {
    backgroundColor: "#C5A077",
  },
  genderCircleText: {
    fontFamily: "IgraSans",
    fontSize: 17,
    color: "#000",
    fontWeight: "bold",
  },
  privacySectionTitle: {
    marginBottom: 20,
    textAlign: "left",
    width: "100%",
    paddingHorizontal: height * 0.025,
  },
  privacySectionTitleText: {
    fontFamily: "IgraSans",
    fontSize: 20,
    color: "#000",
  },
  privacyOptionText: {
    fontFamily: "IgraSans",
    fontSize: 16,
    color: "#000",
  },
  privacyRowContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flex: 1,
  },
  privacyOptionOval: {
    backgroundColor: "#DEC2A1",
    borderRadius: 41,
    paddingHorizontal: 20,
    paddingVertical: 0,
    height: height * 0.1,
    width: width * 0.275,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
  },
  myInfoStatusIndicator: {
    position: "absolute",
    right: 20,
    top: "50%",
    transform: [{ translateY: -10 }],
  },
  myInfoStatusText: {
    fontFamily: "IgraSans",
    fontSize: 16,
    position: "absolute",
    right: 20,
    top: "50%",
    transform: [{ translateY: -8 }],
  },
  myInfoConfirmButtonContainer: {
    position: "absolute",
    bottom: 0,
    right: 0,
    zIndex: 10,
  },
});

export default Settings;
