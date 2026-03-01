// Shared constants for swipe card screens (MainPage + FriendRecommendationsScreen)

// Distance from card edges for corner overlays and content padding
export const CARD_CORNER_INSET = 20;
// Inner white box size for all four corners
export const CORNER_BOX_SIZE = 52;
// Overlay extends to edge: inset + box
export const CORNER_OVERLAY_SIZE = CARD_CORNER_INSET + CORNER_BOX_SIZE; // 72
// Back of card: reduced vertical padding
export const CARD_BACK_VERTICAL_INSET = 12;
export const CARD_BACK_BOTTOM_INSET = 8;
// Size panel closed width = cart corner only
export const SIZE_PANEL_CLOSED_WIDTH = 52;

// Minimum real cards to keep before fetching more
export const MIN_CARDS_THRESHOLD = 3;
// Sentinel ID for loading placeholder card
export const LOADING_CARD_ID = "__loading_card__";

// Color dropdown geometry
export const COLOR_CORNER_CLOSED_HEIGHT = 52;
export const COLOR_GAP = 6;
export const COLOR_OPTION_HEIGHT = 32;
export const COLOR_DROPDOWN_ITEM_HEIGHT = COLOR_OPTION_HEIGHT + COLOR_GAP; // 38
export const COLOR_DROPDOWN_BOTTOM_PADDING = 8;
