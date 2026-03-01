import React from "react";
import {
  View,
  StyleSheet,
  Animated as RNAnimated,
  PanResponderInstance,
} from "react-native";
import { CardItem } from "../../types/product";

interface SwipeCardProps {
  card: CardItem;
  styles: any;
  pan: RNAnimated.ValueXY;
  refreshAnim: RNAnimated.Value;
  flipAnimation: RNAnimated.Value;
  isFlipped: boolean;
  panResponder: PanResponderInstance;
  renderFront: () => React.ReactNode;
  renderBack: () => React.ReactNode;
  renderEmpty: () => React.ReactNode;
}

const SwipeCard: React.FC<SwipeCardProps> = ({
  card,
  styles,
  pan,
  refreshAnim,
  flipAnimation,
  isFlipped,
  panResponder,
  renderFront,
  renderBack,
  renderEmpty,
}) => {
  if (!card) {
    return renderEmpty() as React.ReactElement;
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
        <View style={styles.cardFace}>{renderFront()}</View>
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
        <View style={styles.cardFace}>{renderBack()}</View>
      </RNAnimated.View>
    </RNAnimated.View>
  );
};

export default SwipeCard;
