import { StyleSheet, Platform } from "react-native";
import type { ThemeColors } from "../../lib/theme";
import {
  CARD_CORNER_INSET,
  CORNER_BOX_SIZE,
  CORNER_OVERLAY_SIZE,
  CARD_BACK_VERTICAL_INSET,
  CARD_BACK_BOTTOM_INSET,
} from "../../lib/swipeCardConstants";

export const createSwipeCardStyles = (
  theme: ThemeColors,
  cardBorderRadius: number,
) =>
  StyleSheet.create({
    // Card container (flip target)
    whiteBox: {
      width: "102%",
      height: "82%",
      borderRadius: cardBorderRadius,
      position: "absolute",
      top: -3,
      left: -3,
      zIndex: 1000 - 7,
    },
    cardFace: {
      width: "100%",
      height: "100%",
      borderRadius: cardBorderRadius,
      backgroundColor: theme.background.primary,
      shadowColor: theme.shadow.default,
      shadowOffset: { width: 0.25, height: 4 },
      shadowOpacity: 0.5,
      shadowRadius: 4,
      elevation: 10,
      justifyContent: "center",
      alignItems: "center",
      padding: CARD_CORNER_INSET,
    },

    // Image area
    imageHolder: {
      position: "absolute",
      top: CARD_CORNER_INSET,
      left: CARD_CORNER_INSET,
      right: CARD_CORNER_INSET,
      bottom: CARD_CORNER_INSET,
      justifyContent: "center",
      alignItems: "center",
    },
    imageFullBleed: {
      width: "100%",
      height: "100%",
    },
    image: {
      width: "100%",
      height: "100%",
    },
    imagePressable: {
      width: "100%",
      height: "100%",
      justifyContent: "center",
      alignItems: "center",
    },
    imagePlaceholder: {
      backgroundColor: theme.surface.button,
      justifyContent: "center",
      alignItems: "center",
    },
    imagePlaceholderText: {
      fontFamily: "IgraSans",
      fontSize: 14,
      color: theme.text.disabled,
    },
    imageCarousel: {
      width: "100%",
      height: "100%",
    },
    imageContainer: {
      height: "100%",
      justifyContent: "center",
      alignItems: "center",
    },

    // Image dots
    imageDotsContainer: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      position: "absolute",
      bottom: CARD_CORNER_INSET + CORNER_BOX_SIZE / 2 - 8 / 2,
      width: "100%",
    },
    imageDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.text.secondary + "80",
      marginHorizontal: 4,
    },
    imageDotActive: {
      backgroundColor: theme.button.primary,
    },

    // Corner overlays
    cornerOverlayTopLeft: {
      position: "absolute",
      top: 0,
      left: 0,
      width: CORNER_OVERLAY_SIZE,
      height: CORNER_OVERLAY_SIZE,
      backgroundColor: theme.background.primary,
      borderTopLeftRadius: cardBorderRadius,
      borderBottomRightRadius: 16,
      zIndex: 20,
      elevation: 21,
    },
    cornerOverlayTopRight: {
      position: "absolute",
      top: 0,
      right: 0,
      width: CORNER_OVERLAY_SIZE,
      height: CORNER_OVERLAY_SIZE,
      backgroundColor: theme.background.primary,
      borderTopRightRadius: cardBorderRadius,
      borderBottomLeftRadius: 16,
      zIndex: 20,
      elevation: 21,
    },
    cornerOverlayBottomLeft: {
      position: "absolute",
      bottom: 0,
      left: 0,
      width: CORNER_OVERLAY_SIZE,
      height: CORNER_OVERLAY_SIZE,
      backgroundColor: theme.background.primary,
      borderBottomLeftRadius: cardBorderRadius,
      borderTopRightRadius: 16,
      zIndex: 25,
      elevation: 26,
    },
    cornerOverlayBottomRight: {
      position: "absolute",
      bottom: 0,
      right: 0,
      width: CORNER_OVERLAY_SIZE,
      height: CORNER_OVERLAY_SIZE,
      backgroundColor: theme.background.primary,
      borderBottomRightRadius: cardBorderRadius,
      borderTopLeftRadius: 16,
      zIndex: 20,
      elevation: 21,
    },

    // Corner inner positioning
    cornerInnerTopRight: {
      position: "absolute",
      top: CARD_CORNER_INSET,
      right: CARD_CORNER_INSET,
      width: CORNER_BOX_SIZE,
      height: CORNER_BOX_SIZE,
      justifyContent: "center",
      alignItems: "center",
    },
    cornerInnerBottomRight: {
      position: "absolute",
      bottom: CARD_CORNER_INSET,
      right: CARD_CORNER_INSET,
      width: CORNER_BOX_SIZE,
      height: CORNER_BOX_SIZE,
    },

    // Bottom-left cart/size panel
    cornerOverlayBottomLeftInner: {
      backgroundColor: theme.background.primary,
      width: CORNER_BOX_SIZE,
      height: CORNER_BOX_SIZE,
      padding: 10,
      borderTopRightRadius: 16,
      justifyContent: "center",
      alignItems: "center",
    },
    cornerOverlayBottomRightInner: {
      backgroundColor: theme.background.primary,
      width: CORNER_BOX_SIZE,
      height: CORNER_BOX_SIZE,
      padding: 10,
      borderTopLeftRadius: 16,
      justifyContent: "center",
      alignItems: "center",
    },
    sizePanelPosition: {
      position: "absolute",
      left: CARD_CORNER_INSET,
      bottom: CARD_CORNER_INSET,
    },
    sizePanelOuter: {
      backgroundColor: theme.background.primary,
      height: CORNER_BOX_SIZE,
      justifyContent: "center",
    },
    sizePanelRow: {
      flexDirection: "row",
      alignItems: "center",
      minHeight: CORNER_BOX_SIZE,
    },
    sizePanelScrollView: {
      flex: 1,
      height: 60,
      minWidth: 0,
    },
    sizePanelCancelButton: {
      width: 41,
      height: 41,
      borderRadius: 20.5,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.interactive.remove,
    },
    sizeScrollContent: {
      width: "100%",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      minHeight: 60,
    },

    // Size circles — unified to theme.size.* tokens
    sizeCircle: {
      width: 41,
      height: 41,
      borderRadius: 20.5,
      backgroundColor: theme.size.available,
      justifyContent: "center",
      alignItems: "center",
      shadowColor: theme.shadow.default,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
      marginVertical: 9.5,
    },
    sizeCircleAvailable: {
      backgroundColor: theme.size.available,
    },
    sizeCircleUnavailable: {
      backgroundColor: theme.size.unavailable,
    },
    sizeCircleUserSize: {
      backgroundColor: theme.size.userSize,
    },
    sizeText: {
      color: theme.size.text,
      fontWeight: "bold",
      fontSize: 16,
    },
    sizeOval: {
      width: 80,
      height: 41,
      borderRadius: 20.5,
      backgroundColor: theme.size.available,
      justifyContent: "center",
      alignItems: "center",
      shadowColor: theme.shadow.default,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
      marginVertical: 9.5,
    },
    sizeOvalText: {
      color: theme.text.primary,
      fontWeight: "bold",
      fontSize: 12,
      textAlign: "center",
    },

    // Color selector
    colorSelectorCornerBox: {
      backgroundColor: theme.background.primary,
      paddingHorizontal: 10,
      paddingVertical: 0,
      borderBottomRightRadius: 16,
      width: CORNER_BOX_SIZE,
      minHeight: CORNER_BOX_SIZE,
      overflow: "hidden",
      justifyContent: "flex-start",
      alignItems: "center",
    },
    colorSelectorTriggerRow: {
      width: "100%",
      height: CORNER_BOX_SIZE,
      justifyContent: "center",
      alignItems: "center",
    },
    colorSelectorInnerPos: {
      position: "absolute",
      top: CARD_CORNER_INSET,
      left: CARD_CORNER_INSET,
    },
    colorSelectorTriggerCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: "center",
      alignItems: "center",
    },
    colorSelectorSelectedRing: {
      width: 26 + 4 * 2 + 4 * 2,
      height: 26 + 4 * 2 + 4 * 2,
      borderRadius: 21,
      borderWidth: 4,
      borderColor: theme.button.primary,
      backgroundColor: theme.background.primary,
      justifyContent: "center",
      alignItems: "center",
    },
    colorSwatchCircle: {
      width: 26,
      height: 26,
      borderRadius: 13,
      borderWidth: 1,
      borderColor: "rgba(0,0,0,0.2)",
    },
    colorSelectorDropdownCircles: {
      flexDirection: "column",
      alignItems: "center",
      gap: 6,
      marginTop: 6,
      paddingBottom: 0,
    },
    colorSelectorOptionCircle: {
      padding: 3,
      borderRadius: 13,
    },
    colorSwatchCircleSmall: {
      width: 26,
      height: 26,
      borderRadius: 13,
      borderWidth: 1,
      borderColor: "rgba(0,0,0,0.2)",
    },

    // Card back
    cardBackContainer: {
      flex: 1,
      minHeight: 0,
      justifyContent: "flex-start",
      alignItems: "stretch",
      width: "100%",
    },
    removeButton: {
      width: 25,
      height: 25,
      borderRadius: 7,
      backgroundColor: theme.interactive.remove,
      justifyContent: "center",
      alignItems: "center",
      position: "absolute",
      right: 0,
      zIndex: 1000,
      elevation: 10,
    },
    cardBackHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: CARD_BACK_VERTICAL_INSET,
      width: "100%",
      justifyContent: "flex-start",
      paddingRight: 50,
    },
    cardBackImage: {
      width: 80,
      height: 80,
      marginRight: 10,
      borderRadius: 10,
    },
    cardBackName: {
      fontFamily: "IgraSans",
      fontSize: 24,
      color: theme.text.primary,
      flex: 1,
      flexWrap: "wrap",
    },
    expandableSectionsContainer: {
      width: "100%",
      flex: 1,
      minHeight: 0,
    },
    expandableSectionsContent: {
      paddingBottom: CARD_BACK_VERTICAL_INSET,
      flexGrow: 1,
    },

    // Back bottom strip (MainPage only, but kept here for consistency)
    backBottomStrip: {
      width: "100%",
      height: CORNER_BOX_SIZE + CARD_BACK_BOTTOM_INSET,
      paddingHorizontal: 0,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      justifyContent: "center",
      position: "relative",
    },
    backIconSlotsRow: {
      flexDirection: "row",
      alignItems: "center",
      width: "100%",
    },
    backIconSpacer: {
      flex: 1,
      minWidth: 0,
    },
    backCartSlot: {
      width: CORNER_BOX_SIZE,
      position: "relative",
    },
    backSizePanelTail: {
      position: "absolute",
      left: CORNER_BOX_SIZE,
      top: 0,
      bottom: 0,
      backgroundColor: theme.background.primary,
      justifyContent: "center",
    },
    backIconBoxWrapper: {
      width: CORNER_BOX_SIZE,
      position: "relative",
    },
    backIconBox: {
      width: CORNER_BOX_SIZE,
      height: CORNER_BOX_SIZE,
      backgroundColor: theme.background.primary,
      borderRadius: 16,
      justifyContent: "center",
      alignItems: "center",
    },

    // Text area below card
    text: {
      top: Platform.OS == "android" ? "82.5%" : "85%",
      width: "100%",
      paddingHorizontal: 18,
    },
    name: {
      fontFamily: "IgraSans",
      fontSize: 38,
      textAlign: "left",
      color: theme.text.inverse,
    },
    brandName: {
      fontFamily: "IgraSans",
      fontSize: 38,
      textAlign: "left",
      color: theme.text.inverse,
    },
    price: {
      fontFamily: "REM",
      fontSize: 16,
      textAlign: "left",
      color: theme.text.inverse,
    },
    priceStrikethrough: {
      textDecorationLine: "line-through",
      color: theme.text.secondary,
      fontSize: 13,
    },
    priceSale: {
      color: theme.status.error,
      fontSize: 15,
      fontFamily: "IgraSans",
    },

    // Empty / no cards
    noCardsContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    noCardsText: {
      fontSize: 24,
      fontWeight: "bold",
      color: theme.text.primary,
      marginBottom: 10,
    },
    noCardsSubtext: {
      fontSize: 16,
      color: theme.text.secondary,
    },

    // Link copied popup
    linkCopiedPopup: {
      position: "absolute",
      top: -50,
      left: "50%",
      marginLeft: -80,
      backgroundColor: theme.modal.backdrop,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      zIndex: 1000,
    },
    linkCopiedText: {
      color: theme.text.inverse,
      fontFamily: "REM",
      fontSize: 14,
      textAlign: "center",
    },
  });
