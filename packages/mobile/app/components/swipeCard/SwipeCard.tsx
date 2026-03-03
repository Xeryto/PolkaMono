import React from "react";
import {
  View,
  StyleSheet,
} from "react-native";
import Animated, { AnimatedStyle } from "react-native-reanimated";
import { GestureDetector, GestureType } from "react-native-gesture-handler";
import { CardItem } from "../../types/product";

interface SwipeCardProps {
  card: CardItem;
  nextCard?: CardItem | null;
  styles: any;
  cardAnimatedStyle: AnimatedStyle;
  refreshAnimatedStyle: AnimatedStyle;
  frontFlipStyle: AnimatedStyle;
  backFlipStyle: AnimatedStyle;
  isFlipped: boolean;
  panGesture: GestureType;
  renderFront: () => React.ReactNode;
  renderBack: () => React.ReactNode;
  renderNextCardFront?: () => React.ReactNode;
  renderEmpty: () => React.ReactNode;
}

const SwipeCard: React.FC<SwipeCardProps> = ({
  card,
  nextCard,
  styles,
  cardAnimatedStyle,
  refreshAnimatedStyle,
  frontFlipStyle,
  backFlipStyle,
  isFlipped,
  panGesture,
  renderFront,
  renderBack,
  renderNextCardFront,
  renderEmpty,
}) => {
  if (!card) {
    return renderEmpty() as React.ReactElement;
  }

  const frontPointerEvents = isFlipped ? "none" : "auto";
  const backPointerEvents = isFlipped ? "auto" : "none";
  const frontZIndex = isFlipped ? 1 : 2;
  const backZIndex = isFlipped ? 2 : 1;

  return (
    <View style={localStyles.container}>
      {/* ── LAYER 1: Next card (behind, non-interactive preview) ── */}
      {nextCard && renderNextCardFront && (
        <Animated.View
          style={[
            styles.whiteBox,
            refreshAnimatedStyle,
            {
              backgroundColor: "transparent",
              shadowColor: "transparent",
              elevation: 0,
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            },
          ]}
          pointerEvents="none"
        >
          <View style={[StyleSheet.absoluteFill, { backfaceVisibility: "hidden" }]}>
            <View style={styles.cardFace}>
              {renderNextCardFront()}
            </View>
          </View>
        </Animated.View>
      )}

      {/* ── LAYER 2: Current card (on top, gesture-driven) ── */}
      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={[
            styles.whiteBox,
            cardAnimatedStyle,
            refreshAnimatedStyle,
            {
              backgroundColor: "transparent",
              shadowColor: "transparent",
              elevation: 0,
              zIndex: 10,
            },
          ]}
        >
          {/* Front Face */}
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              {
                backfaceVisibility: "hidden",
                zIndex: frontZIndex,
                pointerEvents: frontPointerEvents,
              },
              frontFlipStyle,
            ]}
          >
            <View style={styles.cardFace}>{renderFront()}</View>
          </Animated.View>

          {/* Back Face */}
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              {
                backfaceVisibility: "hidden",
                zIndex: backZIndex,
                pointerEvents: backPointerEvents,
              },
              backFlipStyle,
            ]}
          >
            <View style={styles.cardFace}>{renderBack()}</View>
          </Animated.View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

const localStyles = StyleSheet.create({
  container: {
    flex: 1,
    position: "relative",
  },
});

export default SwipeCard;
