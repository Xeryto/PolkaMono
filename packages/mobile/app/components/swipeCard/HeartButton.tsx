import React, { useState } from "react";
import { Pressable } from "react-native";
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
}

const SPRING_CONFIG = { mass: 0.2, damping: 12, stiffness: 600 };

const HeartButton: React.FC<HeartButtonProps> = ({ isLiked, onToggleLike }) => {
  const heartScale = useSharedValue(1);
  const pressScale = useSharedValue(1);
  const [isAnimating, setIsAnimating] = useState(false);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: pressScale.value * heartScale.value },
    ],
  }));

  const handlePressIn = () => {
    pressScale.value = withSpring(0.85, { mass: 0.3, damping: 15, stiffness: 500 });
  };

  const handlePressOut = () => {
    pressScale.value = withSpring(1, { mass: 0.3, damping: 15, stiffness: 500 });
    handlePress();
  };

  const handlePress = () => {
    if (isAnimating) return;

    setIsAnimating(true);
    onToggleLike();

    Haptics.impactAsync(
      isLiked
        ? Haptics.ImpactFeedbackStyle.Light
        : Haptics.ImpactFeedbackStyle.Medium,
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
    <Pressable
      style={{ padding: 10, zIndex: 10 }}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      android_ripple={{
        color: "rgba(0,0,0,0.1)",
        radius: 20,
        borderless: true,
      }}
      hitSlop={{ top: 25, bottom: 25, left: 25, right: 25 }}
    >
      <Animated.View style={animatedStyle}>
        {isLiked ? (
          <HeartFilled width={33} height={33} />
        ) : (
          <Heart2 width={33} height={33} />
        )}
      </Animated.View>
    </Pressable>
  );
};

export default HeartButton;
