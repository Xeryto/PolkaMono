import React, { useRef, useState } from "react";
import { View, Text, Pressable, Animated as RNAnimated } from "react-native";
import { useTheme } from "../../lib/ThemeContext";
import { ANIMATION_DURATIONS } from "../../lib/animations";

interface ExpandableSectionProps {
  title: string;
  content: string;
  onContentPress?: () => void;
}

const ExpandableSection: React.FC<ExpandableSectionProps> = ({
  title,
  content,
  onContentPress,
}) => {
  const { theme } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);
  const animation = useRef(new RNAnimated.Value(0)).current;

  const toggleExpansion = () => {
    RNAnimated.timing(animation, {
      toValue: isExpanded ? 0 : 1,
      duration: ANIMATION_DURATIONS.STANDARD,
      useNativeDriver: false,
    }).start();
    setIsExpanded(!isExpanded);
  };

  const contentHeight = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 500],
  });

  const rotateArrow = animation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "90deg"],
  });

  return (
    <View style={{ marginBottom: 10 }}>
      <Pressable
        onPress={toggleExpansion}
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingVertical: 10,
        }}
      >
        <Text
          style={{
            fontFamily: "IgraSans",
            fontSize: 14,
            color: theme.text.primary,
          }}
        >
          {title}
        </Text>
        <RNAnimated.View style={{ transform: [{ rotate: rotateArrow }] }}>
          <Text
            style={{
              fontFamily: "IgraSans",
              fontSize: 14,
              color: theme.text.primary,
            }}
          >
            {">"}
          </Text>
        </RNAnimated.View>
      </Pressable>
      <RNAnimated.View
        style={{
          maxHeight: contentHeight,
          paddingHorizontal: 10,
          paddingBottom: 10,
        }}
      >
        <Pressable onPress={onContentPress} disabled={!onContentPress}>
          <Text
            style={{
              fontFamily: "IgraSans",
              fontSize: 12,
              color: onContentPress ? theme.button.primary : theme.text.primary,
              lineHeight: 18,
              textDecorationLine: onContentPress ? "underline" : "none",
            }}
          >
            {content}
          </Text>
        </Pressable>
      </RNAnimated.View>
    </View>
  );
};

export default ExpandableSection;
