import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ProductDetailsModal } from "@/components/ProductDetailsModal";
import { useToast } from "@/hooks/use-toast";
import * as api from "@/services/api"; // Import api
import { useAuth } from "@/context/AuthContext"; // Import useAuth
import { translateColorToRussian, translateMaterialToRussian } from "@/lib/translations";

export function ProductsView() {
  const [products, setProducts] = useState<api.ProductResponse[]>([]); // Initialize with empty array
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<api.ProductResponse | null>(null);
  const { toast } = useToast();
  const { token } = useAuth(); // Get token from useAuth

  const fetchProducts = async () => {
    if (!token) {
      toast({
        title: "Ошибка",
        description: "Токен аутентификации не найден. Пожалуйста, войдите в систему.",
        variant: "destructive",
      });
      return;
    }
    try {
      const fetchedProducts = await api.getBrandProducts(token);
      setProducts(fetchedProducts);
      console.log(fetchedProducts)
    } catch (error: any) {
      console.error("Failed to fetch products:", error);
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось загрузить товары.",
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
      title: "Успех",
      description: "Товар успешно обновлен.",
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
                <div className="flex-1">
                  <p className="font-medium text-foreground">{product.name}</p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {product.color && (
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                        Цвет: {translateColorToRussian(product.color)}
                      </span>
                    )}
                    {product.material && (
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                        Материал: {translateMaterialToRussian(product.material)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">В наличии: {product.variants.reduce((sum: number, v: any) => sum + v.stock_quantity, 0)}</p>
                </div>
                <p className="font-bold text-foreground">{product.price} ₽</p>
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
