import React, {
  useCallback,
  useRef,
  useState,
  useEffect,
  useMemo,
} from "react";
import { useTheme } from "../lib/ThemeContext";
import type { ThemeColors } from "../lib/theme";
import {
  View,
  StyleSheet,
  Image,
  Text,
  Pressable,
  Dimensions,
  Platform,
  Animated as RNAnimated,
  PanResponder,
  Easing,
  Alert,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
  TouchableOpacity,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Animated, {
  FadeInDown,
  FadeOutDown,
  useSharedValue,
  withTiming,
  runOnJS,
  useAnimatedStyle,
  interpolate,
} from "react-native-reanimated";
import {
  ANIMATION_DURATIONS,
  ANIMATION_DELAYS,
  ANIMATION_EASING,
} from "../lib/animations";

import Cart2 from "../components/svg/Cart2";
import Heart2 from "../components/svg/Heart2";
import HeartFilled from "../components/svg/HeartFilled";
import More from "../components/svg/More";
import Seen from "../components/svg/Seen";
import Cancel from "../components/svg/Cancel";
import BackIcon from "../components/svg/BackIcon";
import * as api from "../services/api";
import { apiWrapper } from "../services/apiWrapper";
import fallbackImage from "../assets/Vision.png";
import AvatarImage from "../components/AvatarImage";
import { CardItem, CartItem } from "../types/product";
import {
  mapProductToCardItem,
  getCardItemForColorIndex,
} from "../lib/productMapper";
import {
  translateColorToRussian,
  translateMaterialToRussian,
} from "../lib/translations";

interface SimpleNavigation {
  navigate: (screen: string, params?: any) => void;
  goBack: () => void;
  addListener?: (event: string, callback: () => void) => () => void;
  setParams?: (params: any) => void;
}

interface FriendRecommendationsScreenProps {
  navigation: SimpleNavigation;
  route?: {
    params?: {
      friendId: string;
      friendUsername: string;
      /** Friend avatar URL; when absent, header shows default avatar icon. */
      friendAvatarUrl?: string | null;
      initialItems: CardItem[];
      clickedItemIndex: number;
    };
  };
}

function angleToPoints(angle: number) {
  const rad = (angle * Math.PI) / 180;
  const x = Math.cos(rad);
  const y = Math.sin(rad);

  return {
    start: { x: 0.5 - x / 2, y: 0.5 - y / 2 },
    end: { x: 0.5 + x / 2, y: 0.5 + y / 2 },
  };
}

const MIN_CARDS_THRESHOLD = 3;
const LOADING_CARD_ID = "__loading_card__";
const height = Dimensions.get("window").height;
const width = Dimensions.get("window").width;

// Constants for corner overlays (matching MainPage)
const CARD_CORNER_INSET = 20;
const CORNER_BOX_SIZE = 52;
const CORNER_OVERLAY_SIZE = CARD_CORNER_INSET + CORNER_BOX_SIZE; // 72
const SIZE_PANEL_CLOSED_WIDTH = 52;

const formatDeliveryTime = (min?: number | null, max?: number | null): string | null => {
  if (min == null && max == null) return null;
  if (min != null && max != null) return `${min}–${max} дней`;
  if (min != null) return `от ${min} дней`;
  return `до ${max} дней`;
};

const createLoadingCard = (): CardItem => ({
  id: LOADING_CARD_ID,
  name: "загрузка...",
  brand_name: "загрузка...",
  price: 0,
  images: [fallbackImage],
  isLiked: false,
  description: "",
  color: "",
  materials: "",
  brand_return_policy: "",
  available_sizes: [],
  color_variants: [],
  selected_color_index: 0,
});

const ExpandableSection: React.FC<{ title: string; content: string; theme: ThemeColors }> = ({
  title,
  content,
  theme,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const animation = useRef(new RNAnimated.Value(0)).current;

  const toggleExpansion = () => {
    RNAnimated.timing(animation, {
      toValue: isExpanded ? 0 : 1,
      duration: ANIMATION_DURATIONS.STANDARD,
      useNativeDriver: false,
    }).start();
    setIsExpanded(!isExpanded);
  };

  const contentHeight = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 500],
  });

  const rotateArrow = animation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "90deg"],
  });

  return (
    <View style={{ marginBottom: 10, borderBottomWidth: 1, borderBottomColor: theme.border.light, paddingBottom: 5 }}>
      <Pressable onPress={toggleExpansion} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 }}>
        <Text style={{ fontFamily: 'REM', fontSize: 18, fontWeight: 'bold', color: theme.text.secondary }}>{title}</Text>
        <RNAnimated.View style={{ transform: [{ rotate: rotateArrow }] }}>
          <Text style={{ fontSize: 18, color: theme.text.secondary }}>{">"}</Text>
        </RNAnimated.View>
      </Pressable>
      <RNAnimated.View
        style={{
          maxHeight: contentHeight,
          paddingHorizontal: 10,
          paddingBottom: 10,
        }}
      >
        <Text style={{ fontFamily: 'REM', fontSize: 16, color: theme.text.tertiary }}>{content}</Text>
      </RNAnimated.View>
    </View>
  );
};

// Fetch friend recommendations from the API
const fetchMoreFriendCards = async (
  friendId: string,
  count: number = 2,
): Promise<CardItem[]> => {
  try {
    const products = await apiWrapper.getFriendRecommendations(
      friendId,
      "FriendRecommendationsScreen",
    );
    console.log("fetchMoreFriendCards - API returned products:", products);

    if (!products || !Array.isArray(products)) {
      console.error(
        "fetchMoreFriendCards - API did not return a valid array of products.",
      );
      return [];
    }

    return products
      .slice(0, count)
      .map((p: api.Product, i: number): CardItem => {
        return mapProductToCardItem(p, i);
      });
  } catch (error: any) {
    if (
      error &&
      error.message &&
      error.message.toLowerCase().includes("invalid token")
    ) {
      Alert.alert("сессия истекла", "пожалуйста, войдите в аккаунт снова.");
      return [];
    }
    console.error("Error fetching friend recommendations:", error);
    return [];
  }
};

const toggleLikeApi = async (
  productId: string,
  setLiked: boolean,
): Promise<boolean> => {
  try {
    const action = setLiked ? "like" : "unlike";
    await api.toggleFavorite(productId, action);
    return true;
  } catch (error) {
    console.error("Error toggling like:", error);
    return false;
  }
};

const HeartButton: React.FC<{
  isLiked: boolean;
  onToggleLike: () => void;
}> = ({ isLiked, onToggleLike }) => {
  const scaleAnim = useRef(new RNAnimated.Value(1)).current;

  const handlePress = () => {
    onToggleLike();
    RNAnimated.sequence([
      RNAnimated.timing(scaleAnim, {
        toValue: 1.3,
        duration: ANIMATION_DURATIONS.MICRO,
        useNativeDriver: true,
        easing: ANIMATION_EASING.QUICK,
      }),
      RNAnimated.timing(scaleAnim, {
        toValue: 1,
        duration: ANIMATION_DURATIONS.FAST,
        useNativeDriver: true,
        easing: ANIMATION_EASING.QUICK,
      }),
    ]).start();
  };

  return (
    <Pressable onPress={handlePress} style={{ padding: 5 }}>
      <RNAnimated.View style={{ transform: [{ scale: scaleAnim }] }}>
        {isLiked ? (
          <HeartFilled width={33} height={33} />
        ) : (
          <Heart2 width={33} height={33} />
        )}
      </RNAnimated.View>
    </Pressable>
  );
};

const FriendRecommendationsScreen = ({
  navigation,
  route,
}: FriendRecommendationsScreenProps) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const screenHeight = Dimensions.get("window").height;
  const screenWidth = Dimensions.get("window").width;

  const friendId = route?.params?.friendId || "";
  const friendUsername = route?.params?.friendUsername || "";
  const friendAvatarUrl = route?.params?.friendAvatarUrl ?? undefined;
  const initialItems = route?.params?.initialItems || [];
  const clickedItemIndex = route?.params?.clickedItemIndex || 0;

  // Start with items from clicked item onwards
  const [cards, setCards] = useState<CardItem[]>(() => {
    return initialItems.slice(clickedItemIndex);
  });
  const [isLoadingInitialCards, setIsLoadingInitialCards] = useState(false);

  const pan = useRef(new RNAnimated.ValueXY()).current;
  const fadeAnim = useRef(new RNAnimated.Value(1)).current;
  const imageHeightPercent = useRef(new RNAnimated.Value(100)).current;
  const refreshAnim = useRef(new RNAnimated.Value(1)).current;
  const [isRefreshing, setIsRefreshing] = useState(false);
  const heartScale = useRef(new RNAnimated.Value(1)).current;
  const longPressScale = useRef(new RNAnimated.Value(1)).current;
  const heartAnimationRef = useRef<RNAnimated.CompositeAnimation | null>(null);
  const longPressAnimationRef = useRef<RNAnimated.CompositeAnimation | null>(
    null,
  );

  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const isAnimatingRef = useRef(false);
  const isRefreshingRef = useRef(false);
  const [showSizeSelection, setShowSizeSelection] = useState(false);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [userSelectedSize, setUserSelectedSize] = useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Color selector state
  const [colorSelectorOpen, setColorSelectorOpen] = useState(false);
  const [dropdownContentHeight, setDropdownContentHeight] = useState(0);
  const colorDropdownHeight = useSharedValue(52);
  const sizePanelWidth = useSharedValue(52); // closed = cart corner only; open = full width

  const cartButtonScale = useRef(new RNAnimated.Value(1)).current;
  const [isFlipped, setIsFlipped] = useState(false);
  const flipAnimation = useRef(new RNAnimated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);
  const imageScrollViewRef = useRef<ScrollView>(null);
  const imageCarouselWidthRef = useRef(0);
  const [imageCarouselWidth, setImageCarouselWidth] = useState(0);
  const isFlippedRef = useRef(false);

  useEffect(() => {
    isAnimatingRef.current = isAnimating;
  }, [isAnimating]);

  useEffect(() => {
    isRefreshingRef.current = isRefreshing;
  }, [isRefreshing]);

  useEffect(() => {
    isFlippedRef.current = isFlipped;
  }, [isFlipped]);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const userProfile = await apiWrapper.getCurrentUser(
          "FriendRecommendationsScreen",
        );
        if (userProfile) {
          setUserSelectedSize(userProfile.profile?.selected_size || null);
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
        setUserSelectedSize(null);
      }
    };

    fetchUserData();
  }, []);

  // Color selector constants (matching MainPage)
  const COLOR_CORNER_CLOSED_HEIGHT = 52;
  const COLOR_GAP = 6;
  const COLOR_OPTION_HEIGHT = 32;
  const COLOR_DROPDOWN_ITEM_HEIGHT = COLOR_OPTION_HEIGHT + COLOR_GAP; // 38
  const COLOR_DROPDOWN_BOTTOM_PADDING = 8;

  // Close color selector when card changes
  useEffect(() => {
    setColorSelectorOpen(false);
    setDropdownContentHeight(0);
    colorDropdownHeight.value = 52;
  }, [currentCardIndex]);

  // Animate color dropdown height
  useEffect(() => {
    if (colorSelectorOpen && dropdownContentHeight > 0) {
      colorDropdownHeight.value = withTiming(dropdownContentHeight, {
        duration: 220,
      });
    }
  }, [colorSelectorOpen, dropdownContentHeight]);

  const closeColorSelector = useCallback(() => {
    colorDropdownHeight.value = withTiming(
      COLOR_CORNER_CLOSED_HEIGHT,
      { duration: 180 },
      (finished) => {
        if (finished) {
          runOnJS(setColorSelectorOpen)(false);
          runOnJS(setDropdownContentHeight)(0);
        }
      },
    );
  }, []);

  const colorDropdownAnimatedStyle = useAnimatedStyle(() => ({
    height: colorDropdownHeight.value,
    overflow: "hidden" as const,
  }));

  const handleColorSelect = useCallback(
    (colorIndex: number) => {
      const card = cards[currentCardIndex];
      if (
        !card?.color_variants?.length ||
        colorIndex < 0 ||
        colorIndex >= card.color_variants.length
      )
        return;
      const next = getCardItemForColorIndex(card, colorIndex);
      setCards((prev) => {
        const nextCards = [...prev];
        nextCards[currentCardIndex] = {
          ...card,
          selected_color_index: colorIndex,
          images: next.images,
          variants: next.variants,
          available_sizes: next.available_sizes,
          color: next.color,
        };
        return nextCards;
      });
      setCurrentImageIndex(0);
      closeColorSelector();
      if (imageScrollViewRef.current && imageCarouselWidth > 0) {
        setTimeout(() => {
          imageScrollViewRef.current?.scrollTo({ x: 0, animated: false });
        }, 0);
      }
    },
    [cards, currentCardIndex, closeColorSelector, imageCarouselWidth],
  );

  const CORNER_INSET = CARD_CORNER_INSET;
  const cardWidth = screenWidth * 0.80; // FriendRecommendationsScreen uses 80% card width
  const sizePanelMaxWidth = cardWidth - CORNER_INSET * 2;

  const SWIPE_THRESHOLD = screenHeight * 0.1;

  const trackSwipe = async (productId: string, _direction?: "up" | "right") => {
    if (!productId) return;
    try {
      await api.trackSwipeWithOptimisticUpdate({
        product_id: productId,
      });
    } catch (error) {
      console.error("Error tracking swipe:", error);
    }
  };

  const animateTextChange = () => {
    fadeAnim.stopAnimation();
    fadeAnim.setValue(1);
    RNAnimated.sequence([
      RNAnimated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
        easing: Easing.out(Easing.ease),
      }),
      RNAnimated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
        easing: Easing.in(Easing.ease),
      }),
    ]).start();
  };

  useEffect(() => {
    if (cards.length > 0) {
      animateTextChange();
    }
  }, [currentCardIndex]);

  useEffect(() => {
    setCurrentImageIndex(0);
    if (imageScrollViewRef.current && imageCarouselWidth > 0) {
      setTimeout(() => {
        imageScrollViewRef.current?.scrollTo({
          x: 0,
          animated: false,
        });
      }, 0);
    }
  }, [currentCardIndex, imageCarouselWidth]);

  const cardsRef = useRef<CardItem[]>([]);
  const currentCardIndexRef = useRef(0);

  useEffect(() => {
    cardsRef.current = cards;
  }, [cards]);

  useEffect(() => {
    currentCardIndexRef.current = currentCardIndex;
  }, [currentCardIndex]);

  const currentImageIndexRef = useRef(0);

  useEffect(() => {
    currentImageIndexRef.current = currentImageIndex;
  }, [currentImageIndex]);

  const handleImageScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const flipped = isFlippedRef.current;
      if (flipped || !imageCarouselWidthRef.current) {
        return;
      }

      const contentOffsetX = event.nativeEvent.contentOffset.x;
      const currentIndex = Math.round(
        contentOffsetX / imageCarouselWidthRef.current,
      );

      if (currentIndex >= 0) {
        const currentCards = cardsRef.current;
        const cardIndex = currentCardIndexRef.current;
        const currentCard = currentCards[cardIndex];

        if (
          currentCard &&
          currentIndex < currentCard.images.length &&
          currentIndex !== currentImageIndexRef.current
        ) {
          setCurrentImageIndex(currentIndex);
        }
      }
    },
    [],
  );

  const scrollToImageIndex = useCallback((index: number) => {
    if (imageScrollViewRef.current && imageCarouselWidthRef.current) {
      imageScrollViewRef.current.scrollTo({
        x: index * imageCarouselWidthRef.current,
        animated: true,
      });
    }
  }, []);

  const headerPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        const flipped = isFlippedRef.current;
        const animating = isAnimatingRef.current;
        const refreshing = isRefreshingRef.current;

        if (!flipped || animating || refreshing) {
          return false;
        }

        const { pageX, pageY } = evt.nativeEvent;
        const windowWidth = Dimensions.get("window").width;
        const cardWidth = windowWidth * 0.75;
        const cardLeft = windowWidth * 0.125;
        const cardRight = cardLeft + cardWidth;

        const cancelButtonRight = cardRight - 45;
        const cancelButtonLeft = cancelButtonRight - 25;
        const cancelButtonTop = 45;
        const cancelButtonBottom = cancelButtonTop + 25;

        const touchPadding = 15;
        if (
          pageX >= cancelButtonLeft - touchPadding &&
          pageX <= cancelButtonRight + touchPadding &&
          pageY >= cancelButtonTop - touchPadding &&
          pageY <= cancelButtonBottom + touchPadding
        ) {
          return false;
        }

        return Math.abs(gestureState.dy) > 5;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy <= 0) {
          pan.setValue({ x: 0, y: gestureState.dy });
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        const animating = isAnimatingRef.current;
        const refreshing = isRefreshingRef.current;

        if (animating || refreshing) {
          RNAnimated.spring(pan, {
            toValue: { x: 0, y: 0 },
            friction: 5,
            useNativeDriver: false,
          }).start();
          return;
        }

        if (gestureState.dy < -SWIPE_THRESHOLD) {
          setCards((currentCards) => {
            const currentCard = currentCards[currentCardIndex];
            if (currentCard) {
              swipeCard("up", currentCard);
            }
            return currentCards;
          });
        } else {
          RNAnimated.spring(pan, {
            toValue: { x: 0, y: 0 },
            friction: 5,
            useNativeDriver: false,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        RNAnimated.spring(pan, {
          toValue: { x: 0, y: 0 },
          friction: 5,
          useNativeDriver: false,
        }).start();
      },
    }),
  ).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        const flipped = isFlippedRef.current;
        const animating = isAnimatingRef.current;
        const refreshing = isRefreshingRef.current;

        if (flipped) return false;

        return !animating && !refreshing && Math.abs(gestureState.dy) > 5;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy <= 0) {
          pan.setValue({ x: 0, y: gestureState.dy });
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        const animating = isAnimatingRef.current;
        const refreshing = isRefreshingRef.current;

        if (animating || refreshing) {
          RNAnimated.spring(pan, {
            toValue: { x: 0, y: 0 },
            friction: 5,
            useNativeDriver: false,
          }).start();
          return;
        }

        if (gestureState.dy < -SWIPE_THRESHOLD) {
          setCards((currentCards) => {
            const currentCard = currentCards[currentCardIndex];
            if (currentCard) {
              swipeCard("up", currentCard);
            }
            return currentCards;
          });
        } else {
          RNAnimated.spring(pan, {
            toValue: { x: 0, y: 0 },
            friction: 5,
            useNativeDriver: false,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        RNAnimated.spring(pan, {
          toValue: { x: 0, y: 0 },
          friction: 5,
          useNativeDriver: false,
        }).start();
      },
    }),
  ).current;

  const fadeOutIn = useCallback(() => {
    fadeAnim.stopAnimation();
    fadeAnim.setValue(1);
    RNAnimated.sequence([
      RNAnimated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
        easing: Easing.out(Easing.ease),
      }),
      RNAnimated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
        easing: Easing.in(Easing.ease),
      }),
    ]).start();
  }, [fadeAnim]);

  const cleanupHeartAnimations = () => {
    if (heartAnimationRef.current) {
      heartAnimationRef.current.stop();
      heartAnimationRef.current = null;
    }

    if (longPressAnimationRef.current) {
      longPressAnimationRef.current.stop();
      longPressAnimationRef.current = null;
    }

    heartScale.setValue(1);
    longPressScale.setValue(1);
  };

  useEffect(() => {
    return () => {
      cleanupHeartAnimations();
    };
  }, []);

  const toggleLike = useCallback(
    (index: number) => {
      if (index < 0 || index >= cards.length) {
        return;
      }

      const card = cards[index];
      const currentLikedStatus = card.isLiked === true;
      const newLikedStatus = !currentLikedStatus;

      const newCards = [...cards];
      newCards[index] = {
        ...card,
        isLiked: newLikedStatus,
      };

      setCards(newCards);

      toggleLikeApi(card.id, newLikedStatus).then((success) => {
        if (!success) {
          setCards((prevCards) => {
            const revertedCards = [...prevCards];
            revertedCards[index] = {
              ...revertedCards[index],
              isLiked: currentLikedStatus,
            };
            return revertedCards;
          });
        }
      });
    },
    [cards],
  );

  const handleLongPress = useCallback(
    (index: number) => {
      if (index < 0 || index >= cards.length) return;
      toggleLike(index);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    [cards, toggleLike],
  );

  const handleFlip = useCallback(() => {
    RNAnimated.timing(flipAnimation, {
      toValue: isFlipped ? 0 : 180,
      duration: ANIMATION_DURATIONS.EXTENDED,
      useNativeDriver: true,
      easing: ANIMATION_EASING.CUBIC,
    }).start();
    setIsFlipped((prev) => !prev);
  }, [isFlipped, flipAnimation]);

  const swipeCard = (
    direction: "up" | "right" = "up",
    cardToSwipe?: CardItem,
  ) => {
    if (isAnimating) return;

    const currentCard = cardToSwipe || cards[currentCardIndex];

    if (currentCard?.id === LOADING_CARD_ID) {
      return;
    }

    const realCards = cards.filter((c) => c.id !== LOADING_CARD_ID);
    if (realCards.length === 1) {
      RNAnimated.sequence([
        RNAnimated.timing(pan, {
          toValue: { x: 0, y: -50 },
          duration: 100,
          easing: Easing.out(Easing.ease),
          useNativeDriver: false,
        }),
        RNAnimated.spring(pan, {
          toValue: { x: 0, y: 0 },
          friction: 4,
          tension: 40,
          useNativeDriver: false,
        }),
      ]).start();
      if (!isRefreshing) {
        refreshCards();
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    setIsAnimating(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const animationSafetyTimeout = setTimeout(() => {
      setIsAnimating(false);
      pan.setValue({ x: 0, y: 0 });
    }, 300);

    RNAnimated.timing(pan, {
      toValue: {
        x: direction === "right" ? screenWidth : 0,
        y: -screenHeight,
      },
      duration: 100,
      easing: Easing.ease,
      useNativeDriver: false,
    }).start(() => {
      clearTimeout(animationSafetyTimeout);
      setIsAnimating(false);
      setCards((prevCards) => {
        if (prevCards.length === 0) {
          return [];
        }
        const newCards = [...prevCards];
        if (newCards.length > 0) {
          newCards.splice(currentCardIndex, 1);
        }

        if (currentCard?.id) {
          trackSwipe(currentCard.id, direction);
        }

        const newIndex =
          currentCardIndex >= newCards.length
            ? Math.max(0, newCards.length - 1)
            : currentCardIndex;
        setTimeout(() => setCurrentCardIndex(newIndex), 0);

        const cardsWithoutLoading = newCards.filter(
          (c) => c.id !== LOADING_CARD_ID,
        );
        if (cardsWithoutLoading.length < MIN_CARDS_THRESHOLD) {
          const hasLoadingCard = newCards.some((c) => c.id === LOADING_CARD_ID);
          if (!hasLoadingCard) {
            newCards.push(createLoadingCard());
          }
          fetchMoreFriendCards(
            friendId,
            MIN_CARDS_THRESHOLD - cardsWithoutLoading.length + 1,
          ).then((apiCards) => {
            if (apiCards.length > 0) {
              setCards((latestCards) => {
                const filteredCards = latestCards.filter(
                  (c) => c.id !== LOADING_CARD_ID,
                );
                const updatedCards = [...filteredCards, ...apiCards];
                return updatedCards;
              });
            }
          });
        }
        return newCards;
      });

      flipAnimation.setValue(0);
      setIsFlipped(false);
      resetToButtons();
      pan.setValue({ x: 0, y: screenHeight });
      RNAnimated.spring(pan, {
        toValue: { x: 0, y: 0 },
        friction: 6,
        tension: 40,
        useNativeDriver: false,
      }).start();
    });

    fadeOutIn();
  };

  const handleCartPressIn = () => {
    RNAnimated.timing(cartButtonScale, {
      toValue: 0.85,
      duration: 80,
      useNativeDriver: true,
      easing: Easing.inOut(Easing.ease),
    }).start();
  };

  const handleCartPressOut = () => {
    RNAnimated.timing(cartButtonScale, {
      toValue: 1,
      duration: 150,
      useNativeDriver: true,
      easing: Easing.inOut(Easing.ease),
    }).start();
  };

  const handleCartPress = () => {
    setShowSizeSelection(true);
    sizePanelWidth.value = withTiming(sizePanelMaxWidth, {
      duration: 280,
    });
  };

  const handleCancelSizeSelection = () => {
    sizePanelWidth.value = withTiming(SIZE_PANEL_CLOSED_WIDTH, {
      duration: 220,
    });
    requestAnimationFrame(() => {
      setTimeout(() => setShowSizeSelection(false), 220);
    });
  };

  const resetToButtons = () => {
    sizePanelWidth.set(SIZE_PANEL_CLOSED_WIDTH);
    setShowSizeSelection(false);
  };

  const sizePanelAnimatedStyle = useAnimatedStyle(() => {
    const radius = interpolate(
      sizePanelWidth.value,
      [SIZE_PANEL_CLOSED_WIDTH, sizePanelMaxWidth],
      [16, 0],
    );
    return {
      width: sizePanelWidth.value,
      overflow: "hidden" as const,
      borderTopRightRadius: radius,
    };
  });

  const handleSizeSelect = (size: string) => {
    const currentCard = cards[currentCardIndex];

    const selectedVariant = currentCard?.variants?.find((v) => v.size === size);
    if (!selectedVariant || selectedVariant.stock_quantity === 0) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return;
    }

    const cartItem: CartItem = {
      ...currentCard,
      size: size,
      quantity: 1,
      delivery: { cost: 0, estimatedTime: "" },
    };

    if (typeof global.cartStorage !== "undefined") {
      global.cartStorage.addItem(cartItem);

      if (Platform.OS === "ios") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      resetToButtons();
      navigation.navigate("Cart");
    }
  };

  const refreshCards = useCallback(async () => {
    if (isRefreshing) return;

    setIsRefreshing(true);

    RNAnimated.sequence([
      RNAnimated.timing(refreshAnim, {
        toValue: 0.7,
        duration: 200,
        useNativeDriver: false,
        easing: Easing.out(Easing.ease),
      }),
      RNAnimated.timing(refreshAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
        easing: Easing.inOut(Easing.ease),
      }),
    ]).start();

    try {
      const newCards = await fetchMoreFriendCards(friendId, 2);
      await new Promise((resolve) => setTimeout(resolve, 300));

      setCards((prevCards) => {
        const updatedCards = [...newCards, ...prevCards.slice(0, 3)];
        return updatedCards;
      });

      setCurrentCardIndex(0);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) {
      console.error("Error refreshing cards:", error);
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, friendId]);

  const renderEmptyState = () => {
    return (
      <View style={[styles.whiteBox, styles.noCardsContainer]}>
        <Text style={styles.noCardsText}>Загрузка новых карточек...</Text>
        <Text style={styles.noCardsSubtext}>Пожалуйста, подождите</Text>
      </View>
    );
  };

  useEffect(() => {
    if (currentCardIndex >= cards.length && cards.length > 0) {
      setCurrentCardIndex(0);
    }
  }, [cards, currentCardIndex]);

  const renderFrontOfCard = useCallback(
    (card: CardItem, index: number) => {
      if (card.id === LOADING_CARD_ID) {
        return (
          <View style={[styles.whiteBox, styles.noCardsContainer]}>
            <Text style={styles.noCardsText}>Загрузка новых карточек...</Text>
            <Text style={styles.noCardsSubtext}>Пожалуйста, подождите</Text>
          </View>
        );
      }

      const isLiked = card.isLiked === true;

      return (
        <>
          <View style={styles.imageHolder}>
            <RNAnimated.View
              style={{
                width: "100%",
                height: imageHeightPercent.interpolate({
                  inputRange: [90, 100],
                  outputRange: ["90%", "100%"],
                }),
              }}
              onLayout={(event) => {
                const { width } = event.nativeEvent.layout;
                if (width > 0 && width !== imageCarouselWidthRef.current) {
                  imageCarouselWidthRef.current = width;
                  setImageCarouselWidth(width);
                }
              }}
            >
              {card.images.length > 1 ? (
                <ScrollView
                  ref={imageScrollViewRef}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  decelerationRate="fast"
                  onMomentumScrollEnd={handleImageScroll}
                  style={styles.imageCarousel}
                >
                  {card.images.map((imageSource, imgIndex) => {
                    const containerWidth =
                      imageCarouselWidth || screenWidth * 0.75;
                    return (
                      <View
                        key={`${card.id}-image-${imgIndex}`}
                        style={[
                          styles.imageContainer,
                          { width: containerWidth },
                        ]}
                      >
                        <Image
                          source={imageSource}
                          style={styles.image}
                          resizeMode="contain"
                        />
                      </View>
                    );
                  })}
                </ScrollView>
              ) : card.images.length > 0 ? (
                <View style={styles.imagePressable}>
                  <Image
                    key={card.id + "-" + currentImageIndex}
                    source={card.images[0]}
                    style={styles.image}
                    resizeMode="contain"
                  />
                </View>
              ) : (
                <View style={[styles.imagePressable, styles.imagePlaceholder]}>
                  <Text style={styles.imagePlaceholderText}>
                    Нет изображения
                  </Text>
                </View>
              )}
            </RNAnimated.View>
          </View>

          {/* Top-right: three dots – same inset as other corners */}
          <View style={styles.cornerOverlayTopRight} pointerEvents="box-none">
            <View style={styles.cornerInnerTopRight}>
              <Pressable onPress={handleFlip}>
                <More width={33} height={33} />
              </Pressable>
            </View>
          </View>

          {card.images.length > 1 && (
            <View style={styles.imageDotsContainer}>
              {card.images.map((_, dotIndex) => (
                <Pressable
                  key={dotIndex}
                  style={[
                    styles.imageDot,
                    dotIndex === currentImageIndex && styles.imageDotActive,
                  ]}
                  onPress={() => scrollToImageIndex(dotIndex)}
                />
              ))}
            </View>
          )}

          {/* Top-left: color selector – same inset; only animate height if more than one color */}
          {card.color_variants?.length > 0 && (
            <View style={styles.cornerOverlayTopLeft} pointerEvents="box-none">
              <Animated.View
                style={[
                  styles.colorSelectorCornerBox,
                  styles.colorSelectorInnerPos,
                  colorDropdownAnimatedStyle,
                ]}
              >
                <View style={styles.colorSelectorTriggerRow}>
                  <TouchableOpacity
                    style={styles.colorSelectorTriggerCircle}
                    onPress={() => {
                      if (colorSelectorOpen) {
                        closeColorSelector();
                      } else if ((card.color_variants?.length ?? 0) > 1) {
                        const otherCount = Math.max(
                          0,
                          (card.color_variants?.length ?? 1) - 1,
                        );
                        const openHeight =
                          COLOR_CORNER_CLOSED_HEIGHT +
                          COLOR_GAP +
                          otherCount * COLOR_DROPDOWN_ITEM_HEIGHT +
                          COLOR_DROPDOWN_BOTTOM_PADDING;
                        setDropdownContentHeight(openHeight);
                        setColorSelectorOpen(true);
                      }
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.colorSelectorSelectedRing}>
                      <View
                        style={[
                          styles.colorSwatchCircle,
                          {
                            backgroundColor: card.color_variants[
                              card.selected_color_index
                            ]?.color_hex?.startsWith("#")
                              ? card.color_variants[card.selected_color_index]
                                  .color_hex
                              : theme.text.grey,
                          },
                        ]}
                      />
                    </View>
                  </TouchableOpacity>
                </View>
                {colorSelectorOpen && (
                  <View style={styles.colorSelectorDropdownCircles}>
                    {card.color_variants
                      .map((cv, idx) => ({ cv, idx }))
                      .filter(({ idx }) => idx !== card.selected_color_index)
                      .map(({ cv, idx }) => (
                        <View key={cv.id ?? cv.color_name + idx}>
                          <TouchableOpacity
                            style={styles.colorSelectorOptionCircle}
                            onPress={() => handleColorSelect(idx)}
                            activeOpacity={0.7}
                          >
                            <View
                              style={[
                                styles.colorSwatchCircleSmall,
                                {
                                  backgroundColor: cv.color_hex?.startsWith("#")
                                    ? cv.color_hex
                                    : theme.text.grey,
                                },
                              ]}
                            />
                          </TouchableOpacity>
                        </View>
                      ))}
                  </View>
                )}
              </Animated.View>
            </View>
          )}

          {/* Bottom-left: size panel – same inset, grows to the right */}
          <View style={styles.cornerOverlayBottomLeft} pointerEvents="box-none">
            <View style={styles.sizePanelPosition}>
              <Animated.View
                style={[styles.sizePanelOuter, sizePanelAnimatedStyle]}
              >
                <View style={styles.sizePanelRow}>
                  <Pressable
                    style={styles.cornerOverlayBottomLeftInner}
                    onPressIn={handleCartPressIn}
                    onPressOut={handleCartPressOut}
                    onPress={handleCartPress}
                  >
                    <RNAnimated.View
                      style={{ transform: [{ scale: cartButtonScale }] }}
                    >
                      <Cart2 width={33} height={33} />
                    </RNAnimated.View>
                  </Pressable>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.sizeScrollContent}
                    style={styles.sizePanelScrollView}
                    pointerEvents={showSizeSelection ? "auto" : "none"}
                  >
                    {card?.variants?.map((variant, variantIndex) => {
                      const isAvailable = variant.stock_quantity > 0;
                      const isUserSize = variant.size === userSelectedSize;
                      const isOneSize = variant.size === "One Size";
                      return (
                        <Pressable
                          key={variant.size}
                          style={[
                            isOneSize ? styles.sizeOval : styles.sizeCircle,
                            isAvailable
                              ? styles.sizeCircleAvailable
                              : styles.sizeCircleUnavailable,
                            isUserSize && isAvailable
                              ? styles.sizeCircleUserSize
                              : null,
                            variantIndex > 0 ? { marginLeft: 10 } : null,
                          ]}
                          onPress={() => {
                            if (isAvailable) {
                              handleSizeSelect(variant.size);
                            } else {
                              Haptics.impactAsync(
                                Haptics.ImpactFeedbackStyle.Light,
                              );
                            }
                          }}
                          disabled={!isAvailable}
                        >
                          <Text
                            style={
                              isOneSize ? styles.sizeOvalText : styles.sizeText
                            }
                          >
                            {variant.size}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                  <Pressable
                    onPress={handleCancelSizeSelection}
                    style={styles.sizePanelCancelButton}
                  >
                    <Cancel width={27} height={27} />
                  </Pressable>
                </View>
              </Animated.View>
            </View>
          </View>

          {/* Bottom-right: like – same inset, overlay extends to edge (no image line) */}
          <View
            style={styles.cornerOverlayBottomRight}
            pointerEvents="box-none"
          >
            <View style={styles.cornerInnerBottomRight}>
              <View
                style={[
                  styles.cornerOverlayBottomRightInner,
                  { position: "relative" },
                ]}
              >
                <View style={{ zIndex: 999 }}>
                  <HeartButton
                    isLiked={isLiked}
                    onToggleLike={() => toggleLike(index)}
                  />
                </View>
                <Pressable
                  style={[StyleSheet.absoluteFill, { zIndex: 998 }]}
                  onLongPress={() => handleLongPress(index)}
                  delayLongPress={300}
                />
              </View>
            </View>
          </View>
        </>
      );
    },
    [
      showSizeSelection,
      imageHeightPercent,
      handleFlip,
      scrollToImageIndex,
      handleImageScroll,
      screenWidth,
      imageCarouselWidth,
      handleCartPressIn,
      handleCartPressOut,
      handleLongPress,
      toggleLike,
      currentImageIndex,
      userSelectedSize,
      handleSizeSelect,
      handleCancelSizeSelection,
      cards,
      imageScrollViewRef,
      colorSelectorOpen,
      handleColorSelect,
      closeColorSelector,
      currentCardIndex,
      colorDropdownAnimatedStyle,
      COLOR_CORNER_CLOSED_HEIGHT,
      COLOR_GAP,
      COLOR_DROPDOWN_ITEM_HEIGHT,
      COLOR_DROPDOWN_BOTTOM_PADDING,
      sizePanelAnimatedStyle,
      cartButtonScale,
    ],
  );

  const renderBackOfCard = useCallback(
    (card: CardItem) => {
      return (
        <View style={styles.cardBackContainer}>
          <Pressable style={[styles.removeButton]} onPress={handleFlip}>
            <Cancel width={27} height={27} />
          </Pressable>
          <View
            style={styles.cardBackHeader}
            {...headerPanResponder.panHandlers}
          >
            {card.images.length > 0 ? (
              <Image
                source={card.images[0]}
                style={styles.cardBackImage}
                resizeMode="contain"
              />
            ) : (
              <View style={[styles.cardBackImage, styles.imagePlaceholder]}>
                <Text style={styles.imagePlaceholderText}>Нет изображения</Text>
              </View>
            )}
            <Text style={styles.cardBackName}>{card.name}</Text>
          </View>
          <ScrollView
            ref={scrollViewRef}
            style={styles.expandableSectionsContainer}
            contentContainerStyle={styles.expandableSectionsContent}
            showsVerticalScrollIndicator={false}
            bounces={true}
          >
            {card.article_number && (
              <ExpandableSection
                title="артикул"
                content={card.article_number}
                theme={theme}
              />
            )}
            <ExpandableSection title="описание" content={card.description} theme={theme} />
            <ExpandableSection
              title="цвет"
              content={translateColorToRussian(card.color)}
              theme={theme}
            />
            <ExpandableSection title="материалы" content={card.materials} theme={theme} />
            {card.country_of_manufacture ? (
              <ExpandableSection title="страна производства" content={card.country_of_manufacture} theme={theme} />
            ) : null}
            <ExpandableSection
              title="политика возврата"
              content={
                card.brand_return_policy || "политика возврата не указана"
              }
              theme={theme}
            />
            {card.sizing_table_image ? (
              <View style={{ marginTop: 12, marginBottom: 4 }}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  bounces={false}
                  style={{ borderRadius: 8 }}
                >
                  <Image
                    source={{ uri: card.sizing_table_image }}
                    style={{ width: 280, height: 160, borderRadius: 8 }}
                    resizeMode="contain"
                  />
                </ScrollView>
              </View>
            ) : null}
            {formatDeliveryTime(card.delivery_time_min, card.delivery_time_max) ? (
              <ExpandableSection
                title="доставка"
                content={formatDeliveryTime(card.delivery_time_min, card.delivery_time_max)!}
                theme={theme}
              />
            ) : null}
          </ScrollView>
        </View>
      );
    },
    [handleFlip],
  );

  const renderCard = useCallback(
    (card: CardItem, index: number) => {
      if (!card) {
        return renderEmptyState();
      }

      const frontAnimatedStyle = {
        transform: [
          {
            rotateY: flipAnimation.interpolate({
              inputRange: [0, 180],
              outputRange: ["0deg", "180deg"],
            }),
          },
        ],
      };
      const backAnimatedStyle = {
        transform: [
          {
            rotateY: flipAnimation.interpolate({
              inputRange: [0, 180],
              outputRange: ["180deg", "360deg"],
            }),
          },
        ],
      };

      const frontPointerEvents = isFlipped ? "none" : "auto";
      const backPointerEvents = isFlipped ? "auto" : "none";

      const frontZIndex = isFlipped ? 1 : 2;
      const backZIndex = isFlipped ? 2 : 1;

      return (
        <RNAnimated.View
          {...panResponder.panHandlers}
          style={[
            styles.whiteBox,
            {
              transform: [{ translateX: pan.x }, { translateY: pan.y }],
              opacity: refreshAnim,
              backgroundColor: "transparent",
              shadowColor: "transparent",
              elevation: 0,
            },
          ]}
        >
          <RNAnimated.View
            style={[
              StyleSheet.absoluteFill,
              {
                backfaceVisibility: "hidden",
                zIndex: frontZIndex,
                pointerEvents: frontPointerEvents,
              },
              frontAnimatedStyle,
            ]}
          >
            <View style={styles.cardFace}>
              {renderFrontOfCard(card, index)}
            </View>
          </RNAnimated.View>

          <RNAnimated.View
            style={[
              StyleSheet.absoluteFill,
              {
                backfaceVisibility: "hidden",
                zIndex: backZIndex,
                pointerEvents: backPointerEvents,
              },
              backAnimatedStyle,
            ]}
          >
            <View style={styles.cardFace}>{renderBackOfCard(card)}</View>
          </RNAnimated.View>
        </RNAnimated.View>
      );
    },
    [
      pan,
      swipeCard,
      refreshAnim,
      renderEmptyState,
      isFlipped,
      flipAnimation,
      renderFrontOfCard,
      renderBackOfCard,
      panResponder,
    ],
  );

  useEffect(() => {
    let fetchTimer: NodeJS.Timeout;

    const cardsWithoutLoading = cards.filter((c) => c.id !== LOADING_CARD_ID);
    if (cardsWithoutLoading.length < MIN_CARDS_THRESHOLD && !isRefreshing) {
      fetchTimer = setTimeout(() => {
        fetchMoreFriendCards(
          friendId,
          MIN_CARDS_THRESHOLD - cardsWithoutLoading.length + 1,
        )
          .then((apiCards) => {
            if (apiCards.length > 0) {
              setCards((prevCards) => {
                const filteredCards = prevCards.filter(
                  (c) => c.id !== LOADING_CARD_ID,
                );
                if (filteredCards.length >= MIN_CARDS_THRESHOLD) {
                  return prevCards;
                }

                const updatedCards = [...filteredCards, ...apiCards];
                setIsAnimating(false);
                pan.setValue({ x: 0, y: 0 });

                return updatedCards;
              });
            }
          })
          .catch((error) => {
            console.error("Error fetching cards:", error);
            setIsAnimating(false);
            pan.setValue({ x: 0, y: 0 });
          });
      }, 300);
    }

    return () => {
      if (fetchTimer) {
        clearTimeout(fetchTimer);
      }
    };
  }, [cards.length, isRefreshing, friendId]);

  // Page fade-in removed - React Navigation handles screen transitions natively
  return (
    <Animated.View
      style={[styles.container]}
      entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
        ANIMATION_DELAYS.LARGE,
      )}
      exiting={FadeOutDown.duration(ANIMATION_DURATIONS.MICRO)}
    >
      {/* Friend Header */}
      <View style={styles.friendHeader}>
        <View style={styles.friendInfoContainer}>
          <View style={styles.backButtonContainer}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.navigate("Favorites")}
              activeOpacity={0.7}
            >
              <BackIcon width={22} height={22} />
            </TouchableOpacity>
          </View>
          <View style={styles.friendUsernameShadowWrapper}>
            <View style={styles.friendUsernameWrapper}>
              <LinearGradient
                colors={theme.gradients.friendUsername as any}
                locations={[0, 0.4, 1]}
                start={{ x: 0.25, y: 0 }}
                end={{ x: 0.6, y: 1.5 }}
                style={styles.friendUsernameBorder}
              />
              <View style={styles.friendUsernameInnerWrapper}>
                <View style={styles.friendUsernameContainer}>
                  <Text style={styles.friendUsername}>{friendUsername}</Text>
                </View>
              </View>
            </View>
          </View>
          <View style={styles.friendIconContainer}>
            <AvatarImage
              avatarUrl={friendAvatarUrl}
              size={Math.round(height * 0.065)}
            />
          </View>
        </View>
      </View>

      <View style={styles.roundedBox}>
        <LinearGradient
          colors={theme.gradients.overlay as any}
          start={{ x: 0.1, y: 1 }}
          end={{ x: 0.9, y: 0.3 }}
          locations={theme.gradients.overlayLocations as any}
          style={styles.gradientBackground}
        />

        {cards.length > 0
          ? renderCard(cards[currentCardIndex], currentCardIndex)
          : renderEmptyState()}

        <RNAnimated.View
          style={{ opacity: refreshAnim, width: "100%", height: "100%" }}
        >
          <RNAnimated.View style={[styles.text, { opacity: fadeAnim }]}>
            {cards.length > 0 ? (
              <>
                <Text style={styles.brandName} numberOfLines={1}>
                  {cards[currentCardIndex]?.brand_name || "бренд не указан"}
                </Text>
                <Text style={styles.price}>
                  {`${cards[currentCardIndex]?.price.toFixed(2) || "0.00"} ₽`}
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.name} numberOfLines={1}>
                  Загрузка...
                </Text>
                <Text style={styles.price}>Пожалуйста, подождите</Text>
              </>
            )}
          </RNAnimated.View>
        </RNAnimated.View>
      </View>
    </Animated.View>
  );
};

const createStyles = (theme: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "space-evenly",
    alignItems: "center",
    backgroundColor: 'transparent',
  },
  friendHeader: {
    width: "100%",
    height: height * 0.065,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: width * 0.06,
    zIndex: 1000,
  },
  backButtonContainer: {
    width: height * 0.065,
    height: height * 0.065,
    borderRadius: height * 0.065 * 0.5,
    backgroundColor: theme.surface.friend,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: theme.shadow.default,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  backButton: {
    width: height * 0.05,
    height: height * 0.05,
    justifyContent: "center",
    alignItems: "center",
  },
  friendInfoContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  friendIconContainer: {
    width: height * 0.065,
    height: height * 0.065,
    borderRadius: height * 0.065 * 0.5,
    backgroundColor: theme.surface.friend,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: theme.shadow.default,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  friendIcon: {
    width: height * 0.065 * 0.75,
    height: height * 0.065 * 0.75,
    resizeMode: "contain",
    borderRadius: height * 0.065 * 0.5 * 0.75,
  },
  friendUsernameShadowWrapper: {
    height: height * 0.065,
    borderRadius: height * 0.065 * 0.5,
    minWidth: width * 0.5,
    shadowColor: theme.shadow.default,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  friendUsernameWrapper: {
    height: "100%",
    width: "100%",
    borderRadius: height * 0.065 * 0.5,
    position: "relative",
    overflow: "hidden",
  },
  friendUsernameBorder: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: height * 0.065 * 0.5,
  },
  friendUsernameInnerWrapper: {
    width: "100%",
    height: "100%",
    padding: 3,
    borderRadius: height * 0.065 * 0.5,
  },
  friendUsernameContainer: {
    width: "100%",
    height: "100%",
    borderRadius: (height * 0.065 - 6) * 0.5,
    backgroundColor: theme.surface.friend,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: width * 0.06,
  },
  friendUsername: {
    fontFamily: "IgraSans",
    fontSize: 22,
    color: theme.text.primary,
  },
  gradientBackground: {
    borderRadius: 30,
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  roundedBox: {
    width: "80%",
    height: "85%",
    borderRadius: 35,
    backgroundColor: theme.primary + "00",
    position: "relative",
    borderWidth: 3,
    borderColor: theme.primary + "66",
    zIndex: 900,
  },
  whiteBox: {
    width: "102%",
    height: "82%",
    borderRadius: 35,
    position: "absolute",
    top: -3,
    left: -3,
    zIndex: 1000 - 7,
  },
  cardFace: {
    width: "100%",
    height: "100%",
    borderRadius: 35,
    backgroundColor: theme.background.primary,
    shadowColor: theme.shadow.default,
    shadowOffset: {
      width: 0.25,
      height: 4,
    },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 10,
    justifyContent: "center",
    alignItems: "center",
    padding: CARD_CORNER_INSET,
  },
  overlayLabelContainer: {
    width: "102%",
    height: "82%",
    borderRadius: 35,
    top: -3,
    left: -3,
    justifyContent: "center",
    alignItems: "center",
  },
  imageHolder: {
    position: "absolute",
    top: CARD_CORNER_INSET,
    left: CARD_CORNER_INSET,
    right: CARD_CORNER_INSET,
    bottom: CARD_CORNER_INSET,
    justifyContent: "center",
    alignItems: "center",
  },
  image: {
    width: "100%",
    height: "100%",
    resizeMode: "contain",
  },
  imagePressable: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  imageCarousel: {
    width: "100%",
    height: "100%",
  },
  imageContainer: {
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  imageDotsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    position: "absolute",
    bottom: CARD_CORNER_INSET + CORNER_BOX_SIZE / 2 - 8 / 2,
    width: "100%",
  },
  imageDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.text.primary + "80",
    marginHorizontal: 4,
  },
  imageDotActive: {
    backgroundColor: theme.button.primary,
  },
  text: {
    top: Platform.OS == "android" ? "82.5%" : "85%",
    width: "100%",
    paddingHorizontal: 18,
  },
  name: {
    fontFamily: "IgraSans",
    fontSize: 38,
    textAlign: "left",
    color: theme.text.inverse,
  },
  brandName: {
    fontFamily: "IgraSans",
    fontSize: 38,
    textAlign: "left",
    color: theme.text.inverse,
  },
  price: {
    fontFamily: "REM",
    fontSize: 16,
    textAlign: "left",
    color: theme.text.inverse,
  },
  sizeCircle: {
    width: 41,
    height: 41,
    borderRadius: 20.5,
    backgroundColor: theme.surface.button,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: theme.shadow.default,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  sizeCircleAvailable: {
    backgroundColor: theme.surface.button,
  },
  sizeCircleUnavailable: {
    backgroundColor: theme.surface.elevated,
  },
  sizeCircleUserSize: {
    backgroundColor: theme.button.primary,
  },
  sizeText: {
    color: theme.text.primary,
    fontWeight: "bold",
    fontSize: 16,
  },
  sizeOval: {
    width: 80,
    height: 41,
    borderRadius: 20.5,
    backgroundColor: theme.surface.button,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: theme.shadow.default,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  sizeOvalText: {
    color: theme.text.primary,
    fontWeight: "bold",
    fontSize: 12,
    textAlign: "center",
  },

  noCardsContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  noCardsText: {
    fontSize: 24,
    fontWeight: "bold",
    color: theme.text.primary,
    marginBottom: 10,
  },
  noCardsSubtext: {
    fontSize: 16,
    color: theme.text.secondary,
  },

  cardBackContainer: {
    flex: 1,
    padding: 20,
    justifyContent: "flex-start",
    alignItems: "center",
  },
  removeButton: {
    width: 25,
    height: 25,
    borderRadius: 7,
    backgroundColor: theme.interactive.remove,
    justifyContent: "center",
    alignItems: "center",
    position: "absolute",
    right: 25,
    top: 25,
    zIndex: 1000,
    elevation: 10,
  },
  cardBackHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    width: "100%",
    justifyContent: "flex-start",
    paddingRight: 50,
  },
  cardBackImage: {
    width: 80,
    height: 80,
    marginRight: 10,
    borderRadius: 10,
  },
  imagePlaceholder: {
    backgroundColor: theme.surface.button,
    justifyContent: "center",
    alignItems: "center",
  },
  imagePlaceholderText: {
    fontFamily: "IgraSans",
    fontSize: 14,
    color: theme.text.secondary,
  },
  cardBackName: {
    fontFamily: "IgraSans",
    fontSize: 24,
    color: theme.text.primary,
    flex: 1,
    flexWrap: "wrap",
  },
  expandableSectionsContainer: {
    width: "100%",
    flex: 1,
  },
  expandableSectionsContent: {
    paddingBottom: 20,
  },
  expandableContainer: {
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.border.light,
    paddingBottom: 5,
  },
  expandableHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
  },
  expandableTitle: {
    fontFamily: "REM",
    fontSize: 18,
    fontWeight: "bold",
    color: theme.text.secondary,
  },
  expandableArrow: {
    fontSize: 18,
    color: theme.text.secondary,
  },
  expandableContent: {
    fontFamily: "Rubik-Regular",
    fontSize: 14,
    color: theme.text.secondary,
  },
  cornerOverlayTopLeft: {
    position: "absolute",
    top: 0,
    left: 0,
    width: CORNER_OVERLAY_SIZE,
    height: CORNER_OVERLAY_SIZE,
    backgroundColor: theme.background.primary,
    borderTopLeftRadius: 41,
    borderBottomRightRadius: 16,
    zIndex: 20,
    elevation: 21,
  },
  cornerOverlayTopRight: {
    position: "absolute",
    top: 0,
    right: 0,
    width: CORNER_OVERLAY_SIZE,
    height: CORNER_OVERLAY_SIZE,
    backgroundColor: theme.background.primary,
    borderTopRightRadius: 41,
    borderBottomLeftRadius: 16,
    zIndex: 20,
    elevation: 21,
  },
  cornerOverlayBottomLeft: {
    position: "absolute",
    bottom: 0,
    left: 0,
    width: CORNER_OVERLAY_SIZE,
    height: CORNER_OVERLAY_SIZE,
    backgroundColor: theme.background.primary,
    borderBottomLeftRadius: 41,
    borderTopRightRadius: 16,
    zIndex: 25,
    elevation: 26,
  },
  cornerOverlayBottomRight: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: CORNER_OVERLAY_SIZE,
    height: CORNER_OVERLAY_SIZE,
    backgroundColor: theme.background.primary,
    borderBottomRightRadius: 41,
    borderTopLeftRadius: 16,
    zIndex: 20,
    elevation: 21,
  },
  cornerInnerTopRight: {
    position: "absolute",
    top: CARD_CORNER_INSET,
    right: CARD_CORNER_INSET,
    width: CORNER_BOX_SIZE,
    height: CORNER_BOX_SIZE,
    justifyContent: "center",
    alignItems: "center",
  },
  cornerInnerBottomRight: {
    position: "absolute",
    bottom: CARD_CORNER_INSET,
    right: CARD_CORNER_INSET,
    width: CORNER_BOX_SIZE,
    height: CORNER_BOX_SIZE,
  },
  sizePanelPosition: {
    position: "absolute",
    left: CARD_CORNER_INSET,
    bottom: CARD_CORNER_INSET,
  },
  sizePanelOuter: {
    backgroundColor: theme.background.primary,
    height: CORNER_BOX_SIZE,
    justifyContent: "center",
  },
  sizePanelRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: CORNER_BOX_SIZE,
  },
  sizePanelScrollView: {
    flex: 1,
    height: 60,
    minWidth: 0,
  },
  sizePanelCancelButton: {
    width: 41,
    height: 41,
    borderRadius: 20.5,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.interactive.remove,
  },
  cornerOverlayBottomLeftInner: {
    backgroundColor: theme.background.primary,
    width: CORNER_BOX_SIZE,
    height: CORNER_BOX_SIZE,
    padding: 10,
    borderTopRightRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  cornerOverlayBottomRightInner: {
    backgroundColor: theme.background.primary,
    width: CORNER_BOX_SIZE,
    height: CORNER_BOX_SIZE,
    padding: 10,
    borderTopLeftRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  colorSelectorCornerBox: {
    backgroundColor: theme.background.primary,
    paddingHorizontal: 10,
    paddingVertical: 0,
    borderBottomRightRadius: 16,
    width: CORNER_BOX_SIZE,
    minHeight: CORNER_BOX_SIZE,
    overflow: "hidden",
    justifyContent: "flex-start",
    alignItems: "center",
  },
  colorSelectorTriggerRow: {
    width: "100%",
    height: CORNER_BOX_SIZE,
    justifyContent: "center",
    alignItems: "center",
  },
  colorSelectorInnerPos: {
    position: "absolute",
    top: CARD_CORNER_INSET,
    left: CARD_CORNER_INSET,
  },
  colorSelectorTriggerCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  colorSelectorSelectedRing: {
    width: 26 + 4 * 2 + 4 * 2,
    height: 26 + 4 * 2 + 4 * 2,
    borderRadius: (26 + 4 * 2 + 4 * 2) / 2,
    borderWidth: 4,
    borderColor: theme.text.tertiary,
    justifyContent: "center",
    alignItems: "center",
  },
  colorSwatchCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: "rgba(0,0,0,0.2)",
  },
  colorSelectorDropdownWrapper: {
    width: 32,
    marginTop: 6,
    alignSelf: "center",
  },
  colorSelectorDropdownCircles: {
    flexDirection: "column",
    alignItems: "center",
    paddingTop: 6,
    paddingBottom: 0,
  },
  colorSelectorOptionCircle: {
    padding: 3,
    borderRadius: 13,
  },
  colorSwatchCircleSmall: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: "rgba(0,0,0,0.2)",
  },
  sizeScrollContent: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 60,
  },
});

export default FriendRecommendationsScreen;
