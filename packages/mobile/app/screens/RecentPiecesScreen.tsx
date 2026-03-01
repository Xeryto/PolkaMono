import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Pressable,
  Animated as RNAnimated,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";
import BackIcon from "../components/svg/BackIcon";
import Cart2 from "../components/svg/Cart2";
import Heart2 from "../components/svg/Heart2";
import HeartFilled from "../components/svg/HeartFilled";
import * as api from "../services/api";
import { mapProductToCardItem } from "../lib/productMapper";
import { getEffectivePrice, formatPrice } from "../lib/swipeCardUtils";
import { CardItem } from "../types/product";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import {
  ANIMATION_DURATIONS,
  ANIMATION_DELAYS,
  ANIMATION_EASING,
} from "../lib/animations";
import { Easing } from "react-native";
import { useTheme } from "../lib/ThemeContext";
import type { ThemeColors } from "../lib/theme";

const { width, height } = Dimensions.get("window");

const RECENT_PIECES_CACHE_KEY = "PolkaMobile_recentPieces";
const RECENT_PIECES_CACHE_TIME_KEY = "PolkaMobile_recentPiecesTime";
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

interface RecentPiecesScreenProps {
  navigation: {
    navigate: (screen: string, params?: any) => void;
    goBack: () => void;
  };
}

// HeartButton component (same as MainPage)
interface HeartButtonProps {
  isLiked: boolean;
  onToggleLike: () => void;
}

const HeartButton: React.FC<HeartButtonProps> = ({ isLiked, onToggleLike }) => {
  const { theme } = useTheme();
  const heartScale = useRef(new RNAnimated.Value(1)).current;
  const pressScale = useRef(new RNAnimated.Value(1)).current;
  const [isAnimating, setIsAnimating] = useState(false);

  const handlePressIn = () => {
    RNAnimated.timing(pressScale, {
      toValue: 0.85,
      duration: ANIMATION_DURATIONS.MICRO,
      useNativeDriver: true,
      easing: ANIMATION_EASING.QUICK,
    }).start();
  };

  const handlePressOut = () => {
    RNAnimated.timing(pressScale, {
      toValue: 1,
      duration: ANIMATION_DURATIONS.FAST,
      useNativeDriver: true,
      easing: ANIMATION_EASING.QUICK,
    }).start();
    handlePress();
  };

  const handlePress = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    onToggleLike();
    Haptics.impactAsync(
      isLiked
        ? Haptics.ImpactFeedbackStyle.Light
        : Haptics.ImpactFeedbackStyle.Medium,
    );
    RNAnimated.sequence([
      RNAnimated.spring(heartScale, {
        toValue: 1.3,
        useNativeDriver: true,
        speed: 300,
        bounciness: 12,
      }),
      RNAnimated.spring(heartScale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 300,
        bounciness: 12,
      }),
    ]).start(() => {
      requestAnimationFrame(() => {
        setIsAnimating(false);
      });
    });
  };

  return (
    <Pressable
      style={{ padding: 5, zIndex: 10 }}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      android_ripple={{
        color: theme.interactive.ripple,
        radius: 20,
        borderless: true,
      }}
      hitSlop={{ top: 25, bottom: 25, left: 25, right: 25 }}
    >
      <RNAnimated.View style={{ transform: [{ scale: pressScale }] }}>
        <RNAnimated.View style={{ transform: [{ scale: heartScale }] }}>
          {isLiked ? (
            <HeartFilled width={33} height={33} />
          ) : (
            <Heart2 width={33} height={33} />
          )}
        </RNAnimated.View>
      </RNAnimated.View>
    </Pressable>
  );
};

const RecentPiecesScreen: React.FC<RecentPiecesScreenProps> = ({
  navigation,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [recentPieces, setRecentPieces] = useState<CardItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(true);

  // Load from cache or API
  const loadRecentPieces = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Try to load from cache first
      const cachedData = await AsyncStorage.getItem(RECENT_PIECES_CACHE_KEY);
      const cachedTime = await AsyncStorage.getItem(
        RECENT_PIECES_CACHE_TIME_KEY,
      );

      if (cachedData && cachedTime) {
        const cacheAge = Date.now() - parseInt(cachedTime, 10);
        if (cacheAge < CACHE_DURATION) {
          console.log("Loading recent pieces from cache");
          const parsed = JSON.parse(cachedData);
          setRecentPieces(parsed);
          setIsLoading(false);

          // Still fetch in background to update cache
          fetchRecentPieces(true);
          return;
        }
      }

      // Fetch from API
      await fetchRecentPieces(false);
    } catch (err) {
      console.error("Error loading recent pieces:", err);
      setError("Не удалось загрузить просмотренные товары");
      setIsLoading(false);
    }
  }, []);

  const fetchRecentPieces = async (isBackground: boolean) => {
    try {
      const products = await api.getRecentSwipes(5);
      // Deduplicate by product ID (user may swipe same piece multiple times)
      const seen = new Set<string>();
      const uniqueProducts = products.filter((p) => {
        const id = String(p.id);
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      });
      const cardItems = uniqueProducts.map((product, index) =>
        mapProductToCardItem(product, index),
      );

      // Only update if still mounted
      if (!isMounted) return;

      // Update state if not background fetch
      if (!isBackground) {
        setRecentPieces(cardItems);
        setIsLoading(false);
      } else {
        // Update state silently if background fetch
        setRecentPieces(cardItems);
      }

      // Update cache
      await AsyncStorage.setItem(
        RECENT_PIECES_CACHE_KEY,
        JSON.stringify(cardItems),
      );
      await AsyncStorage.setItem(
        RECENT_PIECES_CACHE_TIME_KEY,
        Date.now().toString(),
      );
    } catch (err) {
      console.error("Error fetching recent pieces:", err);
      if (!isBackground && isMounted) {
        setError("не удалось загрузить просмотренные товары");
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    setIsMounted(true);
    loadRecentPieces();

    return () => {
      // Clear pieces immediately when unmounting to prevent empty boxes during transition
      setRecentPieces([]);
      setIsLoading(true);
      setIsMounted(false);
    };
  }, [loadRecentPieces]);

  // Toggle like function (similar to MainPage)
  const toggleLike = useCallback((pieceId: string) => {
    setRecentPieces((prevPieces) => {
      const newPieces = prevPieces.map((piece) => {
        if (piece.id === pieceId) {
          const currentLikedStatus = piece.isLiked === true;
          const newLikedStatus = !currentLikedStatus;

          // Update via API
          const toggleLikeApi = async () => {
            try {
              const action = newLikedStatus ? "like" : "unlike";
              await api.toggleFavorite(pieceId, action);
              console.log(
                `RecentPieces - Updated piece ${pieceId} like status to: ${newLikedStatus}`,
              );
            } catch (error) {
              console.error("Error toggling favorite:", error);
              // Revert on error
              setRecentPieces((revertPieces) =>
                revertPieces.map((p) =>
                  p.id === pieceId ? { ...p, isLiked: currentLikedStatus } : p,
                ),
              );
            }
          };
          toggleLikeApi();

          return {
            ...piece,
            isLiked: newLikedStatus,
          };
        }
        return piece;
      });
      return newPieces;
    });
  }, []);

  const handlePiecePress = (piece: CardItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Navigate to MainPage with the piece as a card item
    navigation.navigate("Home", {
      addCardItem: piece,
    });
  };

  const handleCartPress = (piece: CardItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Navigate to MainPage with the piece as a card item
    navigation.navigate("Home", {
      addCardItem: piece,
    });
  };

  const renderPiece = ({ item, index }: { item: CardItem; index: number }) => {
    // Don't render if unmounted or item is invalid
    if (!isMounted || !item || !item.id) {
      return null;
    }

    const imageSource =
      item.images && item.images.length > 0 ? item.images[0] : null;
    const isLiked = item.isLiked === true;

    return (
      <Animated.View
        entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
          ANIMATION_DELAYS.MEDIUM + index * 50,
        )}
        style={styles.pieceWrapper}
      >
        <View style={styles.roundedBoxContainer}>
          <LinearGradient
            colors={theme.gradients.overlay as any}
            start={{ x: 0.1, y: 1 }}
            end={{ x: 0.9, y: 0.3 }}
            locations={theme.gradients.overlayLocations as any}
            style={styles.gradientBackground}
          />
          <View style={styles.whiteBox}>
            {/* Image on the left - full size */}
            <Pressable
              style={styles.imageContainer}
              onPress={() => handlePiecePress(item)}
            >
              {imageSource ? (
                <Image
                  source={imageSource}
                  style={styles.pieceImage}
                  contentFit="contain"
                />
              ) : (
                <View style={[styles.pieceImage, styles.placeholderImage]}>
                  <Text style={styles.placeholderText}>Нет изображения</Text>
                </View>
              )}
            </Pressable>

            {/* Icons on the right */}
            <View style={styles.iconsContainer}>
              <Pressable
                style={styles.iconButton}
                onPress={() => handleCartPress(item)}
              >
                <Cart2 width={33} height={33} />
              </Pressable>
              <HeartButton
                isLiked={isLiked}
                onToggleLike={() => toggleLike(item.id)}
              />
            </View>
          </View>

          {/* Text section below - brand name and price */}
          <View style={styles.textSection}>
            <Text style={styles.brandName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
              {item.brand_name || "бренд не указан"}
            </Text>
            <Text style={styles.price}>
              {`${formatPrice(getEffectivePrice(item))} ₽`}
            </Text>
          </View>
        </View>
      </Animated.View>
    );
  };

  const renderEmpty = () => {
    if (isLoading) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.emptyText}>Загрузка...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={loadRecentPieces}
          >
            <Text style={styles.retryButtonText}>Попробовать снова</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>
          вы еще не просмотрели ни одного товара
        </Text>
      </View>
    );
  };

  return (
    <Animated.View
      style={styles.content}
      entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
        ANIMATION_DELAYS.LARGE,
      )}
      exiting={FadeOutDown.duration(ANIMATION_DURATIONS.MICRO)}
    >
      {/* Header with oval background */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            navigation.navigate("Wall");
          }}
        >
          <BackIcon width={22} height={22} />
        </TouchableOpacity>
        <View style={styles.titleOvalShadowWrapper}>
          <View style={styles.titleOvalWrapper}>
            <LinearGradient
              colors={theme.gradients.titleOval as any}
              locations={[0, 1]}
              start={{ x: 0.25, y: 0 }}
              end={{ x: 0.6, y: 1.5 }}
              style={styles.titleOvalBorder}
            />
            <View style={styles.titleOvalInnerWrapper}>
              <LinearGradient
                colors={theme.gradients.titleOvalContainer as any}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.titleOvalContainer}
              >
                <Text style={styles.title}>недавно</Text>
                <Text style={styles.title}>просмотренные</Text>
              </LinearGradient>
            </View>
          </View>
        </View>
      </View>

      {/* List - only render if mounted, has data, and not loading */}
      {isMounted && recentPieces.length > 0 && !isLoading ? (
        <FlatList
          data={recentPieces}
          style={{ borderRadius: 41 }}
          renderItem={renderPiece}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        renderEmpty()
      )}
    </Animated.View>
  );
};

const createStyles = (theme: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background.primary,
    },
    gradient: {
      flex: 1,
    },
    content: {
      flex: 1,
      paddingHorizontal: 20,
      paddingBottom: 15,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      height: height * 0.065,
      paddingHorizontal: width * 0.06,
      zIndex: 10,
      marginBottom: 5,
    },
    backButton: {
      padding: 10,
      position: "absolute",
      left: width * 0.05,
    },
    titleOvalShadowWrapper: {
      height: "100%",
      borderRadius: 30,
      shadowColor: theme.shadow.default,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 5,
    },
    titleOvalWrapper: {
      height: "100%",
      width: "100%",
      borderRadius: 30,
      position: "relative",
      overflow: "hidden",
    },
    titleOvalBorder: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderRadius: 30,
    },
    titleOvalInnerWrapper: {
      width: "100%",
      height: "100%",
      padding: 3,
      borderRadius: 30,
    },
    titleOvalContainer: {
      width: "100%",
      height: "100%",
      borderRadius: 27,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingVertical: height * 0.015,
    },
    title: {
      fontFamily: "IgraSans",
      fontSize: 18,
      lineHeight: 22,
      color: theme.text.primary,
      textAlign: "center",
    },
    listContent: {
      paddingTop: 15,
    },
    pieceWrapper: {
      width: "100%",
      marginBottom: 15,
      alignItems: "center",
    },
    roundedBoxContainer: {
      width: "88%",
      height: height * 0.225, // Smaller than MainPage
      borderRadius: 41,
      backgroundColor: theme.primary + "00",
      borderWidth: 3,
      borderColor: theme.primary + "66",
      position: "relative",
      overflow: "visible", // Changed from hidden to visible so whiteBox can extend
      zIndex: 0,
    },
    gradientBackground: {
      borderRadius: 38,
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 1,
    },
    whiteBox: {
      width: "102%",
      height: "70%", // Reduced size
      borderRadius: 38,
      backgroundColor: theme.background.primary,
      shadowColor: theme.shadow.default,
      shadowOffset: {
        width: 0.25,
        height: 4,
      },
      shadowOpacity: 0.5,
      shadowRadius: 4,
      elevation: 10,
      position: "absolute",
      top: -3,
      left: -3,
      flexDirection: "row",
      overflow: "hidden",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 10, // Higher than border and gradient
    },
    imageContainer: {
      width: "40%", // Smaller image container
      maxHeight: "90%",
      justifyContent: "center",
      alignItems: "center",
      padding: 15,
    },
    pieceImage: {
      width: "100%",
      height: "100%",
    },
    placeholderImage: {
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.surface.button,
    },
    placeholderText: {
      fontFamily: "REM",
      fontSize: 12,
      color: theme.text.secondary,
      textAlign: "center",
    },
    iconsContainer: {
      flex: 1,
      flexDirection: "row", // Horizontal layout
      justifyContent: "flex-end",
      alignItems: "center",
      gap: 20,
      paddingRight: 20,
    },
    iconButton: {
      padding: 5,
    },
    heartButton: {
      padding: 5,
    },
    textSection: {
      position: "absolute",
      bottom: 12.5,
      left: 18,
      right: 18,
      paddingTop: 5,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      zIndex: 11, // Above white box
    },
    brandName: {
      fontFamily: "IgraSans",
      fontSize: 32,
      textAlign: "left",
      color: theme.text.inverse,
      flex: 1,
    },
    price: {
      fontFamily: "REM",
      fontSize: 14,
      textAlign: "right",
      color: theme.text.inverse,
      marginLeft: 10,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingVertical: 50,
    },
    emptyText: {
      fontFamily: "REM",
      fontSize: 16,
      color: theme.text.secondary,
      textAlign: "center",
      marginTop: 20,
    },
    errorText: {
      fontFamily: "REM",
      fontSize: 16,
      color: theme.status.error,
      textAlign: "center",
      marginBottom: 20,
    },
    retryButton: {
      backgroundColor: theme.button.primary,
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 20,
    },
    retryButtonText: {
      fontFamily: "IgraSans",
      fontSize: 16,
      color: theme.text.primary,
    },
  });

export default RecentPiecesScreen;
