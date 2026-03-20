import React, { useState, useEffect, useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { toast } from "sonner";
import * as api from "@/services/api";
import { useAuth } from "@/context/AuthContext";
import {
  translateColorToRussian,
  translateMaterialToRussian,
} from "@/lib/translations";
import { useNetworkRequest } from "@/hooks/useNetworkRequest";
import { formatCurrency } from "@/lib/currency";
import { getTotalStock, hasLowStock } from "@/lib/productUtils";
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  LayoutGrid,
  TableIcon,
} from "lucide-react";

type SortField = "name" | "price" | "stock";
type SortDir = "asc" | "desc";
type StockFilter = "all" | "in-stock" | "out-of-stock" | "low-stock";
type ViewMode = "table" | "cards";

export function ProductsView() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<api.ProductResponse | null>(null);
  const [removeSaleProduct, setRemoveSaleProduct] = useState<api.ProductResponse | null>(null);
  const { token } = useAuth();

  // Filters
  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");

  // Sort
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // View mode
  const [viewMode, setViewMode] = useState<ViewMode>("table");

  const {
    data: products,
    isLoading,
    error,
    execute: fetchProducts,
    retry: retryFetchProducts,
  } = useNetworkRequest(
    async (token: string) => {
      if (!token) throw new Error("Токен не найден. Войдите в систему.");
      return await api.getBrandProducts(token);
    },
    {
      timeout: 15000,
      retries: 2,
      onError: (error) => toast.error(error.message || "Не удалось загрузить товары."),
    },
  );

  useEffect(() => {
    if (token) fetchProducts(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Filter → sort pipeline
  const processed = useMemo(() => {
    if (!products) return [];
    let result = [...products];

    // Search
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((p) => p.name.toLowerCase().includes(q));
    }

    // Stock filter
    if (stockFilter === "in-stock") result = result.filter((p) => getTotalStock(p) > 0);
    else if (stockFilter === "out-of-stock") result = result.filter((p) => getTotalStock(p) === 0);
    else if (stockFilter === "low-stock") result = result.filter((p) => hasLowStock(p));

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      if (sortField === "name") cmp = a.name.localeCompare(b.name);
      else if (sortField === "price") cmp = a.price - b.price;
      else if (sortField === "stock") cmp = getTotalStock(a) - getTotalStock(b);
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [products, search, stockFilter, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("asc"); }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDir === "asc"
      ? <ArrowUp className="h-3 w-3 ml-1" />
      : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const handleProductClick = (product: api.ProductResponse) => {
    setSelectedProduct(product);
    setIsModalOpen(true);
  };

  const handleProductUpdated = () => {
    if (token) fetchProducts(token);
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
      toast.success("Скидка удалена");
    } catch {
      toast.error("Не удалось удалить скидку.");
    } finally {
      setRemoveSaleProduct(null);
    }
  };

  const renderPrice = (product: api.ProductResponse) => {
    if (product.sale_price != null) {
      const finalPrice =
        product.sale_type === "percent"
          ? Math.round(product.price * (1 - product.sale_price / 100))
          : product.sale_price;
      return (
        <div className="flex flex-col items-end gap-0.5">
          <span className="font-bold text-red-400">{formatCurrency(finalPrice)}</span>
          <span className="text-xs text-muted-foreground line-through">{formatCurrency(product.price)}</span>
        </div>
      );
    }
    return <span className="font-bold">{formatCurrency(product.price)}</span>;
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">Товары</h2>

      <Card className="bg-card border-border/30 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Все товары</CardTitle>
              <CardDescription>Управление запасами товаров</CardDescription>
            </div>
            <div className="flex gap-1">
              <Button
                variant={viewMode === "table" ? "default" : "ghost"}
                size="icon"
                className="h-8 w-8"
                onClick={() => setViewMode("table")}
              >
                <TableIcon className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "cards" ? "default" : "ghost"}
                size="icon"
                className="h-8 w-8"
                onClick={() => setViewMode("cards")}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Поиск по названию..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 bg-input border-border/50"
              />
            </div>
            <Select value={stockFilter} onValueChange={(v) => setStockFilter(v as StockFilter)}>
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все товары</SelectItem>
                <SelectItem value="in-stock">В наличии</SelectItem>
                <SelectItem value="out-of-stock">Нет в наличии</SelectItem>
                <SelectItem value="low-stock">Мало на складе</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading && (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-3 rounded-lg border border-border/30">
                  <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-1/5" />
                  </div>
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          )}

          {!isLoading && error && (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
              <p className="text-muted-foreground text-sm">{error.message}</p>
              <Button variant="outline" size="sm" onClick={retryFetchProducts}>
                Повторить
              </Button>
            </div>
          )}

          {!isLoading && !error && products && products.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-muted-foreground text-sm">
                У вас пока нет товаров. Добавьте первый товар, чтобы начать продавать.
              </p>
            </div>
          )}

          {!isLoading && !error && products && products.length > 0 && viewMode === "table" && (
            <div className="rounded-md border border-border/30 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("name")}>
                      <span className="flex items-center">Название <SortIcon field="name" /></span>
                    </TableHead>
                    <TableHead>Цвета</TableHead>
                    <TableHead>Материал</TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("stock")}>
                      <span className="flex items-center">Остаток <SortIcon field="stock" /></span>
                    </TableHead>
                    <TableHead className="cursor-pointer select-none text-right" onClick={() => toggleSort("price")}>
                      <span className="flex items-center justify-end">Цена <SortIcon field="price" /></span>
                    </TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {processed.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Ничего не найдено
                      </TableCell>
                    </TableRow>
                  ) : (
                    processed.map((product) => {
                      const stock = getTotalStock(product);
                      const lowStock = hasLowStock(product);
                      return (
                        <TableRow
                          key={product.id}
                          className="cursor-pointer"
                          onClick={() => handleProductClick(product)}
                        >
                          <TableCell className="font-medium">
                            {product.name}
                            {product.sale_price != null && (
                              <Badge variant="outline" className="ml-2 bg-red-900/20 text-red-300 border-red-700/30 text-[10px]">
                                {product.sale_type === "percent" ? `-${product.sale_price}%` : "Скидка"}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {product.color_variants?.slice(0, 4).map((cv) => (
                                <div
                                  key={cv.color_name}
                                  className="w-5 h-5 rounded-full border border-border/50"
                                  style={{ background: cv.color_hex || "#808080" }}
                                  title={translateColorToRussian(cv.color_name)}
                                />
                              ))}
                              {(product.color_variants?.length || 0) > 4 && (
                                <span className="text-xs text-muted-foreground self-center">
                                  +{product.color_variants.length - 4}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {product.material ? translateMaterialToRussian(product.material) : "—"}
                          </TableCell>
                          <TableCell>
                            <span className={stock === 0 ? "text-destructive" : ""}>
                              {stock}
                            </span>
                            {lowStock && (
                              <Badge variant="outline" className="ml-2 bg-red-900/20 text-red-300 border-red-700/30 text-[10px]">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Мало
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">{renderPrice(product)}</TableCell>
                          <TableCell>
                            {product.sale_price != null && (
                              <button
                                className="text-xs text-muted-foreground hover:text-destructive underline"
                                onClick={(e) => handleRemoveSaleClick(e, product)}
                              >
                                Убрать
                              </button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {!isLoading && !error && products && products.length > 0 && viewMode === "cards" && (
            <div className="space-y-4">
              {processed.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">Ничего не найдено</p>
              ) : (
                processed.map((product) => {
                  const stock = getTotalStock(product);
                  const lowStock = hasLowStock(product);
                  return (
                    <div
                      key={product.id}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-accent/50 cursor-pointer transition-colors border border-transparent hover:border-border/30"
                      onClick={() => handleProductClick(product)}
                    >
                      <div className="flex-1">
                        <p className="font-medium text-foreground">{product.name}</p>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {product.color_variants?.length > 0 && (
                            <span className="text-xs bg-blue-900/20 text-blue-300 px-2 py-1 rounded-full">
                              Цвета: {product.color_variants.map((cv) => translateColorToRussian(cv.color_name)).join(", ")}
                            </span>
                          )}
                          {product.material && (
                            <span className="text-xs bg-green-900/20 text-green-300 px-2 py-1 rounded-full">
                              Материал: {translateMaterialToRussian(product.material)}
                            </span>
                          )}
                          {lowStock && (
                            <Badge variant="outline" className="bg-red-900/20 text-red-300 border-red-700/30 text-[10px]">
                              <AlertTriangle className="h-3 w-3 mr-1" />Мало на складе
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          В наличии: {stock}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {product.sale_price != null && (
                          <span className="text-xs bg-red-900/20 text-red-300 px-2 py-0.5 rounded-full">
                            {product.sale_type === "percent" ? `-${product.sale_price}%` : formatCurrency(product.sale_price)}
                          </span>
                        )}
                        {renderPrice(product)}
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
                  );
                })
              )}
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
              Скидка на товар «{removeSaleProduct?.name}» будет удалена.
              Покупатели увидят только оригинальную цену.
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
