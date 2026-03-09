import React from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Animated as RNAnimated,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { Image } from "expo-image";
import { TouchableOpacity, Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withSpring,
  withTiming,
  withDelay,
  runOnJS,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../../lib/ThemeContext";
import { SkeletonSwipeCard } from "../SkeletonCard";
import Cart2 from "../svg/Cart2";
import More from "../svg/More";
import Cancel from "../svg/Cancel";
import Svg, { Path } from "react-native-svg";
import HeartButton from "./HeartButton";
import { CardItem } from "../../types/product";
import { LOADING_CARD_ID } from "../../lib/swipeCardConstants";
import { SPRING_CONFIGS } from "../../lib/animations";
import type { ViewStyle } from "react-native";

const RAINBOW_COLORS = ["#FF0000", "#FF7F00", "#FFFF00", "#00FF00", "#0000FF", "#4B0082", "#8B00FF"] as const;

const ColorSwatch = ({ colorHex, style }: { colorHex?: string; style: ViewStyle }) => {
  if (colorHex && !colorHex.startsWith("#")) {
    return (
      <LinearGradient
        colors={[...RAINBOW_COLORS]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={style}
      />
    );
  }
  return <View style={[style, { backgroundColor: colorHex || "#808080" }]} />;
};

interface CardFrontProps {
  card: CardItem;
  index: number;
  styles: any;
  // Image carousel
  imageCarouselWidth: number;
  screenWidth: number;
  cardWidthFraction: number;
  onImageLayout: (width: number) => void;
  imageScrollViewRef: React.RefObject<ScrollView | null>;
  onImageScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  currentImageIndex: number;
  onScrollToImage: (index: number) => void;
  // Flip
  onFlip: () => void;
  // Size panel
  showSizeSelection: boolean;
  sizePanelAnimatedStyle: any;
  cartButtonScale: RNAnimated.Value;
  onCartPressIn: () => void;
  onCartPressOut: () => void;
  onCartPress: () => void;
  onCancelSizeSelection: () => void;
  onSizeSelect: (size: string) => void;
  userSelectedSize: string | null;
  friendSelectedSize?: string | null;
  // Color selector
  colorSelectorOpen: boolean;
  colorDropdownAnimatedStyle: any;
  onColorSelect: (index: number) => void;
  onOpenColorSelector: (count: number) => void;
  onCloseColorSelector: () => void;
  // Like
  onToggleLike: () => void;
  onLongPress: () => void;
  heartPressActiveRef: React.MutableRefObject<boolean>;
  heartRecentlyReleasedRef: React.MutableRefObject<boolean>;
  // Double-tap like
  onDoubleTapLike?: () => void;
}

const CardFront: React.FC<CardFrontProps> = ({
  card,
  index,
  styles,
  imageCarouselWidth,
  screenWidth,
  cardWidthFraction,
  onImageLayout,
  imageScrollViewRef,
  onImageScroll,
  currentImageIndex,
  onScrollToImage,
  onFlip,
  showSizeSelection,
  sizePanelAnimatedStyle,
  cartButtonScale,
  onCartPressIn,
  onCartPressOut,
  onCartPress,
  onCancelSizeSelection,
  onSizeSelect,
  userSelectedSize,
  friendSelectedSize,
  colorSelectorOpen,
  colorDropdownAnimatedStyle,
  onColorSelect,
  onOpenColorSelector,
  onCloseColorSelector,
  onToggleLike,
  onLongPress,
  heartPressActiveRef,
  heartRecentlyReleasedRef,
  onDoubleTapLike,
}) => {
  const { theme } = useTheme();

  // Double-tap heart overlay animation
  const heartOverlayScale = useSharedValue(0);
  const heartOverlayOpacity = useSharedValue(0);
  const heartOverlayX = useSharedValue(0);
  const heartOverlayY = useSharedValue(0);

  const heartOverlayAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: heartOverlayX.value },
      { translateY: heartOverlayY.value },
      { scale: heartOverlayScale.value },
    ],
    opacity: heartOverlayOpacity.value,
  }));

  const fireDoubleTapLike = () => {
    onDoubleTapLike?.();
  };

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((e) => {
      heartOverlayX.value = e.x;
      heartOverlayY.value = e.y;
      heartOverlayScale.value = withSequence(
        withSpring(1.2, SPRING_CONFIGS.DOUBLE_TAP_IN),
        withSpring(1, SPRING_CONFIGS.DOUBLE_TAP_OUT),
      );
      heartOverlayOpacity.value = 1;
      heartOverlayOpacity.value = withDelay(250, withTiming(0, { duration: 300 }));
      runOnJS(fireDoubleTapLike)();
    });

  if (card.id === LOADING_CARD_ID) {
    return (
      <View style={{ flex: 1 }}>
        <SkeletonSwipeCard />
      </View>
    );
  }

  const isLiked = card.isLiked === true;
  const fallbackContainerWidth = imageCarouselWidth || screenWidth * cardWidthFraction;

  return (
    <>
      {/* Image area */}
      <GestureDetector gesture={doubleTapGesture}>
        <View style={styles.imageHolder} pointerEvents="box-none">
          <View
            style={styles.imageFullBleed}
            onLayout={(event: any) => onImageLayout(event.nativeEvent.layout.width)}
          >
            {card.images.length > 1 ? (
              <ScrollView
                ref={imageScrollViewRef as any}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                decelerationRate="fast"
                onMomentumScrollEnd={onImageScroll}
                style={styles.imageCarousel}
              >
                {card.images.map((imageSource, imgIndex) => (
                  <View
                    key={`${card.id}-image-${imgIndex}`}
                    style={[styles.imageContainer, { width: fallbackContainerWidth }]}
                  >
                    <Image source={imageSource} style={styles.image} contentFit="contain" />
                  </View>
                ))}
              </ScrollView>
            ) : card.images.length > 0 ? (
              <View style={styles.imagePressable}>
                <Image
                  key={card.id + "-" + currentImageIndex}
                  source={card.images[0]}
                  style={styles.image}
                  contentFit="contain"
                />
              </View>
            ) : (
              <View style={[styles.imagePressable, styles.imagePlaceholder]}>
                <Text style={styles.imagePlaceholderText}>нет изображения</Text>
              </View>
            )}
          </View>

          {/* Double-tap heart overlay */}
          <Animated.View
            style={[styles.doubleTapHeartOverlay, heartOverlayAnimatedStyle]}
            pointerEvents="none"
          >
            <Svg width={60} height={60} viewBox="0 0 33 30" fill="none">
              <Path
                d="M28.655 4.3387C27.9527 3.63608 27.1189 3.07871 26.2011 2.69844C25.2834 2.31816 24.2997 2.12244 23.3062 2.12244C22.3128 2.12244 21.3291 2.31816 20.4114 2.69844C19.4936 3.07871 18.6598 3.63608 17.9575 4.3387L16.5 5.7962L15.0425 4.3387C13.6239 2.92012 11.6999 2.12317 9.69375 2.12317C7.68758 2.12317 5.76357 2.92012 4.345 4.3387C2.92642 5.75727 2.12947 7.68128 2.12947 9.68745C2.12947 11.6936 2.92642 13.6176 4.345 15.0362L16.5 27.1912L28.655 15.0362C29.3576 14.3339 29.915 13.5001 30.2953 12.5823C30.6755 11.6646 30.8713 10.6809 30.8713 9.68745C30.8713 8.69403 30.6755 7.71034 30.2953 6.79258C29.915 5.87483 29.3576 5.04099 28.655 4.3387Z"
                fill="white"
                stroke="white"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </Animated.View>
        </View>
      </GestureDetector>

      {/* Top-right: flip/more */}
      <View style={styles.cornerOverlayTopRight} pointerEvents="box-none">
        <View style={styles.cornerInnerTopRight}>
          <Pressable onPress={onFlip}>
            <More width={33} height={33} />
          </Pressable>
        </View>
      </View>

      {/* Image dots */}
      {card.images.length > 1 && (
        <View style={styles.imageDotsContainer}>
          {card.images.map((_, dotIndex) => (
            <Pressable
              key={dotIndex}
              style={[styles.imageDot, dotIndex === currentImageIndex && styles.imageDotActive]}
              onPress={() => onScrollToImage(dotIndex)}
            />
          ))}
        </View>
      )}

      {/* Bottom-left: cart icon background */}
      <View style={styles.cornerOverlayBottomLeft} pointerEvents="box-none" />

      {/* Cart button — fixed in bottom-left corner */}
      <View style={[styles.sizePanelCartPosition, { zIndex: 30, elevation: 31 }]} pointerEvents="box-none">
        <Pressable
          style={styles.cornerOverlayBottomLeftInner}
          onPressIn={onCartPressIn}
          onPressOut={onCartPressOut}
          onPress={onCartPress}
        >
          <RNAnimated.View style={{ transform: [{ scale: cartButtonScale }] }}>
            <Cart2 width={33} height={33} />
          </RNAnimated.View>
        </Pressable>
      </View>

      {/* Floating size pill — to the right of cart */}
      {showSizeSelection && (
        <Animated.View
          style={[styles.sizePillPosition, { zIndex: 35, elevation: 36, padding: 6, margin: -6 }, sizePanelAnimatedStyle]}
          onStartShouldSetResponder={() => true}
        >
          <View style={styles.sizePill}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.sizePillScrollContent}
              style={styles.sizePillScrollView}
            >
              {card?.variants?.map((variant) => {
                const isAvailable = variant.stock_quantity > 0;
                const isUserSize = friendSelectedSize === undefined && variant.size === userSelectedSize;
                const isFriendSize = !!friendSelectedSize && variant.size === friendSelectedSize;
                const isOneSize = variant.size === "One Size";
                return (
                  <Pressable
                    key={variant.size}
                    style={[
                      isOneSize ? styles.sizeOval : styles.sizeCircle,
                      isAvailable ? styles.sizeCircleAvailable : styles.sizeCircleUnavailable,
                      isUserSize && isAvailable ? styles.sizeCircleUserSize : null,
                      isFriendSize && isAvailable ? { overflow: 'hidden' as const } : null,
                    ]}
                    onPress={() => {
                      if (isAvailable) {
                        onSizeSelect(variant.size);
                      } else {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }
                    }}
                    disabled={!isAvailable}
                  >
                    {isFriendSize && isAvailable && (
                      <LinearGradient
                        colors={['rgba(255,16,251,0.30)', 'rgba(3,65,234,0.15)']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: isOneSize ? 20 : 20.5 }}
                      />
                    )}
                    <Text style={isOneSize ? styles.sizeOvalText : styles.sizeText}>
                      {variant.size}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </Animated.View>
      )}

      {/* Bottom-right: heart — disabled when size panel is open */}
      <View style={styles.cornerOverlayBottomRight} pointerEvents={showSizeSelection ? "none" : "box-none"}>
        <View style={styles.cornerInnerBottomRight}>
          <View style={styles.cornerOverlayBottomRightInner}>
            <HeartButton
              isLiked={isLiked}
              onToggleLike={onToggleLike}
              onLongPress={onLongPress}
              heartPressActiveRef={heartPressActiveRef}
              heartRecentlyReleasedRef={heartRecentlyReleasedRef}
            />
          </View>
        </View>
      </View>

      {/* Top-left: color selector */}
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
                onPress={() => onOpenColorSelector(card.color_variants?.length ?? 0)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.7}
              >
                <View style={styles.colorSelectorSelectedRing}>
                  <ColorSwatch
                    colorHex={card.color_variants[card.selected_color_index]?.color_hex}
                    style={styles.colorSwatchCircle}
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
                        onPress={() => onColorSelect(idx)}
                        activeOpacity={0.7}
                      >
                        <ColorSwatch
                          colorHex={cv.color_hex}
                          style={styles.colorSwatchCircleSmall}
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
};

export default CardFront;
