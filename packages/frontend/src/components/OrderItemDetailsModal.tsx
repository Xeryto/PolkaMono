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
import { useToast } from "@/hooks/use-toast";
import * as api from "@/services/api";
import { useAuth } from "@/context/AuthContext"; // Import useAuth
import { formatCurrency } from "@/lib/currency";

interface OrderItemDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string; // ID of the parent order
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
  const [skuInput, setSKUInput] = useState(
    orderItem.sku || ""
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { token } = useAuth(); // Get token from useAuth

  const handleSaveSKU = async () => {
    if (!skuInput.trim()) {
      toast({
        title: "ошибка",
        description: "sku не может быть пустым.",
        variant: "destructive",
      });
      return;
    }

    if (!token) {
      toast({
        title: "ошибка",
        description: "токен аутентификации не найден. пожалуйста, войдите в систему.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Call API to update SKU
      await api.updateOrderItemSKU(orderItem.id, skuInput, token); // Pass token
      toast({
        title: "успех",
        description: "sku успешно обновлён.",
      });
      onSKUUpdated(orderItem.id, skuInput);
      onClose();
    } catch (error: unknown) {
      const err = error as { message?: string };
      toast({
        title: "ошибка",
        description: err.message || "не удалось обновить sku.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>order item details</DialogTitle>
          <DialogDescription>
            View details for {orderItem.name} (Size: {orderItem.size})
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
            <strong>product:</strong> {orderItem.name}
          </p>
          <p>
            <strong>size:</strong> {orderItem.size}
          </p>
          <p>
            <strong>price:</strong> {formatCurrency(orderItem.price)}
          </p>

          <div>
            <label
              htmlFor="sku"
              className="text-sm font-medium text-muted-foreground"
            >
              sku (stock keeping unit)
            </label>
            <Input
              id="sku"
              value={skuInput}
              onChange={(e) => setSKUInput(e.target.value)}
              disabled={isSubmitting || !!orderItem.sku} // Disable if submitting or already assigned
              className="mt-1"
            />
            {orderItem.sku && (
              <p className="text-xs text-muted-foreground mt-1">
                sku is locked once assigned.
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            close
          </Button>
          {!orderItem.sku && ( // Only show save button if SKU is not yet assigned
            <Button onClick={handleSaveSKU} disabled={isSubmitting}>
              {isSubmitting ? "saving..." : "save sku"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
