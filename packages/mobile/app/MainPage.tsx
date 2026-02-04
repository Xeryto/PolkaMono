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
  Share,
  Linking,
} from "react-native";
import { TouchableOpacity } from "react-native-gesture-handler";
import * as Clipboard from "expo-clipboard";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Animated, {
  FadeInDown,
  FadeOutDown,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
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
import Link from "./components/svg/Link";
import LinkPressed from "./components/svg/LinkPressed";
import ShareIcon from "./components/svg/Share";
import * as api from "./services/api";
import { apiWrapper } from "./services/apiWrapper";
import fallbackImage from "./assets/Vision.png"; // Use as fallback for missing images
import vision2Image from "./assets/Vision2.png";
import { CardItem, CartItem } from "./types/product";
import {
  mapProductToCardItem,
  getCardItemForColorIndex,
} from "./lib/productMapper";
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

// Distance from card edges for corner overlays and content padding (unified)
const CARD_CORNER_INSET = 20;
// Inner white box size for all four corners (same top/side spacing)
const CORNER_BOX_SIZE = 52;
const CORNER_OVERLAY_SIZE = CARD_CORNER_INSET + CORNER_BOX_SIZE; // 72 – overlay extends to edge
// Back of card: less vertical padding for a tighter layout
const CARD_BACK_VERTICAL_INSET = 12;
const CARD_BACK_BOTTOM_INSET = 8;
const SIZE_PANEL_CLOSED_WIDTH = 52;

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
  color_variants: [],
  selected_color_index: 0,
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
        "fetchMoreCards - API did not return a valid array of products.",
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
  setLiked: boolean,
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
        : Haptics.ImpactFeedbackStyle.Medium, // Feedback for liking
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
  const imageHeightPercent = useRef(new RNAnimated.Value(100)).current; // Kept for refs; image is always full size

  // Page fade-in animation - removed, React Navigation handles screen transitions

  // Add refresh animation state
  const refreshAnim = useRef(new RNAnimated.Value(1)).current;
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Heart animation value
  const heartScale = useRef(new RNAnimated.Value(1)).current;
  const longPressScale = useRef(new RNAnimated.Value(1)).current;

  // Animation controller references to allow cancellation
  const heartAnimationRef = useRef<RNAnimated.CompositeAnimation | null>(null);
  const longPressAnimationRef = useRef<RNAnimated.CompositeAnimation | null>(
    null,
  );

  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const isAnimatingRef = useRef(false);
  const isRefreshingRef = useRef(false);
  const [showSizeSelection, setShowSizeSelection] = useState(false);
  const [showBackSizeSelection, setShowBackSizeSelection] = useState(false);

  // Reset to first card when component mounts to prevent showing old state
  useEffect(() => {
    setCurrentCardIndex(0);
    setCurrentImageIndex(0);
  }, []);

  // Handle deep linking for product URLs
  useEffect(() => {
    const handleDeepLink = async (url: string) => {
      try {
        // Parse URL: polka://product/{productId}
        const match = url.match(/polka:\/\/product\/(.+)/);
        if (match && match[1]) {
          const productId = match[1];
          console.log("MainPage - Deep link received for product:", productId);

          // Fetch product details
          try {
            const product = await api.getProductDetails(productId);
            const cardItem = mapProductToCardItem(product);

            // Add product to top of cards
            setCards((prevCards) => {
              // Remove any existing card with same ID to avoid duplicates
              const filteredCards = prevCards.filter(
                (c) => c.id !== cardItem.id,
              );
              const updatedCards = [cardItem, ...filteredCards];
              persistentCardStorage.cards = updatedCards;
              return updatedCards;
            });

            // Set as current card
            setCurrentCardIndex(0);
          } catch (error) {
            console.error(
              "MainPage - Error fetching product from deep link:",
              error,
            );
          }
        }
      } catch (error) {
        console.error("MainPage - Error handling deep link:", error);
      }
    };

    // Handle initial URL if app was opened via deep link
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink(url);
      }
    });

    // Listen for deep links while app is running
    const subscription = Linking.addEventListener("url", (event) => {
      handleDeepLink(event.url);
    });

    return () => {
      subscription.remove();
    };
  }, []);

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
  const [isLinkCopied, setIsLinkCopied] = useState(false);
  const [showLinkCopiedPopup, setShowLinkCopiedPopup] = useState(false);
  const [colorSelectorOpen, setColorSelectorOpen] = useState(false);
  const [dropdownContentHeight, setDropdownContentHeight] = useState(0);
  const colorDropdownHeight = useSharedValue(52); // closed = trigger height (matches other corners)
  const sizePanelWidth = useSharedValue(52); // closed = cart corner only; open = full width
  const backSizePanelWidth = useSharedValue(52); // back side: same grow animation

  // Animation state for buttons
  const cartButtonScale = useRef(new RNAnimated.Value(1)).current;
  const seenButtonScale = useRef(new RNAnimated.Value(1)).current;
  const linkButtonScale = useRef(new RNAnimated.Value(1)).current;
  const shareButtonScale = useRef(new RNAnimated.Value(1)).current;

  // Animation state for backside buttons
  const backCartButtonScale = useRef(new RNAnimated.Value(1)).current;
  const backLinkButtonScale = useRef(new RNAnimated.Value(1)).current;
  const backShareButtonScale = useRef(new RNAnimated.Value(1)).current;

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
    // Reset size selections when flipping
    if (isFlipped) {
      // Flipping back to front - reset backside size panel
      backSizePanelWidth.set(SIZE_PANEL_CLOSED_WIDTH);
      setShowBackSizeSelection(false);
    } else {
      // Flipping to back - reset front size selection
      buttonsTranslateX.setValue(0);
      sizesTranslateX.setValue(-screenWidth);
      imageHeightPercent.setValue(100);
      setShowSizeSelection(false);
    }
  }, [isFlipped, flipAnimation, screenWidth]);

  // Initialize cards state with a callback to avoid unnecessary updates
  const [cards, setCards] = useState<CardItem[]>([]);
  const [isLoadingInitialCards, setIsLoadingInitialCards] = useState(false); // Start as false for immediate render

  // Fetch user's selected size from profile and initialize swipe count
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const userProfile = await apiWrapper.getCurrentUser("MainPage");
        if (userProfile) {
          setUserSelectedSize(userProfile.profile?.selected_size || null);
          console.log(
            "MainPage - User selected size:",
            userProfile.profile?.selected_size,
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
          "cards",
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
        "cards",
      );
      console.log(
        "MainPage - First persistent card ID:",
        persistentCardStorage.cards[0]?.id,
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
          `MainPage - Swipe tracked successfully: ${productId} - ${swipeDirection}, new count: ${result.newCount}`,
        );
      } else {
        console.log(
          `MainPage - Swipe tracking failed, rolled back to count: ${result.newCount}`,
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
      setTimeout(() => {
        imageScrollViewRef.current?.scrollTo({
          x: 0,
          animated: false,
        });
      }, 0);
    }
  }, [currentCardIndex, imageCarouselWidth]);

  // Close color selector when card changes
  useEffect(() => {
    setColorSelectorOpen(false);
    setDropdownContentHeight(0);
    colorDropdownHeight.value = 52;
  }, [currentCardIndex]);

  // White corner: closed = trigger only; open = trigger + list (tight bottom, consistent gaps)
  const COLOR_CORNER_CLOSED_HEIGHT = 52;
  const COLOR_GAP = 6; // same between trigger↔first and between each option
  const COLOR_OPTION_HEIGHT = 32; // 26 circle + 3+3 padding
  const COLOR_DROPDOWN_ITEM_HEIGHT = COLOR_OPTION_HEIGHT + COLOR_GAP; // 38
  const COLOR_DROPDOWN_BOTTOM_PADDING = 8;
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
    [cards, currentCardIndex, imageCarouselWidth, closeColorSelector],
  );

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
        contentOffsetX / imageCarouselWidthRef.current,
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
    [],
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
        // Cancel button: right CARD_CORNER_INSET, top CARD_BACK_VERTICAL_INSET, 25x25
        const { pageX, pageY } = evt.nativeEvent;
        const windowWidth = Dimensions.get("window").width;
        const cardWidth = windowWidth * 0.88;
        const cardLeft = windowWidth * 0.06;
        const cardRight = cardLeft + cardWidth;
        const rightInset = 20; // CARD_CORNER_INSET
        const topInset = 12; // CARD_BACK_VERTICAL_INSET

        const cancelButtonRight = cardRight - rightInset - 25;
        const cancelButtonLeft = cancelButtonRight - 25;
        const cancelButtonTop = topInset;
        const cancelButtonBottom = cancelButtonTop + 25;

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
    }),
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
            cards.length,
          );
          console.log(
            "MainPage - Gesture handler - currentCardIndex:",
            currentCardIndex,
          );
          console.log(
            "MainPage - Gesture handler - cards:",
            cards.map((c) => ({ id: c.id, name: c.name })),
          );

          // Use a callback to get the most current state
          setCards((currentCards) => {
            const currentCard = currentCards[currentCardIndex];
            console.log(
              "MainPage - Gesture handler - current card from callback:",
              currentCard,
            );
            if (currentCard) {
              swipeCard("up", currentCard);
            } else {
              console.error(
                "MainPage - Gesture handler - no card found at index:",
                currentCardIndex,
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
    }),
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
          `toggleLike - Invalid index: ${index}, cards length: ${cards.length}`,
        );
        return;
      }

      const card = cards[index];
      const currentLikedStatus = card.isLiked === true;
      const newLikedStatus = !currentLikedStatus;

      console.log(
        `toggleLike - Card ${card.id} toggling from ${currentLikedStatus} to ${newLikedStatus}`,
      );

      // Create a completely new array to ensure state change is detected
      const newCards = [...cards];
      newCards[index] = {
        ...card,
        isLiked: newLikedStatus,
      };

      // Log before and after
      console.log(
        `toggleLike - Before update: ${cards[index].isLiked}, After update will be: ${newCards[index].isLiked}`,
      );

      // Update state with new array
      setCards(newCards);

      // Update persistent storage
      persistentCardStorage.cards = newCards;

      // Simulate API call
      toggleLikeApi(card.id, newLikedStatus).then((success) => {
        if (success) {
          console.log(
            `toggleLike - Updated card ${card.id} like status to: ${newLikedStatus}`,
          );
        } else {
          console.error(
            `toggleLike - Failed to update card ${card.id} like status to: ${newLikedStatus}`,
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
    [cards],
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
    [cards, toggleLike],
  );

  // Clean up animations when component unmounts or changes
  useEffect(() => {
    return () => {
      cleanupHeartAnimations();
    };
  }, []);

  const swipeCard = (
    direction: "up" | "right" = "up",
    cardToSwipe?: CardItem,
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
      cards.map((c) => ({ id: c.id, name: c.name })),
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
        "MainPage - Preventing swipe of last card until more are loaded",
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
          prevCards.length,
        );
        console.log(
          "MainPage - setCards callback - currentCardIndex:",
          currentCardIndex,
        );
        console.log(
          "MainPage - setCards callback - prevCards:",
          prevCards.map((c) => ({ id: c.id, name: c.name })),
        );

        if (prevCards.length === 0) {
          console.log(
            "MainPage - setCards callback - prevCards is empty, returning empty array",
          );
          return [];
        }
        const newCards = [...prevCards];
        if (newCards.length > 0) {
          console.log(
            "MainPage - setCards callback - removing card at index:",
            currentCardIndex,
          );
          newCards.splice(currentCardIndex, 1);
        }
        // Log removed card info
        console.log(
          `MainPage - Card ${currentCard?.id} was swiped ${direction}`,
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
            "MainPage - Cannot track swipe: currentCard.id is missing",
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
          (c) => c.id !== LOADING_CARD_ID,
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
            MIN_CARDS_THRESHOLD - cardsWithoutLoading.length + 1,
          ).then((apiCards) => {
            if (apiCards.length > 0) {
              setCards((latestCards) => {
                // Remove loading cards and add new ones
                const filteredCards = latestCards.filter(
                  (c) => c.id !== LOADING_CARD_ID,
                );
                const updatedCards = [...filteredCards, ...apiCards];
                console.log(
                  "MainPage - Added new cards, total count:",
                  updatedCards.length,
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
      resetToBackButtons();
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

  // Handle link button press-in animation
  const handleLinkPressIn = () => {
    RNAnimated.timing(linkButtonScale, {
      toValue: 0.85,
      duration: 80,
      useNativeDriver: true,
      easing: Easing.inOut(Easing.ease),
    }).start();
  };

  // Handle link button press-out animation
  const handleLinkPressOut = () => {
    RNAnimated.timing(linkButtonScale, {
      toValue: 1,
      duration: 150,
      useNativeDriver: true,
      easing: Easing.inOut(Easing.ease),
    }).start();
  };

  // Handle share button press-in animation
  const handleSharePressIn = () => {
    RNAnimated.timing(shareButtonScale, {
      toValue: 0.85,
      duration: 80,
      useNativeDriver: true,
      easing: Easing.inOut(Easing.ease),
    }).start();
  };

  // Handle share button press-out animation
  const handleSharePressOut = () => {
    RNAnimated.timing(shareButtonScale, {
      toValue: 1,
      duration: 150,
      useNativeDriver: true,
      easing: Easing.inOut(Easing.ease),
    }).start();
  };

  // Handle backside cart button press-in animation
  const handleBackCartPressIn = () => {
    RNAnimated.timing(backCartButtonScale, {
      toValue: 0.85,
      duration: 80,
      useNativeDriver: true,
      easing: Easing.inOut(Easing.ease),
    }).start();
  };

  // Handle backside cart button press-out animation
  const handleBackCartPressOut = () => {
    RNAnimated.timing(backCartButtonScale, {
      toValue: 1,
      duration: 150,
      useNativeDriver: true,
      easing: Easing.inOut(Easing.ease),
    }).start();
    handleBackCartPress();
  };

  // Handle backside cart: same horizontal grow as front (panel goes over other icons)
  const handleBackCartPress = () => {
    setShowBackSizeSelection(true);
    backSizePanelWidth.value = withTiming(sizePanelMaxWidth, { duration: 280 });
  };

  const handleCancelBackSizeSelection = () => {
    backSizePanelWidth.value = withTiming(SIZE_PANEL_CLOSED_WIDTH, {
      duration: 220,
    });
    requestAnimationFrame(() => {
      setTimeout(() => setShowBackSizeSelection(false), 220);
    });
  };

  const resetToBackButtons = () => {
    backSizePanelWidth.set(SIZE_PANEL_CLOSED_WIDTH);
    setShowBackSizeSelection(false);
  };

  // Handle backside link button press-in animation
  const handleBackLinkPressIn = () => {
    RNAnimated.timing(backLinkButtonScale, {
      toValue: 0.85,
      duration: 80,
      useNativeDriver: true,
      easing: Easing.inOut(Easing.ease),
    }).start();
  };

  // Handle backside link button press-out animation
  const handleBackLinkPressOut = () => {
    RNAnimated.timing(backLinkButtonScale, {
      toValue: 1,
      duration: 150,
      useNativeDriver: true,
      easing: Easing.inOut(Easing.ease),
    }).start();
  };

  // Handle backside share button press-in animation
  const handleBackSharePressIn = () => {
    RNAnimated.timing(backShareButtonScale, {
      toValue: 0.85,
      duration: 80,
      useNativeDriver: true,
      easing: Easing.inOut(Easing.ease),
    }).start();
  };

  // Handle backside share button press-out animation
  const handleBackSharePressOut = () => {
    RNAnimated.timing(backShareButtonScale, {
      toValue: 1,
      duration: 150,
      useNativeDriver: true,
      easing: Easing.inOut(Easing.ease),
    }).start();
  };

  // Handle link button press
  const handleLinkPress = useCallback(async () => {
    const currentCard = cards[currentCardIndex];
    if (!currentCard) return;

    // Generate a link to the product
    const productUrl = `polka://product/${currentCard.id}`;

    try {
      // Copy to clipboard
      await Clipboard.setStringAsync(productUrl);

      // Show copied state
      setIsLinkCopied(true);
      setShowLinkCopiedPopup(true);

      // Provide haptic feedback
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      // Reset copied state after 2 seconds
      setTimeout(() => {
        setIsLinkCopied(false);
        setShowLinkCopiedPopup(false);
      }, 2000);
    } catch (error) {
      console.error("Error copying link:", error);
    }
  }, [cards, currentCardIndex]);

  // Handle share button press
  const handleSharePress = useCallback(async () => {
    const currentCard = cards[currentCardIndex];
    if (!currentCard) return;

    // Generate a link to the product
    const productUrl = `polka://product/${currentCard.id}`;

    try {
      await Share.share({
        message: `Посмотрите ${currentCard.name} от ${currentCard.brand_name} на Полке!\n${productUrl}`,
        title: currentCard.name,
        url: productUrl,
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.error("Error sharing:", error);
    }
  }, [cards, currentCardIndex]);

  const CORNER_INSET = CARD_CORNER_INSET;
  // Card is 88% of screen width; keep panel within card bounds
  const cardWidth = screenWidth * 0.88;
  const sizePanelMaxWidth = cardWidth - CORNER_INSET * 2;

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

  const backSizePanelTailAnimatedStyle = useAnimatedStyle(() => ({
    width: Math.max(0, backSizePanelWidth.value - CORNER_BOX_SIZE),
    overflow: "hidden" as const,
  }));

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

    // Add the current card with selected size to cart (include product_variant_id for payment)
    const cartItem: CartItem = {
      ...currentCard,
      size,
      quantity: 1,
      delivery: { cost: 0, estimatedTime: "" },
      product_variant_id: selectedVariant.id,
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
          {/* Image: full card minus padding */}
          <View style={styles.imageHolder} pointerEvents="box-none">
            <View
              style={styles.imageFullBleed}
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
                      imageCarouselWidth || screenWidth * 0.88;
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
            </View>
          </View>

          {/* Top-right: three dots – same inset as other corners */}
          <View style={styles.cornerOverlayTopRight} pointerEvents="box-none">
            <View style={styles.cornerInnerTopRight}>
              <Pressable onPress={handleFlip}>
                <More width={33} height={33} />
              </Pressable>
            </View>
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
                              : "#808080",
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
                                    : "#808080",
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
      setCurrentImageIndex,
      userSelectedSize,
      handleSizeSelect,
      handleCancelSizeSelection,
      cards,
      imageScrollViewRef,
      colorSelectorOpen,
      setColorSelectorOpen,
      handleColorSelect,
      closeColorSelector,
    ],
  );

  // Render function for the back of the card
  const renderBackOfCard = useCallback(
    (card: CardItem, index: number) => {
      const isLiked = card.isLiked === true;

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

          {/* Back bottom strip: same inset as front (20px), four even slots, panel overlays when expanded */}
          <View style={styles.backBottomStrip}>
            {/* Link Copied Popup */}
            {showLinkCopiedPopup && (
              <Animated.View
                entering={FadeInDown.duration(200)}
                exiting={FadeOutDown.duration(200)}
                style={styles.linkCopiedPopup}
              >
                <Text style={styles.linkCopiedText}>Ссылка скопирована</Text>
              </Animated.View>
            )}

            {/* Four icons: cart in flow, then link/share/heart. Expanding sizes panel is absolute. */}
            <View style={styles.backIconSlotsRow}>
              <View style={styles.backCartSlot}>
                <Pressable
                  style={styles.backIconBox}
                  onPressIn={handleBackCartPressIn}
                  onPressOut={handleBackCartPressOut}
                  onPress={handleBackCartPress}
                >
                  <RNAnimated.View
                    style={{ transform: [{ scale: backCartButtonScale }] }}
                  >
                    <Cart2 width={33} height={33} />
                  </RNAnimated.View>
                </Pressable>
                <Animated.View
                  style={[
                    styles.backSizePanelTail,
                    backSizePanelTailAnimatedStyle,
                    { zIndex: 1001, elevation: 1002 },
                  ]}
                  pointerEvents={showBackSizeSelection ? "auto" : "none"}
                >
                  <View style={styles.sizePanelRow}>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.sizeScrollContent}
                      style={styles.sizePanelScrollView}
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
                                resetToBackButtons();
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
                                isOneSize
                                  ? styles.sizeOvalText
                                  : styles.sizeText
                              }
                            >
                              {variant.size}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                    <Pressable
                      onPress={handleCancelBackSizeSelection}
                      style={styles.sizePanelCancelButton}
                    >
                      <Cancel width={27} height={27} />
                    </Pressable>
                  </View>
                </Animated.View>
              </View>
              <View style={styles.backIconSpacer} />
              <Pressable
                style={styles.backIconBox}
                onPressIn={handleBackLinkPressIn}
                onPressOut={handleBackLinkPressOut}
                onPress={handleLinkPress}
              >
                <RNAnimated.View
                  style={{ transform: [{ scale: backLinkButtonScale }] }}
                >
                  {isLinkCopied ? (
                    <LinkPressed width={33} height={33} />
                  ) : (
                    <Link width={33} height={33} />
                  )}
                </RNAnimated.View>
              </Pressable>
              <View style={styles.backIconSpacer} />
              <Pressable
                style={styles.backIconBox}
                onPressIn={handleBackSharePressIn}
                onPressOut={handleBackSharePressOut}
                onPress={handleSharePress}
              >
                <RNAnimated.View
                  style={{ transform: [{ scale: backShareButtonScale }] }}
                >
                  <ShareIcon width={33} height={33} />
                </RNAnimated.View>
              </Pressable>
              <View style={styles.backIconSpacer} />
              <View style={styles.backIconBoxWrapper}>
                <View style={styles.backIconBox}>
                  <HeartButton
                    isLiked={isLiked}
                    onToggleLike={() => toggleLike(index)}
                  />
                </View>
                <Pressable
                  style={StyleSheet.absoluteFill}
                  onLongPress={() => handleLongPress(index)}
                  delayLongPress={300}
                />
              </View>
            </View>
          </View>
        </View>
      );
    },
    [
      handleFlip,
      handleBackCartPressIn,
      handleBackCartPressOut,
      handleBackCartPress,
      handleBackLinkPressIn,
      handleBackLinkPressOut,
      handleBackSharePressIn,
      handleBackSharePressOut,
      handleLinkPress,
      handleSharePress,
      toggleLike,
      handleLongPress,
      handleSizeSelect,
      handleCancelBackSizeSelection,
      resetToBackButtons,
      userSelectedSize,
      cards,
      currentCardIndex,
      showBackSizeSelection,
      isLinkCopied,
      showLinkCopiedPopup,
    ],
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
            <View style={styles.cardFace}>{renderBackOfCard(card, index)}</View>
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
          updatedCards.length,
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
                  (c) => c.id !== LOADING_CARD_ID,
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

  // Page fade-in removed - React Navigation handles screen transitions natively

  // Removed loading screen - render immediately for smooth transitions

  return (
    <Animated.View
      style={[styles.container]}
      entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
        ANIMATION_DELAYS.LARGE,
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
    backgroundColor: "rgba(205, 166, 122, 0)",
    position: "relative",
    borderWidth: 3,
    borderColor: "rgba(205, 166, 122, 0.4)",
    zIndex: 900,
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
    borderRadius: 21,
    borderWidth: 4,
    borderColor: "#4A3120",
    backgroundColor: "#F2ECE7",
    justifyContent: "center",
    alignItems: "center",
  },
  colorSwatchCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
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
    gap: 6,
    marginTop: 6,
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
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.2)",
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
    backgroundColor: "#F2ECE7",
    shadowColor: "#000",
    shadowOffset: { width: 0.25, height: 4 },
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
    borderRadius: 41,
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
  imageFullBleed: {
    width: "100%",
    height: "100%",
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
    backgroundColor: "rgba(74, 49, 32, 0.5)",
    marginHorizontal: 4,
  },
  imageDotActive: {
    backgroundColor: "#4A3120",
  },
  cornerOverlayTopLeft: {
    position: "absolute",
    top: 0,
    left: 0,
    width: CORNER_OVERLAY_SIZE,
    height: CORNER_OVERLAY_SIZE,
    backgroundColor: "#F2ECE7",
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
    backgroundColor: "#F2ECE7",
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
    backgroundColor: "#F2ECE7",
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
    backgroundColor: "#F2ECE7",
    borderBottomRightRadius: 41,
    borderTopLeftRadius: 16,
    zIndex: 20,
    elevation: 21,
  },
  cornerInnerTopLeft: {
    position: "absolute",
    top: CARD_CORNER_INSET,
    left: CARD_CORNER_INSET,
    width: CORNER_BOX_SIZE,
    height: CORNER_BOX_SIZE,
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
  cornerInnerBottomLeft: {
    position: "absolute",
    bottom: CARD_CORNER_INSET,
    left: CARD_CORNER_INSET,
    width: CORNER_BOX_SIZE,
    height: CORNER_BOX_SIZE,
  },
  cornerInnerBottomRight: {
    position: "absolute",
    bottom: CARD_CORNER_INSET,
    right: CARD_CORNER_INSET,
    width: CORNER_BOX_SIZE,
    height: CORNER_BOX_SIZE,
  },
  sizePanelOuter: {
    backgroundColor: "#F2ECE7",
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
    backgroundColor: "rgba(230, 109, 123, 0.54)",
  },
  cornerOverlayTopRightInner: {
    backgroundColor: "#F2ECE7",
    width: CORNER_BOX_SIZE,
    height: CORNER_BOX_SIZE,
    padding: 10,
    borderBottomLeftRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  cornerOverlayBottomLeftInner: {
    backgroundColor: "#F2ECE7",
    width: CORNER_BOX_SIZE,
    height: CORNER_BOX_SIZE,
    padding: 10,
    borderTopRightRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  cornerOverlayBottomRightInner: {
    backgroundColor: "#F2ECE7",
    width: CORNER_BOX_SIZE,
    height: CORNER_BOX_SIZE,
    padding: 10,
    borderTopLeftRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  sizePanelPosition: {
    position: "absolute",
    left: CARD_CORNER_INSET,
    bottom: CARD_CORNER_INSET,
  },
  colorSelectorCornerBox: {
    backgroundColor: "#F2ECE7",
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
  dotsImage: {
    width: 23,
    height: 33,
  },
  button: {
    padding: 5,
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
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 20,
    height: 60,
    position: "relative",
    overflow: "hidden",
  },
  sizeScrollView: {
    flex: 1,
    width: "100%",
    height: 60,
    borderRadius: 41,
  },
  sizeScrollContent: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 60,
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
    marginVertical: 9.5, // Center vertically: (60 - 41) / 2 = 9.5
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
    marginVertical: 9.5, // Center vertically: (60 - 41) / 2 = 9.5
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
  cancelSizeSelectionButtonFixed: {
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
    zIndex: 10,
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
  // Card back: reduced vertical padding for tighter layout
  cardBackContainer: {
    flex: 1,
    minHeight: 0,
    justifyContent: "flex-start",
    alignItems: "stretch",
    width: "100%",
  },
  removeButton: {
    width: 25,
    height: 25,
    borderRadius: 7,
    backgroundColor: "rgba(230, 109, 123, 0.54)",
    justifyContent: "center",
    alignItems: "center",
    position: "absolute",
    right: 0,
    zIndex: 1000,
    elevation: 10,
  },
  cardBackHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: CARD_BACK_VERTICAL_INSET,
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
    minHeight: 0,
  },
  expandableSectionsContent: {
    paddingBottom: CARD_BACK_VERTICAL_INSET,
    flexGrow: 1,
  },
  backBottomStrip: {
    width: "100%",
    height: CORNER_BOX_SIZE + CARD_BACK_BOTTOM_INSET,
    paddingHorizontal: 0,
    //backgroundColor: "#F2ECE7",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    justifyContent: "center",
    position: "relative",
  },
  backIconSlotsRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
  },
  backIconSpacer: {
    flex: 1,
    minWidth: 0,
  },
  backCartSlot: {
    width: CORNER_BOX_SIZE,
    position: "relative",
  },
  backSizePanelTail: {
    position: "absolute",
    left: CORNER_BOX_SIZE,
    top: 0,
    bottom: 0,
    backgroundColor: "#F2ECE7",
    justifyContent: "center",
  },
  backIconBoxWrapper: {
    width: CORNER_BOX_SIZE,
    position: "relative",
  },
  backIconBox: {
    width: CORNER_BOX_SIZE,
    height: CORNER_BOX_SIZE,
    backgroundColor: "#F2ECE7",
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  expandableContainer: {
    marginBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    paddingBottom: 3,
  },
  expandableHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
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
  linkCopiedPopup: {
    position: "absolute",
    top: -50,
    left: "50%",
    marginLeft: -80,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    zIndex: 1000,
  },
  linkCopiedText: {
    color: "#FFF",
    fontFamily: "REM",
    fontSize: 14,
    textAlign: "center",
  },
});

export default MainPage;
