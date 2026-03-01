import { CardItem } from "../types/product";
import * as api from "../services/api";
import fallbackImage from "../assets/Vision.png";
import { LOADING_CARD_ID } from "./swipeCardConstants";

export const formatDeliveryTime = (
  min?: number | null,
  max?: number | null,
): string | null => {
  if (min == null && max == null) return null;
  if (min != null && max != null) return `${min}–${max} дней`;
  if (min != null) return `от ${min} дней`;
  return `до ${max} дней`;
};

export const createLoadingCard = (): CardItem => ({
  id: LOADING_CARD_ID,
  name: "Загрузка...",
  brand_name: "Загрузка...",
  price: 0,
  images: [fallbackImage],
  isLiked: false,
  color_variants: [],
  selected_color_index: 0,
  description: "",
  color: "",
  materials: "",
  brand_return_policy: "",
  available_sizes: [],
});

export const toggleLikeApi = async (
  productId: string,
  setLiked: boolean,
): Promise<boolean> => {
  try {
    const action = setLiked ? "like" : "unlike";
    await api.toggleFavorite(productId, action);
    return true;
  } catch (error) {
    console.error("Error toggling favorite:", error);
    return false;
  }
};
