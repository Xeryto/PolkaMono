import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Dimensions,
  ActivityIndicator,
  Pressable,
  Animated as RNAnimated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";
import BackIcon from "../components/svg/BackIcon";
import Cart2 from "../components/svg/Cart2";
import Heart2 from "../components/svg/Heart2";
import HeartFilled from "../components/svg/HeartFilled";
import * as api from "../services/api";
import { mapProductToCardItem } from "../lib/productMapper";
import { CardItem } from "../types/product";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import {
  ANIMATION_DURATIONS,
  ANIMATION_DELAYS,
  ANIMATION_EASING,
} from "../lib/animations";
import { Easing } from "react-native";

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
        : Haptics.ImpactFeedbackStyle.Medium
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
      style={[styles.heartButton, { zIndex: 10 }]}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      android_ripple={{
        color: "rgba(0,0,0,0.1)",
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
        RECENT_PIECES_CACHE_TIME_KEY
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
      const cardItems = products.map((product, index) =>
        mapProductToCardItem(product, index)
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
        JSON.stringify(cardItems)
      );
      await AsyncStorage.setItem(
        RECENT_PIECES_CACHE_TIME_KEY,
        Date.now().toString()
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
                `RecentPieces - Updated piece ${pieceId} like status to: ${newLikedStatus}`
              );
            } catch (error) {
              console.error("Error toggling favorite:", error);
              // Revert on error
              setRecentPieces((revertPieces) =>
                revertPieces.map((p) =>
                  p.id === pieceId ? { ...p, isLiked: currentLikedStatus } : p
                )
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
          ANIMATION_DELAYS.MEDIUM + index * 50
        )}
        style={styles.pieceWrapper}
      >
        <View style={styles.roundedBoxContainer}>
          <LinearGradient
            colors={["rgba(205, 166, 122, 0.5)", "transparent"]}
            start={{ x: 0.1, y: 1 }}
            end={{ x: 0.9, y: 0.3 }}
            locations={[0.2, 1]}
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
                  resizeMode="contain"
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
            <Text style={styles.brandName} numberOfLines={1}>
              {item.brand_name || "бренд не указан"}
            </Text>
            <Text style={styles.price}>
              {`${item.price.toFixed(2) || "0.00"} ₽`}
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
          <ActivityIndicator size="large" color="#CDA67A" />
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
          Вы еще не просмотрели ни одного товара
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.content}>
      {/* Header with oval background */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            navigation.goBack();
          }}
        >
          <BackIcon width={22} height={22} />
        </TouchableOpacity>
        <View style={styles.titleOval}>
          <Text style={styles.title}>просмотренные</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {/* List - only render if mounted, has data, and not loading */}
      {isMounted && recentPieces.length > 0 && !isLoading ? (
        <FlatList
          data={recentPieces}
          renderItem={renderPiece}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        renderEmpty()
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
    height: 50,
  },
  backButton: {
    padding: 10,
    marginLeft: -10,
  },
  titleOval: {
    backgroundColor: "#E2CCB2",
    borderRadius: 30,
    borderWidth: 3,
    borderColor: "#F5ECE1",
    paddingHorizontal: 20,
    paddingVertical: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  title: {
    fontFamily: "IgraSans",
    fontSize: 22,
    color: "#000",
    textAlign: "center",
  },
  headerSpacer: {
    width: 42, // Same width as back button for centering
  },
  listContent: {
    borderRadius: 41,
    paddingBottom: 20,
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
    backgroundColor: "rgba(205, 166, 122, 0)",
    borderWidth: 3,
    borderColor: "rgba(205, 166, 122, 0.4)",
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
    backgroundColor: "#F2ECE7",
    shadowColor: "#000",
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
    backgroundColor: "#E2CCB2",
  },
  placeholderText: {
    fontFamily: "REM",
    fontSize: 12,
    color: "#666",
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
    color: "white",
    flex: 1,
  },
  price: {
    fontFamily: "REM",
    fontSize: 14,
    textAlign: "right",
    color: "white",
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
    color: "#666",
    textAlign: "center",
    marginTop: 20,
  },
  errorText: {
    fontFamily: "REM",
    fontSize: 16,
    color: "#E66655",
    textAlign: "center",
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: "#CDA67A",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  retryButtonText: {
    fontFamily: "IgraSans",
    fontSize: 16,
    color: "#000",
  },
});

export default RecentPiecesScreen;
