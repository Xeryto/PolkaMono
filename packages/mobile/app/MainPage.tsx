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
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";
import {
  ANIMATION_DURATIONS,
  ANIMATION_DELAYS,
  ANIMATION_EASING,
} from "./lib/animations";

import Cart2 from "./components/svg/Cart2";
import Heart2 from "./components/svg/Heart2";
import HeartFilled from "./components/svg/HeartFilled";
import More from "./components/svg/More";
import Seen from "./components/svg/Seen";
import Cancel from "./components/svg/Cancel";
import * as api from "./services/api";
import { apiWrapper } from "./services/apiWrapper";
import fallbackImage from "./assets/Vision.png"; // Use as fallback for missing images
import vision2Image from "./assets/Vision2.png";
import { CardItem, CartItem } from "./types/product";
import { mapProductToCardItem } from "./lib/productMapper";
import {
  translateColorToRussian,
  translateMaterialToRussian,
} from "./lib/translations";

// Define a simpler navigation type that our custom navigation can satisfy
interface SimpleNavigation {
  navigate: (screen: string) => void;
  goBack: () => void;
  addListener?: (event: string, callback: () => void) => () => void;
  setParams?: (params: any) => void;
}

interface MainPageProps {
  navigation: SimpleNavigation;
  route?: {
    params?: {
      addCardItem?: CardItem;
      refreshCards?: boolean;
      refreshTimestamp?: number;
    };
  };
}

// Add a constant for the minimum number of cards to maintain
const MIN_CARDS_THRESHOLD = 3;

// Loading card ID constant
const LOADING_CARD_ID = "__loading_card__";

// Helper function to create a loading card
const createLoadingCard = (): CardItem => ({
  id: LOADING_CARD_ID,
  name: "Загрузка...",
  brand_name: "Загрузка...",
  price: 0,
  images: [fallbackImage],
  isLiked: false,
  description: "",
  color: "",
  materials: "",
  brand_return_policy: "",
  available_sizes: [],
});

// Global cards storage that persists even when component unmounts
// This ensures the card collection remains intact when navigating between screens
const persistentCardStorage: {
  cards: CardItem[];
  initialized: boolean;
} = {
  cards: [],
  initialized: false,
};

// Expandable Section Component
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
      useNativeDriver: false, // height animation not supported with native driver
    }).start();
    setIsExpanded(!isExpanded);
  };

  const contentHeight = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 500], // Use a large enough value for maxHeight
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

// Fetch recommendations from the real API
const fetchMoreCards = async (count: number = 2): Promise<CardItem[]> => {
  try {
    const products = await apiWrapper.getUserRecommendations("MainPage");
    console.log("fetchMoreCards - API returned products:", products);

    // Add a check to ensure products is an array
    if (!products || !Array.isArray(products)) {
      console.error(
        "fetchMoreCards - API did not return a valid array of products."
      );
      return []; // Return an empty array to prevent further errors
    }

    // Map RecommendationProduct to CardItem using utility function for consistency
    return products
      .slice(0, count)
      .map((p: api.Product, i: number): CardItem => {
        console.log(`fetchMoreCards - Processing product ${i}:`, {
          id: p.id,
          name: p.name,
          brand_name: p.brand_name,
          brand_return_policy: p.brand_return_policy,
          article_number: p.article_number,
          idType: typeof p.id,
        });
        return mapProductToCardItem(p, i);
      });
  } catch (error: any) {
    if (
      error &&
      error.message &&
      error.message.toLowerCase().includes("invalid token")
    ) {
      Alert.alert("сессия истекла", "пожалуйста, войдите в аккаунт снова.");
      // Optionally, trigger navigation to login if available
      // navigation.navigate('Login');
      return [];
    }
    console.error("Error fetching recommendations:", error);
    return [];
  }
};

// Like/unlike using the real API
const toggleLikeApi = async (
  productId: string,
  setLiked: boolean
): Promise<boolean> => {
  try {
    const action = setLiked ? "like" : "unlike";
    await api.toggleFavorite(productId, action);
    return true;
  } catch (error) {
    console.error("Error toggling favorite:", error);
    return false;
  }
};

// Dedicated Heart Button component to improve like/unlike functionality
interface HeartButtonProps {
  isLiked: boolean;
  onToggleLike: () => void;
}

const HeartButton: React.FC<HeartButtonProps> = ({ isLiked, onToggleLike }) => {
  // Local animation state
  const heartScale = useRef(new RNAnimated.Value(1)).current;
  const pressScale = useRef(new RNAnimated.Value(1)).current;
  const [isAnimating, setIsAnimating] = useState(false);

  // Handle heart button press-in animation
  const handlePressIn = () => {
    RNAnimated.timing(pressScale, {
      toValue: 0.85,
      duration: ANIMATION_DURATIONS.MICRO,
      useNativeDriver: true,
      easing: ANIMATION_EASING.QUICK,
    }).start();
  };

  // Handle heart button press-out animation
  const handlePressOut = () => {
    RNAnimated.timing(pressScale, {
      toValue: 1,
      duration: ANIMATION_DURATIONS.FAST,
      useNativeDriver: true,
      easing: ANIMATION_EASING.QUICK,
    }).start();

    // Call the actual press handler
    handlePress();
  };

  // Handle heart button press
  const handlePress = () => {
    // Log press event for debugging
    console.log(`HeartButton - Button pressed: current isLiked=${isLiked}`);

    // Prevent double-taps during animation
    if (isAnimating) {
      console.log("HeartButton - Ignoring press during animation");
      return;
    }

    // Set animating flag
    setIsAnimating(true);

    // Trigger the callback to toggle like state
    onToggleLike();

    // Provide haptic feedback
    Haptics.impactAsync(
      isLiked
        ? Haptics.ImpactFeedbackStyle.Light // Feedback for unliking
        : Haptics.ImpactFeedbackStyle.Medium // Feedback for liking
    );

    // Animate the heart
    RNAnimated.sequence([
      // Scale up
      RNAnimated.spring(heartScale, {
        toValue: 1.3,
        useNativeDriver: true,
        speed: 300,
        bounciness: 12,
      }),
      // Scale back down
      RNAnimated.spring(heartScale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 300,
        bounciness: 12,
      }),
    ]).start(() => {
      requestAnimationFrame(() => {
        setIsAnimating(false);
        console.log("HeartButton - Animation completed");
      });
    });
  };

  return (
    <Pressable
      style={[styles.button, { zIndex: 10 }]} // Added zIndex to ensure button is clickable
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

const MainPage = ({ navigation, route }: MainPageProps) => {
  const screenHeight = Dimensions.get("window").height;
  const screenWidth = Dimensions.get("window").width;

  // RNAnimated values for various interactions
  const pan = useRef(new RNAnimated.ValueXY()).current;
  const fadeAnim = useRef(new RNAnimated.Value(1)).current;
  const buttonsTranslateX = useRef(new RNAnimated.Value(0)).current;
  const sizesTranslateX = useRef(new RNAnimated.Value(-screenWidth)).current;
  const imageHeightPercent = useRef(new RNAnimated.Value(100)).current;

  // Page fade-in animation
  const pageOpacity = useRef(new RNAnimated.Value(1)).current;

  // Add refresh animation state
  const refreshAnim = useRef(new RNAnimated.Value(1)).current;
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Heart animation value
  const heartScale = useRef(new RNAnimated.Value(1)).current;
  const longPressScale = useRef(new RNAnimated.Value(1)).current;

  // Animation controller references to allow cancellation
  const heartAnimationRef = useRef<RNAnimated.CompositeAnimation | null>(null);
  const longPressAnimationRef = useRef<RNAnimated.CompositeAnimation | null>(
    null
  );

  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const isAnimatingRef = useRef(false);
  const isRefreshingRef = useRef(false);
  const [showSizeSelection, setShowSizeSelection] = useState(false);

  // Update refs when state changes
  useEffect(() => {
    isAnimatingRef.current = isAnimating;
  }, [isAnimating]);

  useEffect(() => {
    isRefreshingRef.current = isRefreshing;
  }, [isRefreshing]);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [userSelectedSize, setUserSelectedSize] = useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Animation state for buttons
  const cartButtonScale = useRef(new RNAnimated.Value(1)).current;
  const seenButtonScale = useRef(new RNAnimated.Value(1)).current;

  // Flip card state
  const [isFlipped, setIsFlipped] = useState(false);
  const flipAnimation = useRef(new RNAnimated.Value(0)).current;

  // Scroll position tracking for card back
  const scrollViewRef = useRef<ScrollView>(null);
  const imageScrollViewRef = useRef<ScrollView>(null);
  const imageCarouselWidthRef = useRef(0);
  const [imageCarouselWidth, setImageCarouselWidth] = useState(0);
  const isFlippedRef = useRef(false);

  // Update ref when state changes
  useEffect(() => {
    isFlippedRef.current = isFlipped;
  }, [isFlipped]);

  const handleFlip = useCallback(() => {
    console.log("handleFlip called");
    RNAnimated.timing(flipAnimation, {
      toValue: isFlipped ? 0 : 180,
      duration: ANIMATION_DURATIONS.EXTENDED,
      useNativeDriver: true,
      easing: ANIMATION_EASING.CUBIC,
    }).start();
    setIsFlipped((prev) => !prev);
  }, [isFlipped, flipAnimation]);

  // Initialize cards state with a callback to avoid unnecessary updates
  const [cards, setCards] = useState<CardItem[]>([]);
  const [isLoadingInitialCards, setIsLoadingInitialCards] = useState(true);

  // Fetch user's selected size from profile and initialize swipe count
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const userProfile = await apiWrapper.getCurrentUser("MainPage");
        if (userProfile) {
          setUserSelectedSize(userProfile.profile?.selected_size || null);
          console.log(
            "MainPage - User selected size:",
            userProfile.profile?.selected_size
          );
        }

        // Initialize swipe count from API
        await api.initializeSwipeCount();
        console.log("MainPage - Swipe count initialized from API");
      } catch (error) {
        console.error("Error fetching user data:", error);
        setUserSelectedSize(null);
      }
    };

    fetchUserData();
  }, []);

  useEffect(() => {
    let isMounted = true;
    const loadInitialCards = async () => {
      setIsLoadingInitialCards(true);
      const starterCards = await fetchMoreCards(MIN_CARDS_THRESHOLD + 1);
      if (isMounted) {
        console.log(
          "MainPage - Setting initial cards:",
          starterCards.length,
          "cards"
        );
        console.log("MainPage - First card ID:", starterCards[0]?.id);
        setCards(starterCards);
        persistentCardStorage.cards = starterCards;
        persistentCardStorage.initialized = true;
        setIsLoadingInitialCards(false);
      }
    };
    if (!persistentCardStorage.initialized) {
      loadInitialCards();
    } else {
      console.log(
        "MainPage - Loading from persistent storage:",
        persistentCardStorage.cards.length,
        "cards"
      );
      console.log(
        "MainPage - First persistent card ID:",
        persistentCardStorage.cards[0]?.id
      );
      setCards(persistentCardStorage.cards);
      setIsLoadingInitialCards(false);
    }
    return () => {
      isMounted = false;
    };
  }, []);

  // Swipe threshold (how far the card needs to be dragged to trigger a swipe)
  const SWIPE_THRESHOLD = screenHeight * 0.1; // 10% of screen height

  // Track swipe for analytics with optimistic updates
  const trackSwipe = async (productId: string, direction: "up" | "right") => {
    console.log("MainPage - trackSwipe called with:", { productId, direction });

    if (!productId) {
      console.error("MainPage - Cannot track swipe: productId is missing");
      return;
    }

    try {
      // Convert direction to API format
      const swipeDirection = direction === "up" ? "right" : "left";

      // Use optimistic tracking with rollback
      const result = await api.trackSwipeWithOptimisticUpdate({
        product_id: productId,
        swipe_direction: swipeDirection,
      });

      if (result.success) {
        console.log(
          `MainPage - Swipe tracked successfully: ${productId} - ${swipeDirection}, new count: ${result.newCount}`
        );
      } else {
        console.log(
          `MainPage - Swipe tracking failed, rolled back to count: ${result.newCount}`
        );
      }
    } catch (error) {
      console.error("MainPage - Error tracking swipe:", error);
      // Don't show error to user, just log it
    }
  };

  // Add a text fade animation function
  const animateTextChange = () => {
    // First fade out
    RNAnimated.timing(fadeAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
      easing: Easing.out(Easing.ease),
    }).start(() => {
      // Then fade back in
      RNAnimated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
        easing: Easing.in(Easing.ease),
      }).start();
    });
  };

  // Add an effect to animate text changes when the current card index changes
  useEffect(() => {
    if (cards.length > 0) {
      animateTextChange();
    }
  }, [currentCardIndex]);

  // Reset image index when card changes
  useEffect(() => {
    setCurrentImageIndex(0);
    if (imageScrollViewRef.current && imageCarouselWidth > 0) {
      // Small delay to ensure ScrollView is laid out
      setTimeout(() => {
        imageScrollViewRef.current?.scrollTo({
          x: 0,
          animated: false,
        });
      }, 0);
    }
  }, [currentCardIndex, imageCarouselWidth]);

  // Ref to store cards for pan responder access
  const cardsRef = useRef<CardItem[]>([]);
  const currentCardIndexRef = useRef(0);

  // Update refs when state changes
  useEffect(() => {
    cardsRef.current = cards;
  }, [cards]);

  useEffect(() => {
    currentCardIndexRef.current = currentCardIndex;
  }, [currentCardIndex]);

  // Ref to track current image index to avoid unnecessary state updates
  const currentImageIndexRef = useRef(0);

  useEffect(() => {
    currentImageIndexRef.current = currentImageIndex;
  }, [currentImageIndex]);

  // Handle image carousel scroll events - only update index when scrolling stops
  const handleImageScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const flipped = isFlippedRef.current;
      if (flipped || !imageCarouselWidthRef.current) {
        return;
      }

      const contentOffsetX = event.nativeEvent.contentOffset.x;
      const currentIndex = Math.round(
        contentOffsetX / imageCarouselWidthRef.current
      );

      if (currentIndex >= 0) {
        const currentCards = cardsRef.current;
        const cardIndex = currentCardIndexRef.current;
        const currentCard = currentCards[cardIndex];

        // Only update if index changed and is valid
        if (
          currentCard &&
          currentIndex < currentCard.images.length &&
          currentIndex !== currentImageIndexRef.current
        ) {
          setCurrentImageIndex(currentIndex);
        }
      }
    },
    []
  );

  // Scroll to specific image index
  const scrollToImageIndex = useCallback((index: number) => {
    if (imageScrollViewRef.current && imageCarouselWidthRef.current) {
      imageScrollViewRef.current.scrollTo({
        x: index * imageCarouselWidthRef.current,
        animated: true,
      });
    }
  }, []);

  // Pan responder for header area when card is flipped
  const headerPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false, // Don't capture on start
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        const flipped = isFlippedRef.current;
        const animating = isAnimatingRef.current;
        const refreshing = isRefreshingRef.current;

        // Don't capture if not flipped, animating, or refreshing
        if (!flipped || animating || refreshing) {
          return false;
        }

        // Check if touch is in the cancel button area - if so, don't capture
        // Cancel button is positioned absolutely at right: 25, top: 25
        // cardBackContainer has padding: 20, so button is at:
        // - X: from right edge of card (88% width, centered) minus 20px padding minus 25px = cardRight - 45
        // - Y: from top edge plus 20px padding plus 25px = 45
        const { pageX, pageY } = evt.nativeEvent;
        const windowWidth = Dimensions.get("window").width;
        const cardWidth = windowWidth * 0.88; // Card width is 88% of screen
        const cardLeft = windowWidth * 0.06; // Card is centered (6% margin on each side)
        const cardRight = cardLeft + cardWidth;

        const cancelButtonRight = cardRight - 45; // cardRight - padding(20) - right(25)
        const cancelButtonLeft = cancelButtonRight - 25; // Button width is 25
        const cancelButtonTop = 45; // padding(20) + top(25)
        const cancelButtonBottom = cancelButtonTop + 25; // Button height is 25

        // Check if touch is in cancel button area (add padding for easier tapping)
        const touchPadding = 15;
        if (
          pageX >= cancelButtonLeft - touchPadding &&
          pageX <= cancelButtonRight + touchPadding &&
          pageY >= cancelButtonTop - touchPadding &&
          pageY <= cancelButtonBottom + touchPadding
        ) {
          return false; // Don't capture - let the button handle it
        }

        // Only capture if movement is significant
        return Math.abs(gestureState.dy) > 5;
      },
      onPanResponderMove: (_, gestureState) => {
        // Only allow upward movement (negative dy values)
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
    })
  ).current;

  // Enhance the panResponder to be even more robust
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Use refs to get current values
        const flipped = isFlippedRef.current;
        const animating = isAnimatingRef.current;
        const refreshing = isRefreshingRef.current;

        // Disable when flipped - header pan responder handles header area
        if (flipped) return false;

        // Only allow swiping when not flipped (original behavior)
        return !animating && !refreshing && Math.abs(gestureState.dy) > 5;
      },
      onPanResponderMove: (_, gestureState) => {
        // Only allow upward movement (negative dy values)
        if (gestureState.dy <= 0) {
          // Directly set the Y value instead of using event
          pan.setValue({ x: 0, y: gestureState.dy });
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        // Use refs to get current values
        const animating = isAnimatingRef.current;
        const refreshing = isRefreshingRef.current;

        // If already animating or refreshing, just reset position
        if (animating || refreshing) {
          RNAnimated.spring(pan, {
            toValue: { x: 0, y: 0 },
            friction: 5,
            useNativeDriver: false,
          }).start();
          return;
        }

        // Check if drag exceeds threshold
        if (gestureState.dy < -SWIPE_THRESHOLD) {
          // Swipe up - get fresh state values
          console.log(
            "MainPage - Gesture handler - cards length:",
            cards.length
          );
          console.log(
            "MainPage - Gesture handler - currentCardIndex:",
            currentCardIndex
          );
          console.log(
            "MainPage - Gesture handler - cards:",
            cards.map((c) => ({ id: c.id, name: c.name }))
          );

          // Use a callback to get the most current state
          setCards((currentCards) => {
            const currentCard = currentCards[currentCardIndex];
            console.log(
              "MainPage - Gesture handler - current card from callback:",
              currentCard
            );
            if (currentCard) {
              swipeCard("up", currentCard);
            } else {
              console.error(
                "MainPage - Gesture handler - no card found at index:",
                currentCardIndex
              );
            }
            return currentCards; // Don't modify the cards, just get the current state
          });
        } else {
          // Return card to original position
          RNAnimated.spring(pan, {
            toValue: { x: 0, y: 0 },
            friction: 5,
            useNativeDriver: false,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        // If the gesture is terminated for any reason, reset position
        RNAnimated.spring(pan, {
          toValue: { x: 0, y: 0 },
          friction: 5,
          useNativeDriver: false,
        }).start();
      },
    })
  ).current;

  const fadeOutIn = useCallback(() => {
    // Cancel any ongoing fade animations first
    fadeAnim.stopAnimation();

    // Reset the opacity to ensure we start from a known state
    fadeAnim.setValue(1);

    // Use sequence for more reliable animation
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
    ]).start((finished) => {
      // If the animation was interrupted, ensure we end with full opacity
      if (!finished.finished) {
        requestAnimationFrame(() => {
          fadeAnim.setValue(1);
        });
      }
    });
  }, [fadeAnim]);

  // Clean up any ongoing animations
  const cleanupHeartAnimations = () => {
    if (heartAnimationRef.current) {
      heartAnimationRef.current.stop();
      heartAnimationRef.current = null;
    }

    if (longPressAnimationRef.current) {
      longPressAnimationRef.current.stop();
      longPressAnimationRef.current = null;
    }

    // Reset animation values to prevent visual glitches
    heartScale.setValue(1);
    longPressScale.setValue(1);
  };

  // Toggle like status directly with proper boolean handling
  const toggleLike = useCallback(
    (index: number) => {
      console.log(`toggleLike - Called with index: ${index}`);

      if (index < 0 || index >= cards.length) {
        console.log(
          `toggleLike - Invalid index: ${index}, cards length: ${cards.length}`
        );
        return;
      }

      const card = cards[index];
      const currentLikedStatus = card.isLiked === true;
      const newLikedStatus = !currentLikedStatus;

      console.log(
        `toggleLike - Card ${card.id} toggling from ${currentLikedStatus} to ${newLikedStatus}`
      );

      // Create a completely new array to ensure state change is detected
      const newCards = [...cards];
      newCards[index] = {
        ...card,
        isLiked: newLikedStatus,
      };

      // Log before and after
      console.log(
        `toggleLike - Before update: ${cards[index].isLiked}, After update will be: ${newCards[index].isLiked}`
      );

      // Update state with new array
      setCards(newCards);

      // Update persistent storage
      persistentCardStorage.cards = newCards;

      // Simulate API call
      toggleLikeApi(card.id, newLikedStatus).then((success) => {
        if (success) {
          console.log(
            `toggleLike - Updated card ${card.id} like status to: ${newLikedStatus}`
          );
        } else {
          console.error(
            `toggleLike - Failed to update card ${card.id} like status to: ${newLikedStatus}`
          );
          // Optionally revert the state if API call fails
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
    [cards]
  );

  const handleLongPress = useCallback(
    (index: number) => {
      console.log(`handleLongPress - Long press on card ${index}`);
      if (index < 0 || index >= cards.length) return;

      // Toggle the like status
      toggleLike(index);

      // Provide haptic feedback,
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    [cards, toggleLike]
  );

  // Clean up animations when component unmounts or changes
  useEffect(() => {
    return () => {
      cleanupHeartAnimations();
    };
  }, []);

  const swipeCard = (
    direction: "up" | "right" = "up",
    cardToSwipe?: CardItem
  ) => {
    if (isAnimating) return;

    // Use the passed card or fall back to getting it from state
    const currentCard = cardToSwipe || cards[currentCardIndex];
    console.log("MainPage - Current card object:", currentCard);
    console.log("MainPage - Current card ID:", currentCard?.id);
    console.log("MainPage - Cards array length at start:", cards.length);
    console.log("MainPage - Current card index:", currentCardIndex);
    console.log(
      "MainPage - Cards array:",
      cards.map((c) => ({ id: c.id, name: c.name }))
    );
    console.log("MainPage - Card passed to function:", cardToSwipe);

    // Prevent swiping loading cards
    if (currentCard?.id === LOADING_CARD_ID) {
      return;
    }

    // Only block swipe if there is truly only one real card left (excluding loading card)
    const realCards = cards.filter((c) => c.id !== LOADING_CARD_ID);
    if (realCards.length === 1) {
      console.log(
        "MainPage - Preventing swipe of last card until more are loaded"
      );
      // Show a quick bounce animation to indicate swipe is not allowed
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
      // Trigger card refresh instead of swiping
      if (!isRefreshing) {
        refreshCards();
      }
      // Provide haptic feedback to indicate action is restricted
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    setIsAnimating(true);
    // Provide haptic feedback on swipe
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Set a timeout that will reset animation state if something goes wrong
    const animationSafetyTimeout = setTimeout(() => {
      console.log("MainPage - Animation safety timeout triggered");
      setIsAnimating(false);
      pan.setValue({ x: 0, y: 0 });
    }, 300); // 300ms safety timeout (animation is 100ms)
    // Animate card moving off screen
    RNAnimated.timing(pan, {
      toValue: {
        x: direction === "right" ? screenWidth : 0,
        y: -screenHeight,
      },
      duration: 100,
      easing: Easing.ease,
      useNativeDriver: false,
    }).start(() => {
      // Clear the safety timeout since animation completed
      clearTimeout(animationSafetyTimeout);
      // Allow new swipes immediately after the swipe animation completes
      // The spring animation below is just for cleanup and shouldn't block
      setIsAnimating(false);
      // Remove the current card from the array
      setCards((prevCards) => {
        console.log(
          "MainPage - setCards callback - prevCards length:",
          prevCards.length
        );
        console.log(
          "MainPage - setCards callback - currentCardIndex:",
          currentCardIndex
        );
        console.log(
          "MainPage - setCards callback - prevCards:",
          prevCards.map((c) => ({ id: c.id, name: c.name }))
        );

        if (prevCards.length === 0) {
          console.log(
            "MainPage - setCards callback - prevCards is empty, returning empty array"
          );
          return [];
        }
        const newCards = [...prevCards];
        if (newCards.length > 0) {
          console.log(
            "MainPage - setCards callback - removing card at index:",
            currentCardIndex
          );
          newCards.splice(currentCardIndex, 1);
        }
        // Log removed card info
        console.log(
          `MainPage - Card ${currentCard?.id} was swiped ${direction}`
        );
        console.log("MainPage - Remaining cards:", newCards.length);

        // Update persistent storage to match local state
        persistentCardStorage.cards = newCards;

        // Track swipe for analytics
        console.log("MainPage - Tracking swipe for card:", currentCard);
        if (currentCard?.id) {
          trackSwipe(currentCard.id, direction);
        } else {
          console.error(
            "MainPage - Cannot track swipe: currentCard.id is missing"
          );
        }
        // Reset current index if needed
        const newIndex =
          currentCardIndex >= newCards.length
            ? Math.max(0, newCards.length - 1)
            : currentCardIndex;
        setTimeout(() => setCurrentCardIndex(newIndex), 0);
        // Add loading card if running low on cards
        const cardsWithoutLoading = newCards.filter(
          (c) => c.id !== LOADING_CARD_ID
        );
        if (cardsWithoutLoading.length < MIN_CARDS_THRESHOLD) {
          // Add loading card if not already present
          const hasLoadingCard = newCards.some((c) => c.id === LOADING_CARD_ID);
          if (!hasLoadingCard) {
            newCards.push(createLoadingCard());
          }
          // Trigger fetch in background
          console.log("MainPage - Low on cards, fetching more from API");
          fetchMoreCards(
            MIN_CARDS_THRESHOLD - cardsWithoutLoading.length + 1
          ).then((apiCards) => {
            if (apiCards.length > 0) {
              setCards((latestCards) => {
                // Remove loading cards and add new ones
                const filteredCards = latestCards.filter(
                  (c) => c.id !== LOADING_CARD_ID
                );
                const updatedCards = [...filteredCards, ...apiCards];
                console.log(
                  "MainPage - Added new cards, total count:",
                  updatedCards.length
                );
                persistentCardStorage.cards = updatedCards;
                return updatedCards;
              });
            }
          });
        } else {
          persistentCardStorage.cards = newCards;
        }
        return newCards;
      });

      flipAnimation.setValue(0);
      setIsFlipped(false);
      resetToButtons();
      // Reset pan position
      pan.setValue({ x: 0, y: screenHeight });
      // Animate card back to original position
      RNAnimated.spring(pan, {
        toValue: { x: 0, y: 0 },
        friction: 6,
        tension: 40,
        useNativeDriver: false,
      }).start();
      // Note: setIsAnimating(false) is now called earlier, right after the swipe animation completes
    });

    fadeOutIn();
  };

  // Handle cart button press-in animation
  const handleCartPressIn = () => {
    RNAnimated.timing(cartButtonScale, {
      toValue: 0.85,
      duration: 80,
      useNativeDriver: true,
      easing: Easing.inOut(Easing.ease),
    }).start();
  };

  // Handle cart button press-out animation
  const handleCartPressOut = () => {
    RNAnimated.timing(cartButtonScale, {
      toValue: 1,
      duration: 150,
      useNativeDriver: true,
      easing: Easing.inOut(Easing.ease),
    }).start();

    // Call the actual press handler
    handleCartPress();
  };

  // Handle seen button press-in animation
  const handleSeenPressIn = () => {
    RNAnimated.timing(seenButtonScale, {
      toValue: 0.85,
      duration: 80,
      useNativeDriver: true,
      easing: Easing.inOut(Easing.ease),
    }).start();
  };

  // Handle seen button press-out animation
  const handleSeenPressOut = () => {
    RNAnimated.timing(seenButtonScale, {
      toValue: 1,
      duration: 150,
      useNativeDriver: true,
      easing: Easing.inOut(Easing.ease),
    }).start();

    // Call the actual press handler
    swipeCard("up");
  };

  const handleCartPress = () => {
    // Animate buttons out and size selection in
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
        toValue: 90, // Shrink to 75% height
        duration: 300,
        easing: Easing.ease,
        useNativeDriver: false, // Must be false for percentage changes
      }),
    ]).start(() => {
      requestAnimationFrame(() => {
        setShowSizeSelection(true);
      });
    });
  };

  const handleCancelSizeSelection = () => {
    // Animate back to buttons
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

  // Function to reset UI from size selection back to buttons
  const resetToButtons = () => {
    buttonsTranslateX.setValue(0);
    sizesTranslateX.setValue(-screenWidth);
    imageHeightPercent.setValue(100);
    setShowSizeSelection(false);
  };

  const handleSizeSelect = (size: string) => {
    const currentCard = cards[currentCardIndex];

    // Check if the size is available for this product
    const selectedVariant = currentCard?.variants?.find((v) => v.size === size);
    if (!selectedVariant || selectedVariant.stock_quantity === 0) {
      console.log("MainPage - Size not available:", size);
      // Provide haptic feedback for unavailable sizes
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return;
    }

    // Add the current card with selected size to cart
    // Spread the current card to preserve all fields including article_number
    const cartItem: CartItem = {
      ...currentCard, // Spread all fields to preserve article_number and other optional fields
      size: size,
      quantity: 1,
      delivery: { cost: 0, estimatedTime: "" }, // Add dummy delivery info for now, Cart.tsx will update it
    };

    // Add item to the cart using global storage
    if (typeof global.cartStorage !== "undefined") {
      console.log("MainPage - Adding item to cart:", cartItem);
      global.cartStorage.addItem(cartItem);

      // Provide haptic feedback on successful add
      if (Platform.OS === "ios") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      // Display selected size as feedback
      console.log("Selected size:", size, "for item:", currentCard.name);

      // Reset UI to show buttons again
      resetToButtons();

      // Navigate to cart after adding
      console.log("MainPage - Navigating to Cart screen after adding item");
      navigation.navigate("Cart");
    } else {
      console.log("MainPage - Cart storage not initialized");
    }
  };

  // Enhance the renderEmptyState function to include text placeholders
  const renderEmptyState = () => {
    return (
      <View style={[styles.whiteBox, styles.noCardsContainer]}>
        <Text style={styles.noCardsText}>Загрузка новых карточек...</Text>
        <Text style={styles.noCardsSubtext}>Пожалуйста, подождите</Text>
      </View>
    );
  };

  // Add a safeguard effect to ensure currentCardIndex stays valid
  useEffect(() => {
    if (currentCardIndex >= cards.length && cards.length > 0) {
      console.log("MainPage - Fixing out of bounds currentCardIndex");
      setCurrentCardIndex(0);
    }
  }, [cards, currentCardIndex]);

  // Render function for the front of the card
  const renderFrontOfCard = useCallback(
    (card: CardItem, index: number) => {
      // Handle loading card
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
                    // Use the measured width from state, or fallback to calculated width
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
              ) : (
                <View style={styles.imagePressable}>
                  <Image
                    key={card.id + "-" + currentImageIndex}
                    source={card.images[0]}
                    style={styles.image}
                    resizeMode="contain"
                  />
                </View>
              )}
            </RNAnimated.View>
            <Pressable style={styles.dotsButton} onPress={handleFlip}>
              <More width={23} height={33} />
            </Pressable>
          </View>

          {/* Image Navigation Dots */}
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

          {/* Buttons Container */}
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

            {/* Use HeartButton with explicit index */}
            <View style={{ zIndex: 999 }}>
              <HeartButton
                isLiked={isLiked}
                onToggleLike={() => toggleLike(index)}
              />
            </View>

            {/* Add long press overlay for the heart */}
            <Pressable
              style={[
                styles.longPressOverlay,
                { position: "absolute", right: 0, zIndex: 998 },
              ]}
              onLongPress={() => handleLongPress(index)}
              delayLongPress={300}
            />
          </RNAnimated.View>

          {/* Size Selection Circles */}
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
              // Single size layout - centered relative to full card width
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
                            Haptics.ImpactFeedbackStyle.Light
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
              // Multiple sizes layout - cancel acts as another size
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
                            Haptics.ImpactFeedbackStyle.Light
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
      handleFlip, // Added handleFlip
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
      setCurrentImageIndex,
      userSelectedSize,
      handleSizeSelect,
      handleCancelSizeSelection,
      cards, // Added cards to ensure card data is up-to-date
      imageScrollViewRef,
    ]
  );

  // Render function for the back of the card
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
            <Image
              source={card.images[0]}
              style={styles.cardBackImage}
              resizeMode="contain"
            />
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
    [handleFlip]
  );

  // Adjust the renderCard function to add safeguards
  const renderCard = useCallback(
    (card: CardItem, index: number) => {
      // Safety check - if card is undefined, don't render
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

      // Interpolate pointerEvents based on flip state
      const frontPointerEvents = isFlipped ? "none" : "auto";
      const backPointerEvents = isFlipped ? "auto" : "none";

      // Determine zIndex based on flip state
      const frontZIndex = isFlipped ? 1 : 2; // Front is on top when not flipped
      const backZIndex = isFlipped ? 2 : 1; // Back is on top when flipped

      return (
        <RNAnimated.View
          {...panResponder.panHandlers}
          style={[
            styles.whiteBox,
            {
              transform: [{ translateX: pan.x }, { translateY: pan.y }],
              opacity: refreshAnim,
              backgroundColor: "transparent", // Important for flip effect
              shadowColor: "transparent", // Hide shadow from container
              elevation: 0, // Hide elevation from container
            },
          ]}
        >
          {/* Front Face */}
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

          {/* Back Face */}
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
    ]
  );

  // Function to refresh cards with a subtle animation
  const refreshCards = useCallback(async () => {
    if (isRefreshing) return; // Prevent multiple refreshes at once

    console.log("MainPage - Refreshing recommended cards");
    setIsRefreshing(true);

    // Play a subtle fade animation
    RNAnimated.sequence([
      // Fade out slightly
      RNAnimated.timing(refreshAnim, {
        toValue: 0.7,
        duration: 200,
        useNativeDriver: false,
        easing: Easing.out(Easing.ease),
      }),
      // Fade back in
      RNAnimated.timing(refreshAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
        easing: Easing.inOut(Easing.ease),
      }),
    ]).start();

    try {
      // Fetch new cards from "API"
      const newCards = await fetchMoreCards(2);

      // Wait for a short moment to make the refresh feel more natural
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Update cards with the new ones at the beginning
      setCards((prevCards) => {
        const updatedCards = [...newCards, ...prevCards.slice(0, 3)];
        console.log(
          "MainPage - Cards refreshed, new count:",
          updatedCards.length
        );

        // Update persistent storage
        persistentCardStorage.cards = updatedCards;
        return updatedCards;
      });

      // Reset current card index to show the first new card
      setCurrentCardIndex(0);

      // Provide haptic feedback
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) {
      console.error("Error refreshing cards:", error);
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing]);

  // Move route params handling to a separate effect
  useEffect(() => {
    if (route?.params?.addCardItem) {
      const newCard = route.params.addCardItem;
      setCards((prevCards) => {
        const updatedCards = [newCard, ...prevCards];
        persistentCardStorage.cards = updatedCards;
        return updatedCards;
      });
      navigation.setParams?.({ addCardItem: undefined });
    }
  }, [route?.params?.addCardItem, navigation]);

  // Handle refresh request in a separate effect
  useEffect(() => {
    if (route?.params?.refreshCards && route?.params?.refreshTimestamp) {
      refreshCards();
      setTimeout(() => {
        navigation.setParams?.({
          refreshCards: undefined,
          refreshTimestamp: undefined,
        });
      }, 100);
    }
  }, [route?.params?.refreshTimestamp, refreshCards, navigation]);

  // Update persistent storage in a separate effect
  useEffect(() => {
    persistentCardStorage.cards = cards;
  }, [cards]);

  // Add a safeguard effect to ensure currentCardIndex stays valid
  useEffect(() => {
    if (currentCardIndex >= cards.length && cards.length > 0) {
      setCurrentCardIndex(0);
    }
  }, [cards, currentCardIndex]);

  // Add a safeguard effect to ensure currentCardIndex stays valid
  useEffect(() => {
    let fetchTimer: NodeJS.Timeout;

    const cardsWithoutLoading = cards.filter((c) => c.id !== LOADING_CARD_ID);
    if (cardsWithoutLoading.length < MIN_CARDS_THRESHOLD && !isRefreshing) {
      fetchTimer = setTimeout(() => {
        fetchMoreCards(MIN_CARDS_THRESHOLD - cardsWithoutLoading.length + 1)
          .then((apiCards) => {
            if (apiCards.length > 0) {
              setCards((prevCards) => {
                // Remove loading cards and add new ones
                const filteredCards = prevCards.filter(
                  (c) => c.id !== LOADING_CARD_ID
                );
                if (filteredCards.length >= MIN_CARDS_THRESHOLD) {
                  return prevCards;
                }

                const updatedCards = [...filteredCards, ...apiCards];
                persistentCardStorage.cards = updatedCards;
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
  }, [cards.length, isRefreshing]);

  // Fade in the entire page when component mounts
  useEffect(() => {
    // Start with opacity 0 and fade in to 1
    pageOpacity.setValue(0);
    RNAnimated.timing(pageOpacity, {
      toValue: 1,
      duration: ANIMATION_DURATIONS.MEDIUM,
      useNativeDriver: true,
      easing: ANIMATION_EASING.SMOOTH,
    }).start();
  }, []);

  if (isLoadingInitialCards) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text>Загрузка...</Text>
      </View>
    );
  }

  return (
    <RNAnimated.View
      style={{ opacity: pageOpacity, width: "100%", height: "100%" }}
    >
      <Animated.View
        style={[styles.container]}
        entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
          ANIMATION_DELAYS.LARGE
        )}
        exiting={FadeOutDown.duration(ANIMATION_DURATIONS.MICRO)}
      >
        <View style={styles.roundedBox}>
          <LinearGradient
            colors={["rgba(205, 166, 122, 0.5)", "transparent"]}
            start={{ x: 0.1, y: 1 }}
            end={{ x: 0.9, y: 0.3 }}
            locations={[0.2, 1]}
            style={styles.gradientBackground}
          />

          {/* Always show something, even during transitions */}
          {cards.length > 0
            ? renderCard(cards[currentCardIndex], currentCardIndex)
            : renderEmptyState()}

          {/* Always show text, with placeholder if no cards */}
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
    </RNAnimated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    //paddingBottom: '12%', // To prevent overlap with the navbar
  },
  gradientBackground: {
    borderRadius: 37,
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  roundedBox: {
    width: "88%",
    height: "90%",
    borderRadius: 41,
    backgroundColor: "rgba(205, 166, 122, 0)", // #CDA67A with 40% opacity
    position: "relative",
    //justifyContent: 'center',
    //alignItems: 'center',
    //overflow: 'hidden',
    borderWidth: 3,
    borderColor: "rgba(205, 166, 122, 0.4)",
    zIndex: 900,
  },
  whiteBox: {
    width: "102%",
    height: "82%",
    borderRadius: 41,
    // backgroundColor: '#F2ECE7', // White background - moved to cardFace
    position: "absolute",
    top: -3,
    left: -3,
    // Shadow properties - moved to cardFace
    // shadowColor: '#000',
    // shadowOffset: {
    //   width: 0.25,
    //   height: 4,
    // },
    // shadowOpacity: 0.5,
    // shadowRadius: 4,
    // elevation: 10,
    // justifyContent: 'center', // Center content vertically - moved to cardFace
    // alignItems: 'center', // Center content horizontally - moved to cardFace
    zIndex: 1000 - 7,
  },
  cardFace: {
    width: "100%",
    height: "100%",
    borderRadius: 41,
    backgroundColor: "#F2ECE7", // White background
    shadowColor: "#000", // Shadow color
    shadowOffset: {
      width: 0.25,
      height: 4, // Vertical offset
    },
    shadowOpacity: 0.5, // Shadow opacity
    shadowRadius: 4, // Shadow blur
    elevation: 10, // For Android shadow
    justifyContent: "center", // Center content vertically
    alignItems: "center", // Center content horizontally
  },
  overlayLabelContainer: {
    width: "102%",
    height: "82%",
    borderRadius: 41,
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
    marginBottom: 5, // Space between image and buttons
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
    top: -15, // Adjust as needed
    right: -22.5, // Adjust as needed
    padding: 5,
    //backgroundColor: 'rgba(255, 255, 255, 0.7)', // Semi-transparent background
    borderRadius: 5,
  },
  dotsImage: {
    width: 23, // Adjust size as needed
    height: 33, // Adjust size as needed
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "110%",
    marginBottom: -60,
    //paddingBottom: 0, // Padding for the buttons
  },
  button: {
    padding: 5,
    //backgroundColor: '#E0E0E0', // Button background color
    //borderRadius: 5,
  },
  icon: {
    width: 33,
    height: 33,
    resizeMode: "contain", // Ensure the image scales properly
  },
  text: {
    top: Platform.OS == "android" ? "82.5%" : "85%",
    width: "100%",
    paddingHorizontal: 18,
  },
  name: {
    fontFamily: "IgraSans", // Use the Igra Sans font
    fontSize: 38,
    textAlign: "left",
    color: "white",
    //marginVertical: 5, // Space around the name
  },
  brandName: {
    fontFamily: "IgraSans", // Use the Igra Sans font
    fontSize: 38,
    textAlign: "left",
    color: "white",
  },
  price: {
    fontFamily: "REM", // Use the REM font
    fontSize: 16,
    textAlign: "left",
    color: "white",
    //marginBottom: 10, // Space below the price
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
    backgroundColor: "#E2CCB2", // Available sizes
  },
  sizeCircleUnavailable: {
    backgroundColor: "#BFBBB8", // Unavailable sizes
  },
  sizeCircleUserSize: {
    backgroundColor: "#CDA67A", // Highlight user's selected size
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
  // New styles for card back and expandable sections
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
    zIndex: 1000, // Ensure button is above other elements including pan handlers
    elevation: 10, // For Android
  },
  cardBackHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    width: "100%",
    justifyContent: "flex-start",
    paddingRight: 50, // Added to prevent overlap with the button
  },
  cardBackImage: {
    width: 80,
    height: 80,
    marginRight: 10,
    borderRadius: 10,
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
  cancelButtonRedBackground: {
    backgroundColor: "rgba(230, 109, 123, 0.54)",
    borderRadius: 5, // Make it circular
    padding: 0,
  },
});

export default MainPage;
