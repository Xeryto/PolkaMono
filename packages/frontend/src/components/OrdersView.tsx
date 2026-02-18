import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OrderDetailsPage } from "@/pages/OrderDetailsPage";
import * as api from "@/services/api";
import { OrderResponse } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext"; // Import useAuth
import { formatCurrency } from "@/lib/currency";
import { getOrderStatusLabel, getOrderStatusColor } from "@/lib/orderStatus";

export function OrdersView() {
  const [orders, setOrders] = useState<OrderResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<OrderResponse | null>(
    null,
  );
  const { toast } = useToast();
  const { token } = useAuth(); // Get token from useAuth

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
        const fetchedOrders = await api.getOrders(token); // Pass token
        setOrders(fetchedOrders);
      } catch (error: any) {
        console.error("Failed to fetch orders:", error);
        toast({
          title: "Ошибка",
          description: error.message || "Не удалось загрузить заказы.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchOrders();
  }, [token, toast]); // Add token and toast to dependency array

  if (isLoadingDetail || selectedOrder) {
    if (selectedOrder) {
      return (
        <OrderDetailsPage
          order={selectedOrder}
          onBack={() => setSelectedOrder(null)}
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

      <Card className="bg-card-custom border-border/30 shadow-lg">
        <CardHeader>
          <CardTitle>Все заказы</CardTitle>
          <CardDescription>
            Просмотр и управление заказами клиентов
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div>Загрузка заказов...</div>
          ) : orders.length === 0 ? (
            <div>Заказы не найдены.</div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                  onClick={() => setSelectedOrder(order)}
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
