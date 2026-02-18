import React, {
  useCallback,
  useRef,
  useState,
  useEffect,
  useMemo,
} from "react";
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
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";
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
import { CardItem, CartItem } from "../types/product";
import { mapProductToCardItem } from "../lib/productMapper";
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
      friendIcon?: any;
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

const ExpandableSection: React.FC<{ title: string; content: string }> = ({
  title,
  content,
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
    <View style={styles.expandableContainer}>
      <Pressable onPress={toggleExpansion} style={styles.expandableHeader}>
        <Text style={styles.expandableTitle}>{title}</Text>
        <RNAnimated.View style={{ transform: [{ rotate: rotateArrow }] }}>
          <Text style={styles.expandableArrow}>{">"}</Text>
        </RNAnimated.View>
      </Pressable>
      <RNAnimated.View
        style={{
          maxHeight: contentHeight,
          paddingHorizontal: 10,
          paddingBottom: 10,
        }}
      >
        <Text style={styles.expandableContent}>{content}</Text>
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
    RNAnimated.sequence([
      RNAnimated.timing(scaleAnim, {
        toValue: 1.3,
        duration: 100,
        useNativeDriver: true,
        easing: Easing.out(Easing.ease),
      }),
      RNAnimated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
        easing: Easing.in(Easing.ease),
      }),
    ]).start();
    onToggleLike();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <Pressable onPress={handlePress} style={styles.button}>
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
  const screenHeight = Dimensions.get("window").height;
  const screenWidth = Dimensions.get("window").width;

  const friendId = route?.params?.friendId || "";
  const friendUsername = route?.params?.friendUsername || "";
  const friendIcon =
    route?.params?.friendIcon || require("../assets/Vision.png");
  const initialItems = route?.params?.initialItems || [];
  const clickedItemIndex = route?.params?.clickedItemIndex || 0;

  // Start with items from clicked item onwards
  const [cards, setCards] = useState<CardItem[]>(() => {
    return initialItems.slice(clickedItemIndex);
  });
  const [isLoadingInitialCards, setIsLoadingInitialCards] = useState(false);

  const pan = useRef(new RNAnimated.ValueXY()).current;
  const fadeAnim = useRef(new RNAnimated.Value(1)).current;
  const buttonsTranslateX = useRef(new RNAnimated.Value(0)).current;
  const sizesTranslateX = useRef(new RNAnimated.Value(-screenWidth)).current;
  const imageHeightPercent = useRef(new RNAnimated.Value(100)).current;
  // pageOpacity removed - React Navigation handles screen transitions
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

  const cartButtonScale = useRef(new RNAnimated.Value(1)).current;
  const seenButtonScale = useRef(new RNAnimated.Value(1)).current;
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
    handleCartPress();
  };

  const handleSeenPressIn = () => {
    RNAnimated.timing(seenButtonScale, {
      toValue: 0.85,
      duration: 80,
      useNativeDriver: true,
      easing: Easing.inOut(Easing.ease),
    }).start();
  };

  const handleSeenPressOut = () => {
    RNAnimated.timing(seenButtonScale, {
      toValue: 1,
      duration: 150,
      useNativeDriver: true,
      easing: Easing.inOut(Easing.ease),
    }).start();
    swipeCard("up");
  };

  const handleCartPress = () => {
    RNAnimated.parallel([
      RNAnimated.timing(buttonsTranslateX, {
        toValue: screenWidth,
        duration: 300,
        easing: Easing.ease,
        useNativeDriver: true,
      }),
      RNAnimated.timing(sizesTranslateX, {
        toValue: 0,
        duration: 300,
        easing: Easing.ease,
        useNativeDriver: true,
      }),
      RNAnimated.timing(imageHeightPercent, {
        toValue: 90,
        duration: 300,
        easing: Easing.ease,
        useNativeDriver: false,
      }),
    ]).start(() => {
      requestAnimationFrame(() => {
        setShowSizeSelection(true);
      });
    });
  };

  const handleCancelSizeSelection = () => {
    RNAnimated.parallel([
      RNAnimated.timing(buttonsTranslateX, {
        toValue: 0,
        duration: 300,
        easing: Easing.ease,
        useNativeDriver: true,
      }),
      RNAnimated.timing(sizesTranslateX, {
        toValue: -screenWidth,
        duration: 300,
        easing: Easing.ease,
        useNativeDriver: true,
      }),
      RNAnimated.timing(imageHeightPercent, {
        toValue: 100,
        duration: 300,
        easing: Easing.ease,
        useNativeDriver: false,
      }),
    ]).start(() => {
      requestAnimationFrame(() => {
        setShowSizeSelection(false);
      });
    });
  };

  const resetToButtons = () => {
    buttonsTranslateX.setValue(0);
    sizesTranslateX.setValue(-screenWidth);
    imageHeightPercent.setValue(100);
    setShowSizeSelection(false);
  };

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
                  <Text style={styles.imagePlaceholderText}>Нет изображения</Text>
                </View>
              )}
            </RNAnimated.View>
            <Pressable style={styles.dotsButton} onPress={handleFlip}>
              <More width={23} height={33} />
            </Pressable>
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

          <RNAnimated.View
            style={[
              styles.buttonContainer,
              {
                transform: [{ translateX: buttonsTranslateX }],
                opacity: showSizeSelection ? 0 : 1,
              },
            ]}
          >
            <Pressable
              style={styles.button}
              onPressIn={handleCartPressIn}
              onPressOut={handleCartPressOut}
            >
              <RNAnimated.View
                style={{ transform: [{ scale: cartButtonScale }] }}
              >
                <Cart2 width={33} height={33} />
              </RNAnimated.View>
            </Pressable>

            <Pressable
              style={styles.button}
              onPressIn={handleSeenPressIn}
              onPressOut={handleSeenPressOut}
            >
              <RNAnimated.View
                style={{ transform: [{ scale: seenButtonScale }] }}
              >
                <Seen width={33} height={33} />
              </RNAnimated.View>
            </Pressable>

            <View style={{ zIndex: 999 }}>
              <HeartButton
                isLiked={isLiked}
                onToggleLike={() => toggleLike(index)}
              />
            </View>

            <Pressable
              style={[
                styles.longPressOverlay,
                { position: "absolute", right: 0, zIndex: 998 },
              ]}
              onLongPress={() => handleLongPress(index)}
              delayLongPress={300}
            />
          </RNAnimated.View>

          <RNAnimated.View
            style={[
              styles.sizeContainer,
              {
                transform: [{ translateX: sizesTranslateX }],
                opacity: showSizeSelection ? 1 : 0,
              },
            ]}
          >
            {card?.variants && card.variants.length === 1 ? (
              <>
                {card.variants.map((variant) => {
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
                <Pressable
                  onPress={handleCancelSizeSelection}
                  style={styles.cancelSizeSelectionButtonAbsolute}
                >
                  <Cancel width={27} height={27} />
                </Pressable>
              </>
            ) : (
              <>
                {card?.variants?.map((variant, index) => {
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
                        index > 0 ? { marginLeft: 10 } : null,
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
                <Pressable
                  onPress={handleCancelSizeSelection}
                  style={[
                    styles.sizeCircle,
                    styles.cancelSizeButton,
                    { marginLeft: 10 },
                  ]}
                >
                  <Cancel width={27} height={27} />
                </Pressable>
              </>
            )}
          </RNAnimated.View>
        </>
      );
    },
    [
      showSizeSelection,
      buttonsTranslateX,
      sizesTranslateX,
      imageHeightPercent,
      handleFlip,
      scrollToImageIndex,
      handleImageScroll,
      screenWidth,
      imageCarouselWidth,
      handleCartPressIn,
      handleCartPressOut,
      handleSeenPressIn,
      handleSeenPressOut,
      handleLongPress,
      toggleLike,
      currentImageIndex,
      userSelectedSize,
      handleSizeSelect,
      handleCancelSizeSelection,
      cards,
      imageScrollViewRef,
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
              />
            )}
            <ExpandableSection title="описание" content={card.description} />
            <ExpandableSection
              title="цвет"
              content={translateColorToRussian(card.color)}
            />
            <ExpandableSection title="материалы" content={card.materials} />
            <ExpandableSection
              title="политика возврата"
              content={
                card.brand_return_policy || "политика возврата не указана"
              }
            />
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
  const { start, end } = angleToPoints(30);
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
                colors={["#FFFFFF8F", "#FF10FB59", "#0341EA6B"]}
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
            <Image source={friendIcon} style={styles.friendIcon} />
          </View>
        </View>
      </View>

      <View style={styles.roundedBox}>
        <LinearGradient
          colors={["rgba(205, 166, 122, 0.5)", "transparent"]}
          start={{ x: 0.1, y: 1 }}
          end={{ x: 0.9, y: 0.3 }}
          locations={[0.2, 1]}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "space-evenly",
    alignItems: "center",
  },
  friendHeader: {
    width: "100%",
    height: height * 0.065,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: width * 0.06,
  },
  backButtonContainer: {
    width: height * 0.065,
    height: height * 0.065,
    borderRadius: height * 0.065 * 0.5,
    backgroundColor: "#F5ECE1",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
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
    backgroundColor: "#F5ECE1",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
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
    shadowColor: "#000",
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
    backgroundColor: "#F5ECE1",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: width * 0.06,
  },
  friendUsername: {
    fontFamily: "IgraSans",
    fontSize: 22,
    color: "#4A3120",
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
    backgroundColor: "rgba(205, 166, 122, 0)",
    position: "relative",
    borderWidth: 3,
    borderColor: "rgba(205, 166, 122, 0.4)",
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
    backgroundColor: "#F2ECE7",
    shadowColor: "#000",
    shadowOffset: {
      width: 0.25,
      height: 4,
    },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 10,
    justifyContent: "center",
    alignItems: "center",
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
    width: "75%",
    height: "80%",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 5,
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
    bottom: 10,
    width: "100%",
  },
  imageDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(74, 49, 32, 0.5)",
    marginHorizontal: 4,
  },
  imageDotActive: {
    backgroundColor: "#4A3120",
  },
  dotsButton: {
    position: "absolute",
    top: -15,
    right: -22.5,
    padding: 5,
    borderRadius: 5,
  },
  dotsImage: {
    width: 23,
    height: 33,
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "110%",
    marginBottom: -60,
  },
  button: {
    padding: 5,
  },
  icon: {
    width: 33,
    height: 33,
    resizeMode: "contain",
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
    color: "white",
  },
  brandName: {
    fontFamily: "IgraSans",
    fontSize: 38,
    textAlign: "left",
    color: "white",
  },
  price: {
    fontFamily: "REM",
    fontSize: 16,
    textAlign: "left",
    color: "white",
  },
  sizeContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    width: "100%",
    marginBottom: 0,
    paddingHorizontal: 20,
    position: "relative",
  },
  sizeCircle: {
    width: 41,
    height: 41,
    borderRadius: 20.5,
    backgroundColor: "#E2CCB2",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  sizeCircleAvailable: {
    backgroundColor: "#E2CCB2",
  },
  sizeCircleUnavailable: {
    backgroundColor: "#BFBBB8",
  },
  sizeCircleUserSize: {
    backgroundColor: "#CDA67A",
  },
  sizeText: {
    color: "#000",
    fontWeight: "bold",
    fontSize: 16,
  },
  sizeOval: {
    width: 80,
    height: 41,
    borderRadius: 20.5,
    backgroundColor: "#E2CCB2",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  sizeOvalText: {
    color: "#000",
    fontWeight: "bold",
    fontSize: 12,
    textAlign: "center",
  },
  cancelSizeSelectionButton: {
    width: 41,
    height: 41,
    borderRadius: 20.5,
    backgroundColor: "rgba(230, 109, 123, 0.54)",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  cancelSizeSelectionButtonAbsolute: {
    position: "absolute",
    right: 20,
    width: 41,
    height: 41,
    borderRadius: 20.5,
    backgroundColor: "rgba(230, 109, 123, 0.54)",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  cancelSizeButton: {
    backgroundColor: "rgba(230, 109, 123, 0.54)",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  noCardsContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  noCardsText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 10,
  },
  noCardsSubtext: {
    fontSize: 16,
    color: "#666",
  },
  longPressOverlay: {
    width: 50,
    height: 50,
    position: "absolute",
    top: -10,
    right: -10,
    zIndex: 998,
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
    backgroundColor: "rgba(230, 109, 123, 0.54)",
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
    backgroundColor: "rgba(0,0,0,0.06)",
    justifyContent: "center",
    alignItems: "center",
  },
  imagePlaceholderText: {
    fontFamily: "IgraSans",
    fontSize: 14,
    color: "rgba(0,0,0,0.4)",
  },
  cardBackName: {
    fontFamily: "IgraSans",
    fontSize: 24,
    color: "#333",
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
    borderBottomColor: "#eee",
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
    color: "#555",
  },
  expandableArrow: {
    fontSize: 18,
    color: "#555",
  },
  expandableContent: {
    fontFamily: "REM",
    fontSize: 16,
    color: "#777",
  },
});

export default FriendRecommendationsScreen;
