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
  Text,
  Pressable,
  Dimensions,
  Platform,
  Animated as RNAnimated,
  Share,
  Linking,
  ScrollView,
  Alert,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ProgressiveBlurView } from "./lib/progressiveBlur";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { SkeletonSwipeCard } from "./components/SkeletonCard";
import Animated, {
  FadeInDown,
  FadeOutDown,
  ReduceMotion,
  useSharedValue,
  withTiming,
  useAnimatedStyle,
  interpolate,
  runOnJS,
} from "react-native-reanimated";
import { ANIMATION_DURATIONS, ANIMATION_DELAYS } from "./lib/animations";
import { useTheme } from "./lib/ThemeContext";
import type { ThemeColors } from "./lib/theme";

import Cart2 from "./components/svg/Cart2";
import Link from "./components/svg/Link";
import LinkPressed from "./components/svg/LinkPressed";
import ShareIcon from "./components/svg/Share";
import Cancel from "./components/svg/Cancel";
import * as api from "./services/api";
import { log } from "./services/config";
import { apiWrapper } from "./services/apiWrapper";
import { CardItem, CartItem } from "./types/product";
import { mapProductToCardItem } from "./lib/productMapper";
import {
  SwipeCard,
  CardFront,
  CardBack,
  HeartButton,
  createSwipeCardStyles,
} from "./components/swipeCard";
import { useSwipeDeck } from "./hooks/useSwipeDeck";
import {
  CARD_BACK_BOTTOM_INSET,
  CORNER_BOX_SIZE,
} from "./lib/swipeCardConstants";
import { getEffectivePrice, formatPrice } from "./lib/swipeCardUtils";

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

// Persistent card storage across navigation
const persistentCardStorage: {
  cards: CardItem[];
  initialized: boolean;
} = {
  cards: [],
  initialized: false,
};

// Fetch recommendations from API
const fetchMoreCards = async (count: number = 2): Promise<CardItem[]> => {
  try {
    const products = await apiWrapper.getUserRecommendations("MainPage");
    if (!products || !Array.isArray(products)) return [];
    return products
      .slice(0, count)
      .map((p: api.Product, i: number) => mapProductToCardItem(p, i));
  } catch (error: any) {
    if (error?.message?.toLowerCase().includes("invalid token")) {
      Alert.alert("сессия истекла", "пожалуйста, войдите в аккаунт снова.");
      return [];
    }
    log.error("Error fetching recommendations:", error);
    return [];
  }
};

const MainPage = ({ navigation, route }: MainPageProps) => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const cardStyles = useMemo(() => createSwipeCardStyles(theme, 41), [theme]);
  const styles = useMemo(() => createScreenStyles(theme), [theme]);
  const screenWidth = Dimensions.get("window").width;

  const deck = useSwipeDeck({
    cardWidthFraction: 0.88,
    fetchCards: fetchMoreCards,
    onAddToCart: (card, size, variantId) => {
      const cartItem: CartItem = {
        ...card,
        size,
        quantity: 1,
        delivery: { cost: 0, estimatedTime: "" },
        product_variant_id: variantId,
      };
      if (typeof global.cartStorage !== "undefined") {
        global.cartStorage.addItem(cartItem);
        if (Platform.OS === "ios") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        navigation.navigate("Cart");
      }
    },
    initialCards: persistentCardStorage.initialized
      ? persistentCardStorage.cards
      : undefined,
    onCardsChange: (cards) => {
      persistentCardStorage.cards = cards;
      persistentCardStorage.initialized = true;
    },
  });

  // ─── MainPage-specific state ─────────────────────────────────────────
  const [isLinkCopied, setIsLinkCopied] = useState(false);
  const [showLinkCopiedPopup, setShowLinkCopiedPopup] = useState(false);

  // Back-of-card size panel state
  const [showBackSizeSelection, setShowBackSizeSelection] = useState(false);
  const backSizePanelProgress = useSharedValue(0);
  const backCartButtonScale = useSharedValue(1);
  const backLinkButtonScale = useSharedValue(1);
  const backShareButtonScale = useSharedValue(1);

  const height = Dimensions.get("window").height;

  const backSizePillAnimatedStyle = useAnimatedStyle(() => ({
    opacity: backSizePanelProgress.value,
    transform: [
      {
        translateX: interpolate(backSizePanelProgress.value, [0, 1], [-12, 0]),
      },
    ],
  }));

  // ─── Deep linking ────────────────────────────────────────────────────
  useEffect(() => {
    const handleDeepLink = async (url: string) => {
      try {
        const match = url.match(/polka:\/\/product\/(.+)/);
        if (match?.[1]) {
          const product = await api.getProductDetails(match[1]);
          const cardItem = mapProductToCardItem(product);
          deck.setCards((prev) => {
            const filtered = prev.filter((c) => c.id !== cardItem.id);
            return [cardItem, ...filtered];
          });
          deck.setCurrentCardIndex(0);
        }
      } catch (error) {
        log.error("Error handling deep link:", error);
      }
    };
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink(url);
    });
    const sub = Linking.addEventListener("url", (e) => handleDeepLink(e.url));
    return () => sub.remove();
  }, []);

  // Initialize swipe count
  useEffect(() => {
    api.initializeSwipeCount().catch(() => {});
  }, []);

  // Route params: add card
  useEffect(() => {
    if (route?.params?.addCardItem) {
      const newCard = route.params.addCardItem;
      deck.setCards((prev) => {
        // Deduplicate: remove if already in deck
        const filtered = prev.filter((c) => c.id !== newCard.id);
        return [newCard, ...filtered];
      });
      deck.setCurrentCardIndex(0);
      // Reset flip/pan so the card doesn't inherit stale animation state
      deck.resetVisualState();
      navigation.setParams?.({ addCardItem: undefined });
    }
  }, [route?.params?.addCardItem]);

  // Route params: refresh (hard refresh — clears deck, fetches new)
  useEffect(() => {
    if (route?.params?.refreshCards && route?.params?.refreshTimestamp) {
      deck.hardRefresh();
      setTimeout(() => {
        navigation.setParams?.({
          refreshCards: undefined,
          refreshTimestamp: undefined,
        });
      }, 100);
    }
  }, [route?.params?.refreshTimestamp]);

  // ─── Back-side button handlers ───────────────────────────────────────
  const makePressHandlers = (scale: { value: number }) => ({
    onPressIn: () => {
      scale.value = withTiming(0.85, { duration: ANIMATION_DURATIONS.MICRO });
    },
    onPressOut: () => {
      scale.value = withTiming(1, { duration: ANIMATION_DURATIONS.FAST });
    },
  });

  const backCartAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: backCartButtonScale.value }],
  }));
  const backLinkAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: backLinkButtonScale.value }],
  }));
  const backShareAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: backShareButtonScale.value }],
  }));

  const backCartHandlers = makePressHandlers(backCartButtonScale);
  const backLinkHandlers = makePressHandlers(backLinkButtonScale);
  const backShareHandlers = makePressHandlers(backShareButtonScale);

  const handleBackCartPress = () => {
    if (showBackSizeSelection) {
      backSizePanelProgress.value = withTiming(0, { duration: ANIMATION_DURATIONS.FAST }, (finished) => {
        if (finished) runOnJS(setShowBackSizeSelection)(false);
      });
    } else {
      setShowBackSizeSelection(true);
      backSizePanelProgress.value = withTiming(1, { duration: ANIMATION_DURATIONS.SHORT });
    }
  };

  const resetToBackButtons = () => {
    backSizePanelProgress.set(0);
    setShowBackSizeSelection(false);
  };

  // Link/share handlers
  const handleLinkPress = useCallback(async () => {
    const card = deck.cards[deck.currentCardIndex];
    if (!card) return;
    try {
      await Clipboard.setStringAsync(`polka://product/${card.id}`);
      setIsLinkCopied(true);
      setShowLinkCopiedPopup(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setTimeout(() => {
        setIsLinkCopied(false);
        setShowLinkCopiedPopup(false);
      }, 2000);
    } catch (error) {
      log.error("Error copying link:", error);
    }
  }, [deck.cards, deck.currentCardIndex]);

  const handleDoubleTapLike = useCallback(() => {
    const card = deck.cards[deck.currentCardIndex];
    if (card && !card.isLiked) {
      deck.toggleLike(deck.currentCardIndex);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, [deck.cards, deck.currentCardIndex]);

  const handleSharePress = useCallback(async () => {
    const card = deck.cards[deck.currentCardIndex];
    if (!card) return;
    const productUrl = `polka://product/${card.id}`;
    try {
      await Share.share({
        message: `посмотрите ${card.name} от ${card.brand_name} на полке!\n${productUrl}`,
        title: card.name,
        url: productUrl,
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      log.error("Error sharing:", error);
    }
  }, [deck.cards, deck.currentCardIndex]);

  // ─── Render helpers ──────────────────────────────────────────────────
  const renderEmptyState = () => (
    <View style={[cardStyles.whiteBox, { overflow: "hidden" }]}>
      <SkeletonSwipeCard />
    </View>
  );

  const currentCard = deck.cards[deck.currentCardIndex];
  const hasSale = currentCard?.sale_price != null && currentCard.sale_price > 0;
  const displaySalePrice = hasSale ? getEffectivePrice(currentCard!) : null;

  const renderBackBottomStrip = (card: CardItem, index: number) => {
    const isLiked = card.isLiked === true;
    return (
      <View style={cardStyles.backBottomStrip}>
        {showLinkCopiedPopup && (
          <Animated.View
            entering={FadeInDown.duration(200).reduceMotion(ReduceMotion.System)}
            exiting={FadeOutDown.duration(200).reduceMotion(ReduceMotion.System)}
            style={cardStyles.linkCopiedPopup}
          >
            <Text style={cardStyles.linkCopiedText}>ссылка скопирована</Text>
          </Animated.View>
        )}
        <View style={cardStyles.backIconSlotsRow}>
          <View style={cardStyles.backCartSlot}>
            <Pressable
              style={cardStyles.backIconBox}
              {...backCartHandlers}
              onPress={handleBackCartPress}
            >
              <Animated.View style={backCartAnimStyle}>
                <Cart2 width={33} height={33} />
              </Animated.View>
            </Pressable>
          </View>
          <View style={cardStyles.backIconSpacer} />
          <Pressable
            style={cardStyles.backIconBox}
            {...backLinkHandlers}
            onPress={handleLinkPress}
          >
            <Animated.View style={backLinkAnimStyle}>
              {isLinkCopied ? (
                <LinkPressed width={33} height={33} />
              ) : (
                <Link width={33} height={33} />
              )}
            </Animated.View>
          </Pressable>
          <View style={cardStyles.backIconSpacer} />
          <Pressable
            style={cardStyles.backIconBox}
            {...backShareHandlers}
            onPress={handleSharePress}
          >
            <Animated.View style={backShareAnimStyle}>
              <ShareIcon width={33} height={33} />
            </Animated.View>
          </Pressable>
          <View style={cardStyles.backIconSpacer} />
          <View
            style={{
              width: CORNER_BOX_SIZE,
              height: CORNER_BOX_SIZE,
              justifyContent: "center",
              alignItems: "center",
              overflow: "visible",
            }}
            pointerEvents={showBackSizeSelection ? "none" : "auto"}
          >
            <HeartButton
              isLiked={isLiked}
              onToggleLike={() => deck.toggleLike(index)}
              onLongPress={() => deck.handleLongPress(index)}
              heartPressActiveRef={deck.heartPressActiveRef}
              heartRecentlyReleasedRef={deck.heartRecentlyReleasedRef}
            />
          </View>
        </View>
        {showBackSizeSelection && (
          <Animated.View
            style={[
              cardStyles.backSizePillPosition,
              { zIndex: 1001, elevation: 1002, padding: 6, margin: -6 },
              backSizePillAnimatedStyle,
            ]}
            onStartShouldSetResponder={() => true}
          >
            <View style={cardStyles.sizePill}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={cardStyles.sizePillScrollContent}
                style={cardStyles.sizePillScrollView}
              >
                {card?.variants?.map((variant) => {
                  const isAvail = variant.stock_quantity > 0;
                  const isUserSize = variant.size === deck.userSelectedSize;
                  const isOneSize = variant.size === "One Size";
                  return (
                    <Pressable
                      key={variant.size}
                      style={[
                        isOneSize ? cardStyles.sizeOval : cardStyles.sizeCircle,
                        isAvail
                          ? cardStyles.sizeCircleAvailable
                          : cardStyles.sizeCircleUnavailable,
                        isUserSize && isAvail
                          ? cardStyles.sizeCircleUserSize
                          : null,
                      ]}
                      onPress={() => {
                        if (isAvail) {
                          deck.handleSizeSelect(variant.size);
                          resetToBackButtons();
                        } else {
                          Haptics.impactAsync(
                            Haptics.ImpactFeedbackStyle.Light,
                          );
                        }
                      }}
                      disabled={!isAvail}
                    >
                      <Text
                        style={
                          isOneSize
                            ? cardStyles.sizeOvalText
                            : cardStyles.sizeText
                        }
                      >
                        {variant.size}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </Animated.View>
        )}
      </View>
    );
  };

  return (
    <Animated.View
      style={[styles.container, { paddingTop: insets.top }]}
      onStartShouldSetResponder={() =>
        deck.showSizeSelection || showBackSizeSelection
      }
      onResponderRelease={() => {
        if (deck.showSizeSelection) deck.handleCancelSizeSelection();
        if (showBackSizeSelection) resetToBackButtons();
      }}
    >
      {/* Progressive blur over dynamic island area */}
      {ProgressiveBlurView && insets.top >= 51 && (
        <ProgressiveBlurView
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: insets.top + 20,
            zIndex: 950,
          }}
          blurType="light"
          blurAmount={20}
          direction="blurredTopClearBottom"
          startOffset={0}
          pointerEvents="none"
        />
      )}

      <View style={styles.roundedBox}>
        <LinearGradient
          colors={theme.gradients.overlay as any}
          start={{ x: 0.1, y: 1 }}
          end={{ x: 0.9, y: 0.3 }}
          locations={theme.gradients.overlayLocations as any}
          style={styles.gradientBackground}
        />

        {/* Refreshing overlay — shows skeleton behind the fading card */}
        {deck.isRefreshing && (
          <View
            style={[
              cardStyles.whiteBox,
              { position: "absolute", zIndex: 0, overflow: "hidden" },
            ]}
          >
            <SkeletonSwipeCard />
          </View>
        )}

        {deck.cards.length > 0 ? (
          <SwipeCard
            card={deck.cards[deck.currentCardIndex]}
            styles={cardStyles}
            pan={deck.pan}
            refreshAnim={deck.refreshAnim}
            flipAnimation={deck.flipAnimation}
            isFlipped={deck.isFlipped}
            panResponder={deck.panResponder}
            renderEmpty={renderEmptyState}
            renderFront={() => (
              <CardFront
                card={deck.cards[deck.currentCardIndex]}
                index={deck.currentCardIndex}
                styles={cardStyles}
                imageCarouselWidth={deck.imageCarouselWidth}
                screenWidth={deck.screenWidth}
                cardWidthFraction={0.88}
                onImageLayout={deck.handleImageLayout}
                imageScrollViewRef={deck.imageScrollViewRef}
                onImageScroll={deck.handleImageScroll}
                currentImageIndex={deck.currentImageIndex}
                onScrollToImage={deck.scrollToImageIndex}
                onFlip={deck.handleFlip}
                showSizeSelection={deck.showSizeSelection}
                sizePanelAnimatedStyle={deck.sizePanelAnimatedStyle}
                cartButtonScale={deck.cartButtonScale}
                onCartPressIn={deck.handleCartPressIn}
                onCartPressOut={deck.handleCartPressOut}
                onCartPress={deck.handleCartPress}
                onCancelSizeSelection={deck.handleCancelSizeSelection}
                onSizeSelect={deck.handleSizeSelect}
                userSelectedSize={deck.userSelectedSize}
                colorSelectorOpen={deck.colorSelectorOpen}
                colorDropdownAnimatedStyle={deck.colorDropdownAnimatedStyle}
                onColorSelect={deck.handleColorSelect}
                onOpenColorSelector={deck.openColorSelector}
                onCloseColorSelector={deck.closeColorSelector}
                onToggleLike={() => deck.toggleLike(deck.currentCardIndex)}
                onLongPress={() => deck.handleLongPress(deck.currentCardIndex)}
                heartPressActiveRef={deck.heartPressActiveRef}
                heartRecentlyReleasedRef={deck.heartRecentlyReleasedRef}
                onDoubleTapLike={handleDoubleTapLike}
              />
            )}
            renderBack={() => (
              <CardBack
                card={deck.cards[deck.currentCardIndex]}
                styles={cardStyles}
                onFlip={deck.handleFlip}
                headerPanResponder={deck.headerPanResponder}
                scrollViewRef={deck.scrollViewRef}
                bottomStrip={renderBackBottomStrip(
                  deck.cards[deck.currentCardIndex],
                  deck.currentCardIndex,
                )}
              />
            )}
          />
        ) : (
          renderEmptyState()
        )}

        {deck.isRefreshing ? (
          <View style={{ width: "100%", height: "100%" }}>
            <View style={cardStyles.text}>
              <Text style={cardStyles.brandName}>обновляем...</Text>
              <Text style={cardStyles.price}> </Text>
            </View>
          </View>
        ) : (
          <RNAnimated.View
            style={{ opacity: deck.refreshAnim, width: "100%", height: "100%" }}
          >
            <RNAnimated.View
              style={[cardStyles.text, { opacity: deck.fadeAnim }]}
            >
              {deck.cards.length > 0 ? (
                <>
                  <Text
                    style={cardStyles.brandName}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.5}
                  >
                    {currentCard?.brand_name || "бренд не указан"}
                  </Text>
                  {hasSale ? (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <Text
                        style={[
                          cardStyles.price,
                          cardStyles.priceStrikethrough,
                        ]}
                      >
                        {`${formatPrice(currentCard!.price)} ₽`}
                      </Text>
                      <Text style={[cardStyles.price, cardStyles.priceSale]}>
                        {`${formatPrice(displaySalePrice!)} ₽`}
                      </Text>
                    </View>
                  ) : (
                    <Text style={cardStyles.price}>
                      {`${currentCard ? formatPrice(currentCard.price) : "0,00"} ₽`}
                    </Text>
                  )}
                </>
              ) : (
                <>
                  <Text style={cardStyles.name} numberOfLines={1}>
                    загрузка...
                  </Text>
                  <Text style={cardStyles.price}>пожалуйста, подождите</Text>
                </>
              )}
            </RNAnimated.View>
          </RNAnimated.View>
        )}
      </View>
    </Animated.View>
  );
};

const createScreenStyles = (theme: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
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
      backgroundColor: theme.primary + "00",
      position: "relative",
      borderWidth: 3,
      borderColor: theme.primary + "66",
      zIndex: 900,
      overflow: "visible",
    },
  });

export default MainPage;
