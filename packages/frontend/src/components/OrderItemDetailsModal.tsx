import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import * as api from "@/services/api";
import { useAuth } from "@/context/AuthContext";
import { formatCurrency } from "@/lib/currency";
import { Loader2, Lock, Package, Ruler, Tag } from "lucide-react";

interface OrderItemDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  orderItem: api.OrderItemResponse;
  onSKUUpdated: (orderItemId: string, newSKU: string) => void;
}

export const OrderItemDetailsModal: React.FC<OrderItemDetailsModalProps> = ({
  isOpen,
  onClose,
  orderId,
  orderItem,
  onSKUUpdated,
}) => {
  const [skuInput, setSKUInput] = useState(orderItem.sku || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { token } = useAuth();

  const handleSaveSKU = async () => {
    if (!skuInput.trim()) {
      toast.error("SKU не может быть пустым.");
      return;
    }
    if (!token) {
      toast.error("Токен не найден. Войдите в систему.");
      return;
    }

    setIsSubmitting(true);
    try {
      await api.updateOrderItemSKU(orderItem.id, skuInput, token);
      toast.success("SKU успешно обновлён.");
      onSKUUpdated(orderItem.id, skuInput);
      onClose();
    } catch (error: unknown) {
      const err = error as { message?: string };
      toast.error(err.message || "Не удалось обновить SKU.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden bg-card border-border/30">
        {/* Hero image area */}
        {orderItem.image && (
          <div className="relative w-full h-56 bg-surface-elevated/50 overflow-hidden">
            <img
              src={orderItem.image}
              alt={orderItem.name}
              className="w-full h-full object-cover hover:scale-105 transition-transform duration-500 cursor-zoom-in"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
          </div>
        )}

        <div className="px-6 pb-6 space-y-5">
          <DialogHeader className={orderItem.image ? "-mt-8 relative z-10" : ""}>
            <DialogTitle className="text-xl font-bold">{orderItem.name}</DialogTitle>
            <p className="text-sm text-muted-foreground">Размер: {orderItem.size}</p>
          </DialogHeader>

          {/* Metadata cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-surface-elevated/50 p-3 text-center space-y-1">
              <Package className="h-4 w-4 mx-auto text-brand" />
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Товар</p>
              <p className="text-sm font-medium truncate">{orderItem.name}</p>
            </div>
            <div className="rounded-xl bg-surface-elevated/50 p-3 text-center space-y-1">
              <Ruler className="h-4 w-4 mx-auto text-brand" />
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Размер</p>
              <p className="text-sm font-medium">{orderItem.size}</p>
            </div>
            <div className="rounded-xl bg-surface-elevated/50 p-3 text-center space-y-1">
              <Tag className="h-4 w-4 mx-auto text-brand" />
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Цена</p>
              <p className="text-sm font-semibold">{formatCurrency(orderItem.price)}</p>
            </div>
          </div>

          {/* SKU section */}
          <div className="rounded-xl border border-border/30 bg-surface-elevated/30 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <label htmlFor="sku" className="text-sm font-semibold text-foreground">
                SKU (артикул)
              </label>
              {orderItem.sku && (
                <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                  <Lock className="h-3 w-3" />
                  Заблокирован
                </span>
              )}
            </div>
            <Input
              id="sku"
              value={skuInput}
              onChange={(e) => setSKUInput(e.target.value)}
              disabled={isSubmitting || !!orderItem.sku}
              placeholder={orderItem.sku ? undefined : "Введите артикул"}
              className={orderItem.sku ? "opacity-60 bg-muted/30" : ""}
            />
            {!orderItem.sku && (
              <p className="text-xs text-muted-foreground">
                После сохранения SKU нельзя изменить
              </p>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1 sm:flex-none">
              Закрыть
            </Button>
            {!orderItem.sku && (
              <Button onClick={handleSaveSKU} disabled={isSubmitting} className="flex-1 sm:flex-none">
                {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isSubmitting ? "Сохранение..." : "Сохранить SKU"}
              </Button>
            )}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
};
