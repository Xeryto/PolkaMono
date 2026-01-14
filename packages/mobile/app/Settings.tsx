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
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOutDown,
  withSequence,
  FadeOut,
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
    | "documents"
    | null; // Initial section to show when embedded
}

// Using unified CardItem from types/product.d.ts

interface StatItem {
  label: string;
  value: string;
}

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
  });
  const phoneCountryCode = "+7"; // Fixed to Russian country code
  const [isLoadingShoppingInfo, setIsLoadingShoppingInfo] = useState(false);
  const [shoppingInfoError, setShoppingInfoError] = useState<string | null>(
    null
  );
  const [isSavingShoppingInfo, setIsSavingShoppingInfo] = useState(false);

  // My Info state
  const [myInfo, setMyInfo] = useState({
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

  // Debounce timer for username checking
  const usernameTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Notifications state
  const [orderNotifications, setOrderNotifications] = useState(true);
  const [marketingNotifications, setMarketingNotifications] = useState(true);

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
        { label: "Куплено", value: userStats.items_purchased.toString() },
        { label: "Пролистано", value: swipeCount.toString() }, // Use session storage count for real-time updates
      ];
    }

    // Fallback to mock data while loading or on error
    return [
      { label: "Куплено", value: "0" },
      {
        label: "Пролистано",
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
        return "ДОСТАВКА";
      case "payment":
        return "ОПЛАТА";
      case "support":
        return "ПОДДЕРЖКА";
      case "my_info":
        return "МОИ ДАННЫЕ";
      case "notifications":
        return "УВЕДОМЛЕНИЯ";
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
      loadShoppingInfo();
    }
    if (activeSection === "my_info") {
      loadMyInfo();
    }
  }, [activeSection]);

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

        // Set selected size from profile
        if (profile.selected_size) {
          setSelectedSize(profile.selected_size);
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
          "Ошибка сервера",
          "Проблема с сервером. Попробуйте позже.",
          [{ text: "OK" }]
        );
      } else {
        Alert.alert(
          "Ошибка загрузки",
          "Не удалось загрузить профиль пользователя.",
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
          "Ошибка сервера",
          "Проблема с сервером. Попробуйте позже.",
          [{ text: "OK" }]
        );
      } else {
        Alert.alert(
          "Ошибка загрузки",
          "Не удалось загрузить список брендов. Попробуйте позже.",
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
          selected_size: size,
        });
      }

      // Perform API call in background
      try {
        await api.updateUserProfile({ selected_size: size });
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
          Alert.alert("Ошибка", "Проблема с сервером. Попробуйте позже.");
        } else {
          Alert.alert(
            "Ошибка",
            "Не удалось обновить размер. Попробуйте позже."
          );
        }
      }
    } catch (error: any) {
      console.error("Error updating user size:", error);
      Alert.alert("Ошибка", "Не удалось обновить размер.");
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
        "Ошибка обновления",
        "Не удалось обновить любимые бренды. Попробуйте позже.",
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
      setShoppingInfo({
        address: shoppingData.address,
        phoneNumber: phoneNumber,
        deliveryEmail: shoppingData.delivery_email,
        city: shoppingData.city,
        postalCode: shoppingData.postal_code || "",
        fullName: shoppingData.full_name || "", // Don't fallback to username
      });
    } catch (error: any) {
      console.error("Error loading shopping information:", error);
      setShoppingInfoError("Не удалось загрузить информацию о доставке.");
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
        // Split full_name into first and last name
        const nameParts = (profile.full_name || "").trim().split(" ");
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || "";
        const username = profile.username || "";

        setMyInfo({
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
      setMyInfoError("Не удалось загрузить данные.");
    } finally {
      setIsLoadingMyInfo(false);
    }
  };

  // Debounced username validation
  const debouncedCheckUsername = (username: string) => {
    if (usernameTimeoutRef.current) {
      clearTimeout(usernameTimeoutRef.current);
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
            setUsernameError("Этот ник уже занят");
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
          setUsernameError("Ник должен быть не менее 3 символов");
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

  const saveMyInfo = async () => {
    // Validate username
    const illegalCharRegex = /[^a-zA-Z0-9#$-_!]/;
    if (!myInfo.username.trim()) {
      setUsernameError("Ник обязателен");
      return;
    } else if (myInfo.username.trim().length < 3) {
      setUsernameError("Ник должен быть не менее 3 символов");
      return;
    } else if (myInfo.username.includes(" ")) {
      setUsernameError("Ник не должен содержать пробелов");
      return;
    } else if (illegalCharRegex.test(myInfo.username)) {
      setUsernameError("Ник содержит недопустимые символы");
      return;
    } else if (usernameAvailable === false) {
      setUsernameError("Этот ник уже занят");
      return;
    } else if (
      usernameAvailable === null &&
      isCheckingUsername &&
      myInfo.username.trim() !== originalUsername.trim()
    ) {
      setUsernameError("Проверяем доступность ника...");
      return;
    }

    try {
      setIsSavingMyInfo(true);
      setMyInfoError(null);

      // Combine first and last name into full_name
      const fullName =
        `${myInfo.firstName.trim()} ${myInfo.lastName.trim()}`.trim();

      await api.updateUserProfile({
        full_name: fullName,
        username: myInfo.username.trim(),
      });

      // Reload profile to get updated data
      await loadUserProfile();

      // Go back to main settings
      setActiveSection(null);
    } catch (error: any) {
      console.error("Error saving my info:", error);
      setMyInfoError("Не удалось сохранить данные.");
      Alert.alert("Ошибка", "Не удалось сохранить данные. Попробуйте позже.");
    } finally {
      setIsSavingMyInfo(false);
    }
  };

  const saveShoppingInfo = async () => {
    try {
      setIsSavingShoppingInfo(true);
      setShoppingInfoError(null);

      // Validate required fields
      if (!shoppingInfo.fullName.trim()) {
        Alert.alert(
          "Ошибка",
          "Пожалуйста, введите ваше полное имя для доставки."
        );
        return;
      }

      if (!shoppingInfo.deliveryEmail.trim()) {
        Alert.alert("Ошибка", "Пожалуйста, введите email для доставки.");
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
          "Номер телефона должен содержать 10 цифр (без кода страны +7)."
        );
        return;
      }

      if (!shoppingInfo.address.trim()) {
        Alert.alert("Ошибка", "Пожалуйста, введите адрес доставки.");
        return;
      }

      if (!shoppingInfo.city.trim()) {
        Alert.alert("Ошибка", "Пожалуйста, введите город.");
        return;
      }

      // Validate postal code format if provided (must be exactly 6 digits)
      if (shoppingInfo.postalCode.trim()) {
        const postalDigits = shoppingInfo.postalCode.replace(/\D/g, "");
        if (postalDigits.length !== 6) {
          Alert.alert("Ошибка", "Почтовый индекс должен содержать 6 цифр.");
          return;
        }
      }

      // Save shopping information using the new API
      // Combine country code and phone number
      const fullPhoneNumber = phoneCountryCode + phoneDigits;
      await api.updateShoppingInfo({
        full_name: shoppingInfo.fullName,
        delivery_email: shoppingInfo.deliveryEmail,
        phone: fullPhoneNumber,
        address: shoppingInfo.address,
        city: shoppingInfo.city,
        postal_code: shoppingInfo.postalCode,
      });

      Alert.alert("Успешно", "Информация о доставке сохранена.");
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
      Alert.alert("Ошибка", String(validationError));
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
          Alert.alert("Ошибка", "Проблема с сервером. Попробуйте позже.");
        } else {
          Alert.alert(
            "Ошибка",
            "Не удалось обновить выбор бренда. Попробуйте позже."
          );
        }
      }
    } catch (error: any) {
      console.error("Error selecting brand:", error);
      Alert.alert("Ошибка", "Не удалось обновить список брендов.");
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
            placeholder="Поиск"
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
      { title: "Мои данные", section: "my_info" as const, delay: 50 },
      { title: "Адрес доставки", section: "shopping" as const, delay: 100 },
      { title: "Поддержка", section: "support" as const, delay: 150 },
      { title: "Уведомления", section: "notifications" as const, delay: 200 },
      { title: "Документы", section: "documents" as const, delay: 250 },
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
              <Text style={styles.scrollHintText}>Листай</Text>
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
                  Удалить аккаунт
                </Text>
              </Pressable>
            </Animated.View>
          </ScrollView>
        </View>
      </Animated.View>
    );
  };

  const renderShoppingContent = () => (
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
          ANIMATION_DELAYS.EXTENDED
        )}
        style={styles.shoppingTitleSection}
      >
        <Text style={styles.shoppingTitle}>Информация о доставке</Text>
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
        <ScrollView
          style={styles.shoppingForm}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
              ANIMATION_DELAYS.VERY_LARGE
            )}
            style={styles.inputContainer}
          >
            <Text style={styles.inputLabel}>Полное имя для доставки *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Введите ваше полное имя для доставки"
              placeholderTextColor="rgba(0,0,0,0.5)"
              value={shoppingInfo.fullName}
              onChangeText={(text) =>
                setShoppingInfo((prev) => ({ ...prev, fullName: text }))
              }
            />
          </Animated.View>

          <Animated.View
            entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
              ANIMATION_DELAYS.VERY_LARGE + ANIMATION_DELAYS.SMALL
            )}
            style={styles.inputContainer}
          >
            <Text style={styles.inputLabel}>Email для доставки *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Введите email для доставки"
              placeholderTextColor="rgba(0,0,0,0.5)"
              value={shoppingInfo.deliveryEmail}
              onChangeText={(text) =>
                setShoppingInfo((prev) => ({ ...prev, deliveryEmail: text }))
              }
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </Animated.View>

          <Animated.View
            entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
              ANIMATION_DELAYS.VERY_LARGE + ANIMATION_DELAYS.STANDARD
            )}
            style={styles.inputContainer}
          >
            <Text style={styles.inputLabel}>Телефон *</Text>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <View
                style={{
                  backgroundColor: "rgba(0,0,0,0.05)",
                  paddingHorizontal: 12,
                  paddingVertical: 12,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: "rgba(0,0,0,0.1)",
                }}
              >
                <Text style={{ fontSize: 16, fontWeight: "500" }}>
                  {phoneCountryCode}
                </Text>
              </View>
              <TextInput
                style={[styles.textInput, { flex: 1 }]}
                placeholder="XXX XXX XX XX"
                placeholderTextColor="rgba(0,0,0,0.5)"
                value={shoppingInfo.phoneNumber}
                onChangeText={(text) => {
                  // Only allow digits
                  const digitsOnly = text.replace(/\D/g, "");
                  // Limit to 10 digits for Russian phone numbers
                  const limited = digitsOnly.substring(0, 10);
                  setShoppingInfo((prev) => ({
                    ...prev,
                    phoneNumber: limited,
                  }));
                }}
                keyboardType="phone-pad"
                maxLength={10}
              />
            </View>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
              ANIMATION_DELAYS.VERY_LARGE + ANIMATION_DELAYS.EXTENDED
            )}
            style={styles.inputContainer}
          >
            <Text style={styles.inputLabel}>Город *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Введите город"
              placeholderTextColor="rgba(0,0,0,0.5)"
              value={shoppingInfo.city}
              onChangeText={(text) =>
                setShoppingInfo((prev) => ({ ...prev, city: text }))
              }
            />
          </Animated.View>

          <Animated.View
            entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
              ANIMATION_DELAYS.VERY_LARGE + ANIMATION_DELAYS.LARGE
            )}
            style={styles.inputContainer}
          >
            <Text style={styles.inputLabel}>Почтовый индекс</Text>
            <TextInput
              style={styles.textInput}
              placeholder="XXXXXX (6 цифр)"
              placeholderTextColor="rgba(0,0,0,0.5)"
              value={shoppingInfo.postalCode}
              onChangeText={(text) => {
                // Only allow digits
                const digitsOnly = text.replace(/\D/g, "");
                // Limit to 6 digits for Russian postal codes
                const limited = digitsOnly.substring(0, 6);
                setShoppingInfo((prev) => ({ ...prev, postalCode: limited }));
              }}
              keyboardType="numeric"
              maxLength={6}
            />
          </Animated.View>

          <Animated.View
            entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
              ANIMATION_DELAYS.VERY_LARGE + ANIMATION_DELAYS.EXTENDED
            )}
            style={styles.inputContainer}
          >
            <Text style={styles.inputLabel}>Адрес доставки *</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              placeholder="Введите полный адрес доставки"
              placeholderTextColor="rgba(0,0,0,0.5)"
              value={shoppingInfo.address}
              onChangeText={(text) =>
                setShoppingInfo((prev) => ({ ...prev, address: text }))
              }
              multiline
              numberOfLines={3}
            />
          </Animated.View>

          <Animated.View
            entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
              ANIMATION_DELAYS.VERY_LARGE + ANIMATION_DELAYS.VERY_LARGE
            )}
            style={styles.saveButtonContainer}
          >
            <Pressable
              style={[
                styles.saveButton,
                isSavingShoppingInfo && styles.saveButtonDisabled,
              ]}
              onPress={saveShoppingInfo}
              disabled={isSavingShoppingInfo}
            >
              <Text style={styles.saveButtonText}>
                {isSavingShoppingInfo ? "Сохранение..." : "Сохранить"}
              </Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      )}
    </View>
  );

  const renderSupportContent = () => (
    <View style={styles.contentContainer}>
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
                placeholder="Ввести бренд"
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
            Хотите видеть больше брендов на платформе?
          </Text>
          <Text style={styles.sectionTitle}>
            Напишите и мы постараемся добавить их в скором времени
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
          В случае любых вопросов напишите на почту{" "}
        </Text>
        <TouchableOpacity
          onPress={() => Linking.openURL("mailto:support@polkamarket.ru")}
        >
          <Text style={styles.supportEmail}>support@polkamarket.ru</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );

  const renderMyInfoContent = () => (
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
          ANIMATION_DELAYS.EXTENDED
        )}
        style={styles.shoppingTitleSection}
      >
        <Text style={styles.shoppingTitle}>Мои данные</Text>
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
        <ScrollView
          style={styles.shoppingForm}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
              ANIMATION_DELAYS.VERY_LARGE
            )}
            style={styles.inputContainer}
          >
            <Text style={styles.inputLabel}>Имя *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Введите ваше имя"
              placeholderTextColor="rgba(0,0,0,0.5)"
              value={myInfo.firstName}
              onChangeText={(text) =>
                setMyInfo((prev) => ({ ...prev, firstName: text }))
              }
            />
          </Animated.View>

          <Animated.View
            entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
              ANIMATION_DELAYS.VERY_LARGE + ANIMATION_DELAYS.SMALL
            )}
            style={styles.inputContainer}
          >
            <Text style={styles.inputLabel}>Фамилия</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Введите вашу фамилию"
              placeholderTextColor="rgba(0,0,0,0.5)"
              value={myInfo.lastName}
              onChangeText={(text) =>
                setMyInfo((prev) => ({ ...prev, lastName: text }))
              }
            />
          </Animated.View>

          <Animated.View
            entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
              ANIMATION_DELAYS.VERY_LARGE + ANIMATION_DELAYS.STANDARD
            )}
            style={styles.inputContainer}
          >
            <Text style={styles.inputLabel}>Никнейм *</Text>
            <View style={styles.usernameInputWrapper}>
              <TextInput
                style={[
                  styles.textInput,
                  usernameError ? styles.inputError : null,
                  usernameAvailable === true &&
                  !isCheckingUsername &&
                  myInfo.username.trim() !== originalUsername.trim()
                    ? styles.inputSuccess
                    : null,
                  isCheckingUsername ? styles.inputChecking : null,
                ]}
                placeholder="Введите никнейм"
                placeholderTextColor="rgba(0,0,0,0.5)"
                autoCapitalize="none"
                value={myInfo.username}
                onChangeText={(text) => {
                  setMyInfo((prev) => ({ ...prev, username: text }));
                  debouncedCheckUsername(text);
                }}
              />
              {isCheckingUsername && (
                <ActivityIndicator
                  size="small"
                  color="#FFA500"
                  style={styles.statusIndicator}
                />
              )}
              {usernameAvailable === true &&
                !isCheckingUsername &&
                myInfo.username.trim() !== originalUsername.trim() && (
                  <Text style={[styles.statusText, styles.statusTextSuccess]}>
                    ✓
                  </Text>
                )}
              {usernameAvailable === false && !isCheckingUsername && (
                <Text style={[styles.statusText, styles.statusTextError]}>
                  ✗
                </Text>
              )}
            </View>
            {usernameError ? (
              <Text style={styles.usernameErrorText}>{usernameError}</Text>
            ) : null}
          </Animated.View>

          <Animated.View
            entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
              ANIMATION_DELAYS.VERY_LARGE + ANIMATION_DELAYS.EXTENDED
            )}
            style={styles.inputContainer}
          >
            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              style={[styles.textInput, styles.disabledInput]}
              placeholder="Email"
              placeholderTextColor="rgba(0,0,0,0.5)"
              value={myInfo.email}
              editable={false}
            />
          </Animated.View>

          <Animated.View
            entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
              ANIMATION_DELAYS.VERY_LARGE + ANIMATION_DELAYS.VERY_LARGE
            )}
            style={styles.saveButtonContainer}
          >
            <TouchableOpacity
              style={[
                styles.confirmButton,
                isSavingMyInfo && styles.confirmButtonDisabled,
              ]}
              onPress={saveMyInfo}
              disabled={isSavingMyInfo}
            >
              <Text
                style={[
                  styles.confirmButtonText,
                  isSavingMyInfo && styles.confirmButtonDisabledText,
                ]}
              >
                {isSavingMyInfo ? "Сохранение..." : "Подтвердить"}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      )}
    </View>
  );

  // Handle switch toggle with haptic feedback
  const handleOrderNotificationsChange = (value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setOrderNotifications(value);
  };

  const handleMarketingNotificationsChange = (value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMarketingNotifications(value);
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

      <Animated.View
        entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
          ANIMATION_DELAYS.EXTENDED
        )}
        style={styles.shoppingTitleSection}
      >
        <Text style={styles.shoppingTitle}>Уведомления</Text>
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
              Уведомления о заказах
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
              Маркетинговые уведомления
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
              Уверены, что хотите удалить аккаунт?
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
                  "Уведомление",
                  "Функция удаления аккаунта будет доступна в ближайшее время."
                );
              }}
            >
              <Text style={styles.deleteAccountYesButtonText}>Да</Text>
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
              <Text style={styles.deleteAccountNoButtonText}>Нет</Text>
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
            Это действия нельзя обратить. Персональные данные удалятся
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
                {activeSection === "payment" && "Оплата"}
                {activeSection === "documents" && "Документы"}
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
    bottom: -5,
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
    bottom: 20,
    width: "75%",
    alignItems: "center",
  },
  deleteAccountWarningText: {
    fontFamily: "IgraSans",
    fontSize: 10,
    color: "#000",
    textAlign: "center",
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
    width: "100%",
    paddingHorizontal: 20,
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
    borderColor: "rgba(255, 100, 100, 0.7)",
  },
  inputSuccess: {
    borderColor: "rgba(0, 170, 0, 0.7)",
  },
  inputChecking: {
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
});

export default Settings;
