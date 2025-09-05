import React, { useState } from 'react';
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
import * as api from "@/services/api"; // Assuming API calls are here

interface OrderItemDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string; // ID of the parent order
  orderItem: {
    id: string; // OrderItem ID
    product_id: string;
    product_name: string;
    product_image?: string;
    product_size: string;
    price: string;
    honest_sign?: string;
  };
  onHonestSignUpdated: (orderItemId: string, newHonestSign: string) => void;
}

export const OrderItemDetailsModal: React.FC<OrderItemDetailsModalProps> = ({
  isOpen,
  onClose,
  orderId,
  orderItem,
  onHonestSignUpdated,
}) => {
  const [honestSignInput, setHonestSignInput] = useState(orderItem.honest_sign || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSaveHonestSign = async () => {
    if (!honestSignInput.trim()) {
      toast({
        title: "Error",
        description: "Honest Sign cannot be empty.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Call API to update honest sign
      await api.updateOrderItemHonestSign(orderItem.id, honestSignInput);
      toast({
        title: "Success",
        description: "Honest Sign updated successfully.",
      });
      onHonestSignUpdated(orderItem.id, honestSignInput);
      onClose();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update Honest Sign.",
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
          <DialogTitle>Order Item Details</DialogTitle>
          <DialogDescription>
            View details for {orderItem.product_name} (Size: {orderItem.product_size})
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {orderItem.product_image && (
            <img src={orderItem.product_image} alt={orderItem.product_name} className="w-full h-48 object-cover rounded-md mb-4" />
          )}
          <p><strong>Product:</strong> {orderItem.product_name}</p>
          <p><strong>Size:</strong> {orderItem.product_size}</p>
          <p><strong>Price:</strong> {orderItem.price}</p>

          <div>
            <label htmlFor="honestSign" className="text-sm font-medium text-muted-foreground">
              Honest Sign
            </label>
            <Input
              id="honestSign"
              value={honestSignInput}
              onChange={(e) => setHonestSignInput(e.target.value)}
              disabled={isSubmitting || !!orderItem.honest_sign} // Disable if submitting or already assigned
              className="mt-1"
            />
            {orderItem.honest_sign && (
              <p className="text-xs text-muted-foreground mt-1">
                Honest Sign is locked once assigned.
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {!orderItem.honest_sign && ( // Only show save button if honest sign is not yet assigned
            <Button onClick={handleSaveHonestSign} disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Honest Sign"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};