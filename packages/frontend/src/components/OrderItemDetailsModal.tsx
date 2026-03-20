import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import * as api from "@/services/api";
import { useAuth } from "@/context/AuthContext";
import { formatCurrency } from "@/lib/currency";
import { Loader2 } from "lucide-react";

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
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Детали позиции заказа</DialogTitle>
          <DialogDescription>
            {orderItem.name} (Размер: {orderItem.size})
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {orderItem.image && (
            <img
              src={orderItem.image}
              alt={orderItem.name}
              className="w-full h-48 object-cover rounded-md mb-4"
            />
          )}
          <p>
            <strong>Товар:</strong> {orderItem.name}
          </p>
          <p>
            <strong>Размер:</strong> {orderItem.size}
          </p>
          <p>
            <strong>Цена:</strong> {formatCurrency(orderItem.price)}
          </p>

          <div>
            <label htmlFor="sku" className="text-sm font-medium text-muted-foreground">
              SKU (артикул)
            </label>
            <Input
              id="sku"
              value={skuInput}
              onChange={(e) => setSKUInput(e.target.value)}
              disabled={isSubmitting || !!orderItem.sku}
              className="mt-1"
            />
            {orderItem.sku && (
              <p className="text-xs text-muted-foreground mt-1">
                SKU заблокирован после назначения.
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Закрыть
          </Button>
          {!orderItem.sku && (
            <Button onClick={handleSaveSKU} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isSubmitting ? "Сохранение..." : "Сохранить SKU"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
