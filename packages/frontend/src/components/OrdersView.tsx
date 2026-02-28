import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OrderDetailsPage } from "@/pages/OrderDetailsPage";
import * as api from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { formatCurrency } from "@/lib/currency";
import { getOrderStatusLabel, getOrderStatusColor } from "@/lib/orderStatus";

interface OrdersViewProps {
  targetOrderId?: string | null;
  onTargetConsumed?: () => void;
}

export function OrdersView({ targetOrderId, onTargetConsumed }: OrdersViewProps) {
  const [orders, setOrders] = useState<api.OrderSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<api.OrderResponse | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const { toast } = useToast();
  const { token } = useAuth();

  useEffect(() => {
    const fetchOrders = async () => {
      if (!token) {
        setIsLoading(false);
        toast({
          title: "Ошибка",
          description:
            "Токен аутентификации не найден. Пожалуйста, войдите в систему.",
          variant: "destructive",
        });
        return;
      }

      try {
        setIsLoading(true);
        const fetchedOrders = await api.getOrders(token);
        setOrders(fetchedOrders);
      } catch (error: unknown) {
        console.error("Failed to fetch orders:", error);
        const err = error as { message?: string };
        toast({
          title: "Ошибка",
          description: err.message || "Не удалось загрузить заказы.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchOrders();
  }, [token, toast]);

  useEffect(() => {
    if (!selectedOrderId || !token) return;
    let cancelled = false;
    setIsLoadingDetail(true);
    setSelectedOrder(null);
    api
      .getOrder(selectedOrderId, token)
      .then((order) => {
        if (!cancelled) setSelectedOrder(order);
      })
      .catch((err) => {
        if (!cancelled) {
          toast({
            title: "Ошибка",
            description: err.message || "Не удалось загрузить заказ.",
            variant: "destructive",
          });
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingDetail(false);
          setSelectedOrderId(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedOrderId, token, toast]);

  // Scroll to and highlight targeted order when navigating from bell notification
  useEffect(() => {
    if (!targetOrderId) return;
    const el = document.querySelector(`[data-order-id="${targetOrderId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-brand', 'transition-all');
      const timer = setTimeout(() => {
        el.classList.remove('ring-2', 'ring-brand');
        onTargetConsumed?.();
      }, 2000);
      return () => clearTimeout(timer);
    } else {
      onTargetConsumed?.();
    }
  }, [targetOrderId, onTargetConsumed]);

  if (isLoadingDetail || selectedOrder) {
    if (selectedOrder) {
      return (
        <OrderDetailsPage
          order={selectedOrder}
          onBack={() => {
            setSelectedOrder(null);
            setSelectedOrderId(null);
          }}
          onOrderUpdated={async () => {
            if (token && selectedOrder) {
              const updated = await api.getOrder(selectedOrder.id, token);
              setSelectedOrder(updated);
              const list = await api.getOrders(token);
              setOrders(list);
            }
          }}
        />
      );
    }
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        Загрузка заказа...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">Заказы</h2>

      <Card className="bg-card border-border/30 shadow-sm">
        <CardHeader>
          <CardTitle>Все заказы</CardTitle>
          <CardDescription>
            Просмотр и управление заказами клиентов
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg">
                  <div className="space-y-2">
                    <div className="h-4 w-32 bg-muted/30 rounded animate-shimmer bg-[length:200%_100%] bg-gradient-to-r from-muted/20 via-muted/40 to-muted/20" />
                    <div className="h-3 w-24 bg-muted/30 rounded animate-shimmer bg-[length:200%_100%] bg-gradient-to-r from-muted/20 via-muted/40 to-muted/20" />
                  </div>
                  <div className="h-6 w-20 bg-muted/30 rounded animate-shimmer bg-[length:200%_100%] bg-gradient-to-r from-muted/20 via-muted/40 to-muted/20" />
                </div>
              ))}
            </div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <p className="text-muted-foreground">Заказов пока нет</p>
              <p className="text-sm text-muted-foreground/70 mt-1">Заказы появятся здесь, когда покупатели оформят покупку.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => (
                <div
                  key={order.id}
                  data-order-id={order.id}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-accent/50 cursor-pointer transition-colors border border-transparent hover:border-border/30"
                  onClick={() => setSelectedOrderId(order.id)}
                >
                  <div>
                    <p className="font-medium text-foreground">
                      Заказ № {order.number}
                    </p>
                    {order.tracking_number && (
                      <p className="text-sm text-muted-foreground">
                        Отслеживание: {order.tracking_number}
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground">
                      Итого: {formatCurrency(order.total_amount)}
                    </p>
                    {order.shipping_cost != null && order.shipping_cost > 0 && (
                      <p className="text-sm text-muted-foreground">
                        Доставка: {formatCurrency(order.shipping_cost)}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-foreground">
                      {new Date(order.date).toLocaleDateString()}
                    </p>
                    <Badge
                      className={getOrderStatusColor(order.status)}
                      variant="outline"
                    >
                      {getOrderStatusLabel(order.status)}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
