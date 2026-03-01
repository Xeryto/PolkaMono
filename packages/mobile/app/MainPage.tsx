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
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { SkeletonSwipeCard } from "./components/SkeletonCard";
import Animated, {
  FadeInDown,
  FadeOutDown,
  useSharedValue,
  withTiming,
  useAnimatedStyle,
} from "react-native-reanimated";
import {
  ANIMATION_DURATIONS,
  ANIMATION_DELAYS,
} from "./lib/animations";
import { useTheme } from "./lib/ThemeContext";
import type { ThemeColors } from "./lib/theme";

import Cart2 from "./components/svg/Cart2";
import Link from "./components/svg/Link";
import LinkPressed from "./components/svg/LinkPressed";
import ShareIcon from "./components/svg/Share";
import Cancel from "./components/svg/Cancel";
import * as api from "./services/api";
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
  CORNER_BOX_SIZE,
  SIZE_PANEL_CLOSED_WIDTH,
  CARD_BACK_BOTTOM_INSET,
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
    return products.slice(0, count).map((p: api.Product, i: number) => mapProductToCardItem(p, i));
  } catch (error: any) {
    if (error?.message?.toLowerCase().includes("invalid token")) {
      Alert.alert("сессия истекла", "пожалуйста, войдите в аккаунт снова.");
      return [];
    }
    console.error("Error fetching recommendations:", error);
    return [];
  }
};

const MainPage = ({ navigation, route }: MainPageProps) => {
  const { theme } = useTheme();
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
    initialCards: persistentCardStorage.initialized ? persistentCardStorage.cards : undefined,
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
  const backSizePanelWidth = useSharedValue(SIZE_PANEL_CLOSED_WIDTH);
  const backCartButtonScale = useRef(new RNAnimated.Value(1)).current;
  const backLinkButtonScale = useRef(new RNAnimated.Value(1)).current;
  const backShareButtonScale = useRef(new RNAnimated.Value(1)).current;

  const cardWidth = screenWidth * 0.88;
  const sizePanelMaxWidth = cardWidth - 20 * 2;

  const backSizePanelTailAnimatedStyle = useAnimatedStyle(() => ({
    width: Math.max(0, backSizePanelWidth.value - CORNER_BOX_SIZE),
    overflow: "hidden" as const,
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
        console.error("Error handling deep link:", error);
      }
    };
    Linking.getInitialURL().then((url) => { if (url) handleDeepLink(url); });
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

  // Route params: refresh
  useEffect(() => {
    if (route?.params?.refreshCards && route?.params?.refreshTimestamp) {
      deck.refreshCards();
      setTimeout(() => {
        navigation.setParams?.({ refreshCards: undefined, refreshTimestamp: undefined });
      }, 100);
    }
  }, [route?.params?.refreshTimestamp]);

  // ─── Back-side button handlers ───────────────────────────────────────
  const makePressHandlers = (scale: RNAnimated.Value) => ({
    onPressIn: () => {
      RNAnimated.timing(scale, { toValue: 0.85, duration: 80, useNativeDriver: true, easing: require("react-native").Easing.inOut(require("react-native").Easing.ease) }).start();
    },
    onPressOut: () => {
      RNAnimated.timing(scale, { toValue: 1, duration: 150, useNativeDriver: true, easing: require("react-native").Easing.inOut(require("react-native").Easing.ease) }).start();
    },
  });

  const backCartHandlers = makePressHandlers(backCartButtonScale);
  const backLinkHandlers = makePressHandlers(backLinkButtonScale);
  const backShareHandlers = makePressHandlers(backShareButtonScale);

  const handleBackCartPress = () => {
    setShowBackSizeSelection(true);
    backSizePanelWidth.value = withTiming(sizePanelMaxWidth, { duration: 280 });
  };

  const handleCancelBackSizeSelection = () => {
    backSizePanelWidth.value = withTiming(SIZE_PANEL_CLOSED_WIDTH, { duration: 220 });
    requestAnimationFrame(() => setTimeout(() => setShowBackSizeSelection(false), 220));
  };

  const resetToBackButtons = () => {
    backSizePanelWidth.set(SIZE_PANEL_CLOSED_WIDTH);
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
      setTimeout(() => { setIsLinkCopied(false); setShowLinkCopiedPopup(false); }, 2000);
    } catch (error) {
      console.error("Error copying link:", error);
    }
  }, [deck.cards, deck.currentCardIndex]);

  const handleSharePress = useCallback(async () => {
    const card = deck.cards[deck.currentCardIndex];
    if (!card) return;
    const productUrl = `polka://product/${card.id}`;
    try {
      await Share.share({
        message: `Посмотрите ${card.name} от ${card.brand_name} на Полке!\n${productUrl}`,
        title: card.name,
        url: productUrl,
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.error("Error sharing:", error);
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
            entering={FadeInDown.duration(200)}
            exiting={FadeOutDown.duration(200)}
            style={cardStyles.linkCopiedPopup}
          >
            <Text style={cardStyles.linkCopiedText}>Ссылка скопирована</Text>
          </Animated.View>
        )}
        <View style={cardStyles.backIconSlotsRow}>
          <View style={cardStyles.backCartSlot}>
            <Pressable
              style={cardStyles.backIconBox}
              {...backCartHandlers}
              onPress={handleBackCartPress}
            >
              <RNAnimated.View style={{ transform: [{ scale: backCartButtonScale }] }}>
                <Cart2 width={33} height={33} />
              </RNAnimated.View>
            </Pressable>
            <Animated.View
              style={[
                cardStyles.backSizePanelTail,
                backSizePanelTailAnimatedStyle,
                { zIndex: 1001, elevation: 1002 },
              ]}
              pointerEvents={showBackSizeSelection ? "auto" : "none"}
            >
              <View style={cardStyles.sizePanelRow}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={cardStyles.sizeScrollContent}
                  style={cardStyles.sizePanelScrollView}
                >
                  {card?.variants?.map((variant, vi) => {
                    const isAvail = variant.stock_quantity > 0;
                    const isUserSize = variant.size === deck.userSelectedSize;
                    const isOneSize = variant.size === "One Size";
                    return (
                      <Pressable
                        key={variant.size}
                        style={[
                          isOneSize ? cardStyles.sizeOval : cardStyles.sizeCircle,
                          isAvail ? cardStyles.sizeCircleAvailable : cardStyles.sizeCircleUnavailable,
                          isUserSize && isAvail ? cardStyles.sizeCircleUserSize : null,
                          vi > 0 ? { marginLeft: 10 } : null,
                        ]}
                        onPress={() => {
                          if (isAvail) {
                            deck.handleSizeSelect(variant.size);
                            resetToBackButtons();
                          } else {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          }
                        }}
                        disabled={!isAvail}
                      >
                        <Text style={isOneSize ? cardStyles.sizeOvalText : cardStyles.sizeText}>
                          {variant.size}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
                <Pressable onPress={handleCancelBackSizeSelection} style={cardStyles.sizePanelCancelButton}>
                  <Cancel width={27} height={27} />
                </Pressable>
              </View>
            </Animated.View>
          </View>
          <View style={cardStyles.backIconSpacer} />
          <Pressable style={cardStyles.backIconBox} {...backLinkHandlers} onPress={handleLinkPress}>
            <RNAnimated.View style={{ transform: [{ scale: backLinkButtonScale }] }}>
              {isLinkCopied ? <LinkPressed width={33} height={33} /> : <Link width={33} height={33} />}
            </RNAnimated.View>
          </Pressable>
          <View style={cardStyles.backIconSpacer} />
          <Pressable style={cardStyles.backIconBox} {...backShareHandlers} onPress={handleSharePress}>
            <RNAnimated.View style={{ transform: [{ scale: backShareButtonScale }] }}>
              <ShareIcon width={33} height={33} />
            </RNAnimated.View>
          </Pressable>
          <View style={cardStyles.backIconSpacer} />
          <View style={cardStyles.backIconBoxWrapper}>
            <View style={cardStyles.backIconBox}>
              <HeartButton isLiked={isLiked} onToggleLike={() => deck.toggleLike(index)} />
            </View>
            <Pressable
              style={StyleSheet.absoluteFill}
              onLongPress={() => deck.handleLongPress(index)}
              delayLongPress={300}
            />
          </View>
        </View>
      </View>
    );
  };

  return (
    <Animated.View
      style={styles.container}
      entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(ANIMATION_DELAYS.LARGE)}
      exiting={FadeOutDown.duration(ANIMATION_DURATIONS.MICRO)}
    >
      <View style={styles.roundedBox}>
        <LinearGradient
          colors={theme.gradients.overlay as any}
          start={{ x: 0.1, y: 1 }}
          end={{ x: 0.9, y: 0.3 }}
          locations={theme.gradients.overlayLocations as any}
          style={styles.gradientBackground}
        />

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
              />
            )}
            renderBack={() => (
              <CardBack
                card={deck.cards[deck.currentCardIndex]}
                styles={cardStyles}
                onFlip={deck.handleFlip}
                headerPanResponder={deck.headerPanResponder}
                scrollViewRef={deck.scrollViewRef}
                bottomStrip={renderBackBottomStrip(deck.cards[deck.currentCardIndex], deck.currentCardIndex)}
              />
            )}
          />
        ) : (
          renderEmptyState()
        )}

        <RNAnimated.View style={{ opacity: deck.refreshAnim, width: "100%", height: "100%" }}>
          <RNAnimated.View style={[cardStyles.text, { opacity: deck.fadeAnim }]}>
            {deck.cards.length > 0 ? (
              <>
                <Text style={cardStyles.brandName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
                  {currentCard?.brand_name || "бренд не указан"}
                </Text>
                {hasSale ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={[cardStyles.price, cardStyles.priceStrikethrough]}>
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
                <Text style={cardStyles.name} numberOfLines={1}>Загрузка...</Text>
                <Text style={cardStyles.price}>Пожалуйста, подождите</Text>
              </>
            )}
          </RNAnimated.View>
        </RNAnimated.View>
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
    },
  });

export default MainPage;
