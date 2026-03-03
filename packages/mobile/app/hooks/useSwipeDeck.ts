import {
  useCallback,
  useRef,
  useState,
  useEffect,
} from "react";
import {
  Dimensions,
  Animated as RNAnimated,
  Easing,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import {
  useSharedValue,
  withTiming,
  withSpring,
  runOnJS,
  useAnimatedStyle,
  interpolate,
  cancelAnimation,
} from "react-native-reanimated";
import { Gesture } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import { ANIMATION_DURATIONS, ANIMATION_EASING } from "../lib/animations";
import { CardItem } from "../types/product";
import { getCardItemForColorIndex } from "../lib/productMapper";
import { toggleLikeApi, createLoadingCard } from "../lib/swipeCardUtils";
import {
  CARD_CORNER_INSET,
  CORNER_BOX_SIZE,
  SIZE_PANEL_CLOSED_WIDTH,
  MIN_CARDS_THRESHOLD,
  LOADING_CARD_ID,
  COLOR_CORNER_CLOSED_HEIGHT,
  COLOR_GAP,
  COLOR_DROPDOWN_ITEM_HEIGHT,
  COLOR_DROPDOWN_BOTTOM_PADDING,
} from "../lib/swipeCardConstants";
import * as api from "../services/api";
import { log } from "../services/config";

export interface SwipeDeckConfig {
  cardWidthFraction: number; // 0.88 MainPage, 0.80 FRS
  fetchCards: (count: number) => Promise<CardItem[]>;
  onAddToCart: (card: CardItem, size: string, variantId?: string) => void;
  initialCards?: CardItem[];
  onSwipe?: (productId: string, direction: "up" | "right") => void;
  onCardsChange?: (cards: CardItem[]) => void;
}

export function useSwipeDeck(config: SwipeDeckConfig) {
  const {
    cardWidthFraction,
    fetchCards,
    onAddToCart,
    initialCards,
    onSwipe,
    onCardsChange,
  } = config;

  const screenHeight = Dimensions.get("window").height;
  const screenWidth = Dimensions.get("window").width;
  const SWIPE_THRESHOLD = screenHeight * 0.1;
  const cardWidth = screenWidth * cardWidthFraction;
  const sizePanelMaxWidth = cardWidth - CARD_CORNER_INSET * 2;

  // ─── Core state ──────────────────────────────────────────────────────
  const [cards, setCards] = useState<CardItem[]>(initialCards || []);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isLoadingInitialCards, setIsLoadingInitialCards] = useState(!initialCards?.length);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [userSelectedSize, setUserSelectedSize] = useState<string | null>(null);

  // Refs for reading state in callbacks
  const isAnimatingRef = useRef(false);
  const isRefreshingRef = useRef(false);
  const isFlippedRef = useRef(false);
  const cardsRef = useRef<CardItem[]>([]);
  const currentCardIndexRef = useRef(0);
  const currentImageIndexRef = useRef(0);
  const isFetchingMore = useRef(false);

  // ─── Reanimated shared values (run on UI thread) ───────────────────
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const flipProgress = useSharedValue(0);
  const refreshOpacity = useSharedValue(1);

  // Shared value mirrors of boolean state (readable in worklets)
  const isAnimatingSV = useSharedValue(false);
  const isFlippedSV = useSharedValue(false);
  const isRefreshingSV = useSharedValue(false);

  // Cancel zone flag for header gesture
  const cancelZoneActive = useSharedValue(false);

  // ─── Old Animated values (stay for independent animations) ─────────
  const fadeAnim = useRef(new RNAnimated.Value(1)).current;
  const heartScale = useRef(new RNAnimated.Value(1)).current;
  const longPressScale = useRef(new RNAnimated.Value(1)).current;
  const heartAnimationRef = useRef<RNAnimated.CompositeAnimation | null>(null);
  const longPressAnimationRef = useRef<RNAnimated.CompositeAnimation | null>(null);
  const cartButtonScale = useRef(new RNAnimated.Value(1)).current;

  // ─── Flip state ──────────────────────────────────────────────────────
  const [isFlipped, setIsFlipped] = useState(false);

  // ─── Image carousel ──────────────────────────────────────────────────
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const imageScrollViewRef = useRef<ScrollView>(null);
  const imageCarouselWidthRef = useRef(0);
  const [imageCarouselWidth, setImageCarouselWidth] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);

  // ─── Size panel ──────────────────────────────────────────────────────
  const [showSizeSelection, setShowSizeSelection] = useState(false);
  const sizePanelWidth = useSharedValue(SIZE_PANEL_CLOSED_WIDTH);

  // ─── Color selector ──────────────────────────────────────────────────
  const [colorSelectorOpen, setColorSelectorOpen] = useState(false);
  const [dropdownContentHeight, setDropdownContentHeight] = useState(0);
  const colorDropdownHeight = useSharedValue(COLOR_CORNER_CLOSED_HEIGHT);

  // ─── Animated styles (all run on UI thread) ────────────────────────
  const cardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));

  const frontFlipStyle = useAnimatedStyle(() => ({
    transform: [{ rotateY: `${flipProgress.value}deg` }],
  }));

  const backFlipStyle = useAnimatedStyle(() => ({
    transform: [{ rotateY: `${flipProgress.value + 180}deg` }],
  }));

  const refreshAnimatedStyle = useAnimatedStyle(() => ({
    opacity: refreshOpacity.value,
  }));

  // ─── Sync refs & shared values ─────────────────────────────────────
  useEffect(() => { isAnimatingRef.current = isAnimating; isAnimatingSV.value = isAnimating; }, [isAnimating]);
  useEffect(() => { isRefreshingRef.current = isRefreshing; isRefreshingSV.value = isRefreshing; }, [isRefreshing]);
  useEffect(() => { isFlippedRef.current = isFlipped; isFlippedSV.value = isFlipped; }, [isFlipped]);
  useEffect(() => { cardsRef.current = cards; }, [cards]);
  useEffect(() => { currentCardIndexRef.current = currentCardIndex; }, [currentCardIndex]);
  useEffect(() => { currentImageIndexRef.current = currentImageIndex; }, [currentImageIndex]);

  // Notify parent of cards changes
  useEffect(() => {
    onCardsChange?.(cards);
  }, [cards]);

  // ─── Fetch user size ─────────────────────────────────────────────────
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const { apiWrapper } = await import("../services/apiWrapper");
        const userProfile = await apiWrapper.getCurrentUser("useSwipeDeck");
        if (userProfile) {
          setUserSelectedSize(userProfile.profile?.selected_size || null);
        }
      } catch (error) {
        log.error("Error fetching user data:", error);
        setUserSelectedSize(null);
      }
    };
    fetchUserData();
  }, []);

  // ─── Load initial cards if none provided ──────────────────────────────
  useEffect(() => {
    if (initialCards?.length) return;
    let isMounted = true;
    const load = async () => {
      setIsLoadingInitialCards(true);
      const starterCards = await fetchCards(MIN_CARDS_THRESHOLD + 1);
      if (isMounted) {
        setCards(starterCards);
        setIsLoadingInitialCards(false);
      }
    };
    load();
    return () => { isMounted = false; };
  }, []);

  // ─── Track swipe ─────────────────────────────────────────────────────
  const trackSwipe = async (productId: string, direction?: "up" | "right") => {
    if (!productId) return;
    try {
      await api.trackSwipeWithOptimisticUpdate({ product_id: productId });
    } catch (error) {
      log.error("Error tracking swipe:", error);
    }
    onSwipe?.(productId, direction || "up");
  };

  // ─── Text fade animation ─────────────────────────────────────────────
  const animateTextChange = () => {
    RNAnimated.timing(fadeAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
      easing: Easing.out(Easing.ease),
    }).start(() => {
      RNAnimated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
        easing: Easing.in(Easing.ease),
      }).start();
    });
  };

  useEffect(() => {
    if (cards.length > 0) animateTextChange();
  }, [currentCardIndex]);

  // ─── Reset image index on card change ────────────────────────────────
  useEffect(() => {
    setCurrentImageIndex(0);
    if (imageScrollViewRef.current && imageCarouselWidth > 0) {
      setTimeout(() => {
        imageScrollViewRef.current?.scrollTo({ x: 0, animated: false });
      }, 0);
    }
  }, [currentCardIndex, imageCarouselWidth]);

  // ─── Close color selector on card change ─────────────────────────────
  useEffect(() => {
    setColorSelectorOpen(false);
    setDropdownContentHeight(0);
    colorDropdownHeight.value = COLOR_CORNER_CLOSED_HEIGHT;
  }, [currentCardIndex]);

  // ─── Color dropdown animation ────────────────────────────────────────
  useEffect(() => {
    if (colorSelectorOpen && dropdownContentHeight > 0) {
      colorDropdownHeight.value = withTiming(dropdownContentHeight, { duration: 220 });
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
      if (!card?.color_variants?.length || colorIndex < 0 || colorIndex >= card.color_variants.length) return;
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

  const openColorSelector = useCallback(
    (colorVariantsLength: number) => {
      if (colorSelectorOpen) {
        closeColorSelector();
      } else if (colorVariantsLength > 1) {
        const otherCount = Math.max(0, colorVariantsLength - 1);
        const openHeight =
          COLOR_CORNER_CLOSED_HEIGHT +
          COLOR_GAP +
          otherCount * COLOR_DROPDOWN_ITEM_HEIGHT +
          COLOR_DROPDOWN_BOTTOM_PADDING;
        setDropdownContentHeight(openHeight);
        setColorSelectorOpen(true);
      }
    },
    [colorSelectorOpen, closeColorSelector],
  );

  // ─── Image carousel handlers ─────────────────────────────────────────
  const handleImageScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (isFlippedRef.current || !imageCarouselWidthRef.current) return;
      const contentOffsetX = event.nativeEvent.contentOffset.x;
      const idx = Math.round(contentOffsetX / imageCarouselWidthRef.current);
      if (idx >= 0) {
        const card = cardsRef.current[currentCardIndexRef.current];
        if (card && idx < card.images.length && idx !== currentImageIndexRef.current) {
          setCurrentImageIndex(idx);
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

  const handleImageLayout = useCallback((width: number) => {
    if (width > 0 && width !== imageCarouselWidthRef.current) {
      imageCarouselWidthRef.current = width;
      setImageCarouselWidth(width);
    }
  }, []);

  // ─── Flip ────────────────────────────────────────────────────────────
  const handleFlip = useCallback(() => {
    flipProgress.value = withTiming(isFlipped ? 0 : 180, {
      duration: ANIMATION_DURATIONS.EXTENDED,
      easing: ANIMATION_EASING.CUBIC,
    });
    setIsFlipped((prev) => !prev);
    // Reset size panel when flipping
    sizePanelWidth.set(SIZE_PANEL_CLOSED_WIDTH);
    setShowSizeSelection(false);
  }, [isFlipped]);

  // ─── Like/unlike ─────────────────────────────────────────────────────
  const toggleLike = useCallback(
    (index: number) => {
      if (index < 0 || index >= cards.length) return;
      const card = cards[index];
      const currentLikedStatus = card.isLiked === true;
      const newLikedStatus = !currentLikedStatus;

      const newCards = [...cards];
      newCards[index] = { ...card, isLiked: newLikedStatus };
      setCards(newCards);

      toggleLikeApi(card.id, newLikedStatus).then((success) => {
        if (!success) {
          setCards((prevCards) => {
            const revertedCards = [...prevCards];
            revertedCards[index] = { ...revertedCards[index], isLiked: currentLikedStatus };
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

  // ─── Cleanup animations ──────────────────────────────────────────────
  const cleanupHeartAnimations = () => {
    heartAnimationRef.current?.stop();
    heartAnimationRef.current = null;
    longPressAnimationRef.current?.stop();
    longPressAnimationRef.current = null;
    heartScale.setValue(1);
    longPressScale.setValue(1);
  };

  useEffect(() => {
    return () => { cleanupHeartAnimations(); };
  }, []);

  // ─── Fade out/in ─────────────────────────────────────────────────────
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
    ]).start((finished) => {
      if (!finished.finished) {
        requestAnimationFrame(() => fadeAnim.setValue(1));
      }
    });
  }, [fadeAnim]);

  // ─── Reset size panel helpers ────────────────────────────────────────
  const resetToButtons = () => {
    sizePanelWidth.set(SIZE_PANEL_CLOSED_WIDTH);
    setShowSizeSelection(false);
  };

  // ─── Full visual reset (for external card injection) ───────────────
  const resetVisualState = () => {
    cancelAnimation(translateX);
    cancelAnimation(translateY);
    translateX.value = 0;
    translateY.value = 0;
    flipProgress.value = 0;
    setIsFlipped(false);
    setIsAnimating(false);
    resetToButtons();
    setCurrentImageIndex(0);
    closeColorSelector();
  };

  // ─── Swipe complete handler (called from gesture worklet via runOnJS) ─
  const handleSwipeComplete = useCallback((direction: "up" | "right") => {
    setIsAnimating(false);

    setCards((prevCards) => {
      if (prevCards.length === 0) return [];
      const idx = currentCardIndexRef.current;
      const card = prevCards[idx];
      const newCards = [...prevCards];
      newCards.splice(idx, 1);

      if (card?.id) trackSwipe(card.id, direction);

      const newIndex =
        idx >= newCards.length
          ? Math.max(0, newCards.length - 1)
          : idx;
      setTimeout(() => setCurrentCardIndex(newIndex), 0);

      // Fetch more if running low
      const cardsWithoutLoading = newCards.filter((c) => c.id !== LOADING_CARD_ID);
      if (cardsWithoutLoading.length < MIN_CARDS_THRESHOLD) {
        const hasLoadingCard = newCards.some((c) => c.id === LOADING_CARD_ID);
        if (!hasLoadingCard) newCards.push(createLoadingCard());
        fetchCards(MIN_CARDS_THRESHOLD - cardsWithoutLoading.length + 1).then((apiCards) => {
          if (apiCards.length > 0) {
            setCards((latestCards) => {
              const filtered = latestCards.filter((c) => c.id !== LOADING_CARD_ID);
              return [...filtered, ...apiCards];
            });
          }
        });
      }
      return newCards;
    });

    // Reset for next card (no spring-from-below needed — next card already visible)
    flipProgress.value = 0;
    setIsFlipped(false);
    resetToButtons();
    translateX.value = 0;
    translateY.value = 0;

    fadeOutIn();
  }, [fetchCards, fadeOutIn]);

  // Stable reference for runOnJS (avoids stale closure in worklets)
  const handleSwipeCompleteRef = useRef(handleSwipeComplete);
  handleSwipeCompleteRef.current = handleSwipeComplete;
  const triggerSwipeComplete = useCallback((direction: "up" | "right") => {
    handleSwipeCompleteRef.current(direction);
  }, []);

  // ─── Swipe card (programmatic trigger) ─────────────────────────────
  const swipeCard = (direction: "up" | "right" = "up", _cardToSwipe?: CardItem) => {
    if (isAnimating) return;

    const currentCard = _cardToSwipe || cards[currentCardIndex];
    if (currentCard?.id === LOADING_CARD_ID) return;

    const realCards = cards.filter((c) => c.id !== LOADING_CARD_ID);
    if (realCards.length === 1) {
      // Bounce effect — can't swipe the last card
      translateY.value = withTiming(-50, { duration: 100 }, () => {
        translateY.value = withSpring(0, { damping: 10, stiffness: 100 });
      });
      if (!isRefreshing) refreshCards();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    setIsAnimating(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const animationSafetyTimeout = setTimeout(() => {
      setIsAnimating(false);
      translateX.value = 0;
      translateY.value = 0;
    }, 300);

    if (direction === "right") {
      translateX.value = withTiming(screenWidth, { duration: 100 });
    }
    translateY.value = withTiming(
      -screenHeight,
      { duration: 100 },
      (finished) => {
        if (finished) {
          runOnJS(clearTimeout)(animationSafetyTimeout);
          runOnJS(triggerSwipeComplete)(direction);
        }
      },
    );

    fadeOutIn();
  };

  // ─── Refresh cards ───────────────────────────────────────────────────
  const refreshCards = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);

    refreshOpacity.value = withTiming(0.7, { duration: 200 }, () => {
      refreshOpacity.value = withTiming(1, { duration: 300 });
    });

    try {
      const newCards = await fetchCards(2);
      await new Promise((resolve) => setTimeout(resolve, 300));
      setCards((prevCards) => {
        // Keep first card (may have been injected via addCardItem) and dedup
        const keep = prevCards.slice(0, 3);
        const keepIds = new Set(keep.map((c) => c.id));
        const deduped = newCards.filter((c) => !keepIds.has(c.id));
        return [...keep, ...deduped];
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) {
      log.error("Error refreshing cards:", error);
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, fetchCards]);

  // ─── Size panel handlers ─────────────────────────────────────────────
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
    sizePanelWidth.value = withTiming(sizePanelMaxWidth, { duration: 280 });
  };

  const handleCancelSizeSelection = () => {
    sizePanelWidth.value = withTiming(SIZE_PANEL_CLOSED_WIDTH, { duration: 220 });
    requestAnimationFrame(() => {
      setTimeout(() => setShowSizeSelection(false), 220);
    });
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
    onAddToCart(currentCard, size, selectedVariant.id);
    resetToButtons();
  };

  // ─── Gesture handlers (run on UI thread) ──────────────────────────
  const panGesture = Gesture.Pan()
    .activeOffsetY([-5, 5])
    .onUpdate((event) => {
      "worklet";
      if (isFlippedSV.value || isAnimatingSV.value || isRefreshingSV.value) return;
      if (event.translationY <= 0) {
        translateY.value = event.translationY;
      }
    })
    .onEnd((event) => {
      "worklet";
      if (isFlippedSV.value || isAnimatingSV.value || isRefreshingSV.value) {
        translateY.value = withSpring(0, { damping: 15, stiffness: 150 });
        return;
      }
      if (event.translationY < -SWIPE_THRESHOLD) {
        isAnimatingSV.value = true;
        translateY.value = withTiming(
          -screenHeight,
          { duration: 100 },
          (finished) => {
            if (finished) {
              runOnJS(triggerSwipeComplete)("up");
            }
          },
        );
      } else {
        translateY.value = withSpring(0, { damping: 15, stiffness: 150 });
      }
    });

  const headerPanGesture = Gesture.Pan()
    .activeOffsetY([-5, 5])
    .onStart((event) => {
      "worklet";
      // Cancel zone exclusion (cancel button area on back face header)
      const cardLeft = screenWidth * ((1 - cardWidthFraction) / 2);
      const cardRight = cardLeft + cardWidth;
      const cancelRight = cardRight - 20 - 25;
      const cancelLeft = cancelRight - 25;
      const cancelTop = 12;
      const cancelBottom = cancelTop + 25;
      const pad = 15;
      cancelZoneActive.value =
        event.absoluteX >= cancelLeft - pad && event.absoluteX <= cancelRight + pad &&
        event.absoluteY >= cancelTop - pad && event.absoluteY <= cancelBottom + pad;
    })
    .onUpdate((event) => {
      "worklet";
      if (cancelZoneActive.value) return;
      if (!isFlippedSV.value || isAnimatingSV.value || isRefreshingSV.value) return;
      if (event.translationY <= 0) {
        translateY.value = event.translationY;
      }
    })
    .onEnd((event) => {
      "worklet";
      if (cancelZoneActive.value) return;
      if (!isFlippedSV.value || isAnimatingSV.value || isRefreshingSV.value) {
        translateY.value = withSpring(0, { damping: 15, stiffness: 150 });
        return;
      }
      if (event.translationY < -SWIPE_THRESHOLD) {
        isAnimatingSV.value = true;
        translateY.value = withTiming(
          -screenHeight,
          { duration: 100 },
          (finished) => {
            if (finished) {
              runOnJS(triggerSwipeComplete)("up");
            }
          },
        );
      } else {
        translateY.value = withSpring(0, { damping: 15, stiffness: 150 });
      }
    });

  // ─── Keep currentCardIndex in bounds ─────────────────────────────────
  useEffect(() => {
    if (currentCardIndex >= cards.length && cards.length > 0) {
      setCurrentCardIndex(0);
    }
  }, [cards, currentCardIndex]);

  // ─── Auto-fetch when running low ─────────────────────────────────────
  useEffect(() => {
    let fetchTimer: NodeJS.Timeout;
    const cardsWithoutLoading = cards.filter((c) => c.id !== LOADING_CARD_ID);
    if (
      cardsWithoutLoading.length < MIN_CARDS_THRESHOLD &&
      !isRefreshing &&
      !isFetchingMore.current
    ) {
      fetchTimer = setTimeout(() => {
        if (isFetchingMore.current) return;
        isFetchingMore.current = true;
        fetchCards(MIN_CARDS_THRESHOLD - cardsWithoutLoading.length + 1)
          .then((apiCards) => {
            if (apiCards.length > 0) {
              setCards((prevCards) => {
                const filtered = prevCards.filter((c) => c.id !== LOADING_CARD_ID);
                if (filtered.length >= MIN_CARDS_THRESHOLD) return prevCards;
                const updated = [...filtered, ...apiCards];
                setIsAnimating(false);
                translateX.value = 0;
                translateY.value = 0;
                return updated;
              });
            }
          })
          .catch((error) => {
            log.error("Error fetching cards:", error);
            setIsAnimating(false);
            translateX.value = 0;
            translateY.value = 0;
          })
          .finally(() => {
            isFetchingMore.current = false;
          });
      }, 300);
    }
    return () => { if (fetchTimer) clearTimeout(fetchTimer); };
  }, [cards.length, isRefreshing]);

  return {
    // State
    cards,
    setCards,
    currentCardIndex,
    setCurrentCardIndex,
    isLoadingInitialCards,
    isAnimating,
    isRefreshing,
    isFlipped,
    currentImageIndex,
    showSizeSelection,
    userSelectedSize,
    colorSelectorOpen,

    // Animation values (old Animated — kept for independent animations)
    fadeAnim,
    cartButtonScale,

    // Reanimated animated styles
    cardAnimatedStyle,
    frontFlipStyle,
    backFlipStyle,
    refreshAnimatedStyle,
    sizePanelAnimatedStyle,
    colorDropdownAnimatedStyle,

    // Gesture objects
    panGesture,
    headerPanGesture,

    // Refs
    imageScrollViewRef,
    scrollViewRef,
    imageCarouselWidth,
    screenWidth,
    screenHeight,

    // Handlers
    handleFlip,
    handleCartPressIn,
    handleCartPressOut,
    handleCartPress,
    handleCancelSizeSelection,
    handleSizeSelect,
    handleColorSelect,
    openColorSelector,
    closeColorSelector,
    handleImageScroll,
    scrollToImageIndex,
    handleImageLayout,
    toggleLike,
    handleLongPress,
    swipeCard,
    refreshCards,
    resetToButtons,
    resetVisualState,
    sizePanelMaxWidth,
  };
}
