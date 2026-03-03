import React from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { Image } from "expo-image";
import { Gesture, GestureDetector, GestureType } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import Cancel from "../svg/Cancel";
import ExpandableSection from "./ExpandableSection";
import { CardItem } from "../../types/product";
import { formatDeliveryTime } from "../../lib/swipeCardUtils";
import {
  translateColorToRussian,
  translateMaterialToRussian,
} from "../../lib/translations";

interface CardBackProps {
  card: CardItem;
  styles: any;
  onFlip: () => void;
  headerPanGesture: GestureType;
  scrollViewRef: React.RefObject<ScrollView | null>;
  bottomStrip?: React.ReactNode;
}

const SizingTableZoomable: React.FC<{ imageUri: string }> = ({ imageUri }) => {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(Math.max(savedScale.value * e.scale, 1), 4);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value <= 1) {
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      }
    });

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      if (savedScale.value > 1) {
        translateX.value = savedTranslateX.value + e.translationX;
        translateY.value = savedTranslateY.value + e.translationY;
      }
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      scale.value = withTiming(1);
      savedScale.value = 1;
      translateX.value = withTiming(0);
      translateY.value = withTiming(0);
      savedTranslateX.value = 0;
      savedTranslateY.value = 0;
    });

  const composed = Gesture.Simultaneous(pinch, pan);
  const gesture = Gesture.Exclusive(doubleTap, composed);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <View style={{ marginTop: 12, marginBottom: 4, overflow: "hidden", borderRadius: 8 }}>
      <GestureDetector gesture={gesture}>
        <Animated.View style={animatedStyle}>
          <Image
            source={{ uri: imageUri }}
            style={{ width: 280, height: 160, borderRadius: 8 }}
            contentFit="contain"
          />
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

const CardBack: React.FC<CardBackProps> = ({
  card,
  styles,
  onFlip,
  headerPanGesture,
  scrollViewRef,
  bottomStrip,
}) => {
  return (
    <View style={styles.cardBackContainer}>
      <Pressable style={styles.removeButton} onPress={onFlip}>
        <Cancel width={27} height={27} />
      </Pressable>
      <GestureDetector gesture={headerPanGesture}>
        <Animated.View style={styles.cardBackHeader}>
        {card.images.length > 0 ? (
          <Image
            source={card.images[0]}
            style={styles.cardBackImage}
            contentFit="contain"
          />
        ) : (
          <View style={[styles.cardBackImage, styles.imagePlaceholder]}>
            <Text style={styles.imagePlaceholderText}>Нет изображения</Text>
          </View>
        )}
        <Text style={styles.cardBackName}>{card.name}</Text>
        </Animated.View>
      </GestureDetector>
      <ScrollView
        ref={scrollViewRef as any}
        style={styles.expandableSectionsContainer}
        contentContainerStyle={styles.expandableSectionsContent}
        showsVerticalScrollIndicator={false}
        bounces={true}
      >
        {card.article_number && (
          <ExpandableSection title="артикул" content={card.article_number} />
        )}
        <ExpandableSection title="описание" content={card.description} />
        <ExpandableSection
          title="цвет"
          content={translateColorToRussian(card.color)}
        />
        <ExpandableSection title="материалы" content={card.materials} />
        {card.country_of_manufacture ? (
          <ExpandableSection
            title="страна производства"
            content={card.country_of_manufacture}
          />
        ) : null}
        <ExpandableSection
          title="политика возврата"
          content={card.brand_return_policy || "политика возврата не указана"}
        />
        {formatDeliveryTime(card.delivery_time_min, card.delivery_time_max) ? (
          <ExpandableSection
            title="доставка"
            content={
              formatDeliveryTime(
                card.delivery_time_min,
                card.delivery_time_max,
              )!
            }
          />
        ) : null}
        {card.sizing_table_image ? (
          <SizingTableZoomable imageUri={card.sizing_table_image} />
        ) : null}
      </ScrollView>
      {bottomStrip}
    </View>
  );
};

export default CardBack;
