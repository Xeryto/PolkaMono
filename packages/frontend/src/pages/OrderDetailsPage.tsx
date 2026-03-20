import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { OrderItemDetailsModal } from "@/components/OrderItemDetailsModal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/currency";
import * as api from "@/services/api";
import { useAuth } from "@/context/AuthContext";
import {
  getOrderStatusLabel,
  getOrderStatusColor,
  ORDER_STATUS,
} from "@/lib/orderStatus";

interface OrderDetailsPageProps {
  order: api.OrderResponse;
  onBack: () => void;
  onOrderUpdated?: () => void;
}

export function OrderDetailsPage({ order, onBack, onOrderUpdated }: OrderDetailsPageProps) {
  const [orderStatus, setOrderStatus] = useState(order.status);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOrderItem, setSelectedOrderItem] = useState<api.OrderItemResponse | null>(null);
  const [trackingNumberInput, setTrackingNumberInput] = useState(order.tracking_number || "");
  const [isSavingTracking, setIsSavingTracking] = useState(false);
  const [trackingLinkInput, setTrackingLinkInput] = useState(order.tracking_link || "");
  const [shoppingInfo, setShoppingInfo] = useState<api.ShoppingInfo | null>(null);
  const { token } = useAuth();

  useEffect(() => {
    setOrderStatus(order.status);
  }, [order.status, order.id]);

  useEffect(() => {
    if (order) {
      setShoppingInfo({
        full_name: order.delivery_full_name || "",
        delivery_email: order.delivery_email || "",
        phone: order.delivery_phone || "",
        address: order.delivery_address || "",
        city: order.delivery_city || "",
        postal_code: order.delivery_postal_code || "",
      });
    }
  }, [order]);

  const handleItemClick = (item: api.OrderItemResponse) => {
    setSelectedOrderItem(item);
    setIsModalOpen(true);
  };

  const handleSKUUpdated = (orderItemId: string, newSKU: string) => {
    setSelectedOrderItem((prev) => prev ? { ...prev, sku: newSKU } : null);
  };

  const canEditTracking = orderStatus === ORDER_STATUS.PAID || orderStatus === ORDER_STATUS.SHIPPED;

  const handleSaveTrackingNumber = async () => {
    setIsSavingTracking(true);
    if (!token) {
      toast.error("Токен не найден. Войдите в систему.");
      setIsSavingTracking(false);
      return;
    }
    try {
      await api.updateOrderTracking(
        order.id,
        { tracking_number: trackingNumberInput, tracking_link: trackingLinkInput },
        token,
      );
      onOrderUpdated?.();
      toast.success("Информация об отслеживании обновлена.");
    } catch (error: unknown) {
      const err = error as { message?: string };
      toast.error(err.message || "Не удалось обновить информацию об отслеживании.");
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
          <h2 className="text-2xl font-bold text-foreground">Детали заказа</h2>
          <p className="text-muted-foreground">
            Заказ № {order.number}
          </p>
        </div>
      </div>

      {/* Tracking */}
      <Card className="bg-card border-border/30 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Отслеживание</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="trackingNumber">Номер отслеживания</Label>
            <div className="flex items-center gap-2 mt-1">
              <Input
                id="trackingNumber"
                value={trackingNumberInput}
                onChange={(e) => setTrackingNumberInput(e.target.value)}
                placeholder="Введите номер отслеживания"
                className="flex-1"
                disabled={!canEditTracking}
              />
              <Button
                onClick={handleSaveTrackingNumber}
                disabled={isSavingTracking || !canEditTracking}
              >
                {isSavingTracking && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isSavingTracking ? "Сохранение..." : "Сохранить"}
              </Button>
            </div>
          </div>
          <div>
            <Label htmlFor="trackingLink">Ссылка на отслеживание</Label>
            <Input
              id="trackingLink"
              value={trackingLinkInput}
              onChange={(e) => setTrackingLinkInput(e.target.value)}
              placeholder="Полный URL отслеживания"
              className="mt-1"
              disabled={!canEditTracking}
            />
            {order.tracking_number && order.tracking_link && (
              <p className="text-sm text-muted-foreground mt-1">
                <a
                  href={order.tracking_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline"
                >
                  Отследить: {order.tracking_number}
                </a>
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Shipping info */}
      {shoppingInfo && (
        <Card className="bg-card border-border/30 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Информация о доставке</CardTitle>
            <CardDescription>Данные получателя</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InfoField label="Получатель" value={shoppingInfo.full_name} />
              <InfoField label="Телефон" value={shoppingInfo.phone} />
              <InfoField label="Email для доставки" value={shoppingInfo.delivery_email} />
              <InfoField label="Город" value={shoppingInfo.city} />
              <div className="md:col-span-2">
                <InfoField label="Адрес доставки" value={shoppingInfo.address} />
              </div>
              {shoppingInfo.postal_code && (
                <InfoField label="Почтовый индекс" value={shoppingInfo.postal_code} />
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Order items */}
      <Card className="bg-card border-border/30 shadow-sm">
        <CardHeader>
          <div className="flex justify-between items-start">
            <CardTitle>Заказ № {order.number}</CardTitle>
            <Badge className={getOrderStatusColor(orderStatus)} variant="outline">
              {getOrderStatusLabel(orderStatus)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {(order.items ?? []).map((item, index) => {
              const isReturned = item.status === "returned";
              return (
                <div
                  key={index}
                  className={`flex justify-between items-center cursor-pointer hover:bg-muted/50 p-2 rounded-lg${isReturned ? " opacity-45" : ""}`}
                  onClick={() => handleItemClick(item)}
                >
                  <div>
                    <p className={`font-medium ${isReturned ? "text-muted-foreground" : "text-foreground"}`}>
                      {item.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Размер: {item.size}
                    </p>
                    {item.sku && (
                      <p className="text-sm text-muted-foreground">
                        SKU: {item.sku}
                      </p>
                    )}
                    {isReturned && (
                      <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full bg-destructive/15 text-destructive font-medium">
                        возвращён
                      </span>
                    )}
                  </div>
                  <p className={`font-bold ${isReturned ? "text-muted-foreground" : "text-foreground"}`}>
                    {formatCurrency(item.price)}
                  </p>
                </div>
              );
            })}
          </div>
          <div className="mt-6 pt-4 border-t border-border/30 space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Товары</span>
              <span>{formatCurrency(order.total_amount - (order.shipping_cost ?? 0))}</span>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Доставка</span>
              <span>{order.shipping_cost ? formatCurrency(order.shipping_cost) : "Бесплатно"}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-border/30">
              <span className="text-xl font-bold text-foreground">Итого</span>
              <span className="text-xl font-bold text-foreground">{formatCurrency(order.total_amount)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedOrderItem && (
        <OrderItemDetailsModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          orderId={order.id}
          orderItem={selectedOrderItem}
          onSKUUpdated={handleSKUUpdated}
        />
      )}
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Label className="text-sm font-medium text-muted-foreground">{label}</Label>
      <p className="text-foreground">{value || "Не указано"}</p>
    </div>
  );
}
