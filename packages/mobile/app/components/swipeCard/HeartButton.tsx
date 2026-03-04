import React, { useState, useRef } from "react";
import { View, Pressable, StyleSheet, GestureResponderEvent } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  runOnJS,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import Heart2 from "../svg/Heart2";
import HeartFilled from "../svg/HeartFilled";

interface HeartButtonProps {
  isLiked: boolean;
  onToggleLike: () => void;
  onLongPress: () => void;
  heartPressActiveRef: React.MutableRefObject<boolean>;
  heartRecentlyReleasedRef: React.MutableRefObject<boolean>;
}

const SPRING_CONFIG = { mass: 0.2, damping: 12, stiffness: 600 };
const MOVE_THRESHOLD = 10;

const HeartButton: React.FC<HeartButtonProps> = ({
  isLiked,
  onToggleLike,
  onLongPress,
  heartPressActiveRef,
  heartRecentlyReleasedRef,
}) => {
  const heartScale = useSharedValue(1);
  const pressScale = useSharedValue(1);
  const [isAnimating, setIsAnimating] = useState(false);
  const pressOrigin = useRef<{ x: number; y: number } | null>(null);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value * heartScale.value }],
  }));

  const handlePressIn = (e: GestureResponderEvent) => {
    pressOrigin.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
    heartPressActiveRef.current = true;
    pressScale.value = withSpring(0.85, { mass: 0.3, damping: 15, stiffness: 500 });
  };

  const handlePressOut = (e: GestureResponderEvent) => {
    heartPressActiveRef.current = false;
    heartRecentlyReleasedRef.current = true;
    setTimeout(() => { heartRecentlyReleasedRef.current = false; }, 150);
    pressScale.value = withSpring(1, { mass: 0.3, damping: 15, stiffness: 500 });

    if (pressOrigin.current) {
      const dx = Math.abs(e.nativeEvent.pageX - pressOrigin.current.x);
      const dy = Math.abs(e.nativeEvent.pageY - pressOrigin.current.y);
      if (dx > MOVE_THRESHOLD || dy > MOVE_THRESHOLD) {
        pressOrigin.current = null;
        return;
      }
    }
    pressOrigin.current = null;
    handlePress();
  };

  const handlePress = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    onToggleLike();
    Haptics.impactAsync(
      isLiked ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium,
    );
    heartScale.value = withSequence(
      withSpring(1.3, SPRING_CONFIG),
      withSpring(1, SPRING_CONFIG, () => {
        "worklet";
        runOnJS(setIsAnimating)(false);
      }),
    );
  };

  return (
    <View
      style={localStyles.wrapper}
      onStartShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
    >
      <View style={{ zIndex: 999 }}>
        <Pressable
          style={localStyles.pressable}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          android_ripple={{ color: "rgba(0,0,0,0.1)", radius: 20, borderless: true }}
        >
          <Animated.View style={animatedStyle}>
            {isLiked ? (
              <HeartFilled width={33} height={33} />
            ) : (
              <Heart2 width={33} height={33} />
            )}
          </Animated.View>
        </Pressable>
      </View>
      <Pressable
        style={[StyleSheet.absoluteFill, { zIndex: 998 }]}
        onPressIn={() => { heartPressActiveRef.current = true; }}
        onPressOut={() => {
          heartPressActiveRef.current = false;
          heartRecentlyReleasedRef.current = true;
          setTimeout(() => { heartRecentlyReleasedRef.current = false; }, 150);
        }}
        onLongPress={onLongPress}
        delayLongPress={300}
      />
    </View>
  );
};

const localStyles = StyleSheet.create({
  wrapper: {
    justifyContent: "center",
    alignItems: "center",
    overflow: "visible",
    position: "relative",
  },
  // 44pt minimum tap target: 33px icon + 6px padding each side = 45px
  pressable: {
    padding: 6,
    zIndex: 10,
  },
});

export default HeartButton;
