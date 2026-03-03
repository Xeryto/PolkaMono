import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Modal,
  Dimensions,
} from "react-native";
import { Image } from "expo-image";
import { PanResponderInstance } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  FadeInDown,
  FadeOutDown,
} from "react-native-reanimated";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import Cancel from "../svg/Cancel";
import Maximize from "../svg/Maximize";
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
  headerPanResponder: PanResponderInstance;
  scrollViewRef: React.RefObject<ScrollView | null>;
  bottomStrip?: React.ReactNode;
}

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

const ZoomableImage: React.FC<{ imageUri: string; onClose: () => void }> = ({
  imageUri,
  onClose,
}) => {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTX = useSharedValue(0);
  const savedTY = useSharedValue(0);

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = savedScale.value * e.scale;
    })
    .onEnd(() => {
      scale.value = withTiming(1, { duration: 200 });
      translateX.value = withTiming(0, { duration: 200 });
      translateY.value = withTiming(0, { duration: 200 });
      savedScale.value = 1;
      savedTX.value = 0;
      savedTY.value = 0;
    });

  const pan = Gesture.Pan()
    .minPointers(2)
    .onUpdate((e) => {
      translateX.value = savedTX.value + e.translationX;
      translateY.value = savedTY.value + e.translationY;
    })
    .onEnd(() => {
      savedTX.value = translateX.value;
      savedTY.value = translateY.value;
    });

  const gesture = Gesture.Simultaneous(pinch, pan);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <Pressable
      onPress={onClose}
      style={{
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.85)",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <GestureDetector gesture={gesture}>
        <Animated.View style={animatedStyle}>
          <Image
            source={{ uri: imageUri }}
            style={{ width: SCREEN_W, height: SCREEN_H * 0.7 }}
            contentFit="contain"
          />
        </Animated.View>
      </GestureDetector>
    </Pressable>
  );
};

const SizingTableZoomable: React.FC<{ imageUri: string }> = ({ imageUri }) => {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState(0);

  const handleOpen = () => {
    setKey((k) => k + 1);
    setOpen(true);
  };

  return (
    <>
      <Pressable
        onPress={handleOpen}
        style={{
          marginTop: 12,
          marginBottom: 4,
          borderRadius: 8,
          alignSelf: "center",
        }}
      >
        <Image
          source={{ uri: imageUri }}
          style={{ width: 280, height: 160, borderRadius: 8 }}
          contentFit="contain"
        />
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            borderRadius: 8,
            backgroundColor: "rgba(0,0,0,0.35)",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Maximize width={32} height={32} color="#fff" />
        </View>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" statusBarTranslucent>
        <ZoomableImage
          key={key}
          imageUri={imageUri}
          onClose={() => setOpen(false)}
        />
      </Modal>
    </>
  );
};

const CardBack: React.FC<CardBackProps> = ({
  card,
  styles,
  onFlip,
  headerPanResponder,
  scrollViewRef,
  bottomStrip,
}) => {
  const [showCopiedToast, setShowCopiedToast] = useState(false);

  const handleArticlePress = useCallback(async () => {
    try {
      await Clipboard.setStringAsync(`polka://product/${card.id}`);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setShowCopiedToast(true);
      setTimeout(() => setShowCopiedToast(false), 2000);
    } catch {}
  }, [card.id]);

  return (
    <View style={styles.cardBackContainer}>
      {showCopiedToast && (
        <Animated.View
          entering={FadeInDown.duration(200)}
          exiting={FadeOutDown.duration(200)}
          style={[styles.linkCopiedPopup, { top: -30 }]}
        >
          <Text style={styles.linkCopiedText}>ссылка скопирована</Text>
        </Animated.View>
      )}
      <Pressable style={styles.removeButton} onPress={onFlip}>
        <Cancel width={27} height={27} />
      </Pressable>
      <View style={styles.cardBackHeader} {...headerPanResponder.panHandlers}>
        {card.images.length > 0 ? (
          <Image
            source={card.images[0]}
            style={styles.cardBackImage}
            contentFit="contain"
          />
        ) : (
          <View style={[styles.cardBackImage, styles.imagePlaceholder]}>
            <Text style={styles.imagePlaceholderText}>нет изображения</Text>
          </View>
        )}
        <Text style={styles.cardBackName}>{card.name}</Text>
      </View>
      <ScrollView
        ref={scrollViewRef as any}
        style={styles.expandableSectionsContainer}
        contentContainerStyle={styles.expandableSectionsContent}
        showsVerticalScrollIndicator={false}
        bounces={true}
      >
        {card.article_number && (
          <ExpandableSection
            title="артикул"
            content={card.article_number}
            onContentPress={handleArticlePress}
          />
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
