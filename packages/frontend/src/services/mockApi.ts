import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { PlusCircle, XCircle } from "lucide-react";
import * as api from "@/services/api"; // Assuming API calls are here
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Mock data and API functions for frontend development without a backend connection

// --- Interfaces (mimicking backend schemas) ---
export interface OrderItemResponse {
  id: string;
  product_id: string;
  product_name: string;
  product_image?: string;
  product_size: string;
  price: string;
  honest_sign?: string;
}

export interface OrderResponse {
  id: string;
  number: string;
  total: string;
  date: string; // Use string for simplicity with mock data
  status: string;
  tracking_number?: string;
  items: OrderItemResponse[];
}

export interface ProductVariantSchema {
  size: string;
  stock_quantity: number;
}

export interface ProductResponse {
  id: string;
  name: string;
  description?: string;
  price: string;
  images: string[];
  honest_sign?: string;
  color?: string;
  material?: string;
  hashtags?: string[];
  brand_id: number;
  category_id: string;
  styles: string[];
  variants: ProductVariantSchema[];
}

export interface StyleResponse {
  id: string;
  name: string;
  description?: string;
  image?: string;
}

// --- Mock Data ---
const mockOrders: OrderResponse[] = [
  {
    id: "ORD-001",
    number: "12345",
    total: "₽250.00",
    date: "2024-01-15T10:00:00Z",
    status: "processing",
    tracking_number: "TRK12345",
    items: [
      {
        id: "ITEM-001",
        product_id: "PROD-001",
        product_name: "Mock Hoodie",
        product_image: "https://via.placeholder.com/150/FF0000/FFFFFF?text=Hoodie",
        product_size: "M",
        price: "₽100.00",
        honest_sign: undefined,
      },
      {
        id: "ITEM-002",
        product_id: "PROD-002",
        product_name: "Mock T-Shirt",
        product_image: "https://via.placeholder.com/150/0000FF/FFFFFF?text=T-Shirt",
        product_size: "L",
        price: "₽50.00",
        honest_sign: "HS12345",
      },
    ],
  },
  {
    id: "ORD-002",
    number: "12346",
    total: "₽120.00",
    date: "2024-01-16T11:30:00Z",
    status: "shipped",
    tracking_number: "TRK12346",
    items: [
      {
        id: "ITEM-003",
        product_id: "PROD-003",
        product_name: "Mock Jeans",
        product_image: "https://via.placeholder.com/150/00FF00/FFFFFF?text=Jeans",
        product_size: "32",
        price: "₽120.00",
        honest_sign: undefined,
      },
    ],
  },
];

const mockProducts: ProductResponse[] = [
  {
    id: "PROD-001",
    name: "Mock Hoodie",
    description: "A comfortable mock hoodie.",
    price: "₽100.00",
    images: ["https://via.placeholder.com/150/FF0000/FFFFFF?text=Hoodie"],
    honest_sign: undefined,
    color: "Red",
    material: "Cotton",
    hashtags: ["hoodie", "comfort"],
    brand_id: 1,
    category_id: "apparel",
    styles: ["casual"],
    variants: [{ size: "M", stock_quantity: 10 }],
  },
  {
    id: "PROD-002",
    name: "Mock T-Shirt",
    description: "A stylish mock t-shirt.",
    price: "₽50.00",
    images: ["https://via.placeholder.com/150/0000FF/FFFFFF?text=T-Shirt"],
    honest_sign: "HS12345",
    color: "Blue",
    material: "Polyester",
    hashtags: ["tshirt", "sport"],
    brand_id: 1,
    category_id: "apparel",
    styles: ["sporty"],
    variants: [{ size: "L", stock_quantity: 20 }],
  },
];

const mockStyles: StyleResponse[] = [
  { id: "casual", name: "Casual", description: "Everyday wear" },
  { id: "sporty", name: "Sporty", description: "Active wear" },
  { id: "elegant", name: "Elegant", description: "Formal wear" },
];

// --- Mock API Functions ---

const simulateDelay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const getOrders = async (): Promise<OrderResponse[]> => {
  await simulateDelay(500);
  return mockOrders;
};

export const updateOrderItemHonestSign = async (orderItemId: string, honestSign: string): Promise<any> => {
  await simulateDelay(500);
  const order = mockOrders.find(o => o.items.some(item => item.id === orderItemId));
  if (order) {
    const item = order.items.find(item => item.id === orderItemId);
    if (item) {
      item.honest_sign = honestSign;
      return { message: "Honest Sign updated successfully." };
    }
  }
  throw new Error("Order item not found.");
};

export const updateOrderTracking = async (orderId: string, trackingNumber: string): Promise<any> => {
  await simulateDelay(500);
  const order = mockOrders.find(o => o.id === orderId);
  if (order) {
    order.tracking_number = trackingNumber;
    return { message: "Tracking number updated successfully." };
  }
  throw new Error("Order not found.");
};

export const getBrandProducts = async (): Promise<ProductResponse[]> => {
  await simulateDelay(500);
  return mockProducts;
};

export const createProduct = async (productData: any): Promise<ProductResponse> => {
  await simulateDelay(500);
  const newProduct: ProductResponse = {
    id: `PROD-₽{Math.random().toString(36).substr(2, 9)}`,
    ...productData,
    images: productData.images || [],
    styles: productData.styles || [],
    variants: productData.variants || [],
    brand_id: productData.brand_id || 1, // Default for mock
    category_id: productData.category_id || "mock_category", // Default for mock
  };
  mockProducts.push(newProduct);
  return newProduct;
};

export const updateProduct = async (productId: string, productData: any): Promise<ProductResponse> => {
  await simulateDelay(500);
  const index = mockProducts.findIndex(p => p.id === productId);
  if (index !== -1) {
    mockProducts[index] = { ...mockProducts[index], ...productData };
    return mockProducts[index];
  }
  throw new Error("Product not found.");
};

export const getStyles = async (): Promise<StyleResponse[]> => {
  await simulateDelay(500);
  return mockStyles;
};