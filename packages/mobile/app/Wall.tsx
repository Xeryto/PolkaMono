import React, { useState, useEffect, useRef } from "react";
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
  Easing,
  TextInput,
  FlatList,
  Keyboard,
  Platform,
  Alert,
  Linking,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOutDown,
  useAnimatedStyle,
  withTiming,
  useSharedValue,
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
import MeAlt from "./components/svg/MeAlt";
import SettingsPage from "./Settings";
import { Canvas, RoundedRect, Shadow } from "@shopify/react-native-skia";
import { CardItem } from "./types/product";
import { mapProductToCardItem } from "./lib/productMapper";

const { width, height } = Dimensions.get("window");

// Define a simpler navigation type that our custom navigation can satisfy
interface SimpleNavigation {
  navigate: (screen: string, params?: any) => void;
  goBack: () => void;
}

interface WallProps {
  navigation: SimpleNavigation;
  onLogout?: () => void;
}

const CartItemImage = ({ item }: { item: api.OrderItem }) => {
  const [imageDimensions, setImageDimensions] = useState({
    width: 0,
    height: 0,
  });
  const [imageError, setImageError] = useState(false);

  const onImageLoad = (event: any) => {
    const { width, height } = event.nativeEvent.source;
    setImageDimensions({ width, height });
  };

  const onImageError = () => {
    setImageError(true);
  };

  const aspectRatio =
    imageDimensions.width && imageDimensions.height
      ? imageDimensions.width / imageDimensions.height
      : 1;

  const imageSource =
    !item.image || imageError
      ? require("./assets/Vision.png")
      : { uri: item.image };

  return (
    <View style={{ flex: 1 }}>
      <Image
        source={imageSource}
        style={[styles.itemImage, { aspectRatio }]}
        resizeMode="contain"
        onLoad={onImageLoad}
        onError={onImageError}
      />
    </View>
  );
};

const Wall = ({ navigation, onLogout }: WallProps) => {
  const [currentView, setCurrentView] = useState<
    "wall" | "settings" | "orders"
  >("wall");
  const [settingsInitialSection, setSettingsInitialSection] = useState<
    "payment" | "support" | "shopping" | null
  >(null);
  const [settingsBottomText, setSettingsBottomText] = useState("НАСТРОЙКИ");

  // Orders state: list is summaries only; full order loaded when user taps one
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [orderDetail, setOrderDetail] = useState<api.Order | null>(null);
  const [isLoadingOrderDetail, setIsLoadingOrderDetail] = useState(false);
  const [orders, setOrders] = useState<api.OrderSummary[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState("M");
  const [showSizeSelection, setShowSizeSelection] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [popularBrands, setPopularBrands] = useState<string[]>([]);
  const [showBrandSearch, setShowBrandSearch] = useState(false);
  const [showAvatarEdit, setShowAvatarEdit] = useState(false);
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

  // Cache duration: 5 minutes
  const STATS_CACHE_DURATION = 5 * 60 * 1000;

  // Animation values
  const sizeContainerWidth = useRef(new RNAnimated.Value(height * 0.1)).current;
  const sizeTextOpacity = useRef(new RNAnimated.Value(0)).current;
  const sizeIndicatorOpacity = useRef(new RNAnimated.Value(1)).current;
  const searchResultsTranslateY = useRef(new RNAnimated.Value(0)).current;
  const searchResultsOpacity = useRef(new RNAnimated.Value(0)).current;

  // Generate stats from real data with fallback to mock data
  const getStats = (): Array<{ label: string; value: string }> => {
    if (userStats) {
      return [
        { label: "куплено", value: userStats.items_purchased.toString() },
        { label: "пролистано", value: swipeCount.toString() },
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
      console.log("Wall - Loaded swipe count from session storage:", count);
    } catch (error) {
      console.error("Error loading swipe count:", error);
      setSwipeCount(0);
    }
  };

  // Load orders
  const loadOrders = async () => {
    try {
      setIsLoadingOrders(true);
      setOrderError(null);
      const fetchedOrders = await api.getOrders();
      setOrders(fetchedOrders);
    } catch (error) {
      console.error("Error loading orders:", error);
      setOrderError("не удалось загрузить заказы.");
    } finally {
      setIsLoadingOrders(false);
    }
  };

  // Load user profile on component mount
  useEffect(() => {
    loadUserProfile();
    loadBrands();
    loadUserStats();
    loadSwipeCount();
  }, []);

  // Refresh stats when component mounts or becomes visible
  useEffect(() => {
    if (userStats) {
      const now = Date.now();
      if (now - statsLastLoaded > 60 * 1000) {
        loadUserStats(true);
      }
    }
    loadSwipeCount();
  }, []);

  // Load orders when orders view is shown
  useEffect(() => {
    if (currentView === "orders") {
      setSelectedOrderId(null);
      setOrderDetail(null);
      loadOrders();
    }
  }, [currentView]);

  // Load full order when user taps an order in the list
  useEffect(() => {
    if (!selectedOrderId) {
      setOrderDetail(null);
      return;
    }
    let cancelled = false;
    setIsLoadingOrderDetail(true);
    api
      .getOrderById(selectedOrderId)
      .then((data) => {
        if (!cancelled) setOrderDetail(data);
      })
      .catch(() => {
        if (!cancelled) setOrderError("не удалось загрузить заказ.");
      })
      .finally(() => {
        if (!cancelled) setIsLoadingOrderDetail(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedOrderId]);

  const loadUserProfile = async () => {
    try {
      setIsLoadingProfile(true);
      const profile = await apiWrapper.getCurrentUser("WallPage");
      if (profile) {
        setUserProfile(profile);

        // Set selected size from profile object
        if (profile.profile?.selected_size) {
          setSelectedSize(profile.profile.selected_size);
        }

        // Set selected brands from profile
        if (profile.favorite_brands && profile.favorite_brands.length > 0) {
          const brandNames = profile.favorite_brands.map((brand) => brand.name);
          setSelectedBrands(brandNames);
        }
      } else {
        setSelectedBrands([]);
      }
    } catch (error: any) {
      console.error("Error loading user profile:", error);
    } finally {
      setIsLoadingProfile(false);
    }
  };

  // Load brands from API
  const loadBrands = async () => {
    try {
      const brands = await apiWrapper.getBrands("WallPage");
      setPopularBrands((brands || []).map((brand) => brand.name));
    } catch (error: any) {
      console.error("Error loading brands:", error);
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
      const stats = await apiWrapper.getUserStats("WallPage");
      if (stats) {
        setUserStats(stats);
      }
      setStatsLastLoaded(now);
      console.log("User stats loaded successfully");
    } catch (error: any) {
      console.error("Error loading user stats:", error);
    } finally {
      setIsLoadingStats(false);
    }
  };

  // Update user size preference with optimistic updates
  const updateUserSize = async (size: string) => {
    try {
      const originalSelectedSize = selectedSize;
      const originalUserProfile = userProfile;

      setSelectedSize(size);

      if (userProfile) {
        setUserProfile({
          ...userProfile,
          profile: {
            ...userProfile.profile,
            selected_size: size,
          },
        });
      }

      try {
        await api.updateUserProfileData({ selected_size: size });
        console.log("User size updated successfully");
      } catch (apiError: any) {
        console.error("API error updating user size:", apiError);
        setSelectedSize(originalSelectedSize);
        setUserProfile(originalUserProfile);
      }
    } catch (error: any) {
      console.error("Error updating user size:", error);
    }
  };

  // Update user favorite brands
  const updateUserBrands = async (brandIds: number[]) => {
    try {
      await api.updateUserBrands(brandIds);
      const allBrands = await apiWrapper.getBrands("WallPage");
      const selectedBrandNames = (allBrands || [])
        .filter((brand) => brandIds.includes(brand.id))
        .map((brand) => brand.name);
      setSelectedBrands(selectedBrandNames);
    } catch (error) {
      console.error("Error updating user brands:", error);
      Alert.alert(
        "ошибка обновления",
        "не удалось обновить любимые бренды. попробуйте позже.",
        [{ text: "OK" }],
      );
    }
  };

  // Handle brand selection in wall section with optimistic updates
  const handleBrandSelect = async (brandName: string) => {
    try {
      const brand = popularBrands.find((b) => b === brandName);
      if (!brand) {
        console.error("Brand not found in loaded brands:", brandName);
        Alert.alert("ошибка", "бренд не найден.");
        return;
      }

      const allBrands = await apiWrapper.getBrands("WallPage");
      const brandObj = (allBrands || []).find((b) => b.name === brandName);
      if (!brandObj) {
        console.error("Brand object not found:", brandName);
        Alert.alert("ошибка", "бренд не найден.");
        return;
      }

      const currentBrandIds =
        userProfile?.favorite_brands?.map((b) => b.id) || [];

      let newBrandIds: number[];
      let isAdding = false;
      if (currentBrandIds.includes(brandObj.id)) {
        newBrandIds = currentBrandIds.filter((id) => id !== brandObj.id);
        isAdding = false;
      } else {
        newBrandIds = [...currentBrandIds, brandObj.id];
        isAdding = true;
      }

      const originalSelectedBrands = [...selectedBrands];
      const originalUserProfile = userProfile;

      let newSelectedBrands: string[];
      if (isAdding) {
        newSelectedBrands = [...selectedBrands, brandName];
      } else {
        newSelectedBrands = selectedBrands.filter((name) => name !== brandName);
      }
      setSelectedBrands(newSelectedBrands);

      if (userProfile) {
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

      try {
        await api.updateUserBrands(newBrandIds);
        console.log("Brand selection updated successfully");
      } catch (apiError: any) {
        console.error("API error updating brands:", apiError);
        setSelectedBrands(originalSelectedBrands);
        setUserProfile(originalUserProfile);
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
          brand.toLowerCase().includes(searchQuery.toLowerCase()),
        )
      : popularBrands;

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
    updateUserSize(size);

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

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (event.nativeEvent.contentOffset.y > 5 && showScrollHint) {
      setShowScrollHint(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      "выход",
      "вы уверены, что хотите выйти из аккаунта?",
      [
        {
          text: "отмена",
          style: "cancel",
        },
        {
          text: "выйти",
          style: "destructive",
          onPress: () => {
            console.log("User logged out");
            if (onLogout) {
              onLogout();
            }
          },
        },
      ],
      { cancelable: true },
    );
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
          ANIMATION_DELAYS.LARGE,
        )}
      >
        <TouchableOpacity onPress={() => setShowBrandSearch(false)}>
          <BackIcon width={22} height={22} />
        </TouchableOpacity>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
          ANIMATION_DELAYS.EXTENDED,
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

      <Animated.View
        entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
          ANIMATION_DELAYS.VERY_LARGE,
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

  const handleItemPress = async (item: api.OrderItem) => {
    try {
      if (item.product_id) {
        console.log(
          "Wall - Fetching full product details for product_id:",
          item.product_id,
        );

        const fullProduct = await api.getProductDetails(item.product_id);

        const cardItem: CardItem = {
          ...mapProductToCardItem(fullProduct),
          size: item.size,
          quantity: 1,
        };

        console.log("Wall - Sending full product to MainPage:", {
          id: cardItem.id,
          brand_name: cardItem.brand_name,
          brand_return_policy: cardItem.brand_return_policy,
          images: cardItem.images,
          description: cardItem.description,
          variants: cardItem.variants,
          originalOrderItemId: item.id,
          productId: item.product_id,
        });

        navigation.navigate("Home", { addCardItem: cardItem });
      } else {
        console.log(
          "Wall - No product_id available, using order item data only",
        );

        const cardItem: CardItem = {
          id: item.id,
          name: item.name,
          brand_name: item.brand_name || "Unknown Brand",
          price: item.price,
          images: item.images
            ? item.images.map((img) => ({ uri: img }))
            : item.image
              ? [{ uri: item.image }]
              : [],
          isLiked: false,
          size: item.size,
          quantity: 1,
          color_variants: [
            {
              color_name: item.color || "Unknown",
              color_hex: "#888888",
              images: item.images || (item.image ? [item.image] : []),
              variants: [{ size: item.size, stock_quantity: 1 }],
            },
          ],
          selected_color_index: 0,
          variants: [{ size: item.size, stock_quantity: 1 }],
          description: item.description || "No description available.",
          color: item.color || "Unknown",
          materials: item.materials || "Unknown",
          brand_return_policy: item.return_policy || "Unknown",
        };

        navigation.navigate("Home", { addCardItem: cardItem });
      }
    } catch (error) {
      console.error("Wall - Error fetching product details:", error);

      const cardItem: CardItem = {
        id: item.product_id || item.id,
        name: item.name,
        brand_name: item.brand_name || "Unknown Brand",
        price: item.price,
        images: item.images
          ? item.images.map((img) => ({ uri: img }))
          : item.image
            ? [{ uri: item.image }]
            : [],
        isLiked: false,
        size: item.size,
        quantity: 1,
        color_variants: [
          {
            color_name: item.color || "Unknown",
            color_hex: "#888888",
            images: item.images || (item.image ? [item.image] : []),
            variants: [{ size: item.size, stock_quantity: 1 }],
          },
        ],
        selected_color_index: 0,
        variants: [{ size: item.size, stock_quantity: 1 }],
        description: item.description || "No description available.",
        color: item.color || "Unknown",
        materials: item.materials || "Unknown",
        brand_return_policy: item.return_policy || "Unknown",
      };

      navigation.navigate("Home", { addCardItem: cardItem });
    }
  };

  const renderOrderDetails = () => (
    <View style={styles.contentContainer}>
      <Animated.View
        style={styles.backButton}
        entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
          ANIMATION_DELAYS.LARGE,
        )}
      >
        <TouchableOpacity onPress={() => setSelectedOrderId(null)}>
          <BackIcon width={22} height={22} />
        </TouchableOpacity>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
          ANIMATION_DELAYS.LARGE,
        )}
        style={styles.orderDetailsContainer}
      >
        {isLoadingOrderDetail || !orderDetail ? (
          <Text style={styles.emptyStateText}>загрузка заказа...</Text>
        ) : (
          <>
        <ScrollView
          style={styles.orderItemsList}
          showsVerticalScrollIndicator={false}
        >
          {orderDetail.items.map((item, index) => (
            <Animated.View
              key={item.id}
              entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
                ANIMATION_DELAYS.STANDARD + index * ANIMATION_DELAYS.SMALL,
              )}
              style={styles.cartItem}
            >
              <Pressable
                style={styles.itemPressable}
                onPress={() => handleItemPress(item)}
              >
                <View style={styles.itemContent}>
                  <View style={styles.imageContainer}>
                    <CartItemImage item={item} />
                  </View>
                  <View style={styles.itemDetails}>
                    <Text
                      style={styles.itemName}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {item.name}
                    </Text>
                    <Text style={styles.itemPrice}>{`${item.price.toFixed(
                      2,
                    )} ₽`}</Text>
                    <Text style={styles.itemSize}>{item.size}</Text>
                  </View>
                </View>

                <View style={styles.rightContainer}>
                  <View style={styles.circle}>
                    <Canvas
                      style={{
                        width: 41,
                        height: 41,
                        backgroundColor: "transparent",
                      }}
                    >
                      <RoundedRect
                        x={0}
                        y={0}
                        width={41}
                        height={41}
                        r={20.5}
                        color="white"
                      >
                        <Shadow
                          dx={0}
                          dy={4}
                          blur={4}
                          color="rgba(0,0,0,0.5)"
                          inner
                        />
                      </RoundedRect>
                    </Canvas>
                  </View>
                </View>
              </Pressable>
            </Animated.View>
          ))}
        </ScrollView>

        <Animated.View
          entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
            ANIMATION_DELAYS.VERY_LARGE + ANIMATION_DELAYS.SMALL,
          )}
          style={styles.orderTotalContainer}
        >
          <Text style={styles.orderTotalText}>
            ИТОГО {orderDetail.total_amount.toFixed(2)} ₽
          </Text>
        </Animated.View>
        <Animated.View
          entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
            ANIMATION_DELAYS.VERY_LARGE + ANIMATION_DELAYS.STANDARD,
          )}
          style={styles.orderStatusContainer}
        >
          <Text style={[styles.orderStatusText, { marginLeft: 20 }]}>
            статус
          </Text>
          <Animated.View
            entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
              ANIMATION_DELAYS.VERY_LARGE + ANIMATION_DELAYS.EXTENDED,
            )}
            style={styles.orderStatus}
          >
            <Text style={styles.orderStatusText}>оплачен</Text>
          </Animated.View>
        </Animated.View>
          </>
        )}
      </Animated.View>
    </View>
  );

  const renderOrdersContent = () => {
    if (selectedOrderId) {
      return renderOrderDetails();
    }

    return (
      <View style={styles.contentContainer}>
        <Animated.View
          style={styles.backButton}
          entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
            ANIMATION_DELAYS.LARGE,
          )}
        >
          <TouchableOpacity onPress={() => setCurrentView("wall")}>
            <BackIcon width={22} height={22} />
          </TouchableOpacity>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
            ANIMATION_DELAYS.VERY_LARGE,
          )}
          style={styles.ordersContainer}
        >
          {isLoadingOrders ? (
            <Text style={styles.emptyStateText}>загрузка заказов...</Text>
          ) : orderError ? (
            <Text style={styles.emptyStateText}>{orderError}</Text>
          ) : orders.length === 0 ? (
            <>
              <Text style={styles.emptyStateText}>у вас пока нет заказов</Text>
              <Pressable
                style={styles.startShoppingButton}
                onPress={() => navigation.navigate("Home")}
              >
                <Text style={styles.startShoppingText}>начать покупки</Text>
              </Pressable>
            </>
          ) : (
            <ScrollView
              style={styles.ordersList}
              showsVerticalScrollIndicator={false}
            >
              {orders.map((order, index) => (
                <Animated.View
                  key={order.id}
                  entering={FadeInDown.duration(
                    ANIMATION_DURATIONS.MEDIUM,
                  ).delay(
                    ANIMATION_DELAYS.VERY_LARGE +
                      index * ANIMATION_DELAYS.SMALL,
                  )}
                  style={styles.orderItem}
                >
                  <View style={styles.orderBubble}>
                    <TouchableOpacity
                      style={styles.orderBubbleTouchArea}
                      onPress={() => setSelectedOrderId(order.id)}
                    >
                      <Text
                        style={styles.orderNumber}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.5}
                      >
                        заказ №{order.number}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.returnButton}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        const subject = encodeURIComponent(
                          `Return Request - Order #${order.number}`,
                        );
                        const body = encodeURIComponent(
                          `Здравствуйте,\n\nХочу инициировать возврат по заказу №${order.number}.\n\nС уважением`,
                        );
                        Linking.openURL(
                          `mailto:support@polkamarket.ru?subject=${subject}&body=${body}`,
                        );
                      }}
                    >
                      <Text style={styles.returnButtonText}>возврат</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.orderSummary}>
                    итого: {order.total_amount.toFixed(2)} ₽
                  </Text>
                </Animated.View>
              ))}
            </ScrollView>
          )}
        </Animated.View>
      </View>
    );
  };

  const renderSettingsButton = () => (
    <Animated.View
      entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
        ANIMATION_DELAYS.VERY_LARGE + ANIMATION_DELAYS.EXTENDED,
      )}
      style={styles.settingsButtonContainer}
    >
      <Pressable
        style={styles.settingsButton}
        onPress={() => {
          setSettingsInitialSection(null); // Reset to main settings page
          setCurrentView("settings");
        }}
      >
        <Text style={styles.settingsButtonText}>настройки</Text>
      </Pressable>
    </Animated.View>
  );

  const renderScrollableContent = () => {
    return (
      <View style={styles.scrollableContent}>
        <Animated.View
          entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
            ANIMATION_DELAYS.EXTENDED,
          )}
          style={styles.favoriteBrandsSection}
        >
          <TouchableOpacity
            style={styles.favoriteBrandsButton}
            onPress={() => setShowBrandSearch(true)}
          >
            <Text style={styles.favoriteBrandsText}>любимые бренды</Text>
          </TouchableOpacity>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
            ANIMATION_DELAYS.VERY_LARGE,
          )}
          style={styles.statsContainer}
        >
          {stats.map((stat, index) => {
            const isPurchased = stat.label === "куплено";
            const isScrolled = stat.label === "пролистано";

            if (isPurchased) {
              return (
                <View key={index} style={styles.statItem}>
                  <Text style={styles.statLabel}>{stat.label}</Text>
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setCurrentView("orders");
                    }}
                    style={({ pressed }) => [
                      styles.valueWrapper,
                      pressed && styles.valueWrapperPressed,
                    ]}
                  >
                    <Text style={styles.statValue}>{stat.value}</Text>
                  </Pressable>
                </View>
              );
            }

            if (isScrolled) {
              return (
                <View key={index} style={styles.statItem}>
                  <Text style={styles.statLabel}>{stat.label}</Text>
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      navigation.navigate("RecentPieces");
                    }}
                    style={({ pressed }) => [
                      styles.valueWrapper,
                      pressed && styles.valueWrapperPressed,
                    ]}
                  >
                    <Text style={styles.statValue}>{stat.value}</Text>
                  </Pressable>
                </View>
              );
            }

            return (
              <View key={index} style={styles.statItem}>
                <Text style={styles.statLabel}>{stat.label}</Text>
                <View style={styles.valueWrapper}>
                  <Text style={styles.statValue}>{stat.value}</Text>
                </View>
              </View>
            );
          })}
        </Animated.View>

        <Animated.View
          entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
            ANIMATION_DELAYS.VERY_LARGE + ANIMATION_DELAYS.SMALL,
          )}
          style={styles.sizeSection}
        >
          <Text style={styles.sizeSectionTitle}>размер</Text>
          <Pressable
            style={styles.sizeSelectionWrapper}
            onPress={handleSizePress}
          >
            {renderSizeSelection()}
          </Pressable>
        </Animated.View>

        {renderSettingsButton()}
      </View>
    );
  };

  const renderWallContent = () => {
    if (showBrandSearch) {
      return renderBrandSearch();
    }

    if (showAvatarEdit) {
      return (
        <AvatarEditScreen
          onBack={() => setShowAvatarEdit(false)}
          currentAvatar={userProfile?.profile?.avatar_url}
          onSave={async (avatarUri: string) => {
            try {
              const contentType = "image/jpeg";
              const { upload_url, public_url } = await api.getAvatarPresignedUrl(
                contentType
              );
              await api.uploadToPresignedUrl(avatarUri, upload_url, contentType);
              await api.updateUserProfileData({ avatar_url: public_url });
              setShowAvatarEdit(false);
              loadUserProfile();
            } catch (err: any) {
              console.error("Avatar upload failed:", err);
              Alert.alert(
                "Ошибка",
                err?.message || "Не удалось загрузить фото. Проверьте настройки сервера."
              );
            }
          }}
        />
      );
    }

    return (
      <View style={styles.contentContainer}>
        {/* Fixed header with avatar and logout */}
        <Animated.View
          entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
            ANIMATION_DELAYS.LARGE,
          )}
          style={styles.profileSection}
        >
          <Text style={styles.profileName}>
            {isLoadingProfile
              ? "загрузка..."
              : userProfile
                ? userProfile.username
                : "пользователь"}
          </Text>
          <View style={styles.profileImageWrapper}>
            <View style={styles.profileImageContainer}>
              {userProfile?.profile?.avatar_url ? (
                <Image
                  source={{ uri: userProfile.profile.avatar_url }}
                  style={styles.profileImage}
                />
              ) : (
                <View style={[StyleSheet.absoluteFill, { justifyContent: "center", alignItems: "center" }]}>
                  <MeAlt width={width * 0.25} height={width * 0.25} />
                </View>
              )}
            </View>
            <TouchableOpacity
              style={styles.penIconButton}
              onPress={() => setShowAvatarEdit(true)}
            >
              <View style={styles.penIconCircle}>
                <PenIcon width={12} height={12} />
              </View>
            </TouchableOpacity>
          </View>
        </Animated.View>

        <Animated.View
          style={styles.logoutButton}
          entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
            ANIMATION_DELAYS.LARGE,
          )}
        >
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              handleLogout();
            }}
          >
            <LogOut width={26} height={26} />
          </TouchableOpacity>
        </Animated.View>

        {/* Scrollable ovals */}
        <View style={styles.scrollableContainer}>
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
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
          >
            {renderScrollableContent()}
          </ScrollView>
        </View>
      </View>
    );
  };

  // Create a navigation wrapper for Settings that allows it to navigate back to Wall
  const settingsNavigation = {
    navigate: (screen: string, params?: any) => {
      if (screen === "Wall") {
        setCurrentView("wall");
      } else {
        navigation.navigate(screen, params);
      }
    },
    goBack: () => {
      setCurrentView("wall");
    },
    // Add a method to update bottom text from Settings
    setBottomText: (text: string) => {
      setSettingsBottomText(text);
    },
  };

  return (
    <Animated.View
      style={styles.container}
      entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
        ANIMATION_DELAYS.LARGE,
      )}
      exiting={FadeOutDown.duration(ANIMATION_DURATIONS.MICRO)}
    >
      <Animated.View style={styles.roundedBox}>
        <LinearGradient
          colors={["rgba(205, 166, 122, 0.4)", "rgba(205, 166, 122, 0)"]}
          start={{ x: 0, y: 1 }}
          end={{ x: 1, y: 0.3 }}
          style={styles.gradientBackground}
        />

        {/* Content Box */}
        <View style={styles.whiteBox}>
          {currentView === "wall" ? (
            renderWallContent()
          ) : currentView === "orders" ? (
            renderOrdersContent()
          ) : (
            <SettingsPage
              navigation={settingsNavigation}
              onLogout={onLogout}
              embedded={true}
              initialSection={settingsInitialSection}
            />
          )}
        </View>

        {/* Bottom Text */}
        <View style={styles.textContainer}>
          {(() => {
            const text =
              currentView === "wall"
                ? showAvatarEdit
                  ? "АВАТАРКА"
                  : "СТЕНА"
                : currentView === "orders"
                  ? selectedOrderId
                    ? (() => {
                        const o = orders.find((ord) => ord.id === selectedOrderId);
                        return o ? `ЗАКАЗ №${o.number}` : "ЗАКАЗ";
                      })()
                    : "ЗАКАЗЫ"
                  : settingsBottomText;
            // Use smaller font for longer text like "УВЕДОМЛЕНИЯ" (11 chars)
            const fontSize = text.length > 10 ? 34 : 38;
            return (
              <Text
                style={[styles.text, { fontSize }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {text}
              </Text>
            );
          })()}
        </View>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  backButton: {
    position: "absolute",
    top: 0,
    left: 0,
    zIndex: 11,
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
    overflow: "hidden",
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
  scrollView: {
    width: width * 0.88,
    left: -height * 0.025,
    paddingHorizontal: height * 0.025,
    marginBottom: -height * 0.025,
    borderRadius: 41,
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
    color: "#FFF",
    textAlign: "left",
  },
  contentContainer: {
    width: "100%",
    height: "100%",
    flexDirection: "column",
  },
  scrollableContainer: {
    flex: 1,
    position: "relative",
    marginTop: 15,
  },
  scrollableContent: {
    width: "100%",
    paddingBottom: 20,
  },
  profileSection: {
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "column",
    gap: 10,
    marginTop: 5,
    marginBottom: 15,
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
  logoutButton: {
    position: "absolute",
    top: 0,
    right: 0,
    zIndex: 11,
  },
  favoriteBrandsSection: {
    width: "98%",
    alignSelf: "center",
    height: height * 0.1,
    borderRadius: 41,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F2ECE7",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    marginBottom: 30,
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
    width: "98%",
    alignSelf: "center",
    backgroundColor: "#E2CCB2",
    borderRadius: 41,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    marginBottom: 30,
  },
  statItem: {
    alignItems: "center",
  },
  valueWrapperPressed: {
    opacity: 0.7,
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
    marginBottom: 30,
    marginHorizontal: 2, // Small margin to prevent shadow clipping
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
  settingsButtonContainer: {
    width: "98%",
    alignSelf: "center",
  },
  settingsButton: {
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
  settingsButtonText: {
    fontFamily: "IgraSans",
    fontSize: 20,
    color: "#000",
  },
  searchAndResultsContainer: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "space-between",
    position: "relative",
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
  searchInput: {
    fontFamily: "IgraSans",
    fontSize: 20,
    color: "#000",
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#E2CCB2",
    borderRadius: 41,
    marginBottom: 20,
    height: 0.1 * height,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  orderBubbleTouchArea: {
    flex: 1,
    justifyContent: "center",
    height: "100%",
    minWidth: 0,
    paddingLeft: 20,
  },
  returnButton: {
    paddingHorizontal: Platform.OS === "ios" ? 20 : 24,
    backgroundColor: "#D8B68F",
    borderRadius: 41,
    alignSelf: "stretch",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
  },
  returnButtonText: {
    fontFamily: "IgraSans",
    fontSize: 18,
    color: "#4A3120",
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
  orderDetailsContainer: {
    width: "100%",
    paddingTop: height * 0.05,
    alignItems: "center",
    height: "100%",
    justifyContent: "space-between",
  },
  orderItemsList: {
    width: width * 0.88,
    paddingHorizontal: 20,
    borderRadius: 41,
    height: "60%",
  },
  cartItem: {
    backgroundColor: "#E2CCB2",
    borderRadius: 41,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
    flex: 1,
  },
  itemPressable: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingTop: 20,
    paddingLeft: 25,
    paddingRight: 20,
    paddingBottom: 15,
  },
  itemContent: {
    flexDirection: "row",
    width: "80%",
    alignItems: "flex-start",
  },
  imageContainer: {
    width: "30%",
    height: "100%",
    alignSelf: "flex-start",
    marginRight: 15,
    justifyContent: "flex-start",
  },
  itemImage: {
    width: "100%",
    height: "100%",
    justifyContent: "flex-start",
    position: "absolute",
    top: 0,
    left: 0,
  },
  itemDetails: {
    flex: 1,
    justifyContent: "flex-start",
  },
  itemName: {
    fontFamily: "IgraSans",
    fontSize: 38,
    color: "#000",
    marginBottom: 0,
  },
  itemPrice: {
    fontFamily: "REM",
    fontSize: 16,
    color: "#000",
    marginBottom: 5,
  },
  itemSize: {
    fontFamily: "IgraSans",
    fontSize: 16,
    color: "#000",
    marginBottom: 20,
  },
  rightContainer: {
    justifyContent: "center",
    alignItems: "center",
    height: "100%",
    width: "20%",
  },
  circle: {
    position: "absolute",
    top: "30%",
    bottom: "30%",
    right: 0,
  },
  orderTotalContainer: {
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    flex: 1,
  },
  orderTotalText: {
    fontFamily: "IgraSans",
    fontSize: 34,
    color: "#000",
  },
  orderStatusContainer: {
    height: height * 0.1,
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#E2CCB2",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    borderRadius: 41,
  },
  orderStatus: {
    height: "100%",
    paddingHorizontal: 25,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#DCBF9D",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    borderRadius: 41,
  },
  orderStatusText: {
    fontFamily: "IgraSans",
    fontSize: 20,
    color: "#000",
  },
  emptyStateText: {
    fontFamily: "IgraSans",
    fontSize: 16,
    color: "#6A462F",
    marginBottom: 20,
  },
  startShoppingButton: {
    backgroundColor: "#CDA67A",
    borderRadius: 15,
    padding: 15,
    minWidth: 200,
    alignItems: "center",
  },
  startShoppingText: {
    fontFamily: "IgraSans",
    fontSize: 16,
    color: "white",
  },
});

export default Wall;
