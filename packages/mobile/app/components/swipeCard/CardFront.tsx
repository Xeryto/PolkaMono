import React from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Animated as RNAnimated,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { Image } from "expo-image";
import { TouchableOpacity } from "react-native-gesture-handler";
import Animated from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../../lib/ThemeContext";
import { SkeletonSwipeCard } from "../SkeletonCard";
import Cart2 from "../svg/Cart2";
import More from "../svg/More";
import Cancel from "../svg/Cancel";
import HeartButton from "./HeartButton";
import { CardItem } from "../../types/product";
import { LOADING_CARD_ID } from "../../lib/swipeCardConstants";
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
  // Color selector
  colorSelectorOpen: boolean;
  colorDropdownAnimatedStyle: any;
  onColorSelect: (index: number) => void;
  onOpenColorSelector: (count: number) => void;
  onCloseColorSelector: () => void;
  // Like
  onToggleLike: () => void;
  onLongPress: () => void;
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
  colorSelectorOpen,
  colorDropdownAnimatedStyle,
  onColorSelect,
  onOpenColorSelector,
  onCloseColorSelector,
  onToggleLike,
  onLongPress,
}) => {
  const { theme } = useTheme();

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
              <Text style={styles.imagePlaceholderText}>Нет изображения</Text>
            </View>
          )}
        </View>
      </View>

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

      {/* Bottom-left: size panel */}
      <View style={styles.cornerOverlayBottomLeft} pointerEvents="box-none">
        <View style={styles.sizePanelPosition}>
          <Animated.View style={[styles.sizePanelOuter, sizePanelAnimatedStyle]}>
            <View style={styles.sizePanelRow}>
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
                        isAvailable ? styles.sizeCircleAvailable : styles.sizeCircleUnavailable,
                        isUserSize && isAvailable ? styles.sizeCircleUserSize : null,
                        variantIndex > 0 ? { marginLeft: 10 } : null,
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
                      <Text style={isOneSize ? styles.sizeOvalText : styles.sizeText}>
                        {variant.size}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <Pressable onPress={onCancelSizeSelection} style={styles.sizePanelCancelButton}>
                <Cancel width={27} height={27} />
              </Pressable>
            </View>
          </Animated.View>
        </View>
      </View>

      {/* Bottom-right: heart */}
      <View style={styles.cornerOverlayBottomRight} pointerEvents="box-none">
        <View style={styles.cornerInnerBottomRight}>
          <View style={[styles.cornerOverlayBottomRightInner, { position: "relative" }]}>
            <View style={{ zIndex: 999 }}>
              <HeartButton isLiked={isLiked} onToggleLike={onToggleLike} />
            </View>
            <Pressable
              style={[StyleSheet.absoluteFill, { zIndex: 998 }]}
              onLongPress={onLongPress}
              delayLongPress={300}
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
