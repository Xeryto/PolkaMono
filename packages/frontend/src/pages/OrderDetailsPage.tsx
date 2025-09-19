import React, { useState } from 'react'; // Added useState
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { OrderItemDetailsModal } from "@/components/OrderItemDetailsModal"; // NEW Import
import { Input } from "@/components/ui/input"; // NEW Import
import { Label } from "@/components/ui/label"; // NEW Import
import { useToast } from "@/hooks/use-toast"; // NEW Import
import * as api from "@/services/api"; // Import api
import { useAuth } from "@/context/AuthContext"; // Import useAuth

interface Order {
  id: string;
  number: string;
  date: string;
  status: string;
  total: string;
  tracking_number?: string;
  tracking_link?: string;
    items: api.OrderItemResponse[];
}

interface OrderDetailsPageProps {
  order: Order;
  onBack: () => void;
}

export function OrderDetailsPage({ order, onBack }: OrderDetailsPageProps) {
  const [isModalOpen, setIsModalOpen] = useState(false); // NEW State
  const [selectedOrderItem, setSelectedOrderItem] = useState<api.OrderItemResponse | null>(null); // Explicitly type selectedOrderItem
  const [trackingNumberInput, setTrackingNumberInput] = useState(order.tracking_number || ''); // NEW State
  const [isSavingTracking, setIsSavingTracking] = useState(false); // NEW State
  const [trackingLinkInput, setTrackingLinkInput] = useState(order.tracking_link || ''); // NEW State
  const { toast } = useToast(); // NEW
  const { token } = useAuth(); // Get token from useAuth

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered': return 'bg-green-900/20 text-green-300 border-green-700/30';
      case 'shipped': return 'bg-blue-900/20 text-blue-300 border-blue-700/30';
      case 'processing': return 'bg-yellow-900/20 text-yellow-300 border-yellow-700/30';
      default: return 'bg-gray-900/20 text-gray-300 border-gray-700/30';
    }
  };

  const handleItemClick = (item: any) => { // NEW Handler
    setSelectedOrderItem(item);
    setIsModalOpen(true);
  };

  const handleHonestSignUpdated = (orderItemId: string, newHonestSign: string) => { // NEW Handler
    // Update the honest_sign in the local order state
    const updatedItems = order.items.map(item =>
      item.id === orderItemId ? { ...item, honest_sign: newHonestSign } : item
    );
    // This requires the order prop to be mutable or to re-fetch the order
    // For now, we'll just update the selectedOrderItem in the modal.
    // In a real app, you'd likely re-fetch the entire order to ensure data consistency
    // or pass a setter for the order prop from the parent component.
    setSelectedOrderItem(prev => prev ? { ...prev, honest_sign: newHonestSign } : null);
  };

  const handleSaveTrackingNumber = async () => { // NEW Handler
    setIsSavingTracking(true);
    if (!token) {
      toast({
        title: "Error",
        description: "Authentication token not found. Please log in.",
        variant: "destructive",
      });
      setIsSavingTracking(false);
      return;
    }
    try {
      await api.updateOrderTracking(order.id, {
        tracking_number: trackingNumberInput,
        tracking_link: trackingLinkInput,
      }, token); // Pass token
      toast({
        title: "Success",
        description: "Tracking information updated successfully.",
      });
    } catch (error: any) {
      console.error("Failed to update tracking information:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update tracking information.",
        variant: "destructive",
      });
    } finally {
      setIsSavingTracking(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold text-foreground">Order Details</h2>
          <p className="text-muted-foreground">Details for order {order.number}</p>
          <div className="mt-4">
            <Label htmlFor="trackingNumber">Tracking Number</Label>
            <div className="flex items-center space-x-2 mt-1">
              <Input
                id="trackingNumber"
                value={trackingNumberInput}
                onChange={(e) => setTrackingNumberInput(e.target.value)}
                placeholder="Enter tracking number"
                className="flex-1"
              />
              <Button onClick={handleSaveTrackingNumber} disabled={isSavingTracking}>
                {isSavingTracking ? "Saving..." : "Save"}
              </Button>
            </div>
            <div className="mt-4">
            <Label htmlFor="trackingLink" className="mt-2">Tracking Link</Label>
            <Input
              id="trackingLink"
              value={trackingLinkInput}
              onChange={(e) => setTrackingLinkInput(e.target.value)}
              placeholder="Enter full tracking URL"
              className="mt-1"
            />
            {order.tracking_number && order.tracking_link && (
              <p className="text-sm text-muted-foreground mt-1">
                <a href={order.tracking_link} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                  Track: {order.tracking_number}
                </a>
              </p>
            )}
          </div>
          </div>
        </div>
      </div>

      <Card className="bg-card border-border/30 shadow-lg">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>Заказ № {order.number}</CardTitle>
            </div>
            <Badge className={getStatusColor(order.status)} variant="outline">
              {order.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {order.items.map((item, index) => (
              <div key={index} className="flex justify-between items-center cursor-pointer hover:bg-muted/50 p-2 rounded-lg" onClick={() => handleItemClick(item)}> {/* NEW Clickable */}
                <div>
                  <p className="font-medium text-foreground">{item.name}</p>
                  <p className="text-sm text-muted-foreground">Size: {item.size}</p>
                  {item.honest_sign && (
                    <p className="text-sm text-muted-foreground">Honest Sign: {item.honest_sign}</p>
                  )}
                </div>
                <p className="font-bold text-foreground">{item.price}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 pt-4 border-t border-border/30 flex justify-end">
            <p className="text-xl font-bold text-foreground">Total: {order.total}</p>
          </div>
        </CardContent>
      </Card>

      {selectedOrderItem && (
        <OrderItemDetailsModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          orderId={order.id}
          orderItem={selectedOrderItem}
          onHonestSignUpdated={handleHonestSignUpdated}
        />
      )} {/* NEW Modal */}
    </div>
  );
}