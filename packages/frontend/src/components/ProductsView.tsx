import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ProductDetailsModal } from "@/components/ProductDetailsModal";
import { useToast } from "@/hooks/use-toast";
import * as api from "@/services/api"; // Import api
import { useAuth } from "@/context/AuthContext"; // Import useAuth

export function ProductsView() {
  const [products, setProducts] = useState<api.ProductResponse[]>([]); // Initialize with empty array
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<api.ProductResponse | null>(null);
  const { toast } = useToast();
  const { token } = useAuth(); // Get token from useAuth

  const fetchProducts = async () => {
    if (!token) {
      toast({
        title: "Error",
        description: "Authentication token not found. Please log in.",
        variant: "destructive",
      });
      return;
    }
    try {
      const fetchedProducts = await api.getBrandProducts(token);
      setProducts(fetchedProducts);
    } catch (error: any) {
      console.error("Failed to fetch products:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to load products.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [token, toast]); // Add token and toast to dependency array

  const handleProductClick = (product: api.ProductResponse) => {
    setSelectedProduct(product);
    setIsModalOpen(true);
  };

  const handleProductUpdated = () => {
    fetchProducts(); // Re-fetch products after update
    toast({
      title: "Success",
      description: "Product updated successfully.",
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
