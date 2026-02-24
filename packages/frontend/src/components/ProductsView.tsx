import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ProductDetailsModal } from "@/components/ProductDetailsModal";
import { useToast } from "@/hooks/use-toast";
import * as api from "@/services/api"; // Import api
import { useAuth } from "@/context/AuthContext"; // Import useAuth
import {
  translateColorToRussian,
  translateMaterialToRussian,
} from "@/lib/translations";
import NetworkLoadingIndicator from "@/components/NetworkLoadingIndicator";
import { useNetworkRequest } from "@/hooks/useNetworkRequest";
import { formatCurrency } from "@/lib/currency";

export function ProductsView() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] =
    useState<api.ProductResponse | null>(null);
  const [removeSaleProduct, setRemoveSaleProduct] =
    useState<api.ProductResponse | null>(null);
  const { toast } = useToast();
  const { token } = useAuth(); // Get token from useAuth

  // Use network request hook for products loading
  const {
    data: products,
    isLoading,
    error,
    execute: fetchProducts,
    retry: retryFetchProducts,
  } = useNetworkRequest(
    async (token: string) => {
      if (!token) {
        throw new Error(
          "Токен аутентификации не найден. Пожалуйста, войдите в систему.",
        );
      }
      return await api.getBrandProducts(token);
    },
    {
      timeout: 15000, // 15 seconds for products
      retries: 2,
      onError: (error) => {
        toast({
          title: "Ошибка",
          description: error.message || "Не удалось загрузить товары.",
          variant: "destructive",
        });
      },
    },
  );

  useEffect(() => {
    if (token) {
      fetchProducts(token);
    }
  }, [token]); // Remove fetchProducts from dependencies to prevent infinite loop

  const handleProductClick = (product: api.ProductResponse) => {
    setSelectedProduct(product);
    setIsModalOpen(true);
  };

  const handleProductUpdated = () => {
    if (token) {
      fetchProducts(token); // Re-fetch products after update
    }
    toast({
      title: "Успех",
      description: "Товар успешно обновлен.",
    });
  };

  const handleRemoveSaleClick = (e: React.MouseEvent, product: api.ProductResponse) => {
    e.stopPropagation();
    setRemoveSaleProduct(product);
  };

  const confirmRemoveSale = async () => {
    if (!token || !removeSaleProduct) return;
    try {
      await api.updateProduct(removeSaleProduct.id, { sale_price: null, sale_type: null }, token);
      fetchProducts(token);
      toast({ title: 'Скидка удалена' });
    } catch {
      toast({
        title: 'Ошибка',
        description: 'Не удалось удалить скидку.',
        variant: 'destructive',
      });
    } finally {
      setRemoveSaleProduct(null);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">Товары</h2>

      <Card className="bg-card-custom border-border/30 shadow-lg">
        <CardHeader>
          <CardTitle>Все товары</CardTitle>
          <CardDescription>Управление запасами товаров</CardDescription>
        </CardHeader>
        <CardContent>
          <NetworkLoadingIndicator
            isLoading={isLoading}
            error={error}
            onRetry={retryFetchProducts}
            timeout={15000}
            message="Загрузка товаров..."
          />

          {!isLoading && !error && products && (
            <div className="space-y-4">
              {products.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                  onClick={() => handleProductClick(product)}
                >
                  <div className="flex-1">
                    <p className="font-medium text-foreground">
                      {product.name}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {product.color_variants?.length > 0 && (
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                          Цвета:{" "}
                          {product.color_variants
                            .map((cv) => translateColorToRussian(cv.color_name))
                            .join(", ")}
                        </span>
                      )}
                      {product.material && (
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                          Материал:{" "}
                          {translateMaterialToRussian(product.material)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      В наличии:{" "}
                      {product.color_variants?.reduce(
                        (sum, cv) =>
                          sum +
                          (cv.variants?.reduce(
                            (s, v) => s + v.stock_quantity,
                            0,
                          ) ?? 0),
                        0,
                      ) ?? 0}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {product.sale_price != null && (
                      <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                        {product.sale_type === 'percent'
                          ? `-${product.sale_price}%`
                          : `${formatCurrency(product.sale_price)}`}
                      </span>
                    )}
                    {product.sale_price != null ? (
                      <div className="flex flex-col items-end">
                        <p className="font-bold text-red-600">
                          {product.sale_type === 'percent'
                            ? formatCurrency(Math.round(product.price * (1 - product.sale_price / 100)))
                            : formatCurrency(product.sale_price)}
                        </p>
                        <p className="text-xs text-muted-foreground line-through">{formatCurrency(product.price)}</p>
                      </div>
                    ) : (
                      <p className="font-bold text-foreground">{formatCurrency(product.price)}</p>
                    )}
                    {product.sale_price != null && (
                      <button
                        className="text-xs text-muted-foreground hover:text-destructive underline"
                        onClick={(e) => handleRemoveSaleClick(e, product)}
                      >
                        Убрать скидку
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
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

      <AlertDialog open={!!removeSaleProduct} onOpenChange={(open) => { if (!open) setRemoveSaleProduct(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Убрать скидку?</AlertDialogTitle>
            <AlertDialogDescription>
              Скидка на товар «{removeSaleProduct?.name}» будет удалена. Покупатели увидят только оригинальную цену.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemoveSale}>Убрать скидку</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
