import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ProductDetailsModal } from "@/components/ProductDetailsModal";
import { useToast } from "@/hooks/use-toast";

// Prepopulated mock products data
const mockProducts = [
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

export function ProductsView() {
  const [products, setProducts] = useState<any[]>(mockProducts); // Use mockProducts directly
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const { toast } = useToast();

  // Removed fetchProducts and useEffect

  const handleProductClick = (product: any) => {
    setSelectedProduct(product);
    setIsModalOpen(true);
  };

  const handleProductUpdated = () => {
    // In a real app, you'd re-fetch products from API here.
    // For mock data, we can simulate an update or do nothing.
    toast({
      title: "Success",
      description: "Product updated (mock data).",
    });
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">Товары</h2>

      <Card className="bg-card border-border/30 shadow-lg">
        <CardHeader>
          <CardTitle>Все товары</CardTitle>
          <CardDescription>Управление запасами товаров</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {products.map((product) => (
              <div key={product.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 cursor-pointer" onClick={() => handleProductClick(product)}>
                <div>
                  <p className="font-medium text-foreground">{product.name}</p>
                  <p className="text-sm text-muted-foreground">В наличии: {product.variants.reduce((sum: number, v: any) => sum + v.stock_quantity, 0)}</p>
                </div>
                <p className="font-bold text-foreground">{product.price}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {selectedProduct && (
        <ProductDetailsModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          product={selectedProduct}
          onProductUpdated={handleProductUpdated}
        />
      )}
    </div>
  );
}
