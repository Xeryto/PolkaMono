import React from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { Image } from "expo-image";
import { PanResponderInstance } from "react-native";
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
  headerPanResponder: PanResponderInstance;
  scrollViewRef: React.RefObject<ScrollView | null>;
  bottomStrip?: React.ReactNode;
}

const CardBack: React.FC<CardBackProps> = ({
  card,
  styles,
  onFlip,
  headerPanResponder,
  scrollViewRef,
  bottomStrip,
}) => {
  return (
    <View style={styles.cardBackContainer}>
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
            <Text style={styles.imagePlaceholderText}>Нет изображения</Text>
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
          <View style={{ marginTop: 12, marginBottom: 4 }}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              bounces={false}
              style={{ borderRadius: 8 }}
            >
              <Image
                source={{ uri: card.sizing_table_image }}
                style={{ width: 280, height: 160, borderRadius: 8 }}
                contentFit="contain"
              />
            </ScrollView>
          </View>
        ) : null}
      </ScrollView>
      {bottomStrip}
    </View>
  );
};

export default CardBack;
